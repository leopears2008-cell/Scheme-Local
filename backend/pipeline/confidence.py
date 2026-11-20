"""Retrieval confidence. Kept in its own module (no chromadb import) so the guardrails and their tests
do not depend on the vector store being installed."""
MAX_DISTANCE_CONFIDENT = 0.55


def retrieval_confidence(retrieved: list[dict]) -> float:
    """0..1 score from the best retrieval distances (lower distance = better)."""
    if not retrieved:
        return 0.0
    best = sorted(h.get("distance", 1.0) for h in retrieved)[:3]
    avg = sum(best) / len(best)
    return max(0.0, min(1.0, 1.0 - avg / (2 * MAX_DISTANCE_CONFIDENT)))
