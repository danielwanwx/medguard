# MedGuard research and evidence

Updated 2026-09-12. This replaces the initial hypothesis-driven notes, which mixed intended features with shipped behavior and misidentified a Fish Oil recall. Git history preserves those earlier notes; they are not current pitch copy.

## Competition

[Official rules](https://agentsforhumans.devpost.com/rules): five equally weighted criteria—Technical Implementation, Design, Potential Impact, Creativity & Originality, Presentation—with Technical Implementation the first tiebreaker. Deadline is 2026-09-14 17:00 Pacific. Required submission materials include the public repository, architecture and a public YouTube/Vimeo demo of at most five minutes. An appealing everyday topic does not substitute for technical depth or proof that the work runs.

## Competitors and consumer design

[COMPETITORS.md](COMPETITORS.md) is the current detailed comparison. It covers Medisafe, MyTherapy, Drugs.com pill identification, ChatGPT Health, CARE and Sesame, with source-level capability limits. It also translates Duolingo, Finch and Headspace design principles into this app.

Medisafe already advertises interactions, supplement support and reporting. MyTherapy supports reminders and doctor reports. ChatGPT Health supports personal context; modern chat tools can search current sources. Consequently, neither live queries nor a shareable list is a unique moat. Proposed differentiation: explicit supplement-label selection, evidence provenance, bounded failure semantics and a dated pharmacist handoff. This is a positioning hypothesis, not a demonstrated clinical or competitive advantage.

The research-engine run is disclosed in `docs/research/engine-summary.json` and `engine-quality.json`. Its retrieval output did not produce a sufficiently supported synthesis; the comparison was verified separately against primary product pages. We do not treat retrieval counts as validated claims.

## Live source feasibility and matching limits

| Source | What was verified | Interpretation |
|---|---|---|
| [NIH DSLD](https://dsld.od.nih.gov/) and [live search](https://api.ods.od.nih.gov/dsld/v9/search-filter?q=fish%20oil&size=5) | Real catalog labels, brands and ingredient names | Catalog candidates require user confirmation; no bottle authentication or clinical verification |
| [FDA food enforcement](https://open.fda.gov/apis/food/enforcement/) | Quoted Fish Oil search returns historical product/lot records | Supplements need food as well as drug feed coverage |
| [FDA drug enforcement](https://open.fda.gov/apis/drug/enforcement/) | Original unquoted query returned an unrelated tea-tree balm | Official records can still be attached to the wrong product by bad search logic |

[EVALUATION.md](EVALUATION.md) preserves the exact counterexample: D-0185-2026 was Doctor D. Schwab Controlling Balm with Tea Tree Oil, not Fish Oil. The corrected food query returned H-0589-2025 and other historical records labeled **Terminated**. The repair preserves that status and says potential matches, never that a user's bottle is recalled. An explicit API no-match remains different from a failed request, and neither establishes safety.

This version searches a bounded number of results for an exact phrase. It is not exhaustive recall surveillance or lot matching. Live API availability is separately verified from authenticated Bedrock execution.

## Curated clinical references

These primary references inform a limited app ruleset. The app's review priorities are not official severity ratings, and no clinician validation or outcome study has been performed.

- [NIH ODS Omega-3](https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/#h8): warfarin review must reflect mixed evidence and monitoring context; the original blanket HIGH verdict was too strong.
- [NCCIH Ginkgo](https://www.nccih.nih.gov/health/ginkgo): medication interaction concerns support a pharmacist review prompt.
- [NCCIH St. John's Wort](https://www.nccih.nih.gov/health/st-johns-wort-and-depression-in-depth): warfarin effects can be weakened; antidepressant interactions also warrant review.
- [NIH ODS Vitamin K](https://ods.od.nih.gov/factsheets/VitaminK-HealthProfessional/) and [Vitamin E](https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/): formulation, amount and medication context matter.
- [NCCIH Licorice Root](https://www.nccih.nih.gov/health/licorice-root): blood-pressure effects and medication context support a bounded prompt.

Adult reference limits cite ODS fact sheets for [Vitamin D](https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/), [Vitamin A](https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional/), [Iron](https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/), [Zinc](https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/), [Vitamin E](https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/), [Niacin](https://ods.od.nih.gov/factsheets/Niacin-HealthProfessional/), and [Vitamin B6](https://ods.od.nih.gov/factsheets/VitaminB6-HealthProfessional/). B6 must distinguish the US FNB reference from the lower EFSA adult limit reported by ODS. These tables do not measure the user's dose, account for diet/other products or establish a personal safe amount.

## Decisions from the evidence

1. Keep identity confirmation before checks and before saving.
2. Display explicit incomplete/unavailable states; never derive reassurance from absent data.
3. Keep model orchestration real while removing unrestricted factual prose from the authoritative result.
4. Show live API calls separately from curated references.
5. Persist a dated browser record and disclose what is transmitted; do not imply a cloud account or monitoring.
6. Prefer a directly sourced interaction scenario for the video over an unreliable recall “catch.”
7. Keep camera scanning, whole-cabinet interaction reasoning and proactive monitoring on the roadmap until each exists and is verified.

We removed unsourced prevalence figures and claims that the app prevents ER errors, continuously protects people, or is inherently more novel than enterprise agents. Impact and novelty need evidence, whichever problem domain is chosen.

## Deadline choice: MedGuard versus The Missing 20 / LogisticPilot

This is a dated internal judgment, not a prediction of judges' votes. MedGuard's final local flow is newly verified in [ACCEPTANCE.md](ACCEPTANCE.md). The prior project's comparison is based on its [September 11 authoritative finalization ledger](https://github.com/danielwanwx/the-missing-20/blob/main/docs/submission/finalization-tracker.md), not a new runtime test in this MedGuard session.

| Consideration | MedGuard | The Missing 20 / LogisticPilot |
| --- | --- | --- |
| Immediate human story | Familiar supplement-and-medicines question; easy consumer entry | Requires explaining the receiving/quality/fulfillment exception |
| Agent workflow evidence | Real but constrained label lookup and four-tool review | Deeper same-case ERP and external-system workflow according to the ledger |
| Current delivery readiness | Verified local app, redesigned UI, new Devpost draft; no final video | Ledger records completed same-case fulfillment and an independently passed 264.20-second English film |
| Credibility risks | Medical scope, limited references, catalog/lot ambiguity | Synthetic business delivery inputs must not be called physical proof; no inferred revenue |
| Remaining presentation work | Record public video, make judging access usable, finalize submission | Publish existing film, verify final preview, finalize submission |

For maximizing submission readiness this weekend, the prior project currently has the stronger evidence package. MedGuard is a valid longer-term direction, but a more emotional topic and better consumer UI do not by themselves make it more original or more likely to win. The Missing 20 ledger's real external readbacks are meaningful, while its physical-delivery inputs remain synthetic; neither project has demonstrated production business or clinical outcomes.

The practical decision is to preserve this completed MedGuard milestone and avoid expanding both projects simultaneously. If MedGuard remains the selected entry, finish the bounded video and submission before pursuing new camera/monitoring features. No numerical award probability is defensible without the actual competing submissions and judges' assessments.
