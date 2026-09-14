# MedGuard — Demo Video Script & Shot List

> Target: **≤ 5:00** (official cap), aim ~4:20. Public YouTube (mark "Not for Kids").
> Structure per Devpost guidance: hook in the first 60s, ~30% problem / ~70% solution+demo,
> show the app running on localhost (not slides), one clear narrative, cite the wins the judges
> score. Judging (5 equal criteria; **Technical Implementation is the tie-breaker**): Technical,
> Design, Potential Impact, Creativity & Originality, Presentation. AgentCore / live demo strengthen
> Technical. Lead with the human; keep architecture behind the story.
>
> Two visual modes: **[REMOTION]** = animated architecture/data-flow segment; **[SCREEN]** = real
> app on localhost:5173 (record with the backend live so tool calls are real); **[VO]** = voiceover.
> Keep the VO conversational and human — not a feature list.

---

## Timing map
| Segment | Time | Purpose | Judge criteria it earns |
|---|---|---|---|
| 1. Hook (the human problem) | 0:00–0:30 | Make them feel the pain | Potential Impact |
| 2. What it is (one line) | 0:30–0:45 | Frame the product | Design, Presentation |
| 3. Architecture (Remotion) | 0:45–1:35 | Prove it's a real agent | **Technical**, Creativity |
| 4. Live demo (localhost) | 1:35–3:45 | Show it working, end to end | Presentation, Design, Impact |
| 5. Why an agent, not a chatbot | 3:45–4:20 | Defensible originality | Creativity, Technical |
| 6. Close (back to the human) | 4:20–4:45 | Land the mission + the wins | Impact, Presentation |

---

## 1 · HOOK — the human problem · 0:00–0:30  [SCREEN b-roll / simple text]
**[VO]**
> "This is my mom's medicine shelf. Painkillers, a blood thinner, and a row of supplements she
> bought because a friend said they were good for her.
> Here's what nobody tells her: in the US there are about **four drug recalls every single day** —
> and she'd never know if one of these was pulled. She also has no idea whether these supplements
> are safe with her prescriptions. For older adults on several medicines, that confusion sends
> **one in ten to the emergency room.**"

**[ON-SCREEN TEXT]** `~4 recalls / day · 1 in 10 older adults on meds → ER`
**Shot:** a real cluttered medicine shelf / drawer (phone footage is fine). Warm, real, quiet.

---

## 2 · WHAT IT IS · 0:30–0:45  [SCREEN: MedGuard welcome screen]
**[VO]**
> "So we built **MedGuard** — a safety agent for your medicine shelf. You scan a bottle; it checks
> it against **live FDA and NIH data** and against the medicines you already take, and it tells you —
> in one glance — if something's worth a closer look."

**Shot:** MedGuard welcome screen (the 3 edges: live official sources / checked against your meds /
a note for your pharmacist). Tap **Try a sample profile** → warfarin + hypertension.

---

## 3 · ARCHITECTURE — prove it's a real agent · 0:45–1:35  [REMOTION]
**[VO]**
> "Under the hood, MedGuard is a real **Strands agent on Amazon Bedrock Nova Pro** — not a chatbot.
> When you scan a bottle, the agent **decides which tools to call** and runs four of them, live:
> it reads the label with Nova Pro vision, identifies the product in the **NIH supplement database**,
> checks the **openFDA recall feed**, screens **interactions** against your profile, and looks up
> **NIH dosage limits.**
> Here's the key design choice: **the model advises, the official data owns the truth, and you —
> with your pharmacist — make the decision.** If it can't read a label, it refuses to guess."

**[REMOTION animation beats]**
1. Phone → 📷 photo → **Nova Pro Vision** node lights up ("reads the label").
2. Central **Strands Agent (Bedrock Nova Pro)** node; four tool nodes fan out and light up in
   sequence with their live source badges:
   `identify_supplement · NIH DSLD` → `check_recall · openFDA (live)` →
   `check_interactions · cited rules` → `check_dosage · NIH ODS`.
3. Results converge → a structured verdict card.
4. A ribbon underneath: **"Model advises · Official data owns truth · Human decides · Fail-closed."**
5. Small tag: **"Deployable on Amazon Bedrock AgentCore Runtime."**

