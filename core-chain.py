"""Public-data MedGuard chain for a terminal inspection, with no AWS or Strands dependency.

It uses the exact DSLD, openFDA, interaction, and dosage functions used by the HTTP agent.
Run it only with a catalog ID selected from its first result; it never guesses a bottle label.
"""
from __future__ import annotations

import json
import sys
from typing import Any

from medguard_data import (
    OfficialDataError,
    checked_at,
    dosage_references,
    fresh_selected_candidate,
    interaction_check,
    lookup_dsld_candidates,
    openfda_recall,
    unidentified_pill_query,
)


def run_public_chain(scan: str, profile: dict[str, list[str]], selected_id: str | None = None) -> dict[str, Any]:
    """Perform the same evidence checks as MedGuard without a model or AWS credentials."""
    scan = scan.strip()
    if unidentified_pill_query(scan):
        return {
            "status": "unidentified",
            "checked_at": checked_at(),
            "identity": None,
            "candidates": [],
            "recall": None,
            "interactions": [],
            "dosage": [],
            "answer": "Loose or unknown pills without an imprint and bottle label are not identified by this workflow.",
        }
    try:
        if selected_id is None:
            lookup = lookup_dsld_candidates(scan)
            return {
                "status": "needs_confirmation",
                "checked_at": checked_at(),
                "identity": None,
                "candidates": lookup["candidates"],
                "recall": None,
                "interactions": [],
                "dosage": [],
                "answer": "Choose a returned NIH DSLD catalog label before evidence checks run.",
            }
        candidate, _lookup = fresh_selected_candidate(scan, selected_id)
    except OfficialDataError as error:
        return {
            "status": "incomplete",
            "checked_at": checked_at(),
            "identity": None,
            "candidates": [],
            "recall": None,
            "interactions": [],
            "dosage": [],
            "error": {
                "code": error.code,
                "message": "Official source data is unavailable; retry this review.",
                **({"source_url": error.url} if error.url else {}),
            },
            "answer": "Review incomplete; missing source data is not reassurance.",
        }
    if candidate is None:
        return {
            "status": "incomplete",
            "checked_at": checked_at(),
            "identity": None,
            "candidates": [],
            "recall": None,
            "interactions": [],
            "dosage": [],
            "error": {"code": "invalid_selected_id", "message": "Select an ID from fresh NIH DSLD results."},
            "answer": "Review incomplete; select a current catalog label before checking evidence.",
        }
    if candidate["ingredient_status"] == "unavailable":
        return {
            "status": "incomplete",
            "checked_at": checked_at(),
            "identity": None,
            "candidates": [],
            "recall": None,
            "interactions": [],
            "dosage": [],
            "error": {
                "code": "ingredient_schema_unavailable",
                "message": "NIH DSLD did not return a usable ingredient list for this label.",
            },
            "answer": "Review incomplete; missing label ingredients are not reassurance.",
        }

    identity = {
        **candidate,
        "confirmed": True,
        "confirmation": "user_label_selection",
        "clinical_verification": "not_clinically_verified",
    }
    recall = openfda_recall(scan)
    interactions = interaction_check(identity["ingredients"], profile)
    dosage = dosage_references(identity["ingredients"])
    status = "complete" if recall["status"] != "unavailable" else "incomplete"
    return {
        "status": status,
        "checked_at": checked_at(),
        "identity": identity,
        "candidates": [],
        "recall": recall,
        "interactions": interactions["findings"],
        "interaction_coverage": interactions["coverage"],
        "dosage": dosage["limits"],
        "dosage_coverage": dosage["coverage"],
        "answer": (
            "Public-source evidence collected. Recall records are potential text/category matches and actual intake is unknown; "
            "discuss the confirmed label, amount, and lot/code with a pharmacist or clinician."
            if status == "complete" else
            "Review incomplete; unavailable recall data is not reassurance."
        ),
    }


if __name__ == "__main__":
    query = " ".join(sys.argv[1:]) or "fish oil"
    first = run_public_chain(query, {"meds": ["warfarin"], "conditions": ["hypertension"]})
    print(json.dumps(first, indent=2))
    if first["status"] == "needs_confirmation" and first["candidates"]:
        selected = first["candidates"][0]["id"]
        print("\n--- Explicitly selected first displayed catalog label for this CLI demonstration ---")
        print(json.dumps(run_public_chain(query, {"meds": ["warfarin"], "conditions": ["hypertension"]}, selected), indent=2))
