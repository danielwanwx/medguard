#!/usr/bin/env node

// Baseline-only browser evidence. This runner neither changes the app nor mocks
// a successful backend result. Every saved response is from the live local
// backend and uses the fixed, synthetic demo profile rendered by App.jsx.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseUrl = process.env.BASELINE_URL || "http://127.0.0.1:5173";
const outputDir = resolve(process.env.BASELINE_EVIDENCE_DIR || "docs/evidence/baseline");
const timeoutMs = Number(process.env.BASELINE_TIMEOUT_MS || 100_000);
const queries = ["Fish Oil", "Ginkgo", "St. John's Wort"];
const desktop = { width: 1440, height: 1000 };
const mobile = { width: 390, height: 844 };
const now = () => new Date().toISOString();
const pause = (ms) => new Promise((resolvePause) => setTimeout(resolvePause, ms));
const fileName = (query) => query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

async function write(name, value) {
  await writeFile(resolve(outputDir, name), json(value), "utf8");
}

async function screenshot(page, name) {
  const path = resolve(outputDir, name);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function ui(page) {
  const body = await page.locator("body").innerText().catch(() => "");
  const result = page.locator(".mg-finding-head").first();
  return {
    capturedAt: now(),
    url: page.url(),
    viewport: page.viewportSize(),
    profile: {
      meds: await page.locator(".mg-chip.med").allInnerTexts(),
      conditions: await page.locator(".mg-chip.cond").allInnerTexts(),
    },
    traceRows: await page.locator(".mg-trace-row").allInnerTexts(),
    loading: await page.locator(".mg-spin").isVisible().catch(() => false),
    result: {
      visible: await result.isVisible().catch(() => false),
      name: (await page.locator(".mg-finding-name").allInnerTexts())[0] ?? null,
      severity: (await page.locator(".mg-sev").allInnerTexts())[0] ?? null,
      answer: (await page.locator(".mg-answer").allInnerTexts())[0] ?? null,
      interactions: await page.locator(".mg-inter").allInnerTexts(),
      recall: await page.locator(".mg-finding-head").locator("..").locator(".mg-banner").allInnerTexts(),
      dedicatedDosageElement: await page.locator(".mg-dosage, [data-testid='dosage']").count(),
    },
    cabinet: await page.locator(".mg-cab-item").allInnerTexts(),
    doctorModalVisible: await page.locator(".mg-modal").isVisible().catch(() => false),
    horizontalOverflow: await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      overflows: document.documentElement.scrollWidth > window.innerWidth,
    })),
    bodyText: body,
  };
}

function responseRecord(query, response, bodyText, uiResult) {
  let bodyJson = null;
  try { bodyJson = JSON.parse(bodyText); } catch { /* recorded below as raw text */ }
  return {
    query,
    capturedAt: now(),
    status: response.status(),
    statusText: response.statusText(),
    bodyJson,
    bodyText: bodyJson === null ? bodyText : null,
    traceComparison: {
      responseToolTrace: Array.isArray(bodyJson?.tool_trace) ? bodyJson.tool_trace : null,
      renderedRows: uiResult.traceRows,
      responseTraceCount: Array.isArray(bodyJson?.tool_trace) ? bodyJson.tool_trace.length : null,
      renderedTraceCount: uiResult.traceRows.length,
    },
    dosageComparison: {
      responseHasDosageField: Object.prototype.hasOwnProperty.call(bodyJson || {}, "dosage"),
      renderedDedicatedDosageElementCount: uiResult.result.dedicatedDosageElement,
      renderedInFindingBody: /dosage/i.test([uiResult.result.answer, ...uiResult.result.interactions].filter(Boolean).join("\n")),
    },
  };
}

async function waitForFinding(page) {
  await page.locator(".mg-finding-head").waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForTimeout(150);
}

