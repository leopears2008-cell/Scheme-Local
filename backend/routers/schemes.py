"""Scheme browse/search (TN scheme DB + central), bookmarks, and admin 'add a scheme'."""

from fastapi import APIRouter, HTTPException, Query

import schemes_store as store

router = APIRouter(prefix="/api")


def _card(s: dict, lang: str) -> dict:
    s = store.localized(s, lang)
    has_form_fields = bool(s.get("form_fields"))          # read BEFORE the field is removed below
    s = {k: v for k, v in s.items() if k not in ("form_fields", "merged_from")}   # no internal fields to the public
    return {k: s.get(k) for k in (
        "scheme_id", "name", "category", "level", "state", "department", "benefit", "eligibility_rules",
        "eligibility_text", "exclusions", "documents_required", "how_to_apply", "source_url", "last_verified",
        "origin", "verification", "helpline", "emoji", "benefit_type", "estimated_benefit_inr")} | {
        "has_official_form": s["scheme_id"] in __import__("services.pdfgen", fromlist=["x"]).FORM_FOR_SCHEME,
        "application_url": s.get("application_url"), "verification_status": s.get("verification_status"),
        "source_official": s.get("source_official", False), "source_warning": s.get("source_warning"),
        "verified_at": s.get("verified_at"), "review_expires_at": s.get("review_expires_at"),
        "has_form_fields": has_form_fields}


def _is_complete(s: dict) -> bool:
    from pipeline.retrieval import is_rich
    return is_rich(s)


def _haystack(s: dict) -> str:  # search over official text only (no internal rule metadata)
    parts = [s["name"], s.get("benefit", ""), s.get("department", ""), " ".join(s.get("eligibility_rules", [])),
             " ".join((s.get("name_local") or {}).values())]
    for tr in (s.get("i18n") or {}).values():
        parts += [str(v) for v in tr.values()]
    return " ".join(parts).lower()


@router.get("/schemes/meta")
def meta():
    """Canonical metadata contract: counts live under 'verification' only."""
    S = store.SCHEMES.values()
    count = lambda key: {k: sum(1 for s in S if (s.get(key) or "central") == k) for k in sorted({(s.get(key) or "central") for s in S})}
    return {"total": len(store.SCHEMES), "categories": count("category"), "states": count("state"),
            "origins": count("origin"), "verification": {k: sum(1 for s in S if s.get("verification") == k) for k in ("verified", "needs_review", "expired", "unverified")}}


@router.get("/schemes")
def list_schemes(q: str = "", category: str = "", level: str = "", state: str = "", lang: str = "en",
                 limit: int = Query(60, le=400), offset: int = 0):
    ql = q.strip().lower()
    out = []
    for s in store.SCHEMES.values():
        if category and s["category"] != category: continue
        if level and s.get("level") != level: continue
        if state and s.get("state", "").lower() not in ("", state.lower()): continue  # central + that state
        if ql and ql not in _haystack(s): continue
        out.append(s)
    # verified first, then complete records (benefit + eligibility + documents + government source) before placeholders
    out.sort(key=lambda s: (s.get("verification") != "verified", not _is_complete(s), s["name"].lower()))
    return {"total": len(out), "items": [_card(s, lang) for s in out[offset: offset + limit]]}


@router.get("/schemes/{scheme_id}")
def get_scheme(scheme_id: str, lang: str = "en"):
    s = store.SCHEMES.get(scheme_id)
    if not s:
        raise HTTPException(404, "Unknown scheme")
    from services.pdfgen import FORM_FOR_SCHEME
    form_fields = s.get("form_fields", []) if scheme_id in FORM_FOR_SCHEME or s.get("form_fields") else []
    return _card(s, lang) | {"form_fields": form_fields,
                             "form_fields_note": "Field layout from the bundled official form. Check the current form on the official site."}


