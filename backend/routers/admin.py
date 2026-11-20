"""Admin verification dashboard API. Every write: role-checked on the server, fresh OTP login for decisions,
written through the service role, and recorded in scheme_history + audit_logs.
The AI never sets a verification status. Only a named human reviewer action can."""
import re
from datetime import date, timedelta
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

import config
import schemes_store as store
from repo import RepoError, repo
from security.auth import Principal, require_admin, require_fresh, require_super_admin

router = APIRouter(prefix="/api/admin")
CATEGORIES = ["agriculture", "food", "education", "employment_skill", "health", "housing",
              "social_welfare", "women_child", "finance_insurance", "other"]
GOV_HOSTS = (".gov.in", ".nic.in", ".gov", ".nic.in")  # official-source host check (advisory; reviewer decides)


def _valid_source(url: str) -> bool:
    try:
        u = urlparse(url)
    except ValueError:
        return False
    if u.scheme != "https" or not u.hostname:
        return False
    host = u.hostname.lower()
    if config.ALLOWED_SOURCE_DOMAINS:
        return any(host == d or host.endswith("." + d) for d in config.ALLOWED_SOURCE_DOMAINS)
    return host.endswith(GOV_HOSTS)


class SchemeIn(BaseModel):
    scheme_id: str = Field(pattern=r"^[a-z0-9_]{3,80}$")
    official_name: str = Field(min_length=3, max_length=300)
    government_level: str = Field(pattern=r"^(central|state)$")
    state: str = Field("", max_length=60)
    department: str = Field("", max_length=200)
    category: str
    official_eligibility: list[str] = Field(default_factory=list, max_length=40)
    official_benefits: str = Field("", max_length=4000)
    documents: list[str] = Field(default_factory=list, max_length=40)
    application_url: str | None = None
    official_source_url: str | None = None
    source_type: str | None = None
    how_to_apply: str = Field("", max_length=4000)
    review_note: str | None = Field(None, max_length=1000)


class Decision(BaseModel):
    note: str = Field(..., min_length=5, max_length=1000)
    source_url: str | None = None
    source_type: str | None = None
    expires_in_days: int = Field(config.VERIFICATION_VALIDITY_DAYS, ge=1, le=365)


def _admin_label(p: Principal) -> str:
    return p.masked_phone


def _check_scheme(d: SchemeIn):
    if d.category not in CATEGORIES:
        raise HTTPException(422, f"category must be one of {CATEGORIES}")
    for url in (d.application_url, d.official_source_url):
        if url and not re.match(r"^https://", url):
            raise HTTPException(422, "URLs must be https")
    if d.official_source_url and not _valid_source(d.official_source_url):
        raise HTTPException(422, "official_source_url must be an official government host (or an allowed domain)")


@router.get("/schemes")
def list_schemes(q: str = "", status: str = "", level: str = "", state: str = "", limit: int = 100, offset: int = 0,
                 p: Principal = Depends(require_admin)):
    rows = repo().schemes_all()
    ql = q.strip().lower()[:100]
    out = []
    for r in rows:
        eff = store.effective_status(r)
        if status and eff != status: continue
        if level and r["government_level"] != level: continue
        if state and r.get("state", "").lower() != state.lower(): continue
        if ql and ql not in (r["official_name"] + " " + r["scheme_id"] + " " + r.get("department", "")).lower(): continue
        out.append({**r, "verification_status": eff})
    counts = {s: sum(1 for r in rows if store.effective_status(r) == s) for s in ("verified", "needs_review", "expired", "unverified")}
    return {"counts": counts, "total": len(out), "items": out[offset: offset + min(limit, 200)]}


@router.get("/duplicates")
def duplicates(p: Principal = Depends(require_admin)):
    """Same normalised name or same official source URL = likely duplicate."""
    rows = repo().schemes_all()
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
    groups: dict[str, list[str]] = {}
    for r in rows:
        groups.setdefault("name:" + norm(r["official_name"]), []).append(r["scheme_id"])
        if r.get("official_source_url"):
            groups.setdefault("url:" + r["official_source_url"].rstrip("/").lower(), []).append(r["scheme_id"])
    return {"duplicates": [{"key": k, "scheme_ids": v} for k, v in groups.items() if len(v) > 1]}


@router.get("/schemes/{scheme_id}/history")
def history(scheme_id: str, p: Principal = Depends(require_admin)):
    return repo().history_list(scheme_id)


@router.post("/schemes", status_code=201)
def create(d: SchemeIn, p: Principal = Depends(require_admin)):
    _check_scheme(d)
    if repo().schemes_all() and any(r["scheme_id"] == d.scheme_id for r in repo().schemes_all()):
        raise HTTPException(409, "scheme_id exists")
    row = d.model_dump() | {"verification_status": "unverified", "origin": "admin", "version": 1, "extra": {}}
    row.setdefault("name_local", {})
    saved = repo().scheme_upsert(row)
    repo().history_add({"scheme_id": d.scheme_id, "action": "create", "to_status": "unverified", "actor_id": p.user_id, "note": "created"})
    repo().audit_add(p.user_id, "scheme.create", "scheme", d.scheme_id)
    store.refresh_one(saved)
    return {"ok": True, "scheme_id": d.scheme_id, "status": "unverified"}


