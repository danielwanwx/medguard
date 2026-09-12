# MedGuard

**Your medicine & supplement safety agent — grounded in live FDA / NIH data.**

Scan the bottles in your medicine cabinet. MedGuard builds your authoritative medication +
supplement record and keeps you safe: it identifies each product from official databases,
cross-checks your **whole cabinet against your health profile** for **interactions, duplicate
ingredients, suitability, dosage limits, expired items, and live recalls**, proactively alerts
you the moment something you own is recalled, and gives you a **one-tap medication history for
your doctor or ER**. The model advises and cites official sources; **you and your pharmacist decide.**

Built for the [Agents for Humans](https://agentsforhumans.devpost.com/) hackathon with the
**Strands Agents SDK** on **Amazon Bedrock (Nova Pro)**.

> *"Don't ask an AI that guesses from last year's data. Run an agent that checks the live FDA
> recall feed, your whole cabinet, and your conditions — and acts for you."*

---

## Why an agent (not "just ask GPT with a photo")
The competition rewards agents that "do real work end to end, not just chat." MedGuard does what a
one-shot chatbot cannot:

1. **Live authoritative grounding vs hallucination** — a chatbot trained months ago can't know last
   week's recall. MedGuard queries the **live openFDA recall feed** and catches it.
2. **Whole-cabinet × profile memory** — it persists your record and re-checks every new item against
   your other meds/supplements and your conditions.
3. **Proactive monitoring** — it alerts you to a recall without being asked.
4. **Real actions + human approval** — drafts refills, returns, and a pharmacist note; you approve.
5. **Fail-closed safety** — it won't guess a loose, no-imprint pill; it won't invent a verdict.
6. **Auditable** — every flag cites its official source.

## Architecture
See [`architecture.md`](architecture.md). In short: a React UI → `POST /api/medcheck` → a Strands
agent (Bedrock Nova Pro) that **autonomously calls real tools**, each returning authoritative live data:

| Tool | Source (public, free, no auth) |
| --- | --- |
| `identify_supplement` | **NIH DSLD** Dietary Supplement Label Database (live) |
| `check_recall` | **openFDA** drug enforcement / recall feed (live) |
| `check_interactions` | curated, **source-cited** interaction ruleset (NIH ODS / NCCIH) |
| `check_dosage` | **NIH ODS** Tolerable Upper Intake Levels |

The model never invents ingredients, recalls, or verdicts — the tools own the facts.

## Quickstart

### 1. Backend (the real Strands agent)
Requires an AWS account with Bedrock access to Nova Pro (`us.amazon.nova-pro-v1:0`) in `us-west-2`.
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export AWS_PROFILE=<your-profile> AWS_REGION=us-west-2   # credentials must allow bedrock:InvokeModel
python server.py 8910          # POST /api/medcheck {scan, profile} -> finding + tool trace
```
Prove the data chain without the agent: `python core-chain.py`.

### 2. Frontend
```bash
cd ui
npm install
npm run dev                    # http://localhost:5173  (proxies /api -> :8910)
```
Open the app, then type or pick a supplement (Fish Oil, Ginkgo, St. John's Wort…) to watch the
agent call its live tools and surface the finding. If the backend is offline the UI degrades gracefully.

## Example (real, live)
Profile: **warfarin + hypertension**. Scan **Fish Oil** →
- **Identified** via NIH DSLD (EPA/DHA).
- **LIVE RECALL** found on the openFDA feed (a chatbot on stale data can't know this).
- **HIGH interaction** — omega-3 with warfarin increases bleeding risk (source: NIH ODS).
- Grounded, cited answer ending "Confirm with your pharmacist or doctor."

## Docs
- [`DESIGN.md`](DESIGN.md) — full product / UX / data / agent design.
- [`RESEARCH.md`](RESEARCH.md) — the research + sources behind every decision.

## Safety & honest boundaries
MedGuard **surfaces official NIH/FDA information and flags — it is not medical advice.** It does not
diagnose or prescribe; always confirm with your pharmacist or doctor. Product identity and recalls are
live official data. The interaction ruleset is a small, high-value, source-cited set (there is no free
official drug-interaction API since NLM RxNav's was retired in 2024) and is labeled as such. Loose pills
without an imprint cannot be reliably identified from an image, so MedGuard fails closed and asks you to
scan the bottle.

## License
[MIT](LICENSE).
