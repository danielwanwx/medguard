# MedGuard

**A little clarity for your cabinet.** Confirm a supplement label, inspect dated evidence, and prepare a note for your pharmacist.

A real **Strands agent on Amazon Bedrock Nova Pro** invokes official-source tools. Request-local code controls facts and completeness. You choose which catalog label matches the bottle and what to save; a pharmacist or clinician interprets the findings.

> MedGuard surfaces evidence and reference flags. It is not medical advice, a diagnosis, a prescription, or a guarantee of safety.

## The working flow

1. Create an optional medicines/conditions profile, or explicitly choose a synthetic sample.
2. Type a supplement label. The agent retrieves up to five **live NIH DSLD catalog candidates**.
3. Compare name, brand and ingredients with the bottle, then select a label. A catalog entry does not verify a physical product.
4. The agent rechecks that selection, searches **live openFDA food and drug enforcement**, applies a **small cited interaction ruleset**, and retrieves **curated adult dosage references**. Inspect the source links and actual tool trace.
5. Explicitly save a completed review to the browser's cabinet. Profile changes make old reviews stale. Prepare, review and download or print a pharmacist note.

This version has **no camera/OCR, prescription-pill identification, whole-cabinet interaction engine, background recall monitoring, cloud account, automatic clinician messaging, or AgentCore deployment**. Actual dose, frequency, expiry and bottle lot are unknown. The cabinet holds individual dated label reviews, not an authoritative medical history.

## Why an agent here?

The work is a controlled sequence: label lookup → human selection → evidence collection → inspectable record → human handoff. Strands really invokes the tools, but cannot supply replacement ingredients or invented profile data. A missing source/tool leaves the review incomplete. Structured evidence generates the displayed summary, rather than unrestricted model prose.

Live search, context and exports are not unique to MedGuard. Current Medisafe, MyTherapy and ChatGPT Health overlap parts of the workflow. Our proposed distinction is focused supplement-label confirmation and an inspectable evidence trail. See [COMPETITORS.md](COMPETITORS.md); no head-to-head or clinical effectiveness advantage has been demonstrated.

## Run locally

Use Python 3.12+ and Node 22.12+ (also verified with Node 24). AWS credentials must permit Bedrock invocation of `us.amazon.nova-pro-v1:0` in `us-west-2`.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
AWS_PROFILE=your-profile AWS_REGION=us-west-2 python server.py 8910
```

In a second terminal:

```bash
cd ui
npm ci --ignore-scripts
npm run dev -- --port 5173 --strictPort
```

Open **http://localhost:5173**. Vite proxies `/api` to port 8910. This is a local development service, not an authenticated public deployment. Do not expose the Python development server directly to the internet.

On this development machine, `missing20-sandbox` assumes a role from `missing20-login`. If credentials expire, run in a real terminal:

```bash
aws login --profile missing20-login --region us-west-2
```

Then retry. A blocked browser callback alone does not prove login failed; verify the actual API call. Never commit credentials.

### Data chain without AWS

```bash
python3 core-chain.py
```

This shares the agent's data helpers but is **not a Bedrock test**. The CLI explicitly labels its first-candidate choice as a demonstration, not a physical-bottle match. Supplied demo health data is synthetic.

### Verification

```bash
python -m unittest discover -s tests -v
cd ui
npm test
npm run build
npm audit
```

The real-browser acceptance runner is `scripts/verify-medguard.mjs`; it requires Playwright and running frontend/backend. From the repository root, set `PLAYWRIGHT_MODULE` to an installed Playwright module path if it is not locally resolvable, then run `node scripts/verify-medguard.mjs`. It saves actual responses and screenshots under `docs/evidence/current/`. Failure injection is separately labeled; the successful flow never substitutes mock responses.

[ACCEPTANCE.md](ACCEPTANCE.md) records current verification and remaining gaps. [EVALUATION.md](EVALUATION.md) records the strict pre-change judge assessment. [Baseline evidence](docs/evidence/baseline/browser-evidence.json) preserves unsafe original responses for regression review, not as recommended medical information.

## Evidence boundaries

| Tool | Data ownership | Cannot establish |
|---|---|---|
| `identify_supplement` | Live NIH DSLD labels, selected by the user | Authenticity, exact physical identity or clinical suitability |
| `check_recall` | Quoted phrase search across FDA food/drug enforcement, preserving product/firm/lot/status/dates | That this bottle is recalled or recall-free; records can be historical/terminated |
| `check_interactions` | Curated NIH/NCCIH rules with direct citations | Comprehensive interactions or official severity; priorities are app labels |
| `check_dosage` | Small NIH ODS adult reference table with formulation/scope limits | Actual intake or a personalized safe dose; an empty table is not reassurance |

## Privacy

Profile and reviews stay in this browser's local storage; anyone with access to the browser profile can read them. Remove controls are provided. There is no account sync or server-side cabinet database. A check sends entered profile and product text to the local service; relevant tool results and matched profile terms reach Amazon Bedrock. Public NIH/FDA requests contain product text, not the health profile. HTTP request content is not logged. Notes are downloaded locally and never automatically sent.

## Project materials

[Design](DESIGN.md) · [Architecture](architecture.md) · [API](docs/API.md) · [Research](RESEARCH.md) · [Devpost copy and video plan](DEVPOST.md) · [Baseline evaluation](EVALUATION.md)

Built for [Agents for Humans](https://agentsforhumans.devpost.com/). This project pivoted from **The Missing 20**, a prior warehouse-receiving project. The starting scaffold and working discipline were reused; supplement workflows, source repairs and the consumer redesign are tracked in this repository. Prior warehouse integrations are not MedGuard features.

## License

[MIT](LICENSE). Third-party packages, fonts and icons retain their own licenses.
