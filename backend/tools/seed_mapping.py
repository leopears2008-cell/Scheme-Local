"""Map scheme records to the Supabase `public.schemes` table, safely.

* Column whitelist is READ FROM supabase/migrations/0001_init.sql, so it cannot drift from the real schema.
* Fields the table does not have are NOT dropped silently: they are kept under the `extra` JSON column, and
  the mapping is reported per record.
* Records that fail validation are rejected with a reason; nothing invalid is sent.
* A seed can never create a 'verified' status. Verification is a human admin action only.
"""
import json
import re
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "0001_init.sql"
GOV_LEVELS = {"central", "state"}
STATUSES = {"unverified", "needs_review", "expired"}          # 'verified' is deliberately excluded
SOURCE_TYPES = {"central_portal", "state_portal", "gazette", "department_circular", "imported_dataset", "other"}
CATEGORIES = {"agriculture", "food", "education", "employment_skill", "health", "housing",
              "social_welfare", "women_child", "finance_insurance", "other"}
# legacy/register key -> table column
RENAME = {"name": "official_name", "benefit": "official_benefits", "eligibility_rules": "official_eligibility",
          "documents_required": "documents", "source_url": "official_source_url",
          "verification": "verification_status"}


def schema_columns(sql: str | None = None) -> set[str]:
    """Column names of public.schemes, parsed from the migration file."""
    text = sql if sql is not None else MIGRATION.read_text(encoding="utf-8")
    m = re.search(r"create table public\.schemes \((.*?)\n\);", text, re.S)
    if not m:
        raise RuntimeError("could not find 'create table public.schemes' in the migration")
    cols = set()
    for line in m.group(1).splitlines():
        t = line.strip()
        if t.startswith("constraint"):      # table constraints come after the columns; stop here
            break
        if not t or t.startswith(("check", "--", "primary", "unique")):
            continue
        cols.add(t.split()[0].strip(","))
    return cols


def _str(v, max_len=None):
    if v is None:
        return None
    s = str(v).strip()
    return s[:max_len] if max_len else s


def map_record(raw: dict, columns: set[str]) -> tuple[dict | None, list[str], list[str]]:
    """Returns (row or None, notes, errors). notes describe every mapping decision."""
    notes, errors = [], []
    row, extra = {}, dict(raw.get("extra") or {})
    for k, v in raw.items():
        if k == "extra":
            continue
        col = RENAME.get(k, k)
        if col in columns:
            if col != k:
                notes.append(f"{k} -> {col}")
            row[col] = v
        else:
            extra[k] = v
            notes.append(f"{k} -> extra (no column)")
    # required + shape validation
    sid = _str(row.get("scheme_id"))
    if not sid or not re.fullmatch(r"[a-z0-9_]{3,80}", sid):
        errors.append("scheme_id missing or not in [a-z0-9_]{3,80}")
    name = _str(row.get("official_name"), 300)
    if not name or len(name) < 3:
        errors.append("official_name missing or shorter than 3 characters")
    level = _str(row.get("government_level")) or "central"
    if level not in GOV_LEVELS:
        errors.append(f"government_level '{level}' not allowed")
    cat = _str(row.get("category")) or "other"
    if cat not in CATEGORIES:
        notes.append(f"category '{cat}' not in list -> other")
        cat = "other"
    status = _str(row.get("verification_status")) or "unverified"
    if status == "verified":
        status = "needs_review"
        notes.append("status 'verified' downgraded to needs_review (seeding never verifies)")
    if status not in STATUSES:
        notes.append(f"status '{status}' not allowed -> unverified")
        status = "unverified"
    src_type = _str(row.get("source_type"))
    if src_type and src_type not in SOURCE_TYPES:
        notes.append(f"source_type '{src_type}' not allowed -> other")
        src_type = "other"
    url = _str(row.get("official_source_url"))
    if url and not url.startswith("https://"):
        notes.append("official_source_url is not https -> cleared")
        url = None
    app_url = _str(row.get("application_url"))
    if app_url and not app_url.startswith("https://"):
        notes.append("application_url is not https -> cleared")
        app_url = None
    if errors:
        return None, notes, errors
    if extra:
        # the table's extra column is jsonb; keep it small and JSON-serialisable
        extra = json.loads(json.dumps(extra, ensure_ascii=False, default=str))
    out = {
        "scheme_id": sid, "official_name": name, "name_local": row.get("name_local") or {},
        "government_level": level, "state": _str(row.get("state"), 60) or "",
        "department": _str(row.get("department"), 200) or "", "category": cat,
        "official_eligibility": [str(x) for x in (row.get("official_eligibility") or []) if str(x).strip()],
        "official_benefits": _str(row.get("official_benefits"), 4000) or "",
        "documents": [str(x) for x in (row.get("documents") or []) if str(x).strip()],
        "application_url": app_url, "official_source_url": url, "source_type": src_type,
        "how_to_apply": _str(row.get("how_to_apply"), 4000) or "",
        "verification_status": status, "review_note": _str(row.get("review_note"), 1000),
        "extra": extra, "origin": _str(row.get("origin")) or "seed",
    }
    if "version" in columns:
        out["version"] = 1
    return {k: v for k, v in out.items() if k in columns}, notes, []


def build_rows(records: list[dict], columns: set[str]):
    """Returns (rows, report). Duplicate scheme_ids are reported and only the first is kept."""
    rows, seen = [], set()
    report = {"accepted": 0, "rejected": [], "duplicates": [], "notes": {}}
    for raw in records:
        row, notes, errors = map_record(raw, columns)
        sid = (raw.get("scheme_id") or "?")
        if errors:
            report["rejected"].append({"scheme_id": sid, "reasons": errors})   # never print raw contents
            continue
        if row["scheme_id"] in seen:
            report["duplicates"].append(row["scheme_id"])
            continue
        seen.add(row["scheme_id"])
        rows.append(row)
        report["accepted"] += 1
        if notes:
            report["notes"][row["scheme_id"]] = notes
    return rows, report
