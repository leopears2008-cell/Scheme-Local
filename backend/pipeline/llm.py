"""Shared Gemini helper. Every agent, OCR, voice and translate call goes through here."""
import json
import time

from config import GEMINI_API_KEY, GEMINI_MODEL, GEMINI_TIMEOUT_S

_client = None


class LLMBusyError(Exception):
    """Rate limit / quota exhausted. Surfaced to users as a friendly 'busy' message."""


class LLMConfigError(Exception):
    """GEMINI_API_KEY missing."""


def client():
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise LLMConfigError("GEMINI_API_KEY is not set (see backend/.env.example)")
        from google import genai

        from google.genai import types
        # enforce the configured timeout (milliseconds) so a hung provider cannot hold a request forever
        _client = genai.Client(api_key=GEMINI_API_KEY, http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_S * 1000))
    return _client


def _call(fn):
    from google.genai import errors

    for attempt in (1, 2):
        try:
            return fn()
        except errors.APIError as e:
            if getattr(e, "code", None) == 429:
                raise LLMBusyError("Gemini rate limit hit") from e
            if attempt == 2:
                raise
            time.sleep(2)


def llm(system: str, user, json_mode: bool = False, temperature: float = 0.1, model: str = GEMINI_MODEL) -> str:
    """`user` may be a string or a list of google-genai Parts (images/audio) for OCR/STT."""
    from google.genai import types

    cfg = types.GenerateContentConfig(
        system_instruction=system or None,
        temperature=temperature,
        response_mime_type="application/json" if json_mode else None,
    )
    resp = _call(lambda: client().models.generate_content(model=model, contents=user, config=cfg))
    return resp.text or ""


def llm_json(system: str, user, temperature: float = 0.0, model: str = GEMINI_MODEL) -> dict:
    """JSON mode + tolerant parse (strips ``` fences). Returns {} when unparseable."""
    raw = llm(system, user, json_mode=True, temperature=temperature, model=model).strip()
    if raw.startswith("```"):
        raw = raw.strip("`").removeprefix("json").strip()
    try:
        out = json.loads(raw)
        return out if isinstance(out, dict) else {"items": out}
    except json.JSONDecodeError:
        return {}


def image_part(data: bytes, mime: str):
    from google.genai import types

    return types.Part.from_bytes(data=data, mime_type=mime)
