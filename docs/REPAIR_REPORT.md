# Repair report (hackathon repair prompt)

Scope: the repairs in the repair prompt that were implemented in the existing project. Every claim below is tied to a test or
a command that was actually run. Items marked **NOT VERIFIED** were not tested in this environment.

## A. Repairs completed

| # | Area | File(s) | Root cause (reproduced) | Repair | Test and result |
|---|---|---|---|---|---|
| 3.1 | Guardrails show zero scheme cards | `pipeline/guardrails.py`, `schemes_store.py` | `KNOWN_SCHEMES` was computed at import when the store was empty. Loading 417 schemes left the ID set at **0**, so every valid scheme was dropped. | Store change listeners (`on_change`) run after every load or refresh. Guardrails re-sync their ID set from the live store. No circular import. | 5 guardrail tests in `test_repair_guardrails_ingest.py` pass. Running app `/health` reports `schemes_loaded: 417, guardrail_ids: 417`. |
| 3.2 | Ingestion crash `KeyError: 'name'` | `ingest.py` | Register records use `official_name`; the text builder read `name`. | Records are normalised with the store's own `legacy_to_row`/`row_to_scheme`. Missing fields become "Not listed". Malformed and duplicate records are skipped with a reason. | Reproduced `KeyError` before; 4 unit tests and a full `ingest.main()` run (5 tests in that file for this part) over legacy, canonical, broken, duplicate and nameless records pass. Real embedding model **not run** (sentence-transformers not installed here); a deterministic stand-in was used. |
| 3.3 | Browser crash on large payloads | `frontend/src/lib/bytes.ts` (new), `profile-vault.ts`, `voice.ts` | `String.fromCharCode(...bytes)` on large arrays. | Chunked (32 KB) conversion; empty and invalid input handled; decrypt path no longer expands strings. | Original spread reproduced `RangeError: Maximum call stack size exceeded` at **150 KB**. 6 frontend tests pass (empty, small, 150 KB, ~1 MB, invalid, blob). Browser document scan and voice flow **NOT VERIFIED** end to end. |
| 3.4 | Talk returns "401 Login required" to signed-out users | `frontend/src/App.tsx` | Talk was reachable without login but `/api/ask` requires login. | Option A: Talk requires sign-in, with an explanation and return to Talk after login. The login screen no longer flashes on refresh (waits for session check). | Backend rejection of anonymous `/api/ask` covered by existing auth tests. Frontend routing: type-check and build only; **no browser test**. |
| 3.5 | Supabase seed HTTP 400 | `tools/seed_mapping.py` (new), `tools/seed_supabase.py` | Register rows contain `source_checked_date` and `details_available`, which are not table columns. Reproduced against the migrated schema: `column "source_checked_date" ... does not exist`. | Column whitelist parsed from the migration file. Unknown fields kept in `extra`. Validation with reasons. `verified` can never be seeded. Non-https URLs cleared. Dry-run mode. | 10 tests pass, including inserts into the real migrated schema and an upsert check. Dry run on 417 records: 417 accepted, 0 rejected. **No run against a live Supabase project.** |
| 4.1 | False "not a government website" warning | `services/eligibility.py`, `frontend/.../Check.tsx` | Eligibility results had no source fields, so the UI showed the warning for every scheme. | Eligibility results carry `source_official` and `source_warning` from the same check as scheme cards. Domain check tested for subdomains and lookalikes. | Parametrised domain tests and result-field tests pass. Official flag is **not** a verification. |
| 4.2 | Find header `undefined` | `Find.tsx`, `api.ts`, `routers/schemes.py` | Frontend read `meta.verified`; backend returns `meta.verification.verified`. | One contract: counts under `verification`. Frontend type updated. | Contract test passes; old top-level key asserted absent. |
| 4.3 | Track invalid date and missing reference | `Track.tsx`, `api.ts`, `contracts.ts` | Frontend read `a.ref` and `e.at`; backend sends `reference_number` and `created_at`. | Field names aligned. Invalid or missing dates show "—". | 4 frontend date tests pass. Page rendering **NOT VERIFIED** in a browser. |
| 4.4 | Verified badge mismatch | `contracts.ts`, `schemes_store.py`, `Talk.tsx`, `Find.tsx`, `i18n.ts` | Frontend compared with `hand_verified`, which the backend no longer sends. | Canonical states `verified / needs_review / unverified / expired`. Unknown or legacy values become `unverified`, never `verified`. Labels added in English, Hindi and Tamil. | 9 backend status tests and 2 frontend status tests pass. |
| 4.5 | Demo profile category | `Check.tsx`, `demo.ts` | `BC` was not in the dropdown. Demo profile button showed even when demo mode was off. | BC and MBC added as community categories, kept separate from economic categories (BPL, EWS). Demo button shown only in demo mode. | Code change verified by type-check and build. **No automated test** for the mapping. |
| 4.6 | Apply always showed generic fields | `Apply.tsx`, `routers/schemes.py` | Clicking a list item stored the list summary, which has no form fields. | Selecting a scheme fetches full details. Field layout returned for schemes with a bundled official form, with a note to check the official site. | Updated backend test passes. Click path **NOT VERIFIED** in a browser. |
| 4.7 | Admin Verify lacked details; 422 on empty source | `admin/Verify.tsx` | Only the source URL was shown. Empty source was sent and rejected. | Shows eligibility, benefits, documents, status and version. Source prefilled. Verify button disabled until the source is a government https address. Backend checks unchanged. | URL rule tested (contracts). Screen **NOT VERIFIED** in a browser. |
| 5.1 | Acres treated as hectares | `services/units.py` (new), `services/eligibility.py` | `4 acres` became 4.0 ha and **failed** a 2 ha cap. Correct value is 1.62 ha, which passes. | Units required. Acres converted at 0.404686 ha. Unit missing = unknown, with a note asking the user. The conversion is shown in the criterion detail. | 13 conversion and unit-missing tests plus 3 regression tests pass. The Check page does not yet ask for the unit; the user must type it. |
| 5.2 | Substring false positives | `services/eligibility.py` | `st` matched `student`; `male` matched `female`. | Whole-word token matching. | Parametrised tests pass. |
| 5.3 | Lakh and crore parsing | `services/units.py`, `pipeline/grounding.py` | `2.5 lakh` was **not detected at all**, so an invented lakh amount passed without a flag. | One numeric parser used for eligibility and grounding; amounts compared by value with rounding tolerance. | 15 parser and grounding tests pass; invented `9 lakh` and `3 crore` are flagged; correct `2.5 lakh` is not. |
| 6.1 | Raw chat text written to logs | `routers/chat.py` | `LOG_CHAT_TEXT=False` was defined but never read. Raw messages were always written to `traces.jsonl`. | Trace stores a hash and length by default. Text is written only if the flag is true, and then redacted. | 3 privacy tests pass (no raw text, redaction even when enabled, no user ID in traces). |
| 6.2 | Cross-user session leak | `routers/chat.py` | Sessions keyed by the client's `session_id` alone, so two users with the same ID shared profile data. | Keys are a hash of authenticated user and session ID. Sessions expire after 30 idle minutes. Users can clear their own session. Session IDs are validated. | 5 session tests (isolation, key hashing, clearing, expiry, validation) pass. |

