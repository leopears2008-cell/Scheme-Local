# Known limitations (read before relying on any result)

Each item says what is proven, what is not, and what would close the gap.

## 1. Eligibility covers structured rules only
The rule engine evaluates only criteria stored as structured fields: age, income, state, occupation, gender, category,
land and a few disqualifiers. Written conditions (for example "must not be a government employee") are shown to the user as
text and are **not checked automatically**. A result of "2 of 2 checks met" means only those two structured checks passed.
Closing the gap: encode each written condition as a rule, reviewed against the official guideline.

## 2. Grounding checks prove consistency, not truth
After an AI answer is written, the code checks that every link comes from the retrieved scheme record and that every
rupee amount appears in that record. It does **not** check that the record is correct, that the answer is complete,
or that the wording is faithful. An answer can pass both checks and still be wrong if the stored record is wrong.

## 3. Verification labels do not prove freshness
"Verified" means a named reviewer checked an official source on a recorded date. Amounts, deadlines, eligibility and
application links change over time. The expiry date limits how long a label is trusted, but nothing automatically re-checks
the live government site. Closing the gap: periodic human review, and the admin expiry workflow.

## 4. A configured AI provider is not tested AI performance
The code can call Gemini when a key is set. This does not show that answers are accurate, multilingual answers are good,
or that voice and OCR work on real inputs. The only AI tests in the repository use fake responses. The 20 scenarios in the
repair prompt were not run against a live model.
Closing the gap: a recorded evaluation run with a key, using the scenarios and a scoring rubric.

## 5. Application support is preparation only
The app fills an official PDF or creates a summary draft that the citizen reviews. It does **not** submit anything to any
government portal, and no integration with any government system exists or was tested. A generated PDF is not a submitted
application. The Track page records what the citizen types; it is not official government tracking.
Closing the gap would require a formal integration agreement with each portal, which this project does not have.

## 6. Signed-in and live flows were not run
Chat, document scanning, voice, saving to Track, and admin verification need a Supabase project and a Gemini key. They were
not run end to end. Signed-out flows were tested in a headless browser (see tests/e2e/ui_smoke.py).

## 7. Test environment
- The core backend requirements install and the full test suite passes in a clean virtual environment (223 tests, nothing skipped).
- `requirements-rag.txt` (sentence-transformers and PyTorch) was **not** installed in a clean environment because the test machine
  did not have the disk space. Live embedding and retrieval are therefore unverified.
- Tests that need an optional package are skipped with a stated reason, never silently passed.

## 8. Frontend
- `npm ci` from the lockfile, `npm test` (12 tests) and `npm run build` pass in a clean install.
- `esbuild` is now declared directly, so the browser-free tests do not depend on Vite's internal dependencies.
- No frontend component tests exist beyond the helper functions. Page behaviour was checked only through the browser smoke test.

## 9. Data, security and operations
- No scheme is verified in the current data; about 53 source links are not government domains.
- 62 known vulnerabilities remain in transformers, the langgraph family, chromadb and sentence-transformers.
- Sessions and rate limits are held in memory per instance.
- Backups and restore are documented, not drilled.
- Row-level security is tested on an embedded Postgres copy, not on a live Supabase project.
