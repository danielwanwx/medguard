import {
  freshPersistedData,
  normalizeProfile,
  normalizeResult,
  profileSignature,
} from "./storage.js";

const timestamp = () => new Date().toISOString();
const REQUIRED_TOOL_NAMES = [
  "identify_supplement",
  "check_recall",
  "check_interactions",
  "check_dosage",
];

export const createInitialState = (loaded) => {
  const data = loaded?.data || freshPersistedData();
  return {
    tab: data.onboarded ? "check" : "welcome",
    onboarded: data.onboarded,
    profile: normalizeProfile(data.profile),
    cabinet: data.cabinet || [],
    storage: loaded?.storage || "unavailable",
    query: "",
    busy: false,
    request: null,
    candidates: null,
    result: null,
    activeCabinetId: null,
    error: null,
  };
};

const markStale = (cabinet, profile) => {
  const signature = profileSignature(profile);
  return cabinet.map((item) => ({
    ...item,
    stale: item.stale || profileSignature(item.profileSnapshot) !== signature,
  }));
};

const isCurrentRequest = (state, action) =>
  Boolean(state.request) && state.request.generation === action.generation;

export function appReducer(state, action) {
  switch (action.type) {
    case "NAVIGATE":
      return { ...state, tab: action.tab, error: null };
    case "QUERY_CHANGED":
      return { ...state, query: action.query, error: null };
    case "REVIEW_RESET":
      return {
        ...state,
        busy: false,
        request: null,
        candidates: null,
        result: null,
        activeCabinetId: null,
        error: null,
      };
    case "PROFILE_SAVED": {
      const profile = { ...normalizeProfile(action.profile), updatedAt: action.updatedAt || timestamp() };
      return {
        ...state,
        profile,
        cabinet: markStale(state.cabinet, profile),
        onboarded: true,
        tab: action.tab || "check",
        busy: false,
        request: null,
        candidates: null,
        result: null,
        activeCabinetId: null,
        error: null,
      };
    }
    case "REQUEST_STARTED":
      return {
        ...state,
        busy: true,
        error: null,
        result: null,
        candidates: null,
        request: {
          scan: action.scan,
          selectedId: action.selectedId || null,
          profileSnapshot: normalizeProfile(action.profileSnapshot),
          generation: action.generation,
        },
        activeCabinetId: null,
      };
    case "CANDIDATES_RECEIVED":
      if (!isCurrentRequest(state, action)) return state;
      return { ...state, busy: false, candidates: action.result, result: null, error: null };
    case "RESULT_RECEIVED":
      if (!isCurrentRequest(state, action)) return state;
      return { ...state, busy: false, candidates: null, result: action.result, error: null };
    case "REQUEST_ERROR":
      if (!isCurrentRequest(state, action)) return state;
      return { ...state, busy: false, error: action.error, result: null, candidates: null };
    case "CABINET_ADDED": {
      const item = action.item;
      return {
        ...state,
        cabinet: [item, ...state.cabinet.filter((existing) => existing.id !== item.id)],
        activeCabinetId: item.id,
      };
    }
    case "CABINET_REMOVED":
      return {
        ...state,
        cabinet: state.cabinet.filter((item) => item.id !== action.id),
        activeCabinetId: state.activeCabinetId === action.id ? null : state.activeCabinetId,
      };
    case "OPEN_CABINET_ITEM":
      return {
        ...state,
        tab: "check",
        busy: false,
        candidates: null,
        error: null,
        result: action.item.result,
        query: action.item.scan || action.item.identity.name || state.query,
        request: {
          scan: action.item.scan || action.item.identity.name || "",
          selectedId: action.item.id,
          profileSnapshot: action.item.profileSnapshot,
          generation: null,
        },
        activeCabinetId: action.item.id,
      };
    case "STORAGE_AVAILABLE":
      return { ...state, storage: "available" };
    case "STORAGE_UNAVAILABLE":
      return { ...state, storage: "unavailable" };
    case "LOCAL_DATA_RESET":
      return {
        ...createInitialState({ storage: action.storage || state.storage, data: freshPersistedData() }),
        storage: action.storage || state.storage,
      };
    default:
      return state;
  }
}

export const resultCanBeSaved = (result) => {
  if (
    result?.status !== "complete"
    || result.identity?.confirmed !== true
    || !result.identity?.id
    || !result.checked_at
    || !Array.isArray(result.tool_trace)
    || result.tool_trace.length !== REQUIRED_TOOL_NAMES.length
  ) return false;
  return REQUIRED_TOOL_NAMES.every((name) => {
    const entries = result.tool_trace.filter((entry) => entry.tool === name);
    return entries.length === 1 && entries[0].status === "success";
  });
};

export const makeCabinetItem = (result, profileSnapshot, scan, now = timestamp()) => {
  const normalized = normalizeResult(result);
  const originalScan = typeof scan === "string" ? scan.trim().slice(0, 160) : "";
  if (!resultCanBeSaved(normalized) || !originalScan) return null;
  return {
    id: normalized.identity.id,
    scan: originalScan,
    identity: normalized.identity,
    result: normalized,
    checkedAt: normalized.checked_at,
    addedAt: now,
    profileSnapshot: normalizeProfile(profileSnapshot),
    stale: false,
  };
};
