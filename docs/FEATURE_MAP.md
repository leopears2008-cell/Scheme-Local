# Feature map — what came from which zip

| You asked for | Source zip | Where it lives now | Notes |
|---|---|---|---|
| Agentic RAG, ChromaDB, official citations, eligibility explanations | scheme-sahayak | `backend/pipeline/*`, `ingest.py`, `routers/chat.py` | Groq→**Gemini**. Matchers now filter by the user's state. 5→10 categories. |
| FastAPI backend | scheme-sahayak | `backend/app.py`, `routers/*` | Expanded from 3 to ~25 endpoints. |
| "Feature to add my project" | — | `POST /api/schemes` | I read this as "add schemes to my project at runtime". Tell me if you meant something else. |
| Tamil Nadu scheme database (309) | TN-Welfare-Schemes | `backend/schemes/tn_*.json` | Tamil + English text kept (`i18n.ta`). |
| Tamil + English UI | TN-Welfare-Schemes / FormSaathi | `frontend/src/lib/i18n.ts` | Full app strings in English, Hindi, Tamil; other 10 languages use FormSaathi labels and fall back to English for app strings (`/api/translate` is ready to fill the gap). |
| React frontend | TN / GovBot / Sahayak UIs | `frontend/` | Rebuilt as one Vite app; the Next.js UIs were not kept. |
| Eligibility checker | GovBot (+FormSaathi rule ops) | `backend/services/eligibility.py` | Ported JS→Python, per-criterion output. |
| Document scanner / OCR | GovBot + FormSaathi | `routers/ocr.py`, `pages/Docs.tsx` | tesseract.js / OpenRouter → **Gemini vision**; Aadhaar Verhoeff checksum added. |
| Encrypted document vault | FormSaathi (`profile-vault.ts`) | `frontend/src/lib/profile-vault.ts` | Copied unchanged. |
| Application tracking + notifications | GovBot | `routers/tracker.py`, `pages/Track.tsx` | Firebase → SQLite, device-scoped. |
| 50+ scheme matching | FormSaathi (24) + GovBot (18) + others | `backend/schemes/` | **345 unique schemes** after dedup (e.g. PM-KISAN existed in 3 repos). |
| Voice interaction | FormSaathi | `lib/voice.ts`, `routers/voice.py` | Browser speech first; Gemini STT/TTS fallback. OpenRouter removed. |
| Automatic form filling + filled PDF | FormSaathi | `services/pdfgen.py`, `routers/forms.py`, `pages/Apply.tsx`, `backend/data/forms/` | pdf-lib→pypdf+fpdf2. Tamil/Hindi/etc. render correctly (verified). |
| Multilingual support (13) | FormSaathi | `frontend/src/locales/*.json`, `data/fonts/` | Fonts for all 10 scripts bundled. |

## Deliberately not ported
Clerk/Firebase/Mongo auth and OTP, biometric unlock, GovBot theme engine and onboarding screens, TN chatbot popup, FormSaathi tool-calling agent loop and screen-guide narration, Sahayak demo media.

## Tested here vs. not
- **Tested:** data merge (345 sheets), eligibility engine, schemes/bookmarks/tracking/notification endpoints, official-form fill, summary PDF with Tamil, LangGraph pipeline + guardrails (mocked LLM), frontend type-check and production build.
- **Not tested (no Gemini key / no Hugging Face access in my sandbox):** live Gemini calls (chat, OCR, STT/TTS, translate), `ingest.py` embeddings, real retrieval quality, browser camera/mic flows.
