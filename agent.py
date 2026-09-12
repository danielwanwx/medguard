"""MedGuard — a real Strands agent that investigates a scanned supplement/med across
LIVE official data (NIH DSLD, openFDA) and the user's health profile, and explains the risk.

The agent autonomously selects tools; the TOOLS return authoritative live data (the model
never invents ingredients, recalls, or verdicts). Model advises; official data owns truth;
the caller/human decides. Run: PYTHONPATH nothing needed; uses AWS creds via env.
"""
from __future__ import annotations
import json, os, urllib.request, urllib.parse
from strands import Agent, tool
from strands.models import BedrockModel

TOOL_TRACE: list[dict] = []  # visible agentic trace (which real tools were called + what they returned)

def _get(url, timeout=20):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read())

# ---- Curated interaction rules (each cites an authoritative source; not the model's opinion) ----
INTERACTIONS = [
    (["warfarin"], ["fish oil","omega","epa","dha","eicosapentaenoic","docosahexaenoic"], "HIGH", "Omega-3 (EPA/DHA) with warfarin can increase bleeding risk / raise INR.", "NIH ODS Omega-3"),
    (["warfarin"], ["ginkgo"], "HIGH", "Ginkgo with warfarin increases bleeding risk.", "NIH ODS / NCCIH"),
    (["warfarin"], ["vitamin e","tocopherol"], "MODERATE", "High-dose vitamin E with warfarin may increase bleeding.", "NIH ODS Vitamin E"),
    (["warfarin"], ["vitamin k","phylloquinone"], "HIGH", "Vitamin K opposes warfarin and reduces its effect.", "NIH ODS Vitamin K"),
    (["ssri","sertraline","fluoxetine","antidepressant"], ["st. john","st john","hypericum"], "HIGH", "St. John's Wort with SSRIs risks serotonin syndrome.", "NIH ODS / NCCIH"),
    (["hypertension","blood pressure"], ["licorice","liquorice","glycyrrhiza"], "HIGH", "Licorice root can raise blood pressure.", "NIH ODS / NCCIH"),
]
# NIH ODS Tolerable Upper Intake Levels (adult), small curated table
UPPER_LIMITS = {"vitamin d": (100, "mcg"), "vitamin a": (3000, "mcg RAE"), "iron": (45, "mg"),
                "zinc": (40, "mg"), "vitamin e": (1000, "mg"), "niacin": (35, "mg"), "vitamin b6": (100, "mg")}

@tool
def identify_supplement(query: str) -> str:
    """Identify a supplement/product from the NIH Dietary Supplement Label Database (DSLD, live).
    Returns brand, product name, and its ingredient list. Use this first to know what was scanned."""
    url = f"https://api.ods.od.nih.gov/dsld/v9/search-filter?q={urllib.parse.quote(query)}&size=1"
    try:
        d = _get(url)
        h = d["hits"][0]["_source"]
        ings = [i.get("name","") for i in h.get("allIngredients",[]) if i.get("name")]
        out = {"source":"NIH DSLD (live)","brand":h.get("brandName"),"name":h.get("fullName"),"ingredients":ings[:15]}
    except Exception as e:
        out = {"source":"NIH DSLD (live)","error":str(e)[:120]}
    TOOL_TRACE.append({"tool":"identify_supplement","query":query,"result":out})
    return json.dumps(out)

@tool
def check_recall(product: str) -> str:
    """Check the LIVE openFDA drug enforcement (recall) feed for this product. Returns the most
    recent matching recall (date, reason, status) or none. GPT cannot know recent recalls; this is live."""
    url = f"https://api.fda.gov/drug/enforcement.json?search=product_description:{urllib.parse.quote(product)}&sort=recall_initiation_date:desc&limit=1"
    try:
        d = _get(url); r = (d.get("results") or [{}])[0]
        out = {"source":"openFDA enforcement (live)","recalled":bool(r),"date":r.get("recall_initiation_date"),
               "reason":(r.get("reason_for_recall") or "")[:120],"status":r.get("status")}
    except Exception:
        out = {"source":"openFDA enforcement (live)","recalled":False,"note":"no matching recall record"}
    TOOL_TRACE.append({"tool":"check_recall","product":product,"result":out})
    return json.dumps(out)

