# Guest mode

Anyone can start a guest session from the sign-in screen, with no code, no password, and an optional email.

## What a guest can do
- Browse and search schemes (Find) and run eligibility (Check). These were always public.
- Chat (Talk), within limits.
- See their own guest role (`/api/me`).

## What a guest cannot do
Every other protected route refuses guest tokens with HTTP 403 and an explanation:
admin pages, saved applications and bookmarks, notifications, document and form uploads, voice,
translation, the PDF forms, account export and account deletion, and profile updates.
Tested on 18 routes by automated test; 9 of them were also checked against the running server.

## How it works
- `POST /api/guest/session` (public, rate limited per network) issues a token signed by the server (`GUEST_TOKEN_SECRET`),
  valid for 2 hours, with its own issuer and audience. It carries only a random `guest:` identity and the role `guest`.
- The server verifies the signature, issuer, audience, expiry and identity on every request. A guest token that claims
  any other role is rejected. Forged or expired tokens are rejected.
- Guest chat memory is kept per guest and expires after 30 idle minutes. Two guests never share memory.
- The browser keeps the token in `sessionStorage`, so it ends when the tab closes.

## The email field
The email is validated only. It is **not stored, not logged, and not put in the token**. If you want to contact guests,
that is a separate decision with privacy consequences, and it is not implemented.

## Limits (anti-abuse)
| Limit | Default | Env var |
|---|---|---|
| Guest sessions per network per hour | 5 | `GUEST_SESSIONS_PER_IP_PER_HOUR` |
| Questions per guest per 10 minutes | 10 | `GUEST_ASK_PER_10MIN` |
| Questions per guest per day | 40 | `GUEST_ASK_PER_DAY` |
| Lifetime of a guest session | 2 hours | `GUEST_TTL_S` |
| Existing AI limit per network | 20 per minute | `RATE_LIMIT_AI` |

## Production setup
1. Generate a secret: `openssl rand -hex 32`, and set it as `GUEST_TOKEN_SECRET` on Render.
2. Keep `GUEST_ENABLED=true` only if you want guests. In production the server refuses to start with guests enabled and no secret.
3. Turn guests off by setting `GUEST_ENABLED=false`. Existing guest tokens stop working immediately.

## Known limits (be honest about these)
- **No CAPTCHA.** A determined person can start many sessions from different networks. The per-network limit slows this; it does not stop it.
- **Limits are in memory, per server instance.** With more than one instance, each instance counts separately.
  Use a shared store (for example Redis) before scaling out.
- **Guest tokens live in browser storage.** That is readable by any script running on the page, so the site must stay free of
  untrusted scripts. The token grants only guest access, but treat it as sensitive.
- **Restarting a development server** invalidates guest tokens (the development secret is random per process).
  Production uses the fixed `GUEST_TOKEN_SECRET`, so tokens survive restarts until they expire.
- **Guest answers are not verified.** They come from the same grounded assistant as citizen chat and carry the same warnings.
