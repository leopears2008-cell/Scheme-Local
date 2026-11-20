"""Guest sessions: no OTP, no password, optional email (never stored), limited access, rate limits.
Covers the boundary: guests may use public scheme data and chat; they are refused on every other protected route."""
import logging
import time

import jwt
import pytest

import config
from conftest import SECRET, hdr, mint
from security import guest as guest_mod


@pytest.fixture(autouse=True)
def _guest_on(monkeypatch):
    from security.ratelimit import limiter
    limiter.hits.clear()
    monkeypatch.setattr(config, "GUEST_ENABLED", True)
    monkeypatch.setattr(config, "GUEST_TOKEN_SECRET", "test-guest-secret-0123456789abcdefghij")
    monkeypatch.setattr(config, "GUEST_ASK_PER_10MIN", 3)
    monkeypatch.setattr(config, "GUEST_ASK_PER_DAY", 40)
    monkeypatch.setattr(config, "GUEST_SESSIONS_PER_IP_PER_HOUR", 50)
    yield
    limiter.hits.clear()


def _start(client, email=None):
    body = {} if email is None else {"email": email}
    return client.post("/api/guest/session", json=body)


@pytest.fixture()
def guest(client):
    r = _start(client)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------------------------------------------------------------- starting a session
def test_guest_starts_without_otp_or_password(client):
    r = _start(client)
    assert r.status_code == 200 and r.json()["guest"] is True and r.json()["expires_in"] == config.GUEST_TTL_S


def test_optional_email_is_validated_but_not_returned_or_stored(client, caplog):
    with caplog.at_level(logging.DEBUG):
        r = _start(client, "someone@example.com")
    assert r.status_code == 200
    assert "someone@example.com" not in r.text
    assert all("someone@example.com" not in rec.getMessage() for rec in caplog.records)
    assert "someone@example.com" not in jwt.decode(r.json()["token"], options={"verify_signature": False}).values()


@pytest.mark.parametrize("bad", ["not-an-email", "a@b", "x" * 300 + "@example.com", "a b@example.com"])
def test_invalid_email_rejected(client, bad):
    assert _start(client, bad).status_code == 422


def test_empty_email_is_fine(client):
    assert _start(client, "").status_code == 200


def test_guest_can_be_turned_off(client, monkeypatch):
    monkeypatch.setattr(config, "GUEST_ENABLED", False)
    assert _start(client).status_code == 403


def test_production_without_secret_refuses_guests(client, monkeypatch):
    monkeypatch.setattr(config, "GUEST_TOKEN_SECRET", "")
    monkeypatch.setattr(config, "ENV", "production")
    try:
        assert _start(client).status_code == 503
    finally:
        monkeypatch.setattr(config, "ENV", "development")


def test_production_config_refuses_to_start_with_guest_and_no_secret(monkeypatch):
    monkeypatch.setattr(config, "ENV", "production")
    monkeypatch.setattr(config, "GUEST_ENABLED", True)
    monkeypatch.setattr(config, "GUEST_TOKEN_SECRET", "")
    problems = config.validate_config()
    assert any("GUEST_TOKEN_SECRET" in p for p in problems)


# ---------------------------------------------------------------- what a guest CAN do
def test_guest_can_browse_schemes_and_run_eligibility(client, guest):
    assert client.get("/api/schemes", params={"q": "kisan"}).status_code == 200
    assert client.post("/api/eligibility", json={"profile": {"age": 30}}).status_code == 200


def test_guest_can_see_own_role(client, guest):
    r = client.get("/api/me", headers=hdr(guest))
    assert r.status_code == 200 and r.json()["role"] == "guest" and r.json()["profile"] is None


def test_guest_can_use_chat(client, guest, monkeypatch):
    pytest.importorskip("chromadb", reason="pipeline imports need requirements.txt")
    import pipeline.graph as graph
    monkeypatch.setattr(graph, "run_pipeline", lambda *a, **k: {"answer_text": "hi", "verdicts": [], "retrieved": [],
                                                              "confidence": 0.0, "follow_up_question": None, "language": "english"})
    r = client.post("/api/ask", headers=hdr(guest), json={"message": "hello", "session_id": "guest-session-01"})
    assert r.status_code == 200


