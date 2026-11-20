"""
Day 1 - Retrieval sanity check.

Runs a few test queries against ChromaDB and prints the top matching chunks
with their scheme + source metadata. If these results look relevant, Day 1
is done and you're ready for the Day 2 agent pipeline.

Run:  python test_retrieval.py
Or:   python test_retrieval.py "your own question here"
"""

import sys

import chromadb
from chromadb.utils import embedding_functions

from config import CHROMA_DIR, COLLECTION_NAME, EMBEDDING_MODEL

DEFAULT_QUERIES = [
    "I am a farmer with 2 acres of land, what money can I get from the government?",
    "scholarship for daughter entering college",
    "what documents do I need for PM-Kisan?",
    "health insurance for poor family",
]


def main() -> None:
    embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    collection = client.get_collection(COLLECTION_NAME, embedding_function=embed_fn)

    queries = [" ".join(sys.argv[1:])] if len(sys.argv) > 1 else DEFAULT_QUERIES

    for q in queries:
        print("=" * 70)
        print(f"QUERY: {q}\n")
        results = collection.query(query_texts=[q], n_results=3)
        for doc, meta, dist in zip(
            results["documents"][0], results["metadatas"][0], results["distances"][0]
        ):
            print(f"  [{meta['scheme_id']}] ({meta['category']})  distance={dist:.3f}")
            print(f"  source: {meta['source']}")
            print(f"  {doc[:250]}...")
            print()


if __name__ == "__main__":
    main()
