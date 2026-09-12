export const STORAGE_KEY = "medguard.cabinet.v1";
export const STORAGE_VERSION = 1;

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const safeText = (value, maxLength = 240) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const safeDate = (value) => {
  const text = safeText(value, 64);
  return text && !Number.isNaN(Date.parse(text)) ? text : null;
};

const safeUrl = (value) => {
  const text = safeText(value, 1_800);
  return /^https?:\/\//i.test(text) ? text : "";
};

const MAX_DEPTH = 5;
const MAX_ARRAY = 30;
const MAX_OBJECT_ENTRIES = 30;

const sanitizeValue = (value, depth = 0) => {
  if (typeof value === "string") return safeText(value, 2_000);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null) return null;
  if (depth >= MAX_DEPTH) return "[additional details omitted]";
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((item) => sanitizeValue(item, depth + 1));
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_OBJECT_ENTRIES)
        .flatMap(([key, item]) => {
          const cleanedKey = safeText(key, 100);
          return cleanedKey ? [[cleanedKey, sanitizeValue(item, depth + 1)]] : [];
        }),
    );
  }
  return "";
};

export const emptyProfile = () => ({
  meds: [],
  conditions: [],
  mode: "personal",
  updatedAt: null,
});

export const normalizeList = (value, limit = 30, maxLength = 100) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const items = [];
  for (const entry of value) {
    const text = safeText(entry, maxLength);
    const key = text.toLocaleLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      items.push(text);
    }
    if (items.length >= limit) break;
  }
  return items;
};

export const normalizeProfile = (value) => ({
  meds: normalizeList(value?.meds, 30, 100),
  conditions: normalizeList(value?.conditions, 30, 100),
  mode: value?.mode === "sample" ? "sample" : "personal",
  updatedAt: safeDate(value?.updatedAt),
});

export const profileSignature = (profile) =>
  JSON.stringify({
    meds: normalizeList(profile?.meds).map((item) => item.toLocaleLowerCase()).sort(),
    conditions: normalizeList(profile?.conditions).map((item) => item.toLocaleLowerCase()).sort(),
    mode: profile?.mode === "sample" ? "sample" : "personal",
  });

const collectUrls = (value, urls = [], depth = 0) => {
  if (depth >= MAX_DEPTH || value === null || value === undefined) return urls;
  if (typeof value === "string") {
    const url = safeUrl(value);
    if (url && !urls.includes(url)) urls.push(url);
    return urls;
  }
  if (Array.isArray(value)) {
    value.slice(0, MAX_ARRAY).forEach((entry) => collectUrls(entry, urls, depth + 1));
    return urls;
  }
  if (isObject(value)) {
    Object.entries(value).forEach(([key, entry]) => {
      if (/url/i.test(key) || isObject(entry) || Array.isArray(entry)) collectUrls(entry, urls, depth + 1);
    });
  }
  return urls;
};

const normalizeToolTrace = (value) => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((entry) => {
    if (!isObject(entry)) return [];
    const tool = safeText(entry.tool, 120);
    if (!tool) return [];
    const result = sanitizeValue(entry.result);
    return [{
      tool,
      result,
      status: ["success", "error", "blocked"].includes(entry.status) ? entry.status : "blocked",
      source: safeText(entry.source, 180) || safeText(result?.source, 180),
      source_urls: collectUrls({
        source_url: entry.source_url,
        source_urls: entry.source_urls,
        api_url: entry.api_url,
        result,
      }),
    }];
  });
};

const normalizeInteractions = (value) => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((entry) => {
    if (!isObject(entry)) return [];
    const note = safeText(entry.note, 1_500);
    if (!note) return [];
    return [{
      risk: safeText(entry.risk, 48) || "Review",
      review_priority: safeText(entry.review_priority, 48),
      severity_note: safeText(entry.severity_note, 500),
      note,
      against: safeText(entry.against, 180),
      source: safeText(entry.source, 180),
      source_url: safeUrl(entry.source_url || entry.api_url),
    }];
  });
};

