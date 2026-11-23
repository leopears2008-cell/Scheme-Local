"""Scheme browse/search (TN scheme DB + central), bookmarks, and admin 'add a scheme'."""

import re
from fastapi import APIRouter, HTTPException, Query

import schemes_store as store

router = APIRouter(prefix="/api")

# Agriculture synonyms & related query terms
AGRI_TERMS = {
    "farmer", "farmers", "farming", "agriculture", "agricultural", "agri", "kisan", "krishi",
    "kisan-samman", "cultivator", "cultivators", "grower", "growers", "crop", "crops",
    "harvest", "uzhavar", "vivasaayam", "vivasayi", "விவசாயி", "விவசாயம்", "உழவர்",
    "fasal", "kheti"
}

SUBSIDY_TERMS = {
    "subsidy", "subsidies", "subsidised", "subsidized", "subvention", "assistance", "grant"
}

IRRIGATION_TERMS = {
    "irrigation", "drip", "sprinkler", "water", "pipeline", "borewell", "kudimaramathu", "pdmc"
}

FERTILIZER_TERMS = {
    "fertilizer", "fertilizers", "biofertilizer", "bio-fertilizer", "rhizobium", "manure", "npv", "seed", "seeds"
}

INSURANCE_TERMS = {
    "insurance", "bima", "fasal bima", "calamity", "relief", "pmfby"
}

STOPWORDS = {
    "scheme", "schemes", "for", "in", "of", "the", "and", "to", "all", "yojana", "thittam",
    "a", "an", "is", "on", "with", "by", "திட்டம்", "திட்டங்கள்", "योजना"
}


def _clean_text(text: str) -> str:
    """Normalize text by converting punctuation to spaces and lowercasing."""
    if not text:
        return ""
    cleaned = re.sub(r"[^\w\s\u0900-\u097F\u0B80-\u0BFF]", " ", str(text))
    return " ".join(cleaned.lower().split())


def _tokenize(text: str) -> list[str]:
    return _clean_text(text).split()


OFFICIAL_FORM_SCHEME_IDS = {
    "pm_kisan", "ration_card_nfsa", "pmay_urban", "pmay_gramin",
    "sukanya_samriddhi", "pmfby", "ayushman_bharat", "ujjwala",
    "atal_pension", "pm_mudra"
}


def _card(s: dict, lang: str) -> dict:
    s = store.localized(s, lang)
    has_form_fields = bool(s.get("form_fields"))          # read BEFORE the field is removed below
    s = {k: v for k, v in s.items() if k not in ("form_fields", "merged_from")}   # no internal fields to the public
    return {k: s.get(k) for k in (
        "scheme_id", "name", "category", "level", "state", "department", "benefit", "eligibility_rules",
        "eligibility_text", "exclusions", "documents_required", "how_to_apply", "source_url", "last_verified",
        "origin", "verification", "helpline", "emoji", "benefit_type", "estimated_benefit_inr")} | {
        "has_official_form": s.get("scheme_id") in OFFICIAL_FORM_SCHEME_IDS,
        "application_url": s.get("application_url"), "verification_status": s.get("verification_status"),
        "source_official": s.get("source_official", False), "source_warning": s.get("source_warning"),
        "verified_at": s.get("verified_at"), "review_expires_at": s.get("review_expires_at"),
        "has_form_fields": has_form_fields}


def _is_complete(s: dict) -> bool:
    return bool(s.get("benefit")) and bool(s.get("eligibility_rules")) and bool(s.get("documents_required")) and bool(s.get("source_official"))


