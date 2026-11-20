"""Rule-based eligibility engine (merges GovBot's rules, FormSaathi's rule ops, TN's age/income bounds).

Each scheme gets per-criterion results: pass / fail / unknown. Verdicts:
  NOT_ELIGIBLE        any criterion fails
  ELIGIBLE            structured rules are complete (GovBot/FormSaathi rules) and all pass
  POSSIBLE_MATCH      every structured check passes, but the scheme's written eligibility has
                      conditions we cannot machine-check (all imported Tamil Nadu schemes) - read the text
  NEEDS_VERIFICATION  something unknown, or nothing beyond state residency could be checked
The chat pipeline (LLM + RAG) handles free-text rules; this engine handles structured ones fast and offline.
"""
import re
from datetime import date

from schemes_store import SCHEMES
from services.units import parse_land_hectares, parse_money

OCC_ALIASES = {
    "farmer": {"farmer", "agriculture", "kisan", "farm"},
    "student": {"student"},
    "business": {"business", "entrepreneur", "self-employed", "shopkeeper", "vendor"},
    "labour": {"labour", "labourer", "worker", "daily wage", "construction"},
    "senior": {"senior", "retired", "pensioner"},
    "woman": {"homemaker", "housewife", "woman"},
    "govt": {"govt", "government", "civil servant"},
}


def _num(x):
    """Parse a plain number. Returns None (unknown) for anything ambiguous; never guesses."""
    if x is None or isinstance(x, bool):
        return None
    if isinstance(x, (int, float)):
        return float(x)
    t = str(x).strip().lower()
    if not t:
        return None
    if not re.fullmatch(r"[\d,\s]*\.?\d*\s*(years?|yrs?|y)?|[\d,\s]*\.?\d*\s*(ha|hectares?|acres?)?", t):
        return None  # e.g. "thirty", "lots", "about 3 lakh"-style prose is left unknown rather than guessed
    m = re.search(r"\d[\d,]*\.?\d*", t)
    return float(m.group().replace(",", "")) if m else None


_UNITS = {"lakh": 100_000, "lac": 100_000, "lakhs": 100_000, "crore": 10_000_000, "crores": 10_000_000, "k": 1_000}


def normalize(p: dict) -> dict:
    p = dict(p or {})
    age = _num(p.get("age"))
    if age is None and p.get("dob"):
        try:
            y, m, d = (int(x) for x in str(p["dob"])[:10].split("-"))
            t = date.today()
            age = t.year - y - ((t.month, t.day) < (m, d))
        except Exception:
            pass
    p["_age"] = age
    p["_income"] = parse_money(p.get("annualIncome"))
    land, land_note = parse_land_hectares(p.get("landHectares"), p.get("landUnit"))
    p["_land"] = land
    p["_land_note"] = land_note          # always shown to the user: says what was converted or why it is unknown
    occ = str(p.get("occupation") or "").lower().strip()
    p["_occ"] = occ
    tokens = set(re.findall(r"[a-z][a-z\-]*", occ))          # whole words only: 'st' never matches 'student'
    p["_occ_set"] = {k for k, al in OCC_ALIASES.items() if k in tokens or tokens & al or occ in al} | ({occ} if occ else set())
    p["_gender"] = {"f": "female", "woman": "female", "m": "male", "man": "male"}.get(
        str(p.get("gender") or "").lower(), str(p.get("gender") or "").lower())
    p["_aadhaar"] = bool(p.get("aadhaarNumber") or p.get("hasAadhaar"))
    p["_bank"] = bool(p.get("bankAccount") or p.get("hasBankAccount"))
    return p


def _c(key, label, status, detail=""):
    return {"key": key, "label": label, "status": status, "detail": detail}


def _check_rules(rules: dict, p: dict) -> list[dict]:
    out = []
    if "minAge" in rules or "maxAge" in rules:
        lo, hi, a = _num(rules.get("minAge")) or 0, _num(rules.get("maxAge")), p["_age"]
        label = f"Age {int(lo)}–{int(hi)}" if hi else f"Age {int(lo)}+"
        if a is None:
            out.append(_c("age", label, "unknown"))
        else:
            ok = a >= lo and (hi is None or a <= hi)
            out.append(_c("age", label, "pass" if ok else "fail", f"your age: {int(a)}"))
    if rules.get("maxIncome"):
        cap, inc = rules["maxIncome"], p["_income"]
        label = f"Annual income up to ₹{int(cap):,}"
        out.append(_c("income", label, "unknown") if inc is None else
                   _c("income", label, "pass" if inc <= cap else "fail", f"your income: ₹{int(inc):,}"))
    if rules.get("occupation"):
        label = "Occupation: " + ", ".join(rules["occupation"])
        if not p["_occ"]:
            out.append(_c("occupation", label, "unknown"))
        elif not (p["_occ_set"] & set(OCC_ALIASES)):
            # we could not map the answer to any known occupation group: unknown, never fail
            out.append(_c("occupation", label, "unknown", f"could not match '{p['_occ']}' to a known occupation"))
        else:
            ok = bool(p["_occ_set"] & set(rules["occupation"])) or ("other" in rules["occupation"])
            out.append(_c("occupation", label, "pass" if ok else "fail", f"yours: {p['_occ']}"))
    if rules.get("gender"):
        want = {"f": "female", "woman": "female"}.get(str(rules["gender"]).lower(), str(rules["gender"]).lower())
        g = p["_gender"]
        out.append(_c("gender", f"For {want} applicants", "unknown" if not g else ("pass" if g == want else "fail")))
    if rules.get("maxLandHectares"):
        cap, land = rules["maxLandHectares"], p["_land"]
        label = f"Land up to {cap} ha"
        note = p.get("_land_note", "")
        out.append(_c("land", label, "unknown", note) if land is None else
                   _c("land", label, "pass" if land <= cap else "fail", note))
    if rules.get("casteCategories"):
        label = "Category: " + ", ".join(rules["casteCategories"])
        cat = str(p.get("category") or "").upper()
        out.append(_c("category", label, "unknown") if not cat else
                   _c("category", label, "pass" if cat in {c.upper() for c in rules["casteCategories"]} else "fail"))
    if rules.get("hasAadhaar"):
        out.append(_c("aadhaar", "Aadhaar card", "pass" if p["_aadhaar"] else "unknown"))
    if rules.get("hasBankAccount"):
        out.append(_c("bank", "Bank account", "pass" if p["_bank"] else "unknown"))
    for dq in rules.get("disqualifiers", []) or []:
        if p["_occ"]:
            out.append(_c("disqualifier", f"Not a {dq} employee" if dq == "govt" else f"Not {dq}",
                          "fail" if dq in p["_occ_set"] else "pass"))
    return out