## B. Tests (commands actually run)

| Command | Result |
|---|---|
| `cd backend && python -m pytest tests -q` | **223 passed**, 0 failed. One third-party deprecation warning (langgraph). |
| `cd frontend && npm test` | **12 passed**, 0 failed (Node built-in test runner; bytes and contract helpers). |
| `cd frontend && npx tsc --noEmit` | Passed (exit 0). |
| `cd frontend && npm run build` | Passed. |
| Backend started with `uvicorn app:app` and called | `/health` OK (417 schemes, 417 guardrail IDs); `/api/ready` reports missing Gemini, auth and vector index (accurate); anonymous `/api/applications` returns 401; `/api/schemes` returns data. |
| `python backend/tools/seed_supabase.py --dry-run` | 417 accepted, 0 rejected, nothing sent. |
| `python backend/tools/quality_report.py` | Regenerates `docs/SCHEME_QUALITY_REPORT.md`. |

### Browser checks (added in this round)

`python tests/e2e/ui_smoke.py` runs headless Chromium at a 390 px phone width against the running backend and built frontend.
Result: **11 of 11 checks passed**. Checks: Find loads results with no "undefined" header; Check shows criteria and the
"not a probability of approval" wording; the acre unit is sent with the request; no 401 errors and no page errors while
signed out; Talk explains sign-in; no horizontal overflow on Find, Check or Talk.

The browser run found three defects the unit tests had missed, all now fixed:

