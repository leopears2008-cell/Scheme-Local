"""Application tracking. Every query runs with the USER's JWT, so Postgres RLS enforces ownership.
We never claim official government tracking: status is what the citizen records themselves."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import schemes_store as store
from repo import repo
from security.auth import Principal, require_user

router = APIRouter(prefix="/api")
STATUSES = ["draft", "submitted", "under_review", "need_documents", "approved", "rejected"]


class NewApp(BaseModel):
    scheme_id: str = Field(pattern=r"^[a-z0-9_]{3,80}$")
    status: str = "draft"
    reference_number: str | None = Field(None, max_length=60)
    notes: str | None = Field(None, max_length=500)
    follow_up_date: date | None = None


class AppUpdate(BaseModel):
    status: str | None = None
    reference_number: str | None = Field(None, max_length=60)
    notes: str | None = Field(None, max_length=500)
    follow_up_date: date | None = None
    event_note: str = Field("", max_length=500)


@router.get("/applications")
def list_apps(p: Principal = Depends(require_user)):
    return repo().list_apps(p)


@router.post("/applications", status_code=201)
def create(body: NewApp, p: Principal = Depends(require_user)):
    if body.status not in STATUSES:
        raise HTTPException(422, f"status must be one of {STATUSES}")
    s = store.SCHEMES.get(body.scheme_id)
    if not s:
        raise HTTPException(404, "Unknown scheme")
    row = {"user_id": p.user_id, "scheme_id": body.scheme_id, "scheme_name": s["name"], "status": body.status,
           "reference_number": body.reference_number, "notes": body.notes, "follow_up_date": body.follow_up_date.isoformat() if body.follow_up_date else None}
    return repo().create_app(p, row)


@router.patch("/applications/{app_id}")
def update(app_id: str, body: AppUpdate, p: Principal = Depends(require_user)):
    if body.status and body.status not in STATUSES:
        raise HTTPException(422, f"status must be one of {STATUSES}")
    fields = body.model_dump(exclude={"event_note"}, exclude_none=True)
    if "follow_up_date" in fields:
        fields["follow_up_date"] = fields["follow_up_date"].isoformat()
    if not fields:
        raise HTTPException(422, "nothing to update")
    updated = repo().update_app(p, app_id, fields)
    if updated is None:
        raise HTTPException(404, "Not found")   # same answer whether it doesn't exist or belongs to someone else
    if body.status:
        repo().add_event(p, app_id, body.status, body.event_note)
        repo().add_notification(p, "status", updated["scheme_name"], f"Status updated: {body.status}", app_id)
    return repo().get_app(p, app_id)


@router.delete("/applications/{app_id}")
def delete(app_id: str, p: Principal = Depends(require_user)):
    if not repo().delete_app(p, app_id):
        raise HTTPException(404, "Not found")
    return {"deleted": True}


@router.get("/applications/{app_id}")
def get_one(app_id: str, p: Principal = Depends(require_user)):
    a = repo().get_app(p, app_id)
    if not a:
        raise HTTPException(404, "Not found")
    return a


@router.get("/bookmarks")
def bookmarks(p: Principal = Depends(require_user)):
    return repo().list_bookmarks(p)


@router.post("/bookmarks/{scheme_id}")
def toggle(scheme_id: str, p: Principal = Depends(require_user)):
    if scheme_id not in store.SCHEMES:
        raise HTTPException(404, "Unknown scheme")
    return {"bookmarked": repo().toggle_bookmark(p, scheme_id)}


@router.get("/notifications")
def notifications(p: Principal = Depends(require_user)):
    return repo().list_notifications(p)


@router.post("/notifications/read")
def read_all(p: Principal = Depends(require_user)):
    repo().mark_notifications_read(p)
    return {"ok": True}
