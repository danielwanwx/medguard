"""Amazon Bedrock AgentCore Runtime entrypoint for MedGuard.

Hosts the real MedGuard Strands agent (Nova Pro + 4 live-official-source tools) behind an
AgentCore Runtime. The payload is {"scan": "...", "profile": {"meds": [...], "conditions": [...]},
"selected_id": "..."}; the response is the same structured finding the local server returns.

Run locally for the contract test without cloud SDKs; in AgentCore the BedrockAgentCoreApp
decorator and app.run() entrypoint are used.
"""
from __future__ import annotations

import json
import os
import sys
from typing import Any

# Make the sibling MedGuard modules importable whether run from repo root or this dir.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent import run_medguard  # noqa: E402

try:  # AgentCore SDK is only present in the deployed runtime / when installed.
    from bedrock_agentcore.runtime import BedrockAgentCoreApp
except ImportError:  # pragma: no cover
    BedrockAgentCoreApp = None  # type: ignore[assignment,misc]


def _normalise(payload: Any) -> dict[str, Any]:
    if isinstance(payload, str):
        payload = json.loads(payload or "{}")
    if not isinstance(payload, dict):
        raise ValueError("payload must be a JSON object")
    scan = str(payload.get("scan", "")).strip()
    if not scan:
        raise ValueError("scan is required")
    profile = payload.get("profile") or {"meds": [], "conditions": []}
    selected_id = payload.get("selected_id")
    return {"scan": scan, "profile": profile, "selected_id": selected_id}


def handle(payload: Any) -> dict[str, Any]:
    args = _normalise(payload)
    try:
        return run_medguard(args["scan"], args["profile"], args.get("selected_id"))
    except TypeError:
        # Local agent signature may be run_medguard(scan, profile); stay compatible.
        return run_medguard(args["scan"], args["profile"])


if BedrockAgentCoreApp is not None:
    app = BedrockAgentCoreApp()

    @app.entrypoint
    def invoke(payload: Any) -> dict[str, Any]:
        return handle(payload)

    if __name__ == "__main__":
        app.run()
else:  # local contract check without the SDK
    if __name__ == "__main__":
        demo = {"scan": "moringa", "profile": {"meds": ["warfarin"], "conditions": ["hypertension"]}}
        print(json.dumps(handle(demo))[:400])