def _score_scheme(
    s: dict,
    q_clean: str,
    tokens: list[str],
    content_tokens: list[str],
    is_agri: bool,
    is_sub: bool,
    is_irrig: bool,
    is_fert: bool,
    is_ins: bool
) -> float:
    score = 0.0

    name = s.get("name", "")
    name_clean = _clean_text(name)
    name_tokens = set(_tokenize(name))

    cat = s.get("category", "").lower()
    dept = _clean_text(s.get("department", ""))
    benefit = _clean_text(s.get("benefit", ""))
    elig = _clean_text(" ".join(s.get("eligibility_rules", [])) + " " + s.get("eligibility_text", ""))
    docs = _clean_text(" ".join(s.get("documents_required", [])))
    apply_text = _clean_text(s.get("how_to_apply", ""))
    state = _clean_text(s.get("state", ""))
    exclusions = _clean_text(" ".join(s.get("exclusions", [])))

    local_names = " ".join((s.get("name_local") or {}).values())
    for tr in (s.get("i18n") or {}).values():
        local_names += " " + " ".join(str(v) for v in tr.values())
    local_clean = _clean_text(local_names)

    # 1. Exact ID or Exact Name matches
    sid = s.get("scheme_id", "").lower().replace("_", "-")
    sid_compact = sid.replace("-", "")
    q_norm_id = q_clean.replace(" ", "-")
    q_compact = q_clean.replace(" ", "").replace("-", "").replace("_", "")
    if sid == q_norm_id or sid == q_clean.replace(" ", "_") or (len(q_compact) >= 4 and sid_compact == q_compact):
        score += 1500

    if q_clean == name_clean or (len(q_compact) >= 4 and q_compact == name_clean.replace(" ", "")):
        score += 1200
    elif q_clean in name_clean:
        score += 450

    # Acronyms and parenthetical short names (e.g. "PM-KISAN", "PMFBY", "KCC")
    for part in re.findall(r"\((.*?)\)", name):
        part_clean = _clean_text(part)
        if q_clean == part_clean or q_clean.replace(" ", "") == part_clean.replace(" ", ""):
            score += 1000
        elif q_clean in part_clean:
            score += 350

    # 2. Token matching in Name
    tokens_to_match = content_tokens if content_tokens else tokens
    if tokens_to_match:
        matched_name_tokens = sum(
            1 for t in tokens_to_match
            if any(t == nt or (len(t) >= 3 and nt.startswith(t)) or (len(nt) >= 4 and t.startswith(nt)) for nt in name_tokens)
        )
        if matched_name_tokens == len(tokens_to_match) and matched_name_tokens > 0:
            score += 250
        score += matched_name_tokens * 60

    # 3. Intent / Category recognition
    if is_agri:
        if cat == "agriculture":
            score += 130
            # Flagship national & state farmer welfare schemes
            if s.get("scheme_id") in ("pm_kisan", "pmfby", "kcc", "namo_shetkari", "tn_005", "tn_020"):
                score += 80
        elif "agri" in dept or "farmer" in dept:
            score += 60

    if is_sub:
        if any(term in benefit or term in name_clean for term in ("subsidy", "subsid", "assistance", "grant")):
            score += 80
        if any(term in elig for term in ("subsidy", "subsid")):
            score += 40

    if is_irrig:
        if any(term in name_clean or term in benefit or term in elig for term in ("irrigation", "drip", "sprinkler", "pipeline", "kudimaramathu", "pdmc")):
            score += 160

    if is_fert:
        if any(term in name_clean or term in benefit or term in elig for term in ("rhizobium", "fertilizer", "biofertilizer", "npv", "nutrient", "seed", "minikit")):
            score += 160

    if is_ins:
        if s.get("scheme_id") == "pmfby" or "pmfby" in name_clean:
            score += 450
        elif any(term in name_clean or term in benefit for term in ("insurance", "crop insurance", "fasal bima", "calamity")):
            score += 160

    # 4. Multi-token field coverage across official haystack
    haystack_fields = [
        (name_clean, 50),
        (local_clean, 40),
        (cat, 35),
        (dept, 25),
        (benefit, 30),
        (elig, 25),
        (docs, 20),
        (apply_text, 15),
        (state, 15),
        (exclusions, 10),
    ]

    matched_tokens_count = 0
    full_haystack = " ".join([f[0] for f in haystack_fields if f[0]])

    for t in tokens_to_match:
        token_found = False
        for field_text, weight in haystack_fields:
            if not field_text:
                continue
            if t in field_text:
                score += weight
                token_found = True
                break
            elif len(t) >= 3 and any(w.startswith(t) or (len(w) >= 4 and t.startswith(w)) for w in field_text.split()):
                score += weight * 0.7
                token_found = True
                break
        if token_found:
            matched_tokens_count += 1

    # Multi-token completeness bonus
    if tokens_to_match and matched_tokens_count == len(tokens_to_match) and matched_tokens_count > 0:
        score += 180

    return score


