"""Voice (STT/TTS), single-turn Voice-to-Voice RAG conversation, and UI translation via Gemini."""
import base64
import binascii
import hashlib
import io
import json
import re
import wave
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from config import GEMINI_MODEL_SMALL, GEMINI_TTS_MODEL, GEMINI_TTS_VOICE, LANGUAGES
from pipeline.llm import LLMBusyError, LLMConfigError, _call, client, llm, llm_json
from security.auth import require_user

router = APIRouter(prefix="/api", dependencies=[Depends(require_user)])
_TRANS_CACHE: dict[str, str] = {}

_ALLOWED_AUDIO_MIMES = {
    "audio/webm",
    "audio/webm;codecs=opus",
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/ogg",
    "audio/mp4",
    "audio/aac",
}
_MAX_AUDIO_BYTES = 10_000_000  # 10 MB


def _guard(fn):
    try:
        return fn()
    except LLMBusyError:
        raise HTTPException(429, "Gemini is busy, try again shortly")
    except LLMConfigError as e:
        raise HTTPException(503, str(e))


def _decode_audio(audio_base64: str, mime: str) -> tuple[bytes, str]:
    clean_mime = mime.split(";")[0].strip().lower()
    if mime.lower() not in _ALLOWED_AUDIO_MIMES and clean_mime not in _ALLOWED_AUDIO_MIMES:
        raise HTTPException(400, f"Unsupported audio mime type: {mime}")

    raw_b64 = audio_base64.split(",", 1)[1] if "," in audio_base64 else audio_base64
    try:
        audio = base64.b64decode(raw_b64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "Invalid base64 audio payload")

    if not audio:
        raise HTTPException(400, "Empty audio payload")
    if len(audio) > _MAX_AUDIO_BYTES:
        raise HTTPException(413, "Audio too long (max 10 MB)")
    return audio, clean_mime


def _transcribe_audio(audio: bytes, mime: str, language: str) -> tuple[str, str]:
    """Transcribe audio and detect spoken language code if language == 'auto'."""
    from google.genai import types

    audio_part = types.Part.from_bytes(data=audio, mime_type=mime)

    if language == "auto":
        lang_list = ", ".join(f"{k}={v}" for k, v in LANGUAGES.items())
        prompt = (
            f"Transcribe this audio accurately. Supported languages: {lang_list}. "
            "The speaker may code-mix with English. "
            'Return ONLY JSON: {"text": "<transcript in speaker script or empty string if no speech>", '
            '"language": "<best matching language code from supported list, default en>"}.'
        )
        out = _guard(lambda: llm_json(prompt, [audio_part], model=GEMINI_MODEL_SMALL))
        text = (out.get("text") or "").strip()
        detected = out.get("language", "en")
        if detected not in LANGUAGES:
            detected = "en"
        return text, detected

    lang_name = LANGUAGES.get(language, "the spoken language")
    prompt = (
        f"Transcribe this audio exactly. The speaker most likely uses {lang_name} (may mix English). "
        "Return only the transcript text in the script the speaker used. "
        "If there is no speech, return an empty string."
    )
    text = _guard(lambda: llm("", [audio_part, prompt], model=GEMINI_MODEL_SMALL))
    return text.strip(), language


def _clean_for_speech(text: str) -> str:
    """Strip markdown, URLs, and symbols that sound unnatural when read aloud."""
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[#*_`~>|]", " ", text)
    text = re.sub(r"^\s*[-•]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:1500]


def _make_spoken_summary(reply_text: str, language: str) -> str:
    """Convert a long RAG answer into a natural, Gemini-like 2-4 sentence spoken reply."""
    cleaned = _clean_for_speech(reply_text)
    if len(cleaned) <= 320:
        return cleaned

    lang_name = LANGUAGES.get(language, "English")
    prompt = (
        f"Rewrite the following government scheme answer as a warm, clear spoken response in {lang_name} "
        "suitable for voice playback (like a helpful assistant). "
        "Rules: 2 to 4 short sentences max, simple everyday words, mention scheme names and key eligibility/benefit amounts, "
        "no markdown, no bullet points, no URLs."
    )
    spoken = _guard(lambda: llm(prompt, cleaned, model=GEMINI_MODEL_SMALL))
    return _clean_for_speech(spoken) or cleaned[:500]


def _synthesize_wav(text: str, language: str) -> str:
    """Generate 24 kHz 16-bit mono WAV base64 via Gemini TTS."""
    from google.genai import types

    clean = _clean_for_speech(text)
    if not clean:
        raise HTTPException(400, "No text to speak")

    lang_name = LANGUAGES.get(language, "English")
    tts_prompt = f"Speak clearly, warmly, and naturally in {lang_name} at a comfortable pace:\n{clean}"

    cfg = types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=GEMINI_TTS_VOICE)
            )
        ),
    )
    resp = _guard(
        lambda: _call(
            lambda: client().models.generate_content(
                model=GEMINI_TTS_MODEL,
                contents=tts_prompt,
                config=cfg,
            )
        )
    )
    try:
        pcm = resp.candidates[0].content.parts[0].inline_data.data
    except Exception:
        raise HTTPException(502, "TTS returned no audio")

    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(pcm)
    return base64.b64encode(buf.getvalue()).decode()


