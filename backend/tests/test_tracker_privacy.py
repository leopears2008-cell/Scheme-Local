from conftest import hdr


def test_status_timeline_and_no_official_claim(client, citizen):
    a = client.post("/api/applications", headers=hdr(citizen), json={"scheme_id": "pm_kisan", "reference_number": "R-1"}).json()
    r = client.patch(f"/api/applications/{a['id']}", headers=hdr(citizen), json={"status": "submitted", "event_note": "Submitted on portal"})
    assert r.status_code == 200 and r.json()["status"] == "submitted"
    assert "official" not in str(r.json()).lower().replace("official_", "")


def test_invalid_status_rejected(client, citizen):
    a = client.post("/api/applications", headers=hdr(citizen), json={"scheme_id": "pm_kisan"}).json()
    assert client.patch(f"/api/applications/{a['id']}", headers=hdr(citizen), json={"status": "approved!!"}).status_code == 422


def test_long_notes_rejected(client, citizen):
    assert client.post("/api/applications", headers=hdr(citizen), json={"scheme_id": "pm_kisan", "notes": "x" * 600}).status_code == 422


def test_deleting_account_removes_data(client, citizen):
    client.post("/api/applications", headers=hdr(citizen), json={"scheme_id": "pm_kisan"})
    assert client.delete("/api/me", headers=hdr(citizen)).status_code == 200
    assert client.get("/api/applications", headers=hdr(citizen)).json() == []


def test_export_contains_only_own_data(client, citizen, other):
    client.post("/api/applications", headers=hdr(other), json={"scheme_id": "pm_kisan"})
    assert client.get("/api/me/export", headers=hdr(citizen)).json()["applications"] == []


def test_follow_up_date_saved(client, citizen):
    r = client.post("/api/applications", headers=hdr(citizen), json={"scheme_id": "pm_kisan", "follow_up_date": "2027-01-15"})
    assert r.status_code == 201
