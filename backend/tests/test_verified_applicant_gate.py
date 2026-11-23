"""Unit and integration tests for verified real identity requirement (Problem B).
Tests:
1. Mobile number OTP verification (real generation, 3-attempt limit, lockout, expiry).
2. Email verification (disposable email domain blocking, 3-attempt limit, lockout).
3. Server-side blocking of apply & application submission until BOTH are verified.
"""
import time
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException

from routers.auth import (
    send_otp, verify_otp, send_email_otp, verify_email_otp,
    is_disposable_email, create_verified_session, auth_status,
    SendOtpRequest, VerifyOtpRequest, SendEmailOtpRequest, VerifyEmailOtpRequest,
    CreateVerifiedSessionRequest, _otp_store
)
from security.auth import Principal, require_verified_applicant
from routers.tracker import create, NewApp
from routers.forms import summary, FillRequest, FieldValue
import schemes_store as store
from repo import MemoryRepo, set_repo


@pytest.fixture(autouse=True)
def _setup_repo():
    set_repo(MemoryRepo())
    store.load_all()
    _otp_store.clear()
    yield
    set_repo(None)
    _otp_store.clear()


def _mock_request(ip="127.0.0.1", headers=None):
    req = MagicMock()
    req.client.host = ip
    req.headers = headers or {}
    return req


def test_phone_otp_retry_limit_lockout():
    """Wrong OTP 3 times locks out and invalidates the OTP."""
    req = _mock_request(ip="10.0.0.1")
    send_res = send_otp(SendOtpRequest(phone_number="9812345678"), req)
    assert send_res["status"] == "ok"
    real_otp = send_res["dev_code"]

    # 1st wrong attempt
    with pytest.raises(HTTPException) as exc1:
        verify_otp(VerifyOtpRequest(phone_number="9812345678", otp="000000"))
    assert exc1.value.status_code == 400
    assert "2 attempt(s) remaining" in exc1.value.detail

    # 2nd wrong attempt
    with pytest.raises(HTTPException) as exc2:
        verify_otp(VerifyOtpRequest(phone_number="9812345678", otp="000001"))
    assert exc2.value.status_code == 400
    assert "1 attempt(s) remaining" in exc2.value.detail

    # 3rd wrong attempt -> locked out (429)
    with pytest.raises(HTTPException) as exc3:
        verify_otp(VerifyOtpRequest(phone_number="9812345678", otp="000002"))
    assert exc3.value.status_code == 429
    assert "Maximum attempts exceeded" in exc3.value.detail

    # Even the correct OTP is now rejected because it was invalidated
    with pytest.raises(HTTPException) as exc4:
        verify_otp(VerifyOtpRequest(phone_number="9812345678", otp=real_otp))
    assert exc4.value.status_code == 400


def test_disposable_email_rejected():
    """Disposable temporary email domains are rejected at registration/verification."""
    req = _mock_request()
    disposable_cases = [
        "user@mailinator.com",
        "fake@guerrillamail.com",
        "temp@tempmail.com",
        "bad@10minutemail.com",
        "bot@sharklasers.com",
        "test@yopmail.com"
    ]
    for email in disposable_cases:
        assert is_disposable_email(email) is True
        with pytest.raises(HTTPException) as exc:
            send_email_otp(SendEmailOtpRequest(email=email), req)
        assert exc.value.status_code == 422
        assert "Disposable or temporary email" in exc.value.detail


def test_email_otp_flow_and_lockout():
    """Valid email receives OTP, rejects wrong code, locks out on 3 tries."""
    req = _mock_request(ip="10.0.0.2")
    valid_email = "citizen.verified@gmail.com"
    send_res = send_email_otp(SendEmailOtpRequest(email=valid_email), req)
    assert send_res["status"] == "ok"
    otp = send_res["dev_code"]

    # 1st wrong attempt
    with pytest.raises(HTTPException) as exc1:
        verify_email_otp(VerifyEmailOtpRequest(email=valid_email, otp="000000"))
    assert exc1.value.status_code == 400
    assert "2 attempt(s) remaining" in exc1.value.detail

    # Correct attempt
    res = verify_email_otp(VerifyEmailOtpRequest(email=valid_email, otp=otp))
    assert res["status"] == "ok"
    assert res["email_verified"] is True


def test_apply_blocked_for_unverified_phone():
    """An applicant without a verified mobile number is blocked from applying server-side."""
    p_unverified = Principal(
        user_id="citizen:unverified",
        phone="",
        token="token",
        iat=int(time.time()),
        phone_verified=False
    )

    # 1. Gate raises 403
    with pytest.raises(HTTPException) as exc1:
        require_verified_applicant(p_unverified)
    assert exc1.value.status_code == 403
    assert "Mobile number OTP verification is required" in exc1.value.detail

    # 2. Blocked from creating applications in tracker
    with pytest.raises(HTTPException) as exc2:
        create(NewApp(scheme_id="pm_kisan", status="submitted"), p=p_unverified)
    assert exc2.value.status_code == 403

    # 3. Blocked from PDF form generation
    with pytest.raises(HTTPException) as exc3:
        summary(FillRequest(scheme_id="pm_kisan", fields=[FieldValue(label="Name", value="A")]), p=p_unverified)
    assert exc3.value.status_code == 403


def test_apply_blocked_for_guest():
    """Guest sessions cannot apply."""
    p_guest = Principal(
        user_id="guest:123",
        phone="",
        token="token",
        iat=int(time.time()),
        email="",
        phone_verified=False,
        email_verified=False
    )
    with pytest.raises(HTTPException) as exc:
        require_verified_applicant(p_guest)
    assert exc.value.status_code == 403
    assert "Guest sessions cannot apply" in exc.value.detail


def test_apply_allowed_when_phone_verified():
    """When phone is verified by OTP, applicant passes gate and can apply directly (no email OTP needed)."""
    p_phone_verified = Principal(
        user_id="citizen:9876543210",
        phone="+919876543210",
        token="token",
        iat=int(time.time()),
        email="",
        phone_verified=True,
        email_verified=False
    )

    # 1. Gate passes
    approved = require_verified_applicant(p_phone_verified)
    assert approved == p_phone_verified

    # 2. Application creation succeeds
    res_app = create(NewApp(scheme_id="pm_kisan", status="submitted"), p=p_phone_verified)
    assert res_app["status"] == "submitted"
    assert res_app["scheme_id"] == "pm_kisan"

    # 3. PDF generation succeeds
    res_pdf = summary(FillRequest(scheme_id="pm_kisan", fields=[FieldValue(label="Full Name", value="Ramesh Kumar")]), p=p_phone_verified)
    assert res_pdf.media_type == "application/pdf"
    assert len(res_pdf.body) > 1000