const normalizeDosage = (value) => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((entry) => {
    if (!isObject(entry)) return [];
    const ingredient = safeText(entry.ingredient, 180);
    const adultReferenceLimit = safeText(entry.adult_reference_limit || entry.upper_limit, 900);
    if (!ingredient && !adultReferenceLimit) return [];
    return [{
      ingredient: ingredient || "Reference",
      adult_reference_limit: adultReferenceLimit || "Not provided",
      scope: safeText(entry.scope, 1_200),
      source: safeText(entry.source, 180),
      source_url: safeUrl(entry.source_url || entry.api_url),
    }];
  });
};

const normalizeDates = (value) => {
  if (typeof value === "string") return safeText(value, 600);
  if (!isObject(value)) return "";
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 10)
      .flatMap(([key, date]) => {
        const cleanKey = safeText(key, 80);
        const cleanDate = safeText(date, 100);
        return cleanKey && cleanDate ? [[cleanKey, cleanDate]] : [];
      }),
  );
};

const normalizeRecall = (value) => {
  if (!isObject(value)) return null;
  const status = safeText(value.status, 80);
  const records = Array.isArray(value.records)
    ? value.records.slice(0, 12).flatMap((entry) => {
      if (!isObject(entry)) return [];
      const description = safeText(entry.product_description, 1_000);
      if (!description) return [];
      return [{
        feed: safeText(entry.feed, 80),
        product_description: description,
        recalling_firm: safeText(entry.recalling_firm, 400),
        recall_number: safeText(entry.recall_number, 160),
        code_info: safeText(entry.code_info, 1_200),
        reason_for_recall: safeText(entry.reason_for_recall, 1_200),
        status: safeText(entry.status, 100),
        classification: safeText(entry.classification, 100),
        dates: normalizeDates(entry.dates),
        source_url: safeUrl(entry.source_url || entry.api_url),
        retrieved_at: safeDate(entry.retrieved_at),
      }];
    })
    : [];
  if (!status && records.length === 0) return null;
  return {
    status: ["potential_matches", "no_match", "unavailable"].includes(status) ? status : "unavailable",
    records,
    source: safeText(value.source, 180),
    source_urls: collectUrls({
      source_url: value.source_url,
      source_urls: value.source_urls,
      api_url: value.api_url,
      metadata: value.metadata,
    }),
    query_phrase: safeText(value.query_phrase, 180),
    retrieved_at: safeDate(value.retrieved_at),
    coverage: safeText(value.coverage || value.scope, 1_500),
    metadata: sanitizeValue(value.metadata),
    source_errors: sanitizeValue(value.source_errors),
  };
};

const normalizeIdentity = (value) => {
  if (!isObject(value) || value.confirmed !== true) return null;
  const id = safeText(value.id, 240);
  if (!id) return null;
  return {
    id,
    name: safeText(value.name, 300),
    brand: safeText(value.brand, 300),
    ingredients: normalizeList(value.ingredients, 60, 180),
    ingredient_status: ["available", "explicitly_empty", "unavailable"].includes(value.ingredient_status)
      ? value.ingredient_status
      : "available",
    ingredient_coverage: safeText(value.ingredient_coverage, 1_500),
    source: safeText(value.source, 180),
    source_url: safeUrl(value.source_url || value.api_url),
    confirmed: true,
    confirmation: safeText(value.confirmation, 160),
    clinical_verification: safeText(value.clinical_verification, 160),
  };
};

const normalizeCandidates = (value) => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((entry) => {
    if (!isObject(entry)) return [];
    const id = safeText(entry.id, 240);
    const name = safeText(entry.name, 300);
    if (!id || !name) return [];
    return [{
      id,
      name,
      brand: safeText(entry.brand, 300),
      ingredients: normalizeList(entry.ingredients, 40, 180),
      ingredient_status: ["available", "explicitly_empty", "unavailable"].includes(entry.ingredient_status)
        ? entry.ingredient_status
        : "available",
      ingredient_coverage: safeText(entry.ingredient_coverage, 1_500),
      source: safeText(entry.source, 180),
      source_url: safeUrl(entry.source_url || entry.api_url),
    }];
  });
};

