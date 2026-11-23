"""Backend JWT validation + role resolution. The frontend is never trusted for identity or role.

Login is Supabase phone-OTP (done client-side with supabase-js). The backend only ever sees the resulting
access token, verifies its signature/expiry/audience, requires a verified phone number, and looks the role up
in the server-managed `user_roles` table (NOT in user_metadata, which users can edit)."""
import time
from dataclasses import dataclass, field

import jwt
from fastapi import Depends, Header, HTTPException

import config
from repo import repo

_jwks = {}


@dataclass
class Principal:
    user_id: str
    phone: str
    token: str
    iat: int
    email: str = ""
    phone_verified: bool = True
    email_verified: bool = False
    _role: str | None = field(default=None, repr=False)

    @property
    def is_guest(self) -> bool:
        return self.user_id.startswith("guest:")

    @property
    def role(self) -> str:
        if self.is_guest:
            return "guest"
        if self._role is None:
            r = repo().get_role(self.user_id)
            if self.phone and self.phone in config.SUPER_ADMIN_PHONES and r != "super_admin":
                repo().set_role(self.user_id, "super_admin", granted_by=None)   # bootstrap from server env only
                r = "super_admin"
            self._role = r or "citizen"
        return self._role

    @property
    def masked_phone(self) -> str:
        return ("*" * max(len(self.phone) - 4, 0) + self.phone[-4:]) if self.phone else ""


def decode_token(token: str) -> dict:
    try:
        common = dict(audience="authenticated", options={"require": ["exp", "sub", "aud"]}, leeway=10)
        if config.SUPABASE_URL:
            common["issuer"] = f"{config.SUPABASE_URL}/auth/v1"
        if config.SUPABASE_JWT_SECRET:
            claims = jwt.decode(token, config.SUPABASE_JWT_SECRET, algorithms=["HS256"], **common)
        elif config.SUPABASE_URL:
            if "c" not in _jwks:
                _jwks["c"] = jwt.PyJWKClient(f"{config.SUPABASE_URL}/auth/v1/.well-known/jwks.json", cache_keys=True)
            key = _jwks["c"].get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=["ES256", "RS256"], **common)
        else:
            raise HTTPException(503, "Auth is not configured on the server")
    except HTTPException:
        raise
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired session", headers={"WWW-Authenticate": "Bearer"})
    if claims.get("role") != "authenticated":      # rejects the public anon key and service tokens
        raise HTTPException(401, "Invalid session")
    return claims


def optional_user(authorization: str | None = Header(None)) -> Principal | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "Malformed Authorization header")
    from security import guest as guest_mod
    if guest_mod.is_guest_token(token):
        c = guest_mod.verify_token(token)
        return Principal(user_id=c["sub"], phone="", token=token, iat=int(c.get("iat", 0)), phone_verified=False, email_verified=False)
    c = decode_token(token)
    has_phone = bool(c.get("phone"))
    phone_v = bool(c.get("phone_verified", True if has_phone else False))
    has_email = bool(c.get("email"))
    email_v = bool(c.get("email_verified", True if (has_email and (c.get("email_confirmed_at") or c.get("email_verified"))) else False))
    p = Principal(
        user_id=c["sub"],
        phone=c.get("phone") or "",
        token=token,
        iat=int(c.get("iat", 0)),
        email=(c.get("email") or "").lower(),
        phone_verified=phone_v,
        email_verified=email_v,
    )
    if _is_demo_account(p):
        p.phone_verified = True
        p.email_verified = True
    return p


def _is_demo_account(p: Principal) -> bool:
    """Demo sign-in is only possible when the flag is on AND the email is on the allowlist."""
    return bool(config.DEMO_AUTH_ENABLED and p.email and p.email in config.DEMO_AUTH_EMAILS)


def require_user(p: Principal | None = Depends(optional_user)) -> Principal:
    """Signed-in citizens and admins only. Guest tokens are refused here, on every protected route."""
    if p is None:
        raise HTTPException(401, "Login required", headers={"WWW-Authenticate": "Bearer"})
    if p.is_guest:
        raise HTTPException(403, "Guest sessions can explore schemes and use chat. Sign in to save records, upload files or use this feature.")
    if not p.phone and not _is_demo_account(p):      # every account needs a verified mobile number...
        raise HTTPException(403, "A verified mobile number is required")   # ...except allowlisted demo accounts (flag on)
    return p


def require_verified_applicant(p: Principal = Depends(require_user)) -> Principal:
    """Strict server-side gate: only applicants with a verified mobile number OTP can apply.
    No guest access. Applications require genuine mobile number verification."""
    if p.is_guest:
        raise HTTPException(
            status_code=403,
            detail="Guest sessions cannot apply. Please verify your mobile number with OTP."
        )
    if not p.phone or not p.phone_verified:
        raise HTTPException(
            status_code=403,
            detail="Mobile number OTP verification is required before applying for government schemes."
        )
    return p


def require_user_or_guest(p: Principal | None = Depends(optional_user)) -> Principal:
    """Only for the endpoints guests may use (chat and their own role lookup). Everything else uses require_user."""
    if p is None:
        raise HTTPException(401, "Login required", headers={"WWW-Authenticate": "Bearer"})
    if p.is_guest:
        return p
    if not p.phone and not _is_demo_account(p):
        raise HTTPException(403, "A verified mobile number is required")
    return p


def require_admin(p: Principal = Depends(require_user)) -> Principal:
    if p.role not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin access required")
    return p


def require_super_admin(p: Principal = Depends(require_user)) -> Principal:
    if p.role != "super_admin":
        raise HTTPException(403, "Super admin access required")
    return p


def require_fresh(p: Principal = Depends(require_admin)) -> Principal:
    """Verification decisions need a recent OTP login (re-proves control of the admin's mobile number)."""
    if time.time() - p.iat > config.FRESH_LOGIN_MINUTES * 60:
        raise HTTPException(401, f"Please log in again with a new OTP (session older than {config.FRESH_LOGIN_MINUTES} min)",
                            headers={"X-Reauth-Required": "true"})
    return p
