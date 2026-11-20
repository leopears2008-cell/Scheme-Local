"""Document + form scanning with Gemini vision (replaces GovBot's tesseract.js and FormSaathi's OpenRouter OCR)."""
import base64
import re

from fastapi import APIRouter, Depends, HTTPException
from security.auth import require_user
from pydantic import BaseModel

from config import GEMINI_MODEL
from pipeline.llm import LLMBusyError, LLMConfigError, image_part, llm_json

router = APIRouter(prefix="/api/ocr", dependencies=[Depends(require_user)])

DOC_TYPES = ["aadhaar", "pan", "voter-id", "ration-card", "income-cert", "caste-cert", "birth-cert",
             "land-record", "bank-passbook", "disability-cert", "marksheet", "other"]

DOC_SYSTEM = f"""You read photos of Indian identity and supporting documents. Return ONLY JSON:
{{"doc_type": one of {DOC_TYPES},
 "confidence": 0-1,
 "language": language of the document,
 "fields": {{ only keys you can actually read, from: fullName, fatherName, dob (YYYY-MM-DD), gender (male|female|other),
   aadhaarNumber (12 digits, no spaces), panNumber, address, district, state, pincode, phone, annualIncome (number, rupees),
   category (SC|ST|OBC|General|EWS|BPL|Minority), rationCardType, bankAccount, ifscCode, landHectares (number), education }},
 "quality_notes": short note if blurry, cropped, glare, or partly unreadable, else ""}}
Never guess or invent a value. Omit a key when unreadable. Transliterate names to English letters when the document is not in English,
but keep the original script in "fullNameLocal" if present."""

FORM_SYSTEM = """You analyse a scanned government form. Detect its language and list every fillable field. Return ONLY JSON:
{"language": ISO 639-1, "languageName": str, "fields": [{"label": as printed, "labelEnglish": str, "value": existing text or "",
 "type": "text|checkbox|date|number|select", "required": bool, "profileKey": best match from [fullName, fatherName, dob, gender,
 aadhaarNumber, phone, address, district, state, pincode, occupation, annualIncome, category, landOwnership, bankAccount, ifscCode,
 rationCardType] or null, "x": %, "y": %, "width": %, "height": %}]}
Coordinates are percentages of image width/height (0 = top/left) for the blank area where the answer should be written. Include every field."""


class ImageRequest(BaseModel):
    image_base64: str  # raw base64 or a data: URL
    mime: str = "image/jpeg"
    consent: bool = False  # the citizen must explicitly agree before the image goes to the AI provider

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}


def _require_consent(req: ImageRequest):
    """Server-side gate. A missing or false consent flag stops processing before any AI call."""
    if req.consent is not True:
        raise HTTPException(403, "Consent is required: the photo is sent to an AI service to read its text. "
                                 "Tick the consent box and try again.")
    if req.mime.lower() not in ALLOWED_MIME:
        raise HTTPException(415, "Only JPEG, PNG or WebP images are accepted")


def _decode(req: ImageRequest) -> tuple[bytes, str]:
    data, mime = req.image_base64, req.mime
    m = re.match(r"data:([\w/+.-]+);base64,(.*)", data, re.S)
    if m:
        mime, data = m.group(1), m.group(2)
    try:
        raw = base64.b64decode(data, validate=False)
    except Exception:
        raise HTTPException(400, "Invalid base64 image")
    if len(raw) > 8_000_000:
        raise HTTPException(413, "Image too large (max 8 MB)")
    return raw, mime


# Verhoeff checksum: catches most Aadhaar misreads before the user trusts an OCR value
_D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],
      [5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]]
_P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],
      [4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]]


def aadhaar_valid(n: str) -> bool:
    if not re.fullmatch(r"[2-9]\d{11}", n or ""):
        return False
    c = 0
    for i, ch in enumerate(reversed(n)):
        c = _D[c][_P[i % 8][int(ch)]]
    return c == 0


@router.post("/document")
def scan_document(req: ImageRequest):
    _require_consent(req)
    raw, mime = _decode(req)
    try:
        out = llm_json(DOC_SYSTEM, [image_part(raw, mime), "Extract the details from this document."], model=GEMINI_MODEL)
    except LLMBusyError:
        raise HTTPException(429, "Gemini is busy, try again shortly")
    except LLMConfigError as e:
        raise HTTPException(503, str(e))
    f = out.get("fields") or {}
    if f.get("aadhaarNumber"):
        f["aadhaarNumber"] = re.sub(r"\D", "", str(f["aadhaarNumber"]))
        out["aadhaar_checksum_ok"] = aadhaar_valid(f["aadhaarNumber"])
    out.setdefault("doc_type", "other")
    return out


@router.post("/form")
def scan_form(req: ImageRequest):
    _require_consent(req)
    raw, mime = _decode(req)
    try:
        out = llm_json(FORM_SYSTEM, [image_part(raw, mime), "Scan this form and list all fields."], model=GEMINI_MODEL)
    except LLMBusyError:
        raise HTTPException(429, "Gemini is busy, try again shortly")
    except LLMConfigError as e:
        raise HTTPException(503, str(e))
    if not out.get("fields"):
        raise HTTPException(502, "Could not read any fields; try a clearer, flatter photo")
    return out
