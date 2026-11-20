"""Citizen account: profile (consent-gated), data export, and full account deletion."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from repo import RepoError, repo
from security.auth import Principal, require_user, require_user_or_guest

router = APIRouter(prefix="/api")
ALLOWED_LANG = {"en", "hi", "bn", "te", "mr", "ta", "gu", "kn", "ml", "pa", "or", "as", "ur"}


class ProfileIn(BaseModel):
    display_name: str | None = Field(None, max_length=80)
    language: str | None = None
    state: str | None = Field(None, max_length=60)
    ocr_consent: bool | None = None


@router.get("/me")
def me(p: Principal = Depends(require_user_or_guest)):
    if p.is_guest:   # guests have no stored profile; say so explicitly
        return {"user_id": None, "phone": "", "role": "guest", "profile": None, "guest": True}
    return {"user_id": p.user_id, "phone": p.masked_phone, "role": p.role, "profile": repo().get_profile(p)}


@router.put("/me/profile")
def update_profile(body: ProfileIn, p: Principal = Depends(require_user)):
    fields = body.model_dump(exclude_none=True)
    if "language" in fields and fields["language"] not in ALLOWED_LANG:
        raise HTTPException(422, "unsupported language")
    if fields.get("ocr_consent") is True:
        fields["ocr_consent_at"] = __import__("repo").now()
    elif fields.get("ocr_consent") is False:
        fields["ocr_consent_at"] = None
    return repo().upsert_profile(p, fields)


@router.get("/me/export")
def export(p: Principal = Depends(require_user)):
    """Data portability: everything we hold about this user (no document images - they never reach the server)."""
    return {"profile": repo().get_profile(p), "applications": repo().list_apps(p),
            "bookmarks": repo().list_bookmarks(p), "notifications": repo().list_notifications(p)}


@router.delete("/me")
def delete_me(p: Principal = Depends(require_user)):
    try:
        repo().delete_user(p.user_id)
    except RepoError as e:
        raise HTTPException(e.status, str(e))
    repo().audit_add(None, "account.delete", "user", p.user_id)  # actor is the deleted user; keep id out of audit
    return {"ok": True}
