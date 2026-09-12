# MedGuard — Design Document (for handoff / Codex)

> Detailed product, UX, data, and agent-architecture spec. Pair with `RESEARCH.md`
> (why), the repo-root `HANDOFF.md` (how to continue), and the memory files.
> Everything below reflects what is BUILT + the intended full design.

---

## 1. Product overview
**MedGuard** — a personal medicine & supplement **safety agent** for everyday people.
You scan the bottles in your medicine cabinet; MedGuard builds your authoritative
medication + supplement record and continuously keeps you safe:

- **Identifies** each product from official databases (NIH DSLD for supplements, openFDA for drugs).
- **Cross-checks the WHOLE cabinet × your health profile** for: drug/supplement **interactions**,
  **duplicate/overlapping active ingredients**, **suitability for your conditions**, **dosage
  upper limits**, **expired** items, and **live recalls**.
- **Proactively alerts** you the moment something you own is recalled (watches the live openFDA feed).
- **One-tap medication history** to hand to any doctor / ER — complete and current, no memory-guessing.
- **Drafts actions** (refill, return a recalled lot, a pharmacist note) — you approve.
- **Boundary:** surfaces official NIH/FDA info + flags with citations; it does **not** diagnose or
  prescribe. "Confirm with your pharmacist or doctor."

**Target user / "the human":** anyone managing a shelf of supplements + meds — especially people
caring for elderly parents on many meds, and anyone who takes supplements without knowing the
interactions. Competition track: **Everyday Agents / Good Neighbor**.

**One-liner:** *"Scan your medicine shelf. Your agent catches the expired bottle, the recalled lot,
and the dangerous combination before you swallow it."*

## 2. Positioning & differentiation (see RESEARCH.md §7)
Two competitors to beat:
- **Enterprise suites (Microsoft Dynamics Procurement Agent, Oracle Warehouse Ops)** — they own
  "AI + ERP receiving". We deliberately are NOT that. Everyday consumer safety avoids them entirely.
- **"Just ask GPT with a photo"** — the real threat. MedGuard's agentic advantages (SHOWCASE these):
  1. **Live authoritative grounding vs hallucination** — GPT can't know last week's recall; we query
     the LIVE openFDA feed. (Killer demo: GPT says "looks fine"; MedGuard catches the recall.)
  2. **Whole-cabinet × profile memory over time** — one photo can't; we persist state and re-check
     every new item against the whole set + your conditions.
  3. **Proactive continuous monitoring** — alerts without being asked.
  4. **Real actions + human approval** — drafts/files/reminds, not just text.
  5. **Fail-closed safety** — won't guess a loose no-imprint pill; won't hallucinate a verdict.
  6. **Auditable** — every flag cites its official source + your record.
- Official rules literally reward this: "do real work end to end, **not just chat about it**."

## 3. Agent architecture (model advises / official data owns truth / human decides)
- **Strands Agents SDK** agent (Bedrock Nova Pro `us.amazon.nova-pro-v1:0`) with **real tools**.
  The agent AUTONOMOUSLY selects and calls tools (visible "agent workflow" trace); the TOOLS return
  authoritative live data — the model never invents ingredients, recalls, or verdicts.
- **Tools** (`medguard/agent.py`):
  - `identify_supplement(query)` → **NIH DSLD** live → brand, name, ingredient list.
  - `check_recall(product)` → **openFDA drug enforcement** live → most recent recall (date/reason/status).
  - `check_interactions(ingredients, profile)` → **curated, source-cited ruleset** (each rule cites
    NIH ODS / NCCIH). Deterministic; the verdict is not the model's opinion.
  - `check_dosage(ingredients)` → **NIH ODS Tolerable Upper Intake Levels** table.
- **System prompt** forces the order (identify → recall → interactions → dosage), grounds every
  statement in tool results only, requires source citations, and always ends "Confirm with your
  pharmacist or doctor." No diagnosis/prescription.
- **Backend** `medguard/server.py` — `POST /api/medcheck {scan, profile}` → runs the agent →
  returns `{answer, tools, identity, recall, interactions, dosage, tool_trace}`.
- **Persistence (next):** the per-user cabinet + profile in **real Airtable** (reuse the existing
  Airtable adapter/creds). This is the "spine" that enables whole-cabinet checks + the doctor export.
