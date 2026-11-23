"""Shared test setup: in-memory repo, a fake authenticated user, and token minting for JWT tests."""
import sys
import time
from pathlib import Path

import jwt
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402

SECRET = "test-secret-with-at-least-32-bytes-000000"
config.SUPABASE_JWT_SECRET = SECRET
config.SUPABASE_URL = "https://test.supabase.co"
config.ENV = "development"


def mint(sub: str, phone: str = "+919876543210", role: str = "authenticated", iat=None, exp_in=3600, aud="authenticated", email: str = "citizen@example.gov.in", phone_verified: bool = True, email_verified: bool = True):
    now = int(time.time()) if iat is None else iat
    payload = {
        "sub": sub, "phone": phone, "role": role, "aud": aud, "iss": f"{config.SUPABASE_URL}/auth/v1",
        "iat": now, "exp": now + exp_in, "phone_verified": phone_verified, "email_verified": email_verified
    }
    if email:
        payload["email"] = email
        payload["email_confirmed_at"] = now
    return jwt.encode(payload, SECRET, algorithm="HS256")


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient
    import app as application
    from repo import MemoryRepo, set_repo
    import schemes_store as store
    from pipeline.guardrails import refresh_known
    set_repo(MemoryRepo())
    store.load_all(); refresh_known()
    with TestClient(application.app) as c:
        yield c
    set_repo(None)


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def citizen():
    return mint("11111111-1111-1111-1111-111111111111")


@pytest.fixture()
def other():
    return mint("22222222-2222-2222-2222-222222222222", phone="+919811111111")


@pytest.fixture()
def admin(client):
    from repo import repo
    uid = "33333333-3333-3333-3333-333333333333"
    repo().set_role(uid, "admin", None)
    return mint(uid, phone="+919822222222")


@pytest.fixture()
def fresh_admin(admin):
    return admin


@pytest.fixture()
def super_admin(client):
    from repo import repo
    uid = "44444444-4444-4444-4444-444444444444"
    repo().set_role(uid, "super_admin", None)
    return mint(uid, phone="+919833333333")