**On-screen labels must match the real app** (the app footer literally shows "4 actual tool calls ·
Strands · Amazon Bedrock").

---

## 4 · LIVE DEMO — real, on localhost · 1:35–3:45  [SCREEN — backend live, real tool calls]
Narrate as a person doing a real task. Let the real ~10s tool runs breathe (trim in edit).

**4a · Scan a bottle (0:15)**
**[VO]** "I just point my camera at the bottle."
**Shot:** tap **Scan a bottle** → upload/point at a real fish-oil bottle → the agent reads
`Fish Oil · Nordic Naturals` and auto-searches. **[TEXT]** `Nova Pro vision · live`

**4b · Confirm the label (0:10)**
**[VO]** "It pulls the real catalog entries — I pick the one that matches my bottle. A search hit
isn't your bottle, so a person confirms."
**Shot:** candidate list → tap **This matches my bottle**.

**4c · THE WOW — a real recall (0:30)**  ⭐ this must land before ~2:30
**[VO]** "Now watch this. I check my Moringa — and MedGuard flags it. Not from stale training data —
from the **live openFDA feed**: there's an **active recall for Salmonella** in a Moringa supplement.
It tells me to compare my lot. A chatbot trained months ago simply can't know this."
**Shot:** from the shelf or search, open **Moringa** → the amber/pulsing verdict card
**"Worth a closer look — an active recall matched this product (possible salmonella)…"**. Show the
"4 actual tool calls" trace.

**4d · Ask the agent (0:25)**
**[VO]** "If I want to understand it, I just ask. The agent answers from **this review's evidence**,
cites the source, and always points me to my pharmacist — it never tells me to start or stop a medicine."
**Shot:** tap **Ask the agent** → tap suggestion "Is this safe with my meds?" → real grounded answer.

**4e · The virtual shelf (0:25)**
**[VO]** "Everything I check lands on my shelf. MedGuard keeps watching — anything with a serious
active recall or an interaction with my meds gets a red flag, at a glance."
**Shot:** Cabinet → the shelf of bottle tiles; Moringa red **"Recall — compare lot"**, Fish Oil amber
**"Ask your pharmacist"** (warfarin interaction). Point out the pulsing dots.

**4f · One-tap pharmacist note (0:20)**  ⭐ the durable artifact
**[VO]** "And here's the payoff. One tap turns my whole shelf into a **dated, sourced note for my
pharmacist** — complete and current, instead of me guessing from memory at the counter."
**Shot:** **Pharmacist note** → the clean clinical handout (profile + products + sources). Print/download.

---

## 5 · WHY AN AGENT, NOT A CHATBOT · 3:45–4:20  [REMOTION or clean text over app]
**[VO]**
> "Why not just ask ChatGPT a photo? Because MedGuard does what a one-shot chatbot can't:
> it checks the **live** recall feed, it reasons over your **whole shelf and your conditions**,
> it **acts** — that pharmacist note — and it **fails closed** instead of guessing with your health.
> Every single flag opens the real NIH or FDA record behind it."

**[ON-SCREEN, four quick ticks]**
`Live official data ✓  ·  Whole-shelf memory ✓  ·  Real actions ✓  ·  Fail-closed + cited ✓`

---

## 6 · CLOSE — back to the human · 4:20–4:45  [SCREEN: shelf, then logo]
**[VO]**
> "MedGuard gives every family's medicine shelf a quiet guardian — one that knows the official data,
> and only asks you to call your pharmacist when it actually matters.
> Built with the **Strands Agents SDK on Amazon Bedrock**, grounded in **live openFDA and NIH data**,
> deployable on **AgentCore**, and fully open source. Thanks for watching."

**[END CARD]** `MedGuard · Strands Agents SDK · Amazon Bedrock (Nova Pro) · openFDA + NIH DSLD/ODS ·
github.com/danielwanwx/medguard`

---

## Production notes / checklist
- **Record with the backend running** (`server.py 8910` + AWS session live) so every tool call is
  real. Pre-run each demo step once to warm it and to confirm Moringa returns the ongoing recall
  that day (openFDA is live — verify the recall still appears before filming; if it changed, pick
  another product with a current recall).
- **Trim the ~10s agent waits** in edit; keep the on-screen tool-trace visible so it reads as real.
- **Do not overclaim**: recalls are "potential matches — compare your lot", not "your bottle is
  recalled"; interaction rules are a curated cited set; loose pills are refused. This honesty IS the
  differentiator — keep it in the VO.
- Talking-head optional; screen + confident VO is enough. Clean mic > everything.
- Captions/subtitles on (accessibility + judges often watch muted first).
- Keep it ≤5:00 hard. If long, cut segment 5 first, then tighten 4b/4e.
- Mention the **track**: Everyday Agents / Good Neighbor.

## Asset shot-capture list (I can auto-capture the [SCREEN] clips via the running app)
1. Welcome (3 edges) · 2. Sample profile toggle · 3. Scan-a-bottle reading a label ·
4. Candidate list + confirm · 5. Moringa verdict card (recall) + tool trace · 6. Ask-the-agent answer ·
7. Virtual shelf with red/amber flags · 8. Pharmacist note handout.