export const normalizeResult = (value) => {
  if (!isObject(value)) return null;
  return {
    answer: safeText(value.answer, 4_000),
    tools: Number.isInteger(value.tools) && value.tools >= 0 && value.tools <= 20 ? value.tools : 0,
    tool_trace: normalizeToolTrace(value.tool_trace),
    identity: normalizeIdentity(value.identity),
    recall: normalizeRecall(value.recall),
    interactions: normalizeInteractions(value.interactions),
    interaction_coverage: safeText(value.interaction_coverage, 1_500),
    dosage: normalizeDosage(value.dosage),
    dosage_coverage: safeText(value.dosage_coverage, 1_500),
    provenance: sanitizeValue(value.provenance),
    status: ["needs_confirmation", "complete", "incomplete", "unidentified"].includes(value.status)
      ? value.status
      : "incomplete",
    candidates: normalizeCandidates(value.candidates),
    checked_at: safeDate(value.checked_at),
  };
};

const normalizeCabinetItem = (value) => {
  if (!isObject(value)) return null;
  const result = normalizeResult(value.result);
  const identity = normalizeIdentity(value.identity) || result?.identity;
  const id = safeText(value.id, 240);
  const checkedAt = safeDate(value.checkedAt);
  const scan = safeText(value.scan, 160);
  if (!id || !identity || identity.id !== id || !result || !checkedAt || !scan) return null;
  return {
    id,
    scan,
    identity,
    result,
    checkedAt,
    addedAt: safeDate(value.addedAt) || checkedAt,
    profileSnapshot: normalizeProfile(value.profileSnapshot),
    stale: value.stale === true,
  };
};

export const freshPersistedData = () => ({
  version: STORAGE_VERSION,
  onboarded: false,
  profile: emptyProfile(),
  cabinet: [],
});

export const normalizePersistedData = (value) => {
  if (!isObject(value) || value.version !== STORAGE_VERSION) return null;
  const cabinet = Array.isArray(value.cabinet)
    ? value.cabinet.slice(0, 60).flatMap((item) => {
      const normalized = normalizeCabinetItem(item);
      return normalized ? [normalized] : [];
    })
    : [];
  return {
    version: STORAGE_VERSION,
    onboarded: value.onboarded === true,
    profile: normalizeProfile(value.profile),
    cabinet,
  };
};

export const loadPersistedState = (providedStorage) => {
  const fallback = freshPersistedData();
  try {
    const storage = providedStorage === undefined ? globalThis.localStorage : providedStorage;
    if (!storage) return { storage: "unavailable", data: fallback };
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { storage: "available", data: fallback };
    let decoded;
    try {
      decoded = JSON.parse(raw);
    } catch {
      try { storage.removeItem(STORAGE_KEY); } catch { /* cleanup best effort */ }
      return { storage: "corrupt", data: fallback };
    }
    const data = normalizePersistedData(decoded);
    if (data) return { storage: "available", data };
    try { storage.removeItem(STORAGE_KEY); } catch { /* cleanup best effort */ }
    return { storage: "corrupt", data: fallback };
  } catch {
    return { storage: "unavailable", data: fallback };
  }
};

export const savePersistedState = (data, providedStorage) => {
  try {
    const storage = providedStorage === undefined ? globalThis.localStorage : providedStorage;
    if (!storage) return false;
    const normalized = normalizePersistedData(data);
    if (!normalized) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
};

export const clearPersistedState = (providedStorage) => {
  try {
    const storage = providedStorage === undefined ? globalThis.localStorage : providedStorage;
    if (!storage) return false;
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
};
