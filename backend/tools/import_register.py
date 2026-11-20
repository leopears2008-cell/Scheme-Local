"""Load the SAHAYAK Tamil Nadu department register into the scheme store as UNVERIFIED drafts.

Rules:
  * Never sets verification to 'verified'. Rows without eligibility/benefits are 'unverified'.
  * Keeps the official source URL and the date it was checked.
  * Writes schemes/tn_reg_<id>.json so the existing loader and ingest pick them up.
Run:  python tools/import_register.py
"""
import csv, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "sources" / "tn_department_register.csv"
OUT = ROOT / "schemes"

CAT = [("agricult", "agriculture"), ("farmer", "agriculture"), ("social justice", "social_welfare"),
       ("adi dravidar", "social_welfare"), ("bc,", "social_welfare"), ("minorit", "social_welfare"),
       ("labour", "employment_skill"), ("skill", "employment_skill"), ("rural", "social_welfare"),
       ("women", "women_child"), ("horticult", "agriculture")]


def category(dept: str, name: str) -> str:
    text = (dept + " " + name).lower()
    for k, v in CAT:
        if k in text:
            return v
    return "other"


def main():
    n = 0
    for r in csv.DictReader(open(SRC, encoding="utf-8-sig")):
        sid = "tn_reg_" + re.sub(r"[^a-z0-9]", "_", r["scheme_id"].lower())
        has_detail = bool(r["eligibility"].strip() or r["benefits"].strip())
        row = {
            "scheme_id": sid,
            "official_name": r["scheme_name"].strip(),
            "name_local": {},
            "government_level": "state",
            "state": "Tamil Nadu",
            "department": r["department"].strip(),
            "category": category(r["department"], r["scheme_name"]),
            "official_eligibility": [r["eligibility"].strip()] if r["eligibility"].strip() else [],
            "official_benefits": r["benefits"].strip(),
            "documents": [d.strip() for d in r["required_documents"].split(";") if d.strip()],
            "application_url": r["application_url"].strip() or None,
            "official_source_url": r["official_source_url"].strip() or None,
            "source_type": "state_portal",
            "how_to_apply": r["application_process"].strip(),
            "verification_status": "unverified",
            "review_note": r["missing_or_unverified"].strip(),
            "source_checked_date": r["source_checked_date"].strip(),
            "details_available": has_detail,
            "origin": "tn_register",
        }
        (OUT / f"{sid}.json").write_text(json.dumps(row, ensure_ascii=False, indent=1), encoding="utf-8")
        n += 1
    print(f"wrote {n} draft records (all unverified)")


if __name__ == "__main__":
    main()
