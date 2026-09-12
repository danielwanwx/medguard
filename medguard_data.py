"""Pure, evidence-owning data helpers for MedGuard.

This module deliberately has no Strands, Bedrock, server, or persistence dependency so the
CLI data chain and the HTTP agent use the same official-source and curated-rule semantics.
"""
from __future__ import annotations

from datetime import datetime, timezone
import json
import re
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen


DSLD_SEARCH = "https://api.ods.od.nih.gov/dsld/v9/search-filter"
OPENFDA_BASE = "https://api.fda.gov"
SOURCE_TIMEOUT_SECONDS = 8


class OfficialDataError(RuntimeError):
    """A source failure with a safe, machine-readable reason for callers."""

    def __init__(self, code: str, message: str, url: str | None = None):
        super().__init__(message)
        self.code = code
        self.url = url


class OfficialNotFound(OfficialDataError):
    def __init__(self, url: str):
        super().__init__("not_found", "The official source returned NOT_FOUND.", url)


def checked_at() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def get_json(url: str, timeout: int = SOURCE_TIMEOUT_SECONDS) -> dict[str, Any]:
    """Fetch an official JSON endpoint without exposing transport internals to users."""
    try:
        with urlopen(url, timeout=timeout) as response:  # nosec B310 -- fixed official URLs only
            value = json.loads(response.read())
    except HTTPError as exc:
        # Only openFDA's documented JSON NOT_FOUND response is evidence of a no-match.
        # A proxy/HTML 404 is an unavailable source, never a false negative.
        error_code = None
        try:
            error_body = json.loads(exc.read().decode("utf-8"))
            if isinstance(error_body, dict) and isinstance(error_body.get("error"), dict):
                error_code = error_body["error"].get("code")
        except (UnicodeDecodeError, json.JSONDecodeError, OSError):
            pass
        if exc.code == 404 and error_code == "NOT_FOUND":
            raise OfficialNotFound(url) from exc
        raise OfficialDataError(f"http_{exc.code}", "The official source returned an HTTP error.", url) from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise OfficialDataError("transport_error", "The official source could not be reached.", url) from exc
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise OfficialDataError("malformed_response", "The official source returned malformed data.", url) from exc
    if not isinstance(value, dict):
        raise OfficialDataError("malformed_response", "The official source returned malformed data.", url)
    return value


def _fetch(fetch_json: Callable[[str, int], dict[str, Any]], url: str) -> dict[str, Any]:
    value = fetch_json(url, SOURCE_TIMEOUT_SECONDS)
    if not isinstance(value, dict):
        raise OfficialDataError("malformed_response", "The official source returned malformed data.", url)
    return value