# ---------------------------------------------------------------- what a guest CANNOT do
@pytest.mark.parametrize("method,path,kwargs", [
    ("get", "/api/admin/schemes", {}),
    ("get", "/api/admin/roles", {}),
    ("post", "/api/admin/schemes/pm_kisan/verify", {"json": {"note": "x" * 10, "source_url": "https://pmkisan.gov.in/"}}),
    ("get", "/api/applications", {}),
    ("post", "/api/applications", {"json": {"scheme_id": "pm_kisan"}}),
    ("get", "/api/bookmarks", {}),
    ("post", "/api/bookmarks/pm_kisan", {}),
    ("get", "/api/notifications", {}),
    ("get", "/api/me/export", {}),
    ("delete", "/api/me", {}),
    ("put", "/api/me/profile", {"json": {"language": "ta"}}),
    ("post", "/api/ocr/document", {"json": {"image_base64": "AAAA", "mime": "image/png", "consent": True}}),
    ("post", "/api/ocr/form", {"json": {"image_base64": "AAAA", "mime": "image/png", "consent": True}}),
    ("post", "/api/voice/stt", {"json": {"audio_base64": "AAAA", "mime": "audio/webm", "language": "ta"}}),
    ("post", "/api/voice/tts", {"json": {"text": "hi", "language": "ta"}}),
    ("post", "/api/translate", {"json": {"texts": ["hi"], "target": "ta"}}),
    ("post", "/api/forms/summary", {"json": {"scheme_id": "pm_kisan", "fields": []}}),
    ("post", "/api/forms/official", {"json": {"scheme_id": "pm_kisan", "values": {}}}),
])
def test_guest_is_refused_on_every_protected_route(client, guest, method, path, kwargs):
    r = getattr(client, method)(path, headers=hdr(guest), **kwargs)
    assert r.status_code in (401, 403), f"{method} {path} returned {r.status_code}"
    assert r.status_code != 200


def test_guest_cannot_be_admin_even_with_admin_claims(client, monkeypatch):
    """A token that claims role=admin but is signed as a guest is still a guest."""
    secret = config.GUEST_TOKEN_SECRET
    now = int(time.time())
    t = jwt.encode({"sub": "guest:abc123", "iss": guest_mod.GUEST_ISS, "aud": "guest", "role": "admin",
                    "app_metadata": {"role": "super_admin"}, "iat": now, "exp": now + 600}, secret, algorithm="HS256")
    # a guest-signed token that claims any other role is invalid (401); it can never reach admin
    assert client.get("/api/admin/schemes", headers=hdr(t)).status_code in (401, 403)
    assert client.get("/api/me", headers=hdr(t)).status_code == 401


def test_guest_token_cannot_pose_as_a_citizen(client, monkeypatch):
    """The guest sub prefix is the only identity a guest token can carry; a citizen-looking sub is refused."""
    now = int(time.time())
    t = jwt.encode({"sub": "11111111-1111-1111-1111-111111111111", "iss": guest_mod.GUEST_ISS, "aud": "guest",
                    "role": "guest", "iat": now, "exp": now + 600}, config.GUEST_TOKEN_SECRET, algorithm="HS256")
    assert client.get("/api/applications", headers=hdr(t)).status_code == 401


# ---------------------------------------------------------------- token integrity
def test_forged_guest_token_rejected(client):
    now = int(time.time())
    forged = jwt.encode({"sub": "guest:x", "iss": guest_mod.GUEST_ISS, "aud": "guest", "role": "guest",
                         "iat": now, "exp": now + 600}, "attacker-secret-attacker-secret-0000", algorithm="HS256")
    assert client.get("/api/me", headers=hdr(forged)).status_code == 401


