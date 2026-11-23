# SchemeLocal — hackathon prototype

> **formerly MySchemeGuide**

Find Indian government schemes, check indicative eligibility, prepare documents and an application draft in your language.
**This is a hackathon prototype.** It is not an official government service and it does not submit anything to any government portal.

## What works
- **Find:** search and filter the scheme list, see each scheme's status and official source link.
- **Check:** indicative eligibility (age, income, state, occupation, category, land). Shows matched, failed and unknown criteria.
- **Talk:** AI chat over the scheme data with source links. Answers mention when a scheme is not officially verified.
- **Documents:** photo scan with explicit consent, then a review screen where you correct values before saving.
- **Apply:** fills an official PDF form where one is bundled, or creates a summary PDF. Both are drafts for you to review.
- **Track:** an application status log you maintain yourself. It is not official government tracking.
- **Admin (optional):** verification dashboard for reviewers.

## What is not real yet
- Most scheme records are **unverified**. Only records marked *verified* in the admin dashboard, with a government source and reviewer, carry that label.
- Tamil Nadu register entries are names only; their details are pending.
- Live AI answers, voice and OCR need a Gemini key. Without it, the app shows clearly labelled fallback text.
- No official government portal integration exists. Nothing is submitted for you.

## Demo mode
Set `VITE_DEMO_MODE=true` in `frontend/.env`. A banner shows "DEMO MODE – sample data only". Demo mode uses synthetic
profile values only. It does not bypass sign-in, and it creates no accounts or admin access.

## Privacy and consent
- Document photos are sent to Google Gemini only after you tick the consent box. The server refuses processing without consent.
- Photos are not stored on our server. Extracted values are kept in your browser's encrypted local vault.
- Data export and account deletion are available in the API (`/api/me/export`, `DELETE /api/me`).
- Logs redact Aadhaar, PAN, phone numbers and keys.

## Talk needs sign-in
Talk is an authenticated feature: signed-out users see a sign-in screen that explains why. Find and Check work without signing in.
Chat memory is kept per signed-in user and expires after 30 idle minutes. `DELETE /api/ask/session/{id}` clears your own memory.

## Seeding Supabase
`python backend/tools/seed_supabase.py --dry-run` validates and maps all records without sending anything.
Without `--dry-run` it needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment (never committed).
Columns are read from `supabase/migrations/0001_init.sql`. Extra source fields go into the `extra` column, and rejects are printed with reasons.

## Deployment file locations
- `render.yaml` is at the repository root (Render reads it there; `rootDir: backend`).
- `frontend/vercel.json` is used with the Vercel root directory set to `frontend`.

## Setup (2 commands)

**Windows (PowerShell):**
```powershell
.\scripts\setup.ps1    # installs deps, copies .env.example → .env if missing
.\scripts\run.ps1      # starts backend on :8000 and frontend on :5173 in parallel
```

**macOS / Linux (bash):**
```bash
bash scripts/setup.sh
bash scripts/run.sh
```

The app opens at **http://localhost:5173**. Find and Check work immediately without any keys.
To unlock Talk, Docs, Voice and Admin, fill in `backend/.env` and `frontend/.env` (see below).

### Manual setup (alternative)
Backend (Python 3.12+):
```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # fill in values; see the variable list below
python ingest.py              # builds the vector index (first run downloads an embedding model)
uvicorn app:app --reload --port 8000
```
Frontend (Node 20):
```bash
cd frontend
npm ci
cp .env.example .env
npm run dev                   # http://localhost:5173
```

### Environment variables (names only; values never go in git)
Backend: `ENV`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`,
`SUPER_ADMIN_PHONES`, `ALLOWED_SOURCE_DOMAINS`, `CORS_ORIGINS`, `TRUST_PROXY`, `FRESH_LOGIN_MINUTES`, `RATE_LIMIT_DEFAULT`,
`RATE_LIMIT_AI`, `MAX_BODY_BYTES`, `MAX_UPLOAD_BYTES`, `GEMINI_TIMEOUT_S`.

Frontend: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEMO_MODE`.

The service-role key is server-only. Never put it in the frontend.

### Supabase
See `supabase/README.md`. Run `supabase/migrations/0001_init.sql` in the SQL editor. Phone sign-in needs an SMS provider configured in Supabase.
Without Supabase configured, the protected screens (Docs, Apply, Track, Talk history) ask you to sign in and cannot be used.

## Tests
Backend: `cd backend && python -m pytest tests -q` (202 tests). Frontend: `cd frontend && npm test` (12 tests) and `npm run build`.
Earlier command list:
```bash
cd backend && pytest -q          # backend, including auth, consent, RLS (needs pgserver), eligibility, PDF, OCR upload checks
cd frontend && npm run build     # type-check and production build
```
Last run: 82 backend tests passed; frontend type-check and build passed. Live Gemini, live Supabase and mobile
devices were not tested.

## Known limitations
- Eligibility is indicative. It never means an official approval.
- Scheme data is limited and mostly unverified; check the official source link.
- Voice input depends on the browser's speech support or Gemini.
- Rate limiting is per server instance in memory.

## Demo script (about 3 minutes)
1. Open the app. Confirm the demo banner is showing.
2. Find → search "agriculture"; open a scheme and note its verification label and source link.
3. Check → enter age 34, occupation farmer, income 150000, state Tamil Nadu; review matched, failed and unknown criteria.
4. Talk → ask "what can a farmer get?"; point out the source links and the "not verified" note where it applies.
5. Documents → tick consent, upload a synthetic sample document, correct any field, then save.
6. Apply → generate the summary PDF; point out that it is a draft to review, not a submission.
7. Track → add the application and change its status.

## Scheme data quality and evidence
- `docs/SCHEME_QUALITY_REPORT.md` is generated from the data by `python backend/tools/quality_report.py`.
- `docs/EVIDENCE_LOG.md` records what was checked for each demo scheme. Verified count is currently **0**.
- Source domains are flagged: a non-government source shows a warning in the app.
- Eligibility shows counts of checks met (for example "2 of 3 checks met"), not a probability of approval.
- Ambiguous answers (for example "lots" as income, or an unrecognised occupation) are reported as unknown, never as pass or fail.
- Answers are checked after generation: links must come from the retrieved scheme record, and rupee amounts must appear in it.