- Signed-out visitors triggered five 401 errors on load (notifications and bookmarks were fetched without a session). Protected calls are now not sent without a session.
- The Check form said "hectares" but had no unit choice, so a farmer typing acres would have been read as hectares. A unit selector was added, and the chosen unit is sent with the value.
- The source warning on eligibility results was re-checked in the browser: it now appears only on the 8 non-government sources in the first page, which is correct.

Two placeholder assertions were found in the test suite that always passed (`or True`). Both are now strict. A search of all test files found no others.

Still not run: any signed-in flow (chat, OCR, voice, admin, saving to Track). These need a Supabase project and a Gemini key, neither of which is available here.

Offline scenario tests (`backend/tests/test_scenarios_offline.py`, 21 tests) cover scenarios 1–11, 12–13 (scheme-ID side), 14 and 20 from the repair prompt on the deterministic eligibility side. Expired schemes can no longer be shown as ELIGIBLE or POSSIBLE_MATCH; this was a real gap found while writing the test.

Attempted and not possible in this sandbox: Gemini API and Supabase are unreachable (no network route, no credentials, no `backend/.env`). So the signed-in and live tests below were not run.

Not executed: a full integration test through a live Gemini key, a live Supabase project, a browser end-to-end run, the
real embedding model, and any mobile device.

## C. Security and privacy

- **Session isolation:** code inspection and tests of the key function and expiry. Two real users were not run against a live server.
- **Logging:** code inspection and tests. The redaction filter covers Aadhaar, PAN, phone and key patterns. Retention is not automated; use a short retention period on the host.
- **Document processing:** the OCR endpoint refuses processing without an explicit consent flag and only accepts JPEG, PNG and WebP (tests pass). Aadhaar checksum is tested. The browser vault still keeps encrypted document images on the device until the user deletes them. Server-side storage was not found in the OCR path by inspection, but this was **not** verified against the hosting configuration.
- **Supabase RLS:** the 15 RLS tests run the real migration on an embedded Postgres and pass. They emulate Supabase's auth schema. **Not run against a live Supabase project.**
- **Authorization:** admin and protected routes are checked on the backend (existing tests). Frontend route guards are only a convenience.
- **Secrets:** a source scan found no API keys. The service-role key is never in frontend code (checked by search).

## D. Remaining weaknesses

| Severity | Area | Reason | Recommended fix |
|---|---|---|---|
| High | Scheme data | No scheme is verified. Many sources are not government sites. | Human review of demo schemes against official sources, then verify in the admin screen. |
| High | AI quality | Live answers, the 20 scenarios in section 8, and retrieval with the real embedding model were **not run**. Only deterministic rails are tested. | Run the scenarios with a Gemini key and record the results. |
| High | Dependencies | 62 known vulnerabilities remain (transformers, langgraph family, chromadb, sentence-transformers). | Plan a controlled major-version upgrade with a real RAG test. |
| High | Demo flow | No browser end-to-end run. Admin, Track and Apply screens not exercised. | Rehearse the demo and add browser tests (for example Playwright) if allowed. |
| Medium | Accessibility and languages | Not tested: screen readers, keyboard flow, touch sizes on phones, Tamil native review, the other 12 languages. | Accessibility audit and native-speaker review. |
| Medium | Eligibility unit input | Fixed in this round: the Check form has a land unit selector and sends the unit. | None needed. |
| Medium | Sessions | Memory is per server instance and lost on restart. | Acceptable for the demo; use shared storage if scaling. |
| Medium | Document vault | Encrypted document images remain in browser storage until deleted. | Add a clear-all control and retention note on the Docs page. |
| Low | Guest mode | Not implemented (Option A chosen). | Only add if the demo needs it, with its own rate limits. |
| Low | Deployment | Config files moved to the correct locations; **not deployed** on Render or Vercel. | Deploy to a staging environment and run the health checks. |

## E. Hackathon readiness score (conservative)

| Area | Score /100 | Basis |
|---|---|---|
| Functionality (core flow) | 55 | Fixes are in and tested in parts; the browser flow is not run. |
| AI accuracy and grounding | 40 | Deterministic checks tested; live model behaviour unknown. |
| Scheme data reliability | 20 | Zero verified records. |
| UX and UI | 50 | Compiles and builds; not exercised in a browser. |
| Accessibility | 30 | Not tested. |
| Security and privacy | 60 | Several real defects fixed and tested; RLS only on embedded Postgres. |
| Technical architecture | 65 | Clear modules; tests are solid. |
| Demo reliability | 40 | Depends on live services that are not verified. |
| **Overall** | **~48** | Weighted by the above. |

