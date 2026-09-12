# MedGuard — strict baseline judge evaluation

Evaluated 2026-09-12, baseline `6924ef7`, before product changes. This is an internal assessment, not an official judge score. All test health profiles are explicitly synthetic. The [official rules](https://agentsforhumans.devpost.com/rules) specify five equally weighted criteria, with Technical Implementation the first tiebreaker. Scores below use 1–5.

## Verdict: unsafe to present as a working safety product yet

The project has a real Strands integration and accessible public sources, but the current demo confuses search results with verified identity, mistakes an unrelated recall for a recalled supplement, and displays success when evidence is missing. Fix provenance and failure semantics before polishing the pitch.

| Criterion | Score / 5 | Strength | Judge criticism | Concrete fix |
|---|---:|---|---|---|
| Technical Implementation | 2 | Actual Strands Agent, Bedrock Nova Pro, four callable tools, HTTP/UI integration; live NIH/FDA chain responds. | Global tool trace can mix concurrent users; model supplies factual tool arguments; recall query is wrong; transport failures become negative results; no reproducible acceptance suite. | Isolate each run, bind checks to retrieved ingredients and submitted profile, enforce completion and fail-closed states, fix recall search and add regression tests. |
| Design | 2 | Legible cards, obvious input and disclaimer, responsive CSS. | Fixed example profile, everything on one dashboard, pretend scanner, premature success trace, failure labeled CLEAR; doctor dialog is not an export. | Editable onboarding, one-task screens and bottom navigation; real completed trace only; separate unavailable/needs-confirmation states; user-controlled cabinet and downloadable note. |
| Potential Impact | 2 | Supplement/prescription review and a portable list address a recognizable caregiver problem. | Wrong recall and overstated certainty can cause harm; no evidence of clinical effectiveness; persistence and continuous protection are claimed but absent. | Demonstrate a bounded review workflow with provenance and explicit coverage limits; persist a user-confirmed record locally and label freshness. |
| Creativity & Originality | 2 | Bringing label lookup, recall records, interaction references and a doctor note into one flow is a coherent use of tools. | The contrast with ChatGPT is a straw man; memory/export/reminders already exist elsewhere. The claimed proactive agent is a conditional banner. | Research current competitors; demonstrate inspectable evidence and controlled handoff; describe continuous monitoring as future work until implemented. |
| Presentation | 1 | MedGuard name, human scenario, architecture and draft submission exist. | No public video supplied. The central “Fish Oil recall” hook is an unrelated product. Claims include unbuilt vision, expiry, whole-cabinet reasoning and monitoring. | Replace false hook with an actual supported interaction and evidence trail, update submission to tested capabilities, prepare screenshots and a ≤5-minute recording plan. |

**Equal-weight mean: 1.8 / 5 (9 / 25).** Not award-ready. Authenticated Strands execution was demonstrated after login recovery, but it repeats the incorrect recall mapping. No bonus points or unverified deployment credited.

## Verified live counterexample: the headline recall is wrong

Running `../Agents-for-Humans/the-missing-20/.venv/bin/python core-chain.py` from this repository succeeded against the public APIs. The runtime is borrowed; the executed source is this checkout. The synthetic query was `fish oil`, with warfarin and hypertension.

- NIH DSLD returned **Harry & David — Fish Oil**, with EPA/DHA ingredients. A first text-search hit does not establish that this is the user's bottle.
- The original FDA query `product_description:fish%20oil` returned **D-0185-2026**, **Doctor D. Schwab Controlling Balm with Tea Tree Oil**, recalling firm **CA BOTANA International, Inc.**, lot **D54361**, recall initiation **2025-10-10**, status **Ongoing**. FDA metadata last updated **2026-09-02**.
- `core-chain.py` reports this as `Fish Oil recalled=True`, because the search phrase is not quoted and the code does not inspect product/brand/lot identity. This is a real record attached to the wrong product, not a fabricated FDA record. It invalidates the existing killer demo.

[Reproduce the original FDA query](https://api.fda.gov/drug/enforcement.json?search=product_description:fish%20oil&sort=recall_initiation_date:desc&limit=1). See [FDA drug enforcement documentation](https://open.fda.gov/apis/drug/enforcement/) and [food enforcement documentation](https://open.fda.gov/apis/food/enforcement/). Supplement recall coverage needs food as well as drug enforcement; no-match is never a guarantee of safety.

A separately verified [quoted food-enforcement query](https://api.fda.gov/food/enforcement.json?search=product_description:%22fish%20oil%22&sort=recall_initiation_date:desc&limit=3) returned 14 records in its metadata. Its most recent result, **H-0589-2025**, concerns **Hi-Tech Pharmaceuticals Fish Oil**, lot **517120551**, and is **Terminated**. These are historical, product-specific records, not evidence that the user's Harry & David bottle currently has an active recall. This sets the acceptance boundary for the repair.

## Prioritized defect and gap list

| ID | Priority | Evidence / consequence | Acceptance condition |
|---|---|---|---|
| D01 | P0 | `check_recall` unquoted query attaches tea-tree balm recall to Fish Oil. No firm, product description, lot or record URL is retained. | Quote/escape terms, inspect matches, preserve FDA record identifiers and lot text; label results potential matches until a human checks product/lot. Regression excludes D-0185-2026 for fish oil. |
| D02 | P0 | Every recall exception returns `recalled:false`; absent/error identity falls through to CLEAR in UI. | Distinguish explicit API no-match from unavailable/malformed/timeout; missing evidence never produces a safety verdict. |
| D03 | P0 | NIH first hit automatically becomes identity and cabinet entry; no-imprint refusal exists only in docs. | Search candidates require confirmation; unknown/loose-pill queries stop safely; no unconfirmed item is added. |
| D04 | P0 | Browser timers append completed tool checks before server response, with a fabricated fallback trace. | Show only a waiting state during request; every completed tool row comes from the actual response and reflects its error state. |
| D05 | P0 | Global `TOOL_TRACE` is cleared and shared by a threaded HTTP server. | Request-local trace and immutable evidence; concurrent synthetic profiles never mix. |
| D06 | P0 | Model passes ingredient/profile strings to tools and can omit/change facts; system prompt alone is the boundary. | Tool closures own submitted profile and retrieved identity; later checks cannot substitute model-invented ingredients; missing required checks yields incomplete. |
| D07 | P1 | “PROACTIVE ALERT”, “watching”, “caught without asking” are generated only from the result of the user-requested check. | Remove these claims or implement and verify actual monitoring with last-checked time, failure semantics and notification consent. |
| D08 | P1 | Warfarin + omega-3 always HIGH; ODS evidence is more nuanced. Substring aliases such as `epa` can match unrelated ingredient text. | Use conservative curated attention levels with direct URLs and coverage limits; test token/alias boundaries. |
| D09 | P1 | Profile fixed to warfarin/hypertension without synthetic labeling; cabinet is component memory; refresh loses it. | Empty personal onboarding plus explicit synthetic demo option; editable profile; disclosed local persistence and clear/delete control. |
| D10 | P1 | Dosage tool response is not rendered; amounts, formulations and actual daily intake are unavailable. | Render cited adult reference limits with scope caveats; never infer dose safety or personalized recommendations. |
| D11 | P1 | Source names are plain text; both live APIs and curated tables called “4 live tools.” | Clickable official URLs, retrieval times, distinct live/curated labels and actual invocation counts. |
| D12 | P1 | “Scan a bottle” has no file/camera input; “complete & current” doctor history is only an in-memory modal. | Honest text-lookup wording or real vision; export a user-reviewed note with dates, unknown dose fields, provenance and limitations. |
| D13 | P1 | README/Design/Devpost claim whole-cabinet checks, expiry and actions without implementations. | Capability matrix and pitch describe tested shipped features; roadmap clearly separated. |
| D14 | P1 | No public ≤5-minute video, confirmed judging access, Builder ID or verified Devpost submission supplied. | Complete the material package; track these external submission requirements separately, without claiming completion. |
| D15 | P2 | Large inherited receiving stylesheet, old package name, icon/font licensing context missing, no keyboard-managed dialog. | Replace inherited styles with coherent design tokens/components, accessible dialog/navigation and third-party notices. |
| D16 | P0 | Primary's real Ginkgo browser run produced the model claim “There are no dosage concerns” although the tool only returned an empty limited-table lookup. | Prevent an empty reference table from becoming reassurance; render structured scope-qualified evidence and reject unsupported model safety claims. |
| D17 | P0 | Real St. John's Wort + warfarin flow displays CLEAR and “no reported interactions”; the tiny ruleset lacks the warfarin rule. | Add the directly cited NCCIH warfarin interaction, expand the bounded coverage honestly, and never describe zero rule matches as no known/reported interactions. |

For D08, [NIH ODS Omega-3, medication interactions](https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/#h8) discusses potential effects, mixed evidence and INR monitoring; it does not justify an unconditional personalized HIGH bleeding verdict. [NCCIH Ginkgo](https://www.nccih.nih.gov/health/ginkgo) supports a potential warfarin interaction. Curated flags are review prompts, not official clinical severity ratings.

For D17, [NCCIH St. John's Wort](https://www.nccih.nih.gov/health/st-johns-wort-and-depression-in-depth) explicitly lists warfarin among medicines whose effects can be weakened.

## Browser evidence

Baseline artifacts are stored in `docs/evidence/baseline/`. At the initial evaluation commit, the saved headless capture is `primary-mobile-initial.png`; the complete headless harness run is still pending. The three-product flow and doctor dialog were independently driven and visually inspected in Chrome as described below. Do not infer that every headless state has passed from this report. The harness must use this checkout: the pre-existing processes on ports 5173/8910 belonged to the previous `Agents-for-Humans` directory, discovered with `lsof`. Localhost and external API calls require execution outside this session's network sandbox; a sandbox connection failure is not an application failure.

The correct-checkout backend was started on port 8911 with `AWS_PROFILE=missing20-sandbox AWS_REGION=us-west-2`. The first real `POST /api/medcheck` returned HTTP 500: **“Your session has expired or credentials have changed. Please reauthenticate using 'aws login'.”** Recovery: `missing20-sandbox` is an AssumeRole profile whose `source_profile` is `missing20-login`; refresh the latter using `aws login --profile missing20-login --region us-west-2`. The user completed login in their existing Chrome session.

After recovery, the same synthetic Fish Oil request returned HTTP 200 with **four real Strands tool calls** and an agent answer. The answer explicitly, incorrectly attributed the recall to Harry & David Fish Oil. Thus the model connection is verified; the unsafe grounding defect is also reproduced through the actual model path. Public-data-only success is kept separate from authenticated agent success.

`cd ui && npm run build` passed on the baseline (30 modules, Vite 6.4.2). Browser execution outcomes are recorded below when the run completes. Scores intentionally give no credit for undocumented vision, persistence, background monitoring, deployment or a missing public video.

Primary review also drove the actual Chrome UI on the canonical ports after replacing the old processes: **Fish Oil → Ginkgo → St. John's Wort → three-item cabinet → doctor history → refresh**. All three calls returned real results. The doctor modal left focus on the background trigger and did not dismiss with Escape. Refresh discarded all three cabinet items. The St. John's Wort response and Ginkgo dosage sentence exposed D17 and D16 respectively. This manual review is separate from the headless evidence harness.

### Consumer interface review (UI skill, full mode)

Scope: React/Vite, plain CSS; source inspection and the headless 390 × 844 initial-screen capture. Additional flow screenshots are in the browser report.

| Category | Evidence | Result |
|---|---|---|
| Typography | Initial mobile screenshot, inherited `styles.css`, `medguard.css` | Small, low-contrast helper text and all-caps labels weaken the friendly hierarchy. Increase body scale/contrast and make one clear heading lead each screen. |
| Surfaces | Mobile input/presets/profile/card | Preset controls are compact for touch; profile resembles a debug fixture. Use 44px targets and editable onboarding. |
| Animations | `setTimeout` trace implementation | HIGH: animation represents uncompleted work as successful. Remove fabricated progress; retain truthful waiting feedback. |
| Icons | Bundled Phosphor font assets and classes | Consistent family, but scan-camera affordance implies unbuilt capture. Use an honest search icon until vision exists. |
| Performance | Production build, CSS source | Build passes; inherited receiving-dashboard CSS inflates scope. Remove unused stylesheet rules during refactor. |

Considered and rejected: more dashboard panels would increase cognitive load; a “protected” streak would imply unproven safety; generic green success for zero findings hides incomplete coverage. **Verdict: Block**, chiefly for misleading state semantics, with consumer craft needing substantial changes. Reduced-motion, keyboard dialog focus and the full loading animation are not verified by the initial screenshot alone.
