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

const esc = (value) => String(value == null ? "" : value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const riskTone = (risk) => {
  const r = String(risk || "").toLowerCase();
  if (r.includes("high")) return "high";
  if (r.includes("moderate") || r.includes("review") || r.includes("caution")) return "review";
  return "note";
};

// Structured, print-ready clinical handout used for both the on-screen preview and Print.
export function buildReviewNoteHtml({ profile, cabinet, generatedAt = new Date().toISOString() }) {
  const sampleBadge = profile.mode === "sample"
    ? `<span class="nb-chip nb-chip--sample">Synthetic sample data</span>` : "";
  const profileBlock = `
    <section class="nb-section">
      <h2>Current profile ${sampleBadge}</h2>
      <dl class="nb-grid">
        <div><dt>Medicines</dt><dd>${profile.meds.length ? profile.meds.map(esc).join(", ") : "None listed"}</dd></div>
        <div><dt>Conditions</dt><dd>${profile.conditions.length ? profile.conditions.map(esc).join(", ") : "None listed"}</dd></div>
      </dl>
    </section>`;

  const items = cabinet.map((item, i) => {
    const reviews = warningLines(item).map((w) => {
      const [maybeRisk, ...rest] = String(w).split(":");
      const hasRisk = rest.length && ["high", "moderate", "review"].some((k) => maybeRisk.toLowerCase().includes(k));
      return hasRisk
        ? `<li><span class="nb-tag nb-tag--${riskTone(maybeRisk)}">${esc(maybeRisk.trim())}</span> ${esc(rest.join(":").trim())}</li>`
        : `<li>${esc(w)}</li>`;
    }).join("");
    const sources = sourceLines(item);
    const sourceItems = (sources.length ? sources : ["No direct source URL was returned."]).map((s) => {
      const m = String(s).match(/^(.*?):\s*(https?:\/\/\S+)$/);
      return m ? `<li>${esc(m[1])}: <a href="${esc(m[2])}" target="_blank" rel="noreferrer">${esc(m[2])}</a></li>` : `<li>${esc(s)}</li>`;
    }).join("");
    return `
      <article class="nb-item">
        <div class="nb-item__head">
          <h3>${i + 1}. ${esc(text(item.identity.name))}${item.identity.brand ? ` <span class="nb-brand">— ${esc(item.identity.brand)}</span>` : ""}</h3>
          <span class="nb-status">${esc(text(item.result.status))}${item.stale ? " · stale" : ""}</span>
        </div>
        <p class="nb-meta">Catalog ID ${esc(item.id)} · Confirmed: ${esc(item.identity.confirmation || "user label selection")} · Last review ${esc(new Date(item.checkedAt).toLocaleString())}</p>
        <p class="nb-meta">Ingredients (catalog): ${item.identity.ingredients?.length ? esc(item.identity.ingredients.join(", ")) : "Unknown"}</p>
        <p class="nb-meta nb-unknown">Dose: Unknown · Frequency: Unknown · Lot / package code: Unknown</p>
        <h4>Things to review</h4>
        <ul class="nb-reviews">${reviews}</ul>
        <h4>Direct sources</h4>
        <ul class="nb-sources">${sourceItems}</ul>
      </article>`;
  }).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>MedGuard review note</title><style>
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;color:#18352b;font:15px/1.55 -apple-system,Segoe UI,Roboto,system-ui,sans-serif;background:#f6f8f4}
.nb-doc{max-width:760px;margin:0 auto;padding:28px}
.nb-head{display:flex;align-items:center;gap:12px;border-bottom:2px solid #214c3d;padding-bottom:14px}
.nb-mark{width:40px;height:40px;flex:0 0 auto;display:grid;place-items:center;background:#214c3d;color:#fff;border-radius:12px 12px 12px 4px;font-weight:800}
.nb-head h1{margin:0;font-size:19px;letter-spacing:-.01em}
.nb-head p{margin:2px 0 0;font-size:12.5px;color:#5b7068}
.nb-disclaimer{margin:16px 0;padding:11px 14px;background:#eef2e7;border-radius:10px;font-size:13px;color:#41564c}
.nb-section{margin:18px 0}
.nb-section>h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#5b7068;margin:0 0 8px}
.nb-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0}
.nb-grid dt{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#74867d}
.nb-grid dd{margin:2px 0 0;font-weight:600}
.nb-chip{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;vertical-align:middle}
.nb-chip--sample{background:#dce8b0;color:#41562a}
.nb-item{margin:14px 0;padding:15px 16px;background:#fff;border:1px solid #d9dfd4;border-radius:14px}
.nb-item__head{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.nb-item h3{margin:0;font-size:16px}
.nb-brand{color:#74867d;font-weight:500}
.nb-status{font-size:11px;font-weight:700;color:#356b4f;background:#e2eee6;padding:2px 9px;border-radius:999px;white-space:nowrap}
.nb-meta{margin:6px 0 0;font-size:12.5px;color:#5b7068}
.nb-unknown{color:#8a503e}
.nb-item h4{margin:13px 0 5px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#74867d}
.nb-item ul{margin:0;padding-left:2px;list-style:none}
.nb-item li{margin:5px 0;font-size:13.5px;line-height:1.5}
.nb-tag{display:inline-block;margin-right:6px;padding:1px 8px;border-radius:999px;font-size:10.5px;font-weight:800;text-transform:uppercase}
.nb-tag--high{background:#fae4dd;color:#9d4235}
.nb-tag--review{background:#fff0e6;color:#915536}
.nb-tag--note{background:#edf0e9;color:#5b7068}
.nb-sources a{color:#214c3d;word-break:break-all}
.nb-foot{margin:20px 0 0;padding-top:14px;border-top:1px solid #d9dfd4;font-size:12px;color:#74867d}
@media print{body{background:#fff}.nb-doc{padding:0}.nb-item{break-inside:avoid}}
</style></head><body><div class="nb-doc">
<div class="nb-head"><div class="nb-mark">✚</div><div><h1>MedGuard — Pharmacist / Clinician Review Note</h1><p>Prepared ${esc(new Date(generatedAt).toLocaleString())}</p></div></div>
<p class="nb-disclaimer">A user-reviewed cabinet summary — not a complete medical history or medical advice. Confirm medicines, conditions, labels, dose, frequency and lot numbers with the patient.</p>
${profileBlock}
<section class="nb-section"><h2>Catalog products (${cabinet.length})</h2>${cabinet.length ? items : "<p>No confirmed products in the cabinet.</p>"}</section>
<p class="nb-foot">MedGuard submits the entered profile to its review service (Strands on Amazon Bedrock) and sends the product query to cited source APIs. It surfaces bounded source results and reference flags; it does not diagnose, prescribe, verify a bottle’s lot, or guarantee safety.</p>
</div></body></html>`;
}

export function printReviewNoteHtml(html) {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  popup.opener = null;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
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
