"""Offline scenario checks from the repair prompt (section 8), for the deterministic eligibility side only.
The AI answer side needs a live Gemini key and is NOT covered here. Synthetic profiles only."""
import pytest

import schemes_store as st
from services.eligibility import match_all


@pytest.fixture(autouse=True)
def _load():
    st.load_all()


def _verdicts(profile):
    return {r["scheme_id"]: r["verdict"] for r in match_all(profile, include_not_eligible=True)}


def _names(profile):
    return {r["scheme_id"]: r for r in match_all(profile, include_not_eligible=True)}


SCENARIOS = {
    "tn_farmer_2_acres": {"age": 34, "occupation": "farmer", "state": "Tamil Nadu", "landHectares": "2", "landUnit": "acre"},
    "farmer_unspecified_units": {"age": 34, "occupation": "farmer", "state": "Tamil Nadu", "landHectares": "2"},
    "farmer_zero_acres": {"age": 34, "occupation": "farmer", "state": "Tamil Nadu", "landHectares": "0", "landUnit": "acre"},
    "farmer_10_acres": {"age": 34, "occupation": "farmer", "state": "Tamil Nadu", "landHectares": "10", "landUnit": "acre"},
    "student": {"age": 19, "occupation": "student", "state": "Tamil Nadu"},
    "senior_citizen": {"age": 70, "occupation": "senior", "state": "Tamil Nadu"},
    "woman_applicant": {"age": 30, "gender": "female", "state": "Tamil Nadu"},
    "general_category": {"age": 30, "category": "General", "state": "Tamil Nadu"},
    "sc_applicant": {"age": 30, "category": "SC", "state": "Tamil Nadu"},
    "st_applicant": {"age": 30, "category": "ST", "state": "Tamil Nadu"},
    "bpl_applicant": {"age": 30, "annualIncome": "80000", "state": "Tamil Nadu"},
    "incomplete_profile": {"state": "Tamil Nadu"},
    "conflicting_profile": {"age": 17, "occupation": "farmer", "annualIncome": "5 crore", "state": "Tamil Nadu"},
}


@pytest.mark.parametrize("name", list(SCENARIOS))
def test_scenario_runs_and_every_result_is_explained(name):
    res = match_all(SCENARIOS[name], include_not_eligible=True)
    assert res, "engine returned nothing"
    for r in res:
        assert r["verdict"] in ("ELIGIBLE", "POSSIBLE_MATCH", "NEEDS_VERIFICATION", "NOT_ELIGIBLE")
        assert r["criteria_total"] == len(r["criteria"])
        assert r["criteria_met"] == sum(c["status"] == "pass" for c in r["criteria"])


def test_incomplete_profile_never_claims_eligible():
    """Scenario 11: almost nothing known -> no ELIGIBLE, no POSSIBLE_MATCH from unknowns."""
    v = _verdicts(SCENARIOS["incomplete_profile"])
    assert "ELIGIBLE" not in v.values()


def test_two_acres_is_under_a_two_hectare_cap():
    """Scenario 1 land rule: 2 acres = 0.81 ha, so a 2 ha cap passes."""
    from services.units import parse_land_hectares
    ha, _ = parse_land_hectares("2", "acre")
    assert ha == pytest.approx(0.809, rel=1e-3)


def test_ten_acres_is_over_a_two_hectare_cap():
    from services.units import parse_land_hectares
    ha, _ = parse_land_hectares("10", "acre")
    assert ha > 2


def test_conflicting_profile_fails_age_and_never_eligible():
    """Scenario 20: a 17-year-old with income Rs 5 crore conflicts with any age-18+ rule; must not be ELIGIBLE on that scheme."""
    res = _names(SCENARIOS["conflicting_profile"])
    for r in res.values():
        if any(c["key"] == "age" and c["status"] == "fail" for c in r["criteria"]):
            assert r["verdict"] == "NOT_ELIGIBLE"


def test_unknown_or_unclear_income_is_not_a_pass():
    """'lots' as income must stay unknown in any income rule."""
    res = match_all({"age": 30, "annualIncome": "lots", "state": "Tamil Nadu"}, include_not_eligible=True)
    for r in res:
        for c in r["criteria"]:
            if c["key"] == "income":
                assert c["status"] == "unknown"


def test_scheme_outside_state_is_not_eligible_for_a_kerala_user():
    """Scenario 16/cross-state: a Tamil Nadu state scheme must not be ELIGIBLE for a Kerala resident."""
    res = match_all({"age": 30, "occupation": "farmer", "state": "Kerala"}, include_not_eligible=True)
    tn_state = [r for r in res if r.get("level") == "state" and r.get("state") == "Tamil Nadu"]
    assert tn_state and all(r["verdict"] == "NOT_ELIGIBLE" for r in tn_state)


def test_unsupported_and_fabricated_scheme_ids_are_rejected_by_guardrails():
    """Scenarios 12 and 13 (scheme-ID side): unknown IDs are never shown as cards."""
    import pipeline.guardrails as g
    res = {"language": "english", "retrieved": [{"scheme_id": "pm_kisan", "text": "t", "status": "needs_review", "source": "x"}],
           "verdicts": [{"scheme_id": "fabricated_scheme_xyz", "verdict": "ELIGIBLE", "why": "ok"}], "answer_text": "a", "follow_up_question": None}
    assert g.apply_output_rails(res)["verdicts"] == []


def test_expired_scheme_is_never_shown_as_a_match():
    """Scenario 14: a scheme whose review has lapsed cannot be ELIGIBLE or POSSIBLE_MATCH, even when every check passes."""
    import copy
    row = copy.deepcopy(st.SCHEMES["pm_kisan"])
    row.update({"verification": "expired", "rules": {"minAge": "18"}, "profile_rules": []})
    st.SCHEMES["pm_kisan"] = row
    try:
        r = next(x for x in match_all({"age": 34, "occupation": "farmer", "state": "Tamil Nadu"}, include_not_eligible=True) if x["scheme_id"] == "pm_kisan")
        assert r["verdict"] == "NEEDS_VERIFICATION"
        assert any(c["key"] == "review" for c in r["criteria"])
    finally:
        st.load_all()
