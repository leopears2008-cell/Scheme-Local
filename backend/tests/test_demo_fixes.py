"""Regression tests for the demo-blocker fixes: zero-PyTorch retrieval, cached local intent check, demo sign-in gate,
JSON fallback flag, link cleanup, card ordering, prompt braces, timeout, and friendly 503 on pipeline failure.
No live Gemini and no PyTorch are used here; the LLM is replaced by a fake with the shapes the pipeline expects."""
import json
import re
import time
from pathlib import Path

import jwt
import pytest

import config
import schemes_store as store
from conftest import SECRET, hdr, mint

SCHEMES_DIR = Path(__file__).resolve().parents[1] / "schemes"


# ---------------------------------------------------------------- 1. retrieval without PyTorch
def test_mode_is_fallback_without_index_folder(monkeypatch, tmp_path):
    from pipeline import retrieval
    monkeypatch.setattr(config, "CHROMA_DIR", tmp_path / "missing")
    assert retrieval.retrieval_mode() == "tfidf_fallback"


def test_mode_is_fallback_when_packages_missing(monkeypatch, tmp_path):
    from pipeline import retrieval
    (tmp_path / "idx").mkdir()
    monkeypatch.setattr(config, "CHROMA_DIR", tmp_path / "idx")
    monkeypatch.setitem(__import__("sys").modules, "sentence_transformers", None)
    assert retrieval.retrieval_mode() == "tfidf_fallback"


def test_fallback_finds_farmer_scheme_and_ranks_complete_record_first():
    from pipeline.retrieval import TFIDF
    store.load_all()
    hits = TFIDF.query("farmer kisan income support land", ["agriculture", "food"], "", 5)
    assert hits and hits[0]["meta"]["scheme_id"] == "pm_kisan"


def test_fallback_never_returns_expired_schemes(monkeypatch):
    from pipeline.retrieval import TFIDF
    store.load_all()
    monkeypatch.setitem(store.SCHEMES, "pm_kisan", {**store.SCHEMES["pm_kisan"], "verification": "expired"})
    ids = [h["meta"]["scheme_id"] for h in TFIDF.query("farmer kisan income support land", ["agriculture", "food"], "", 5)]
    assert "pm_kisan" not in ids


def test_fallback_respects_state_scope():
    from pipeline.retrieval import TFIDF
    store.load_all()
    hits = TFIDF.query("scheme", ["social_welfare", "education", "agriculture", "employment_skill", "other", "health", "housing", "women_child", "finance_insurance", "food"], "kerala", 20)
    for h in hits:
        assert h["meta"]["state_scope"] in ("central", "kerala")


def test_no_shared_words_means_no_match():
    from pipeline.retrieval import TFIDF
    store.load_all()
    assert TFIDF.query("zzqqxx unrelated gibberish", [], "", 5) == []


def test_chroma_failure_falls_back_instead_of_500(monkeypatch):
    pytest.importorskip("chromadb", reason="imports pipeline.agents, which needs chromadb")
    import pipeline.agents as ag
    store.load_all()
    monkeypatch.setattr(ag, "retrieval_mode", lambda: "chroma")
    def boom():
        raise ValueError("Could not connect to tenant default_tenant")
    monkeypatch.setattr(ag, "get_collection", boom)
    rows = ag._search("farmer kisan income support", ["agriculture"], "")
    assert any(meta["scheme_id"] == "pm_kisan" for _, meta, _ in rows)


def test_readiness_reports_retrieval_mode(client):
    r = client.get("/api/ready").json()
    assert r["retrieval_mode"] in ("chroma", "tfidf_fallback")


# ---------------------------------------------------------------- 2. intent: cached, local, no model call
def test_local_intent_rules():
    from pipeline.guardrails import local_intent
    assert local_intent("hello") == "greeting"
    assert local_intent("what is the weather in chennai") == "out_of_scope"
    assert local_intent("write me a python script to hack a site") == "out_of_scope"
    assert local_intent("what scheme can a farmer get") == "scheme_question"


