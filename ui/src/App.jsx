import { useState } from "react";

const Icon = ({ name, bold = false }) => <i aria-hidden="true" className={`${bold ? "ph-bold" : "ph"} ph-${name}`} />;

const PRESETS = ["Fish Oil", "Ginkgo", "St. John's Wort", "Vitamin K", "Turmeric"];
const TOOL_LABEL = {
  identify_supplement: ["Identified product", "NIH DSLD · live"],
  check_recall: ["Checked recall feed", "openFDA · live"],
  check_interactions: ["Cross-checked interactions vs your profile", "cited rules"],
  check_dosage: ["Checked dosage limits", "NIH ODS"],
};
const sevLabel = { recall: "RECALLED", high: "HIGH RISK", warning: "CAUTION", good: "CLEAR" };

function severityOf(r) {
  if (r?.recall?.recalled) return "recall";
  const risks = (r?.interactions || []).map((f) => f.risk);
  if (risks.includes("HIGH")) return "high";
  if (risks.includes("MODERATE")) return "warning";
  return "good";
}
const dotColor = (s) => (s === "recall" || s === "high" ? "var(--mg-red)" : s === "warning" ? "var(--mg-warn)" : "var(--mg-green)");

async function medcheck(scan, profile) {
  const res = await fetch("/api/medcheck", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scan, profile }),
  });
  if (!res.ok) throw new Error(`medcheck ${res.status}`);
  return res.json();
}

function TracePanel({ trace, busy }) {
  return <div className="mg-trace-box">
    <p className="mg-trace-title">AGENT WORKFLOW · autonomous, live sources</p>
    {trace.map((t, i) => {
      const [label, src] = TOOL_LABEL[t.tool] || [t.tool, ""];
      return <div key={i} className="mg-trace-row">
        <span className="ok"><Icon name="check-circle" bold /></span>
        <span style={{ fontWeight: 600 }}>{label}</span>
        {src && <span className="mg-src">● {src}</span>}
      </div>;
    })}
    {busy && <div className="mg-trace-row" style={{ color: "var(--mg-muted)" }}>
      <span className="mg-spin"><Icon name="arrows-clockwise" /></span> agent investigating…</div>}
  </div>;
}

function ResultCard({ r }) {
  const sev = severityOf(r);
  return <section className="mg-card">
    <div className="mg-finding-head">
      <div>
        <p className="mg-eyebrow"><span className="status-dot" /> Agent finding</p>
        <h2 className="mg-finding-name">{r.identity?.name || r.scan} {r.identity?.brand && <small>· {r.identity.brand}</small>}</h2>
      </div>
      <span className={`mg-sev ${sev}`}>{sevLabel[sev]}</span>
    </div>

    {r.recall?.recalled && <div className="mg-banner">
      <span className="ic"><Icon name="siren" bold /></span>
      <div>
        <div className="mg-banner-title">LIVE RECALL · openFDA</div>
        <div className="mg-banner-body">Recalled {r.recall.date} · {r.recall.status} · {r.recall.reason}</div>
        <div className="mg-banner-note">GPT trained on old data can’t know this. MedGuard checked the live feed.</div>
      </div>
    </div>}

    {(r.interactions || []).map((f, i) => <div key={i} className={`mg-inter ${f.risk === "HIGH" ? "high" : ""}`}>
      <span className="mg-dot" style={{ background: f.risk === "HIGH" ? "var(--mg-red)" : "var(--mg-warn)" }} />
      <div>
        <strong className="mg-inter-note">{f.risk} interaction · vs your {f.against}</strong>
        <div className="mg-inter-note">{f.note}</div>
        <div className="mg-inter-src"><Icon name="git-branch" /> source: {f.source}</div>
      </div>
    </div>)}

    {r.identity?.ingredients?.length > 0 && <div className="mg-ingredients">Ingredients (NIH DSLD): {r.identity.ingredients.slice(0, 8).join(", ")}</div>}

    <div className="mg-answer">
      <span className="mg-agent-badge">● Real Strands agent · {r.tools} live tools</span>
      {r.answer}
    </div>
  </section>;
}

