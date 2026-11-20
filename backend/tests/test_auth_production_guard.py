"""The demo citizen-auth endpoints must be unusable in production."""
import pytest

DEMO_CALLS = [
    ("/api/auth/send-otp", {"phone_number": "9876543210"}),
    ("/api/auth/verify-otp", {"phone_number": "9876543210", "otp": "123456"}),
    ("/api/auth/email-login", {"email": "a@b.com", "password": "password123"}),
    ("/api/auth/email-signup", {"email": "a@b.com", "password": "password123"}),
]


@pytest.mark.parametrize("path,payload", DEMO_CALLS)
def test_demo_auth_disabled_in_production(client, monkeypatch, path, payload):
    import config
    monkeypatch.setattr(config, "ENV", "production")
    r = client.post(path, json=payload)
    assert r.status_code == 501
    assert "authenticated" not in r.text


def test_non_digit_six_char_otp_rejected_in_dev(client):
    r = client.post("/api/auth/verify-otp", json={"phone_number": "9876543210", "otp": "abcdef"})
    assert r.status_code == 400
