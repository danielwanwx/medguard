# MedGuard competitor research and product decisions

Research date: 2026-09-12. This is a primary-source feature comparison, not a hands-on review of paid competitor apps or a clinical efficacy study. “Not documented on the reviewed page” does not mean a competitor lacks a feature.

## The defensible position

**A supplement-cabinet review you can take to your pharmacist: confirm the label, inspect the evidence, keep a dated record.**

The differentiation is the deliberately bounded workflow and inspectable record. Live search, medication memory, interaction warnings, proactive reminders and doctor sharing are not individually novel. MedGuard must earn an advantage through correct product matching, explicit coverage, transparent tool results and a usable handoff. The baseline does not yet earn it; see [EVALUATION.md](EVALUATION.md).

## Competitors

| Product | Verified capability | Limit of this comparison / user problem left open | MedGuard response |
|---|---|---|---|
| Medisafe | Medication reminders, pillbox management and caregiver support. Its published interaction feature checks new medication against the virtual pillbox and alerts on severe/major interactions. | Established adherence and interaction product. Reviewed public material does not establish exact supplement-label-to-FDA-lot matching or expose its internal evidence chain. Do not describe it as “just reminders.” | Do not compete on reminders. Show the exact catalog label, FDA record description/lot/status, and curated rule sources in a review packet. |
| MyTherapy | Reminders, intake documentation, supply/refill tracking, measurements and symptom diary. A one-time code shares medication plans and health reports with doctors. | Doctor sharing and longitudinal records are already available. Public feature page does not establish the proposed official-source recall-review flow. | Treat the doctor note as necessary utility, not an invention. Include uncertainty, when checks ran and source links alongside the user's list. |
| Drugs.com / pill identifier apps | Drugs.com offers imprint/color/shape lookup, drug/NDC search, interactions and personal medication records. It explicitly says a pill without an imprint cannot be reliably identified online. | Image appearance alone remains insufficient. A returned catalog match still needs product verification. Other AI-scanner app-store listings are marketing claims, not accuracy evidence. | Refuse loose-pill guessing and require bottle-label confirmation. Do not imply a text field is a camera. |
| “Ask ChatGPT a photo” / ChatGPT Health | ChatGPT Health supports connected health information, medical records and appointment preparation. OpenAI's healthcare tooling also documents cited clinical/public-data search. | The claim that ChatGPT can only use stale training data is false. This research did not benchmark a configured ChatGPT workflow against MedGuard. | Compare a reproducible, constrained cabinet-review workflow against the effort of assembling one in an open-ended conversation. Do not claim exclusive access to live data or personal context. |
| CARE (`care.health`) | Consolidates health results and biomarkers, specialist reports, personalized goals and an AI health coach. | “CARE” is ambiguous: care.ai is a different care-facility platform and CareAI is another family-care product. We evaluate the named URL, not an imagined unified competitor. | Keep MedGuard's scope on supplement labels and pharmacist review, rather than broad biomarker optimization. |
| Sesame (`sesamecare.com`) | Its app supports provider chat/video and prescription management. | The reviewed official page does not support calling it an autonomous AI medication checker. It offers access to human care that MedGuard does not. | Prepare useful questions and a record for a clinician; never imply replacing the clinician. |

