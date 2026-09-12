#!/usr/bin/env node

// End-to-end acceptance evidence for MedGuard. The live path uses the real
// localhost UI and backend only. The one fault test is deliberately isolated
// in another browser context and is labelled synthetic_fault_injection in its
// output; it never supplies a successful review.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.MEDGUARD_URL || process.env.BASELINE_URL || "http://127.0.0.1:5173";
const apiUrl = process.env.MEDGUARD_API_URL || "http://127.0.0.1:8910/api/medcheck";
const outputDir = resolve(process.env.MEDGUARD_EVIDENCE_DIR || "docs/evidence/current");
const timeoutMs = Number(process.env.MEDGUARD_TIMEOUT_MS || 100_000);
const desktop = { width: 1440, height: 1000 };
const mobile = { width: 390, height: 844 };
const storageKey = "medguard.cabinet.v1";
const sampleProfile = { meds: ["warfarin"], conditions: ["hypertension"] };
const workflows = ["Fish oil", "Ginkgo", "St. John's Wort", "Vitamin D"];
const requiredTools = ["identify_supplement", "check_recall", "check_interactions", "check_dosage"];

const now = () => new Date().toISOString();
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const report = {
  generatedAt: now(),
  baseUrl,
  apiUrl,
  syntheticHealthDataOnly: true,
  liveFlow: { interception: false, requests: [], states: [] },
  directApiChecks: [],
  negativeSuite: { interception: true, label: "synthetic_fault_injection_503", states: [] },
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  assertions: [],
  failures: [],
};

function message(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseJson(text) {
  try { return { value: JSON.parse(text), parsed: true }; } catch { return { value: null, parsed: false }; }
}

function check(name, passed, detail = {}) {
  const entry = { name, passed: Boolean(passed), detail, at: now() };
  report.assertions.push(entry);
  if (!entry.passed) report.failures.push({ name, detail, at: entry.at });
  return entry.passed;
}

function requireCheck(name, passed, detail = {}) {
  if (!check(name, passed, detail)) throw new Error(`${name}: ${JSON.stringify(detail)}`);
}

async function write(name, value) {
  await writeFile(resolve(outputDir, name), json(value), "utf8");
}

async function storageSnapshot(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { /* captured as rawPresent below */ }
    const cabinet = Array.isArray(parsed?.cabinet) ? parsed.cabinet : [];
    return {
      rawPresent: Boolean(raw),
      onboarded: parsed?.onboarded === true,
      cabinetCount: cabinet.length,
      profile: parsed?.profile || null,
      cabinet: cabinet.map((item) => ({
        id: item?.id || null,
        scan: item?.scan || null,
        checkedAt: item?.checkedAt || null,
        resultCheckedAt: item?.result?.checked_at || null,
        identitySourceUrl: item?.identity?.source_url || item?.result?.identity?.source_url || null,
        recallSourceUrls: item?.result?.recall?.source_urls || [],
        recallRecordDates: (item?.result?.recall?.records || []).map((record) => record?.dates || null),
        interactionSourceUrls: (item?.result?.interactions || []).map((finding) => finding?.source_url || null),
        dosageSourceUrls: (item?.result?.dosage || []).map((reference) => reference?.source_url || null),
        profileSnapshot: item?.profileSnapshot || null,
      })),
    };
  }, storageKey);
}

async function state(page, label, suite) {
  const result = {
    label,
    capturedAt: now(),
    url: page.url(),
    waiting: await page.locator(".mg-waiting-card").isVisible().catch(() => false),
    welcome: await page.locator(".mg-welcome").isVisible().catch(() => false),
    candidates: await page.locator(".mg-candidates").isVisible().catch(() => false),
    review: await page.locator(".mg-result").isVisible().catch(() => false),
    requestError: await page.locator(".mg-request-error").isVisible().catch(() => false),
    cabinetCards: await page.locator(".mg-cabinet-card").count(),
    dialog: await page.getByRole("dialog").isVisible().catch(() => false),
    toolRows: await page.locator(".mg-trace-row").count(),
    headings: await page.locator("h1, h2").allInnerTexts(),
    alertText: await page.locator("[role='alert']").allInnerTexts(),
    storage: await storageSnapshot(page),
  };
  suite.states.push(result);
  return result;
}

async function overflow(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    overflows: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
}

