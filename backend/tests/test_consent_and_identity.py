"""P0 checks: OCR consent is enforced on the server, and identity comes only from the validated token."""
import base64
from conftest import hdr, mint

IMG = base64.b64encode(b"\xff\xd8\xff" + b"0" * 64).decode()


def test_ocr_refuses_without_consent_flag(client, citizen):
    r = client.post("/api/ocr/document", headers=hdr(citizen), json={"image_base64": IMG, "mime": "image/jpeg"})
    assert r.status_code == 403 and "Consent" in r.json()["detail"]


def test_ocr_refuses_when_consent_false(client, citizen):
    r = client.post("/api/ocr/document", headers=hdr(citizen), json={"image_base64": IMG, "mime": "image/jpeg", "consent": False})
    assert r.status_code == 403


def test_form_scan_also_requires_consent(client, citizen):
    r = client.post("/api/ocr/form", headers=hdr(citizen), json={"image_base64": IMG, "mime": "image/jpeg"})
    assert r.status_code == 403


def test_ocr_rejects_non_image_mime_even_with_consent(client, citizen):
    r = client.post("/api/ocr/document", headers=hdr(citizen), json={"image_base64": IMG, "mime": "text/html", "consent": True})
    assert r.status_code == 415


def test_ocr_needs_login_before_consent_check(client):
    assert client.post("/api/ocr/document", json={"image_base64": IMG, "mime": "image/jpeg", "consent": True}).status_code == 401


def test_identity_ignores_client_supplied_user_id(client, citizen, other):
    """Sending another user's id in the body or header does not change whose data is read."""
    client.post("/api/applications", headers=hdr(other), json={"scheme_id": "pm_kisan", "user_id": "22222222-2222-2222-2222-222222222222"})
    r = client.get("/api/applications", headers={**hdr(citizen), "X-User-Id": "22222222-2222-2222-2222-222222222222"})
    assert r.json() == []


def test_role_from_client_header_is_ignored(client, citizen):
    r = client.get("/api/admin/schemes", headers={**hdr(citizen), "X-Role": "admin"})
    assert r.status_code == 403


def test_expired_or_bad_token_gives_401_with_message(client):
    r = client.get("/api/applications", headers=hdr("bad.token.value"))
    assert r.status_code == 401 and r.json()["detail"]
