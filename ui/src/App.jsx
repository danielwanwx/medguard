import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  HeartPulse,
  Info,
  MessageCircle,
  Package,
  Send,
  Sparkles,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { BottleArtwork, CabinetArtwork } from "./components/Artwork.jsx";
import { Badge, Button, Field, IconButton, SourceLink } from "./components/Primitives.jsx";
import { askAgent, requestMedcheck, scanLabel } from "./lib/api.js";
import { buildReviewNote, buildReviewNoteHtml, downloadReviewNote, printReviewNoteHtml } from "./lib/note.js";
import {
  clearPersistedState,
  loadPersistedState,
  normalizeProfile,
  normalizeResult,
  savePersistedState,
} from "./lib/storage.js";
import { appReducer, createInitialState, makeCabinetItem, resultCanBeSaved } from "./lib/state.js";

const SAMPLE_PROFILE = { meds: ["warfarin"], conditions: ["hypertension"], mode: "sample" };
const PRODUCT_EXAMPLES = [
  "Moringa", "Fish oil", "Vitamin D", "Magnesium", "Melatonin", "Turmeric",
  "Ginkgo", "Zinc", "Calcium", "Probiotic", "Iron", "Vitamin B12",
  "Omega-3", "Ashwagandha", "St. John's Wort", "Multivitamin",
];

const TOOL_META = {
  identify_supplement: { label: "Label catalog", source: "NIH DSLD", type: "live" },
  check_recall: { label: "Recall records", source: "openFDA", type: "live" },
  check_interactions: { label: "Interaction references", source: "Curated references", type: "curated" },
  check_dosage: { label: "Adult dosage references", source: "NIH ODS reference", type: "curated" },
};

const formatDate = (value, withTime = false) => {
  if (!value || Number.isNaN(Date.parse(value))) return "Date not returned";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(new Date(value));
};

const singular = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
const formatRecordDates = (dates) => {
  if (typeof dates === "string") return dates;
  if (!dates || typeof dates !== "object") return "";
  return Object.entries(dates)
    .map(([label, value]) => `${label.replaceAll("_", " ")}: ${value}`)
    .join(" · ");
};

function Brand() {
  return (
    <div className="mg-brand" aria-label="MedGuard">
      <span className="mg-brand__mark"><ShieldCheck aria-hidden="true" size={22} strokeWidth={2.2} /></span>
      <span>MedGuard</span>
    </div>
  );
}

function AppHeader({ profile, onboarded, onNavigate }) {
  return (
    <header className="mg-header">
      <Brand />
      {onboarded && (
        <button className="mg-header__profile" type="button" onClick={() => onNavigate("profile")}>
          <UserRound aria-hidden="true" size={17} />
          <span>{profile.mode === "sample" ? "Sample profile" : "Your profile"}</span>
        </button>
      )}
    </header>
  );
}