async function captureState(page, label, suite, { fullPage = false } = {}) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize(desktop);
  const desktopOverflow = await overflow(page);
  const desktopPath = resolve(outputDir, `desktop-${label}.png`);
  await page.screenshot({ path: desktopPath, fullPage });
  const desktopState = await state(page, `${label}:desktop`, suite);

  await page.setViewportSize(mobile);
  const mobileOverflow = await overflow(page);
  const mobilePath = resolve(outputDir, `mobile-${label}.png`);
  await page.screenshot({ path: mobilePath, fullPage });
  const mobileState = await state(page, `${label}:mobile`, suite);
  await page.setViewportSize(desktop);

  report.screenshots.push({ label, desktopPath, mobilePath, fullPage, desktopOverflow, mobileOverflow, capturedAt: now() });
  check(`no-horizontal-overflow:${label}:desktop`, !desktopOverflow.overflows, desktopOverflow);
  check(`no-horizontal-overflow:${label}:mobile`, !mobileOverflow.overflows, mobileOverflow);
  return { desktopState, mobileState };
}

function requestPayload(response) {
  const text = response.request().postData() || "";
  const parsed = parseJson(text);
  return parsed.parsed ? parsed.value : { raw: text };
}

async function recordBrowserResponse(response, label) {
  const text = await response.text();
  const parsed = parseJson(text);
  const entry = {
    label,
    capturedAt: now(),
    request: requestPayload(response),
    status: response.status(),
    statusText: response.statusText(),
    responseJson: parsed.value,
    responseText: parsed.parsed ? null : text,
  };
  report.liveFlow.requests.push(entry);
  return entry;
}

function waitForMedcheck(page, predicate) {
  return page.waitForResponse((response) => {
    if (response.request().method() !== "POST") return false;
    if (new URL(response.url()).pathname !== "/api/medcheck") return false;
    const payload = requestPayload(response);
    return predicate(payload);
  }, { timeout: timeoutMs });
}

function profileMatches(profile) {
  return Array.isArray(profile?.meds)
    && Array.isArray(profile?.conditions)
    && profile.meds.join("|") === sampleProfile.meds.join("|")
    && profile.conditions.join("|") === sampleProfile.conditions.join("|");
}

function assertTrace(label, body) {
  const trace = Array.isArray(body?.tool_trace) ? body.tool_trace : [];
  const names = trace.map((entry) => entry.tool);
  check(`${label}:four-tool-trace`, trace.length === 4, { names, count: trace.length });
  for (const tool of requiredTools) {
    const entries = trace.filter((entry) => entry.tool === tool);
    check(`${label}:${tool}:success`, entries.length === 1 && entries[0].status === "success", { entries });
  }
}

async function waitForVisible(locator, label) {
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
  } catch (error) {
    throw new Error(`${label}: ${message(error)}`);
  }
}

async function startAnotherLabel(page, label) {
  const search = page.locator("#label-search");
  if (await search.isVisible().catch(() => false)) return;
  const reset = page.getByRole("button", { name: "Find another label", exact: true });
  requireCheck(`${label}:find-another-label-available`, await reset.isVisible().catch(() => false), {});
  await reset.click();
  await waitForVisible(search, `${label}:find-another-label-reset`);
  await captureState(page, `${label}-new-label`, report.liveFlow);
}

