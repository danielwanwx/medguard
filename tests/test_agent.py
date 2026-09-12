"""Synthetic regression tests for MedGuard safety boundaries.

These tests inject a deterministic fake model and official-source responses. Runtime never
uses these fakes: production still constructs Strands + Bedrock Nova Pro and live URLs.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agent import (  # noqa: E402
    RequestContext,
    RequestValidationError,
    _agent_failure,
    make_request_tools,
    run_medguard,
    validate_medcheck_payload,
)
import medguard_data  # noqa: E402
from medguard_data import OfficialDataError, OfficialNotFound, dosage_references, interaction_check, openfda_recall  # noqa: E402


FISH_HIT = {
    "_id": "fish-1",
    "_source": {
        "fullName": "Example Fish Oil",
        "brandName": "Example Brand",
        "allIngredients": [{"name": "Fish Oil"}, {"name": "EPA"}, {"name": "DHA"}],
    },
}
SJ_HIT = {
    "_id": "sj-1",
    "_source": {
        "fullName": "Example St. John's Wort",
        "brandName": "Example Brand",
        "allIngredients": [{"name": "St. John's Wort"}],
    },
}
BAD_INGREDIENT_HIT = {
    "_id": "bad-ingredients-1",
    "_source": {"fullName": "Incomplete Label", "brandName": "Example Brand"},
}
EMPTY_INGREDIENT_HIT = {
    "_id": "empty-ingredients-1",
    "_source": {"fullName": "Empty Label", "brandName": "Example Brand", "allIngredients": []},
}


def fake_fetch(url: str, _timeout: int) -> dict:
    parsed = urlparse(url)
    source_search = parse_qs(parsed.query).get("search", [""])[0].casefold()
    if "dsld" in parsed.path:
        query = parse_qs(parsed.query).get("q", [""])[0].casefold()
        if "st john" in query:
            hits = [SJ_HIT]
        elif "bad schema" in query:
            hits = [BAD_INGREDIENT_HIT]
        elif "empty schema" in query:
            hits = [EMPTY_INGREDIENT_HIT]
        elif "missing" in query:
            hits = []
        else:
            hits = [FISH_HIT]
        return {"hits": hits}
    if "/food/enforcement.json" in parsed.path:
        product_description = "EXAMPLE FISH OIL 1000 MG"
        if "empty schema" in source_search:
            product_description = "EMPTY SCHEMA"
        elif "bad schema" in source_search:
            product_description = "BAD SCHEMA"
        return {
            "meta": {"last_updated": "2026-09-12"},
            "results": [
                {
                    "product_description": product_description,
                    "recalling_firm": "Example Foods",
                    "recall_number": "F-0001-2026",
                    "code_info": "LOT 42",
                    "reason_for_recall": "Synthetic packaging issue",
                    "recall_initiation_date": "20260101",
                    "status": "Terminated",
                    "classification": "Class II",
                }
            ],
        }
    if "/drug/enforcement.json" in parsed.path:
        return {
            "meta": {"last_updated": "2026-09-12"},
            "results": [
                {
                    "product_description": "DOCTOR D. SCHWAB CONTROLLING BALM WITH TEA TREE OIL",
                    "recalling_firm": "CA BOTANA International, Inc.",
                    "recall_number": "D-0185-2026",
                    "code_info": "D54361",
                    "recall_initiation_date": "20251010",
                    "status": "Ongoing",
                    "classification": "Class II",
                }
            ],
        }
    raise AssertionError(f"Unexpected URL: {url}")


class SyntheticResult:
    message = {"content": [{"text": "Tools completed; review the cited evidence."}]}


class AllToolsAgent:
    """A test-only model that invokes the supplied zero-argument tools in declared order."""

    def __init__(self, *, tools, **_kwargs):
        self.tools = tools

    async def invoke_async(self, _prompt):
        for item in self.tools:
            item()
        return SyntheticResult()


class IdentifyOnlyAgent(AllToolsAgent):
    async def invoke_async(self, _prompt):
        self.tools[0]()
        return SyntheticResult()


class TamperingAgent(AllToolsAgent):
    async def invoke_async(self, _prompt):
        self.tools[0]()
        # The actual schemas contain no properties. A model cannot supply invented facts.
        self.tools[1]("invented ingredient", "invented profile")
        return SyntheticResult()


def fake_model(**_kwargs):
    return object()


def run_synthetic(scan="fish oil", profile=None, selected_id=None, agent_factory=AllToolsAgent, fetch=fake_fetch):
    return run_medguard(
        scan,
        profile or {"meds": ["warfarin"], "conditions": []},
        selected_id,
        fetch_json=fetch,
        agent_factory=agent_factory,
        model_factory=fake_model,
    )


class MedGuardSafetyTests(unittest.TestCase):
    def test_first_lookup_requires_user_label_confirmation(self):
        result = run_synthetic(selected_id=None)
        self.assertEqual(result["status"], "needs_confirmation")
        self.assertIsNone(result["identity"])
        self.assertEqual(result["tools"], 1)
        self.assertEqual(result["candidates"][0]["id"], "fish-1")
        self.assertIn("not a physical-bottle match", result["answer"])

    def test_selected_id_must_be_fresh_official_candidate(self):
        with self.assertRaises(RequestValidationError) as raised:
            run_synthetic(selected_id="invented-by-client")
        self.assertEqual(raised.exception.code, "invalid_selected_id")

        result = run_synthetic(selected_id="fish-1")
        self.assertEqual(result["status"], "complete")
        self.assertTrue(result["identity"]["confirmed"])
        self.assertEqual(result["identity"]["confirmation"], "user_label_selection")
        self.assertEqual([row["tool"] for row in result["tool_trace"]], [
            "identify_supplement", "check_recall", "check_interactions", "check_dosage",
        ])

    def test_loose_no_imprint_pill_is_refused_without_network_or_identity(self):
        result = run_synthetic(scan="small white pill without imprint")
        self.assertEqual(result["status"], "unidentified")
        self.assertIsNone(result["identity"])
        self.assertEqual(result["tools"], 0)
        self.assertEqual(result["candidates"], [])
        self.assertEqual(run_synthetic(scan="mystery capsule")["status"], "unidentified")

    def test_quoted_food_and_drug_recall_search_excludes_unrelated_balm(self):
        result = openfda_recall("fish oil", fetch_json=fake_fetch)
        self.assertEqual(result["status"], "potential_matches")
        self.assertIsNone(result["recalled"])
        self.assertTrue(all(record["recall_number"] != "D-0185-2026" for record in result["records"]))
        self.assertEqual(result["records"][0]["recall_number"], "F-0001-2026")
        self.assertEqual(result["records"][0]["status"], "Terminated")
        self.assertIn('product_description%3A%22fish+oil%22', result["source_urls"][0])

    def test_fda_error_is_unavailable_not_false_no_match(self):
        def failing_fetch(url: str, timeout: int) -> dict:
            if "/drug/enforcement.json" in url:
                raise OfficialDataError("http_500", "synthetic source error", url)
            return fake_fetch(url, timeout)

        result = run_synthetic(selected_id="fish-1", fetch=failing_fetch)
        self.assertEqual(result["status"], "incomplete")
        self.assertEqual(result["recall"]["status"], "unavailable")
        self.assertIsNone(result["recall"]["recalled"])
        recall_trace = next(row for row in result["tool_trace"] if row["tool"] == "check_recall")
        self.assertEqual(recall_trace["status"], "error")

    def test_only_explicit_404_yields_no_match(self):
        def not_found_fetch(url: str, _timeout: int) -> dict:
            if "/enforcement.json" in url:
                raise OfficialNotFound(url)
            return fake_fetch(url, _timeout)

        result = openfda_recall("fish oil", fetch_json=not_found_fetch)
        self.assertEqual(result["status"], "no_match")
        self.assertIsNone(result["recalled"])

    def test_html_404_is_unavailable_not_not_found(self):
        error = HTTPError("https://example.test", 404, "Not Found", {}, io.BytesIO(b"<html>proxy page</html>"))
        with patch.object(medguard_data, "urlopen", side_effect=error):
            with self.assertRaises(OfficialDataError) as raised:
                medguard_data.get_json("https://example.test")
        self.assertNotIsInstance(raised.exception, OfficialNotFound)
        self.assertEqual(raised.exception.code, "http_404")

    def test_only_json_not_found_is_classified_as_no_match(self):
        error = HTTPError(
            "https://example.test", 404, "Not Found", {}, io.BytesIO(b'{"error":{"code":"NOT_FOUND"}}')
        )
        with patch.object(medguard_data, "urlopen", side_effect=error):
            with self.assertRaises(OfficialNotFound):
                medguard_data.get_json("https://example.test")

    def test_st_johns_wort_warfarin_is_directly_cited(self):
        findings = interaction_check(["St. John's Wort extract"], {"meds": ["warfarin"], "conditions": []})["findings"]
        finding = next(item for item in findings if item["against"] == "warfarin")
        self.assertEqual(finding["risk"], "HIGH")
        self.assertIn("st-johns-wort-and-depression-in-depth", finding["source_url"])

    def test_alias_matching_uses_token_boundaries_for_epa(self):
        profile = {"meds": ["warfarin"], "conditions": []}
        self.assertEqual(interaction_check(["Hepatopancreatic enzyme"], profile)["findings"], [])
        findings = interaction_check(["EPA"], profile)["findings"]
        self.assertEqual(findings[0]["risk"], "REVIEW")

    def test_missing_ingredient_schema_cannot_complete_a_review(self):
        first = run_synthetic(scan="bad schema", selected_id=None)
        self.assertEqual(first["candidates"][0]["ingredient_status"], "unavailable")
        confirmed = run_synthetic(scan="bad schema", selected_id="bad-ingredients-1")
        self.assertEqual(confirmed["status"], "incomplete")
        self.assertIsNone(confirmed["identity"])
        self.assertIn("identify_supplement", confirmed["answer"])

    def test_explicitly_empty_ingredient_list_is_labeled_unknown_not_reassuring(self):
        confirmed = run_synthetic(scan="empty schema", selected_id="empty-ingredients-1")
        self.assertEqual(confirmed["status"], "complete")
        self.assertEqual(confirmed["identity"]["ingredient_status"], "explicitly_empty")
        self.assertIn("coverage is unknown", confirmed["identity"]["ingredient_coverage"])
        self.assertNotIn("no dosage concerns", confirmed["answer"].casefold())

    def test_b6_reference_discloses_us_and_efsa_scope(self):
        b6 = dosage_references(["pyridoxine"])["limits"][0]
        self.assertIn("U.S. Food and Nutrition Board", b6["scope"])
        self.assertIn("EFSA", b6["scope"])

    def test_expired_aws_token_gets_actionable_safe_error(self):
        error = _agent_failure(Exception("ExpiredTokenException: synthetic provider detail"))
        self.assertEqual(error["code"], "authentication_required")
        self.assertIn("aws login --profile missing20-login", error["message"])
        self.assertNotIn("synthetic provider detail", error["message"])

    def test_request_shape_and_profile_limits_are_rejected_before_agent_use(self):
        with self.assertRaises(RequestValidationError) as missing_conditions:
            validate_medcheck_payload({"scan": "fish oil", "profile": {"meds": []}})
        self.assertEqual(missing_conditions.exception.code, "invalid_profile")
        with self.assertRaises(RequestValidationError) as oversized:
            validate_medcheck_payload({"scan": "x" * 161, "profile": {"meds": [], "conditions": []}})
        self.assertEqual(oversized.exception.code, "invalid_scan")

    def test_tampering_and_missing_tools_leave_review_incomplete(self):
        tampered = run_synthetic(selected_id="fish-1", agent_factory=TamperingAgent)
        self.assertEqual(tampered["status"], "incomplete")
        self.assertEqual(tampered["interactions"], [])
        self.assertNotIn("no dosage concerns", tampered["answer"].casefold())

        missing = run_synthetic(selected_id="fish-1", agent_factory=IdentifyOnlyAgent)
        self.assertEqual(missing["status"], "incomplete")
        self.assertIn("check_dosage", missing["answer"])
        self.assertNotIn("no dosage concerns", missing["answer"].casefold())

    def test_tools_have_no_model_supplied_arguments(self):
        ctx = RequestContext("fish oil", {"meds": ["warfarin"], "conditions": []}, "fish-1", fake_fetch)
        tools = make_request_tools(ctx)
        for item in tools:
            self.assertEqual(item.tool_spec["inputSchema"]["json"]["properties"], {})
        with self.assertRaises(TypeError):
            tools[2]("invented ingredients")

    def test_concurrent_profiles_do_not_mix_request_contexts(self):
        def check(profile):
            return run_synthetic(selected_id="fish-1", profile=profile)

        profiles = [
            {"meds": ["warfarin"], "conditions": []},
            {"meds": ["metformin"], "conditions": []},
        ]
        with ThreadPoolExecutor(max_workers=2) as pool:
            warfarin, metformin = list(pool.map(check, profiles))
        self.assertEqual(warfarin["status"], "complete")
        self.assertEqual(metformin["status"], "complete")
        self.assertEqual(warfarin["interactions"][0]["against"], "warfarin")
        self.assertEqual(metformin["interactions"], [])
        self.assertNotEqual(warfarin["tool_trace"], metformin["tool_trace"])


if __name__ == "__main__":
    unittest.main()
