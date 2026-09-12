# MedGuard — Research Report (for handoff / Codex)

> Consolidates the research behind every product decision. Each section states the finding and
> the sources. This is why MedGuard exists and why it should win. Pair with `DESIGN.md` (what/how).
> Note on method: web searches + the repo's own prior primary-source research
> (`the-missing-20/docs/research/`). Government API claims were verified with live calls (see §6).

---

## 1. Competition (Devpost "Agents for Humans")
- Deadline **2026-09-14 17:00 PT**. Judging Sep 15–Oct 8; winners ~Oct 14.
- Must be a **new Strands Agents SDK** project doing **real work end to end, "not just chat about it."**
- Required: English description, public repo (README + MIT/Apache license), architecture diagram,
  **≤5-min public YouTube/Vimeo video**, AWS Builder ID. Live demo optional but strengthens Technical.
- Stage One = pass/fail (theme + tool use). Stage Two = **5 equally-weighted** criteria: **Technical
  Implementation (also the first tiebreaker), Design, Potential Impact, Creativity & Originality,
  Presentation.** AgentCore deployment and/or a live demo strengthen Technical.
- Tracks: Everyday Agents / Professional Agents / Good Neighbor Agents. MedGuard fits **Everyday /
  Good Neighbor**.
- Sources: agentsforhumans.devpost.com + /rules (via the repo's verified requirement notes).

## 2. Prior AWS agent-hackathon winners — the pattern
From the official 2025 AWS AI Agent Global Hackathon winners (not this event, but the best comparators):
- **EcoLafaek (1st)** — user photo/GPS → Nova-Pro classification → specialized tools → an inspectable
  operational output. Lesson: **user-originated signal → specialized tools → concrete inspectable output.**
- **AegisAgent (2nd)** — evidence curation → cited decision packet → **pauses for missing evidence.**
  Lesson: cited decisions + fail-closed on missing evidence (MedGuard's fail-closed on no-imprint pills).
- **Province (3rd)** — documents → a concrete **21/21** form-mapping result. Lesson: one memorable
  quantified outcome; don't make judges read internals.
- **AI Multi-Agent Fraud Triage (Best AgentCore)** — multi-stage → durable structured artifact (SAR).
- **AgentShell (Best Strands)** — user-visible autonomous tool selection with observable effect.
- **Winning formula:** user-originated (often multimodal) signal → visible autonomous tool use →
  inspectable durable artifact + one memorable quantified impact; lead with the human, keep architecture
  behind the story. (MedGuard: scan → live tools → the recall catch + the one-tap doctor history.)
- Source: aws-agent-hackathon.devpost.com/updates/38140 + entrant Devpost pages.

## 3. Why NOT warehouse receiving (the original direction) — competitor/novelty risk
- "AI + ERP receiving/reconciliation" is **already a documented commercial direction**, so it is not
  novel: **Microsoft Dynamics 365 Procurement Agent** (extracts PO changes from supplier messages,
  bounded ERP actions) and **Oracle 26B Warehouse Operations Workspace** (inbound/outbound +
  recommendations). Microsoft is pushing agentic AI hard across Dynamics (Wave 1, "inventory to
  deliver" Feb 2026). Judges who know the space would see parity.
- The only defensible receiving angle was "cross-fragmented-system exception layer for SMBs" — real
  but still enterprise-flavored and not everyday/emotional.
- Sources: learn.microsoft.com/.../faq-supplier-communications-agent; Oracle 26B WOW readiness docs;
  erp.today Dynamics Wave 1; loganconsulting.com D365 agents landscape.

## 4. Everyday-scenario exploration (how we landed on the medicine cabinet)
The reusable "engine" = *snap/scan physical stuff → AI identifies/counts/inspects → reconcile against
records scattered across apps → catch problems + trace to source → proactive trend alerts → agent does
the tedious cross-app work, human approves → durable auditable record.* Candidates evaluated:
- Reseller/flipper cross-platform inventory (real pain: overselling across eBay/Poshmark/Mercari, 10
  min/item retyping) — strong map, but multi-platform niche + marketplace APIs are TOS-gated (can't be "real").
- Recycling/disposal, declutter (sell/donate/recycle/recall router), home inventory for insurance —
  relatable but lighter on the reconciliation/agentic core or on "real data".
- **Second-hand safety guardian** — recall/expiry/safety check on used goods (esp. baby gear). Real
  CPSC/FDA/NHTSA recall APIs; high emotion. Strong.
- **Medicine & supplement cabinet (CHOSEN)** — everyday, per-family, high-emotion, and it uniquely
  **preserves the "it's all real" moat** via free official APIs (§6). User's own framing sharpened it:
  people buy many supplements, don't know interactions, suitability for themselves, drug interactions,
  or dosage; most of the time they only have loose pills; and they need a per-user record = a one-tap
  medication history for the doctor.
- Sources: voolist.com / usernameinspector.com (reseller pain); tracextech.com / alfapeople.com
  (fragmented recall/traceability); a16z Top-100 consumer AI (underserved niches).

## 5. Medication problems are common AND high-impact (Potential Impact ammo)
- **Recalls (batch risk):** **>14,000 US drug recalls in 10 years — ~4 per DAY**; ~4,500 drugs/devices
  pulled per year. Real recent examples: ~23k bottles of generic acetaminophen recalled for a wrong ID
  code; bottles mislabeled with an Aspirin drug-facts label. → Consumers unknowingly hold recalled lots.
  (health.harvard.edu; drugwatch.com; thehealthy.com; aarp.org)
- **Interactions / polypharmacy (deadly):** a 2024 nationwide cohort of **2.69M** older adults on meds:
  **10.9% ED visits, 20.5% hospitalized, 1% died**; drug-related problems are a top cause of ED
  admission; polypharmacy strongly associated with drug–drug interactions (culprits: anticoagulants,
  antibiotics, antidiabetics, opioids). (frontiersin.org / PMC11322047; PMC10779430)
- **Duplicate ingredients:** acetaminophen hidden in many combination products → accidental overdose
  (4,500–6,000 mg/24h) → acetaminophen is a leading cause of acute liver failure. (FDA recall alerts)
- **Expired meds:** near-universal in home cabinets (well established).
- **Missing med history:** a top source of medical error at care transitions ("medication reconciliation"
  is a formal patient-safety process) → MedGuard's per-user DB + one-tap history directly addresses it.

## 6. Data-source feasibility — VERIFIED LIVE (the "real" moat)
All public, free, **no auth**; verified with live calls during development:
- **NIH DSLD (supplements)** — `https://api.ods.od.nih.gov/dsld/v9/search-filter?q=<q>&size=1` →
  `hits[0]._source`: `brandName`, `fullName`, `allIngredients[].name`. 200k+ labels. ✅ verified.
- **openFDA drug enforcement (recalls, LIVE)** —
  `https://api.fda.gov/drug/enforcement.json?search=product_description:<term>&sort=recall_initiation_date:desc&limit=1`.
  ✅ verified (e.g. a real Fish Oil recall 2025-10-10 CGMP; acetaminophen recalls). RES data 2004–present, weekly.
- **openFDA NDC (identify drugs)** — `https://api.fda.gov/drug/ndc.json?search=generic_name:<name>&limit=1`. ✅.
- **NIH ODS Upper Intake Levels (dosage)** — curate a small table (vit D, A, iron, zinc, E, niacin, B6).
- **Interactions** — ⚠️ no free official DDI API anymore: **NLM RxNav DDI retired 2024-01**; **DrugBank
  free DDI checker retiring 2026-03**. Options: a **curated high-value ruleset citing NIH ODS/NCCIH**
  (current approach), and/or **RxCheck** (drop-in NLM replacement; DDInter 2.0 + openFDA + ONC High-
  Priority). Honest-label curated rules. (dev.to NLM-DDI-gone; rxlabelguard.com; blog.drugbank.com)
- **Loose-pill identity** — FDA requires imprints on Rx/OTC; the govt pill-image DBs (**Pillbox, RxImage,
  C3PI**) are **all RETIRED (2018–2021)**; **"not possible to accurately identify a pill without an
  imprint"**, and supplements usually have NO imprint. → lead with bottle/barcode scan; **fail-closed**
  on no-imprint loose pills. (support.nlm.nih.gov; drugs.com/imprints; nlm.nih.gov RxImage bulletin)

## 7. The agentic thesis (why not "just ask GPT with a photo")
Official rules reward "real work end to end, not just chat." MedGuard beats a one-shot GPT photo on:
live authoritative grounding vs hallucination (GPT can't know last week's recall); whole-cabinet ×
profile memory over time; proactive continuous monitoring; real actions with human approval; fail-closed
safety on uncertain identity; auditable source citations. This is the core narrative + the demo's spine.

## 8. Key sources
Competition/winners: agentsforhumans.devpost.com(/rules); aws-agent-hackathon.devpost.com/updates/38140.
Competitors: learn.microsoft.com/dynamics365 procurement-agent FAQ; Oracle 26B WOW; loganconsulting.com.
Pain/prevalence: health.harvard.edu (recalls-are-common); drugwatch.com/fda/recalls; PMC11322047 &
PMC10779430 (polypharmacy ED/mortality); thehealthy.com & aarp.org (acetaminophen recalls);
consumerreports.org (used baby-gear recalls).
Data APIs: open.fda.gov/apis/drug (+/enforcement,/ndc); dsld.od.nih.gov/api-guide; ods.od.nih.gov;
dev.to "NLM Drug Interaction API is gone"; rxlabelguard.com; support.nlm.nih.gov (pill id);
drugs.com/imprints.php; nlm.nih.gov RxImage discontinuation bulletin.
```
