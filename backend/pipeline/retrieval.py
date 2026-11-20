"""Retrieval for the scheme assistant.

Two modes, chosen per process:
  * "chroma": ChromaDB vector index, used only when the index folder exists AND chromadb and
    sentence-transformers are installed (needs PyTorch, which does not fit a 512 MB server).
  * "tfidf_fallback": TF-IDF over the live scheme store, built in memory with scikit-learn.
    No PyTorch, no index folder. Keyword matching only: Tamil or Hinglish queries will not match English text
    well, so answers for them are weaker and say so through the low-confidence note.

Both modes return the same shape: (document_text, metadata, distance) with distance = 1 - similarity,
so retrieval_confidence() works for either.
"""
import hashlib
import importlib.util
import logging
import threading

import numpy as np

import config
from schemes_store import SCHEMES

log = logging.getLogger("retrieval")
RICH_BONUS = 0.05          # ranks complete records ahead of placeholders with equal relevance
PLACEHOLDER_PENALTY = 0.10


def retrieval_mode() -> str:
    """'chroma' only when the vector index exists and its packages are installed. Never imports torch."""
    if not config.CHROMA_DIR.exists():
        return "tfidf_fallback"
    try:
        if importlib.util.find_spec("chromadb") and importlib.util.find_spec("sentence_transformers"):
            return "chroma"
    except (ValueError, ImportError):   # a package is blocked in sys.modules
        pass
    return "tfidf_fallback"


def is_rich(s: dict) -> bool:
    """A complete, official-source record: benefit, eligibility, documents, and a government source."""
    return bool(s.get("benefit")) and bool(s.get("eligibility_rules")) and bool(s.get("documents_required")) and bool(s.get("source_official"))


def _doc_text(s: dict) -> str:
    parts = [s.get("name", ""), " ".join((s.get("name_local") or {}).values()), s.get("benefit", ""),
             " ".join(s.get("eligibility_rules") or []), " ".join(s.get("documents_required") or []),
             s.get("department", ""), s.get("category", ""), s.get("state", ""), s.get("how_to_apply", "")]
    return " ".join(p for p in parts if p).strip()


class TfidfIndex:
    """Thread-safe. LangGraph runs matchers in parallel threads, so a rebuild must never be visible half-finished:
    the whole index is built under a lock and published as one immutable snapshot."""

    def __init__(self):
        self._lock = threading.Lock()
        self._state = None   # (key, vectorizer, matrix, docs, metas) or None

    def _ensure(self):
        live = {sid: s for sid, s in SCHEMES.items() if s.get("verification") != "expired"}
        items = sorted(live.items())
        texts = [_doc_text(s) for _, s in items]
        key = hashlib.sha256("\x1f".join(f"{sid}\x1e{t}" for (sid, _), t in zip(items, texts)).encode("utf-8")).hexdigest()
        state = self._state
        if state is not None and state[0] == key:
            return state
        with self._lock:
            state = self._state
            if state is not None and state[0] == key:    # another thread built it while we waited
                return state
            from sklearn.feature_extraction.text import TfidfVectorizer
            docs, metas = [], []
            for (sid, s), text in zip(items, texts):
                scope = "central" if s.get("level", "central") == "central" else (s.get("state") or "").strip().lower()
                docs.append(text)
                metas.append({"scheme_id": sid, "scheme_name": s.get("name", sid), "category": s.get("category", "other"),
                              "source": f"factsheet:{sid}.json", "source_url": s.get("source_url", ""),
                              "state_scope": scope or "central", "rich": is_rich(s)})
            vec, mat = None, None
            if docs and any(t.strip() for t in docs):
                vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english", min_df=1)
                mat = vec.fit_transform(docs)          # fully fitted before it is published below
            state = (key, vec, mat, docs, metas)
            self._state = state                       # single assignment: readers see old or new, never half
            log.info("tfidf index built: %d schemes", len(docs))
            return state

    def query(self, text: str, categories: list[str], user_state: str, k: int) -> list[dict]:
        _, vec, mat, docs, metas = self._ensure()
        if vec is None or not (text or "").strip():
            return []
        sims = (mat @ vec.transform([text]).T).toarray().ravel()
        out = []
        for i in np.argsort(-sims):
            sim = float(sims[i])
            if sim <= 0:
                break               # no shared words at all: never a match
            m = metas[i]
            if categories and m["category"] not in categories:
                continue
            if user_state and m["state_scope"] not in ("central", user_state):
                continue
            dist = 1.0 - sim - (RICH_BONUS if m["rich"] else -PLACEHOLDER_PENALTY)
            out.append({"doc": docs[i], "meta": m, "dist": max(0.0, round(dist, 4))})
            if len(out) >= k:
                break
        return out


TFIDF = TfidfIndex()
