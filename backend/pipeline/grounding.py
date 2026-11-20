"""Deterministic grounding checks on the final answer text.

The LLM can still invent details. These checks run AFTER generation and never trust the model:
  * every URL in the answer must be one of the official URLs stored for a retrieved scheme;
  * every rupee amount in the answer must appear in the retrieved scheme record text;
  * unsupported items are REMOVED (links) or FLAGGED (amounts), and the user is told to check the official source.
This is a consistency check, not proof of official accuracy."""
import re

URL_RX = re.compile(r"https?://[^\s)\]>\"']+", re.I)

NOTE_LINK = "[link removed - check the official source shown on the scheme card]"
NOTE_AMOUNT = ("Some figures in this answer could not be matched to the scheme record. "
               "Please check the official source before relying on them.")


from services.units import extract_money


def _same_amount(a: float, b: float) -> bool:
    return abs(a - b) <= max(1.0, 0.005 * max(abs(a), abs(b)))   # equal to within rounding


def allowed_urls(retrieved: list[dict], scheme_urls: dict[str, list[str]]) -> set[str]:
    out = set()
    for h in retrieved:
        for u in scheme_urls.get(h.get("scheme_id", ""), []):
            if u:
                out.add(u.rstrip("/").lower())
    return out


def ground_answer(answer: str, evidence_text: str, allowed: set[str]) -> tuple[str, list[str]]:
    """Returns (cleaned_answer, problems). Problems are human-readable codes for logs/tests."""
    problems = []
    cleaned = answer or ""

    def _url(m):
        u = m.group(0).rstrip(".,;:").rstrip("/").lower()
        if u in allowed:
            return m.group(0)
        problems.append("unsupported_url")
        return NOTE_LINK
    cleaned = URL_RX.sub(_url, cleaned)

    evidence_amounts = extract_money(evidence_text or "")
    for amount in extract_money(cleaned):
        if not any(_same_amount(amount, e) for e in evidence_amounts):
            problems.append("unsupported_amount")
            cleaned = cleaned + "\n\n" + NOTE_AMOUNT
            break
    return cleaned, problems
