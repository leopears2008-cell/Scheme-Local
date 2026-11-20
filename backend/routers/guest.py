"""Start a guest session. Public: no login, no OTP, no password. Rate limited per IP address."""
import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

import config
from security import guest as guest_mod
from security.ratelimit import limiter

router = APIRouter(prefix="/api/guest")
log = logging.getLogger("guest")


class GuestIn(BaseModel):
    email: str | None = Field(None, max_length=254)   # optional; validated, then discarded


def client_ip(request: Request) -> str:
    if config.TRUST_PROXY:
        fwd = request.headers.get("x-forwarded-for", "")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/session")
def start_guest(body: GuestIn, request: Request):
    if not config.GUEST_ENABLED:
        raise HTTPException(403, "Guest access is turned off on this server.")
    if not guest_mod.guest_secret():
        raise HTTPException(503, "Guest access is not configured on this server.")
    guest_mod.validate_email(body.email)
    wait = limiter.check(f"guestnew:{client_ip(request)}", config.GUEST_SESSIONS_PER_IP_PER_HOUR, 3600)
    if wait:
        raise HTTPException(429, "Too many guest sessions from this network. Please try again later.", headers={"Retry-After": str(wait)})
    token, expires_in = guest_mod.issue_token()
    # the email is deliberately not stored, not logged and not returned
    log.info("guest session issued (ttl %ds)", expires_in)
    return {"token": token, "expires_in": expires_in, "guest": True,
            "note": "Guest sessions explore schemes and chat only. Nothing you type is saved to an account."}