def _as_clean_string(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _ingredient_names(source: dict[str, Any]) -> tuple[list[str], str]:
    if "allIngredients" not in source:
        return [], "unavailable"
    values = source.get("allIngredients")
    if not isinstance(values, list):
        return [], "unavailable"
    if not values:
        return [], "explicitly_empty"
    result: list[str] = []
    seen: set[str] = set()
    for item in values:
        if not isinstance(item, dict):
            return [], "unavailable"
        name = _as_clean_string(item.get("name"))
        key = name.casefold()
        if name and key not in seen:
            result.append(name)
            seen.add(key)
    return result, "available"


def _candidate(hit: dict[str, Any], source_url: str) -> dict[str, Any] | None:
    source = hit.get("_source")
    identifier = _as_clean_string(hit.get("_id"))
    if not isinstance(source, dict) or not identifier:
        return None
    name = _as_clean_string(source.get("fullName"))
    if not name:
        return None
    ingredients, ingredient_status = _ingredient_names(source)
    return {
        "id": identifier,
        "name": name,
        "brand": _as_clean_string(source.get("brandName")),
        "ingredients": ingredients,
        "ingredient_status": ingredient_status,
        "ingredient_coverage": (
            "NIH DSLD explicitly returned an empty ingredient list; ingredient coverage is unknown."
            if ingredient_status == "explicitly_empty" else
            "NIH DSLD did not return a usable ingredient list; do not use this candidate for interaction or dosage review."
            if ingredient_status == "unavailable" else
            "Ingredient names are copied from the NIH DSLD label record."
        ),
        "source": "NIH Dietary Supplement Label Database (DSLD)",
        "source_url": source_url,
    }


def dsld_search_url(query: str, size: int = 5) -> str:
    # urlencode keeps arbitrary user text out of the endpoint's query grammar.
    return f"{DSLD_SEARCH}?{urlencode({'q': query, 'size': min(max(size, 1), 5)})}"


def lookup_dsld_candidates(
    query: str, *, fetch_json: Callable[[str, int], dict[str, Any]] = get_json
) -> dict[str, Any]:
    """Return only direct NIH DSLD search candidates; never assert a bottle match."""
    source_url = dsld_search_url(query)
    payload = _fetch(fetch_json, source_url)
    hits = payload.get("hits")
    if not isinstance(hits, list):
        raise OfficialDataError("malformed_response", "NIH DSLD returned an unexpected search result.", source_url)
    candidates = [candidate for hit in hits[:5] if isinstance(hit, dict) and (candidate := _candidate(hit, source_url))]
    return {
        "source": "NIH Dietary Supplement Label Database (DSLD)",
        "source_url": source_url,
        "retrieved_at": checked_at(),
        "candidates": candidates,
    }


def fresh_selected_candidate(
    query: str, selected_id: str, *, fetch_json: Callable[[str, int], dict[str, Any]] = get_json
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    """Re-query DSLD and return a selection only when it appears in fresh official results."""
    lookup = lookup_dsld_candidates(query, fetch_json=fetch_json)
    return next((item for item in lookup["candidates"] if item["id"] == selected_id), None), lookup


def unidentified_pill_query(query: str) -> bool:
    """Fail closed for the loose-pill descriptions an online label lookup cannot verify."""
    value = " ".join(_tokens(query))
    explicit = (
        "no imprint", "without imprint", "unknown pill", "unknown tablet", "unknown capsule",
        "unidentified pill", "unidentified tablet", "unidentified capsule", "loose pill", "loose tablet",
        "loose capsule", "unmarked pill", "unmarked tablet", "unmarked capsule", "no markings", "no mark",
    )
    if any(phrase in value for phrase in explicit):
        return True
    pill_words = {"pill", "pills", "tablet", "tablets", "capsule", "capsules", "softgel", "softgels", "caplet", "caplets"}
    descriptor_words = {
        "white", "blue", "pink", "red", "yellow", "green", "round", "oval", "oblong", "small", "large",
        "one", "a", "an", "the", "with", "and", "no", "mark", "markings", "imprint", "unknown",
    }
    tokens = set(_tokens(query))
    loose_words = {"unknown", "unidentified", "mystery", "unmarked", "loose"}
    return bool(tokens & pill_words) and bool(tokens) and (bool(tokens & loose_words) or tokens <= (pill_words | descriptor_words))


def _tokens(value: str) -> list[str]:
    # Keep possessive label names together: "John's" and "Johns" are the same alias.
    return re.findall(r"[a-z0-9]+", value.casefold().replace("'", "").replace("’", "").replace("‘", ""))


def _has_alias(values: list[str], aliases: tuple[str, ...]) -> bool:
    haystack = _tokens(" ".join(values))
    for alias in aliases:
        target = _tokens(alias)
        if not target:
            continue
        width = len(target)
        if any(haystack[index : index + width] == target for index in range(len(haystack) - width + 1)):
            return True
    return False


def _profile_match(values: list[str], aliases: tuple[str, ...]) -> str | None:
    for value in values:
        if _has_alias([value], aliases):
            return value
    return None


INTERACTION_RULES = (
    {
        "profile": ("warfarin",),
        "ingredients": ("fish oil", "omega 3", "epa", "dha", "eicosapentaenoic", "docosahexaenoic"),
        "risk": "REVIEW",
        "review_priority": "caution",
        "note": (
            "Omega-3 products merit a pharmacist review with warfarin. NIH ODS describes mixed evidence "
            "and notes INR monitoring; do not change either product from this result alone."
        ),
        "source": "NIH ODS Omega-3 Fact Sheet for Health Professionals",
        "source_url": "https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/#h8",
    },
    {
        "profile": ("warfarin",),
        "ingredients": ("ginkgo", "ginkgo biloba"),
        "risk": "HIGH",
        "review_priority": "high",
        "note": "NCCIH advises discussing ginkgo with a clinician when taking medicines, including warfarin.",
        "source": "NCCIH: Ginkgo",
        "source_url": "https://www.nccih.nih.gov/health/ginkgo",
    },
    {
        "profile": ("warfarin",),
        "ingredients": ("vitamin e", "tocopherol", "alpha tocopherol"),
        "risk": "MODERATE",
        "review_priority": "moderate",
        "note": "Vitamin E can affect clotting at high supplemental amounts; review a full label and warfarin plan with a clinician.",
        "source": "NIH ODS Vitamin E Fact Sheet for Health Professionals",
        "source_url": "https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/",
    },
    {
        "profile": ("warfarin",),
        "ingredients": ("vitamin k", "phylloquinone", "menaquinone"),
        "risk": "HIGH",
        "review_priority": "high",
        "note": "Vitamin K can alter warfarin management. Keep intake changes under the direction of the clinician managing warfarin.",
        "source": "NIH ODS Vitamin K Fact Sheet for Health Professionals",
        "source_url": "https://ods.od.nih.gov/factsheets/VitaminK-HealthProfessional/",
    },
    {
        "profile": ("warfarin",),
        "ingredients": ("st johns wort", "st john wort", "hypericum"),
        "risk": "HIGH",
        "review_priority": "high",
        "note": "NCCIH lists warfarin among medicines whose effects St. John's Wort can weaken.",
        "source": "NCCIH: St. John's Wort and Depression (In Depth)",
        "source_url": "https://www.nccih.nih.gov/health/st-johns-wort-and-depression-in-depth",
    },
    {
        "profile": ("ssri", "sertraline", "fluoxetine", "citalopram", "escitalopram", "paroxetine"),
        "ingredients": ("st johns wort", "st john wort", "hypericum"),
        "risk": "HIGH",
        "review_priority": "high",
        "note": "St. John's Wort can interact with antidepressants, including SSRIs; discuss this combination before use.",
        "source": "NCCIH: St. John's Wort and Depression (In Depth)",
        "source_url": "https://www.nccih.nih.gov/health/st-johns-wort-and-depression-in-depth",
    },
    {
        "profile": ("hypertension", "blood pressure"),
        "ingredients": ("licorice", "liquorice", "glycyrrhiza"),
        "risk": "HIGH",
        "review_priority": "high",
        "note": "Licorice can raise blood pressure and can interact with medicines; discuss it with a clinician if you have hypertension.",
        "source": "NCCIH: Licorice Root",
        "source_url": "https://www.nccih.nih.gov/health/licorice-root",
    },
)


def interaction_check(ingredients: list[str], profile: dict[str, list[str]]) -> dict[str, Any]:
    """Match bounded, cited rules using whole-token aliases, never substring coincidence."""
    profile_values = [*profile.get("meds", []), *profile.get("conditions", [])]
    findings: list[dict[str, Any]] = []
    for rule in INTERACTION_RULES:
        against = _profile_match(profile_values, rule["profile"])
        if against and _has_alias(ingredients, rule["ingredients"]):
            findings.append(
                {
                    "risk": rule["risk"],
                    "review_priority": rule["review_priority"],
                    "against": against,
                    "note": rule["note"],
                    "source": rule["source"],
                    "source_url": rule["source_url"],
                    "severity_note": "MedGuard review priority, not an official clinical severity rating.",
                }
            )
    return {
        "source": "Curated NIH/NCCIH reference rules",
        "findings": findings,
        "coverage": (
            "This is a small, curated reference set. No matching rule does not mean no interaction, "
            "no reported interaction, or that this product is safe for you."
        ),
    }


DOSAGE_REFERENCES = (
    {
        "aliases": ("vitamin d", "cholecalciferol", "ergocalciferol"),
        "ingredient": "Vitamin D",
        "adult_reference_limit": "100 mcg (4,000 IU) per day",
        "scope": "Adult tolerable upper intake level from all sources unless a clinician directs otherwise.",
        "source": "NIH ODS Vitamin D Fact Sheet for Health Professionals",
        "source_url": "https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/",
    },
    {
        "aliases": ("vitamin a", "retinol", "retinyl"),
        "ingredient": "Vitamin A",
        "adult_reference_limit": "3,000 mcg RAE per day",
        "scope": "Applies to preformed vitamin A; it is not a beta-carotene limit.",
        "source": "NIH ODS Vitamin A Fact Sheet for Health Professionals",
        "source_url": "https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional/",
    },
    {
        "aliases": ("iron",),
        "ingredient": "Iron",
        "adult_reference_limit": "45 mg per day",
        "scope": "Adult tolerable upper intake level; individual clinical directions can differ.",
        "source": "NIH ODS Iron Fact Sheet for Health Professionals",
        "source_url": "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/",
    },
    {
        "aliases": ("zinc",),
        "ingredient": "Zinc",
        "adult_reference_limit": "40 mg per day",
        "scope": "Adult tolerable upper intake level from all sources.",
        "source": "NIH ODS Zinc Fact Sheet for Health Professionals",
        "source_url": "https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/",
    },
    {
        "aliases": ("vitamin e", "tocopherol", "alpha tocopherol"),
        "ingredient": "Vitamin E",
        "adult_reference_limit": "1,000 mg per day",
        "scope": "Adult upper limit for supplemental alpha-tocopherol; formulation and total intake matter.",
        "source": "NIH ODS Vitamin E Fact Sheet for Health Professionals",
        "source_url": "https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/",
    },
    {
        "aliases": ("niacin", "nicotinic acid", "nicotinamide"),
        "ingredient": "Niacin",
        "adult_reference_limit": "35 mg per day",
        "scope": "Adult upper limit for supplemental niacin, not niacin naturally present in food.",
        "source": "NIH ODS Niacin Fact Sheet for Health Professionals",
        "source_url": "https://ods.od.nih.gov/factsheets/Niacin-HealthProfessional/",
    },
    {
        "aliases": ("vitamin b6", "pyridoxine"),
        "ingredient": "Vitamin B6",
        "adult_reference_limit": "100 mg per day",
        "scope": (
            "U.S. Food and Nutrition Board adult upper limit (100 mg/day). NIH ODS also reports a newer "
            "EFSA adult upper limit of 12 mg/day; this row is not a universal personal-dose limit."
        ),
        "source": "NIH ODS Vitamin B6 Fact Sheet for Health Professionals",
        "source_url": "https://ods.od.nih.gov/factsheets/VitaminB6-HealthProfessional/",
    },
)


def dosage_references(ingredients: list[str]) -> dict[str, Any]:
    limits = []
    for row in DOSAGE_REFERENCES:
        if _has_alias(ingredients, row["aliases"]):
            limits.append({key: value for key, value in row.items() if key != "aliases"})
    return {
        "source": "NIH ODS adult reference table",
        "limits": limits,
        "coverage": (
            "Actual product amount, servings, other products, diet, and personal directions are unknown. "
            "These references cannot determine whether a personal dose is safe."
        ),
    }


def _recall_phrase(value: str) -> str:
    # A literal phrase query is safer than passing user text into openFDA's query language.
    return " ".join(_tokens(value))[:120]


def openfda_search_url(feed: str, phrase: str) -> str:
    if feed not in {"food", "drug"}:
        raise ValueError("Unsupported openFDA feed")
    literal_phrase = _recall_phrase(phrase)
    search = f'product_description:"{literal_phrase}"'
    return f"{OPENFDA_BASE}/{feed}/enforcement.json?{urlencode({'search': search, 'sort': 'recall_initiation_date:desc', 'limit': 5})}"


def _record_matches_phrase(record: dict[str, Any], phrase: str) -> bool:
    target = _tokens(_recall_phrase(phrase))
    description = _tokens(_as_clean_string(record.get("product_description")))
    if not target:
        return False
    width = len(target)
    return any(description[index : index + width] == target for index in range(len(description) - width + 1))


def _recall_record(record: dict[str, Any], feed: str, api_url: str, retrieved_at: str) -> dict[str, Any]:
    return {
        "feed": feed,
        "product_description": _as_clean_string(record.get("product_description")),
        "recalling_firm": _as_clean_string(record.get("recalling_firm")),
        "recall_number": _as_clean_string(record.get("recall_number")),
        "code_info": _as_clean_string(record.get("code_info")),
        "reason_for_recall": _as_clean_string(record.get("reason_for_recall")),
        "dates": {
            "recall_initiation_date": _as_clean_string(record.get("recall_initiation_date")),
            "report_date": _as_clean_string(record.get("report_date")),
            "termination_date": _as_clean_string(record.get("termination_date")),
            "center_classification_date": _as_clean_string(record.get("center_classification_date")),
        },
        "status": _as_clean_string(record.get("status")),
        "classification": _as_clean_string(record.get("classification")),
        "api_url": api_url,
        "retrieved_at": retrieved_at,
    }


def _last_updated(payload: dict[str, Any]) -> str | None:
    meta = payload.get("meta")
    if not isinstance(meta, dict):
        return None
    value = meta.get("last_updated")
    if isinstance(value, str):
        return value
    results = meta.get("results")
    return results.get("last_updated") if isinstance(results, dict) and isinstance(results.get("last_updated"), str) else None


def openfda_recall(
    phrase: str, *, fetch_json: Callable[[str, int], dict[str, Any]] = get_json
) -> dict[str, Any]:
    """Return potential product-description matches from both enforcement feeds.

    It deliberately never says a user's bottle is recalled: a lot/code match is unavailable here.
    """
    retrieved_at = checked_at()
    feeds: list[dict[str, Any]] = []
    records: list[dict[str, Any]] = []
    source_errors: list[dict[str, str]] = []
    not_found_feeds = 0
    for feed in ("food", "drug"):
        api_url = openfda_search_url(feed, phrase)
        try:
            payload = _fetch(fetch_json, api_url)
        except OfficialNotFound:
            not_found_feeds += 1
            feeds.append({"feed": feed, "api_url": api_url, "status": "not_found"})
            continue
        except OfficialDataError as exc:
            source_errors.append({"feed": feed, "code": exc.code, "api_url": api_url})
            feeds.append({"feed": feed, "api_url": api_url, "status": "unavailable", "error_code": exc.code})
            continue

        raw_records = payload.get("results")
        if not isinstance(raw_records, list) or not raw_records:
            source_errors.append({"feed": feed, "code": "malformed_response", "api_url": api_url})
            feeds.append({"feed": feed, "api_url": api_url, "status": "unavailable", "error_code": "malformed_response"})
            continue
        matched = [record for record in raw_records if isinstance(record, dict) and _record_matches_phrase(record, phrase)]
        records.extend(_recall_record(record, feed, api_url, retrieved_at) for record in matched)
        feeds.append(
            {
                "feed": feed,
                "api_url": api_url,
                "status": "success",
                "last_updated": _last_updated(payload),
                "returned_records": len(raw_records),
                "matched_records": len(matched),
            }
        )

    if source_errors:
        status = "unavailable"
    elif records:
        status = "potential_matches"
    elif not_found_feeds == 2:
        status = "no_match"
    else:
        # A non-404 empty/malformed result is deliberately not evidence of no matching record.
        status = "unavailable"
    return {
        "source": "openFDA food and drug enforcement feeds",
        "source_urls": [feed["api_url"] for feed in feeds],
        "query_phrase": _recall_phrase(phrase),
        "status": status,
        "recalled": None,
        "records": records,
        "retrieved_at": retrieved_at,
        "metadata": {
            "feeds": feeds,
            "last_updated": {feed["feed"]: feed.get("last_updated") for feed in feeds if feed.get("last_updated")},
        },
        "source_errors": source_errors,
        "coverage": (
            "These are potential text/category matches only. They do not establish that your bottle is recalled. "
            "Compare the exact product, lot/code, and FDA status with the bottle before acting; a terminated "
            "record is not represented as active."
        ),
    }
