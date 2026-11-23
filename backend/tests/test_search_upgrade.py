"""Comprehensive automated test suite for upgraded scheme search."""
import pytest
from fastapi import HTTPException
from repo import MemoryRepo, set_repo
import schemes_store as store
from routers.schemes import list_schemes, get_scheme, meta


@pytest.fixture(autouse=True)
def setup_store():
    set_repo(MemoryRepo())
    store.load_all()
    yield
    set_repo(None)


def test_pm_kisan_exact_matching():
    """Test exact PM-KISAN matching."""
    res = list_schemes(q="PM-KISAN")
    assert res["total"] >= 1
    assert res["items"][0]["scheme_id"] == "pm_kisan"
    assert "PM-KISAN" in res["items"][0]["name"]


def test_pm_kisan_punctuation_variations():
    """Test punctuation variations of PM Kisan match correctly."""
    variations = ["PM Kisan", "pm-kisan", "pmkisan", "PM Kisan Samman Nidhi", "pm_kisan"]
    for q in variations:
        res = list_schemes(q=q)
        assert res["total"] >= 1, f"Failed for variation: {q}"
        assert res["items"][0]["scheme_id"] == "pm_kisan", f"Expected pm_kisan as top result for {q}"


def test_farmer_schemes():
    """Broad farmer-related queries must return relevant farmer schemes."""
    queries = ["farmer", "farmers", "farming", "farmer schemes", "schemes for farmers", "farming support"]
    for q in queries:
        res = list_schemes(q=q)
        assert res["total"] >= 10, f"Expected at least 10 results for {q}"
        # Ensure agriculture schemes are prominent in top results
        top_cats = [it["category"] for it in res["items"][:5]]
        assert "agriculture" in top_cats, f"Expected agriculture schemes in top 5 for {q}"


def test_agriculture_intent():
    """Test queries with agriculture intent."""
    for q in ["agriculture", "agricultural schemes", "agricultural subsidy"]:
        res = list_schemes(q=q)
        assert res["total"] >= 5, f"Expected results for {q}"
        assert any(it["category"] == "agriculture" for it in res["items"][:3])


def test_crop_insurance():
    """Test crop insurance queries return PMFBY at the top."""
    res = list_schemes(q="crop insurance")
    assert res["total"] >= 1
    assert res["items"][0]["scheme_id"] == "pmfby"
    assert "Crop Insurance" in res["items"][0]["name"]


def test_subsidy_queries():
    """Test subsidy-related queries."""
    res = list_schemes(q="farming subsidy")
    assert res["total"] >= 5
    top_schemes = [it["name"].lower() for it in res["items"][:5]]
    assert any("subsidy" in s or "subsid" in s or "insurance" in s or "farming" in s for s in top_schemes)


def test_irrigation_and_fertilizer_subsidy():
    """Test irrigation subsidy and fertilizer subsidy return relevant schemes."""
    irrig_res = list_schemes(q="irrigation subsidy")
    assert irrig_res["total"] >= 1
    top_irrig = irrig_res["items"][0]
    assert "irrigation" in top_irrig["name"].lower() or "irrigation" in top_irrig["benefit"].lower()

    fert_res = list_schemes(q="fertilizer subsidy")
    assert fert_res["total"] >= 1
    fert_top = fert_res["items"][0]
    assert any(term in (fert_top["name"] + fert_top["benefit"]).lower() for term in ("rhizobium", "seed", "fertilizer", "nutrient"))


def test_partial_word_queries():
    """Partial word queries (e.g. 'farm', 'agri', 'subsid') must match appropriately."""
    for q in ["farm", "agri", "subsid", "insur"]:
        res = list_schemes(q=q)
        assert res["total"] >= 5, f"Expected partial matches for {q}"


def test_empty_query_returns_all_schemes():
    """Empty query string returns all schemes."""
    res = list_schemes(q="")
    assert res["total"] == len(store.SCHEMES)
    assert res["total"] >= 400


def test_no_matching_results():
    """Nonsense query must return 0 results without errors."""
    res = list_schemes(q="xyzrandomnonexistentquery12345")
    assert res["total"] == 0
    assert res["items"] == []


def test_category_filtering():
    """Category filter returns only schemes in that category."""
    res = list_schemes(category="agriculture")
    assert res["total"] >= 50
    assert all(it["category"] == "agriculture" for it in res["items"])


def test_tamil_nadu_filtering():
    """State filtering for Tamil Nadu returns central and Tamil Nadu schemes."""
    res = list_schemes(state="Tamil Nadu")
    assert res["total"] >= 100
    for it in res["items"]:
        st = (it.get("state") or "").lower()
        assert st in ("", "central", "all india", "tamil nadu")


def test_combined_filters():
    """Combined search query and filters."""
    res = list_schemes(q="subsidy", category="agriculture", state="Tamil Nadu")
    assert res["total"] >= 1
    assert all(it["category"] == "agriculture" for it in res["items"])
    for it in res["items"]:
        st = (it.get("state") or "").lower()
        assert st in ("", "central", "all india", "tamil nadu")


def test_search_ranking_exact_over_weak():
    """Exact scheme name match must rank higher than weak keyword matches."""
    res = list_schemes(q="PM-KISAN")
    assert res["items"][0]["scheme_id"] == "pm_kisan"

    res_kcc = list_schemes(q="KCC")
    assert res_kcc["items"][0]["scheme_id"] == "kcc"


def test_api_response_consistency():
    """API response shape must conform to expected contract with no internal fields."""
    res = list_schemes(q="kisan", limit=10)
    assert "total" in res and "items" in res
    assert isinstance(res["items"], list)
    for it in res["items"]:
        assert "scheme_id" in it
        assert "name" in it
        assert "benefit" in it
        assert "category" in it
        for forbidden in ("rules", "profile_rules", "reviewer_id", "merged_from"):
            assert forbidden not in it

    # Check metadata endpoint consistency
    m = meta()
    assert "total" in m and "categories" in m and "states" in m and "verification" in m
    assert m["total"] == len(store.SCHEMES)


def test_scheme_registry_unavailable_returns_503():
    """Never silently return empty results if the backend has an identifiable data loading failure."""
    original_schemes = dict(store.SCHEMES)
    try:
        store.SCHEMES.clear()
        store.LOAD_ERROR = "Database connection timed out"

        with pytest.raises(HTTPException) as exc_info:
            list_schemes(q="farmer")
        assert exc_info.value.status_code == 503
        assert "Database connection timed out" in exc_info.value.detail

        with pytest.raises(HTTPException) as exc_meta:
            meta()
        assert exc_meta.value.status_code == 503
    finally:
        store.SCHEMES.clear()
        store.SCHEMES.update(original_schemes)
        store.LOAD_ERROR = None


def test_retry_and_reload_behavior():
    """Verify that reloading or retrying populates the store cleanly."""
    assert len(store.SCHEMES) >= 400
    res = list_schemes(q="farmer")
    assert res["total"] > 0