@router.patch("/schemes/{scheme_id}")
def edit(scheme_id: str, d: SchemeIn, expected_version: int, p: Principal = Depends(require_admin)):
    """Editing content DROPS a verified record back to needs_review: changed text must be re-reviewed."""
    if d.scheme_id != scheme_id:
        raise HTTPException(422, "scheme_id cannot change")
    _check_scheme(d)
    cur = next((r for r in repo().schemes_all() if r["scheme_id"] == scheme_id), None)
    if not cur:
        raise HTTPException(404, "Unknown scheme")
    fields = d.model_dump(exclude={"scheme_id"})
    changed = [k for k in fields if fields[k] != cur.get(k if k != "official_name" else "official_name")]
    new_status = "needs_review" if changed and store.effective_status(cur) == "verified" else store.effective_status(cur)
    row = {**cur, **fields, "verification_status": new_status, "version": cur["version"] + 1}
    if new_status != "verified":
        row.update({"verified_at": None, "reviewer_id": None, "reviewer_label": None, "review_expires_at": None})
    try:
        saved = repo().scheme_upsert(row, expected_version=expected_version)
    except RepoError as e:
        raise HTTPException(e.status, str(e))
    repo().history_add({"scheme_id": scheme_id, "action": "edit", "from_status": cur["verification_status"], "to_status": new_status,
                        "actor_id": p.user_id, "note": f"changed: {', '.join(changed) or 'none'}"})
    repo().audit_add(p.user_id, "scheme.edit", "scheme", scheme_id, {"changed": changed})
    store.refresh_one(saved)
    return {"ok": True, "status": new_status, "version": saved["version"]}


def _decide(scheme_id, to_status, d: Decision, p: Principal, expected_version: int | None = None):
    cur = next((r for r in repo().schemes_all() if r["scheme_id"] == scheme_id), None)
    if not cur:
        raise HTTPException(404, "Unknown scheme")
    fr = store.effective_status(cur)
    row = {**cur, "verification_status": to_status, "version": cur["version"] + 1, "review_note": d.note[:1000]}
    if to_status == "verified":
        if not d.source_url or not _valid_source(d.source_url):
            raise HTTPException(422, "Verification needs an official https source URL on a government domain")
        row.update({"official_source_url": d.source_url, "source_type": d.source_type or cur.get("source_type") or "other",
                    "verified_at": date.today().isoformat(), "reviewer_id": p.user_id, "reviewer_label": _admin_label(p),
                    "review_expires_at": (date.today() + timedelta(days=d.expires_in_days)).isoformat()})
    elif to_status in ("needs_review", "unverified", "expired"):
        row.update({"verified_at": None, "reviewer_id": None, "reviewer_label": None, "review_expires_at": None})
    try:
        saved = repo().scheme_upsert(row, expected_version=expected_version or cur["version"])
    except RepoError as e:
        raise HTTPException(e.status, str(e))
    action = {"verified": "verify", "unverified": "reject", "expired": "expire", "needs_review": "edit"}[to_status]
    repo().history_add({"scheme_id": scheme_id, "action": action, "from_status": cur["verification_status"], "to_status": to_status,
                        "actor_id": p.user_id, "note": d.note})
    repo().audit_add(p.user_id, f"scheme.{action}", "scheme", scheme_id, {"from": fr, "to": to_status})
    store.refresh_one(saved)
    return {"ok": True, "status": to_status, "version": saved["version"], "review_expires_at": row.get("review_expires_at")}


@router.post("/schemes/{scheme_id}/verify")
def verify(scheme_id: str, d: Decision, p: Principal = Depends(require_fresh)):
    return _decide(scheme_id, "verified", d, p)


@router.post("/schemes/{scheme_id}/reject")
def reject(scheme_id: str, d: Decision, p: Principal = Depends(require_fresh)):
    return _decide(scheme_id, "unverified", d, p)


@router.post("/schemes/{scheme_id}/expire")
def expire(scheme_id: str, d: Decision, p: Principal = Depends(require_fresh)):
    return _decide(scheme_id, "expired", d, p)


@router.post("/schemes/{scheme_id}/request-review")
def request_review(scheme_id: str, d: Decision, p: Principal = Depends(require_admin)):
    return _decide(scheme_id, "needs_review", d, p)


# ------------------------------------------------------------ super admin: roles
class RoleIn(BaseModel):
    user_id: str
    role: str = Field(pattern=r"^(citizen|admin)$")


@router.get("/roles")
def roles(p: Principal = Depends(require_super_admin)):
    return repo().list_roles()


@router.post("/roles")
def set_role(body: RoleIn, p: Principal = Depends(require_super_admin)):
    if body.user_id == p.user_id:
        raise HTTPException(422, "Cannot change your own role")
    repo().set_role(body.user_id, body.role, granted_by=p.user_id)
    repo().audit_add(p.user_id, "role.set", "user", body.user_id, {"role": body.role})
    return {"ok": True}
