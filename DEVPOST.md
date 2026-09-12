# MedGuard — Devpost source of truth

Use the copy below for the current project. Do not reuse the warehouse demo, false Fish Oil recall hook, or claims of shipped monitoring, camera scanning or whole-cabinet interaction reasoning.

## Title

MedGuard

## Tagline

Confirm your supplement label. See the evidence. Bring a dated cabinet note to your pharmacist.

## Inspiration

A supplement can look ordinary on a shelf and still deserve a conversation about the medicines someone takes. Remembering the bottle name, finding a reliable source, and preparing that conversation are separate chores. We wanted to connect them without letting a model decide what is safe.

The question became: can an agent collect useful evidence while keeping label confirmation and medical decisions with people?

## What it does

MedGuard guides a person through a focused supplement review. Start with an optional medicines-and-conditions profile or a clearly labeled synthetic sample. Enter text from the bottle. A Strands agent queries the live NIH Dietary Supplement Label Database and returns candidates; the person compares the brand and ingredients before choosing one.

A second real agent run validates the selected catalog label and gathers openFDA food and drug enforcement records, cited interaction prompts and adult dosage references. The app shows what came back, which calls completed, and where the sources are limited. FDA results are potential text matches requiring a product/lot comparison, not a declaration that the person's bottle is recalled. The interaction rules and dosage table are small curated references, explicitly labeled as such.

The person can save a completed review in the browser's cabinet. Each review stays dated; changing the profile marks earlier checks stale. A pharmacist note can be reviewed, downloaded or printed with source links and unknown dose, frequency and lot fields.

MedGuard is not medical advice. It does not diagnose, prescribe, guarantee safety or send the note automatically.

## How we built it

The backend uses the Strands Agents SDK with Amazon Bedrock Nova Pro (`us.amazon.nova-pro-v1:0`, us-west-2). The model invokes real tools: `identify_supplement`, `check_recall`, `check_interactions` and `check_dosage`.

Each request gets its own context and trace. Tool functions take no model-supplied factual arguments: they use the submitted profile, original query and freshly retrieved catalog ingredients. The server validates label selection and checks that required evidence calls completed. Source failures remain incomplete. The displayed summary is built from structured evidence so unsupported model prose cannot become a safety verdict.

The React/Vite frontend uses Radix Dialog and Accordion, Lucide icons, locally bundled Nunito Sans and a shared CSS design system. It has guided onboarding, explicit confirmation, bottom navigation, browser persistence and local note export. The public-data CLI and agent share the same source helpers.

## Challenges we ran into

Our strict baseline evaluation caught a serious bug: an unquoted Fish Oil search attached a real tea-tree balm recall to the wrong product. The model repeated it confidently. We fixed the query and preserved product descriptions, firms, lots, record status and dates. A result being from FDA is not enough; it must be interpreted within its matching limits.

The baseline also treated source errors as no recall, chose the first catalog result automatically, and displayed completed tool rows before the response arrived. We replaced those shortcuts with explicit states, user selection and actual trace data.

A tiny interaction set missed St. John's Wort with warfarin. NCCIH explicitly describes that interaction. We added a cited rule and removed “no interactions” or “safe dose” conclusions when limited references return nothing. These are bounded engineering improvements, not clinical validation.

## Accomplishments we're proud of

We connected an actual model-driven workflow to live official data and a consumer interface, then tested the places where a polished demo could mislead. The person controls label selection and saving; the app keeps uncertainty visible. The output is a dated, portable starting point for a pharmacist conversation.

Our strongest artifact is the evidence trail: a scored baseline evaluation, preserved live counterexamples, regression tests, real browser responses and screenshots, and coherent commits showing the repairs.

## What we learned

Official data, a model and a friendly interface do not automatically produce trustworthy conclusions. Search candidates need confirmation, recalls need product/lot context, and a missing rule is not an absence of risk. The architecture must enforce these distinctions rather than relying on a disclaimer.

Competitor research also changed our pitch. Medisafe and MyTherapy already offer useful records and sharing; ChatGPT Health can use personal context. We focus on the supplement-label confirmation and inspectable evidence workflow, without claiming that live search or exports are unique.

## What's next

Real camera label capture with human confirmation; broader clinically reviewed references; whole-cabinet duplicate/interaction checks; consent-based scheduled recall checks; authenticated storage and caregiver sharing; and an AgentCore deployment. These are roadmap items, not features of this local prototype.

## Built With

Python, JavaScript, React, Vite, Strands Agents SDK, Amazon Bedrock, Amazon Nova Pro, AWS, Radix UI, Lucide, NIH DSLD API, openFDA API, NIH ODS/NCCIH references.

## Attribution and prior work