## F. Judge demo readiness

**PARTIALLY READY.**

Reasons, from evidence: the backend starts and serves the scheme data, the frontend builds, and 214 automated tests pass
(202 backend, 12 frontend). The P0 defects in the prompt that were reproducible are fixed. However, the chat, OCR,
voice and admin flows have not been run against live services or in a browser, no scheme is verified, and accessibility and
multilingual quality are untested. A demo can be shown with the fallback paths (Find and Check work offline), but the
AI and verification claims must be presented as unverified until the items in section D are closed.

## G. Follow-up: clean-environment verification (P0 items)

- **Backend collection.** Reproduced the user's failure by making chromadb, psycopg2 and pgserver unimportable: collection errored. Fixed:
  the RAG guardrails no longer import chromadb (confidence function moved to `pipeline/confidence.py`), optional-package
  tests skip with a stated reason, and the chat route returns a clear 503 instead of a crash when the RAG stack is missing.
  Result with those packages missing: 184 passed, 11 skipped with reasons, 0 failed, 0 errors.
- **Clean install.** `requirements.txt` now excludes PyTorch (it needed several GB and failed on a small disk). Installing it in
  a fresh virtual environment exposed a missing `uharfbuzz` (needed by fpdf2 for Tamil and Hindi text), which is restored.
  Result in the fresh environment: **223 passed, 0 skipped**.
- **Frontend.** `esbuild` is declared directly. `npm ci` from the lockfile, `npm test` (12 passed) and `npm run build` pass.
- **Reproduction script.** `scripts/verify.sh` runs the backend and frontend checks from a clean state. It was run end to end
  and passed; the browser step is skipped unless the servers are running.
- **Not verified:** `requirements-rag.txt` (PyTorch and sentence-transformers) in a clean environment, for lack of disk space.

See `docs/LIMITATIONS.md` for the P1 items: eligibility scope, grounding limits, verification freshness, live AI performance,
and the fact that application support is preparation only with no government submission.

## H. Demo hardening round (Render 512 MB, no PyTorch, no chroma_db)

### Changed, with the test that covers each
| Area | Files | Change | Covered by |
|---|---|---|---|
| Retrieval without PyTorch | `pipeline/retrieval.py` (new), `pipeline/agents.py` | TF-IDF over the live scheme store, built in memory. ChromaDB only if the index folder AND packages exist. Chroma errors fall back instead of a 500. Complete records rank first; expired schemes excluded. | `test_demo_fixes.py` retrieval tests (7); `test_demo_ask.py` end-to-end without sentence-transformers |
| Thread-safety of index | `pipeline/retrieval.py` | LangGraph runs matchers in parallel threads. A rebuild could expose an unfitted vectorizer (found by the end-to-end test). Index now builds under a lock and publishes once. | `test_parallel_matchers_do_not_race_on_the_index` |
| Chat failures | `routers/chat.py` | Any pipeline exception returns a friendly 503; only the exception type is logged, never user text or internal detail. | `test_unexpected_pipeline_failure_returns_friendly_503` |
| Readiness | `app.py` | `/api/ready` reports `retrieval_mode`. | `test_readiness_reports_retrieval_mode` |
| Intent check | `pipeline/guardrails.py` | Model loaded once and cached in memory; broken model file falls back to rules. Without a model, a local rule-based check runs: no Gemini call per turn. Injection still checked first. | `test_check_input_never_calls_the_llm`, `test_intent_model_loaded_once_and_cached`, `test_broken_intent_model_falls_back_to_rules` |
| Demo sign-in | `security/auth.py`, `config.py`, `App.tsx`, `Login.tsx`, `lib/session.ts` | Off by default. When on, only emails on `DEMO_AUTH_EMAILS` may skip the phone check. All other accounts still need a phone. Opens on Find. | 4 demo-auth tests |
| JSON fallback | `schemes_store.py`, `config.py` | Production serves bundled JSON only if `ALLOW_JSON_FALLBACK=true`, with a warning. | 2 fallback tests |
| Scheme links | `backend/schemes/*.json` | Removed `utm_*` tracking parameters from 12 files. | `test_no_tracking_parameters_in_scheme_links` |
| Card ordering | `routers/schemes.py` | Verified first, then complete records, then placeholders. | `test_complete_records_sort_before_placeholders` (strict) |
| has_form_fields | `routers/schemes.py` | Computed before the field is removed (was always wrong). | `test_form_field_flag_is_true_for_scheme_with_bundled_form` |
| Synthesis prompt | `pipeline/agents.py` | Doubled braces removed from the JSON example. | `test_synthesis_template_has_single_braces_only` |
| Gemini timeout | `pipeline/llm.py` | `GEMINI_TIMEOUT_S` now passed to the client (milliseconds). | `test_gemini_client_receives_timeout` |
| Grounding pass | `pipeline/guardrails.py` | Grounding ran twice; now once. | covered by existing rails tests |
| PDF writer | `services/pdfgen.py` | Clones the form so AcroForm fields are kept. | `test_filled_official_form_keeps_its_fields_and_values` |
| Duplicate import | `routers/chat.py` | Removed. | import check |
| Frontend | `App.tsx`, `Talk.tsx`, `Docs.tsx`, `Track.tsx`, `api.ts`, `voice.ts`, `profile-vault.ts` | Notifications only when signed in; 401 no longer masked as "cannot reach server"; defensive rendering of malformed AI output; Track shows failures; voice always has a MIME type; clear message without secure context. | type-check and build; frontend tests 12/12 |