async function liveWorkflow(page, query) {
  const id = slug(query);
  const input = page.locator("#label-search");
  await startAnotherLabel(page, id);
  await input.fill(query);
  const lookupResponse = waitForMedcheck(page, (payload) => payload.scan === query && !payload.selected_id);
  await page.getByRole("button", { name: "Find label", exact: true }).click();
  await page.waitForTimeout(120);
  await captureState(page, `${id}-lookup-waiting`, report.liveFlow);
  const lookup = await recordBrowserResponse(await lookupResponse, `${id}:lookup`);
  requireCheck(`${id}:lookup-http-200`, lookup.status === 200, { status: lookup.status, response: lookup.responseJson });
  requireCheck(`${id}:needs-confirmation`, lookup.responseJson?.status === "needs_confirmation", { status: lookup.responseJson?.status });
  requireCheck(`${id}:lookup-synthetic-profile`, profileMatches(lookup.request.profile), { request: lookup.request });
  const candidate = lookup.responseJson?.candidates?.[0];
  requireCheck(`${id}:candidate-returned`, Boolean(candidate?.id && candidate?.name), { candidates: lookup.responseJson?.candidates || [] });
  check(`${id}:lookup-only-identify-tool`, lookup.responseJson?.tool_trace?.length === 1
    && lookup.responseJson?.tool_trace?.[0]?.tool === "identify_supplement"
    && lookup.responseJson?.tool_trace?.[0]?.status === "success", { trace: lookup.responseJson?.tool_trace });
  await waitForVisible(page.locator(".mg-candidates"), `${id}:candidate-ui`);
  await captureState(page, `${id}-candidates`, report.liveFlow);

  const candidateCard = page.locator(".mg-candidate").first();
  requireCheck(`${id}:candidate-ui-name`, (await candidateCard.locator("h3").allInnerTexts())[0] === candidate.name, {
    ui: (await candidateCard.locator("h3").allInnerTexts())[0] || null,
    response: candidate.name,
  });
  const completeResponse = waitForMedcheck(page, (payload) => payload.scan === query && payload.selected_id === candidate.id);
  await candidateCard.getByRole("button", { name: "This matches my bottle", exact: true }).click();
  await page.waitForTimeout(120);
  await captureState(page, `${id}-review-waiting`, report.liveFlow);
  const complete = await recordBrowserResponse(await completeResponse, `${id}:confirmed-review`);
  requireCheck(`${id}:confirmed-http-200`, complete.status === 200, { status: complete.status, response: complete.responseJson });
  requireCheck(`${id}:complete-status`, complete.responseJson?.status === "complete", { status: complete.responseJson?.status });
  requireCheck(`${id}:selected-id-is-returned-candidate`, complete.request.selected_id === candidate.id, { request: complete.request, candidateId: candidate.id });
  requireCheck(`${id}:confirmed-synthetic-profile`, profileMatches(complete.request.profile), { request: complete.request });
  assertTrace(id, complete.responseJson);
  await waitForVisible(page.locator(".mg-result"), `${id}:complete-result-ui`);
  await captureState(page, `${id}-complete-review`, report.liveFlow, { fullPage: true });
  check(`${id}:rendered-four-trace-rows`, await page.locator(".mg-trace-row").count() === 4, {
    count: await page.locator(".mg-trace-row").count(),
  });
  if (query === "Vitamin D") {
    const adultReference = complete.responseJson?.dosage?.find((entry) => typeof entry?.adult_reference_limit === "string" && entry.adult_reference_limit.trim());
    requireCheck("vitamin-d:adult-reference-returned", Boolean(adultReference), { dosage: complete.responseJson?.dosage || [] });
    await page.getByRole("button", { name: /Adult reference limits/ }).click();
    await waitForVisible(page.locator(".mg-dosage-reference"), "vitamin-d:adult-reference-rendered");
    check("vitamin-d:adult-reference-rendered-text", (await page.locator(".mg-dosage-reference").allInnerTexts()).join("\n").includes(adultReference.adult_reference_limit), {
      expected: adultReference.adult_reference_limit,
      rendered: await page.locator(".mg-dosage-reference").allInnerTexts(),
    });
    await captureState(page, "vitamin-d-adult-reference", report.liveFlow, { fullPage: true });
  }
  requireCheck(`${id}:save-action-available`, await page.getByRole("button", { name: /Add to cabinet|Update cabinet review/ }).isVisible().catch(() => false), {});
  await page.getByRole("button", { name: /Add to cabinet|Update cabinet review/ }).click();
  await page.waitForFunction((key) => {
    try { return JSON.parse(localStorage.getItem(key) || "{}").cabinet?.length > 0; } catch { return false; }
  }, storageKey, { timeout: timeoutMs });
  await captureState(page, `${id}-saved`, report.liveFlow);
  return { query, candidate, lookup, complete };
}

async function directApiCheck(label, payload) {
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    const parsed = parseJson(text);
    const result = {
      label,
      capturedAt: now(),
      request: payload,
      status: response.status,
      responseJson: parsed.value,
      responseText: parsed.parsed ? null : text,
    };
    report.directApiChecks.push(result);
    return result;
  } catch (error) {
    const result = { label, capturedAt: now(), request: payload, error: message(error) };
    report.directApiChecks.push(result);
    return result;
  }
}

