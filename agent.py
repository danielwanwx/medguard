"""Request-local Strands orchestration for the MedGuard evidence workflow.

Bedrock Nova Pro chooses and invokes the real `@tool` closures. Those closures accept no
model-provided facts: the original request, freshly selected NIH label, and health profile
remain inside one request context. Structured evidence, not model prose, owns the result.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
import json
from typing import Any, Callable

from botocore.exceptions import MissingDependencyException
from strands import Agent, tool
from strands.models import BedrockModel

from medguard_data import (
    OfficialDataError,
    checked_at,
    dosage_references,
    fresh_selected_candidate,
    get_json,
    interaction_check,
    lookup_dsld_candidates,
    openfda_recall,
    unidentified_pill_query,
)


MAX_SCAN_LENGTH = 160
MAX_SELECTED_ID_LENGTH = 200
MAX_PROFILE_ITEMS = 30
MAX_PROFILE_ITEM_LENGTH = 100
AGENT_TIMEOUT_SECONDS = 45


class RequestValidationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _string_list(value: Any, field_name: str) -> list[str]:
    if not isinstance(value, list) or len(value) > MAX_PROFILE_ITEMS:
        raise RequestValidationError("invalid_profile", f"profile.{field_name} must be an array of at most {MAX_PROFILE_ITEMS} strings.")
    cleaned: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise RequestValidationError("invalid_profile", f"profile.{field_name} must contain strings.")
        item = item.strip()
        if not item or len(item) > MAX_PROFILE_ITEM_LENGTH:
            raise RequestValidationError("invalid_profile", f"profile.{field_name} entries must be 1–{MAX_PROFILE_ITEM_LENGTH} characters.")
        cleaned.append(item)
    return cleaned


def validate_medcheck_payload(payload: Any) -> tuple[str, dict[str, list[str]], str | None]:
    """Validate untrusted HTTP JSON before any model or source call is constructed."""
    if not isinstance(payload, dict):
        raise RequestValidationError("invalid_json", "Request body must be a JSON object.")
    scan = payload.get("scan")
    if not isinstance(scan, str):
        raise RequestValidationError("invalid_scan", "scan must be a string.")
    scan = scan.strip()
    if not scan or len(scan) > MAX_SCAN_LENGTH:
        raise RequestValidationError("invalid_scan", f"scan must be 1–{MAX_SCAN_LENGTH} characters.")
    profile = payload.get("profile")
    if not isinstance(profile, dict):
        raise RequestValidationError("invalid_profile", "profile must be an object with meds and conditions arrays.")
    normalized_profile = {
        "meds": _string_list(profile.get("meds"), "meds"),
        "conditions": _string_list(profile.get("conditions"), "conditions"),
    }
    selected_id = payload.get("selected_id")
    if selected_id is None:
        return scan, normalized_profile, None
    if not isinstance(selected_id, str) or not selected_id.strip() or len(selected_id.strip()) > MAX_SELECTED_ID_LENGTH:
        raise RequestValidationError("invalid_selected_id", "selected_id must be a non-empty candidate ID from this lookup.")
    return scan, normalized_profile, selected_id.strip()


@dataclass
class RequestContext:
    scan_query: str
    profile: dict[str, list[str]]
    selected_id: str | None
    fetch_json: Callable[[str, int], dict[str, Any]]
    trace: list[dict[str, Any]] = field(default_factory=list)
    candidates: list[dict[str, Any]] = field(default_factory=list)
    identity: dict[str, Any] | None = None
    recall: dict[str, Any] | None = None
    interaction_result: dict[str, Any] | None = None
    dosage_result: dict[str, Any] | None = None
    execution_error: dict[str, str] | None = None

    @property
    def confirmed(self) -> bool:
        return self.selected_id is not None

    def trace_tool(self, name: str, status: str, result: dict[str, Any]) -> None:
        # Every item represents an actual decorated-tool invocation in this request.
        self.trace.append({"tool": name, "status": status, "result": result})


def _source_error(error: OfficialDataError) -> dict[str, str]:
    result = {"status": "unavailable", "error_code": error.code, "message": "Official source data is unavailable; retry this review."}
    if error.url:
        result["source_url"] = error.url
    return result


def make_request_tools(ctx: RequestContext) -> list[Any]:
    """Create new zero-argument `@tool` closures for one request only.

    Zero-argument schemas are intentional: a model cannot replace the selected label,
    original scan, ingredients, or submitted profile with text in a tool call.
    """

    @tool
    def identify_supplement() -> str:
        """Retrieve candidates from NIH DSLD using the original typed label text.

        This tool takes no arguments. For a selected label, it rechecks that the selected
        NIH DSLD ID is still present in fresh results before exposing official ingredients.
        """
        try:
            lookup = lookup_dsld_candidates(ctx.scan_query, fetch_json=ctx.fetch_json)
        except OfficialDataError as error:
            result = _source_error(error)
            ctx.trace_tool("identify_supplement", "error", result)
            return json.dumps(result)
        if not ctx.confirmed:
            ctx.candidates = lookup["candidates"]
            result = {
                "status": "needs_confirmation",
                "source": lookup["source"],
                "source_url": lookup["source_url"],
                "retrieved_at": lookup["retrieved_at"],
                "candidates": ctx.candidates,
                "coverage": "Catalog candidates are not physical-bottle matches. The user must select a label.",
            }
            ctx.trace_tool("identify_supplement", "success", result)
            return json.dumps(result)

        selected = next((candidate for candidate in lookup["candidates"] if candidate["id"] == ctx.selected_id), None)
        if selected is None:
            result = {
                "status": "unavailable",
                "error_code": "selection_not_fresh",
                "message": "The selected label no longer appears in fresh NIH DSLD results. Search again and choose a current label.",
            }
            ctx.trace_tool("identify_supplement", "error", result)
            return json.dumps(result)
        if selected["ingredient_status"] == "unavailable":
            result = {
                "status": "unavailable",
                "error_code": "ingredient_schema_unavailable",
                "message": "NIH DSLD did not return a usable ingredient list for this label. Interaction and dosage review cannot proceed.",
            }
            ctx.trace_tool("identify_supplement", "error", result)
            return json.dumps(result)
        ctx.identity = {
            **selected,
            "confirmed": True,
            "confirmation": "user_label_selection",
            "clinical_verification": "not_clinically_verified",
        }
        result = {
            "status": "success",
            "identity": ctx.identity,
            "coverage": "The user selected this catalog label; it is not a clinical or physical-bottle verification.",
        }
        ctx.trace_tool("identify_supplement", "success", result)
        return json.dumps(result)

    @tool
    def check_recall() -> str:
        """Search both live openFDA food and drug enforcement feeds for the trusted original label text.

        This tool takes no arguments and runs only after a fresh, user-selected NIH label is
        available. Results are potential text/category matches, never a bottle recall verdict.
        """
        if not ctx.identity:
            result = {"status": "blocked", "message": "A fresh user-selected NIH label is required before recall search."}
            ctx.trace_tool("check_recall", "blocked", result)
            return json.dumps(result)
        try:
            ctx.recall = openfda_recall(ctx.scan_query, fetch_json=ctx.fetch_json)
        except OfficialDataError as error:
            result = _source_error(error)
            ctx.trace_tool("check_recall", "error", result)
            return json.dumps(result)
        result = ctx.recall
        ctx.trace_tool("check_recall", "success" if result["status"] != "unavailable" else "error", result)
        return json.dumps(result)

    @tool
    def check_interactions() -> str:
        """Run cited NIH/NCCIH rules against trusted label ingredients and submitted profile.

        This tool takes no arguments. It cannot accept model-provided ingredients or profile data;
        no matching rule is explicitly not a safety conclusion.
        """
        if not ctx.identity:
            result = {"status": "blocked", "message": "A fresh user-selected NIH label is required before interaction review."}
            ctx.trace_tool("check_interactions", "blocked", result)
            return json.dumps(result)
        ctx.interaction_result = interaction_check(ctx.identity["ingredients"], ctx.profile)
        result = ctx.interaction_result
        ctx.trace_tool("check_interactions", "success", result)
        return json.dumps(result)

    @tool
    def check_dosage() -> str:
        """Return small, cited adult NIH ODS reference limits for trusted label ingredients.

        This tool takes no arguments. It does not know actual intake and must not be used to infer
        whether a personal dose is safe.
        """
        if not ctx.identity:
            result = {"status": "blocked", "message": "A fresh user-selected NIH label is required before dosage references."}
            ctx.trace_tool("check_dosage", "blocked", result)
            return json.dumps(result)
        ctx.dosage_result = dosage_references(ctx.identity["ingredients"])
        result = ctx.dosage_result
        ctx.trace_tool("check_dosage", "success", result)
        return json.dumps(result)

    return [identify_supplement] if not ctx.confirmed else [identify_supplement, check_recall, check_interactions, check_dosage]


def _agent_failure(error: Exception) -> dict[str, str]:
    if isinstance(error, MissingDependencyException):
        return {
            "code": "setup_required",
            "message": "AWS CRT support is missing. Install the pinned runtime dependencies with pip install -r requirements.txt, then retry.",
        }
    detail = str(error).casefold()
    if any(token in detail for token in (
        "session has expired", "credential", "reauthenticate", "expired token", "expiredtoken", "token is expired",
        "token has expired", "security token", "access key",
    )):
        return {
            "code": "authentication_required",
            "message": "AWS authentication expired. Run aws login --profile missing20-login --region us-west-2, then retry.",
        }
    if isinstance(error, TimeoutError) or "timeout" in detail:
        return {"code": "agent_timeout", "message": "The evidence agent timed out before completing this review. Retry shortly."}
    return {"code": "agent_unavailable", "message": "The authenticated evidence agent could not complete this review. Retry shortly."}


def _run_agent(
    ctx: RequestContext,
    tools: list[Any],
    *,
    agent_factory: Callable[..., Any],
    model_factory: Callable[..., Any],
    agent_timeout: int,
) -> None:
    if ctx.confirmed:
        system_prompt = (
            "You are MedGuard's evidence workflow orchestrator. Invoke every available tool exactly in this order: "
            "identify_supplement, check_recall, check_interactions, check_dosage. Never state that a product is safe, "
            "that there are no interactions, that there are no dosage concerns, or that a bottle is recalled. Your prose is "
            "optional and non-authoritative; the structured tool evidence controls."
        )
        prompt = "Run the required evidence workflow for the already user-selected catalog label."
    else:
        system_prompt = (
            "You are MedGuard's label-lookup orchestrator. Invoke identify_supplement exactly once. Do not perform recall, "
            "interaction, dosage, identity, or safety analysis. A returned catalog candidate needs user confirmation."
        )
        prompt = "Find official catalog candidates for the typed label text using the available tool."
    try:
        model = model_factory(model_id="us.amazon.nova-pro-v1:0", region_name="us-west-2")
        agent = agent_factory(model=model, tools=tools, system_prompt=system_prompt, callback_handler=None)

        async def invoke() -> Any:
            return await agent.invoke_async(prompt)

        asyncio.run(asyncio.wait_for(invoke(), timeout=agent_timeout))
    except Exception as error:  # The HTTP layer must not leak AWS/provider details.
        ctx.execution_error = _agent_failure(error)


def _missing_tools(ctx: RequestContext, required: tuple[str, ...]) -> list[str]:
    missing: list[str] = []
    for name in required:
        entries = [item for item in ctx.trace if item["tool"] == name]
        if not entries or any(item["status"] in {"error", "blocked"} for item in entries) or not any(item["status"] == "success" for item in entries):
            missing.append(name)
    return missing


def _deterministic_answer(ctx: RequestContext, status: str, missing: list[str]) -> str:
    if status == "unidentified":
        return (
            "MedGuard cannot identify a loose or unknown pill without an imprint and its bottle label. "
            "Use the labeled bottle or ask a pharmacist; no catalog identity or safety conclusion was made."
        )
    if status == "needs_confirmation":
        return (
            "Choose the NIH DSLD catalog label that matches your bottle. A search candidate is not a physical-bottle match. "
            "Recalls, interaction references, and dosage references have not been checked until you select a label."
        )
    if status == "incomplete":
        names = ", ".join(missing) if missing else "the authenticated evidence workflow"
        return (
            f"Review incomplete: {names} did not complete. Missing findings are not reassurance and no personal safety conclusion "
            "can be made. Retry the review, then discuss the confirmed label, dose, and lot with a pharmacist or clinician."
        )
    assert ctx.identity and ctx.recall and ctx.interaction_result and ctx.dosage_result
    recall_status = ctx.recall["status"]
    if recall_status == "potential_matches":
        recall_sentence = (
            f"openFDA returned {len(ctx.recall['records'])} potential product-description match(es); compare exact product and lot/code "
            "with the bottle. This does not establish that the bottle is recalled."
        )
    elif recall_status == "no_match":
        recall_sentence = (
            "openFDA returned explicit NOT_FOUND for this phrase in both enforcement feeds. That does not establish that the bottle has no recall."
        )
    else:
        recall_sentence = "The openFDA review is unavailable, so no recall conclusion can be made."
    findings = ctx.interaction_result["findings"]
    interaction_sentence = (
        f"The cited reference set produced {len(findings)} review prompt(s)." if findings else
        "No matching rule was found in the small curated reference set; that does not mean no interaction or that the product is safe."
    )
    dosage_sentence = (
        f"{len(ctx.dosage_result['limits'])} adult reference limit(s) matched the official ingredients; actual intake is unknown and "
        "the table cannot determine personal dose safety."
    )
    return (
        f"You selected the NIH DSLD label '{ctx.identity['name']}' ({ctx.identity['brand'] or 'brand not listed'}). "
        "This is a user label selection, not clinical or physical-bottle verification. "
        f"{recall_sentence} {interaction_sentence} {dosage_sentence} "
        "Discuss the confirmed label, amount, and bottle lot/code with a pharmacist or clinician."
    )


def _response(ctx: RequestContext, status: str, missing: list[str] | None = None) -> dict[str, Any]:
    missing = missing or []
    interactions = ctx.interaction_result["findings"] if ctx.interaction_result else []
    dosage = ctx.dosage_result["limits"] if ctx.dosage_result else []
    response: dict[str, Any] = {
        "status": status,
        "checked_at": checked_at(),
        "answer": _deterministic_answer(ctx, status, missing),
        "tools": len(ctx.trace),
        "tool_trace": list(ctx.trace),
        "identity": ctx.identity,
        "candidates": ctx.candidates if not ctx.confirmed else [],
        "recall": ctx.recall,
        "interactions": interactions,
        "interaction_coverage": ctx.interaction_result.get("coverage") if ctx.interaction_result else None,
        "dosage": dosage,
        "dosage_coverage": ctx.dosage_result.get("coverage") if ctx.dosage_result else None,
        "provenance": {
            "identity": "NIH DSLD live catalog data after user label selection.",
            "recall": "openFDA food and drug enforcement text/category search; not lot matching.",
            "interactions": "Curated NIH/NCCIH reference rules, bounded coverage.",
            "dosage": "Small NIH ODS adult reference table; actual intake unknown.",
        },
    }
    if ctx.execution_error:
        response["error"] = ctx.execution_error
    return response


def run_medguard(
    scan_query: str,
    profile: dict[str, list[str]],
    selected_id: str | None = None,
    *,
    fetch_json: Callable[[str, int], dict[str, Any]] = get_json,
    agent_factory: Callable[..., Any] = Agent,
    model_factory: Callable[..., Any] = BedrockModel,
    agent_timeout: int = AGENT_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Run one isolated evidence workflow; test hooks are explicit and never runtime fallback."""
    # Direct callers receive the same normalization boundary as HTTP callers.
    scan_query, profile, selected_id = validate_medcheck_payload(
        {"scan": scan_query, "profile": profile, **({"selected_id": selected_id} if selected_id is not None else {})}
    )
    ctx = RequestContext(scan_query=scan_query, profile=profile, selected_id=selected_id, fetch_json=fetch_json)
    if unidentified_pill_query(scan_query):
        return _response(ctx, "unidentified")

    if selected_id is not None:
        try:
            selected, _lookup = fresh_selected_candidate(scan_query, selected_id, fetch_json=fetch_json)
        except OfficialDataError as error:
            ctx.execution_error = {
                "code": error.code,
                "message": "NIH DSLD is unavailable; retry before confirming a label.",
                **({"source_url": error.url} if error.url else {}),
            }
            return _response(ctx, "incomplete", ["identify_supplement"])
        if selected is None:
            raise RequestValidationError(
                "invalid_selected_id",
                "selected_id is not in fresh NIH DSLD results for this scan. Search again and choose a returned label.",
            )

    tools = make_request_tools(ctx)
    _run_agent(ctx, tools, agent_factory=agent_factory, model_factory=model_factory, agent_timeout=agent_timeout)
    required = ("identify_supplement",) if selected_id is None else (
        "identify_supplement", "check_recall", "check_interactions", "check_dosage"
    )
    missing = _missing_tools(ctx, required)
    if ctx.execution_error or missing:
        return _response(ctx, "incomplete", missing)
    return _response(ctx, "complete" if selected_id is not None else "needs_confirmation")


if __name__ == "__main__":
    result = run_medguard("fish oil", {"meds": ["warfarin"], "conditions": ["hypertension"]})
    print(json.dumps(result, indent=2))
