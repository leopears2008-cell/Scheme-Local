"""In-memory scheme cache. Source of truth: Supabase `schemes` table (production) or schemes/*.json (local dev).

Verification model (see supabase/migrations): verified | needs_review | expired | unverified.
Nothing here ever upgrades a status - only an admin action in the API can (and the DB constraint demands evidence)."""
import json
import logging
import threading
import time
from datetime import date, datetime
from pathlib import Path

import config
from config import FACTSHEET_DIR

log = logging.getLogger("schemes")
_lock = threading.Lock()
SCHEMES: dict[str, dict] = {}
_listeners: list = []   # callables run after the scheme set changes (avoids circular imports)


def on_change(fn) -> None:
    """Register a callback run after load_all() or refresh_one(). Guardrails use this to refresh valid IDs."""
    if fn not in _listeners:
        _listeners.append(fn)


def _notify() -> None:
    for fn in list(_listeners):
        try:
            fn()
        except Exception:  # one bad listener must not break scheme loading; log it
            log.exception("scheme change listener failed")

EXTRA_KEYS = ("rules", "profile_rules", "form_fields", "i18n", "helpline", "emoji", "benefit_type", "estimated_benefit_inr",
              "merged_from", "exclusions", "source_document", "points", "legacy_last_verified")


CANONICAL_STATUSES = ("verified", "needs_review", "unverified", "expired")


def effective_status(row: dict) -> str:
    """A 'verified' record whose review has expired is treated as expired, regardless of what is stored.
    Missing, misspelt or legacy values (e.g. 'hand_verified') are NEVER promoted: they become 'unverified'."""
    st = row.get("verification_status", "unverified")
    if st not in CANONICAL_STATUSES:
        st = "unverified"
    exp = row.get("review_expires_at")
    if st == "verified" and exp:
        try:
            if date.fromisoformat(str(exp)[:10]) < date.today():
                return "expired"
        except ValueError:
            return "expired"
    return st


def legacy_to_row(d: dict) -> dict:
    if "verification_status" in d and "official_name" in d:      # already a row-shaped draft (register import)
        return {**d, "version": 1, "extra": {"details_available": d.get("details_available", False)}}
    """Map an old fact-sheet JSON to the new row. Seeding NEVER yields 'verified': the 16 Scheme Sahayak sheets were
    checked by the project author (no reviewer identity on record) so they start as needs_review; imports are unverified."""
    extra = {k: d[k] for k in EXTRA_KEYS if k in d}
    if d.get("last_verified"):
        extra["legacy_last_verified"] = d["last_verified"]
    level = (d.get("level") or "central").strip().lower()
    state = d.get("state", "") or ""
    if level.startswith("state"):                 # 'state_maharashtra' etc. -> level 'state' + the state name
        suffix = level[len("state"):].strip("_").replace("_", " ").title()
        level = "state"
        state = state or suffix
    if level not in ("central", "state"):
        level = "central"
    return {
        "scheme_id": d["scheme_id"], "official_name": d["name"], "name_local": d.get("name_local", {}),
        "government_level": level, "state": state, "department": d.get("department", ""),
        "category": d.get("category", "other"), "official_eligibility": d.get("eligibility_rules", []),
        "official_benefits": d.get("benefit", ""), "documents": d.get("documents_required", []),
        "application_url": None, "official_source_url": d.get("source_url") or None,
        "source_type": "imported_dataset" if d.get("origin") != "sahayak" else None,
        "how_to_apply": d.get("how_to_apply", ""),
        "verification_status": "needs_review" if d.get("verification") == "hand_verified" else "unverified",
        "review_note": "Seeded from project dataset; no official reviewer on record." , "extra": extra,
        "origin": d.get("origin", "seed"), "version": 1,
    }


OFFICIAL_SUFFIXES = (".gov.in", ".nic.in", ".gov", ".nic")


def is_official_host(url: str | None) -> bool:
    """True only for a government domain. A flag, not a guarantee the page content is current or correct."""
    if not url:
        return False
    from urllib.parse import urlparse
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        return False
    return host.endswith(OFFICIAL_SUFFIXES) or host.endswith(".gov.in")


def row_to_scheme(r: dict) -> dict:  # handles Supabase rows and local JSON rows alike
    s = dict(r.get("extra") or {})
    st = effective_status(r)
    s.update({
        "scheme_id": r["scheme_id"], "name": r["official_name"], "name_local": r.get("name_local") or {},
        "level": r["government_level"], "state": r.get("state", ""), "department": r.get("department", ""),
        "category": r.get("category", "other"), "eligibility_rules": r.get("official_eligibility") or [],
        "benefit": r.get("official_benefits", ""), "documents_required": r.get("documents") or [],
        "how_to_apply": r.get("how_to_apply", ""), "source_url": r.get("official_source_url") or "",
        "application_url": r.get("application_url"), "source_type": r.get("source_type"),
        "verification": st, "verification_status": st, "stored_status": r.get("verification_status"),
        "verified_at": r.get("verified_at"), "review_expires_at": r.get("review_expires_at"),
        "reviewer_label": r.get("reviewer_label"), "review_note": r.get("review_note"),
        "origin": r.get("origin", "seed"), "version": r.get("version", 1),
    })
    s["source_official"] = is_official_host(s.get("source_url"))
    if not s["source_official"]:
        s["source_warning"] = "The listed source is not a government website. Confirm the rules on an official government source."
    return s


def _load_json_rows() -> list[dict]:
    rows = []
    for p in sorted(Path(FACTSHEET_DIR).glob("*.json")):
        try:
            rows.append(legacy_to_row(json.loads(p.read_text(encoding="utf-8-sig"))))
        except (json.JSONDecodeError, KeyError) as e:
            log.warning("skip %s: %s", p.name, e)
    return rows


def load_all() -> dict[str, dict]:
    from repo import repo, MemoryRepo
    rows = []
    try:
        rows = repo().schemes_all()
    except Exception as e:  # DB down at boot: keep whatever we already have
        log.error("scheme load failed: %s", type(e).__name__)
        if SCHEMES:
            return SCHEMES
    if not rows and (config.ENV != "production" or isinstance(repo(), MemoryRepo)):
        rows = _load_json_rows()                 # local dev only
        if isinstance(repo(), MemoryRepo):
            repo().scheme_upsert_many(rows)
    elif not rows and config.ALLOW_JSON_FALLBACK:
        rows = _load_json_rows()                 # explicitly allowed for a demo before seeding
        log.warning("ALLOW_JSON_FALLBACK is on: serving %d bundled records, not the database. Seed Supabase for real use.", len(rows))
    elif not rows:
        log.error("schemes table is empty - run `python tools/seed_supabase.py`")
    with _lock:
        SCHEMES.clear()
        SCHEMES.update({r["scheme_id"]: row_to_scheme(r) for r in rows})
    _notify()
    return SCHEMES


def refresh_one(row: dict):
    with _lock:
        SCHEMES[row["scheme_id"]] = row_to_scheme(row)
    _notify()


def start_background_refresh(every: int = 60):
    def loop():
        while True:
            time.sleep(every)
            try:
                load_all()
            except Exception:
                log.exception("scheme refresh failed")
    threading.Thread(target=loop, daemon=True, name="scheme-refresh").start()


def localized(s: dict, lang: str) -> dict:
    tr = (s.get("i18n") or {}).get(lang)
    out = dict(s)
    if tr:
        for k, v in tr.items():
            if v:
                out[k if k != "eligibility" else "eligibility_text"] = v
    elif lang != "en" and (s.get("name_local") or {}).get(lang):
        out["name"] = s["name_local"][lang]
    return out