async function runCheapApiChecks() {
  const loose = await directApiCheck("loose-pill-fail-closed", {
    scan: "loose white pill without imprint",
    profile: sampleProfile,
  });
  check("api:loose-pill-http-200", loose.status === 200, loose);
  check("api:loose-pill-unidentified", loose.responseJson?.status === "unidentified" && loose.responseJson?.tools === 0, loose.responseJson || loose);

  const tampered = await directApiCheck("tampered-selected-id", {
    scan: "Fish oil",
    profile: sampleProfile,
    selected_id: "synthetic-not-a-returned-dsld-candidate",
  });
  check("api:tampered-id-rejected", tampered.status === 400 && tampered.responseJson?.error?.code === "invalid_selected_id", tampered);

  const invalid = await directApiCheck("invalid-payload", {
    scan: 42,
    profile: { meds: [], conditions: [] },
  });
  check("api:invalid-payload-rejected", invalid.status === 400 && invalid.responseJson?.error?.code === "invalid_scan", invalid);
}

async function runFaultInjection(browser) {
  const context = await browser.newContext({ viewport: desktop });
  const page = await context.newPage();
  page.on("console", (entry) => {
    if (entry.type() === "error") report.consoleErrors.push({ suite: "synthetic_fault_injection", text: entry.text(), at: now() });
  });
  page.on("pageerror", (error) => report.pageErrors.push({ suite: "synthetic_fault_injection", message: message(error), at: now() }));
  await context.route("**/api/medcheck", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 503,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        error: {
          code: "synthetic_fault_injection",
          message: "Synthetic test fault: review unavailable.",
        },
      }),
    });
  });
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.getByRole("button", { name: "Try a sample profile", exact: true }).click();
    await page.locator("#label-search").fill("Fish oil");
    await page.getByRole("button", { name: "Find label", exact: true }).click();
    await waitForVisible(page.locator(".mg-request-error"), "synthetic-503-error-ui");
    const failureState = await captureState(page, "synthetic-503-failure", report.negativeSuite);
    check("synthetic-503:shows-failure-label", failureState.desktopState.requestError, failureState.desktopState);
    check("synthetic-503:no-review-ready", !failureState.desktopState.review && !failureState.desktopState.headings.includes("Review ready"), failureState.desktopState);
    check("synthetic-503:no-cabinet-item", failureState.desktopState.cabinetCards === 0, failureState.desktopState);
  } finally {
    await context.close().catch(() => {});
  }
}

function persistedDates(storage) {
  return storage.cabinet.map((item) => ({
    id: item.id,
    checkedAt: item.checkedAt,
    resultCheckedAt: item.resultCheckedAt,
    recallRecordDates: item.recallRecordDates,
  }));
}

function persistedSources(storage) {
  return storage.cabinet.map((item) => ({
    id: item.id,
    identitySourceUrl: item.identitySourceUrl,
    recallSourceUrls: item.recallSourceUrls,
    interactionSourceUrls: item.interactionSourceUrls,
    dosageSourceUrls: item.dosageSourceUrls,
  }));
}

