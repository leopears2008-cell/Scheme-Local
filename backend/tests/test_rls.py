"""Row Level Security tests against a REAL Postgres (embedded via `pgserver`) running the real migration.
Supabase's own pieces (auth.users, auth.uid(), anon/authenticated/service_role) are emulated by a small shim,
so these tests prove the policies in 0001_init.sql, not Supabase's platform itself."""
import json
import tempfile
import uuid
from pathlib import Path

import pytest

psycopg2 = pytest.importorskip("psycopg2", reason="psycopg2 is not installed; install requirements.txt to run RLS tests")

pgserver = pytest.importorskip("pgserver")
MIGRATION = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "0001_init.sql"

SHIM = """
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key default gen_random_uuid(), phone text);
create function auth.uid() returns uuid language sql stable as
$$ select nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
"""

A, B, ADMIN, SUPER = (str(uuid.uuid4()) for _ in range(4))


@pytest.fixture(scope="module")
def pg():
    srv = pgserver.get_server(tempfile.mkdtemp())
    c = psycopg2.connect(srv.get_uri()); c.autocommit = True
    cur = c.cursor()
    cur.execute(SHIM); cur.execute(MIGRATION.read_text())
    cur.execute("grant all on all tables in schema public to service_role")
    for u in (A, B, ADMIN, SUPER):
        cur.execute("insert into auth.users(id, phone) values (%s, %s)", (u, "+9199" + u[:8].replace("-", "")[:8]))
    cur.execute("insert into public.user_roles(user_id, role) values (%s,'admin'), (%s,'super_admin')", (ADMIN, SUPER))
    cur.execute("insert into public.schemes(scheme_id, official_name, government_level) values ('pm_kisan','PM-KISAN','central')")
    yield c
    c.close(); srv.cleanup()


def as_user(pg, uid, role="authenticated"):
    """Run subsequent statements the way PostgREST does: SET ROLE + JWT claims."""
    cur = pg.cursor()
    cur.execute("reset role"); cur.execute(f"set role {role}")
    cur.execute("select set_config('request.jwt.claims', %s, false)", (json.dumps({"sub": uid}) if uid else "",))
    return cur


def reset(pg):
    pg.cursor().execute("reset role")


def count(cur, sql, *a):
    cur.execute(sql, a); return cur.fetchone()[0]


def test_user_can_manage_only_own_applications(pg):
    cur = as_user(pg, A)
    cur.execute("insert into applications(scheme_id, scheme_name) values ('pm_kisan','PM-KISAN') returning id")
    app_id = cur.fetchone()[0]
    assert count(cur, "select count(*) from applications") == 1
    cur = as_user(pg, B)
    assert count(cur, "select count(*) from applications") == 0                       # cannot read
    cur.execute("update applications set status='approved' where id=%s", (app_id,)); assert cur.rowcount == 0   # cannot update
    cur.execute("delete from applications where id=%s", (app_id,)); assert cur.rowcount == 0                    # cannot delete
    reset(pg)


def test_cannot_insert_row_for_someone_else(pg):
    cur = as_user(pg, B)
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        cur.execute("insert into applications(user_id, scheme_id, scheme_name) values (%s,'pm_kisan','x')", (A,))
    reset(pg)


def test_cannot_add_event_to_someone_elses_application(pg):
    cur = as_user(pg, A); cur.execute("select id from applications limit 1"); app_id = cur.fetchone()[0]
    cur = as_user(pg, B)
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        cur.execute("insert into application_events(application_id, status) values (%s,'approved')", (app_id,))
    reset(pg)


def test_anonymous_has_no_access_to_user_data(pg):
    cur = as_user(pg, None, "anon")
    for table in ("applications", "profiles", "bookmarks", "notifications", "user_roles", "audit_logs", "schemes", "scheme_history"):
        with pytest.raises(psycopg2.errors.InsufficientPrivilege):
            cur.execute(f"select * from {table}")
        reset(pg); cur = as_user(pg, None, "anon")
    assert count(cur, "select count(*) from schemes_public") == 1                       # public scheme view is readable
    reset(pg)


