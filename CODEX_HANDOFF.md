# CODEX HANDOFF — MedGuard (read this first, in full)

You are taking over **MedGuard**, an entry for the Devpost **"Agents for Humans"** hackathon
(deadline **2026-09-14 17:00 PT**). This project was **ported from a prior project, "The Missing 20"**
(a warehouse-receiving agent). We deliberately pivoted to an everyday, high-emotion, real-data
consumer agent. **Follow the same working standards, patterns, and discipline as The Missing 20**
(model-advises / official-data-owns-truth / human-decides; real end-to-end, not mock; honest
labeling; cite sources; verify with live calls). **Move fast and get it fully working ("快速打通").**

Read, in order: `README.md`, `DESIGN.md`, `RESEARCH.md`, `architecture.md`. Then do the work below.

---

## YOUR JOB, IN ORDER

### Step 1 — Be a STRICT award judge first. Full end-to-end test + scored evaluation.
Before changing anything, **run the whole thing end to end as a demanding hackathon judge** and
produce a written evaluation:
- Start the backend (`server.py`, needs AWS Bedrock — see "Run" below) and the frontend (`ui/`).
- Drive the real flow (profile → scan Fish Oil / Ginkgo / St. John's Wort → recall + interactions →
  cabinet → one-tap doctor history). Use a headless browser to click and screenshot each state.
- **Score against the 5 equally-weighted official criteria** (Technical Implementation [tiebreaker],
  Design, Potential Impact, Creativity & Originality, Presentation). For each: what's strong, what a
  judge would criticize, and the concrete fix. Verify: real Strands tool-use is visible; data is live
  and cited; no mock leaks; the agentic-vs-GPT advantage is obvious; mobile + desktop both clean.
- Output a prioritized **defect + gap list** (bugs, data mismatches, UX rough edges, missing pieces).

### Step 2 — Research competitors, find problems, find solutions.
- Research existing medication/supplement apps and AI health assistants (e.g. Medisafe, MyTherapy,
  CARE, Sesame, pill-ID apps, "ask ChatGPT a photo"). Identify what they do, where they're weak, and
  where MedGuard's **agentic + live-official-data + whole-cabinet + proactive + one-tap-doctor-history**
  is genuinely differentiated. Feed findings back into positioning, the UI, and the pitch.
- Keep our moat sharp: live openFDA recall grounding (a chatbot on stale data can't match), whole-cabinet
  × profile reasoning, proactive monitoring, fail-closed safety, cited sources. See `RESEARCH.md`.

### Step 3 — Refactor the frontend to a high-craft, CONSUMER (C-end) app.
The current UI works and is mobile-responsive, but it still **feels too B2B/dashboard-y**. Real
consumers want a **simple, friendly, app-like** experience.
- **Redesign to a delightful consumer app aesthetic.** Reference **Duolingo** (and research other
  best-in-class consumer health/wellness apps) for tone: big friendly typography, generous spacing,
  playful-but-trustworthy color, clear one-thing-per-screen flows, satisfying micro-interactions,
  progress/streak/"you're protected" reinforcement, an onboarding for the health profile, and a
  bottom-nav / card-stack "app" feel rather than a data dashboard.
- **Raise the visual bar.** Use a real component/design system and external inspiration (Figma
  community kits, shadcn/ui or Radix + Tailwind, Lucide/Phosphor icons, a proper type scale). Refactor
  or rebuild components that don't meet a high aesthetic standard. Keep it **mobile-first** (this is a
  phone app people use at their medicine cabinet).
- **Think like a real user, not a developer.** Reduce cognitive load; make "scan → is it safe for me"
  the hero; make the recall alert and the one-tap doctor history feel emotionally reassuring; make
  severity obvious at a glance.
- **Non-negotiable: keep the backend wired.** Whatever you redesign, the UI MUST keep calling the real
  agent (`POST /api/medcheck`) and render real data (identity/recall/interactions/dosage + the visible
  agent-tool trace + source badges). Do not turn it back into a static mock. If you change the shape of
  the data, update `server.py`/`agent.py` accordingly and keep it real.

### Step 4 — Rebuild the Devpost submission around the current project.
Fully update the Devpost content (title, tagline, description, Built With, images, architecture,
repo link, video plan) to MedGuard using `DEVPOST.md` as the source of truth. The old "The Missing 20"
content must be replaced. Keep everything truthful to what actually runs.

---

## RUN / TECHNICAL REFERENCE
- **Backend:** `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`;
  then `AWS_PROFILE=<profile> AWS_REGION=us-west-2 python server.py 8910`. Needs Bedrock access to
  `us.amazon.nova-pro-v1:0`. The dev machine uses a custom `aws login` whose session expires — if
  Bedrock returns "session expired", the user must re-run `aws login` in a real terminal (interactive;
  it needs a TTY and a region). `core-chain.py` runs the data chain WITHOUT AWS (DSLD+openFDA+rules).
- **Frontend:** `cd ui && npm install && npm run dev` (Vite :5173, proxies `/api` → :8910).
- **Agent:** `agent.py` — Strands `Agent` + `BedrockModel(us.amazon.nova-pro-v1:0)` + 4 `@tool`s
  (identify_supplement/DSLD, check_recall/openFDA, check_interactions/curated-cited, check_dosage/ODS).
  Tools return authoritative live data; the model orchestrates + explains + cites; ends "confirm with
  your pharmacist/doctor." `TOOL_TRACE` powers the visible agent-workflow UI.
- **Real data (public, no auth, verified live):** NIH DSLD `api.ods.od.nih.gov/dsld/v9/search-filter`;
  openFDA `api.fda.gov/drug/enforcement.json` & `/drug/ndc.json`. No free official DDI API (RxNav DDI
  retired 2024) → curated cited interaction rules (or wire RxCheck/DDInter). See `RESEARCH.md` §6.
- **Reuse source (NOT submitted):** the original `../Agents-for-Humans/the-missing-20` has the vision
  engine (`agents/photo_receiving.py`, `scripts/photo_receiving_probe.py`) to add REAL bottle-label /
  expiry scanning, and a real Airtable adapter to persist the per-user cabinet DB. Its memory files
  (`~/.claude/projects/-Users-danielwan-Documents-Hackathon-Agents-for-Humans/memory/`) hold the full
  decision history.

## NEXT FEATURES (after the judge pass + refactor)
Real vision scan (Nova, from photo_receiving); whole-cabinet cross-check (new item vs existing items —
duplicate actives, supp-supp interactions); Airtable persistence of the cabinet+profile (confirm before
writing to the user's real base); editable profile/onboarding; more curated interaction rules;
AgentCore Runtime deploy (strengthens Technical); the ≤5-min video.

## GUARDRAILS
- Not medical advice; surface official data + flags; human/pharmacist decides. Keep the disclaimer.
- Never fabricate recalls/identity/interactions — live official data or source-cited rules only.
- Fail closed on uncertainty (no-imprint loose pills → "scan the bottle").
- Keep it truthful to what runs; label any synthetic/curated data. Don't delete the reuse source.
