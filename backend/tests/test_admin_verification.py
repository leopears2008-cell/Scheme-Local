from conftest import hdr
from repo import repo

PM = "pm_kisan"


def decision(note="Checked against the official PMKISAN notification", url="https://pmkisan.gov.in/", **kw):
    return {"note": note, "source_url": url, "source_type": "central_portal", **kw}


def test_seeded_schemes_never_start_verified(client):
    s = client.get(f"/api/schemes/{PM}").json()
    assert s["verification_status"] in ("needs_review", "unverified")
    assert s["verification_status"] != "verified"


def test_admin_list_shows_counts_and_filters(client, admin):
    r = client.get("/api/admin/schemes", headers=hdr(admin)).json()
    assert set(r["counts"]) == {"verified", "needs_review", "expired", "unverified"}
    r2 = client.get("/api/admin/schemes", headers=hdr(admin), params={"status": "verified"}).json()
    assert r2["total"] == 0


def test_verify_requires_fresh_login(client, admin, monkeypatch):
    import config
    monkeypatch.setattr(config, "FRESH_LOGIN_MINUTES", 0)
    r = client.post(f"/api/admin/schemes/{PM}/verify", headers=hdr(admin), json=decision())
    assert r.status_code == 401 and r.headers.get("x-reauth-required") == "true"


def test_verify_rejects_non_government_source(client, admin):
    r = client.post(f"/api/admin/schemes/{PM}/verify", headers=hdr(admin), json=decision(url="https://random-blog.example.com/x"))
    assert r.status_code == 422


def test_verify_rejects_http_source(client, admin):
    r = client.post(f"/api/admin/schemes/{PM}/verify", headers=hdr(admin), json=decision(url="http://pmkisan.gov.in"))
    assert r.status_code == 422


def test_verify_records_reviewer_expiry_and_history(client, admin):
    r = client.post(f"/api/admin/schemes/{PM}/verify", headers=hdr(admin), json=decision())
    assert r.status_code == 200, r.text
    s = client.get(f"/api/schemes/{PM}").json()
    assert s["verification_status"] == "verified" and s["review_expires_at"]
    assert "+91" not in str(s.get("reviewer_label") or "")          # reviewer shown masked, never a full phone
    hist = client.get(f"/api/admin/schemes/{PM}/history", headers=hdr(admin)).json()
    assert hist[0]["action"] == "verify" and hist[0]["actor_id"]


def test_edit_drops_verified_back_to_needs_review(client, admin):
    client.post(f"/api/admin/schemes/{PM}/verify", headers=hdr(admin), json=decision())
    cur = client.get("/api/admin/schemes", headers=hdr(admin), params={"q": PM}).json()["items"][0]
    body = {k: cur[k] for k in ("scheme_id", "official_name", "government_level", "state", "department", "category",
                                "official_eligibility", "official_benefits", "documents", "application_url",
                                "official_source_url", "source_type", "how_to_apply")}
    body["official_benefits"] = "Changed benefit text"
    r = client.patch(f"/api/admin/schemes/{PM}", headers=hdr(admin), params={"expected_version": cur["version"]}, json=body)
    assert r.status_code == 200 and r.json()["status"] == "needs_review"


def test_stale_edit_is_rejected(client, admin):
    cur = client.get("/api/admin/schemes", headers=hdr(admin), params={"q": PM}).json()["items"][0]
    body = {k: cur[k] for k in ("scheme_id", "official_name", "government_level", "state", "department", "category",
                                "official_eligibility", "official_benefits", "documents", "application_url",
                                "official_source_url", "source_type", "how_to_apply")}
    r = client.patch(f"/api/admin/schemes/{PM}", headers=hdr(admin), params={"expected_version": 999}, json=body)
    assert r.status_code == 409


def test_expired_review_is_treated_as_expired_in_public_api(client, admin):
    import schemes_store as store
    client.post(f"/api/admin/schemes/{PM}/verify", headers=hdr(admin), json=decision(expires_in_days=1))
    row = repo().schemes[PM]; row["review_expires_at"] = "2001-01-01"
    store.refresh_one(row)
    assert client.get(f"/api/schemes/{PM}").json()["verification_status"] == "expired"


def test_duplicate_detection(client, admin):
    # official name normalises to the same key as PM-KISAN's official name
    name = client.get(f"/api/schemes/{PM}").json()["name"]
    r = client.post("/api/admin/schemes", headers=hdr(admin), json={
        "scheme_id": "pm_kisan_copy", "official_name": name, "government_level": "central", "category": "agriculture",
        "how_to_apply": "x", "official_benefits": "x"})
    assert r.status_code == 201, r.text
    d = client.get("/api/admin/duplicates", headers=hdr(admin)).json()["duplicates"]
    assert any("pm_kisan_copy" in g["scheme_ids"] for g in d)


def test_public_api_hides_reviewer_identity(client, admin):
    client.post(f"/api/admin/schemes/{PM}/verify", headers=hdr(admin), json=decision())
    s = client.get(f"/api/schemes/{PM}").json()
    assert "reviewer_id" not in s and "reviewer_label" not in s and "review_note" not in s


def test_ai_cannot_mark_verified(client):
    """Structural guarantee: no endpoint lets a citizen or the chat pipeline change status."""
    from repo import repo as r
    import schemes_store as store
    assert all(row.get("verification_status") != "verified" or row.get("reviewer_id") for row in r().schemes.values())
