import assert from "node:assert/strict";
import test from "node:test";
import {
  STORAGE_KEY,
  loadPersistedState,
  normalizeResult,
  savePersistedState,
} from "../src/lib/storage.js";
import {
  appReducer,
  createInitialState,
  makeCabinetItem,
  resultCanBeSaved,
} from "../src/lib/state.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

function completeResult(overrides = {}) {
  return {
    status: "complete",
    checked_at: "2026-09-12T12:01:00Z",
    answer: "Evidence returned.",
    tools: 4,
    tool_trace: [
      { tool: "identify_supplement", status: "success", result: { identity: {} } },
      { tool: "check_recall", status: "success", result: { status: "no_match" } },
      { tool: "check_interactions", status: "success", result: { findings: [] } },
      { tool: "check_dosage", status: "success", result: { limits: [] } },
    ],
    identity: {
      id: "dsld-123",
      name: "Example Fish Oil",
      brand: "Example",
      ingredients: ["Fish oil"],
      source: "NIH DSLD",
      source_url: "https://example.test/catalog",
      confirmed: true,
      confirmation: "user_label_selection",
    },
    recall: { status: "no_match", records: [] },
    interactions: [],
    dosage: [],
    ...overrides,
  };
}

test("corrupt local data is cleared and starts from an empty state", () => {
  const storage = memoryStorage({ [STORAGE_KEY]: "{bad json" });
  const loaded = loadPersistedState(storage);

  assert.equal(loaded.storage, "corrupt");
  assert.equal(loaded.data.onboarded, false);
  assert.deepEqual(loaded.data.cabinet, []);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("persisted state keeps only confirmed cabinet entries", () => {
  const storage = memoryStorage();
  const result = normalizeResult(completeResult());
  const item = makeCabinetItem(result, { meds: ["warfarin"], conditions: [] }, "Fish Oil", "2026-09-12T12:02:00Z");
  const stored = {
    version: 1,
    onboarded: true,
    profile: { meds: ["warfarin"], conditions: [] },
    cabinet: [item, { id: "unconfirmed" }],
  };

  assert.equal(savePersistedState(stored, storage), true);
  const loaded = loadPersistedState(storage);
  assert.equal(loaded.data.cabinet.length, 1);
  assert.equal(loaded.data.cabinet[0].id, "dsld-123");
  assert.equal(loaded.data.cabinet[0].scan, "Fish Oil");
  assert.equal(loaded.data.cabinet[0].profileSnapshot.meds[0], "warfarin");
});

test("editing a profile marks existing cabinet evidence stale", () => {
  const result = normalizeResult(completeResult());
  const item = makeCabinetItem(result, { meds: ["warfarin"], conditions: [] }, "Fish Oil", "2026-09-12T12:02:00Z");
  let state = createInitialState({
    storage: "available",
    data: { version: 1, onboarded: true, profile: { meds: ["warfarin"], conditions: [] }, cabinet: [item] },
  });

  state = appReducer(state, {
    type: "PROFILE_SAVED",
    profile: { meds: ["warfarin", "metformin"], conditions: [] },
    updatedAt: "2026-09-12T13:00:00Z",
  });

  assert.equal(state.cabinet[0].stale, true);
  assert.equal(state.profile.meds.includes("metformin"), true);
});

test("only a confirmed, complete response can create a cabinet entry", () => {
  const complete = normalizeResult(completeResult());
  const incomplete = normalizeResult(completeResult({
    status: "incomplete",
    tool_trace: [{ tool: "identify_supplement", status: "success", result: {} }],
  }));
  const malformedTrace = normalizeResult(completeResult({
    tool_trace: [{ tool: "identify_supplement", status: "error", result: "source failed" }],
  }));

  assert.equal(resultCanBeSaved(complete), true);
  assert.ok(makeCabinetItem(complete, { meds: [], conditions: [] }, "Fish Oil"));
  assert.equal(resultCanBeSaved(incomplete), false);
  assert.equal(makeCabinetItem(incomplete, { meds: [], conditions: [] }, "Fish Oil"), null);
  assert.equal(resultCanBeSaved(malformedTrace), false);
  assert.equal(makeCabinetItem(malformedTrace, { meds: [], conditions: [] }, "Fish Oil"), null);
});

test("request errors retain the selected request but do not create a result", () => {
  let state = createInitialState({ storage: "available", data: { version: 1, onboarded: true, profile: {}, cabinet: [] } });
  state = appReducer(state, {
    type: "REQUEST_STARTED",
    scan: "Fish Oil",
    selectedId: "dsld-123",
    profileSnapshot: {},
    generation: 7,
  });
  state = appReducer(state, { type: "REQUEST_ERROR", error: "Service unavailable", generation: 7 });

  assert.equal(state.request.scan, "Fish Oil");
  assert.equal(state.request.selectedId, "dsld-123");
  assert.equal(state.request.generation, 7);
  assert.equal(state.result, null);
  assert.deepEqual(state.cabinet, []);
});

test("normalizing a response repeatedly retains full trace and evidence fields", () => {
  const raw = completeResult({
    interaction_coverage: "No matching rule is not a safety finding.",
    dosage_coverage: "Actual intake is unknown.",
    recall: {
      status: "potential_matches",
      source_urls: ["https://example.test/food", "https://example.test/drug"],
      coverage: "Compare product and lot.",
      records: [{
        product_description: "Example fish oil",
        recall_number: "F-123",
        dates: { recall_initiation_date: "2026-09-01", termination_date: "" },
        api_url: "https://example.test/food",
      }],
    },
    dosage: [{
      ingredient: "Vitamin D",
      adult_reference_limit: "100 mcg per day",
      scope: "Adult upper intake level.",
      source_url: "https://example.test/vitamin-d",
    }],
    tool_trace: [{
      tool: "check_recall",
      status: "success",
      result: { source_urls: ["https://example.test/food"], metadata: { matched_records: 1 } },
    }],
  });
  const once = normalizeResult(raw);
  const twice = normalizeResult(once);

  assert.deepEqual(twice.tool_trace, once.tool_trace);
  assert.equal(twice.dosage[0].adult_reference_limit, "100 mcg per day");
  assert.deepEqual(twice.recall.records[0].dates, { recall_initiation_date: "2026-09-01" });
  assert.equal(twice.interaction_coverage, "No matching rule is not a safety finding.");
  assert.deepEqual(twice.recall.source_urls, ["https://example.test/food", "https://example.test/drug"]);
});

test("profile save invalidates an in-flight response and an old generation cannot restore it", () => {
  let state = createInitialState({ storage: "available", data: { version: 1, onboarded: true, profile: { meds: ["warfarin"] }, cabinet: [] } });
  state = appReducer(state, {
    type: "REQUEST_STARTED",
    scan: "Fish Oil",
    selectedId: "dsld-123",
    profileSnapshot: { meds: ["warfarin"], conditions: [] },
    generation: 4,
  });
  state = appReducer(state, { type: "RESULT_RECEIVED", result: normalizeResult(completeResult()), generation: 4 });
  assert.ok(state.result);
  state = appReducer(state, {
    type: "PROFILE_SAVED",
    profile: { meds: ["metformin"], conditions: [] },
    updatedAt: "2026-09-12T13:00:00Z",
  });
  state = appReducer(state, { type: "RESULT_RECEIVED", result: normalizeResult(completeResult()), generation: 4 });

  assert.equal(state.busy, false);
  assert.equal(state.request, null);
  assert.equal(state.result, null);
  assert.equal(state.candidates, null);
  assert.deepEqual(state.profile.meds, ["metformin"]);
});

test("a repeated or missing required tool cannot be saved to the cabinet", () => {
  const duplicate = normalizeResult(completeResult({
    tool_trace: [
      { tool: "identify_supplement", status: "success", result: {} },
      { tool: "check_recall", status: "success", result: {} },
      { tool: "check_recall", status: "success", result: {} },
      { tool: "check_dosage", status: "success", result: {} },
    ],
  }));

  assert.equal(resultCanBeSaved(duplicate), false);
  assert.equal(makeCabinetItem(duplicate, {}, "Fish Oil"), null);
});

test("reset ignores any late response from the erased local session", () => {
  let state = createInitialState({ storage: "available", data: { version: 1, onboarded: true, profile: {}, cabinet: [] } });
  state = appReducer(state, {
    type: "REQUEST_STARTED",
    scan: "Fish Oil",
    selectedId: "dsld-123",
    profileSnapshot: {},
    generation: 9,
  });
  state = appReducer(state, { type: "LOCAL_DATA_RESET", storage: "available" });
  state = appReducer(state, { type: "RESULT_RECEIVED", result: normalizeResult(completeResult()), generation: 9 });

  assert.equal(state.onboarded, false);
  assert.equal(state.result, null);
  assert.equal(state.request, null);
  assert.deepEqual(state.cabinet, []);
});
