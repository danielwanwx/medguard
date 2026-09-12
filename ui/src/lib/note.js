const text = (value) => typeof value === "string" && value.trim() ? value.trim() : "Unknown";

const sourceLines = (item) => {
  const entries = [];
  const add = (label, url) => {
    if (url && /^https?:\/\//i.test(url)) entries.push(`${label}: ${url}`);
  };
  add(item.identity.source || "Catalog identity", item.identity.source_url);
  item.result.recall?.source_urls?.forEach((url) => add(item.result.recall?.source || "Recall source", url));
  item.result.recall?.records?.forEach((record) => add(`Recall record ${record.recall_number || ""}`.trim(), record.source_url));
  item.result.interactions?.forEach((finding) => add(finding.source || "Interaction reference", finding.source_url));
  item.result.dosage?.forEach((reference) => add(reference.source || "Dosage reference", reference.source_url));
  return [...new Set(entries)];
};

const warningLines = (item) => {
  const entries = [];
  item.result.interactions?.forEach((finding) => entries.push(`${text(finding.risk)}: ${finding.note}`));
  if (item.result.recall?.status === "potential_matches") {
    entries.push("Potential recall matches were returned. Compare the bottle’s product name, manufacturer, and lot/code with each record before acting.");
  }
  if (item.stale) entries.push("This review was run against an earlier profile. Recheck it with the current profile.");
  return entries.length ? entries : ["No review prompt was returned by the bounded sources. This does not establish safety or coverage."];
};

export function buildReviewNote({ profile, cabinet, generatedAt = new Date().toISOString() }) {
  const lines = [
    "MEDGUARD — PHARMACIST / CLINICIAN REVIEW NOTE",
    `Prepared: ${new Date(generatedAt).toLocaleString()}`,
    "",
    "This is a user-reviewed cabinet summary, not a complete medical history or medical advice.",
    "Please confirm medicines, conditions, supplement labels, dose, frequency, and lot numbers directly with the patient.",
    "",
    profile.mode === "sample" ? "CURRENT PROFILE — SYNTHETIC SAMPLE DATA" : "CURRENT PROFILE",
    `Medicines: ${profile.meds.length ? profile.meds.join(", ") : "None listed"}`,
    `Conditions: ${profile.conditions.length ? profile.conditions.join(", ") : "None listed"}`,
    "",
    `CATALOG PRODUCTS (${cabinet.length})`,
  ];

  if (!cabinet.length) lines.push("No confirmed products in the cabinet.");
  cabinet.forEach((item, index) => {
    lines.push("", `${index + 1}. ${text(item.identity.name)}${item.identity.brand ? ` — ${item.identity.brand}` : ""}`);
    lines.push(`Catalog ID: ${item.id}`);
    lines.push(`Original label search: ${text(item.scan)}`);
    lines.push(`Confirmed label identity: ${item.identity.confirmation || "user label selection"}`);
    lines.push(`Last review: ${new Date(item.checkedAt).toLocaleString()}`);
    lines.push(`Review status: ${text(item.result.status)}${item.stale ? " (stale after profile change)" : ""}`);
    lines.push(`Ingredients listed by catalog: ${item.identity.ingredients?.length ? item.identity.ingredients.join(", ") : "Unknown"}`);
    if (item.identity.ingredient_coverage) lines.push(`Ingredient coverage: ${item.identity.ingredient_coverage}`);
    lines.push("Dose: Unknown. Frequency: Unknown. Lot / package code: Unknown.");
    if (item.stale) {
      lines.push(`Profile used for this stale review — Medicines: ${item.profileSnapshot.meds.length ? item.profileSnapshot.meds.join(", ") : "None listed"}; Conditions: ${item.profileSnapshot.conditions.length ? item.profileSnapshot.conditions.join(", ") : "None listed"}.`);
      if (item.profileSnapshot.mode === "sample") lines.push("The profile used for this stale review was SYNTHETIC SAMPLE DATA.");
    }
    lines.push("Things to review:");
    warningLines(item).forEach((warning) => lines.push(`- ${warning}`));
    const sources = sourceLines(item);
    lines.push("Direct sources:");
    (sources.length ? sources : ["No direct source URL was returned."]).forEach((source) => lines.push(`- ${source}`));
  });

  lines.push(
    "",
    "SCOPE AND LIMITS",
    "MedGuard submits the entered profile to its review service (Strands on Amazon Bedrock) and sends the product query to cited source APIs. It surfaces bounded source results and reference flags; it does not diagnose, prescribe, verify a bottle’s lot, or guarantee safety. Ask a pharmacist or clinician to interpret this note.",
  );
  return lines.join("\n");
}

export function downloadReviewNote(note, filename = "medguard-review-note.txt") {
  const blob = new Blob([note], { type: "text/plain;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

const escapeHtml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

export function printReviewNote(note) {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  popup.opener = null;
  popup.document.write(`<!doctype html><title>MedGuard review note</title><style>body{margin:36px;max-width:760px;color:#18352b;font:15px/1.5 system-ui,sans-serif;white-space:pre-wrap}@media print{body{margin:20px}}</style><body>${escapeHtml(note)}</body>`);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}
