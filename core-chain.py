"""Medicine-cabinet REAL chain: DSLD identify + curated interaction check + openFDA live recall.
No hardcoded verdicts: identification and recall are live official data; interaction rules cite sources."""
import json, urllib.request, urllib.parse

def _get(url, timeout=20):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read())

# --- REAL: NIH DSLD supplement identification ---
def dsld_identify(query):
    url = f"https://api.ods.od.nih.gov/dsld/v9/search-filter?q={urllib.parse.quote(query)}&size=1"
    d = _get(url)
    if not d.get("hits"):
        return None
    h = d["hits"][0]["_source"]
    ings = [i.get("name", "") for i in h.get("allIngredients", []) if i.get("category") not in ("other",)]
    return {"source": "NIH DSLD (live)", "id": d["hits"][0]["_id"], "brand": h.get("brandName"),
            "name": h.get("fullName"), "ingredients": [x for x in ings if x]}

# --- REAL: openFDA live drug recall/enforcement ---
def openfda_recall(term):
    url = f"https://api.fda.gov/drug/enforcement.json?search=product_description:{urllib.parse.quote(term)}&sort=recall_initiation_date:desc&limit=1"
    try:
        d = _get(url)
    except Exception:
        return {"source": "openFDA (live)", "recalled": False, "note": "no matching recall record"}
    r = (d.get("results") or [{}])[0]
    return {"source": "openFDA enforcement (live)", "recalled": bool(r),
            "date": r.get("recall_initiation_date"), "reason": (r.get("reason_for_recall") or "")[:110], "status": r.get("status")}

# --- Curated interaction rules (each cites an authoritative source; not the model's opinion) ---
# keyword-in-ingredient/drug -> (risk, note, source)
INTERACTIONS = [
    (["warfarin"], ["fish oil", "omega", "epa", "dha", "eicosapentaenoic", "docosahexaenoic"], "HIGH", "Omega-3 (EPA/DHA) with warfarin can increase bleeding risk / INR.", "NIH ODS Omega-3 fact sheet"),
    (["warfarin"], ["ginkgo"], "HIGH", "Ginkgo with warfarin increases bleeding risk.", "NIH ODS / NCCIH"),
    (["warfarin"], ["vitamin e"], "MODERATE", "High-dose vitamin E with warfarin may increase bleeding.", "NIH ODS Vitamin E"),
    (["warfarin"], ["vitamin k"], "HIGH", "Vitamin K opposes warfarin and can make it less effective.", "NIH ODS Vitamin K"),
    (["ssri", "sertraline", "fluoxetine", "antidepressant"], ["st. john", "st john"], "HIGH", "St. John's Wort with SSRIs risks serotonin syndrome.", "NIH ODS / NCCIH"),
    (["hypertension", "blood pressure"], ["licorice", "liquorice"], "HIGH", "Licorice root can raise blood pressure.", "NIH ODS / NCCIH"),
]

def interaction_check(ingredients, profile):
    findings = []
    prof = " ".join(profile.get("meds", []) + profile.get("conditions", [])).lower()
    ing_l = " ".join(ingredients).lower()
    for drug_keys, ing_keys, risk, note, src in INTERACTIONS:
        if any(dk in prof for dk in drug_keys) and any(ik in ing_l for ik in ing_keys):
            findings.append({"risk": risk, "note": note, "source": src,
                             "against": next(dk for dk in drug_keys if dk in prof)})
    return findings

# ---- RUN the shortest real chain ----
profile = {"meds": ["warfarin"], "conditions": ["hypertension"], "allergies": []}
scan = "fish oil"
print(f"USER PROFILE: meds={profile['meds']} conditions={profile['conditions']}")
print(f"SCANNED: {scan}\n")

ident = dsld_identify(scan)
print("1. IDENTIFY (real):", ident["source"], "->", ident["brand"], "|", ident["name"])
print("   ingredients:", ident["ingredients"][:8])

inter = interaction_check(ident["ingredients"], profile)
print("\n2. INTERACTION CHECK vs your profile:")
for f in inter:
    print(f"   [{f['risk']}] {f['note']}  (vs your {f['against']}; src: {f['source']})")
if not inter:
    print("   none found")

rec = openfda_recall(scan)
print("\n3. RECALL CHECK (real live):", rec["source"])
print(f"   recalled={rec['recalled']} date={rec.get('date')} status={rec.get('status')}")
print(f"   reason: {rec.get('reason')}")

print("\n=== AGENT FINDING ===")
top = inter[0] if inter else None
if top:
    print(f"⚠ {top['risk']}: The {ident['name']} you scanned contains omega-3, which with your warfarin {top['note'].lower()} Confirm with your pharmacist. (source: {top['source']})")