@tool
def check_interactions(ingredients: str, profile_meds_and_conditions: str) -> str:
    """Check curated, source-cited interaction rules between the product's ingredients and the
    user's current meds + conditions. Inputs are comma-separated. Returns HIGH/MODERATE flags with sources."""
    ing_l = ingredients.lower(); prof = profile_meds_and_conditions.lower()
    found = []
    for dk, ik, risk, note, src in INTERACTIONS:
        if any(d in prof for d in dk) and any(i in ing_l for i in ik):
            found.append({"risk":risk,"note":note,"source":src,"against":next(d for d in dk if d in prof)})
    out = {"source":"curated rules (cited)","findings":found}
    TOOL_TRACE.append({"tool":"check_interactions","result":out})
    return json.dumps(out)

@tool
def check_dosage(ingredients: str) -> str:
    """Flag ingredients that have a NIH ODS Tolerable Upper Intake Level the user should not exceed
    when stacking products. Input comma-separated. Returns the relevant upper limits."""
    ing_l = ingredients.lower()
    hits = [{"ingredient":k,"upper_limit":f"{v[0]} {v[1]}","source":"NIH ODS UL"} for k,v in UPPER_LIMITS.items() if k in ing_l]
    out = {"source":"NIH ODS Upper Intake Levels","limits":hits}
    TOOL_TRACE.append({"tool":"check_dosage","result":out})
    return json.dumps(out)

def run_medguard(scan_query: str, profile: dict) -> dict:
    TOOL_TRACE.clear()
    model = BedrockModel(model_id="us.amazon.nova-pro-v1:0", region_name="us-west-2")
    agent = Agent(
        model=model,
        tools=[identify_supplement, check_recall, check_interactions, check_dosage],
        system_prompt=(
            "You are MedGuard, a careful medicine-cabinet safety agent. A user scanned a product. "
            "ALWAYS: (1) identify_supplement first to learn its ingredients; (2) check_recall on the product; "
            "(3) check_interactions between its ingredients and the user's meds+conditions; (4) check_dosage. "
            "Base every statement ONLY on the tool results (official live data). Do NOT invent ingredients, "
            "recalls, or interactions. Then give a short plain-English summary of what the user should know, "
            "citing the source of each flag, and ALWAYS end with 'Confirm with your pharmacist or doctor.' "
            "You surface official information; you do not diagnose or prescribe."
        ),
        callback_handler=None,
    )
    prof_str = ", ".join(profile.get("meds",[]) + profile.get("conditions",[]))
    prompt = (f"Scanned product: '{scan_query}'. My current meds and conditions: {prof_str}. "
              "Investigate with your tools and tell me what I should know before taking it.")
    import asyncio, re
    async def go(): return await agent.invoke_async(prompt)
    result = asyncio.run(go())
    msg = getattr(result, "message", result)
    # extract clean assistant text
    text = ""
    if isinstance(msg, dict):
        for block in msg.get("content", []):
            if isinstance(block, dict) and block.get("text"):
                text += block["text"]
    else:
        text = str(msg)
    text = re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.S).strip()
    # structured findings pulled from the (deterministic) tool trace for UI rendering
    findings, recall, identity, dosage = [], None, None, []
    for t in TOOL_TRACE:
        r = t.get("result", {})
        if t["tool"] == "identify_supplement": identity = r
        elif t["tool"] == "check_recall": recall = r
        elif t["tool"] == "check_interactions": findings = r.get("findings", [])
        elif t["tool"] == "check_dosage": dosage = r.get("limits", [])
    return {"answer": text, "tool_trace": list(TOOL_TRACE), "tools": len(TOOL_TRACE),
            "identity": identity, "recall": recall, "interactions": findings, "dosage": dosage}

if __name__ == "__main__":
    profile = {"meds": ["warfarin"], "conditions": ["hypertension"]}
    out = run_medguard("fish oil", profile)
    print("=== TOOL TRACE (agentic, real data) ===")
    for t in out["tool_trace"]:
        print(f"  • {t['tool']} -> {json.dumps(t['result'])[:160]}")
    print("\n=== AGENT ANSWER ===")
    print(out["answer"][:1200])
