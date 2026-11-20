"""Citizen Authentication Router (Mobile OTP + Email Flow) for Sahayak & MySchemeGuide.

DEMO ONLY: these endpoints have no SMS gateway, no password store and no session tokens.
They are disabled when ENV=production; real authentication goes through Supabase
(see security/auth.py), which issues the JWTs the protected routes require.
"""
import logging
import random
import secrets
import time
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

import config
from security.ratelimit import limiter

log = logging.getLogger("auth")


def _demo_only() -> None:
    """Block the demo auth flow in production so it can never mint an 'authenticated' response."""
    if config.ENV == "production":
        raise HTTPException(501, "This demo auth endpoint is disabled in production. Use Supabase authentication.")


router = APIRouter(prefix="/api/auth", tags=["auth"], dependencies=[Depends(_demo_only)])

# In-memory store for OTPs in dev/demo environment: phone -> {otp, expires_at}
_otp_store: dict[str, dict] = {}


class SendOtpRequest(BaseModel):
    phone_number: str = Field(..., max_length=20)


class VerifyOtpRequest(BaseModel):
    phone_number: str = Field(..., max_length=20)
    otp: str = Field(..., min_length=4, max_length=8)


class EmailAuthRequest(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., min_length=6, max_length=128)
    full_name: str | None = Field(None, max_length=100)
    district: str | None = Field(None, max_length=100)


def client_ip(request: Request) -> str:
    if config.TRUST_PROXY:
        fwd = request.headers.get("x-forwarded-for", "")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/send-otp")
def send_otp(body: SendOtpRequest, request: Request):
    phone = body.phone_number.strip().replace(" ", "").replace("-", "")
    if len(phone) < 10:
        raise HTTPException(422, "Invalid phone number length")

    # Rate limiting: max 20 OTP requests per hour per IP
    wait = limiter.check(f"otp:{client_ip(request)}", 20, 3600)
    if wait:
        raise HTTPException(429, "Too many OTP requests. Please wait.", headers={"Retry-After": str(wait)})

    otp_code = str(random.randint(100000, 999999))
    _otp_store[phone] = {
        "otp": otp_code,
        "expires_at": time.time() + 300  # 5 minutes validity
    }

    log.info("OTP generated for citizen phone %s (expires in 5m)", phone[-4:] if len(phone) >= 4 else phone)
    return {
        "status": "ok",
        "message": "OTP sent successfully / OTP அனுப்பப்பட்டது",
        "phone_number": phone,
        "demo_hint": "In local dev, you can use any valid 6-digit OTP or the generated code"
    }


@router.post("/verify-otp")
def verify_otp(body: VerifyOtpRequest):
    phone = body.phone_number.strip().replace(" ", "").replace("-", "")
    submitted_otp = body.otp.strip()

    record = _otp_store.get(phone)
    is_valid = bool(
        record
        and time.time() <= record["expires_at"]
        and secrets.compare_digest(record["otp"], submitted_otp)
    )

    # Dev-only fallback (no SMS gateway locally): accept any 6-digit code.
    # Unreachable in production because the router rejects every request there.
    if not is_valid and len(submitted_otp) == 6 and submitted_otp.isdigit():
        is_valid = True

    if not is_valid:
        raise HTTPException(400, "Invalid or expired OTP / தவறான அல்லது காலாவதியான OTP")

    _otp_store.pop(phone, None)

    return {
        "status": "ok",
        "message": "Authentication successful / வெற்றிகரமாக சரிபார்க்கப்பட்டது",
        "user": {
            "user_id": f"citizen:{phone[-10:]}",
            "phone": phone,
            "role": "citizen",
            "authenticated": True
        }
    }


@router.post("/email-login")
def email_login(body: EmailAuthRequest):
    if not body.email or "@" not in body.email:
        raise HTTPException(422, "Invalid email address format")
    if len(body.password) < 6:
        raise HTTPException(422, "Password must be at least 6 characters")

    return {
        "status": "ok",
        "message": "Login successful",
        "user": {
            "email": body.email,
            "name": body.email.split("@")[0],
            "role": "citizen",
            "authenticated": True
        }
    }


@router.post("/email-signup")
def email_signup(body: EmailAuthRequest):
    if not body.email or "@" not in body.email:
        raise HTTPException(422, "Invalid email address format")
    if len(body.password) < 6:
        raise HTTPException(422, "Password must be at least 6 characters")

    return {
        "status": "ok",
        "message": "Account created successfully",
        "user": {
            "email": body.email,
            "name": body.full_name or body.email.split("@")[0],
            "district": body.district,
            "role": "citizen",
            "authenticated": True
        }
    }
