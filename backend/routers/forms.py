"""Filled-PDF generation: official blank forms (AcroForm), readable summaries, and overlays on scanned forms."""
import base64
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from security.auth import require_user

import schemes_store as store
from services import pdfgen

router = APIRouter(prefix="/api/forms", dependencies=[Depends(require_user)])


class FieldValue(BaseModel):
    label: str
    value: str | None = ""


class FillRequest(BaseModel):
    scheme_id: str
    values: dict[str, str] = {}      # profile key -> value (matches the official form's field names)
    fields: list[FieldValue] = []    # label/value rows for the summary page (any language)


class OverlayField(BaseModel):
    value: str
    x: float
    y: float
    width: float = 20
    height: float = 3


class OverlayRequest(BaseModel):
    image_base64: str
    fields: list[OverlayField]


def _pdf(b: bytes, name: str, extra: dict | None = None) -> Response:
    return Response(b, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}"', **(extra or {})})


def _scheme(sid):
    s = store.SCHEMES.get(sid)
    if not s:
        raise HTTPException(404, "Unknown scheme")
    return s


@router.get("/{scheme_id}/fields")
def fields(scheme_id: str):
    s = _scheme(scheme_id)
    return {"fields": s.get("form_fields") or _default_fields(), "has_official_form": scheme_id in pdfgen.FORM_FOR_SCHEME,
            "documents_required": s.get("documents_required", []), "portal": s.get("source_url", "")}


def _default_fields():
    return [{"id": k, "label": l, "profileKey": k, "type": "text", "required": True} for k, l in [
        ("fullName", "Full Name"), ("dob", "Date of Birth"), ("gender", "Gender"), ("aadhaarNumber", "Aadhaar Number"),
        ("phone", "Mobile Number"), ("address", "Address"), ("state", "State"), ("annualIncome", "Annual Income")]]


@router.post("/summary")
def summary(req: FillRequest):
    s = _scheme(req.scheme_id)
    ref = "MSG-" + uuid.uuid4().hex[:8].upper()
    b = pdfgen.summary_pdf(s, [f.model_dump() for f in req.fields], ref=ref)
    return _pdf(b, f"{req.scheme_id}-summary.pdf", {"X-Reference": ref})


@router.post("/official")
def official(req: FillRequest):
    _scheme(req.scheme_id)
    b, skipped = pdfgen.fill_official_form(req.scheme_id, req.values)
    if b is None:
        raise HTTPException(404, "No blank official form is bundled for this scheme; use the summary PDF or scan your own form")
    return _pdf(b, f"{req.scheme_id}-form.pdf", {"X-Skipped-Fields": ",".join(skipped)})


@router.post("/overlay")
def overlay(req: OverlayRequest):
    m = re.match(r"data:[\w/+.-]+;base64,(.*)", req.image_base64, re.S)
    try:
        raw = base64.b64decode(m.group(1) if m else req.image_base64)
        b = pdfgen.overlay_form(raw, [f.model_dump() for f in req.fields])
    except Exception as e:
        raise HTTPException(400, f"Could not render overlay: {e}")
    return _pdf(b, "filled-form.pdf")