def _search_schemes_pipeline(
    query: str,
    language: str,
    session_id: str | None = None,
    user_profile: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    PLUG YOUR EXISTING RAG / GRAPH PIPELINE HERE.
    Expected return shape:
      {"reply": str, "schemes": list[dict], "citations": list[str]}
    """
    # --- Option A: Wire directly to your pipeline/graph.py or pipeline/agents.py ---
    # Example (adjust function name/args to match your backend/pipeline/graph.py):
    # from pipeline.graph import run_graph
    # res = run_graph(query=query, language=language, session_id=session_id, profile=user_profile or {})
    # return {
    #     "reply": res.get("answer", ""),
    #     "schemes": res.get("schemes", []),
    #     "citations": res.get("citations", []),
    # }

    # --- Fallback until wired: direct retrieval + Gemini grounded answer ---
    from pipeline.retrieval import search_schemes  # adjust function name if different

    hits = search_schemes(query, top_k=5)
    context = json.dumps(hits, ensure_ascii=False)[:8000]
    lang_name = LANGUAGES.get(language, "English")
    system_prompt = (
        f"You are a helpful Indian government scheme assistant. Answer ONLY from the provided scheme context in {lang_name}. "
        "Give the best matching scheme(s), eligibility, benefit amount, and next step clearly."
    )
    reply = _guard(
        lambda: llm(system_prompt, f"User question: {query}\n\nScheme context:\n{context}", model=GEMINI_MODEL_SMALL)
    )
    return {"reply": reply.strip(), "schemes": hits, "citations": []}


# ---------------- Unified Voice-to-Voice Endpoint ----------------

class VoiceConverseRequest(BaseModel):
    audio_base64: str
    mime: str = "audio/webm"
    language: str = "auto"  # "auto", "en", "ta", "hi", etc.
    session_id: str | None = None
    user_profile: dict[str, Any] = Field(default_factory=dict)
    speak_reply: bool = True


@router.post("/voice/converse")
def voice_converse(req: VoiceConverseRequest):
    """Full loop: Speech -> Text -> Scheme RAG Search -> Spoken Summary -> Audio Reply."""
    audio, clean_mime = _decode_audio(req.audio_base64, req.mime)

    # 1. Speech-to-Text
    transcript, detected_lang = _transcribe_audio(audio, clean_mime, req.language)
    if not transcript:
        return {
            "no_speech": True,
            "transcript": "",
            "language": detected_lang,
            "reply_text": "",
            "spoken_text": "",
            "schemes": [],
            "audio_base64": None,
            "mime": None,
        }

    # 2. Search scheme database / RAG pipeline
    rag_result = _search_schemes_pipeline(
        query=transcript,
        language=detected_lang,
        session_id=req.session_id,
        user_profile=req.user_profile,
    )
    reply_text = rag_result.get("reply", "").strip()

    # 3. Create concise natural spoken version & synthesize audio
    spoken_text = _make_spoken_summary(reply_text, detected_lang) if reply_text else ""
    audio_b64 = _synthesize_wav(spoken_text, detected_lang) if (req.speak_reply and spoken_text) else None

    return {
        "no_speech": False,
        "transcript": transcript,
        "language": detected_lang,
        "reply_text": reply_text,
        "spoken_text": spoken_text,
        "schemes": rag_result.get("schemes", []),
        "citations": rag_result.get("citations", []),
        "audio_base64": audio_b64,
        "mime": "audio/wav" if audio_b64 else None,
    }


# ---------------- Backwards-Compatible Endpoints ----------------

class STTRequest(BaseModel):
    audio_base64: str
    mime: str = "audio/webm"
    language: str = "en"


@router.post("/voice/stt")
def stt(req: STTRequest):
    audio, clean_mime = _decode_audio(req.audio_base64, req.mime)
    text, detected_lang = _transcribe_audio(audio, clean_mime, req.language)
    return {"text": text, "language": detected_lang}


class TTSRequest(BaseModel):
    text: str
    language: str = "en"


@router.post("/voice/tts")
def tts(req: TTSRequest):
    audio_b64 = _synthesize_wav(req.text, req.language)
    return {"audio_base64": audio_b64, "mime": "audio/wav"}


class TranslateRequest(BaseModel):
    texts: list[str]
    target: str


@router.post("/translate")
def translate(req: TranslateRequest):
    if req.target == "en" or not req.texts:
        return {"texts": req.texts}
    if len(_TRANS_CACHE) > 5000:
        _TRANS_CACHE.clear()
    if req.target not in LANGUAGES or len(req.texts) > 60:
        raise HTTPException(400, "Unsupported language or too many strings")

    keys = [hashlib.sha1(f"{req.target}|{t}".encode()).hexdigest() for t in req.texts]
    cached = {k: _TRANS_CACHE[k] for k in keys if k in _TRANS_CACHE}
    todo = [(i, t) for i, (k, t) in enumerate(zip(keys, req.texts)) if k not in cached]

    if todo:
        out = _guard(
            lambda: llm_json(
                f"Translate each string into {LANGUAGES[req.target]} for a government-services app used by low-literacy citizens: "
                'simple, respectful, short. Keep numbers, ₹, URLs and proper nouns. Return ONLY JSON {"t": [translated strings, same order]}.',
                json.dumps([t for _, t in todo], ensure_ascii=False),
                model=GEMINI_MODEL_SMALL,
            )
        ).get("t", [])
        if len(out) == len(todo):
            for (i, _), v in zip(todo, out):
                cached[keys[i]] = v
                _TRANS_CACHE[keys[i]] = v

    return {"texts": [cached.get(k, t) for k, t in zip(keys, req.texts)]}
