"""
Day 1 - Ingestion script.

Reads:
  1. Hand-written scheme fact sheets (schemes/*.json)  <- always ingested
  2. Official scheme PDFs (data/pdfs/*.pdf)            <- optional but recommended

Chunks everything, embeds with bge-small-en, stores in ChromaDB with metadata
(scheme_id, category, source) so Day-2 matcher agents can filter by category.

Run:  python ingest.py
"""

import json
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions
from pypdf import PdfReader

from config import (
    CHROMA_DIR,
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    COLLECTION_NAME,
    EMBEDDING_MODEL,
    FACTSHEET_DIR,
    PDF_DIR,
)


# ---------------------------------------------------------------- chunking
def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Simple sliding-window chunker. Tries to break on sentence ends."""
    text = " ".join(text.split())  # normalize whitespace
    if len(text) <= size:
        return [text] if text else []

    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        if end < len(text):
            # try to end the chunk at a sentence boundary (look back up to 200 chars)
            best_break = text.rfind(". ", start + size - 200, end)
            if best_break != -1:
                end = best_break + 1
        chunks.append(text[start:end].strip())
        start = end - overlap
    return [c for c in chunks if len(c) > 50]  # drop tiny fragments


# ---------------------------------------------------------- fact sheet text
def normalize_factsheet(raw: dict) -> dict:
    """Bring legacy (name/benefit/eligibility_rules) and canonical (official_name/official_benefits) records into one shape.
    Uses the same normalisation as the live store so ingestion and the app agree on every field."""
    from schemes_store import legacy_to_row, row_to_scheme
    if "official_name" in raw and "name" not in raw:
        raw = {**raw, "name": raw["official_name"]}
    row = legacy_to_row(raw)
    return row_to_scheme({**row, "version": row.get("version", 1)})


def factsheet_to_text(fs: dict) -> str:
    """Flatten a normalised fact sheet into readable text for embedding. Missing optional fields are written
    as 'not listed' rather than raising, so one thin record cannot stop the whole ingestion run."""
    n = normalize_factsheet(fs) if "name" not in fs or "benefit" not in fs else fs
    name = n.get("name") or n.get("official_name") or "Unnamed scheme"
    rules = [r for r in (n.get("eligibility_rules") or []) if str(r).strip()]
    docs = [d for d in (n.get("documents_required") or []) if str(d).strip()]
    lines = [
        f"Scheme: {name}",
        f"Level: {n.get('level') or n.get('government_level') or 'central'}" + (f" ({n['state']})" if n.get("state") else ""),
        f"Category: {n.get('category') or 'other'}",
        f"Benefit: {n.get('benefit') or 'Not listed in the source record'}",
        "Eligibility rules: " + ("; ".join(rules) if rules else "Not listed in the source record"),
        "Exclusions (NOT eligible): " + ("; ".join(n.get("exclusions") or []) or "None listed"),
        "Documents required: " + ("; ".join(docs) if docs else "Not listed in the source record"),
        f"How to apply: {n.get('how_to_apply') or 'Not listed in the source record'}",
    ]
    return "\n".join(lines)


# ------------------------------------------------------------------- main
def main() -> None:
    # 1. Set up ChromaDB with local bge-small-en embeddings
    embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))

    # start fresh each run so re-ingestion never duplicates
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    collection = client.create_collection(COLLECTION_NAME, embedding_function=embed_fn)

    docs, metadatas, ids = [], [], []

    # 2. Ingest fact sheets (ground truth, highest quality chunks)
    factsheets = sorted(FACTSHEET_DIR.glob("*.json"))
    print(f"Found {len(factsheets)} fact sheets in {FACTSHEET_DIR}")
    valid_factsheets = []
    seen_ids: set[str] = set()
    skipped = 0
    for path in factsheets:
        try:
            fs = json.loads(path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as e:
            print(f"  SKIP {path.name}: invalid JSON - {e}")
            continue
        try:
            fs = normalize_factsheet(fs)
            text = factsheet_to_text(fs)
            if not fs.get("scheme_id") or not fs.get("name"):
                raise ValueError("missing scheme_id or name")
        except (KeyError, TypeError, ValueError) as e:
            # log the file and reason only; never print record contents (may contain personal data)
            print(f"  SKIP {path.name}: malformed record ({type(e).__name__})")
            skipped += 1
            continue
        if fs["scheme_id"] in seen_ids:
            print(f"  SKIP {path.name}: duplicate scheme_id {fs['scheme_id']}")
            skipped += 1
            continue
        seen_ids.add(fs["scheme_id"])
        valid_factsheets.append((path, fs))
        for i, chunk in enumerate(chunk_text(text)):
            docs.append(chunk)
            metadatas.append(
                {
                    "scheme_id": fs["scheme_id"],
                    "scheme_name": fs["name"],
                    "category": fs.get("category") or "other",
                    "source": f"factsheet:{path.name}",
                    "source_url": fs.get("source_url", ""),
                    "doc_type": "factsheet",
                    "state_scope": (fs.get("state") or "central").strip().lower() if fs.get("level") == "state" else "central",
                    "verification": fs.get("verification", "imported"),
                }
            )
            ids.append(f"{fs['scheme_id']}_fs_{i}")

    # 3. Ingest official PDFs (richer detail; filename must start with scheme_id)
    #    e.g. data/pdfs/pm_kisan_guidelines.pdf  -> scheme_id "pm_kisan"
    known_ids = {fs["scheme_id"]: fs["category"] for _, fs in valid_factsheets}
    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    print(f"Found {len(pdfs)} PDFs in {PDF_DIR}")
    for pdf_path in pdfs:
        scheme_id = next((sid for sid in known_ids if pdf_path.name.startswith(sid)), None)
        if scheme_id is None:
            print(f"  SKIP {pdf_path.name}: filename doesn't start with any known scheme_id")
            continue
        try:
            reader = PdfReader(str(pdf_path))
            full_text = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as e:
            print(f"  SKIP {pdf_path.name}: could not read ({e})")
            continue

        for i, chunk in enumerate(chunk_text(full_text)):
            docs.append(chunk)
            metadatas.append(
                {
                    "scheme_id": scheme_id,
                    "scheme_name": scheme_id,
                    "category": known_ids[scheme_id],
                    "source": f"pdf:{pdf_path.name}",
                    "source_url": "",
                    "doc_type": "official_pdf",
                }
            )
            ids.append(f"{scheme_id}_pdf_{i}")
        print(f"  OK   {pdf_path.name} -> scheme {scheme_id}")

    # 4. Write to ChromaDB in batches (Chroma has a max batch size)
    if not docs:
        print("Nothing to ingest. Add fact sheets to schemes/ first.")
        return

    BATCH = 500
    for start in range(0, len(docs), BATCH):
        collection.add(
            documents=docs[start : start + BATCH],
            metadatas=metadatas[start : start + BATCH],
            ids=ids[start : start + BATCH],
        )

    print(f"\nDone. Ingested {len(docs)} chunks into '{COLLECTION_NAME}' at {CHROMA_DIR}")
    print("Next: run  python test_retrieval.py  to sanity-check search quality.")


if __name__ == "__main__":
    main()
