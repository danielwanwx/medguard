# MedGuard API

`POST /api/medcheck` is same-origin JSON only. It runs a bounded, evidence-gathering
review; it does not identify a loose pill or make a personal safety determination.

## Request

```json
{
  "scan": "Fish Oil",
  "profile": {
    "meds": ["warfarin"],
    "conditions": ["hypertension"]
  },
  "selected_id": "optional NIH-DSLD-candidate-id"
}
```

`scan` is required (1–160 characters). `meds` and `conditions` are required arrays of
short strings (at most 30 entries each). `selected_id` is omitted for label lookup and
is required only after the user chooses one of the returned candidates.

## Label lookup response

The first request has no `selected_id`. Its successful response is always
`status: "needs_confirmation"`; no identity, recall, interaction, or dosage conclusion
has been made yet.

```json
{
  "status": "needs_confirmation",
  "checked_at": "2026-09-12T12:00:00Z",
  "answer": "Choose the NIH DSLD label that matches your bottle...",
  "tools": 1,
  "tool_trace": [
    {"tool": "identify_supplement", "status": "success", "result": {"candidates": []}}
  ],
  "identity": null,
  "candidates": [
    {
      "id": "NIH-DSLD-ID",
      "name": "Product label name",
      "brand": "Brand",
      "ingredients": ["Ingredient from the NIH label"],
      "source": "NIH Dietary Supplement Label Database (DSLD)",
      "source_url": "https://api.ods.od.nih.gov/..."
    }
  ],
  "recall": null,
  "interactions": [],
  "dosage": []
}
```

A candidate is a catalog search result, never an automatic match to a physical bottle.
The UI must show the supplied name, brand, and ingredients and obtain a user label
selection before sending `selected_id`.

## Confirmed-label response

For a request with `selected_id`, the backend repeats the official DSLD search. The
selection must still appear in the fresh result set for the original `scan`; otherwise
the server returns a safe `400 invalid_selected_id` error. A completed review has this
shape:

```json
{
  "status": "complete",
  "checked_at": "2026-09-12T12:01:00Z",
  "answer": "Deterministic evidence-owned summary...",
  "tools": 4,
  "tool_trace": [
    {"tool": "identify_supplement", "status": "success", "result": {"identity": {}}},
    {"tool": "check_recall", "status": "success", "result": {"status": "potential_matches"}},
    {"tool": "check_interactions", "status": "success", "result": {"findings": []}},
    {"tool": "check_dosage", "status": "success", "result": {"limits": []}}
  ],
  "identity": {
    "id": "NIH-DSLD-ID",
    "name": "Product label name",
    "brand": "Brand",
    "ingredients": ["Official label ingredient"],
    "source": "NIH Dietary Supplement Label Database (DSLD)",
    "source_url": "https://api.ods.od.nih.gov/...",
    "confirmed": true,
    "confirmation": "user_label_selection",
    "clinical_verification": "not_clinically_verified"
  },
  "candidates": [],
  "recall": {"status": "potential_matches", "recalled": null, "records": []},
  "interactions": [],
  "dosage": []
}
```

`answer` is a deterministic summary of the structured evidence. It is never model prose
or a model safety verdict. Strands genuinely orchestrates the calls, but its free-form
response is deliberately not returned or used to derive color, status, or a clinical conclusion.

`tool_trace` is request-local and only contains actual tool invocations. Each row has
`status: "success"`, `"error"`, or `"blocked"`. Do not render a successful trace row
until it appears in the response. Any missing, blocked, or error tool makes the response
`status: "incomplete"`.

## Evidence fields

- `recall.recalled` is always `null`. `recall.status` is `potential_matches`, `no_match`,
  or `unavailable`. `records` are text/category matches from both openFDA food and drug
  enforcement feeds, not a claim that the user's bottle is recalled. Each record preserves
  `product_description`, `recalling_firm`, `recall_number`, `code_info`, `dates`, `status`,
  `classification`, `api_url`, and `retrieved_at`.
- `interactions` are bounded, cited NIH/NCCIH review prompts. `risk` and
  `review_priority` are MedGuard review labels, not official clinical severity ratings.
  An empty list does not mean no interactions or that a product is safe; use the returned
  coverage note.
- `dosage` is a small NIH ODS adult reference table. Each returned row has a source URL
  and scope limitation. Actual intake is unknown, so an empty table or a reference limit
  is never a personal dosage-safety conclusion.

## States and errors

| Status | Meaning | UI action |
|---|---|---|
| `needs_confirmation` | Official catalog candidates need a user bottle-label selection. | Show choices; do not add to cabinet or show a safety result. |
| `complete` | The selected catalog label and all required evidence calls completed. | Present evidence and limits with their coverage notes. |
| `incomplete` | A required source/tool was missing, blocked, errored, or timed out. | Show retry and state that missing findings are not reassurance. |
| `unidentified` | A loose/no-imprint/unknown pill description was refused. | Ask for the supplement bottle label or pharmacist help; this app does not identify prescription pills. |

Error bodies are `{ "error": { "code": "...", "message": "..." } }`. Validation and
stale/invalid selections use HTTP 400. Expired AWS authentication uses HTTP 503 with an
actionable `authentication_required` message; no credential details are returned.
Missing AWS CRT support returns `setup_required` with instructions to install
requirements.txt; it must not be presented as an expired login. The service does not
send wildcard CORS headers.