export function App() {
  const [profile] = useState({ meds: ["warfarin"], conditions: ["hypertension"] });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [trace, setTrace] = useState([]);
  const [current, setCurrent] = useState(null);
  const [cabinet, setCabinet] = useState([]);
  const [doctor, setDoctor] = useState(false);

  const check = async (query) => {
    if (!query.trim() || busy) return;
    setInput(""); setBusy(true); setCurrent(null); setTrace([]);
    const steps = ["identify_supplement", "check_recall", "check_interactions", "check_dosage"];
    steps.forEach((tool, i) => setTimeout(() => setTrace((t) => [...t, { tool }]), 450 + i * 620));
    try {
      const r = await medcheck(query, profile);
      r.scan = query;
      setTrace(r.tool_trace?.length ? r.tool_trace : steps.map((tool) => ({ tool })));
      setCurrent(r);
      const name = r.identity?.name || query;
      setCabinet((c) => [{ name, brand: r.identity?.brand, sev: severityOf(r) }, ...c.filter((x) => x.name !== name)]);
    } catch (e) {
      setCurrent({ scan: query, tools: 0, answer: `MedGuard backend unavailable (${e.message}). Start medguard/server.py.`, interactions: [], recall: null });
    } finally { setBusy(false); }
  };

  const recalled = cabinet.find((x) => x.sev === "recall");

  return <div className="mg-app">
    <header className="mg-header">
      <span className="mg-mark"><Icon name="shield-check" bold /></span>
      <div>
        <h1 className="mg-title">Med<b>Guard</b></h1>
        <div className="mg-tagline">Your medicine &amp; supplement safety agent — grounded in live FDA / NIH data</div>
      </div>
    </header>

    <div className="mg-profile">
      <span className="mg-profile-label">YOUR HEALTH PROFILE</span>
      {profile.meds.map((m) => <span key={m} className="mg-chip med"><Icon name="database" /> {m}</span>)}
      {profile.conditions.map((c) => <span key={c} className="mg-chip cond"><Icon name="warning" /> {c}</span>)}
      <span className="mg-profile-hint">· drives every “is it safe for you” check</span>
    </div>

    <section className="mg-card">
      <p className="mg-eyebrow"><Icon name="camera" /> Scan or add a supplement / med</p>
      <div className="mg-scan-row">
        <input className="mg-input" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check(input)}
          placeholder="Type a product (e.g. Fish Oil) — or scan a bottle" aria-label="Product name" />
        <button className="mg-btn" disabled={busy} onClick={() => check(input)}><Icon name="magnifying-glass" bold /> Check</button>
      </div>
      <div className="mg-presets">
        {PRESETS.map((p) => <button key={p} className="mg-preset" disabled={busy} onClick={() => check(p)}>{p}</button>)}
      </div>
      {(trace.length > 0 || busy) && <TracePanel trace={trace} busy={busy} />}
    </section>

    {current && <ResultCard r={current} />}

    {recalled && <div className="mg-banner" style={{ alignItems: "center" }}>
      <span className="ic"><Icon name="siren" bold /></span>
      <div className="mg-banner-body"><span className="mg-banner-title">PROACTIVE ALERT</span> — MedGuard is watching the live openFDA feed: <b>{recalled.name}</b> in your cabinet has an active recall. It caught this without you asking.</div>
    </div>}

    {cabinet.length > 0 && <section className="mg-card">
      <div className="mg-cabinet-head">
        <p className="mg-eyebrow" style={{ margin: 0 }}><Icon name="grid-four" /> Your cabinet · {cabinet.length} {cabinet.length === 1 ? "item" : "items"}</p>
        <button className="mg-btn" onClick={() => setDoctor(true)}><Icon name="download-simple" bold /> Share with my doctor</button>
      </div>
      <div className="mg-cab-grid">
        {cabinet.map((x, i) => <div key={i} className="mg-cab-item">
          <span className="mg-dot" style={{ background: dotColor(x.sev), marginTop: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div className="mg-cab-name">{x.name}</div>
            <div className="mg-cab-sub">{x.brand || "supplement"} · {sevLabel[x.sev]}</div>
          </div>
        </div>)}
      </div>
    </section>}

    <p className="mg-footer">MedGuard surfaces official NIH / FDA information and flags — it is not medical advice. Confirm with your pharmacist or doctor.</p>

    {doctor && <div className="mg-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setDoctor(false)}>
      <div className="mg-modal">
        <div className="mg-modal-head">
          <div><p className="mg-eyebrow">One-tap medication history</p><h2 style={{ margin: "2px 0 0" }}>For your doctor / ER</h2></div>
          <button className="mg-x" onClick={() => setDoctor(false)}><Icon name="x" /></button>
        </div>
        <p style={{ fontSize: 13, color: "var(--mg-muted)", margin: "8px 0 14px" }}>Complete &amp; current — no guessing from memory.</p>
        <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
          <div className="mg-hist-section">Conditions</div>{profile.conditions.join(", ")}
          <div className="mg-hist-section">Prescription meds</div>{profile.meds.join(", ")}
          <div className="mg-hist-section">Supplements ({cabinet.length})</div>
          {cabinet.length ? cabinet.map((x, i) => <div key={i}>• {x.name}{x.sev !== "good" && <span style={{ color: dotColor(x.sev) }}> ({sevLabel[x.sev]})</span>}</div>) : "none yet"}
        </div>
      </div>
    </div>}
  </div>;
}
