"""MedGuard 'Ask the agent' — answer a user's follow-up question grounded ONLY in the evidence
already gathered for the current product (identity, recall records, curated interaction prompts,
dosage references) and the user's profile. The model explains in plain language, cites the source
of any flag, never invents facts, and always defers the decision to a pharmacist/clinician.
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any

MODEL_ID = "us.amazon.nova-pro-v1:0"
REGION = os.environ.get("AWS_REGION", "us-west-2")
MAX_QUESTION = 400


def _context_brief(context: dict[str, Any]) -> str:
    """Compact, factual brief from the already-gathered evidence. No fabrication."""
    identity = context.get("identity") or {}
    recall = context.get("recall") or {}
    interactions = context.get("interactions") or []
    dosage = context.get("dosage") or []
    profile = context.get("profile") or {}

    recall_records = recall.get("records") or []
    recall_lines = [
        f"- {r.get('product_description','')[:80]} | status {r.get('status','?')} | reason {(r.get('reason_for_recall') or '')[:80]}"
        for r in recall_records[:5]
    ]
    inter_lines = [
        f"- {f.get('risk','')} vs {f.get('against','')}: {f.get('note','')} (source {f.get('source','')})"
        for f in interactions
    ]
    dose_lines = [f"- {d.get('ingredient','')}: {d.get('upper_limit','')} ({d.get('source','')})" for d in dosage]

    return (
        f"PRODUCT: {identity.get('name','?')} — {identity.get('brand','')}\n"
        f"INGREDIENTS: {', '.join((identity.get('ingredients') or [])[:12]) or 'unknown'}\n"
        f"USER MEDICINES: {', '.join(profile.get('meds') or []) or 'none listed'}\n"
        f"USER CONDITIONS: {', '.join(profile.get('conditions') or []) or 'none listed'}\n"
        f"RECALL SEARCH ({recall.get('status','?')}): "
        + ("potential matches:\n" + "\n".join(recall_lines) if recall_lines else "no matching records") + "\n"
        f"INTERACTION PROMPTS:\n" + ("\n".join(inter_lines) if inter_lines else "- none from the curated set") + "\n"
        f"DOSAGE REFERENCES:\n" + ("\n".join(dose_lines) if dose_lines else "- none matched") + "\n"
    )


def answer_question(question: str, context: dict[str, Any]) -> dict[str, Any]:
    q = (question or "").strip()
    if not q:
        raise ValueError("A question is required.")
    if len(q) > MAX_QUESTION:
        q = q[:MAX_QUESTION]
    brief = _context_brief(context)

    async def run() -> str:
        import boto3
        from strands import Agent
        from strands.models import BedrockModel

        model = BedrockModel(
            boto_session=boto3.Session(profile_name=os.environ.get("AWS_PROFILE") or None, region_name=REGION),
            model_id=MODEL_ID,
        )
        agent = Agent(
            model=model,
            system_prompt=(
                "You are MedGuard's assistant. Answer the user's question about ONE product using ONLY the "
                "evidence brief provided — do not add facts, recalls, interactions, or dosages that are not in it. "
                "Be brief, plain, and friendly (2-4 short sentences). When you mention a flag, name its source. "
                "If the brief does not cover the question, say so plainly and suggest asking a pharmacist. "
                "A recall search returning matches is 'compare your product and lot', not 'your bottle is recalled'. "
                "Never diagnose or tell the user to start/stop a medicine. Always end by pointing them to their "
                "pharmacist or doctor for the decision."
            ),
            callback_handler=None,
        )
        prompt = f"EVIDENCE BRIEF:\n{brief}\n\nUSER QUESTION: {q}\n\nAnswer using only the brief."
        result = await asyncio.wait_for(agent.invoke_async(prompt), timeout=60)
        msg = getattr(result, "message", result)
        text = ""
        if isinstance(msg, dict):
            for block in msg.get("content", []):
                if isinstance(block, dict) and block.get("text"):
                    text += block["text"]
        else:
            text = str(msg)
        return text.strip()

    answer = asyncio.run(run())
    return {"answer": answer, "source": "Bedrock Nova Pro (grounded in this product's evidence)"}


if __name__ == "__main__":
    ctx = {
        "identity": {"name": "Fish Oil", "brand": "Nordic Naturals", "ingredients": ["Eicosapentaenoic Acid", "Docosahexaenoic Acid"]},
        "profile": {"meds": ["warfarin"], "conditions": ["hypertension"]},
        "interactions": [{"risk": "REVIEW", "against": "warfarin", "note": "Omega-3 with warfarin may affect bleeding/INR.", "source": "NIH ODS Omega-3"}],
        "recall": {"status": "no_match", "records": []},
        "dosage": [],
    }
    print(json.dumps(answer_question("Is this safe with my warfarin?", ctx), indent=1))