@router.get("/schemes/meta")
def meta():
    """Canonical metadata contract: counts live under 'verification' only."""
    if store.LOAD_ERROR:
        raise HTTPException(503, f"Scheme registry unavailable: {store.LOAD_ERROR}")
    if not store.SCHEMES:
        store.load_all()
        if store.LOAD_ERROR or not store.SCHEMES:
            raise HTTPException(503, f"Scheme registry unavailable: {store.LOAD_ERROR or 'No schemes loaded'}")

    S = store.SCHEMES.values()
    count = lambda key: {k: sum(1 for s in S if (s.get(key) or "central") == k) for k in sorted({(s.get(key) or "central") for s in S})}
    return {
        "total": len(store.SCHEMES),
        "categories": count("category"),
        "states": count("state"),
        "origins": count("origin"),
        "verification": {k: sum(1 for s in S if s.get("verification") == k) for k in ("verified", "needs_review", "expired", "unverified")}
    }


@router.get("/schemes")
def list_schemes(
    q: str = "",
    category: str = "",
    level: str = "",
    state: str = "",
    lang: str = "en",
    limit: int = Query(60, le=400),
    offset: int = 0
):
    if store.LOAD_ERROR:
        raise HTTPException(503, f"Scheme registry unavailable: {store.LOAD_ERROR}")
    if not store.SCHEMES:
        store.load_all()
        if store.LOAD_ERROR or not store.SCHEMES:
            raise HTTPException(503, f"Scheme registry unavailable: {store.LOAD_ERROR or 'No schemes loaded'}")

    q_raw = q.strip()
    q_clean = _clean_text(q_raw)
    tokens = _tokenize(q_raw)
    content_tokens = [t for t in tokens if t not in STOPWORDS]

    is_agri = any(t in AGRI_TERMS or (len(t) >= 4 and any(t.startswith(a) or a.startswith(t) for a in AGRI_TERMS)) for t in tokens)
    is_sub = any(t in SUBSIDY_TERMS for t in tokens)
    is_irrig = any(t in IRRIGATION_TERMS for t in tokens)
    is_fert = any(t in FERTILIZER_TERMS for t in tokens)
    is_ins = any(t in INSURANCE_TERMS for t in tokens)

    scored_items = []
    for s in store.SCHEMES.values():
        # 1. Filters
        if category and s.get("category") != category:
            continue
        if level and s.get("level") != level:
            continue
        if state:
            s_state = (s.get("state") or "").strip().lower()
            # Central schemes apply across India (including any filtered state)
            if s_state not in ("", "central", "all india", state.strip().lower()):
                continue

        # 2. Search scoring
        if q_clean:
            score = _score_scheme(
                s, q_clean, tokens, content_tokens,
                is_agri, is_sub, is_irrig, is_fert, is_ins
            )
            if score >= 30:  # Relevance threshold
                scored_items.append((score, s))
        else:
            scored_items.append((0.0, s))

    # 3. Relevance ranking
    # When searching with query: sort primarily by relevance score (descending)
    # Secondary order: verified status, data completeness, scheme name
    if q_clean:
        scored_items.sort(
            key=lambda item: (
                -item[0],
                item[1].get("verification") != "verified",
                not _is_complete(item[1]),
                item[1].get("name", "").lower()
            )
        )
    else:
        scored_items.sort(
            key=lambda item: (
                item[1].get("verification") != "verified",
                not _is_complete(item[1]),
                item[1].get("name", "").lower()
            )
        )

    limit_val = int(getattr(limit, "default", limit)) if not isinstance(limit, int) else limit
    offset_val = int(getattr(offset, "default", offset)) if not isinstance(offset, int) else offset
    if not isinstance(limit_val, int):
        limit_val = 60
    if not isinstance(offset_val, int):
        offset_val = 0

    out = [item[1] for item in scored_items]
    return {
        "total": len(out),
        "items": [_card(s, lang) for s in out[offset_val: offset_val + limit_val]]
    }


@router.get("/schemes/{scheme_id}")
def get_scheme(scheme_id: str, lang: str = "en"):
    s = store.SCHEMES.get(scheme_id)
    if not s:
        raise HTTPException(404, "Unknown scheme")
    form_fields = s.get("form_fields", []) if scheme_id in OFFICIAL_FORM_SCHEME_IDS or s.get("form_fields") else []
    return _card(s, lang) | {
        "form_fields": form_fields,
        "form_fields_note": "Field layout from the bundled official form. Check the current form on the official site."
    }



