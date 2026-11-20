"""Repairs 3.1 (guardrail IDs after load) and 3.2 (ingestion of legacy + canonical records).
Synthetic data only. Ingestion uses a deterministic stand-in embedding so no model download is needed."""
import json
import shutil
from pathlib import Path

import pytest

import schemes_store as st
import pipeline.guardrails as g


# ----------------------------------------------------------- 3.1 guardrail IDs
def test_store_refresh_updates_guardrail_ids(client):
    st.SCHEMES.clear(); g.KNOWN_SCHEMES.clear()
    assert len(g.KNOWN_SCHEMES) == 0
    st.load_all()
    assert "pm_kisan" in g.KNOWN_SCHEMES and len(g.KNOWN_SCHEMES) == len(st.SCHEMES) > 0


def test_refresh_one_adds_new_scheme_to_guardrails(client):
    row = {"scheme_id": "zz_new_test", "official_name": "New Test Scheme", "government_level": "central",
           "category": "other", "official_source_url": "https://example.gov.in", "verification_status": "unverified",
           "extra": {}, "version": 1}
    st.refresh_one(row)
    assert "zz_new_test" in g.KNOWN_SCHEMES


def test_invalid_scheme_id_still_rejected_after_load(client):
    st.load_all()
    assert "made_up_scheme_9" not in g.KNOWN_SCHEMES


def test_valid_scheme_card_survives_guardrails(client):
    st.load_all()
    res = {"language": "english",
           "retrieved": [{"scheme_id": "pm_kisan", "text": "PM-KISAN Rs 6000 landholding", "status": "needs_review", "source": "x"}],
           "verdicts": [{"scheme_id": "pm_kisan", "verdict": "POSSIBLE_MATCH", "why": "ok", "evidence_quote": None}],
           "answer_text": "Here is a scheme.", "follow_up_question": None}
    out = g.apply_output_rails(res)
    assert [v["scheme_id"] for v in out["verdicts"]] == ["pm_kisan"]


def test_invalid_scheme_card_dropped_after_load(client):
    st.load_all()
    res = {"language": "english", "retrieved": [{"scheme_id": "pm_kisan", "text": "t", "status": "needs_review", "source": "x"}],
           "verdicts": [{"scheme_id": "made_up_scheme_9", "verdict": "ELIGIBLE", "why": "ok"}],
           "answer_text": "a", "follow_up_question": None}
    assert g.apply_output_rails(res)["verdicts"] == []


# ----------------------------------------------------------- 3.2 ingestion
REGISTER_RECORD = {  # legacy TN register shape: official_name, no 'name'/'benefit'
    "scheme_id": "tn_reg_tn_001", "official_name": "National Horticulture Mission (NHM)", "government_level": "state",
    "state": "Tamil Nadu", "department": "Agriculture", "category": "agriculture", "official_eligibility": [],
    "official_benefits": "", "documents": [], "how_to_apply": "", "official_source_url": "https://www.tnhorticulture.tn.gov.in/x",
    "verification_status": "unverified", "extra": {}, "version": 1,
}


def test_register_record_text_builds_without_keyerror():
    pytest.importorskip("chromadb", reason="needs chromadb (requirements.txt)")
    import ingest
    text = ingest.factsheet_to_text(REGISTER_RECORD)
    assert "National Horticulture Mission" in text and "Not listed in the source record" in text


def test_canonical_record_text_contains_benefit():
    pytest.importorskip("chromadb", reason="needs chromadb (requirements.txt)")
    import ingest
    canon = {"scheme_id": "x_canon", "name": "Canon Scheme", "category": "education", "level": "central", "benefit": "Rs 1000 a year",
             "eligibility_rules": ["Student"], "documents_required": ["Marksheet"], "how_to_apply": "Apply online", "source_url": "https://a.gov.in"}
    text = ingest.factsheet_to_text(canon)
    assert "Rs 1000 a year" in text and "Student" in text and "Marksheet" in text


def test_missing_optional_fields_do_not_crash():
    pytest.importorskip("chromadb", reason="needs chromadb (requirements.txt)")
    import ingest
    assert "Scheme: Bare" in ingest.factsheet_to_text({"scheme_id": "bare", "name": "Bare"})


def test_normalize_is_idempotent_for_canonical_records():
    pytest.importorskip("chromadb", reason="needs chromadb (requirements.txt)")
    import ingest
    once = ingest.normalize_factsheet(REGISTER_RECORD)
    twice = ingest.normalize_factsheet(once)
    assert once["scheme_id"] == twice["scheme_id"] and once["name"] == twice["name"]


class _StubEmbed:
    """Deterministic stand-in so ingestion runs without downloading a model. Tests only; not used in the app."""
    def __init__(self, *a, **k):
        pass

    def __call__(self, input):
        return [[float(sum(map(ord, t)) % 97), float(len(t) % 89), 1.0, 0.5] for t in input]

    def name(self):
        return "stub"


def test_full_ingestion_run_and_retrieval(tmp_path, monkeypatch):
    pytest.importorskip("chromadb", reason="needs chromadb (requirements.txt)")
    """Full ingest.main() over a temp folder with legacy + canonical + malformed + duplicate records."""
    import ingest
    import chromadb
    from chromadb.api.types import EmbeddingFunction
    folder = tmp_path / "schemes"; folder.mkdir()
    (folder / "a_legacy.json").write_text(json.dumps(REGISTER_RECORD), encoding="utf-8")
    (folder / "b_canon.json").write_text(json.dumps({"scheme_id": "canon_1", "name": "Canon One", "category": "education",
                                                     "level": "central", "benefit": "Scholarship Rs 5000", "eligibility_rules": ["Student"],
                                                     "documents_required": [], "how_to_apply": "Online", "source_url": "https://x.gov.in"}), encoding="utf-8")
    (folder / "c_broken.json").write_text("{not json", encoding="utf-8")
    (folder / "d_dup.json").write_text(json.dumps({**REGISTER_RECORD, "official_name": "Dup copy"}), encoding="utf-8")
    (folder / "e_noname.json").write_text(json.dumps({"scheme_id": "no_name"}), encoding="utf-8")
    chroma = tmp_path / "chroma"
    monkeypatch.setattr(ingest, "FACTSHEET_DIR", folder)
    monkeypatch.setattr(ingest, "CHROMA_DIR", chroma)
    monkeypatch.setattr(ingest.embedding_functions, "SentenceTransformerEmbeddingFunction", _StubEmbed)
    ingest.main()   # must complete without raising
    coll = chromadb.PersistentClient(path=str(chroma)).get_collection(ingest.COLLECTION_NAME, embedding_function=_StubEmbed())
    ids = set(coll.get(include=["metadatas"])["metadatas"][i]["scheme_id"] for i in range(len(coll.get()["ids"])))
    assert "tn_reg_tn_001" in ids and "canon_1" in ids
    assert "no_name" not in ids                 # malformed record skipped
    assert coll.count() >= 2
    shutil.rmtree(chroma, ignore_errors=True)
