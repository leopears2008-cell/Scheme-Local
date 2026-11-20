"""Agentic RAG chat (LangGraph + ChromaDB + Gemini) with citations, verdicts and guardrails."""
import hashlib
import json
import logging
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import schemes_store as store
from config import LANGUAGES, PROJECT_ROOT
from pipeline.checklist import build_checklist
from pipeline.guardrails import REJECT_MESSAGE, apply_output_rails, check_input
from pipeline.llm import LLMBusyError, LLMConfigError
from security.auth import Principal, require_user_or_guest
from security.ratelimit import limiter
from security.logging_setup import redact
import config

router = APIRouter(prefix="/api")   # each endpoint declares who may call it (citizens, admins, or guests)
log = logging.getLogger("chat")

BUSY = ("Abhi system busy hai, thodi der baad koshish karein. "
        "(Service is at capacity, please try again in a little while.)")
EMPTY_CHECKLIST = {"common": [], "per_scheme": {}, "how_to_apply": {}}
FEEDBACK_LOG, TRACE_LOG = PROJECT_ROOT / "feedback.jsonl", PROJECT_ROOT / "traces.jsonl"
SESSION_TTL_S = 30 * 60          # conversation memory expires after 30 idle minutes
SESSIONS: dict[str, dict] = {}   # in-memory, per instance. Keyed by (authenticated user, session), never by session id alone


def _key(user_id: str, session_id: str) -> str:
    """Hashed key: a user's memory cannot be read or overwritten by another user, and raw ids are not stored."""
    return hashlib.sha256(f"{user_id}|{session_id}".encode("utf-8")).hexdigest()


def _purge_expired() -> None:
    now = time.time()
    for k in [k for k, v in SESSIONS.items() if now - v.get("touched", 0) > SESSION_TTL_S]:
        SESSIONS.pop(k, None)


def _trace_text(message: str) -> dict:
    """Privacy: raw citizen text is written only when LOG_CHAT_TEXT is explicitly enabled. Otherwise only a hash and length."""
    if config.LOG_CHAT_TEXT:
        return {"message": redact(message)}
    return {"message_sha256": hashlib.sha256(message.encode("utf-8")).hexdigest()[:16], "message_chars": len(message)}


class AskRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    language: str | None = None  # UI language code; forces the reply language when not 'en'


class FeedbackRequest(BaseModel):
    trace_id: str
    rating: str  # up | down
    comment: str | None = None


def _card(v: dict, lang: str) -> dict:
    fs = store.localized(store.SCHEMES.get(v["scheme_id"], {}), lang)
    verdict = "NEEDS_VERIFICATION" if v["verdict"] == "NEED_MORE_INFO" else v["verdict"]
    return {
        "scheme_id": v["scheme_id"], "name": fs.get("name", v["scheme_id"]), "verdict": verdict,
        "why": v.get("why", ""), "evidence_quote": v.get("evidence_quote"), "benefit": fs.get("benefit", ""),
        "documents": fs.get("documents_required", []), "source_url": fs.get("source_url", ""),
        "level": fs.get("level"), "state": fs.get("state", ""), "verification": fs.get("verification", "imported"),
        "source_official": fs.get("source_official", False), "source_warning": fs.get("source_warning"),
        "last_verified": fs.get("last_verified", ""),
    }


def _reply(answer, trace_id, schemes=(), follow=None, confidence=1.0, checklist=None):
    return {"answer_text": answer, "schemes": list(schemes), "follow_up_question": follow, "confidence": confidence,
            "trace_id": trace_id, "documents_checklist": checklist or EMPTY_CHECKLIST}


@router.post("/ask")
def ask(req: AskRequest, p: Principal = Depends(require_user_or_guest)):
    if p.is_guest:
        # guests get a small, daily-capped allowance per guest session (in addition to the per-IP AI limit)
        wait = limiter.check(f"guest10:{p.user_id}", config.GUEST_ASK_PER_10MIN, 600) or limiter.check(f"guestday:{p.user_id}", config.GUEST_ASK_PER_DAY, 86400)
        if wait:
            raise HTTPException(429, f"Guest limit reached. Please wait {wait // 60 + 1} minute(s), or sign in for more.", headers={"Retry-After": str(wait)})
    try:
        from pipeline.graph import run_pipeline  # lazy: importing loads ChromaDB + embeddings
    except ImportError as e:
        # a missing optional dependency is a server configuration problem: say so, do not crash the request
        raise HTTPException(503, "The AI assistant is not available on this server (a required package is not installed). "
                                  "Find and Check still work.") from e

    trace_id, t0 = str(uuid.uuid4()), time.time()
    lang = req.language or "en"
    _purge_expired()
    skey = _key(p.user_id, req.session_id)
    session = SESSIONS.get(skey, {})
    intent = None
    try:
        allowed, intent = check_input(req.message, session.get("awaiting_followup", False))
        if not allowed:
            response = _reply(REJECT_MESSAGE, trace_id)
        else:
            reply_language = LANGUAGES.get(lang, "").lower() if lang != "en" else None
            result = apply_output_rails(run_pipeline(req.message, session.get("profile"), session.get("language"), reply_language))
            SESSIONS[skey] = {"touched": time.time(), "profile": result.get("profile"), "language": result.get("language"),
                                        "awaiting_followup": bool(result.get("follow_up_question"))}
            response = _reply(result["answer_text"], trace_id, [_card(v, lang) for v in result["verdicts"]],
                              result.get("follow_up_question"), result["confidence"],
                              build_checklist(result["verdicts"], store.SCHEMES))
    except LLMBusyError:
        SESSIONS[skey] = {**session, "touched": time.time(), "awaiting_followup": False}
        response = _reply(BUSY, trace_id, confidence=0)
    except LLMConfigError as e:
        response = _reply(f"Server setup incomplete: {e}", trace_id, confidence=0)
    except Exception as e:  # any other pipeline failure: friendly message, exception type only (no user text)
        log.error("ask pipeline failed: %s", type(e).__name__)
        raise HTTPException(503, "The assistant is temporarily unavailable. Find and Check still work; please try again shortly.") from e
    with TRACE_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"trace_id": trace_id, "session": skey[:12], **_trace_text(req.message), "intent": intent,
                            "latency_s": round(time.time() - t0, 2), "response": response}, ensure_ascii=False) + "\n")
    return response


@router.delete("/ask/session/{session_id}")
def clear_session(session_id: str, p: Principal = Depends(require_user_or_guest)):
    """Lets a citizen clear their own conversation memory. Only their own key can be removed."""
    return {"cleared": SESSIONS.pop(_key(p.user_id, session_id), None) is not None}


@router.post("/feedback")
def feedback(req: FeedbackRequest, p: Principal = Depends(require_user_or_guest)):
    with FEEDBACK_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(req.model_dump(), ensure_ascii=False) + "\n")
    return {"ok": True}
