"""Sliding-window rate limiter + body-size limit + security headers (pure ASGI, no extra deps).
In-memory: correct for a single Render instance. Use a shared store (Redis) if you scale to several instances."""
import json
import time
from collections import defaultdict, deque

import config

AI_PREFIXES = ("/api/ask", "/api/ocr", "/api/voice", "/api/translate")
UPLOAD_PREFIXES = ("/api/ocr", "/api/voice/stt", "/api/forms/overlay")


def _client_ip(scope) -> str:
    if config.TRUST_PROXY:
        for k, v in scope["headers"]:
            if k == b"x-forwarded-for":
                return v.decode().split(",")[0].strip()
    return (scope.get("client") or ("unknown", 0))[0]


class Limiter:
    def __init__(self):
        self.hits: dict[str, deque] = defaultdict(deque)

    def check(self, key: str, limit: int, window: int = 60) -> int:
        """Returns 0 if allowed, else seconds to wait."""
        now = time.monotonic(); q = self.hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return max(1, int(window - (now - q[0])))
        q.append(now)
        if len(self.hits) > 20000:   # crude memory cap
            self.hits.clear()
        return 0


limiter = Limiter()


class SecurityMiddleware:
    def __init__(self, app):
        self.app = app

    async def _reject(self, send, status, msg, extra=()):
        body = json.dumps({"detail": msg}).encode()
        await send({"type": "http.response.start", "status": status,
                    "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()), *extra]})
        await send({"type": "http.response.body", "body": body})

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path, method = scope["path"], scope["method"]
        if method == "OPTIONS" or path == "/health":
            return await self.app(scope, receive, send)

        # rate limit (per IP; AI/upload endpoints have a tighter bucket)
        ip = _client_ip(scope)
        is_ai = path.startswith(AI_PREFIXES)
        wait = limiter.check(f"{'ai' if is_ai else 'gen'}:{ip}", config.RATE_LIMIT_AI if is_ai else config.RATE_LIMIT_DEFAULT)
        if wait:
            return await self._reject(send, 429, "Too many requests. Please slow down.", [(b"retry-after", str(wait).encode())])

        # request size limit (declared and actual)
        cap = config.MAX_UPLOAD_BYTES if path.startswith(UPLOAD_PREFIXES) else config.MAX_BODY_BYTES
        for k, v in scope["headers"]:
            if k == b"content-length" and v.isdigit() and int(v) > cap:
                return await self._reject(send, 413, f"Request too large (max {cap // 1000} KB)")
        seen = 0

        async def guarded_receive():
            nonlocal seen
            msg = await receive()
            if msg["type"] == "http.request":
                seen += len(msg.get("body", b""))
                if seen > cap:
                    raise _TooLarge()
            return msg

        async def with_headers(msg):
            if msg["type"] == "http.response.start":
                msg["headers"] = list(msg.get("headers", [])) + [
                    (b"x-content-type-options", b"nosniff"), (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"no-referrer"), (b"cache-control", b"no-store"),
                    (b"permissions-policy", b"camera=(self), microphone=(self), geolocation=()")]
            await send(msg)

        try:
            await self.app(scope, guarded_receive, with_headers)
        except _TooLarge:
            await self._reject(send, 413, f"Request too large (max {cap // 1000} KB)")


class _TooLarge(Exception):
    pass
