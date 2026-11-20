"""Repairs for Phases 3–5: source flags, metadata contract, verification states, eligibility units,
session isolation, chat-log privacy. Synthetic data only."""
import pytest

import schemes_store as st
from conftest import hdr, mint
from services.units import parse_land_hectares, parse_money, extract_money
from services.eligibility import match_all, normalize, _check_rules, _check_ops
from pipeline.grounding import ground_answer


# ---- 4.1 source flags: official domains (incl. subdomains) pass; lookalikes and commercial sites do not
@pytest.mark.parametrize("url,expected", [
    ("https://pmkisan.gov.in/", True),
    ("https://www.tnhorticulture.tn.gov.in/x", True),
    ("https://tn.nic.in/", True),
    ("https://evilgov.in/", False),                 # lookalike: not a .gov.in subdomain
    ("https://pmkisan.gov.in.evil.example/", False),
    ("https://www.acko.com/x.pdf", False),
    ("", False), (None, False), ("not a url", False),
])
def test_official_host_check(url, expected):
    assert st.is_official_host(url) is expected


def test_eligibility_results_carry_source_flags(client):
    r = client.post("/api/eligibility", json={"profile": {"age": 30}, "limit": 500}).json()   # default page is 150
    pm = next(x for x in r["results"] if x["scheme_id"] == "pm_kisan")
    assert pm["source_official"] is True and pm["source_warning"] is None


def test_non_official_scheme_in_eligibility_has_warning(client):
    st.SCHEMES["zz_commercial"] = {**st.SCHEMES["pm_kisan"], "scheme_id": "zz_commercial", "source_url": "https://www.acko.com/x", "source_official": False,
                                    "source_warning": "The listed source is not a government website. Confirm the rules on an official government source."}
    r = match_all({"age": 30})
    z = next(x for x in r if x["scheme_id"] == "zz_commercial")
    assert z["source_official"] is False and "not a government website" in z["source_warning"]
    del st.SCHEMES["zz_commercial"]


# ---- 4.2 one metadata contract: counts under 'verification' only
def test_meta_contract(client):
    m = client.get("/api/schemes/meta").json()
    assert "verification" in m and set(m["verification"]) == {"verified", "needs_review", "unverified", "expired"}
    assert "verified" not in m          # the old top-level key is gone


# ---- 4.4 canonical verification states
@pytest.mark.parametrize("raw,expected", [
    ("verified", "verified"), ("needs_review", "needs_review"), ("unverified", "unverified"), ("expired", "expired"),
    ("hand_verified", "unverified"), ("VERIFIED", "unverified"), ("", "unverified"), (None, "unverified"), ("garbage", "unverified"),
])
def test_status_is_canonical_and_never_promoted(raw, expected):
    row = {"verification_status": raw} if raw is not None else {}
    assert st.effective_status(row) == expected


def test_verified_with_expired_review_becomes_expired():
    assert st.effective_status({"verification_status": "verified", "review_expires_at": "2001-01-01"}) == "expired"


# ---- 5.1 land units: acres converted, hectares as-is, unit never guessed
@pytest.mark.parametrize("value,hint,expected_ha", [
    ("1 acre", None, 0.404686), ("2 acres", None, 0.809372), ("4 acres", None, 1.618744),
    ("0.5 acre", None, 0.202343), ("1.5 acres", None, 0.607029),
    ("2 ha", None, 2.0), ("0.75 hectares", None, 0.75),
    ("0 acres", None, 0.0), ("3", "acre", 1.214058),
])
def test_land_conversion(value, hint, expected_ha):
    ha, note = parse_land_hectares(value, hint)
    assert ha == pytest.approx(expected_ha, rel=1e-4), note


@pytest.mark.parametrize("value", ["2", "10", "abc", ""])
def test_missing_or_unclear_land_unit_is_unknown_not_assumed(value):
    ha, note = parse_land_hectares(value, None)
    assert ha is None and note


def test_four_acres_passes_a_two_hectare_cap():
    """Regression: '4 acres' used to be read as 4 hectares and failed a 2 ha cap."""
    assert _check_rules({"maxLandHectares": 2}, normalize({"landHectares": "4 acres"}))[0]["status"] == "pass"


def test_ten_acres_fails_a_two_hectare_cap():
    assert _check_rules({"maxLandHectares": 2}, normalize({"landHectares": "10 acres"}))[0]["status"] == "fail"


def test_land_detail_explains_conversion():
    c = _check_rules({"maxLandHectares": 2}, normalize({"landHectares": "4 acres"}))[0]
    assert "1.619 ha" in c["detail"]


# ---- 5.2 exact token matching (no substring false positives)
@pytest.mark.parametrize("answer,rule,expected", [
    ("student", ["st"], "fail"), ("female", ["male"], "fail"), ("male", ["male"], "pass"),
    ("Student", ["student"], "pass"), ("  farmer  ", ["farmer"], "pass"), ("Farmer", ["FARMER"], "pass"),
])
def test_in_operator_is_exact(answer, rule, expected):
    c = _check_ops([{"field": "occupation", "op": "in", "value": rule, "label": "x"}], normalize({"occupation": answer}))
    assert c[0]["status"] == expected


def test_unrecognised_occupation_never_passes_a_rule():
    assert _check_rules({"occupation": ["farmer"]}, normalize({"occupation": "xyzzy"}))[0]["status"] == "unknown"


