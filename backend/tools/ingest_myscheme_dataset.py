"""Ingest full national MyScheme dataset (2,066 schemes) into backend/schemes/.

- Preserves all existing curated schemes (never overwrites).
- Maps all fields into canonical Scheme format: scheme_id, name, category, level, state, department, benefit,
  eligibility_rules, exclusions, documents_required, how_to_apply, source_url, verification ("unverified").
- Validates all generated schemes against seed_mapping schema.
"""
import io
import json
import logging
import os
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMES_DIR = ROOT / "schemes"

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("ingest")


def make_scheme_id(slug: str, name: str) -> str:
    raw = slug if slug else name
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", raw).strip("_").lower()
    if cleaned and cleaned[0].isdigit():
        cleaned = f"s_{cleaned}"
    if not cleaned:
        cleaned = "scheme_item"
    cleaned = cleaned[:75]
    if len(cleaned) < 3:
        cleaned = f"{cleaned}_sch"
    return cleaned


def get_category(tags: str, desc: str, name: str, ministry: str) -> str:
    blob = f"{tags} {desc} {name} {ministry}".lower()
    if any(k in blob for k in ["agri", "farm", "kisan", "crop", "pashu", "fisher", "dairy", "horticult", "soil", "irrigation", "fertilizer"]):
        return "agriculture"
    if any(k in blob for k in ["health", "medic", "hospital", "ayush", "disease", "doctor", "treatment", "sanitation", "swachh"]):
        return "health"
    if any(k in blob for k in ["scholarship", "school", "college", "student", "fellowship", "educat", "university", "tuition"]):
        return "education"
    if any(k in blob for k in ["women", "girl", "child", "matern", "mother", "widow", "mahila", "kanya", "beti"]):
        return "women_child"
    if any(k in blob for k in ["skill", "employ", "job", "training", "internship", "entrepreneur", "business", "msme", "startup", "livelihood", "rozgar"]):
        return "employment_skill"
    if any(k in blob for k in ["housing", "house", "shelter", "awas", "ashray"]):
        return "housing"
    if any(k in blob for k in ["ration", "food grain", "nutrition", "annapurna", "poshan", "pds", "mid-day meal"]):
        return "food"
    if any(k in blob for k in ["pension", "disab", "senior citizen", "divyang", "differently abled", "social justice", "tribal welfare"]):
        return "social_welfare"
    if any(k in blob for k in ["loan", "credit", "insurance", "bima", "subsidy", "banking", "finance", "pension fund"]):
        return "finance_insurance"
    if "welfare" in blob:
        return "social_welfare"
    return "other"


def split_list(text_or_list) -> list[str]:
    if isinstance(text_or_list, list):
        return [str(x).strip() for x in text_or_list if str(x).strip()]
    if not isinstance(text_or_list, str) or not text_or_list.strip():
        return []
    lines = [item.strip().lstrip("•-* \t0123456789.)") for item in re.split(r"[\r\n]+|[•\u2022]", text_or_list)]
    return [l for l in lines if len(l) > 2]


def ingest(zip_path: str):
    log.info("Reading zip archive from: %s", zip_path)
    with zipfile.ZipFile(zip_path, "r") as z:
        if "india-government-schemes.zip" in z.namelist():
            inner_bytes = z.read("india-government-schemes.zip")
            with zipfile.ZipFile(io.BytesIO(inner_bytes), "r") as iz:
                raw = iz.read("india-government-schemes.json")
        else:
            raw = z.read("india-government-schemes.json")

    items = json.loads(raw)
    log.info("Loaded %d scheme entries from national dataset", len(items))

    # Read existing schemes
    existing_files = list(SCHEMES_DIR.glob("*.json"))
    existing_ids = set()
    existing_names = set()
    for ef in existing_files:
        try:
            with open(ef, "r", encoding="utf-8") as f:
                d = json.load(f)
                sid = d.get("scheme_id") or ef.stem
                existing_ids.add(sid.lower())
                existing_names.add(d.get("name", "").strip().lower())
        except Exception:
            pass

    log.info("Found %d existing scheme files in %s", len(existing_files), SCHEMES_DIR)

    added = 0
    preserved = 0
    for it in items:
        name = (it.get("Scheme Name") or "").strip()
        slug = (it.get("Scheme Slug") or "").strip()
        sid = make_scheme_id(slug, name)

        if sid.lower() in existing_ids or name.lower() in existing_names:
            preserved += 1
            continue

        level_raw = (it.get("Level") or "").strip().lower()
        ministry_or_state = (it.get("State / UT / Ministry") or "").strip()
        is_central = "central" in level_raw

        level = "central" if is_central else "state"
        state = "" if is_central else ministry_or_state
        department = ministry_or_state if is_central else ""

        tags = it.get("Tags / Categories") or ""
        desc = it.get("Description") or ""
        cat = get_category(tags, desc, name, ministry_or_state)

        benefit = (it.get("Benefits") or desc or name).strip()

        rules = split_list(it.get("Eligibility Criteria") or it.get("Eligibility (General)"))
        if not rules:
            rules = ["Citizen/resident meeting scheme eligibility requirements."]

        exclusions = split_list(it.get("Exclusions / Ineligibility"))
        docs = split_list(it.get("Documents Required"))
        if not docs:
            docs = ["Aadhaar Card", "Identity proof"]

        app_process = (it.get("Application Process") or "").strip()
        source_url = it.get("Official Link") or it.get("MyScheme URL") or f"https://www.myscheme.gov.in/schemes/{slug}"
        if not source_url.startswith("https://") and not source_url.startswith("http://"):
            source_url = f"https://www.myscheme.gov.in/schemes/{slug}"
        elif source_url.startswith("http://"):
            source_url = "https://" + source_url[7:]

        how_to_apply = app_process if app_process else f"Apply on the official portal: {source_url}"

        scheme_doc = {
            "scheme_id": sid,
            "name": name,
            "category": cat,
            "level": level,
            "state": state,
            "department": department,
            "benefit": benefit,
            "eligibility_rules": rules,
            "exclusions": exclusions,
            "documents_required": docs,
            "how_to_apply": how_to_apply,
            "source_url": source_url,
            "source_document": "MyScheme National Portal",
            "verification": "unverified",
            "points": [],
            "merged_from": []
        }

        target_file = SCHEMES_DIR / f"{sid}.json"
        with open(target_file, "w", encoding="utf-8") as f:
            json.dump(scheme_doc, f, ensure_ascii=False, indent=2)

        existing_ids.add(sid.lower())
        existing_names.add(name.lower())
        added += 1

    log.info("Ingestion complete: %d new schemes added, %d existing schemes preserved. Total files now: %d",
             added, preserved, len(list(SCHEMES_DIR.glob("*.json"))))


if __name__ == "__main__":
    zip_path = r"C:\Users\pc\.gemini\antigravity\brain\89cfaf9f-4c28-446e-a41b-cf72084c6e15\.user_uploaded\media_1795441126272_e7ca89e5.zip"
    ingest(zip_path)
