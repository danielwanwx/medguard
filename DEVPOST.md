# MedGuard — Devpost submission content

Paste-ready content for the Devpost project. Keep everything truthful to what actually runs.
Track: **Everyday Agents / Good Neighbor**. Built with the **Strands Agents SDK** on **Amazon Bedrock**.

---

## Title
**MedGuard**

## Tagline (≤ ~1 line)
Your medicine & supplement safety agent — grounded in **live** FDA/NIH data. It catches the expired
bottle, the recalled lot, and the dangerous combination before you swallow it.

## Elevator pitch
Half of us have a drawer of supplements and meds and no idea if they're safe together — or if one was
just recalled. **MedGuard** is a Strands agent on Amazon Bedrock that scans your medicine shelf,
identifies each product from official databases, and cross-checks your **whole cabinet against your
health profile** for interactions, duplicate ingredients, suitability, dosage limits, expiry, and
**live recalls** — then gives you a one-tap medication history for your doctor. Unlike asking a chatbot,
MedGuard queries the **live openFDA recall feed** (a model trained months ago can't know last week's
recall), remembers your whole cabinet, monitors proactively, and cites every source.

## Inspiration
Drug recalls happen ~**4 times a day** in the US (14,000+ in a decade), and most people never find out
that a bottle in their cabinet is affected. For older adults on several medications, drug-related
problems send **10.9% to the ER and hospitalize 20.5%** (2024 cohort of 2.69M). Acetaminophen hidden in
combination products is a leading cause of accidental overdose and acute liver failure. And when you see
a new doctor or land in the ER, you're asked "what are you taking?" — and you guess from memory. We
wanted an agent that quietly does the safety work a pharmacist would, for everyone, using official data.

## What it does
- **Scan a bottle** → identifies it from the **NIH Dietary Supplement Label Database** (supplements) or
  **openFDA** (drugs), reading its real ingredients.
- **Cross-checks your whole cabinet × your health profile** (conditions + prescription meds) for:
  drug/supplement **interactions**, **duplicate/overlapping actives**, **suitability for you**,
  **dosage upper limits** (NIH ODS), **expiry**, and **live recalls** (openFDA).
- **Proactive alerts** — watches the live recall feed and warns you the moment something you own is
  recalled, without being asked.
- **One-tap medication history** for your doctor / ER — complete and current, no guessing.
- **Cites every source** and always says "confirm with your pharmacist or doctor." It surfaces official
  information and flags; it does not diagnose or prescribe.

## How we built it
- A **Strands Agents SDK** agent on **Amazon Bedrock (Nova Pro, `us.amazon.nova-pro-v1:0`)** that
  **autonomously calls real tools**: `identify_supplement` (NIH DSLD, live), `check_recall` (openFDA
  enforcement feed, live), `check_interactions` (curated, source-cited rules), `check_dosage` (NIH ODS
  Upper Intake Levels). The tools own the facts; the model orchestrates, explains, and cites.
- A small HTTP service exposes `POST /api/medcheck {scan, profile}`; a **mobile-first React (Vite)** UI
  renders the finding plus a **visible agent-workflow trace** with live-source badges.
- Architecture principle carried over from our prior project: **the model advises; official data owns
  the truth; the human/pharmacist decides.**

## Challenges we ran into
- **No free official drug-interaction API anymore** (NLM RxNav's DDI endpoint was retired in 2024;
  DrugBank's free checker is retiring in 2026). We use a small, high-value, **source-cited** interaction
  ruleset and label it honestly (RxCheck/DDInter is the path to scale).
- **Loose pills can't be reliably identified from a photo** (the US government pill-image databases —
  Pillbox/RxImage/C3PI — were all retired, and supplements usually have no imprint). So we **fail closed**:
  lead with scanning the bottle, and refuse to guess with someone's health.
- Keeping everything **real, not mock** — every identity and recall is a live official-data call.

## Accomplishments we're proud of
- It's **real end to end**: a Strands agent doing autonomous, cited, live-data tool use — not a chatbot.
- The **agentic advantage is obvious**: MedGuard catches a live recall a chatbot on stale data can't.
- A genuinely **useful, humane** product: the one-tap medication history alone can prevent ER errors.

## What we learned
- The winning move wasn't more model cleverness — it was **grounding an agent in live, authoritative,
  free official data** and being honest about limits (fail-closed identity, cited interaction rules).
- Everyday consumer safety is underserved by both enterprise AI suites and one-shot chatbots.

## What's next for MedGuard
Real camera bottle-scanning (Bedrock vision + expiry OCR); whole-cabinet duplicate/interaction
reasoning as the record grows; persistent per-user cabinet + profile; broader source-cited interaction
coverage (RxCheck/DDInter); caregiver sharing; and an Amazon Bedrock **AgentCore** deployment.

## Built With
`strands-agents` · Amazon Bedrock (Nova Pro) · AWS · Python · React · Vite · openFDA API ·
NIH DSLD API · NIH ODS · JavaScript

## Links to add
- **Repository:** https://github.com/danielwanwx/medguard
- **Video (≤5 min):** _add YouTube/Vimeo link_ — script: hook → profile → scan Fish Oil → live-recall
  catch (vs GPT) + interaction → proactive alert → one-tap doctor history → close.
- **Live demo / AgentCore:** _optional, strengthens Technical Implementation_
- **Architecture diagram:** see `architecture.md`
