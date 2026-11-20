"""Central configuration for MySchemeGuide."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# --- Paths ---
PROJECT_ROOT = Path(__file__).parent
PDF_DIR = PROJECT_ROOT / "data" / "pdfs"          # optional official scheme PDFs (name starts with scheme_id)
FACTSHEET_DIR = PROJECT_ROOT / "schemes"          # unified JSON fact sheets (345 after tools/build_data.py)
CHROMA_DIR = PROJECT_ROOT / "chroma_db"           # vector store
FORMS_DIR = PROJECT_ROOT / "data" / "forms"       # blank PDF application forms (from FormSaathi)
FONTS_DIR = PROJECT_ROOT / "data" / "fonts"       # Unicode fonts for PDF generation

# --- Embeddings (local, CPU) ---
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
CHUNK_SIZE = 800
CHUNK_OVERLAP = 150
COLLECTION_NAME = "schemes"

# --- Gemini (single provider for chat, RAG, OCR, voice, translation) ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")              # reasoning / synthesis / vision
GEMINI_MODEL_SMALL = os.environ.get("GEMINI_MODEL_SMALL", "gemini-2.5-flash-lite")  # extraction
GEMINI_TTS_MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
GEMINI_TTS_VOICE = os.environ.get("GEMINI_TTS_VOICE", "Kore")

# --- Runtime / security ---
ENV = os.environ.get("ENV", "development")          # "production" turns on strict startup validation
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")                  # public key; RLS protects data
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")  # SERVER ONLY, bypasses RLS
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")              # legacy HS256 projects; leave empty to use JWKS
SUPER_ADMIN_PHONES = [p.strip() for p in os.environ.get("SUPER_ADMIN_PHONES", "").split(",") if p.strip()]  # E.164, bootstrap only
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
TRUST_PROXY = os.environ.get("TRUST_PROXY", "false").lower() == "true"       # true on Render (client IP from X-Forwarded-For)
ALLOWED_SOURCE_DOMAINS = [d.strip() for d in os.environ.get("ALLOWED_SOURCE_DOMAINS", "").split(",") if d.strip()]
FRESH_LOGIN_MINUTES = int(os.environ.get("FRESH_LOGIN_MINUTES", "15"))       # admin verify/reject needs a recent OTP login
RATE_LIMIT_DEFAULT = int(os.environ.get("RATE_LIMIT_DEFAULT", "120"))        # requests / minute / client
RATE_LIMIT_AI = int(os.environ.get("RATE_LIMIT_AI", "20"))                   # chat, OCR, voice, translate
MAX_BODY_BYTES = int(os.environ.get("MAX_BODY_BYTES", str(1_000_000)))
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(12_000_000)))  # base64 images/audio
GEMINI_TIMEOUT_S = int(os.environ.get("GEMINI_TIMEOUT_S", "45"))
VERIFICATION_VALIDITY_DAYS = int(os.environ.get("VERIFICATION_VALIDITY_DAYS", "180"))
# Demo sign-in: lets named judge accounts (email + password) use Talk/Docs/Apply/Track WITHOUT an SMS.
# Default off. When off, phone-verified sign-in is required everywhere. Never enable in a real public launch.
DEMO_AUTH_ENABLED = os.environ.get("DEMO_AUTH_ENABLED", "false").lower() == "true"
DEMO_AUTH_EMAILS = [e.strip().lower() for e in os.environ.get("DEMO_AUTH_EMAILS", "").split(",") if e.strip()]
# Guest sessions: no OTP or password. Off in production unless explicitly enabled AND a secret is set.
GUEST_ENABLED = os.environ.get("GUEST_ENABLED", "true" if os.environ.get("ENV", "development") != "production" else "false").lower() == "true"
GUEST_TOKEN_SECRET = os.environ.get("GUEST_TOKEN_SECRET", "")
GUEST_TTL_S = int(os.environ.get("GUEST_TTL_S", "7200"))                  # 2 hours
GUEST_SESSIONS_PER_IP_PER_HOUR = int(os.environ.get("GUEST_SESSIONS_PER_IP_PER_HOUR", "5"))
GUEST_ASK_PER_10MIN = int(os.environ.get("GUEST_ASK_PER_10MIN", "10"))
GUEST_ASK_PER_DAY = int(os.environ.get("GUEST_ASK_PER_DAY", "40"))
# Production: serve the bundled JSON scheme files if the Supabase table is empty (logs a warning). Default off.
ALLOW_JSON_FALLBACK = os.environ.get("ALLOW_JSON_FALLBACK", "false").lower() == "true"
LOG_CHAT_TEXT = False  # never log what citizens type; flip only for local debugging


def validate_config() -> list[str]:
    """Returns problems; in production the app refuses to start if any exist."""
    errs = []
    if ENV == "production" and GUEST_ENABLED and not GUEST_TOKEN_SECRET:
        errs.append("GUEST_ENABLED is true but GUEST_TOKEN_SECRET is empty (set a long random value, or GUEST_ENABLED=false)")
    if ENV == "production":
        for k, v in {"SUPABASE_URL": SUPABASE_URL, "SUPABASE_ANON_KEY": SUPABASE_ANON_KEY,
                     "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_SERVICE_ROLE_KEY, "GEMINI_API_KEY": GEMINI_API_KEY}.items():
            if not v:
                errs.append(f"{k} is required in production")
        if not CORS_ORIGINS or any(o == "*" or "localhost" in o for o in CORS_ORIGINS):
            errs.append("CORS_ORIGINS must list your real https frontend origin(s) only")
    return errs

# --- Scheme categories (unified across all four source projects) ---
CATEGORIES = [
    "agriculture", "food", "education", "employment_skill", "health", "housing",
    "social_welfare", "women_child", "finance_insurance", "other",
]
# each parallel matcher agent searches one group
MATCHER_GROUPS = {
    "agriculture_matcher": ["agriculture", "food"],
    "education_matcher": ["education", "employment_skill"],
    "health_housing_matcher": ["health", "housing", "social_welfare", "women_child", "finance_insurance", "other"],
}

# --- Retrieval / confidence ---
TOP_K_PER_MATCHER = 5
MAX_DISTANCE_CONFIDENT = 0.55

# UI languages (13, from FormSaathi) -> name used in prompts
LANGUAGES = {
    "en": "English", "hi": "Hindi", "bn": "Bengali", "te": "Telugu", "mr": "Marathi",
    "ta": "Tamil", "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam", "pa": "Punjabi",
    "or": "Odia", "as": "Assamese", "ur": "Urdu",
}