- **AWS:** creds via `~/.aws` profile `missing20-sandbox`, us-west-2, account 523356960326. The
  custom login session expires (re-run the user's `aws login` when Bedrock returns an auth error).

## 4. Data model
```
HealthProfile { meds: string[], conditions: string[], allergies: string[], pregnancy?: bool, age?: int }
CabinetItem   { name, brand, ingredients: string[], severity: "recall"|"high"|"warning"|"good",
                addedAt, source: "DSLD"|"openFDA", expiry?, recall?: {date,reason,status} }
Finding (per scan) {
  identity: { source:"NIH DSLD (live)", brand, name, ingredients[] }
  recall:   { source:"openFDA enforcement (live)", recalled:bool, date, reason, status }
  interactions: [{ risk:"HIGH"|"MODERATE", note, source, against }]
  dosage: [{ ingredient, upper_limit, source }]
  answer: string   // grounded, cited, ends with "confirm with pharmacist"
  tools: int, tool_trace: [{tool, result}]
}
InteractionRule { drugOrConditionKeys[], ingredientKeys[], risk, note, source }  // curated, cited
```
**Severity** = recall (any live recall) > high (any HIGH interaction) > warning (MODERATE) > good.

## 5. UX — screens, components, states
Single-page app (`medguard/ui/src/App.jsx`), mobile-first. Components:
- **Header** (`.mg-header`): shield mark + "MedGuard" wordmark + tagline "grounded in live FDA/NIH data".
- **Health profile** (`.mg-profile`): chips for meds (blue) + conditions (amber) + hint "drives every
  'is it safe for you' check". (Next: make editable / onboarding to input conditions/meds/allergies.)
- **Scan card** (`.mg-card` + `.mg-scan-row`): text input ("scan a bottle" — real vision next) +
  **Check** button + preset chips (Fish Oil, Ginkgo, St. John's Wort, Vitamin K, Turmeric).
- **Agent workflow trace** (`.mg-trace-box`): as the agent runs, each tool appears with a green
  check + a **live-source badge** ("NIH DSLD · live", "openFDA · live", "cited rules", "NIH ODS").
  This is THE agentic-visibility (the anti-"chatbot" signal). Steps reveal progressively while busy.
- **Agent finding** (`.mg-card` + `ResultCard`): product name/brand + severity pill; then, in order:
  - **LIVE RECALL banner** (`.mg-banner`, red) with the GPT-can't-know-this note — the killer moment.
  - **Interaction rows** (`.mg-inter`, red=HIGH / amber=MODERATE) "vs your <med/condition>" + source.
  - **Ingredients** line (from DSLD).
  - **Agent answer** (`.mg-answer`) with the green "● Real Strands agent · N live tools" badge.
- **Proactive alert** (`.mg-banner`): if any cabinet item has a live recall — "caught it without you asking".
- **Cabinet** (`.mg-card` + `.mg-cab-grid`): each scanned item with a severity dot + "Share with my
  doctor" button.
- **Doctor modal** (`.mg-modal`): one-tap medication history — Conditions / Rx meds / Supplements
  (with severity), "complete & current, no guessing".
- **Footer**: the not-medical-advice disclaimer.
- **States:** idle → busy (trace animates, spinner) → result (finding + cabinet update) →
  backend-unavailable (graceful message; happens when the AWS session expired — re-auth + restart server).

## 6. Design system (`medguard/ui/src/medguard.css`)
- **Tokens** (CSS vars): bg `#f6f8f6`, surface white, green `#1f9d55` (+ ink `#0f2e1c`, soft `#eef9f0`),
  red `#e5533c`, warn `#e0a020`, blue `#2c5aa0`; neutrals ink/muted/faint/line; radius 16; soft shadow.
- **Type:** Geist (loaded via styles.css @font-face) + Phosphor icons (`.ph`/`.ph-bold` + `ph-<name>`).
- **Color semantics:** green = clear/live-source-ok; amber = caution/MODERATE; red = recall/HIGH.
- **Responsive:** max-width 940 centered; `@media (max-width:640px)` stacks the scan row, makes
  buttons full-width, collapses the cabinet grid to 1 column, stacks the finding head. `overflow-x:hidden`
  guard on html/body. Verified no horizontal overflow at 390px (mobile) and desktop.
- All layout uses `mg-` prefixed classes (no dependency on the old receiving-app classes except
  the fonts + icon glyphs it defines).

## 7. Demo / video narrative (≤5 min)
1. **Hook (human):** "Do you know if your supplements are safe together — and if any was just recalled?"
2. **Profile:** one-time — warfarin + hypertension.
3. **Scan Fish Oil:** watch the AGENT WORKFLOW call 4 live tools (visible, cited).
4. **Killer contrast:** LIVE RECALL caught from openFDA (GPT can't know) + HIGH interaction vs your warfarin.
5. **Proactive:** the recall alert that fired without asking.
6. **One-tap doctor history:** the medication reconciliation payoff.
7. **Close:** "Don't ask an AI that guesses from last year's data. Run an agent that checks the live
   FDA feed, your whole cabinet, and your conditions — and acts for you."

## 8. Status & roadmap
- ✅ Core real chain proven (`medguard-core-chain.py`).
- ✅ Real Strands agent + 4 real tools + HTTP endpoint (`medguard/agent.py`, `medguard/server.py`).
- ✅ Mobile-first UI (`medguard/ui/`), responsive-verified, graceful fallback.
- ⏳ Next: real vision scan (reuse Nova `photo_receiving`), whole-cabinet cross-check (new item vs
  existing items — duplicates/supp-supp), Airtable persistence (confirm before writing to real base),
  editable profile/onboarding, more curated interaction rules, AgentCore deploy, the video.

## 9. Safety & honest constraints
- Not medical advice; surfaces official data + flags; human/pharmacist decides.
- Curated interaction rules are a small high-value set, each citing a source; they are NOT a complete
  DDI database (no free official DDI API since RxNav DDI retired 2024-01). Label as such.
- Loose no-imprint pills cannot be reliably identified by vision → fail-closed "scan the bottle".
- Recalls/identity are LIVE official data; never fabricate them.
```