async function run() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: desktop });
  const page = await context.newPage();
  const evidence = {
    generatedAt: now(),
    baselineUrl: baseUrl,
    syntheticProfileOnly: true,
    profile: null,
    screenshots: {},
    requests: [],
    ui: {},
    persistence: null,
    doctorModal: null,
    failures: [],
  };

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.locator(".mg-presets").waitFor({ state: "visible", timeout: timeoutMs });
    evidence.ui.desktopInitial = await ui(page);
    evidence.profile = evidence.ui.desktopInitial.profile;
    evidence.screenshots.desktopInitial = await screenshot(page, "desktop-initial.png");

    await page.setViewportSize(mobile);
    evidence.ui.mobileInitial = await ui(page);
    evidence.screenshots.mobileInitial = await screenshot(page, "mobile-initial.png");
    await page.setViewportSize(desktop);

    for (const query of queries) {
      const id = fileName(query);
      const responsePromise = page.waitForResponse(
        (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/medcheck",
        { timeout: timeoutMs },
      );
      await page.getByRole("button", { name: query, exact: true }).click();

      // This observes only the genuine in-flight UI. It never delays, rewrites,
      // or supplies an API response.
      await pause(2_500);
      const loadingUi = await ui(page);
      evidence.ui[`${id}Loading`] = loadingUi;
      evidence.screenshots[`${id}Loading`] = await screenshot(page, `desktop-${id}-loading.png`);

      let response;
      try {
        response = await responsePromise;
      } catch (error) {
        evidence.failures.push({ query, phase: "wait-for-response", message: String(error) });
      }
      await waitForFinding(page).catch((error) => {
        evidence.failures.push({ query, phase: "wait-for-finding", message: String(error) });
      });
      const resultUi = await ui(page);
      evidence.ui[`${id}Results`] = resultUi;
      evidence.screenshots[`${id}Results`] = await screenshot(page, `desktop-${id}-results.png`);

      if (response) {
        const bodyText = await response.text().catch((error) => `<<response body unavailable: ${String(error)}>>`);
        evidence.requests.push(responseRecord(query, response, bodyText, resultUi));
      }
    }

    await page.setViewportSize(mobile);
    evidence.ui.mobileResults = await ui(page);
    evidence.screenshots.mobileResults = await screenshot(page, "mobile-results.png");
    await page.setViewportSize(desktop);

    const beforeReload = await ui(page);
    const share = page.getByRole("button", { name: "Share with my doctor", exact: true });
    if (await share.isVisible().catch(() => false)) {
      await share.click();
      await page.locator(".mg-modal").waitFor({ state: "visible", timeout: timeoutMs });
      evidence.doctorModal = await ui(page);
      evidence.screenshots.doctorModal = await screenshot(page, "desktop-doctor-modal.png");
    } else {
      evidence.doctorModal = { capturedAt: now(), visible: false, reason: "Cabinet was not available after live checks." };
    }

    await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.locator(".mg-presets").waitFor({ state: "visible", timeout: timeoutMs });
    const afterReload = await ui(page);
    evidence.persistence = {
      beforeReloadCabinet: beforeReload.cabinet,
      afterReloadCabinet: afterReload.cabinet,
      survivesReload: beforeReload.cabinet.length > 0 && afterReload.cabinet.length === beforeReload.cabinet.length,
      note: "This is an observed browser reload result, not a claim about intended persistence.",
    };
    evidence.ui.afterReload = afterReload;
    evidence.screenshots.afterReload = await screenshot(page, "desktop-after-reload.png");
  } catch (error) {
    evidence.failures.push({ phase: "runner", message: String(error) });
    throw error;
  } finally {
    evidence.finishedAt = now();
    await write("api-call-response.json", {
      generatedAt: evidence.finishedAt,
      syntheticProfileOnly: true,
      profile: evidence.profile,
      requests: evidence.requests,
      failures: evidence.failures,
    });
    await write("browser-evidence.json", evidence);
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

run().catch((error) => {
  console.error(`[baseline] ${error.message}`);
  process.exitCode = 1;
});