MedGuard pivoted from our prior project, The Missing 20, a warehouse-receiving agent. We reused the initial scaffold and the discipline of keeping tool evidence and human decisions separate. The repository history records the supplement workflow, source fixes and consumer redesign. Prior warehouse integrations and video are not submitted as MedGuard capabilities.

## Links and image captions

- Repository: https://github.com/danielwanwx/medguard
- Architecture: https://github.com/danielwanwx/medguard/blob/main/architecture.md
- Evaluation: https://github.com/danielwanwx/medguard/blob/main/EVALUATION.md
- Sources/competition: https://github.com/danielwanwx/medguard/blob/main/COMPETITORS.md
- Live public deployment: none; use the documented local setup with authorized AWS credentials.
- Public video: still needs a YouTube/Vimeo recording URL; do not retain the warehouse video.

Use actual screenshots from `docs/evidence/current/`, after passing acceptance:

1. Welcome: “A focused supplement-label review, with an explicitly labeled sample profile.”
2. Candidates: “Live NIH catalog results require a person to compare the bottle label.”
3. St. John's Wort review: “A cited warfarin review prompt and the actual agent tool trace.”
4. Cabinet/note: “Dated browser records and a user-reviewed pharmacist note.”
5. Architecture: “Real Strands orchestration with evidence owned by request-local tools.”

Do not publish baseline screenshots as the current product: they document unsafe historical behavior.

## Recording plan — approximately 3:45, maximum 5 minutes

| Time | Show | Say |
|---|---|---|
| 0:00–0:20 | Welcome and a labeled synthetic scenario | “You have a supplement bottle and take warfarin. Before deciding anything, collect the label and evidence for a pharmacist.” |
| 0:20–0:45 | Sample profile, search St. John's Wort | “This profile is synthetic. The model calls the real NIH catalog tool.” |
| 0:45–1:10 | Candidates, explicit label selection | “A search hit isn't the bottle. A person compares brand and ingredients.” |
| 1:10–1:55 | Actual review, source link, trace | “Nova Pro invokes four real tools. Live records and curated references are labeled separately. NCCIH describes a warfarin interaction; the app flags a review, not a treatment decision.” |
| 1:55–2:25 | FDA records and dosage limits | “Potential recall matches need a lot comparison. Terminated stays terminated. Unknown intake means no safe-dose claim.” |
| 2:25–3:00 | Save, reload, edit profile, stale label | “You choose what to save. A new profile does not silently make an old check current.” |
| 3:00–3:25 | Note preview and download | “Bring this dated record and its sources to a pharmacist. It isn't a complete medical history.” |
| 3:25–3:45 | Architecture and limits | “The agent orchestrates, evidence owns the facts, and people decide. Camera scanning and background monitoring are next.” |

Record genuine responses; pause naturally while requests run or clearly label any time compression. Never splice a successful response over a failed request. A source outage should be shown honestly or the recording retried later. No fabricated comparison with a chatbot.

## Submission status

The [official rules](https://agentsforhumans.devpost.com/rules) require the project materials and a public video of at most five minutes; five judging criteria have equal weight, with Technical Implementation the tiebreaker. Deadline: 2026-09-14 17:00 Pacific.

Verified in the existing signed-in Chrome session on 2026-09-12:

| Field / material | Verified state |
| --- | --- |
| Title and tagline | Saved as MedGuard and the tagline above |
| Story and repository | Saved; warehouse pitch replaced by the current source-grounded story and MedGuard repository |
| Built With | Saved Strands Agents SDK, Amazon Bedrock, Nova Pro, Python, JavaScript, CSS, React and Vite tags |
| Track | Everyday Agents |
| Required architecture | `medguard-architecture.png` uploaded; old warehouse attachment removed from the draft |
| Gallery | Five images saved: current architecture, welcome, live candidate selection, real St. John's Wort review, pharmacist note; captions label synthetic profiles |
| Thumbnail | Actual MedGuard welcome screenshot uploaded and saved |
| Testing instructions | Replaced with real local AWS/Bedrock setup and workflow; no false credential-free agent claim |
| Existing entrant fields | Existing Builder ID, submitter type and country preserved; no credential or private contact copied into this repository |
| Public demo video | Still missing; recording plan above is ready |
| Public hosted app | None; local AWS setup required |
| Final submission | **Not submitted**; entrant terms checkbox remains unchecked |

The [verified preview](https://devpost.com/software/the-missing-20-agents-for-humans) displays MedGuard, its current story, five images and the MedGuard repository, with an **Incomplete submission** notice. Devpost retains the original public URL slug even though the displayed project name and draft URL changed. The draft's submission ID remains `1162519`.

Final legal certifications must be reviewed by the entrant. Do not mark the package submitted or award-ready until the public video, judging access and final submission are actually complete.
