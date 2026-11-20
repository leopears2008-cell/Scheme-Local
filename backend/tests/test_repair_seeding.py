"""Repair 3.5: seed records must match the real Supabase schema. Uses the actual migration on an embedded Postgres."""
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from seed_mapping import MIGRATION, build_rows, map_record, schema_columns  # noqa: E402
import schemes_store as st  # noqa: E402

pgserver = pytest.importorskip("pgserver")
psycopg2 = pytest.importorskip("psycopg2")
from psycopg2.extras import Json  # noqa: E402

COLS = schema_columns()
REG = {"scheme_id": "tn_reg_tn_009", "official_name": "Test Register Scheme", "government_level": "state", "state": "Tamil Nadu",
       "department": "Agriculture", "category": "agriculture", "official_eligibility": [], "official_benefits": "",
       "documents": [], "how_to_apply": "", "official_source_url": "https://www.tnhorticulture.tn.gov.in/x",
       "verification_status": "unverified", "source_checked_date": "2026-11-18", "details_available": False,
       "extra": {}, "origin": "tn_register", "version": 1}
CANON = {"scheme_id": "central_canon_1", "official_name": "Central Canon", "government_level": "central", "category": "education",
         "official_eligibility": ["Student"], "official_benefits": "Scholarship", "documents": ["Marksheet"],
         "official_source_url": "https://scholarships.gov.in/", "verification_status": "needs_review", "extra": {}, "origin": "seed"}


def test_schema_columns_come_from_the_migration():
    assert {"scheme_id", "official_name", "verification_status", "extra"} <= COLS
    assert "source_checked_date" not in COLS and "details_available" not in COLS
    assert "and" not in COLS          # regression: constraint text must not become a column


def test_legacy_register_fields_move_to_extra_and_are_reported():
    row, notes, errors = map_record(REG, COLS)
    assert errors == []
    assert set(row) <= COLS
    assert row["extra"]["source_checked_date"] == "2026-11-18" and row["extra"]["details_available"] is False
    assert any("source_checked_date -> extra" in n for n in notes)


def test_canonical_record_maps_without_changes_to_values():
    row, _, errors = map_record(CANON, COLS)
    assert errors == [] and row["official_benefits"] == "Scholarship" and row["documents"] == ["Marksheet"]


def test_seeding_can_never_set_verified():
    row, notes, errors = map_record({**CANON, "verification_status": "verified"}, COLS)
    assert row["verification_status"] == "needs_review"
    assert any("downgraded" in n for n in notes)


def test_invalid_records_are_rejected_with_reasons():
    _, _, errors = map_record({"scheme_id": "BAD ID!", "official_name": "x", "government_level": "province"}, COLS)
    assert any("scheme_id" in e for e in errors) and any("government_level" in e for e in errors)


def test_non_https_urls_are_cleared_not_sent():
    row, notes, _ = map_record({**CANON, "official_source_url": "http://insecure.example"}, COLS)
    assert row["official_source_url"] is None and any("not https" in n for n in notes)


def test_duplicates_are_dropped_and_reported():
    rows, rep = build_rows([CANON, CANON], COLS)
    assert len(rows) == 1 and rep["duplicates"] == ["central_canon_1"]


def test_all_loaded_records_map_cleanly():
    rows, rep = build_rows(st._load_json_rows(), COLS)
    assert rep["rejected"] == [] and len(rows) > 300
    assert {k for r in rows for k in r} <= COLS


@pytest.fixture(scope="module")
def pg():
    from test_rls import SHIM
    srv = pgserver.get_server(tempfile.mkdtemp())
    c = psycopg2.connect(srv.get_uri()); c.autocommit = True
    cur = c.cursor(); cur.execute(SHIM); cur.execute(MIGRATION.read_text(encoding="utf-8"))
    cur.execute("grant all on all tables in schema public to service_role")
    yield c
    c.close(); srv.cleanup()


def _insert(cur, row):
    cols = list(row)
    vals = [Json(row[k]) if isinstance(row[k], dict) else row[k] for k in cols]
    cur.execute(f"insert into public.schemes ({','.join(cols)}) values ({','.join(['%s'] * len(cols))})", vals)


def test_seed_rows_insert_into_the_real_schema(pg):
    """This is the failure from the report: legacy register rows used to raise 'column does not exist'."""
    rows, rep = build_rows([REG, CANON], COLS)
    cur = pg.cursor(); cur.execute("set role service_role")
    for r in rows:
        _insert(cur, r)                                    # would raise UndefinedColumn before the fix
    cur.execute("reset role"); cur.execute("select count(*) from public.schemes where scheme_id in ('tn_reg_tn_009','central_canon_1')")
    assert cur.fetchone()[0] == 2


def test_upsert_is_idempotent_by_scheme_id(pg):
    cur = pg.cursor(); cur.execute("set role service_role")
    row, _, _ = map_record(CANON, COLS)
    cur.execute("insert into public.schemes (" + ",".join(row) + ") values (" + ",".join(["%s"] * len(row)) + ") "
                "on conflict (scheme_id) do update set official_benefits = excluded.official_benefits",
                [Json(v) if isinstance(v, dict) else v for v in row.values()])
    cur.execute("reset role"); cur.execute("select count(*) from public.schemes where scheme_id='central_canon_1'")
    assert cur.fetchone()[0] == 1