def test_check_input_never_calls_the_llm(monkeypatch):
    import pipeline.guardrails as g
    monkeypatch.setattr(g, "_load_intent_model", lambda: None)
    def forbidden(*a, **k):
        raise AssertionError("LLM intent call must not happen per turn")
    monkeypatch.setattr(g, "_llm_intent", forbidden)
    assert g.check_input("what scheme can a farmer get") == (True, "scheme_question")
    assert g.check_input("what is the weather today") == (False, "out_of_scope")


def test_intent_model_loaded_once_and_cached(monkeypatch, tmp_path):
    import pipeline.guardrails as g
    calls = {"n": 0}

    class Model:
        def predict(self, xs):
            return ["scheme_question"]

    def fake_load(path):
        calls["n"] += 1
        return Model()
    fake = tmp_path / "intent_model.joblib"; fake.write_bytes(b"x")
    monkeypatch.setattr(g, "INTENT_MODEL_PATH", fake)
    monkeypatch.setattr(g, "_INTENT_LOADED", False)
    monkeypatch.setattr(g, "_INTENT_MODEL", None)
    import joblib
    monkeypatch.setattr(joblib, "load", fake_load)
    for _ in range(5):
        g.check_input("farmer scheme please")
    assert calls["n"] == 1


def test_broken_intent_model_falls_back_to_rules(monkeypatch, tmp_path):
    import pipeline.guardrails as g
    bad = tmp_path / "intent_model.joblib"; bad.write_bytes(b"not a model")
    monkeypatch.setattr(g, "INTENT_MODEL_PATH", bad)
    monkeypatch.setattr(g, "_INTENT_LOADED", False)
    monkeypatch.setattr(g, "_INTENT_MODEL", None)
    assert g.check_input("farmer scheme") == (True, "scheme_question")


# ---------------------------------------------------------------- 3. demo sign-in gate
def _token(sub, phone="", email="", exp_in=3600):
    now = int(time.time())
    claims = {"sub": sub, "aud": "authenticated", "role": "authenticated", "iss": f"{config.SUPABASE_URL}/auth/v1",
              "iat": now, "exp": now + exp_in}
    if phone: claims["phone"] = phone
    if email: claims["email"] = email
    return jwt.encode(claims, SECRET, algorithm="HS256")


def test_email_only_account_refused_when_demo_off(client, monkeypatch):
    monkeypatch.setattr(config, "DEMO_AUTH_ENABLED", False)
    monkeypatch.setattr(config, "DEMO_AUTH_EMAILS", ["judge@example.com"])
    t = _token("77777777-7777-7777-7777-777777777777", email="judge@example.com")
    assert client.get("/api/me", headers=hdr(t)).status_code == 403


def test_allowlisted_demo_account_accepted_when_demo_on(client, monkeypatch):
    monkeypatch.setattr(config, "DEMO_AUTH_ENABLED", True)
    monkeypatch.setattr(config, "DEMO_AUTH_EMAILS", ["judge@example.com"])
    t = _token("77777777-7777-7777-7777-777777777777", email="Judge@Example.com")
    assert client.get("/api/me", headers=hdr(t)).status_code == 200


def test_non_allowlisted_email_still_refused_when_demo_on(client, monkeypatch):
    monkeypatch.setattr(config, "DEMO_AUTH_ENABLED", True)
    monkeypatch.setattr(config, "DEMO_AUTH_EMAILS", ["judge@example.com"])
    t = _token("88888888-8888-8888-8888-888888888888", email="stranger@example.com")
    assert client.get("/api/me", headers=hdr(t)).status_code == 403


def test_phone_accounts_unaffected_by_demo_flag(client, monkeypatch):
    monkeypatch.setattr(config, "DEMO_AUTH_ENABLED", True)
    assert client.get("/api/me", headers=hdr(mint("11111111-1111-1111-1111-111111111111"))).status_code == 200


# ---------------------------------------------------------------- 4. JSON fallback only when explicitly allowed
class _EmptyRepo:
    def schemes_all(self):
        return []

    def scheme_upsert_many(self, rows):
        pass


def test_production_with_empty_table_does_not_serve_json_by_default(monkeypatch):
    from repo import set_repo
    monkeypatch.setattr(config, "ENV", "production")
    monkeypatch.setattr(config, "ALLOW_JSON_FALLBACK", False)
    set_repo(_EmptyRepo())
    try:
        store.load_all()
        assert len(store.SCHEMES) == 0
    finally:
        set_repo(None)
        monkeypatch.setattr(config, "ENV", "development")
        store.load_all()


