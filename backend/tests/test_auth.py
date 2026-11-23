import time
from conftest import hdr, mint, SECRET
import jwt

BASE = "/api/applications"


def test_anonymous_blocked_from_user_data(client):
    assert client.get(BASE).status_code == 401
    assert client.get("/api/me").status_code == 401
    assert client.post("/api/ask", json={"message": "x", "session_id": "s"}).status_code == 401


def test_garbage_token_rejected(client):
    assert client.get(BASE, headers=hdr("not.a.jwt")).status_code == 401


def test_expired_token_rejected(client):
    t = mint("11111111-1111-1111-1111-111111111111", iat=int(time.time()) - 7200, exp_in=60)
    assert client.get(BASE, headers=hdr(t)).status_code == 401


def test_wrong_audience_rejected(client):
    assert client.get(BASE, headers=hdr(mint("11111111-1111-1111-1111-111111111111", aud="other"))).status_code == 401


def test_anon_role_token_rejected(client):
    assert client.get(BASE, headers=hdr(mint("11111111-1111-1111-1111-111111111111", role="anon"))).status_code == 401


def test_forged_signature_rejected(client):
    forged = jwt.encode({"sub": "x", "aud": "authenticated", "role": "authenticated", "exp": int(time.time()) + 99, "phone": "+919000000000"}, "wrong-secret-xxxxxxxxxxxxxxxxxxxxxxxxxx", algorithm="HS256")
    assert client.get(BASE, headers=hdr(forged)).status_code == 401


def test_token_without_verified_phone_rejected(client):
    assert client.get(BASE, headers=hdr(mint("11111111-1111-1111-1111-111111111111", phone=""))).status_code == 403


def test_citizen_cannot_reach_admin(client, citizen):
    assert client.get("/api/admin/schemes", headers=hdr(citizen)).status_code == 403
    assert client.get("/api/admin/roles", headers=hdr(citizen)).status_code == 403


def test_admin_cannot_manage_roles(client, admin):
    assert client.get("/api/admin/roles", headers=hdr(admin)).status_code == 403
    assert client.post("/api/admin/roles", headers=hdr(admin), json={"user_id": "x" * 36, "role": "admin"}).status_code == 403


def test_frontend_role_claims_are_ignored(client):
    """A user who puts role=admin into user_metadata / custom claims gets nothing: roles come only from user_roles."""
    fake = jwt.encode({"sub": "55555555-5555-5555-5555-555555555555", "phone": "+919844444444", "aud": "authenticated",
                       "role": "authenticated", "user_metadata": {"role": "admin"}, "app_metadata": {"role": "super_admin"},
                       "iss": "https://test.supabase.co/auth/v1", "iat": int(time.time()), "exp": int(time.time()) + 600}, SECRET, algorithm="HS256")
    assert client.get("/api/admin/schemes", headers=hdr(fake)).status_code == 403


def test_super_admin_phone_bootstrap_from_env(client, monkeypatch):
    import config
    from repo import repo
    monkeypatch.setattr(config, "SUPER_ADMIN_PHONES", ["+919855555555"])
    uid = "66666666-6666-6666-6666-666666666666"
    t = mint(uid, phone="+919855555555")
    assert client.get("/api/admin/roles", headers=hdr(t)).status_code == 200
    assert repo().get_role(uid) == "super_admin"


def test_user_isolation_on_applications(client, citizen, other):
    r = client.post("/api/applications", headers=hdr(citizen), json={"scheme_id": "pm_kisan"})
    assert r.status_code == 201
    app_id = r.json()["id"]
    assert client.get(BASE, headers=hdr(other)).json() == []
    assert client.get(f"{BASE}/{app_id}", headers=hdr(other)).status_code == 404
    assert client.patch(f"{BASE}/{app_id}", headers=hdr(other), json={"status": "approved"}).status_code == 404
    assert client.delete(f"{BASE}/{app_id}", headers=hdr(other)).status_code == 404
    assert len(client.get(BASE, headers=hdr(citizen)).json()) == 1


def test_auth_send_otp_success_and_validation(client):
    r1 = client.post("/api/auth/send-otp", json={"phone_number": "9876543210"})
    assert r1.status_code == 200
    assert r1.json()["status"] == "ok"

    r2 = client.post("/api/auth/send-otp", json={"phone_number": "123"})
    assert r2.status_code == 422


def test_auth_verify_otp_flow(client):
    r_send = client.post("/api/auth/send-otp", json={"phone_number": "9876543210"})
    assert r_send.status_code == 200
    otp = r_send.json().get("dev_code")
    assert otp is not None and len(otp) == 6
    r = client.post("/api/auth/verify-otp", json={"phone_number": "9876543210", "otp": otp})
    assert r.status_code == 200
    assert r.json()["user"]["authenticated"] is True


def test_auth_email_login_and_signup(client):
    r1 = client.post("/api/auth/email-signup", json={"email": "citizen@test.com", "password": "password123", "full_name": "Test Citizen", "district": "Madurai"})
    assert r1.status_code == 200
    assert r1.json()["user"]["district"] == "Madurai"

    r2 = client.post("/api/auth/email-login", json={"email": "citizen@test.com", "password": "password123"})
    assert r2.status_code == 200
    assert r2.json()["user"]["email"] == "citizen@test.com"

    # Invalid email rejected
    r3 = client.post("/api/auth/email-login", json={"email": "not-an-email", "password": "short"})
    assert r3.status_code == 422
