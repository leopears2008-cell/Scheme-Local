"""Merge the four source datasets into unified fact sheets in backend/schemes/.

Sources (all kept under data/sources/):
  schemes/*.json (Scheme Sahayak, hand-verified)  -> base records, never overwritten
  formsaathi_schemes.json  (FormSaathi, 24)       -> docs, form fields, rule ops
  govbot_rules.json        (GovBot, 18)           -> structured rules, helpline
  tn_schemes.json          (TN-Welfare-Schemes, 309, en+ta)

Run:  python tools/build_data.py
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "sources"
OUT = ROOT / "schemes"
CENTRAL = "central"

# unified categories used by retrieval + UI filters
CAT = {
    "agriculture": "agriculture", "farmer": "agriculture", "food": "food",
    "education": "education", "scholarship": "education", "skill": "employment_skill",
    "employment": "employment_skill", "industry": "employment_skill", "health": "health",
    "housing": "housing", "pension": "social_welfare", "disability": "social_welfare",
    "relief": "social_welfare", "social_welfare": "social_welfare", "women": "women_child",
    "finance": "finance_insurance", "insurance": "finance_insurance",
}
# duplicate ids across repos -> canonical id (Sahayak ids win)
ALIAS = {
    "pm-kisan": "pm_kisan", "pm_fasal_bima": "pmfby", "ayushman-bharat": "ayushman_bharat",
    "sukanya-samriddhi": "sukanya_samriddhi", "pmay-gramin": "pmay_gramin",
    "pm_vidyalakshmi": "pm_vidyalaxmi", "pmay-urban": "pmay_urban", "mudra-loan": "pm_mudra",
    "pm-jan-dhan": "pm_jan_dhan", "atal-pension": "atal_pension", "pm_jeevan_jyoti": "pmjjby",
    "pm_suraksha_bima": "pmsby", "national-scholarship": "nsp_scholarship",
    "old-age-pension": "nsap_pension", "maternity-benefit": "pmmvy", "skill-india": "skill_india",
    "ration-card-nfsa": "ration_card_nfsa", "widow-pension": "widow_pension",
    "disability-pension": "disability_pension", "pm-vishwakarma": "pm_vishwakarma",
    "stand-up-india": "stand_up_india", "beti-bachao": "beti_bachao", "pm-svanidhi": "pm_svanidhi",
}

def cid(x): return ALIAS.get(x, x.replace("-", "_"))
def cat(x):
    if isinstance(x, list):
        for i in x:
            if CAT.get(str(i).lower()): return CAT[str(i).lower()]
        return "other"
    return CAT.get(str(x or "").lower(), "other")

def load_base():
    base = {}
    for p in sorted(OUT.glob("*.json")):
        d = json.loads(p.read_text(encoding="utf-8-sig"))
        if d.get("origin") in (None, "sahayak"):
            d.setdefault("origin", "sahayak"); d["verification"] = "hand_verified"
            d["category"] = cat(d["category"]) if d["category"] not in CAT.values() else d["category"]
            d.setdefault("state", "Maharashtra" if d.get("level") == "state" else "")
            base[d["scheme_id"]] = (p, d)
    return base

def rule_from_fs(r):
    return {"field": r["field"], "op": r["op"], "value": r.get("value"), "label": r["label"]}

def main():
    base = load_base()
    out = {sid: d for sid, (_, d) in base.items()}
    merged_from = {sid: ["scheme-sahayak"] for sid in out}

    # FormSaathi
    for s in json.loads((SRC / "formsaathi_schemes.json").read_text(encoding="utf-8")):
        sid = cid(s["id"]); d = out.get(sid)
        if d is None:
            d = out[sid] = {
                "scheme_id": sid, "name": s["name"], "category": cat(s["category"]), "level": CENTRAL,
                "state": "", "benefit": s["description"],
                "eligibility_rules": [r["label"] for r in s["eligibility"]], "exclusions": [],
                "documents_required": s["requiredDocuments"], "how_to_apply": f"Apply on the official portal: {s['portalUrl']}",
                "source_url": s["portalUrl"], "source_document": "FormSaathi scheme database",
                "last_verified": "", "origin": "formsaathi", "verification": "imported",
            }
            merged_from[sid] = []
        d.setdefault("name_local", {})["hi"] = s["nameHi"]
        d["department"] = d.get("department") or s["department"]
        d["benefit_type"] = s["benefitType"]; d["estimated_benefit_inr"] = s["estimatedBenefitINR"]
        d["form_fields"] = s["formFields"]; d["profile_rules"] = [rule_from_fs(r) for r in s["eligibility"]]
        if not d.get("documents_required"): d["documents_required"] = s["requiredDocuments"]
        merged_from[sid].append("FormSaathi")

    # GovBot
    for g in json.loads((SRC / "govbot_rules.json").read_text(encoding="utf-8")):
        sid = cid(g["id"]); d = out.get(sid)
        if d is None:
            d = out[sid] = {
                "scheme_id": sid, "name": g["name"], "category": cat(g["category"]), "level": CENTRAL,
                "state": "", "benefit": g["benefit"], "eligibility_rules": [g["description"]],
                "exclusions": [], "documents_required": [x.title() for x in g.get("requiredDocs", [])],
                "how_to_apply": f"Apply on the official portal: {g['portal']}", "source_url": g["portal"],
                "source_document": "GovBot rules database", "last_verified": "", "origin": "govbot",
                "verification": "imported",
            }
            merged_from[sid] = []
        rules = dict(g["rules"])
        if rules.get("maxIncome") is not None:  # GovBot stores a bracket id; convert to rupees/year
            rules["maxIncome"] = {1: 100000, 2: 300000, 3: 800000}.get(int(rules["maxIncome"]), 800000)
        d["rules"] = rules; d["helpline"] = g.get("helpline", ""); d["emoji"] = g.get("emoji", "")
        d["points"] = g.get("points", 5)
        merged_from[sid].append("GovBot")

    # Tamil Nadu
    for t in json.loads((SRC / "tn_schemes.json").read_text(encoding="utf-8")):
        sid = f"tn_{t['id']:03d}"
        en = lambda k: (t.get(k) or {}).get("en", "") if isinstance(t.get(k), dict) else (t.get(k) or "")
        ta = lambda k: (t.get(k) or {}).get("ta", "") if isinstance(t.get(k), dict) else ""
        rules = {k: t[k] for k in ("minAge", "maxAge", "maxIncome") if t.get(k) not in (None, "")}
        out[sid] = {
            "scheme_id": sid, "name": en("title"), "name_local": {"ta": ta("title")},
            "category": cat(t.get("category")), "level": "state", "state": "Tamil Nadu",
            "department": en("department"), "benefit": en("benefits"),
            "eligibility_rules": [en("eligibility")], "exclusions": [], "documents_required": [],
            "how_to_apply": en("apply"), "source_url": t.get("link", ""),
            "source_document": "TN-Welfare-Schemes dataset", "last_verified": "",
            "origin": "tn", "verification": "imported", "rules": rules,
            "i18n": {"ta": {"name": ta("title"), "benefit": ta("benefits"),
                            "eligibility": ta("eligibility"), "how_to_apply": ta("apply"),
                            "department": ta("department")}},
        }
        merged_from[sid] = ["TN-Welfare-Schemes"]

    for sid, d in out.items():
        d["merged_from"] = merged_from[sid]
        (OUT / f"{sid}.json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    from collections import Counter
    print(len(out), "schemes written;", Counter(d["origin"] for d in out.values()), Counter(d["category"] for d in out.values()))

if __name__ == "__main__":
    main()
