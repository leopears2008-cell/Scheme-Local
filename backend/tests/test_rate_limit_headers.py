import security.ratelimit as rl


def test_security_headers_present(client):
    r = client.get("/api/schemes/meta")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    assert r.headers["cache-control"] == "no-store"


def test_rate_limit_kicks_in(client, monkeypatch):
    import config
    rl.limiter.hits.clear()
    monkeypatch.setattr(config, "RATE_LIMIT_DEFAULT", 3)
    codes = [client.get("/api/schemes/meta").status_code for _ in range(5)]
    assert codes.count(429) >= 1 and 200 in codes


def test_ai_bucket_is_tighter(client, monkeypatch):
    import config
    rl.limiter.hits.clear()
    monkeypatch.setattr(config, "RATE_LIMIT_AI", 2)
    codes = [client.post("/api/ask", json={"message": "x", "session_id": "s"}).status_code for _ in range(4)]
    assert codes.count(429) >= 1


def test_cors_rejects_unknown_origin(client):
    r = client.options("/api/schemes", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in {k.lower() for k in r.headers}


def test_oversized_json_body_rejected(client, monkeypatch):
    import config
    monkeypatch.setattr(config, "MAX_BODY_BYTES", 500)
    r = client.post("/api/eligibility", json={"profile": {"x": "y" * 2000}})
    assert r.status_code == 413


def test_logs_are_redacted():
    from security.logging_setup import redact
    s = redact("aadhaar 2345 6789 0124 pan ABCDE1234F phone +919876543210 Bearer abc.def.ghi key=AIzaSySECRETSECRET")
    for leaked in ("2345 6789 0124", "ABCDE1234F", "+919876543210", "AIzaSySECRET"):
        assert leaked not in s
