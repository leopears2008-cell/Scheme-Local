"""Consolidated documents checklist built from ELIGIBLE verdicts."""


def _normalize(doc: str) -> str:
    return doc.strip().lower()


def build_checklist(verdicts: list, factsheets: dict) -> dict:
    """Collect documents_required across ELIGIBLE schemes, splitting out the
    documents common to every eligible scheme from each scheme's own extras."""
    eligible_ids = [
        v["scheme_id"]
        for v in verdicts
        if v.get("verdict") == "ELIGIBLE" and v.get("scheme_id") in factsheets
    ]

    if not eligible_ids:
        return {"common": [], "per_scheme": {}, "how_to_apply": {}}

    # scheme_id -> {normalized_doc: original_doc}, de-duplicated, order preserved
    per_scheme_docs: dict[str, dict[str, str]] = {}
    for sid in eligible_ids:
        docs = factsheets[sid].get("documents_required", []) or []
        seen: dict[str, str] = {}
        for d in docs:
            norm = _normalize(d)
            if norm not in seen:
                seen[norm] = d
        per_scheme_docs[sid] = seen

    if len(eligible_ids) == 1:
        sid = eligible_ids[0]
        name = factsheets[sid].get("name", sid)
        return {
            "common": [],
            "per_scheme": {name: list(per_scheme_docs[sid].values())},
            "how_to_apply": {name: factsheets[sid].get("how_to_apply", "")},
        }

    common_norm = set.intersection(*(set(d.keys()) for d in per_scheme_docs.values()))

    common: list[str] = []
    for norm, original in per_scheme_docs[eligible_ids[0]].items():
        if norm in common_norm:
            common.append(original)

    per_scheme: dict[str, list[str]] = {}
    how_to_apply: dict[str, str] = {}
    for sid in eligible_ids:
        name = factsheets[sid].get("name", sid)
        per_scheme[name] = [
            original
            for norm, original in per_scheme_docs[sid].items()
            if norm not in common_norm
        ]
        how_to_apply[name] = factsheets[sid].get("how_to_apply", "")

    return {"common": common, "per_scheme": per_scheme, "how_to_apply": how_to_apply}