def test_production_json_fallback_when_explicitly_allowed(monkeypatch, caplog):
    from repo import set_repo
    monkeypatch.setattr(config, "ENV", "production")
    monkeypatch.setattr(config, "ALLOW_JSON_FALLBACK", True)
    set_repo(_EmptyRepo())
    try:
        with caplog.at_level("WARNING"):
            store.load_all()
        assert len(store.SCHEMES) > 300
        assert any("ALLOW_JSON_FALLBACK" in r.getMessage() for r in caplog.records)
    finally:
        set_repo(None)
        monkeypatch.setattr(config, "ENV", "development")
        monkeypatch.setattr(config, "ALLOW_JSON_FALLBACK", False)
        store.load_all()


# ---------------------------------------------------------------- 5. data quality: links and ordering
def test_no_tracking_parameters_in_scheme_links():
    for f in SCHEMES_DIR.glob("*.json"):
        assert "utm_" not in f.read_text(encoding="utf-8-sig"), f.name


def test_form_field_flag_is_true_for_scheme_with_bundled_form(client):
    r = client.get("/api/schemes", params={"q": "kisan", "limit": 20}).json()
    pm = next(x for x in r["items"] if x["scheme_id"] == "pm_kisan")
    assert pm["has_form_fields"] is True


def test_complete_records_sort_before_placeholders(client):
    items = client.get("/api/schemes", params={"limit": 400}).json()["items"]
    def complete(x):
        return bool(x.get("benefit") and x.get("eligibility_rules") and x.get("documents_required") and x.get("source_official"))
    flags = [complete(x) for x in items]
    assert any(flags) and not all(flags), "fixture must contain both kinds"
    first_incomplete = flags.index(False)
    assert not any(flags[first_incomplete:]), "every complete record must come before the first incomplete one"


# ---------------------------------------------------------------- 6. prompt, timeout, friendly failures
def test_synthesis_template_has_single_braces_only():
    src = (Path(__file__).resolve().parents[1] / "pipeline" / "agents.py").read_text(encoding="utf-8")
    tpl = src[src.index('SYNTH_SYSTEM = """'):]
    tpl = tpl[len('SYNTH_SYSTEM = """'):tpl.index('"""')]
    assert "{{" not in tpl


def test_gemini_client_receives_timeout(monkeypatch):
    import pipeline.llm as llm
    seen = {}

    class Rec:
        def __init__(self, **kw):
            seen.update(kw)
    from google import genai
    monkeypatch.setattr(genai, "Client", Rec)
    monkeypatch.setattr(llm, "GEMINI_API_KEY", "test-key-not-real")
    monkeypatch.setattr(llm, "_client", None)
    monkeypatch.setattr(llm, "GEMINI_TIMEOUT_S", 7)
    llm.client()
    assert seen["http_options"].timeout == 7000
    monkeypatch.setattr(llm, "_client", None)


def test_unexpected_pipeline_failure_returns_friendly_503(client, citizen, monkeypatch):
    pytest.importorskip("chromadb", reason="needs the pipeline imports (requirements.txt)")
    import pipeline.graph as graph
    def broken(*a, **k):
        raise RuntimeError("internal detail that must not reach the user")
    monkeypatch.setattr(graph, "run_pipeline", broken)
    r = client.post("/api/ask", headers=hdr(citizen), json={"message": "farmer scheme please", "session_id": "demo-session-1"})
    assert r.status_code == 503
    assert "internal detail" not in r.text and "temporarily unavailable" in r.text


def test_filled_official_form_keeps_its_fields_and_values():
    """Regression: the form writer now clones the document; filled values must survive and fields must remain."""
    from services.pdfgen import fill_official_form
    from pypdf import PdfReader
    import io
    b, _ = fill_official_form("pm_kisan", {"fullName": "Test Person", "state": "Tamil Nadu"})
    fields = PdfReader(io.BytesIO(b)).get_fields() or {}
    assert len(fields) >= 10
    assert fields["fullName"].get("/V") == "Test Person"
    assert fields["state"].get("/V") == "Tamil Nadu"