def test_public_view_hides_reviewer_identity(pg):
    cur = as_user(pg, None, "anon")
    cur.execute("select * from schemes_public limit 1")
    cols = {d[0] for d in cur.description}
    assert "reviewer_id" not in cols and "reviewer_label" not in cols and "review_note" not in cols
    reset(pg)


def test_citizen_cannot_self_assign_roles(pg):
    cur = as_user(pg, A)
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        cur.execute("insert into user_roles(user_id, role) values (%s,'super_admin')", (A,))
    reset(pg); cur = as_user(pg, A)
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):   # no UPDATE grant at all
        cur.execute("update user_roles set role='super_admin' where user_id=%s", (A,))
    reset(pg)


def test_user_sees_only_own_role(pg):
    cur = as_user(pg, ADMIN)
    assert count(cur, "select count(*) from user_roles") == 1
    reset(pg)


def test_full_scheme_table_is_admin_only(pg):
    assert count(as_user(pg, A), "select count(*) from schemes") == 0
    assert count(as_user(pg, ADMIN), "select count(*) from schemes") == 1
    reset(pg)


def test_admin_cannot_write_schemes_directly(pg):   # writes must go through the audited backend
    cur = as_user(pg, ADMIN)
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        cur.execute("update schemes set verification_status='needs_review'")
    reset(pg)


def test_audit_log_super_admin_read_only(pg):
    pg.cursor().execute("insert into audit_logs(actor_id, action) values (%s,'test')", (ADMIN,))
    assert count(as_user(pg, ADMIN), "select count(*) from audit_logs") == 0
    assert count(as_user(pg, SUPER), "select count(*) from audit_logs") == 1
    cur = as_user(pg, SUPER)
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        cur.execute("insert into audit_logs(action) values ('forged')")
    reset(pg)


def test_cannot_mark_verified_without_evidence(pg):
    cur = pg.cursor(); cur.execute("reset role")
    with pytest.raises(psycopg2.errors.CheckViolation):
        cur.execute("update schemes set verification_status='verified' where scheme_id='pm_kisan'")


def test_verified_with_evidence_is_accepted(pg):
    cur = pg.cursor(); cur.execute("reset role")
    cur.execute("""update schemes set verification_status='verified', verified_at=now(), reviewer_id=%s,
        official_source_url='https://pmkisan.gov.in', source_type='central_portal', review_expires_at=current_date+180
        where scheme_id='pm_kisan'""", (ADMIN,))
    assert cur.rowcount == 1
    cur.execute("update schemes set verification_status='needs_review' where scheme_id='pm_kisan'")


def test_history_and_audit_are_append_only(pg):
    cur = pg.cursor(); cur.execute("reset role")
    cur.execute("insert into scheme_history(scheme_id, action) values ('pm_kisan','seed')")
    with pytest.raises(psycopg2.errors.RaiseException):
        cur.execute("update scheme_history set note='tampered'")
    with pytest.raises(psycopg2.errors.RaiseException):
        cur.execute("delete from audit_logs")


def test_profiles_and_bookmarks_isolated(pg):
    cur = as_user(pg, A)
    cur.execute("insert into profiles(id, language) values (%s,'ta')", (A,))
    cur.execute("insert into bookmarks(scheme_id) values ('pm_kisan')")
    cur = as_user(pg, B)
    assert count(cur, "select count(*) from profiles") == 0 and count(cur, "select count(*) from bookmarks") == 0
    with pytest.raises(psycopg2.errors.InsufficientPrivilege):
        cur.execute("insert into profiles(id) values (%s)", (A,))
    reset(pg)


def test_deleting_user_cascades_personal_data(pg):
    cur = pg.cursor(); cur.execute("reset role")
    cur.execute("delete from auth.users where id=%s", (A,))
    assert count(cur, "select count(*) from applications where user_id=%s", A) == 0
    assert count(cur, "select count(*) from profiles where id=%s", A) == 0