Sources: [Medisafe app listing](https://play.google.com/store/apps/details?id=com.medisafe.android.client&hl=en_US), [Medisafe interaction feature](https://medisafe.com/news-events/medisafe-launches-feature-to-alert-users-of-potentially-harmful-drug-interactions), [MyTherapy features](https://www.mytherapyapp.com/), [Drugs.com pill identifier](https://www.drugs.com/imprints.php), [ChatGPT Health launch](https://openai.com/index/health-in-chatgpt/), [ChatGPT for Healthcare](https://help.openai.com/en/articles/20001046), [CARE app](https://care.health/ch-en/app/), [Sesame app](https://sesamecare.com/download-mobile-app).

## Differentiation claims: what is real and what must be earned

| Candidate claim | Assessment | Proof required before using it |
|---|---|---|
| Live official data | Real public APIs; not exclusive. Live retrieval does not make a wrong match correct, and FDA feeds have update lag. | Dated query URLs, source metadata and correct product scope; separate unavailable from no-match. |
| Whole cabinet × profile | Valuable, but baseline sends only one item's ingredients plus a fixed profile. | Persist confirmed catalog IDs, re-fetch trusted ingredients and test duplicate/interaction cases across items. Until then describe individual checks and a saved list. |
| Proactive monitoring | Baseline banner is not monitoring. Reminder apps already provide proactive behavior in their own domains. | A running scheduler with persisted watched items, last successful check, change detection and explicit notification behavior. No claim of instantaneous FDA updates. |
| One-tap doctor history | Useful; MyTherapy already provides this. Baseline modal has no export or durable data. | A downloadable, dated, user-reviewed note with provenance and unknown fields, not a claim of complete medical history. |
| Fail-closed identity | Appropriate safety boundary; not unique. Baseline does not enforce it. | Loose/unknown pill refusal; candidate confirmation and incomplete-result handling tested. |
| Visible agent tools | A strong hackathon demonstration if truthful. | Only actual tool executions, request-local traces and clearly distinguished live APIs versus curated references. |

**Pitch to use after fixes are verified:** “MedGuard helps you prepare a better supplement conversation with your pharmacist. Choose the label that matches your bottle, let a Strands agent gather official records and cited reference flags, then keep the evidence with your cabinet list.”

**Claims to retire:** “GPT can't know this”; “you're protected”; “complete and current medical history”; “4 live tools” when two are curated; “active recall” for a broad or terminated match; “no interactions” when no small-rule match was found; prevention/outcome percentages without a study of MedGuard.

## Consumer design references → concrete UI decisions

| Reference | Observed principle | MedGuard application |
|---|---|---|
| [Duolingo core-tab redesign](https://blog.duolingo.com/core-tabs-redesign/) | Consistent navigation and deliberate visual craft make separate screens feel like one product. | Three stable destinations: Check, Cabinet, Profile. Large friendly headings, generous spacing, a single primary action per step. Use our own artwork and identity. |
| [Headspace](https://www.headspace.com/) | Benefits are expressed in ordinary human language; the site groups choices around user needs. | Lead with getting clarity about a bottle. Put source details behind progressively disclosed evidence, without hiding risk or uncertainty. Warm cream, forest green, muted peach and clear caution colors. |
| [Finch first-use guide](https://help.finchcare.com/hc/en-us/articles/42149821015693-New-User-Guide) | Small guided steps help users begin; encouragement is tied to completed actions. | Celebrate “Added to your list” or “Note ready,” never “safe to take.” Offer a labeled synthetic example as a separate onboarding choice. |
| [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) | Accessible modal focus handling and Escape behavior are provided by a maintained primitive. | Use Radix primitives for the doctor note and disclosures, Lucide for icons, shared CSS tokens and a consistent type/spacing scale. Preserve the existing CSS approach; a second styling framework is unnecessary. |

Suggested flow: welcome → profile → product text lookup → confirm a catalog label → real agent check → evidence/next question → explicitly save to cabinet → download pharmacist note. Allow profile edits and a new check without trapping the user in onboarding. An error offers retry and preserves input. No hidden synthetic records, timers pretending to be tool completion, or automatically claimed safety.

## Method, contradictions and confidence

Research Engine ran first from its canonical checkout with `--pack auto --depth deep --report-mode summary`. The sandbox DNS preflight failed, so the same network-backed collection used approved execution. Run ID: `2026-09-12-compare-medisafe-mytherapy-drugs-com-pill-identifier-chatgpt-hea` (full local artifacts under `/tmp/medguard-research-runs/`). The saved summary/quality files are in [docs/research](docs/research/).

The runtime reported `complete_with_warnings`: 66 raw rows in the run output, 110 rows after evidence processing, 55 unique/eligible rows, 47 discovery-only exclusions and 8 invalid rows. It reported **zero supported claim buckets**, missing generic facets, substantial duplicate pressure and one generic directional-word conflict. Those are not a validated competitor conclusion. The “growth” conflict mixes unrelated medical/product text and cannot establish a market trend. Competitor-authored rankings and their favorable “high” tier were not treated as independent proof.

Primary-source pages above were then independently opened with the web tool to verify the relevant claims and fill gaps in CARE, Sesame, ChatGPT and design coverage. These are **manual source checks**, not claims certified by the Engine. The strongest contradiction to the old brief is direct: Medisafe already has interactions; MyTherapy already has doctor sharing; ChatGPT Health already has personal health context. High confidence in those advertised capabilities; medium confidence in the proposed workflow opportunity; low confidence in exclusivity or a clinical-outcome advantage. No unobserved competitor weakness is asserted as fact.