# ---- 5.3 money and grounding
@pytest.mark.parametrize("value,expected", [
    ("1,000", 1000), ("₹1,000", 1000), ("2,50,000", 250000), ("2.5 lakh", 250000), ("5 lakh", 500000),
    ("1 crore", 10_000_000), ("1.2 crore", 12_000_000), ("Rs 6,000", 6000), ("lots", None), ("", None),
])
def test_money_parsing(value, expected):
    assert parse_money(value) == expected


def test_extract_money_finds_lakh_and_crore_in_text():
    assert extract_money("pays 2.5 lakh or Rs 6,000; fund 1.2 crore") == [250000, 6000, 12_000_000]


def test_grounding_accepts_equivalent_amount_formats():
    _, problems = ground_answer("It pays 2.5 lakh a year.", "Benefit Rs 2,50,000 per year", {"https://x.gov.in"})
    assert problems == []


def test_grounding_flags_invented_lakh_amount():
    _, problems = ground_answer("It pays 9 lakh a year.", "Benefit Rs 2,50,000 per year", {"https://x.gov.in"})
    assert "unsupported_amount" in problems


def test_grounding_flags_invented_crore_amount():
    _, problems = ground_answer("A fund of 3 crore.", "Benefit Rs 2,50,000 per year", {"https://x.gov.in"})
    assert "unsupported_amount" in problems


# ---- 6.2 session isolation
def _ask(client, token, session_id, message="hello farmer scheme"):
    return client.post("/api/ask", headers=hdr(token), json={"message": message, "session_id": session_id})


def test_same_session_id_is_isolated_between_users(client, citizen, other, monkeypatch):
    import routers.chat as chat
    chat.SESSIONS.clear()
    sid = "shared-session-id-1"
    chat.SESSIONS[chat._key(citizen.__class__ and "11111111-1111-1111-1111-111111111111", sid)] = {"touched": 1e12, "profile": {"state": "Kerala"}}
    k_other = chat._key("22222222-2222-2222-2222-222222222222", sid)
    assert k_other not in chat.SESSIONS                     # other user's key is separate
    assert chat._key("11111111-1111-1111-1111-111111111111", sid) != k_other


def test_session_key_is_hashed_not_raw(client):
    import routers.chat as chat
    k = chat._key("11111111-1111-1111-1111-111111111111", "rawsessionid123")
    assert "rawsessionid123" not in k and len(k) == 64


def test_clear_session_only_removes_own(client, citizen, other):
    import routers.chat as chat
    chat.SESSIONS.clear()
    chat.SESSIONS[chat._key("22222222-2222-2222-2222-222222222222", "abcdefgh1")] = {"touched": 1e12, "profile": {"a": 1}}
    r = client.delete("/api/ask/session/abcdefgh1", headers=hdr(citizen))
    assert r.json()["cleared"] is False
    assert chat._key("22222222-2222-2222-2222-222222222222", "abcdefgh1") in chat.SESSIONS   # other user's memory intact


def test_expired_sessions_are_purged():
    import routers.chat as chat
    chat.SESSIONS.clear()
    chat.SESSIONS["old"] = {"touched": 0, "profile": {}}
    chat.SESSIONS["new"] = {"touched": 1e12, "profile": {}}
    chat._purge_expired()
    assert "old" not in chat.SESSIONS and "new" in chat.SESSIONS


def test_invalid_session_id_rejected(client, citizen):
    assert _ask(client, citizen, "x").status_code == 422          # too short
    assert _ask(client, citizen, "bad id with spaces!!").status_code == 422


# ---- 6.1 chat logging privacy
def test_raw_message_not_logged_when_disabled(client, citizen, tmp_path, monkeypatch):
    pytest.importorskip("chromadb", reason="needs chromadb (requirements.txt)")
    import routers.chat as chat, config
    monkeypatch.setattr(config, "LOG_CHAT_TEXT", False)
    log = tmp_path / "traces.jsonl"
    monkeypatch.setattr(chat, "TRACE_LOG", log)
    _ask(client, citizen, "abcdefgh-session", message="My Aadhaar is 2345 6789 0124 and phone +919876543210")
    text = log.read_text(encoding="utf-8")
    assert "2345 6789 0124" not in text and "+919876543210" not in text and "My Aadhaar" not in text
    assert "message_sha256" in text


def test_redacted_text_logged_only_when_explicitly_enabled(client, citizen, tmp_path, monkeypatch):
    pytest.importorskip("chromadb", reason="needs chromadb (requirements.txt)")
    import routers.chat as chat, config
    monkeypatch.setattr(config, "LOG_CHAT_TEXT", True)
    log = tmp_path / "traces.jsonl"
    monkeypatch.setattr(chat, "TRACE_LOG", log)
    _ask(client, citizen, "abcdefgh-session2", message="phone +919876543210 help")
    text = log.read_text(encoding="utf-8")
    assert "+919876543210" not in text           # still redacted even when text logging is on


def test_trace_contains_no_user_id(client, citizen, tmp_path, monkeypatch):
    pytest.importorskip("chromadb", reason="needs chromadb (requirements.txt)")
    import routers.chat as chat
    log = tmp_path / "traces.jsonl"
    monkeypatch.setattr(chat, "TRACE_LOG", log)
    _ask(client, citizen, "abcdefgh-session3")
    assert citizen.split(".")[1] not in log.read_text(encoding="utf-8")