### Results
- Backend, normal environment: **253 passed**, 0 failed.
- Backend with chromadb, sentence-transformers, psycopg2 and pgserver made unimportable: **208 passed, 17 skipped with stated reasons, 0 failed**.
- Frontend: type-check passes, `npm test` 12/12, `npm run build` passes.
- Real server process: `/health` and `/api/ready` respond, `retrieval_mode` is `tfidf_fallback`, anonymous `/api/ask` returns 401, no tracebacks in the log.

### Not done, or only partly done (be explicit)
- **Live Gemini.** The end-to-end ask test replaces only Gemini with a fake, so it is an in-process check of the pipeline, not a live run. Answer quality is untested.
- **Localized safety notes for all 13 languages.** Not added. Only the existing four languages have notes; the rest fall back to English. Machine-written safety notices were not added without a native-speaker review.
- **Tamil and Hinglish retrieval.** The fallback matches words; a Tamil question about an English scheme record may find nothing. Answers then say the information cannot be verified.
- **Intent.** The local check is rule-based with a small out-of-scope list, not a trained model. A trained `intent_model.joblib` takes precedence when present.
- **Placeholder records.** The 72 name-only records are kept and ranked last, not removed. Removing them would delete data a reviewer may still need.
- **Non-government links.** The 53 non-government links are still flagged, not replaced. No replacement can be verified here.
- **Demo sign-in** needs a Supabase email account for each judge, set up in the Supabase dashboard, plus `DEMO_AUTH_ENABLED=true` and the allowlist. It is a deliberate exception to phone verification, so turn it off after judging.
- **Frontend behaviour** beyond type-check and build was not browser-tested in this round.

## I. Guest mode

Users may start a guest session with no OTP, no password and an optional email. Full design and limits: `docs/GUEST_MODE.md`.

- Backend: `security/guest.py` (token issue and verify), `routers/guest.py` (public start route, per-network limit),
  `security/auth.py` (guest principal; `require_user` refuses guests; new `require_user_or_guest` used only on chat and `/api/me`),
  `routers/chat.py` (per-guest question limits: 10 per 10 minutes, 40 per day), `config.py` (guest settings and a production check).
- Frontend: `lib/guest.ts` (sessionStorage with expiry), `lib/supabase.ts` (guest token used when there is no sign-in),
  `pages/Login.tsx` (guest start with an optional email), `pages/GuestLimit.tsx`, `App.tsx` (guest state; Track, Docs and Apply
  show a limit message; admin tab hidden; notifications not requested).

Results:
- Backend normal environment: 296 passed, including 43 guest tests.
- Frontend: 13 tests pass (added the guest expiry rule), type-check and build pass.
- Live browser (real backend and built frontend): guest start with an email, email not stored in the browser, chat box shown, Track locked, admin tab hidden, no 401 or 403 console errors.
- Live server, real HTTP: guest refused on 18 protected routes in automated tests, and on 9 of them against the live server (403); forged token and missing token refused (401); the 11th question in a session refused (429); session starts beyond the per-network limit refused (429).

Not done or limited: no CAPTCHA; limits are in memory per instance; guest answers are not verified (see the limits in `docs/GUEST_MODE.md`).