async function runLiveFlow(browser) {
  const context = await browser.newContext({ viewport: desktop });
  const page = await context.newPage();
  page.on("console", (entry) => {
    if (entry.type() === "error") report.consoleErrors.push({ suite: "live", text: entry.text(), at: now() });
  });
  page.on("pageerror", (error) => report.pageErrors.push({ suite: "live", message: message(error), at: now() }));
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await waitForVisible(page.locator(".mg-welcome"), "welcome-screen");
    const empty = await state(page, "welcome-empty", report.liveFlow);
    check("welcome:empty-browser-record", empty.storage.rawPresent === false && empty.cabinetCards === 0, empty);
    await captureState(page, "welcome-empty", report.liveFlow);

    await page.getByRole("button", { name: "Try a sample profile", exact: true }).click();
    await waitForVisible(page.locator("#label-search"), "sample-profile-check-screen");
    check("sample-profile:banner", await page.getByLabel("Sample profile notice").isVisible().catch(() => false), {});
    await captureState(page, "sample-profile", report.liveFlow);

    const completed = [];
    for (const query of workflows) completed.push(await liveWorkflow(page, query));

    const fish = completed.find((entry) => entry.query === "Fish oil");
    const stJohn = completed.find((entry) => entry.query === "St. John's Wort");
    const fishRecallRecords = fish.complete.responseJson?.recall?.records || [];
    check("fish-oil:excludes-unrelated-tea-tree-balm", !fishRecallRecords.some((record) =>
      /D-0185-2026|tea tree|doctor d\. schwab/i.test(`${record?.recall_number || ""} ${record?.product_description || ""}`)), {
      records: fishRecallRecords,
    });
    check("st-johns-wort:warfarin-review-prompt", (stJohn.complete.responseJson?.interactions || []).some((finding) =>
      /warfarin/i.test(`${finding?.against || ""} ${finding?.note || ""}`) && Boolean(finding?.source_url)), {
      interactions: stJohn.complete.responseJson?.interactions || [],
    });
    await page.waitForFunction(({ key, count }) => {
      try { return JSON.parse(localStorage.getItem(key) || "{}").cabinet?.length === count; } catch { return false; }
    }, { key: storageKey, count: workflows.length }, { timeout: timeoutMs });
    const beforeReloadStorage = await storageSnapshot(page);

    await page.getByRole("button", { name: "Cabinet", exact: true }).click();
    await waitForVisible(page.locator(".mg-cabinet-page"), "cabinet-screen");
    check("cabinet:confirmed-products", await page.locator(".mg-cabinet-card").count() === workflows.length, {
      count: await page.locator(".mg-cabinet-card").count(),
      expected: workflows.length,
    });
    await captureState(page, "cabinet-confirmed-products", report.liveFlow);

    const noteTrigger = page.getByRole("button", { name: "Prepare pharmacist note", exact: true });
    await noteTrigger.click();
    const dialog = page.getByRole("dialog", { name: "Pharmacist review note" });
    await waitForVisible(dialog, "pharmacist-note-dialog");
    await captureState(page, "pharmacist-note", report.liveFlow);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: timeoutMs });
    const returnedFocus = await noteTrigger.evaluate((element) => document.activeElement === element).catch(() => false);
    check("note-dialog:escape-closes", !(await dialog.isVisible().catch(() => false)), {});
    check("note-dialog:escape-returns-focus", returnedFocus, {});

    await noteTrigger.click();
    await waitForVisible(dialog, "pharmacist-note-dialog-download");
    const downloadPromise = page.waitForEvent("download", { timeout: timeoutMs });
    await page.getByRole("button", { name: "Download text", exact: true }).click();
    const download = await downloadPromise;
    const notePath = resolve(outputDir, "medguard-review-note.txt");
    await download.saveAs(notePath);
    const note = await readFile(notePath, "utf8");
    check("note-dialog:downloaded-text", note.includes("MEDGUARD — PHARMACIST / CLINICIAN REVIEW NOTE"), {
      suggestedFilename: download.suggestedFilename(),
      path: notePath,
    });
    check("note-dialog:labels-synthetic-sample-profile", note.includes("CURRENT PROFILE — SYNTHETIC SAMPLE DATA"), {});
    check("note-dialog:retains-original-label-searches", completed.every((entry) => note.includes(`Original label search: ${entry.query}`)), {});
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: timeoutMs });

    await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
    // Reload intentionally starts in Check; persistence is asserted after navigating
    // back to Cabinet, rather than treating a tab choice as a storage failure.
    await waitForVisible(page.locator("#label-search"), "check-after-reload");
    await captureState(page, "check-after-refresh", report.liveFlow);
    await page.getByRole("button", { name: "Cabinet", exact: true }).click();
    await waitForVisible(page.locator(".mg-cabinet-page"), "cabinet-after-reload");
    const afterReload = await state(page, "cabinet-after-reload", report.liveFlow);
    check("persistence:confirmed-items-after-refresh", afterReload.cabinetCards === workflows.length && afterReload.storage.cabinetCount === workflows.length, afterReload);
    check("persistence:dates-preserved-after-refresh", JSON.stringify(persistedDates(afterReload.storage)) === JSON.stringify(persistedDates(beforeReloadStorage)), {
      before: persistedDates(beforeReloadStorage),
      after: persistedDates(afterReload.storage),
    });
    check("persistence:sources-preserved-after-refresh", JSON.stringify(persistedSources(afterReload.storage)) === JSON.stringify(persistedSources(beforeReloadStorage)), {
      before: persistedSources(beforeReloadStorage),
      after: persistedSources(afterReload.storage),
    });
    await captureState(page, "cabinet-after-refresh", report.liveFlow);

    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await waitForVisible(page.locator("#medicines-input"), "profile-screen");
    await page.locator("#medicines-input").fill("metformin");
    await page.getByRole("button", { name: "Add medicines", exact: true }).click();
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await waitForVisible(page.locator("#label-search"), "profile-save-returned-to-check");
    await captureState(page, "profile-edited", report.liveFlow);

    await page.getByRole("button", { name: "Cabinet", exact: true }).click();
    await waitForVisible(page.locator(".mg-cabinet-page"), "stale-cabinet-screen");
    check("profile-edit:marks-cabinet-stale", await page.getByText("Profile changed · recheck", { exact: true }).count() === workflows.length, {
      staleCount: await page.getByText("Profile changed · recheck", { exact: true }).count(),
      expected: workflows.length,
    });
    await captureState(page, "cabinet-profile-stale", report.liveFlow);

    await noteTrigger.click();
    await waitForVisible(dialog, "stale-pharmacist-note-dialog");
    const staleDownloadPromise = page.waitForEvent("download", { timeout: timeoutMs });
    await page.getByRole("button", { name: "Download text", exact: true }).click();
    const staleDownload = await staleDownloadPromise;
    const staleNotePath = resolve(outputDir, "medguard-stale-review-note.txt");
    await staleDownload.saveAs(staleNotePath);
    const staleNote = await readFile(staleNotePath, "utf8");
    check("stale-note:labels-synthetic-sample-profile", staleNote.includes("CURRENT PROFILE — SYNTHETIC SAMPLE DATA"), {});
    check("stale-note:preserves-profile-snapshot", staleNote.includes("Profile used for this stale review") && staleNote.includes("warfarin") && staleNote.includes("SYNTHETIC SAMPLE DATA"), {});
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: timeoutMs });

    const fishCard = page.locator(".mg-cabinet-card").filter({ hasText: fish.candidate.name }).first();
    await fishCard.locator(".mg-cabinet-card__open").click();
    await waitForVisible(page.locator(".mg-result"), "open-stale-fish-review");
    check("opened-review:shows-stale-warning", await page.locator(".mg-stale-banner").isVisible().catch(() => false), {});
    const recheckResponse = waitForMedcheck(page, (payload) => Boolean(payload.selected_id));
    await page.getByRole("button", { name: "Recheck current profile", exact: true }).click();
    const recheck = await recordBrowserResponse(await recheckResponse, "fish-oil:recheck-after-profile-change");
    check("recheck:uses-original-query", recheck.request.scan === fish.query, {
      originalQuery: fish.query,
      requestScan: recheck.request.scan,
      request: recheck.request,
    });
    check("recheck:uses-saved-candidate-id", recheck.request.selected_id === fish.candidate.id, {
      candidateId: fish.candidate.id,
      selectedId: recheck.request.selected_id,
    });
    check("recheck:uses-updated-profile", recheck.request.profile?.meds?.includes("metformin"), { request: recheck.request });
    check("recheck:complete", recheck.status === 200 && recheck.responseJson?.status === "complete", recheck);
    assertTrace("recheck", recheck.responseJson);
    await waitForVisible(page.locator(".mg-result"), "rechecked-fish-review");
    await captureState(page, "fish-oil-rechecked", report.liveFlow, { fullPage: true });
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const launchOptions = { headless: true };
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) launchOptions.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  const browser = await chromium.launch(launchOptions);
  try {
    await runCheapApiChecks();
    await runLiveFlow(browser);
    await runFaultInjection(browser);
    check("console:no-live-errors", report.consoleErrors.filter((entry) => entry.suite === "live").length === 0, report.consoleErrors);
    check("page:no-live-errors", report.pageErrors.filter((entry) => entry.suite === "live").length === 0, report.pageErrors);
  } catch (error) {
    report.failures.push({ name: "runner", detail: { message: message(error) }, at: now() });
  } finally {
    report.finishedAt = now();
    await browser.close().catch(() => {});
    await write("verification-report.json", report);
    await write("api-responses.json", {
      generatedAt: report.finishedAt,
      syntheticHealthDataOnly: true,
      liveResponses: report.liveFlow.requests,
      directApiChecks: report.directApiChecks,
      syntheticFaultInjection: {
        label: report.negativeSuite.label,
        interception: true,
        response: { status: 503, code: "synthetic_fault_injection" },
      },
    });
  }
  if (report.failures.length) {
    console.error(`[verify-medguard] ${report.failures.length} assertion or runner failure(s); see ${resolve(outputDir, "verification-report.json")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[verify-medguard] ${message(error)}`);
  process.exitCode = 1;
});
