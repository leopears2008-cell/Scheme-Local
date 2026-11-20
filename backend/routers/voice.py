"""Voice (STT/TTS) and UI translation, all via Gemini. The frontend prefers the browser's Web Speech API and
falls back to these endpoints when the browser lacks support for the chosen Indian language."""
import base64
import hashlib
import io
import json
import wave

from fastapi import APIRouter, Depends, HTTPException
from security.auth import require_user
from pydantic import BaseModel

from config import GEMINI_MODEL_SMALL, GEMINI_TTS_MODEL, GEMINI_TTS_VOICE, LANGUAGES
from pipeline.llm import LLMBusyError, LLMConfigError, _call, client, llm, llm_json

router = APIRouter(prefix="/api", dependencies=[Depends(require_user)])
_TRANS_CACHE: dict[str, str] = {}   # per-process cache of UI translations (no personal data)


def _guard(fn):
    try:
        return fn()
    except LLMBusyError:
        raise HTTPException(429, "Gemini is busy, try again shortly")
    except LLMConfigError as e:
        raise HTTPException(503, str(e))


class STTRequest(BaseModel):
    audio_base64: str
    mime: str = "audio/webm"
    language: str = "en"


@router.post("/voice/stt")
def stt(req: STTRequest):
    from google.genai import types

    audio = base64.b64decode(req.audio_base64)
    if len(audio) > 10_000_000:
        raise HTTPException(413, "Audio too long")
    name = LANGUAGES.get(req.language, "the spoken language")
    prompt = (f"Transcribe this audio exactly. The speaker most likely uses {name} (may mix English). "
              "Return only the transcript text in the script the speaker used. If there is no speech, return an empty string.")
    text = _guard(lambda: llm("", [types.Part.from_bytes(data=audio, mime_type=req.mime), prompt], model=GEMINI_MODEL_SMALL))
    return {"text": text.strip()}


class TTSRequest(BaseModel):
    text: str
    language: str = "en"


@router.post("/voice/tts")
def tts(req: TTSRequest):
    from google.genai import types

    text = req.text.strip()[:1500]
    if not text:
        raise HTTPException(400, "No text")
    cfg = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=GEMINI_TTS_VOICE))))
    resp = _guard(lambda: _call(lambda: client().models.generate_content(model=GEMINI_TTS_MODEL, contents=text, config=cfg)))
    try:
        pcm = resp.candidates[0].content.parts[0].inline_data.data
    except Exception:
        raise HTTPException(502, "TTS returned no audio")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:  # Gemini TTS returns 24 kHz, 16-bit mono PCM
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    return {"audio_base64": base64.b64encode(buf.getvalue()).decode(), "mime": "audio/wav"}


class TranslateRequest(BaseModel):
    texts: list[str]
    target: str  # UI language code


@router.post("/translate")
def translate(req: TranslateRequest):
    if req.target == "en" or not req.texts:
        return {"texts": req.texts}
    if len(_TRANS_CACHE) > 5000:
        _TRANS_CACHE.clear()
    if req.target not in LANGUAGES or len(req.texts) > 60:
        raise HTTPException(400, "Unsupported language or too many strings")
    keys = [hashlib.sha1(f"{req.target}|{t}".encode()).hexdigest() for t in req.texts]
    cached = _TRANS_CACHE
    cached = {k: cached[k] for k in keys if k in cached}
    todo = [(i, t) for i, (k, t) in enumerate(zip(keys, req.texts)) if k not in cached]
    if todo:
        out = _guard(lambda: llm_json(
            f"Translate each string into {LANGUAGES[req.target]} for a government-services app used by low-literacy citizens: "
            "simple, respectful, short. Keep numbers, ₹, URLs and proper nouns. Return ONLY JSON {\"t\": [translated strings, same order]}.",
            json.dumps([t for _, t in todo], ensure_ascii=False), model=GEMINI_MODEL_SMALL)).get("t", [])
        if len(out) == len(todo):
            for (i, _), v in zip(todo, out):
                cached[keys[i]] = v
                _TRANS_CACHE[keys[i]] = v   # bounded below
    return {"texts": [cached.get(k, t) for k, t in zip(keys, req.texts)]}