function BottomNavigation({ active, onboarded, onNavigate }) {
  const destinations = [
    { id: "check", label: "Check", icon: Search },
    { id: "cabinet", label: "Cabinet", icon: Package },
    { id: "profile", label: "Profile", icon: UserRound },
  ];
  return (
    <nav className="mg-bottom-nav" aria-label="Primary navigation">
      {destinations.map(({ id, label, icon: Icon }) => {
        const selected = active === id || (!onboarded && active === "welcome" && id === "profile");
        return (
          <button
            key={id}
            type="button"
            className={`mg-bottom-nav__item ${selected ? "is-active" : ""}`}
            aria-current={selected ? "page" : undefined}
            onClick={() => onNavigate(!onboarded && id !== "profile" ? "profile" : id)}
          >
            <Icon aria-hidden="true" size={20} strokeWidth={selected ? 2.5 : 2} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function SampleBanner({ onEdit }) {
  return (
    <aside className="mg-sample-banner" aria-label="Sample profile notice">
      <Info aria-hidden="true" size={19} />
      <p><strong>Sample profile</strong> — warfarin and hypertension are example data. Edit before using this for yourself.</p>
      <button type="button" onClick={onEdit}>Edit</button>
    </aside>
  );
}

function WelcomeScreen({ onSetUp, onTrySample }) {
  return (
    <main className="mg-welcome" id="main-content">
      <div className="mg-welcome__copy">
        <span className="mg-kicker"><HeartPulse aria-hidden="true" size={16} /> A thoughtful cabinet check</span>
        <h1>A little clarity for your cabinet.</h1>
        <p className="mg-lede">Choose the label on your bottle, gather the evidence behind it, and bring a dated record to your pharmacist.</p>
        <ul className="mg-edges">
          <li><span className="mg-edges__ic"><BadgeCheck aria-hidden="true" size={20} /></span><div><strong>Live official sources</strong><small>Every flag opens a real NIH or FDA record — not an opinion.</small></div></li>
          <li><span className="mg-edges__ic"><HeartPulse aria-hidden="true" size={20} /></span><div><strong>Checked against your meds</strong><small>Reviewed with your own medicines and conditions.</small></div></li>
          <li><span className="mg-edges__ic"><FileText aria-hidden="true" size={20} /></span><div><strong>A note for your pharmacist</strong><small>Leave with a dated, sourced record to bring in.</small></div></li>
        </ul>
        <div className="mg-welcome__actions">
          <Button onClick={onSetUp}><span>Set up my profile</span><ArrowRight aria-hidden="true" size={18} /></Button>
          <Button variant="secondary" onClick={onTrySample}>Try a sample profile</Button>
        </div>
        <p className="mg-quiet-note">No name or email. Your profile is saved in this browser only after you choose to continue.</p>
      </div>
      <div className="mg-welcome__art" aria-hidden="true"><BottleArtwork /></div>
    </main>
  );
}

function TagEditor({ label, hint, entries, onChange, idPrefix, placeholder }) {
  const [draft, setDraft] = useState("");
  const inputId = `${idPrefix}-input`;
  const add = () => {
    const value = draft.trim();
    if (!value || entries.some((entry) => entry.toLocaleLowerCase() === value.toLocaleLowerCase())) return;
    onChange([...entries, value]);
    setDraft("");
  };
  return (
    <Field label={label} hint={hint} htmlFor={inputId}>
      <div className="mg-tag-editor">
        <div className="mg-tag-editor__tags" aria-live="polite">
          {entries.length ? entries.map((entry) => (
            <span key={entry.toLocaleLowerCase()} className="mg-tag">
              {entry}
              <button type="button" aria-label={`Remove ${entry}`} onClick={() => onChange(entries.filter((item) => item !== entry))}>
                <X aria-hidden="true" size={14} />
              </button>
            </span>
          )) : null}
        </div>
        <div className="mg-tag-editor__input-row">
          <input
            id={inputId}
            value={draft}
            maxLength={100}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); add(); }
            }}
            placeholder={placeholder}
          />
          <IconButton label={`Add ${label.toLocaleLowerCase()}`} onClick={add} disabled={!draft.trim()}>
            <Plus aria-hidden="true" size={18} />
          </IconButton>
        </div>
      </div>
    </Field>
  );
}

function StorageStatus({ state }) {
  if (state === "unavailable") {
    return <p className="mg-storage-status mg-storage-status--warning"><CircleAlert aria-hidden="true" size={17} /> Browser storage is unavailable, so changes will not persist after this session.</p>;
  }
  if (state === "corrupt") {
    return <p className="mg-storage-status mg-storage-status--warning"><CircleAlert aria-hidden="true" size={17} /> An unreadable saved record was cleared. Save this profile to start a new local record.</p>;
  }
  return <p className="mg-storage-status"><BadgeCheck aria-hidden="true" size={17} /> Saved in this browser. You can remove it below.</p>;
}

function ProfileScreen({ profile, storage, onboarded, cabinetCount, onSave, onReset }) {
  const [meds, setMeds] = useState(profile.meds);
  const [conditions, setConditions] = useState(profile.conditions);
  const [mode, setMode] = useState(profile.mode);

  useEffect(() => {
    setMeds(profile.meds);
    setConditions(profile.conditions);
    setMode(profile.mode);
  }, [profile]);

  const save = (event) => {
    event.preventDefault();
    onSave({ meds, conditions, mode });
  };

  return (
    <main className="mg-page mg-profile-page" id="main-content">
      <span className="mg-kicker"><UserRound aria-hidden="true" size={16} /> About you</span>
      <h1>Your meds &amp; conditions</h1>

      <form className="mg-profile-form" onSubmit={save}>
        {mode === "sample" && (
          <div className="mg-inline-callout">
            <Info aria-hidden="true" size={19} />
            <p>This is a labeled sample profile. Keep it for a demo, or make it personal before saving.</p>
            <Button variant="quiet" onClick={() => setMode("personal")}>Use as my profile</Button>
          </div>
        )}
        <TagEditor
          label="Medicines"
          entries={meds}
          onChange={setMeds}
          idPrefix="medicines"
          placeholder="Add a medicine"
        />
        <TagEditor
          label="Conditions"
          entries={conditions}
          onChange={setConditions}
          idPrefix="conditions"
          placeholder="Add a condition"
        />

        <section className="mg-privacy-card" aria-labelledby="privacy-title">
          <div className="mg-privacy-card__icon"><ShieldCheck aria-hidden="true" size={21} /></div>
          <div>
            <h2 id="privacy-title">Before your first check</h2>
            <p>Your profile and confirmed cabinet are saved in this browser. When you request a review, MedGuard sends the profile to its server and Strands on Amazon Bedrock; it sends the product text to the cited source APIs. No name or email is requested.</p>
          </div>
        </section>

        <StorageStatus state={storage} />
        <div className="mg-profile-form__actions">
          <Button type="submit">{onboarded ? "Save profile" : "Continue to Find my label"}<ArrowRight aria-hidden="true" size={18} /></Button>
          {onboarded && (
            <Button
              variant="danger-quiet"
              onClick={() => {
                if (window.confirm(`Remove this local profile and ${singular(cabinetCount, "cabinet item")} from this browser?`)) onReset();
              }}
            >
              <Trash2 aria-hidden="true" size={17} /> Remove local data
            </Button>
          )}
        </div>
      </form>
    </main>
  );
}

function WaitingCard() {
  return (
    <section className="mg-waiting-card" role="status" aria-live="polite">
      <span className="mg-waiting-card__orbit" aria-hidden="true"><span /></span>
      <div>
        <h2>Gathering your evidence</h2>
        <p>We will show completed source calls only when the review returns.</p>
      </div>
    </section>
  );
}

function CandidateChoices({ result, onChoose, busy }) {
  const candidates = result.candidates || [];
  return (
    <section className="mg-candidates" aria-labelledby="candidate-title">
      <span className="mg-kicker"><BadgeCheck aria-hidden="true" size={16} /> Confirm the label</span>
      <h1 id="candidate-title">This matches my bottle</h1>
      <p>Catalog search results are not automatic matches. Compare the product name, brand, and ingredients with the label in your hand.</p>
      {candidates.length ? <div className="mg-candidate-list">
        {candidates.map((candidate) => (
          <article className="mg-candidate" key={candidate.id}>
            <div className="mg-candidate__identity">
              <h3>{candidate.name}</h3>
              {candidate.brand && <p>{candidate.brand}</p>}
              {candidate.ingredients.length > 0 && <p className="mg-candidate__ingredients">{candidate.ingredients.join(", ")}</p>}
              {candidate.ingredient_coverage && <p className="mg-candidate__coverage">{candidate.ingredient_coverage}</p>}
              <SourceLink href={candidate.source_url}>{candidate.source || "NIH DSLD catalog record"} <ExternalLink aria-hidden="true" size={13} /></SourceLink>
            </div>
            <Button onClick={() => onChoose(candidate)} disabled={busy}>
              <Check aria-hidden="true" size={18} /> This matches my bottle
            </Button>
          </article>
        ))}
      </div> : <div className="mg-no-candidates">
        <CircleAlert aria-hidden="true" size={20} />
        <p>No catalog labels came back for this wording. Try the product name and brand from the bottle.</p>
      </div>}
      {result.answer && <p className="mg-evidence-summary"><strong>Catalog result:</strong> {result.answer}</p>}
      <ToolTrace trace={result.tool_trace} />
    </section>
  );
}

function TraceValue({ value, depth = 0 }) {
  if (value === null || value === "" || value === undefined) return <span>Not returned</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return <span>{String(value)}</span>;
  if (depth >= 3) return <span>Additional details returned</span>;
  if (Array.isArray(value)) {
    return value.length
      ? <ul className="mg-trace-result__list">{value.map((item, index) => <li key={index}><TraceValue value={item} depth={depth + 1} /></li>)}</ul>
      : <span>None</span>;
  }
  return (
    <dl className="mg-trace-result">
      {Object.entries(value).map(([key, item]) => <div key={key}><dt>{key}</dt><dd><TraceValue value={item} depth={depth + 1} /></dd></div>)}
    </dl>
  );
}

function TraceResult({ result }) {
  return <div className="mg-trace-result__text"><TraceValue value={result} /></div>;
}

function ToolTrace({ trace = [] }) {
  if (!trace.length) return null;
  return (
    <section className="mg-tool-trace" aria-labelledby="tool-trace-title">
      <div className="mg-tool-trace__heading">
        <div>
          <span className="mg-overline">Review provenance</span>
          <h3 id="tool-trace-title">{singular(trace.length, "actual tool call")}</h3>
        </div>
        <span className="mg-bedrock">Strands · Amazon Bedrock</span>
      </div>
      <Accordion.Root type="multiple" className="mg-trace-accordion">
        {trace.map((entry, index) => {
          const meta = TOOL_META[entry.tool] || { label: entry.tool, source: "Review tool", type: "curated" };
          const status = ["success", "error", "blocked"].includes(entry.status) ? entry.status : "blocked";
          return (
            <Accordion.Item className={`mg-trace-row mg-trace-row--${status}`} value={`${entry.tool}-${index}`} key={`${entry.tool}-${index}`}>
              <Accordion.Header>
                <Accordion.Trigger className="mg-trace-trigger">
                  <span className="mg-trace-trigger__main">
                    <span className={`mg-trace-status mg-trace-status--${status}`} aria-hidden="true" />
                    <span><strong>{meta.label}</strong><small>{meta.source}</small></span>
                  </span>
                  <span className="mg-trace-trigger__meta">
                    <Badge tone={meta.type === "live" ? "live" : "reference"}>{meta.type === "live" ? "Live source" : "Curated reference"}</Badge>
                    <Badge tone={status === "success" ? "success" : "warning"}>{status}</Badge>
                    <ChevronDown aria-hidden="true" className="mg-trace-chevron" size={18} />
                  </span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="mg-trace-content">
                <TraceResult result={entry.result} />
                {entry.source_urls?.length > 0 && <div className="mg-trace-content__sources">{entry.source_urls.map((url) => <SourceLink key={url} href={url}>{entry.source || "Open returned source"} <ExternalLink aria-hidden="true" size={13} /></SourceLink>)}</div>}
              </Accordion.Content>
            </Accordion.Item>
          );
        })}
      </Accordion.Root>
    </section>
  );
}

function RecallFinding({ recall }) {
  if (!recall) return (
    <section className="mg-finding-section">
      <h3>Recall record scope</h3>
      <p>The recall source did not return a usable record for this review. That is missing evidence, not reassurance.</p>
    </section>
  );
  if (recall.status === "potential_matches") {
    const recordCount = recall.records.length;
    const statusCounts = recall.records.reduce((counts, record) => {
      const status = record.status || "Not reported";
      counts.set(status, (counts.get(status) || 0) + 1);
      return counts;
    }, new Map());
    const statusSummary = [...statusCounts.entries()].map(([status, count]) => `${status} (${count})`).join(" · ");
    const reasonSummary = [...new Set(recall.records.map((r) => (r.reason_for_recall || "").split(/[.;:]/)[0].trim()).filter(Boolean))].slice(0, 2).join(" · ");
    return (
      <section className="mg-finding-section mg-finding-section--attention">
        <div className="mg-finding-section__heading">
          <div><span className="mg-overline">openFDA records</span><h3>Potential recall matches</h3></div>
          <Badge tone="attention">Compare product &amp; lot</Badge>
        </div>
        <p>These are text or category matches, not a claim that your bottle is recalled. Compare the product name, manufacturer, and lot or package code before acting.</p>
        <p className="mg-recall-count"><strong>{singular(recordCount, "potential FDA record")}</strong> returned for this text/category search.{statusSummary && <> Record statuses: {statusSummary}.</>}</p>
        {reasonSummary && <p className="mg-recall-reason"><strong>Why they were recalled:</strong> {reasonSummary}. Confirm your product and lot against the records below.</p>}
        {recordCount ? <details className="mg-recall-details">
          <summary>Review FDA record details</summary>
          <div className="mg-recall-records">
            {recall.records.map((record, index) => (
              <article key={`${record.recall_number}-${index}`} className="mg-recall-record">
                <h4>{record.product_description}</h4>
                <dl>
                  {record.recalling_firm && <div><dt>Recalling firm</dt><dd>{record.recalling_firm}</dd></div>}
                  {record.recall_number && <div><dt>Recall number</dt><dd>{record.recall_number}</dd></div>}
                  {record.status && <div><dt>Status</dt><dd>{record.status}</dd></div>}
                  {record.classification && <div><dt>Classification</dt><dd>{record.classification}</dd></div>}
                  {record.reason_for_recall && <div><dt>Reason for recall</dt><dd>{record.reason_for_recall}</dd></div>}
                  {record.dates && <div><dt>Dates</dt><dd>{formatRecordDates(record.dates)}</dd></div>}
                  {record.code_info && <div><dt>Lot / package code</dt><dd>{record.code_info}</dd></div>}
                </dl>
                <SourceLink href={record.source_url}>Open FDA record <ExternalLink aria-hidden="true" size={13} /></SourceLink>
              </article>
            ))}
          </div>
        </details> : <p className="mg-small-callout">The source described potential matches but returned no record details. Use the source link and compare your bottle.</p>}
        {recall.coverage && <p className="mg-coverage-note">{recall.coverage}</p>}
        {recall.metadata?.last_updated && <p className="mg-retrieved-note">Source last updated: {formatRecordDates(recall.metadata.last_updated)}</p>}
        {recall.source_urls?.map((url) => <SourceLink key={url} href={url}>{recall.source || "Open FDA search"} <ExternalLink aria-hidden="true" size={13} /></SourceLink>)}
      </section>
    );
  }
  if (recall.status === "no_match") {
    return (
      <section className="mg-finding-section">
        <h3>Recall record scope</h3>
        <p>No matching record was returned by the covered recall sources at check time. This does not verify your bottle, its lot, or establish safety.</p>
        {recall.coverage && <p className="mg-coverage-note">{recall.coverage}</p>}
        {recall.metadata?.last_updated && <p className="mg-retrieved-note">Source last updated: {formatRecordDates(recall.metadata.last_updated)}</p>}
        {recall.source_urls?.map((url) => <SourceLink key={url} href={url}>{recall.source || "Covered recall source"} <ExternalLink aria-hidden="true" size={13} /></SourceLink>)}
      </section>
    );
  }
  return (
    <section className="mg-finding-section mg-finding-section--incomplete">
      <h3>Recall source unavailable</h3>
      <p>The covered recall source could not be completed. A missing result cannot be treated as no recall.</p>
      {recall.coverage && <p className="mg-coverage-note">{recall.coverage}</p>}
      {recall.metadata?.last_updated && <p className="mg-retrieved-note">Source last updated: {formatRecordDates(recall.metadata.last_updated)}</p>}
      {recall.source_urls?.map((url) => <SourceLink key={url} href={url}>{recall.source || "Recall source"} <ExternalLink aria-hidden="true" size={13} /></SourceLink>)}
    </section>
  );
}

function InteractionFindings({ interactions = [], coverage }) {
  return (
    <section className="mg-finding-section">
      <div className="mg-finding-section__heading">
        <div><span className="mg-overline">Cited review prompts</span><h3>Things to ask about</h3></div>
        <Badge tone="reference">Not clinical severity</Badge>
      </div>
      {interactions.length ? <div className="mg-interactions">
        {interactions.map((finding, index) => (
          <article className="mg-interaction" key={`${finding.note}-${index}`}>
            <Badge tone="attention">{finding.risk}</Badge>
            <div>
              {finding.against && <p className="mg-interaction__against">With {finding.against}</p>}
              <p>{finding.note}</p>
              <SourceLink href={finding.source_url}>{finding.source || "Cited reference"} <ExternalLink aria-hidden="true" size={13} /></SourceLink>
            </div>
          </article>
        ))}
      </div> : <p>No bounded interaction prompt was returned for this profile. The curated references do not cover every medicine, condition, ingredient, dose, or formulation, so an empty list is not a safety finding.</p>}
      {coverage && <p className="mg-coverage-note">{coverage}</p>}
    </section>
  );
}

function DosageReferences({ dosage = [], coverage }) {
  return (
    <Accordion.Root type="single" collapsible className="mg-dosage-accordion">
      <Accordion.Item value="dosage">
        <Accordion.Header>
          <Accordion.Trigger className="mg-dosage-trigger">
            <span><strong>Adult reference limits</strong><small>Actual dose and frequency are unknown</small></span>
            <ChevronDown aria-hidden="true" size={20} />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="mg-dosage-content">
          {dosage.length ? dosage.map((reference, index) => (
            <article className="mg-dosage-reference" key={`${reference.ingredient}-${index}`}>
              <h4>{reference.ingredient}</h4>
              <p>{reference.adult_reference_limit}</p>
              {reference.scope && <p className="mg-dosage-reference__scope">{reference.scope}</p>}
              <SourceLink href={reference.source_url}>{reference.source || "NIH ODS reference"} <ExternalLink aria-hidden="true" size={13} /></SourceLink>
            </article>
          )) : <p>No adult reference row was returned for the detected ingredients. That does not mean a dose is appropriate or safe for you.</p>}
          {coverage && <p className="mg-coverage-note">{coverage}</p>}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function IncompleteResult({ result, onRetry }) {
  const unidentified = result.status === "unidentified";
  return (
    <section className="mg-result mg-result--incomplete">
      <Badge tone="warning">{unidentified ? "Need the bottle label" : "Evidence incomplete"}</Badge>
      <h1>{unidentified ? "Use the bottle label, not a guess." : "This review is not ready to save."}</h1>
      <p className="mg-lede">{result.answer || (unidentified ? "MedGuard does not identify a loose pill or an unclear description. Type the product and brand from its bottle label." : "A required source did not finish. Missing findings are not reassurance.")}</p>
      <div className="mg-result__actions"><Button onClick={onRetry}><RotateCcw aria-hidden="true" size={18} /> Try again</Button></div>
      <ToolTrace trace={result.tool_trace} />
    </section>
  );
}

// One at-a-glance verdict from the gathered evidence. Green = clear, amber = worth a check.
function verdictOf(result) {
  const recall = result.recall || {};
  const records = recall.records || [];
  // Only a SERIOUS active recall is worth alarming about on the shelf: ongoing status and a
  // Class I/II classification (FDA's own severity — reasonable/possible harm). Class III
  // (minor, e.g. labeling) or terminated-only text matches stay quietly in the details.
  const activeRecall = recall.status === "potential_matches" && records.find((r) => {
    const ongoing = /ongoing/i.test(String(r.status || ""));
    const cls = String(r.classification || "");
    const serious = !cls || /class i\b/i.test(cls) || /class ii\b/i.test(cls);
    return ongoing && serious;
  });
  const interactions = result.interactions || [];
  const flag = interactions.find((f) => ["high", "moderate", "review", "caution"].some((k) => String(f.risk || "").toLowerCase().includes(k)) || String(f.review_priority || "").toLowerCase().includes("caution")) || interactions[0];
  if (activeRecall) {
    const reason = (activeRecall.reason_for_recall || "").split(/[.;:]/)[0].trim();
    return { tone: "check", kind: "recall", title: "Worth a closer look", line: reason ? `An active recall matched this product (${reason.toLowerCase()}). Compare your product and lot.` : "An active recall matched this product — compare your product and lot." };
  }
  if (flag) {
    return { tone: "check", kind: "interaction", title: "One thing to check", line: flag.against ? `Worth asking your pharmacist about ${flag.against}.` : "Worth a quick pharmacist check before you take it." };
  }
  return { tone: "good", kind: "clear", title: "No flags found", line: "Nothing active matched in the checks. This isn't a safety guarantee — ask the agent or your pharmacist." };
}

function EvidenceDialog({ open, onOpenChange, result, triggerRef }) {
  const identity = result.identity;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="mg-dialog-overlay" />
        <Dialog.Content className="mg-dialog-content" onCloseAutoFocus={(e) => { e.preventDefault(); triggerRef?.current?.focus(); }}>
          <div className="mg-dialog-content__header">
            <div>
              <span className="mg-kicker"><ClipboardList aria-hidden="true" size={16} /> Evidence, with limits</span>
              <Dialog.Title>{identity.name}</Dialog.Title>
              <Dialog.Description>The sources behind this review. MedGuard surfaces them; a pharmacist decides.</Dialog.Description>
            </div>
            <Dialog.Close asChild><IconButton label="Close details"><X aria-hidden="true" size={20} /></IconButton></Dialog.Close>
          </div>
          <div className="mg-evidence-scroll">
            <InteractionFindings interactions={result.interactions} coverage={result.interaction_coverage} />
            <RecallFinding recall={result.recall} />
            <DosageReferences dosage={result.dosage} coverage={result.dosage_coverage} />
            <section className="mg-ingredients-section">
              <h3>Catalog ingredients</h3>
              {identity.ingredients.length ? <p>{identity.ingredients.join(", ")}</p> : <p>{identity.ingredient_status === "explicitly_empty" ? "The catalog record returned an empty ingredient list." : "The catalog record did not list ingredients."}</p>}
              <SourceLink href={identity.source_url}>{identity.source || "Confirmed catalog record"} <ExternalLink aria-hidden="true" size={13} /></SourceLink>
            </section>
            <ToolTrace trace={result.tool_trace} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AskAgentDialog({ open, onOpenChange, result, profile, triggerRef }) {
  const identity = result.identity;
  const context = useMemo(() => ({
    identity: { name: identity.name, brand: identity.brand, ingredients: identity.ingredients },
    profile: { meds: profile?.meds || [], conditions: profile?.conditions || [] },
    interactions: result.interactions, recall: result.recall, dosage: result.dosage,
  }), [result, profile]);
  const suggestions = [
    "Is this safe with my meds?",
    "Why was it flagged?",
    "What should I ask my pharmacist?",
  ];
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { who: "user", text: q }]);
    setBusy(true);
    try {
      const r = await askAgent(q, context);
      setMessages((m) => [...m, { who: "agent", text: r.answer || "I don't have enough in this review to answer — ask your pharmacist." }]);
    } catch (error) {
      setMessages((m) => [...m, { who: "agent", text: error?.message || "I couldn't answer just now. Try again." }]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="mg-dialog-overlay" />
        <Dialog.Content className="mg-dialog-content mg-ask" onCloseAutoFocus={(e) => { e.preventDefault(); triggerRef?.current?.focus(); }}>
          <div className="mg-dialog-content__header">
            <div>
              <span className="mg-kicker"><Sparkles aria-hidden="true" size={16} /> Ask the agent</span>
              <Dialog.Title>{identity.name}</Dialog.Title>
            </div>
            <Dialog.Close asChild><IconButton label="Close agent"><X aria-hidden="true" size={20} /></IconButton></Dialog.Close>
          </div>
          <div className="mg-chat">
            {messages.length === 0 && <div className="mg-chat__intro">Ask about this product and your profile. Answers use this review's live evidence and cite their source.</div>}
            {messages.map((m, i) => <div key={i} className={`mg-bubble mg-bubble--${m.who}`}>{m.text}</div>)}
            {busy && <div className="mg-bubble mg-bubble--agent mg-bubble--typing"><RotateCcw aria-hidden="true" className="mg-spin" size={15} /> thinking…</div>}
          </div>
          {messages.length === 0 && <div className="mg-chat__suggest">{suggestions.map((s) => <button key={s} type="button" className="mg-pick" onClick={() => send(s)}>{s}</button>)}</div>}
          <form className="mg-chat__input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about this product…" aria-label="Ask the agent" maxLength={400} />
            <IconButton label="Send" type="submit" disabled={busy || !input.trim()}><Send aria-hidden="true" size={18} /></IconButton>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CompleteResult({ result, profile, stale, savedView, existingItem, onAdd, onRecheck }) {
  const identity = result.identity;
  const verdict = verdictOf(result);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const evidenceRef = useRef(null);
  const askRef = useRef(null);
  return (
    <section className="mg-result">
      <div className="mg-result__title-row">
        <div>
          <h1>{identity.name}</h1>
          <p className="mg-product-subtitle">{identity.brand || "Confirmed catalog label"}</p>
        </div>
        <span className="mg-check-date">Checked {formatDate(result.checked_at, true)}</span>
      </div>

      {stale && <div className="mg-stale-banner"><CircleAlert aria-hidden="true" size={19} /><p><strong>Profile changed.</strong> Recheck before relying on this.</p></div>}

      <div className={`mg-verdict mg-verdict--${verdict.tone}`}>
        <span className="mg-verdict__dot" />
        <div>
          <strong>{verdict.title}</strong>
          <p>{verdict.line}</p>
        </div>
      </div>

      <div className="mg-result__cta">
        <button ref={askRef} type="button" className="mg-tile mg-tile--primary" onClick={() => setAskOpen(true)}>
          <Sparkles aria-hidden="true" size={20} /> Ask the agent
        </button>
        <button ref={evidenceRef} type="button" className="mg-tile" onClick={() => setEvidenceOpen(true)}>
          <ClipboardList aria-hidden="true" size={20} /> See details
        </button>
      </div>

      <div className="mg-result__actions">
        {savedView ? <Button variant="secondary" disabled><BadgeCheck aria-hidden="true" size={18} /> In your cabinet</Button> : <Button onClick={onAdd}>{existingItem ? <RotateCcw aria-hidden="true" size={18} /> : <Plus aria-hidden="true" size={18} />}{existingItem ? " Update cabinet review" : " Add to cabinet"}</Button>}
        <Button variant="quiet" onClick={onRecheck}><RotateCcw aria-hidden="true" size={17} /> Recheck</Button>
      </div>

      <EvidenceDialog open={evidenceOpen} onOpenChange={setEvidenceOpen} result={result} triggerRef={evidenceRef} />
      <AskAgentDialog open={askOpen} onOpenChange={setAskOpen} result={result} profile={profile} triggerRef={askRef} />
    </section>
  );
}

function CheckScreen({ state, onLookup, onChooseCandidate, onRetry, onAdd, onRecheck, onNewLabel }) {
  const existingItem = state.result?.identity ? state.cabinet.find((item) => item.id === state.result.identity.id) : null;
  const savedView = Boolean(existingItem && state.activeCabinetId === existingItem.id);
  const canSave = resultCanBeSaved(state.result);
  const hasDecisionScreen = Boolean(state.candidates || state.result);
  const fileRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState("");
  const onScanFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setScanNote(""); setScanning(true);
    try {
      const reading = await scanLabel(file);
      if (reading.readable && reading.query) {
        onLookup(reading.query);
      } else {
        setScanNote(reading.note || "Couldn't read the label. Retake in good light, or type the name.");
        document.getElementById("label-search")?.focus();
      }
    } catch (error) {
      setScanNote(error?.message || "Couldn't read that photo. Try again, or type the name.");
    } finally {
      setScanning(false);
    }
  };
  return (
    <main className="mg-page mg-check-page" id="main-content">
      {hasDecisionScreen ? <button className="mg-back-link" type="button" onClick={onNewLabel}><ArrowLeft aria-hidden="true" size={17} /> Find another label</button> : <>
        <span className="mg-kicker"><Search aria-hidden="true" size={16} /> Check a product</span>
        <h1>What's in your cabinet?</h1>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onScanFile} />
        <button type="button" className="mg-scan-cta" disabled={scanning} onClick={() => fileRef.current?.click()}>
          <span className="mg-scan-cta__icon">{scanning ? <RotateCcw aria-hidden="true" className="mg-spin" size={24} /> : <Camera aria-hidden="true" size={26} />}</span>
          <span className="mg-scan-cta__text">
            <strong>{scanning ? "Reading the label…" : "Scan a bottle"}</strong>
            <small>{scanning ? "Bedrock Nova Pro vision" : "Snap the label — we read the product name"}</small>
          </span>
        </button>
        {scanNote && <p className="mg-scan-note" role="status">{scanNote}</p>}

        <div className="mg-pick-list" aria-label="Common products">
          {PRODUCT_EXAMPLES.map((example) => (
            <button type="button" className="mg-pick" key={example} onClick={() => onLookup(example)}>{example}</button>
          ))}
        </div>

        <form className="mg-label-search" onSubmit={(event) => { event.preventDefault(); onLookup(state.query); }}>
          <div className="mg-label-search__field-row">
            <Search aria-hidden="true" className="mg-label-search__icon" size={20} />
            <input id="label-search" aria-label="Product name" maxLength={160} value={state.query} onChange={(event) => onLookup(event.target.value, { changeOnly: true })} placeholder="Or type a product name" autoComplete="off" />
            <Button type="submit" disabled={state.busy || !state.query.trim()} loading={state.busy}><span className="mg-label-search__button-copy">Find</span></Button>
          </div>
        </form>
      </>}

      {state.busy && <WaitingCard />}
      {state.error && (
        <section className="mg-request-error" role="alert">
          <CircleAlert aria-hidden="true" size={21} />
          <div><h2>We could not finish that review.</h2><p>{state.error}</p></div>
          <Button variant="secondary" onClick={onRetry}><RotateCcw aria-hidden="true" size={17} /> Retry</Button>
        </section>
      )}
      {state.candidates && <CandidateChoices result={state.candidates} onChoose={onChooseCandidate} busy={state.busy} />}
      {state.result && !canSave && <IncompleteResult result={state.result} onRetry={onRetry} />}
      {state.result && canSave && <CompleteResult result={state.result} profile={state.request?.profileSnapshot || state.profile} stale={savedView && existingItem?.stale} savedView={savedView} existingItem={existingItem} onAdd={onAdd} onRecheck={onRecheck} />}
    </main>
  );
}

function ShelfBottle({ tone }) {
  return (
    <span className={`mg-shelf__bottle mg-shelf__bottle--${tone}`} aria-hidden="true">
      <span className="mg-shelf__cap" />
      <span className="mg-shelf__label" />
    </span>
  );
}

function CabinetCard({ item, onOpen, onRemove }) {
  const verdict = verdictOf(item.result);
  const tone = item.stale ? "check" : verdict.tone;
  const status = item.stale ? "Recheck" : verdict.kind === "recall" ? "Recall — compare lot" : verdict.kind === "interaction" ? "Ask your pharmacist" : "No flags";
  return (
    <article className={`mg-shelf-item mg-shelf-item--${tone}`}>
      <button className="mg-shelf-item__open" type="button" onClick={() => onOpen(item)}>
        {tone !== "good" && <span className="mg-shelf-item__alert" aria-label="Needs a look" />}
        <ShelfBottle tone={tone} />
        <span className="mg-shelf-item__name">{item.identity.name}</span>
        <span className="mg-shelf-item__brand">{item.identity.brand || "supplement"}</span>
        <span className={`mg-shelf-item__status mg-shelf-item__status--${tone}`}>{status}</span>
      </button>
      <IconButton label={`Remove ${item.identity.name}`} onClick={() => onRemove(item.id)}><Trash2 aria-hidden="true" size={16} /></IconButton>
    </article>
  );
}

function NoteDialog({ open, onOpenChange, profile, cabinet, triggerRef }) {
  const note = useMemo(() => buildReviewNote({ profile, cabinet }), [profile, cabinet]);
  const noteHtml = useMemo(() => buildReviewNoteHtml({ profile, cabinet }), [profile, cabinet]);
  const [printIssue, setPrintIssue] = useState("");
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="mg-dialog-overlay" />
        <Dialog.Content
          className="mg-dialog-content"
          aria-describedby="review-note-description"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef?.current?.focus();
          }}
        >
          <div className="mg-dialog-content__header">
            <div>
              <span className="mg-kicker"><FileText aria-hidden="true" size={16} /> User-reviewed handoff</span>
              <Dialog.Title>Pharmacist review note</Dialog.Title>
              <Dialog.Description id="review-note-description">Review this text before downloading or printing. MedGuard does not send it anywhere.</Dialog.Description>
            </div>
            <Dialog.Close asChild><IconButton label="Close review note"><X aria-hidden="true" size={20} /></IconButton></Dialog.Close>
          </div>
          <div className="mg-note-preview" aria-label="Review note preview">
            <iframe className="mg-note-frame" title="Review note preview" srcDoc={noteHtml} />
          </div>
          {printIssue && <p className="mg-print-issue" role="alert">{printIssue}</p>}
          <div className="mg-dialog-content__actions">
            <Button variant="secondary" onClick={() => downloadReviewNote(note)}><Download aria-hidden="true" size={18} /> Download text</Button>
            <Button onClick={() => setPrintIssue(printReviewNoteHtml(noteHtml) ? "" : "Your browser blocked the print window. Allow pop-ups, then try again.")}><Printer aria-hidden="true" size={18} /> Print note</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CabinetScreen({ cabinet, profile, onOpenItem, onRemove, onCheck }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const noteTriggerRef = useRef(null);
  const handleNoteOpenChange = (open) => {
    setNoteOpen(open);
    if (!open) queueMicrotask(() => noteTriggerRef.current?.focus());
  };
  return (
    <main className="mg-page mg-cabinet-page" id="main-content">
      <span className="mg-kicker"><Package aria-hidden="true" size={16} /> Your shelf</span>
      <h1>Your medicine shelf</h1>
      {cabinet.length ? <>
        <div className="mg-cabinet-actions">
          <p>{singular(cabinet.length, "product")}</p>
          <Button ref={noteTriggerRef} variant="secondary" onClick={() => setNoteOpen(true)}><FileText aria-hidden="true" size={18} /> Pharmacist note</Button>
        </div>
        <div className="mg-shelf">
          {cabinet.map((item) => <CabinetCard key={item.id} item={item} onOpen={onOpenItem} onRemove={onRemove} />)}
        </div>
      </> : <section className="mg-cabinet-empty">
        <CabinetArtwork />
        <h2>Your cabinet starts with a confirmed label.</h2>
        <p>Finish a label review, then choose whether to add it here. Nothing is added automatically.</p>
        <Button onClick={onCheck}><Search aria-hidden="true" size={18} /> Find a label</Button>
      </section>}
      <NoteDialog open={noteOpen} onOpenChange={handleNoteOpenChange} profile={profile} cabinet={cabinet} triggerRef={noteTriggerRef} />
    </main>
  );
}

export function App() {
  const abortRef = useRef(null);
  const requestInFlightRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const [state, dispatch] = useReducer(appReducer, undefined, () => createInitialState(loadPersistedState()));

  useEffect(() => () => {
    requestGenerationRef.current += 1;
    requestInFlightRef.current = false;
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!state.onboarded) return;
    const saved = savePersistedState({ version: 1, onboarded: state.onboarded, profile: state.profile, cabinet: state.cabinet });
    if (saved && state.storage !== "available") dispatch({ type: "STORAGE_AVAILABLE" });
    if (!saved && state.storage !== "unavailable") dispatch({ type: "STORAGE_UNAVAILABLE" });
  }, [state.onboarded, state.profile, state.cabinet, state.storage]);

  const navigate = (tab) => dispatch({ type: "NAVIGATE", tab });
  const invalidateInFlightRequest = () => {
    requestGenerationRef.current += 1;
    requestInFlightRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
  };
  const saveProfile = (profile) => {
    invalidateInFlightRequest();
    dispatch({ type: "PROFILE_SAVED", profile: normalizeProfile(profile) });
  };
  const resetLocalData = () => {
    invalidateInFlightRequest();
    const cleared = clearPersistedState();
    dispatch({ type: "LOCAL_DATA_RESET", storage: cleared ? "available" : "unavailable" });
  };

  const performRequest = async ({ scan, selectedId = null }) => {
    const label = scan.trim();
    if (!label || state.busy || requestInFlightRef.current) return;
    const controller = new AbortController();
    const generation = requestGenerationRef.current + 1;
    const profileSnapshot = normalizeProfile(state.profile);
    requestGenerationRef.current = generation;
    requestInFlightRef.current = true;
    abortRef.current = controller;
    dispatch({ type: "REQUEST_STARTED", scan: label, selectedId, profileSnapshot, generation });
    try {
      const response = await requestMedcheck({ scan: label, profile: { meds: profileSnapshot.meds, conditions: profileSnapshot.conditions }, selectedId }, { signal: controller.signal });
      const result = normalizeResult(response);
      if (!result) throw new Error("The review service returned an unreadable result.");
      if (requestGenerationRef.current !== generation) return;
      if (result.status === "needs_confirmation") dispatch({ type: "CANDIDATES_RECEIVED", result, generation });
      else dispatch({ type: "RESULT_RECEIVED", result, generation });
    } catch (error) {
      if (requestGenerationRef.current === generation) {
        dispatch({ type: "REQUEST_ERROR", error: error?.message || "We could not finish the review. Please try again.", generation });
      }
    } finally {
      if (requestGenerationRef.current === generation) {
        requestInFlightRef.current = false;
        if (abortRef.current === controller) abortRef.current = null;
      }
    }
  };

  const lookup = (query, options = {}) => {
    if (options.changeOnly) dispatch({ type: "QUERY_CHANGED", query });
    else performRequest({ scan: query });
  };
  const chooseCandidate = (candidate) => performRequest({ scan: state.request?.scan || state.query, selectedId: candidate.id });
  const retry = () => state.request && performRequest(state.request);
  const addToCabinet = () => {
    const item = makeCabinetItem(state.result, state.request?.profileSnapshot, state.request?.scan);
    if (item) dispatch({ type: "CABINET_ADDED", item });
  };
  const recheck = () => {
    if (state.result?.identity?.id && state.request?.scan) performRequest({ scan: state.request.scan, selectedId: state.result.identity.id });
  };
  const startAnotherLabel = () => {
    invalidateInFlightRequest();
    dispatch({ type: "REVIEW_RESET" });
  };

  let content;
  if (state.tab === "welcome") {
    content = <WelcomeScreen onSetUp={() => navigate("profile")} onTrySample={() => saveProfile(SAMPLE_PROFILE)} />;
  } else if (state.tab === "profile") {
    content = <ProfileScreen profile={state.profile} storage={state.storage} onboarded={state.onboarded} cabinetCount={state.cabinet.length} onSave={saveProfile} onReset={resetLocalData} />;
  } else if (state.tab === "cabinet") {
    content = <CabinetScreen cabinet={state.cabinet} profile={state.profile} onOpenItem={(item) => dispatch({ type: "OPEN_CABINET_ITEM", item })} onRemove={(id) => dispatch({ type: "CABINET_REMOVED", id })} onCheck={() => navigate("check")} />;
  } else {
    content = <CheckScreen state={state} onLookup={lookup} onChooseCandidate={chooseCandidate} onRetry={retry} onAdd={addToCabinet} onRecheck={recheck} onNewLabel={startAnotherLabel} />;
  }

  return (
    <div className="mg-app-shell">
      <a className="mg-skip-link" href="#main-content">Skip to content</a>
      <div className="mg-app-frame">
        <AppHeader profile={state.profile} onboarded={state.onboarded} onNavigate={navigate} />
        {state.onboarded && state.profile.mode === "sample" && <SampleBanner onEdit={() => navigate("profile")} />}
        {content}
      </div>
      <BottomNavigation active={state.tab} onboarded={state.onboarded} onNavigate={navigate} />
      <footer className="mg-boundary"><Info aria-hidden="true" size={15} /> MedGuard surfaces evidence and reference flags for a pharmacist conversation. It is not medical advice.</footer>
    </div>
  );
}
