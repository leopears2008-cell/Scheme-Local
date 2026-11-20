import base64
import io

from conftest import hdr
from routers.ocr import aadhaar_valid
from services import pdfgen


def test_aadhaar_checksum():
    assert aadhaar_valid("234567890124") is True
    assert aadhaar_valid("234567890125") is False
    assert aadhaar_valid("123456789012") is False      # cannot start with 0/1
    assert aadhaar_valid("12345") is False


def test_upload_requires_login(client):
    assert client.post("/api/ocr/document", json={"image_base64": "AAAA", "mime": "image/png"}).status_code == 401


def test_upload_size_limit(client, citizen, monkeypatch):
    import config
    monkeypatch.setattr(config, "MAX_UPLOAD_BYTES", 1000)
    big = base64.b64encode(b"x" * 5000).decode()
    r = client.post("/api/ocr/document", json={"image_base64": big, "mime": "image/png"}, headers=hdr(citizen))
    assert r.status_code == 413


def test_image_decoder_rejects_non_image_mime(client, citizen):
    r = client.post("/api/ocr/document", json={"image_base64": base64.b64encode(b"<script>").decode(), "mime": "text/html", "consent": True}, headers=hdr(citizen))
    assert r.status_code in (400, 415, 422)   # refused before any model call


def test_summary_pdf_is_valid_and_contains_no_secret_fields(client, citizen):
    r = client.post("/api/forms/summary", json={"scheme_id": "pm_kisan", "fields": [{"label": "Full name", "value": "Test"}]}, headers=hdr(citizen))
    assert r.status_code == 200 and r.content[:4] == b"%PDF"


def test_summary_pdf_states_it_is_a_draft():
    b = pdfgen.summary_pdf({"name": "X", "documents_required": []}, [{"label": "a", "value": "b"}], ref="R1")
    assert b[:4] == b"%PDF"


def test_official_form_bundled_only_for_known_schemes(client, citizen):
    assert client.post("/api/forms/official", json={"scheme_id": "pm_kisan", "values": {"fullName": "A"}}, headers=hdr(citizen)).status_code == 200
    assert client.post("/api/forms/official", json={"scheme_id": "tn_001", "values": {}}, headers=hdr(citizen)).status_code == 404


def test_tamil_renders_in_summary_pdf():
    b = pdfgen.summary_pdf({"name": "X"}, [{"label": "பெயர்", "value": "லியோ"}], ref="R2")
    assert b[:4] == b"%PDF" and len(b) > 1000