def _check_ops(rules: list[dict], p: dict) -> list[dict]:
    out = []
    for r in rules:
        f, op, val, label = r["field"], r["op"], r.get("value"), r["label"]
        raw = p.get(f)
        if raw in (None, "") and op != "exists":
            out.append(_c(f"fs:{f}", label, "unknown")); continue
        if f == "annualIncome":
            raw = p["_income"]
        s = str(raw or "").lower()
        if op == "exists":
            ok = bool(raw)
        elif op == "eq":
            ok = s == str(val).lower()
        elif op == "neq":
            ok = s != str(val).lower()
        elif op == "in":
            vals = [str(v).lower() for v in val]
            tokens = set(re.findall(r"[a-z][a-z\-]*", s))
            ok = s in vals or bool(tokens & set(vals)) or (f == "occupation" and bool(p["_occ_set"] & set(vals)))
        else:
            n, t = _num(raw), _num(val)
            ok = None if n is None or t is None else {"lt": n < t, "lte": n <= t, "gt": n > t, "gte": n >= t}[op]
        out.append(_c(f"fs:{f}", label, "unknown" if ok is None else ("pass" if ok else "fail")))
    return out


def _dedupe(cs):
    seen, out = set(), []
    for c in cs:
        k = (c["key"], c["status"] == "unknown")
        if c["key"].startswith("fs:") or k not in seen:
            seen.add(k); out.append(c)
    return out


def evaluate(scheme: dict, p: dict) -> dict:
    cs = _check_rules(scheme.get("rules") or {}, p) + _check_ops(scheme.get("profile_rules") or [], p)
    # state-level schemes only apply inside their state
    if scheme.get("level") == "state" and scheme.get("state"):
        st = str(p.get("state") or "").lower()
        cs.insert(0, _c("state", f"Resident of {scheme['state']}", "unknown" if not st else
                        ("pass" if st == scheme["state"].lower() else "fail"), f"your state: {p.get('state')}" if st else ""))
    cs = _dedupe(cs)
    fails = [c for c in cs if c["status"] == "fail"]
    unknown = [c for c in cs if c["status"] == "unknown"]
    # residency and bare "state is known" checks prove nothing about eligibility on their own
    substantive = [c for c in cs if c["key"] not in ("state", "fs:state")]
    complete = bool(scheme.get("profile_rules") or (scheme.get("rules") and scheme.get("origin") != "tn"))
    if fails:
        verdict = "NOT_ELIGIBLE"
    elif unknown or not substantive:
        verdict = "NEEDS_VERIFICATION"
    else:
        verdict = "ELIGIBLE" if complete else "POSSIBLE_MATCH"
    # 'ELIGIBLE' is indicative only: it never means an official approval.
    met = sum(c["status"] == "pass" for c in cs)
    # 'score' is kept for API compatibility only; it is a count of checks, not a probability of approval
    score = round(100 * met / len(cs)) if cs else 0
    return {"verdict": verdict, "score": score, "criteria_met": met, "criteria_total": len(cs), "criteria": cs,
            "checkable": bool(cs), "missing": [c["label"] for c in unknown]}


def match_all(profile: dict, include_not_eligible: bool = False) -> list[dict]:
    p = normalize(profile)
    order = {"ELIGIBLE": 0, "POSSIBLE_MATCH": 1, "NEEDS_VERIFICATION": 2, "NOT_ELIGIBLE": 3}
    res = []
    for sid, s in SCHEMES.items():
        e = evaluate(s, p)
        if s.get("verification") == "expired" and e["verdict"] in ("ELIGIBLE", "POSSIBLE_MATCH"):
            # the official review has lapsed: we cannot say it is a match any more
            e["verdict"] = "NEEDS_VERIFICATION"
            e["criteria"] = e["criteria"] + [{"key": "review", "label": "Scheme review has expired", "status": "unknown",
                                              "detail": "Re-check the official source before relying on this result"}]
            e["missing"] = e["missing"] + ["Scheme review has expired"]
        if e["verdict"] == "NOT_ELIGIBLE" and not include_not_eligible:
            continue
        res.append({"scheme_id": sid, "name": s["name"], "category": s["category"], "level": s.get("level"),
                    "state": s.get("state", ""), "benefit": s.get("benefit", ""), "source_url": s.get("source_url", ""),
                    "verification": s.get("verification", "imported"),
                    "eligibility_text": s.get("eligibility_rules", []),
                    "source_official": bool(s.get("source_official")), "source_warning": s.get("source_warning"),
                    "criteria_met": e["criteria_met"], "criteria_total": e["criteria_total"], **e})
    res.sort(key=lambda r: (order[r["verdict"]], not r["checkable"], -r["score"], r["name"]))
    return res
