# Production-readiness upgrade (security pass)

## Done and tested
- Supabase Postgres schema with RLS (`supabase/migrations/0001_init.sql`). 15 RLS tests against a real Postgres.
- Backend JWT validation (audience, issuer, expiry, role=authenticated, verified phone), roles from `user_roles` only.
- Admin verification API: verify / reject / expire / needs-review, fresh-login requirement, official-domain check,
  optimistic concurrency, edit drops verified to needs-review, history and audit tables (append-only).
- Public scheme API exposes no reviewer identity. Expired reviews are treated as expired.
- Rate limiting, body-size limits, security headers, CORS allow-list, startup refusal in production, log redaction.
- RAG: only live, non-expired schemes are retrieved; retrieved text is treated as data; deterministic disclosure
  when a scheme is not officially verified.
- Frontend: Supabase phone-OTP login, role read from the backend, admin verification screen, CSP and security headers.
- Application tracker and account routes are user-scoped; account deletion and data export.

## Not done in this pass (be honest about these)
- Scheme changes beyond the basics: full duplicate-merge workflow and a change-review queue.
- Audit log and verification history are written by the backend, but no UI for reviewing them yet.
- Document vault is still on-device; the server-side document storage and retention job are not implemented.
- Voice, OCR and chat quality depend on Gemini and were not tested against the live API.
- No mobile-device testing was performed.
- No rate limiter shared across instances (in-memory); use Redis before scaling out.
- Backup/restore is documented, not automated or drilled.
