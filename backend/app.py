"""
MySchemeGuide API (FastAPI).   Local:  uvicorn app:app --reload --port 8000     Docs: /docs (disabled in production)
"""
import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
import schemes_store as store
from routers import account, admin, chat, eligibility, forms, guest, ocr, schemes, tracker, voice
from security.auth import require_user
from security.logging_setup import setup as setup_logging
from security.ratelimit import SecurityMiddleware

setup_logging()
log = logging.getLogger("app")
problems = config.validate_config()
if problems:
    if config.ENV == "production":
        raise SystemExit("Refusing to start: " + "; ".join(problems))
    for p in problems:
        log.warning("config: %s", p)

app = FastAPI(title="MySchemeGuide API", docs_url=None if config.ENV == "production" else "/docs",
              redoc_url=None, openapi_url=None if config.ENV == "production" else "/openapi.json")
app.add_middleware(SecurityMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_credentials=False,
                   allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                   allow_headers=["Authorization", "Content-Type", "X-Device-Id"],
                   expose_headers=["X-Reference", "X-Skipped-Fields", "Content-Disposition", "X-Reauth-Required"], max_age=600)

# public: scheme browsing and eligibility work without login (uses only the public view)
app.include_router(schemes.router)
app.include_router(eligibility.router)
app.include_router(guest.router)     # public: starts a limited guest session
# protected: AI, OCR, voice, PDFs, user data, admin
for r in (chat, ocr, forms, voice, tracker, account, admin):
    app.include_router(r.router)


@app.on_event("startup")
def _startup():
    store.load_all()
    store.start_background_refresh(60)


@app.get("/api/ready")
def ready():
    """Dependency readiness. Says what is missing; reveals no keys, hosts or counts beyond coarse status."""
    from pathlib import Path
    from pipeline.retrieval import retrieval_mode
    checks = {
        "schemes_loaded": len(store.SCHEMES) > 0,
        "gemini_configured": bool(config.GEMINI_API_KEY),
        "auth_configured": bool(config.SUPABASE_URL and config.SUPABASE_ANON_KEY),
        "retrieval_available": True,   # TF-IDF fallback always works; 'chroma' is used only when installed
    }
    missing = [k for k, v in checks.items() if not v]
    return {"ready": not missing, "missing": missing, "retrieval_mode": retrieval_mode(),
            "note": "Ready means configured, not tested against live providers."}


@app.get("/health")
def health():
    from pipeline.guardrails import KNOWN_SCHEMES
    return {"status": "ok", "env": config.ENV, "schemes_loaded": len(store.SCHEMES), "guardrail_ids": len(KNOWN_SCHEMES),
            "auth_configured": bool(config.SUPABASE_URL), "gemini_configured": bool(config.GEMINI_API_KEY)}
