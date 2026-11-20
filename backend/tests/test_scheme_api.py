from conftest import hdr


def test_public_browse_needs_no_login(client):
    r = client.get("/api/schemes", params={"q": "kisan", "limit": 5})
    assert r.status_code == 200 and r.json()["total"] >= 1


def test_public_card_has_no_internal_fields(client):
    s = client.get("/api/schemes/pm_kisan").json()
    for k in ("merged_from", "form_fields", "rules", "profile_rules", "reviewer_id"):
        assert k not in s or k == "form_fields"
    # layout for the bundled official form is returned (it is structure, not a fact), with an explicit note
    assert "form_fields_note" in s and "official site" in s["form_fields_note"]
    assert isinstance(s.get("form_fields"), list)


def test_unknown_scheme_404(client):
    assert client.get("/api/schemes/nope_nope").status_code == 404


def test_bad_category_filter_is_harmless(client):
    assert client.get("/api/schemes", params={"category": "x' OR 1=1 --"}).json()["total"] == 0


def test_search_length_capped(client):
    assert client.get("/api/schemes", params={"limit": 100000}).status_code == 422     # above the le=400 cap
    assert client.get("/api/schemes", params={"limit": 400}).status_code == 200         # the cap itself is allowed


def test_eligibility_public_and_rejects_nested_profile(client):
    assert client.post("/api/eligibility", json={"profile": {"age": 30}}).status_code == 200
    assert client.post("/api/eligibility", json={"profile": {"age": {"x": 1}}}).status_code == 422


def test_eligibility_explains_each_criterion(client):
    r = client.post("/api/eligibility", json={"profile": {"age": 30, "occupation": "farmer", "state": "Tamil Nadu"}}).json()
    assert r["results"], "expected some results"
    crit = r["results"][0]["criteria"]
    assert all(c["status"] in ("pass", "fail", "unknown") for c in crit)
    assert r["results"][0]["verdict"] != "ELIGIBLE" or all(c["status"] == "pass" for c in crit)


def test_eligibility_never_marks_unverified_as_guaranteed(client):
    """Eligibility text is not a guarantee; verdicts are informational only."""
    r = client.post("/api/eligibility", json={"profile": {"age": 30}}).json()
    assert all(x["verdict"] in ("ELIGIBLE", "POSSIBLE_MATCH", "NEEDS_VERIFICATION", "NOT_ELIGIBLE") for x in r["results"])
    assert "approved" not in str(r).lower()


def test_residency_alone_is_never_eligible(client):
    """Regression: a profile with only a known state must not produce any ELIGIBLE verdict."""
    r = client.post("/api/eligibility", json={"profile": {"state": "Tamil Nadu"}}).json()
    assert all(x["verdict"] != "ELIGIBLE" for x in r["results"])
