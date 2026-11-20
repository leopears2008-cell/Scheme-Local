"""Guest sessions: anyone can start a temporary, limited session with no OTP or password.

What a guest can do: browse schemes, run eligibility, and use the AI chat (rate limited).
What a guest cannot do: admin, saved records (tracker, bookmarks, notifications), uploads (OCR, voice,
forms), account export or deletion. Those routes use require_user, which refuses guest tokens.

Tokens are signed by the server with GUEST_TOKEN_SECRET (HS256, short lifetime, own issuer and audience).
They are never accepted as Supabase tokens and never grant a role other than 'guest'.
An optional email is accepted only to be validated; it is NOT stored, NOT logged and NOT put in the token.
"""
import re
import secrets
import time
import uuid

import jwt
from fastapi import HTTPException

import config

GUEST_ISS = "msg-guest"
GUEST_AUD = "guest"
EMAIL_RX = re.compile(r"^[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9.\-]{1,190}\.[A-Za-z]{2,24}$")
_DEV_SECRET = secrets.token_urlsafe(48)   # development only: guests become invalid when the process restarts


def guest_secret() -> str | None:
    if config.GUEST_TOKEN_SECRET:
        return config.GUEST_TOKEN_SECRET
    return None if config.ENV == "production" else _DEV_SECRET


def guest_enabled() -> bool:
    return bool(config.GUEST_ENABLED and guest_secret())


def validate_email(email: str | None) -> None:
    if email in (None, ""):
        return
    if len(email) > 254 or not EMAIL_RX.match(email.strip()):
        raise HTTPException(422, "Enter a valid email address, or leave it empty.")


def issue_token() -> tuple[str, int]:
    if not config.GUEST_ENABLED:
        raise HTTPException(403, "Guest access is turned off on this server.")
    secret = guest_secret()
    if not secret:
        raise HTTPException(503, "Guest access is not configured on this server.")
    now = int(time.time())
    claims = {"sub": f"guest:{uuid.uuid4().hex}", "iss": GUEST_ISS, "aud": GUEST_AUD, "role": "guest",
              "iat": now, "exp": now + config.GUEST_TTL_S}
    return jwt.encode(claims, secret, algorithm="HS256"), config.GUEST_TTL_S


def is_guest_token(token: str) -> bool:
    """Peeks at the issuer WITHOUT trusting it. The full check happens in verify_token."""
    try:
        return jwt.decode(token, options={"verify_signature": False}).get("iss") == GUEST_ISS
    except jwt.PyJWTError:
        return False


def verify_token(token: str) -> dict:
    secret = guest_secret()
    if not config.GUEST_ENABLED or not secret:
        raise HTTPException(401, "Guest sessions are not available. Please sign in.", headers={"WWW-Authenticate": "Bearer"})
    try:
        c = jwt.decode(token, secret, algorithms=["HS256"], audience=GUEST_AUD, issuer=GUEST_ISS,
                       options={"require": ["exp", "sub", "aud", "iss"]}, leeway=10)
    except jwt.PyJWTError:
        raise HTTPException(401, "Your guest session has expired. Start a new one.", headers={"WWW-Authenticate": "Bearer"})
    if not str(c.get("sub", "")).startswith("guest:") or c.get("role") != "guest":
        raise HTTPException(401, "Invalid guest session.")
    return c
