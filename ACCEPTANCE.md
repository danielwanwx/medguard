# MedGuard — current acceptance and judge reassessment

2026-09-12. Internal engineering acceptance, not clinical validation or an official judging result. All recorded health profiles are synthetic. The original 1.8/5 baseline remains in [EVALUATION.md](EVALUATION.md).

## Accepted behavior

The real browser suite exercised Fish Oil, Ginkgo, St. John's Wort and Vitamin D through live catalog lookup, explicit candidate selection, real Strands/Bedrock evidence collection, and explicit saving. It also changed the profile and rechecked a saved item. Nine actual browser API requests returned HTTP 200: four candidate lookups, four confirmed reviews and one recheck. Every completed review contained the four required successful tool calls. No successful response was mocked.

The suite passed 176 assertions, including desktop/mobile overflow checks, persistence of sources and dates, stale-profile labels, original-query reuse, pharmacist-note download, and dialog Escape/focus restoration. Three direct API cases checked loose-pill refusal, rejected candidate tampering and invalid payloads. A separate browser context deliberately injected an HTTP 503 failure; it produced an error and no saved review. That context's expected 503 console message is explicitly labeled synthetic. The live context had no console or page errors.

Evidence: [complete report](docs/evidence/current/verification-report.json), [actual API responses](docs/evidence/current/api-responses.json), [downloaded sample note](docs/evidence/current/medguard-review-note.txt), and [dated stale note](docs/evidence/current/medguard-stale-review-note.txt). The report records its own run time; screenshots cover each flow state at 1440×1000 and 390×844.

The Python safety suite passes 19 tests, including request isolation, source errors, exact no-match semantics, malformed ingredients, immutable tool inputs, candidate confirmation, no-imprint refusal, missing CRT setup and the St. John's Wort/warfarin regression. Frontend state/persistence tests pass 9/9. These use labeled synthetic fixtures; they are distinct from real service acceptance.

A new repository-local Python 3.12 virtual environment installs successfully from requirements.txt and passes `pip check`. Its initial run exposed the missing AWS CRT dependency and a misleading expired-login error; the [failed run](docs/evidence/fresh-install-failure/verification-report.json) is retained. The pinned `boto3[crt]` extra and a distinct `setup_required` error fix that defect. The final full real run used this independent environment and completed at **2026-09-12 19:34:39 UTC**, with 176 passing assertions, nine actual requests and 68 screenshots.

Frontend `npm ci --ignore-scripts`, production build and npm vulnerability audit pass; the audit reports zero known vulnerabilities. The host's older Node 20.18.3 emitted a plugin engine warning, so the production build was additionally verified with Node 24.19.0. Follow README's Node 22.12+ guidance.

## Primary review

The primary reviewed the actual backend/frontend diff and inspected actual welcome, result, cabinet and note screenshots. The cream/forest palette, Nunito typography, restrained artwork, bottom navigation and guided confirmation improve the consumer experience. Radix manages the note dialog and evidence accordions. Interaction prompts appear before recall details. Full summaries and long recall records remain expandable; actual FDA record-status counts remain visible outside the disclosure. Dates, source links and trace values survive reload.

The original defects D01–D13 and D15–D17 are addressed within the declared local prototype scope. D07 is resolved by removing false monitoring claims, not by shipping monitoring; D12 uses honest text lookup and a local export, not camera identification or an authoritative medical history. D14 remains partially open: the Devpost draft is updated, but a public MedGuard video, independently usable judging access and final submission are not complete.

## Current internal score

| Criterion | Score / 5 | Basis and remaining criticism |
| --- | ---: | --- |
| Technical Implementation | 3.5 | Real model/tool/API path and evidence boundaries are verified. The workflow is constrained, requires local AWS setup, and has no hosted judging deployment. |
| Design | 4 | Clear onboarding and label confirmation, mobile navigation and working export. Evidence-heavy result pages can still be simplified through user testing. |
| Potential Impact | 3 | A coherent pharmacist-conversation aid. No user study, clinical review or measured outcome; references remain limited. |
| Creativity & Originality | 2.5 | The explicit label/evidence/handoff workflow is useful, but medication records, sharing and contextual assistants already exist. Whole-cabinet reasoning and proactive checks are absent. |
| Presentation | 2.5 | Honest story, source evidence, architecture and real screenshots are ready. A public final video remains missing. |

**Equal-weight mean: 3.1/5.** This is a credible working prototype, not evidence of a high probability of winning. Passing engineering checks does not establish medical safety or commercial differentiation.

## Weekend priorities

1. Record and publish a genuine, focused video under five minutes using the DEVPOST.md plan. Show the supported St. John's Wort/warfarin prompt, human selection, actual trace, saved record and pharmacist handoff.
2. Make judging access practical. Current local setup requires authorized AWS credentials; a public service needs authentication, rate/cost limits and an explicit data-handling decision before exposure.
3. Seek a short pharmacist/user review of the workflow and wording. Report feedback honestly; do not claim clinical validation.
4. Freeze scope and repair observed failures. Camera capture, autonomous monitoring and broader interaction engines should not displace submission completeness this weekend.

Remaining limitations: catalog search does not identify a physical bottle; recall text matches do not verify its lot; interaction and dosage references are curated and incomplete; actual intake is unknown; local records are not encrypted or synchronized; external API availability can change. These boundaries are visible in the product and documentation.