def test_expired_guest_token_rejected(client):
    now = int(time.time())
    old = jwt.encode({"sub": "guest:x", "iss": guest_mod.GUEST_ISS, "aud": "guest", "role": "guest",
                      "iat": now - 9000, "exp": now - 3600}, config.GUEST_TOKEN_SECRET, algorithm="HS256")
    assert client.get("/api/me", headers=hdr(old)).status_code == 401


def test_guest_token_with_wrong_audience_rejected(client):
    now = int(time.time())
    t = jwt.encode({"sub": "guest:x", "iss": guest_mod.GUEST_ISS, "aud": "authenticated", "role": "guest",
                    "iat": now, "exp": now + 600}, config.GUEST_TOKEN_SECRET, algorithm="HS256")
    assert client.get("/api/me", headers=hdr(t)).status_code == 401


def test_supabase_citizen_token_still_works(client):
    assert client.get("/api/applications", headers=hdr(mint("11111111-1111-1111-1111-111111111111"))).status_code == 200


def test_guest_disabled_at_runtime_invalidates_existing_tokens(client, guest, monkeypatch):
    monkeypatch.setattr(config, "GUEST_ENABLED", False)
    assert client.get("/api/me", headers=hdr(guest)).status_code == 401


# ---------------------------------------------------------------- rate limits
def test_guest_chat_is_rate_limited(client, guest, monkeypatch):
    pytest.importorskip("chromadb", reason="pipeline imports need requirements.txt")
    import pipeline.graph as graph
    monkeypatch.setattr(graph, "run_pipeline", lambda *a, **k: {"answer_text": "ok", "verdicts": [], "retrieved": [],
                                                              "confidence": 0.0, "follow_up_question": None, "language": "english"})
    codes = [client.post("/api/ask", headers=hdr(guest), json={"message": "hello", "session_id": "guest-rate-0001"}).status_code for _ in range(5)]
    assert codes[:3] == [200, 200, 200] and 429 in codes[3:]


def test_guest_chat_daily_cap(client, monkeypatch):
    pytest.importorskip("chromadb", reason="pipeline imports need requirements.txt")
    import pipeline.graph as graph
    monkeypatch.setattr(config, "GUEST_ASK_PER_10MIN", 1000)
    monkeypatch.setattr(config, "GUEST_ASK_PER_DAY", 2)
    monkeypatch.setattr(graph, "run_pipeline", lambda *a, **k: {"answer_text": "ok", "verdicts": [], "retrieved": [],
                                                              "confidence": 0.0, "follow_up_question": None, "language": "english"})
    t = _start(client).json()["token"]
    codes = [client.post("/api/ask", headers=hdr(t), json={"message": "hello", "session_id": "guest-day-0001"}).status_code for _ in range(4)]
    assert codes.count(200) == 2 and codes.count(429) == 2


def test_guest_session_creation_is_limited_per_ip(client, monkeypatch):
    monkeypatch.setattr(config, "GUEST_SESSIONS_PER_IP_PER_HOUR", 2)
    codes = [_start(client).status_code for _ in range(4)]
    assert codes[:2] == [200, 200] and codes[2:] == [429, 429]


def test_guest_limits_do_not_block_citizens(client, monkeypatch):
    monkeypatch.setattr(config, "GUEST_SESSIONS_PER_IP_PER_HOUR", 0)
    assert client.get("/api/applications", headers=hdr(mint("11111111-1111-1111-1111-111111111111"))).status_code == 200


# ---------------------------------------------------------------- isolation between guests
def test_two_guests_have_separate_chat_memory(client, monkeypatch):
    pytest.importorskip("chromadb", reason="pipeline imports need requirements.txt")
    import routers.chat as chat
    chat.SESSIONS.clear()
    a = _start(client).json()["token"]
    b = _start(client).json()["token"]
    ka = chat._key(jwt.decode(a, options={"verify_signature": False})["sub"], "same-session-id")
    kb = chat._key(jwt.decode(b, options={"verify_signature": False})["sub"], "same-session-id")
    assert ka != kb
