# Status against the judge improvement report

Each row says what changed, the test that proves it, and what is still open. Nothing here is a live-service result unless marked.

## Fixed and tested (automated)

| Area | Before | After | Test |
|---|---|---|---|
| Income parsing | "1.5 lakh" read as Rs 1.5, could pass a cap | Lakh/crore converted; ambiguous text is unknown | `test_income_in_lakhs_is_compared_correctly`, `test_ambiguous_income_is_unknown_not_guessed` |
| Unrecognised occupation | Marked FAIL | Marked unknown with a note | `test_unrecognised_occupation_is_unknown_not_fail` |
| Eligibility "score" | Shown as a percentage, looked like a probability | Shown as "N of M checks met" with a disclaimer | `test_criteria_count_is_reported_instead_of_probability` |
| Invented links in answers | Not checked | Links must come from the retrieved scheme record, or are removed | `test_invented_link_is_removed`, `test_rails_strip_invented_link_end_to_end` |
| Invented amounts in answers | Not checked | Amounts must appear in the retrieved record, or the answer is flagged | `test_invented_amount_is_flagged` |
| Prompt injection, offline | Input guard needed a live Gemini call; no offline defence | Pattern pre-filter blocks clear override and secret-extraction attempts before any model call | 7 attack strings blocked, model never called (`test_injection_is_blocked_offline`) |
| Non-government sources | Shown without warning (53 records) | Warning shown in app and API | `test_non_government_source_gets_warning` |
| State level values | "state_maharashtra" (not a valid value) | Normalised to level "state" with state name | `test_state_level_variants_are_normalised` |
| Readiness check | Only a basic "ok" | `/api/ready` lists missing dependencies, reveals no keys, says "configured is not live-tested" | `test_ready_reports_missing_dependencies_without_secrets` |
| Vulnerable dependencies | starlette 0.41.3, python-dotenv 1.0.1 | starlette 1.10.0 (via FastAPI 0.165.0), python-dotenv 1.2.4 | suite passes after upgrade |
| Demo sample profile | Not in the app | "Load sample profile (synthetic)" button on Check page | frontend type-check and build only |

**Total backend tests: 115 passed, 0 failed** (command: `cd backend && python3 -m pytest tests -q`).
**Frontend: TypeScript check passed; production build passed.**

## Data (generated, not hand-typed)
See `docs/SCHEME_QUALITY_REPORT.md`. Verified records: **0**. Name-only records: 72. Non-government source links: 53. Duplicate name groups: 13 (not deleted; each needs a reviewer decision).

## Still open or not verified

| Item | Status |
|---|---|
| Scheme facts | No record is verified. PM-KISAN was partly checked by automated search; see `docs/EVIDENCE_LOG.md`. Conflicting secondary sources were found. |
| Live Gemini answers, grounding quality | NOT VERIFIED. No key available here. Grounding checks are tested as functions only. |
| Adversarial evaluation of live model | NOT RUN. Only the offline pre-filter and the grounding functions are tested. |
| OCR accuracy on real documents | NOT VERIFIED. |
| Voice input and output | NOT VERIFIED. |
| Tamil native-speaker review | NOT DONE. |
| Mobile devices and accessibility | NOT DONE. No device or screen-reader test. |
| Per-form PDF tests for every bundled form | NOT DONE. One form has been exercised in tests. |
| Frontend unit or end-to-end tests | NOT DONE. No frontend test suite exists. |
| CI run on GitHub | NOT RUN here. Workflow file exists. |
| Deployment (Render, Vercel, Supabase) | NOT DEPLOYED. |
| Backup and restore | NOT TESTED. Documented only. |
| Remaining vulnerable packages | 62 findings in transformers 4.46.3, langgraph/langchain family, chromadb (no fixed version), sentence-transformers. Upgrades are major-version changes; the real embedding and retrieval path cannot be tested here without a model download and keys. Recorded as residual risk. |
| Rate limiting | In memory, per instance. Not shared across instances. |

## Score
This round does not change the verified-data score, because no scheme has been verified by a reviewer. I have not re-estimated the judge score; the report's own criteria depend on live evidence and verified demo schemes that are not yet in place.
