"""Data access. Two implementations behind one interface:

SupabaseRepo – production. User-owned data is read/written with the USER's JWT, so Postgres Row Level Security is
               enforced by the database itself. The service-role key is used only for roles, scheme administration,
               audit logs and account deletion, always after the backend has checked the caller's role.
MemoryRepo   – tests / local development without Supabase. Mirrors the same ownership rules."""
import logging
import threading
import uuid
from datetime import datetime, timezone
from functools import lru_cache

import httpx

import config

log = logging.getLogger("repo")


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class RepoError(Exception):
    def __init__(self, status: int, msg: str):
        super().__init__(msg); self.status = status


# ------------------------------------------------------------------ Supabase
class SupabaseRepo:
    def __init__(self):
        self.base = config.SUPABASE_URL
        self.http = httpx.Client(timeout=10)

    def _h(self, token=None, service=False, prefer="return=representation"):
        key = config.SUPABASE_SERVICE_ROLE_KEY if service else config.SUPABASE_ANON_KEY
        return {"apikey": key, "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY if service else token}",
                "Content-Type": "application/json", "Prefer": prefer}

    def _rest(self, method, table, *, p=None, params=None, json=None, service=False, prefer="return=representation", single=False):
        token = None if service else (p.token if p else None)
        if not service and not token:
            raise RepoError(401, "token required")
        try:
            r = self.http.request(method, f"{self.base}/rest/v1/{table}", params=params, json=json, headers=self._h(token, service, prefer))
        except httpx.HTTPError as e:
            log.error("supabase unreachable: %s", type(e).__name__)
            raise RepoError(503, "Database unavailable")
        if r.status_code >= 400:
            log.warning("supabase %s %s -> %s", method, table, r.status_code)
            raise RepoError(409 if r.status_code == 409 else 403 if r.status_code in (401, 403) else 502, "Database error")
        data = r.json() if r.content else []
        return (data[0] if data else None) if single else data

    # --- user-owned (RLS enforced by Postgres)
    def list_apps(self, p):
        apps = self._rest("GET", "applications", p=p, params={"select": "*", "order": "updated_at.desc"})
        if apps:
            ev = self._rest("GET", "application_events", p=p, params={"select": "application_id,status,note,created_at", "order": "id.asc"})
            for a in apps:
                a["events"] = [e for e in ev if e["application_id"] == a["id"]]
        return apps

    def create_app(self, p, row):
        a = self._rest("POST", "applications", p=p, json=row, single=True)
        self.add_event(p, a["id"], a["status"], "Created")
        a["events"] = [{"status": a["status"], "note": "Created"}]
        return a

    def update_app(self, p, app_id, fields):
        a = self._rest("PATCH", "applications", p=p, params={"id": f"eq.{app_id}"}, json=fields, single=True)
        return a  # None when RLS hides it (not yours) -> 404

    def delete_app(self, p, app_id):
        return bool(self._rest("DELETE", "applications", p=p, params={"id": f"eq.{app_id}"}))

    def add_event(self, p, app_id, status, note=""):
        self._rest("POST", "application_events", p=p, json={"application_id": app_id, "status": status, "note": note}, prefer="return=minimal")

    def get_app(self, p, app_id):
        a = self._rest("GET", "applications", p=p, params={"id": f"eq.{app_id}", "select": "*"}, single=True)
        if a:
            a["events"] = self._rest("GET", "application_events", p=p, params={"application_id": f"eq.{app_id}", "select": "status,note,created_at", "order": "id.asc"})
        return a

    def list_bookmarks(self, p):
        return [r["scheme_id"] for r in self._rest("GET", "bookmarks", p=p, params={"select": "scheme_id"})]

    def toggle_bookmark(self, p, scheme_id):
        gone = self._rest("DELETE", "bookmarks", p=p, params={"scheme_id": f"eq.{scheme_id}"})
        if gone:
            return False
        self._rest("POST", "bookmarks", p=p, json={"scheme_id": scheme_id}, prefer="return=minimal")
        return True

    def list_notifications(self, p):
        return self._rest("GET", "notifications", p=p, params={"select": "*", "order": "id.desc", "limit": "50"})

    def add_notification(self, p, kind, title, body, app_id=None):
        self._rest("POST", "notifications", p=p, json={"kind": kind, "title": title, "body": body, "application_id": app_id}, prefer="return=minimal")

    def mark_notifications_read(self, p):
        self._rest("PATCH", "notifications", p=p, params={"read": "eq.false"}, json={"read": True}, prefer="return=minimal")

    def get_profile(self, p):
        return self._rest("GET", "profiles", p=p, params={"id": f"eq.{p.user_id}", "select": "*"}, single=True)

    def upsert_profile(self, p, fields):
        row = {"id": p.user_id, "phone": p.phone, **fields}
        return self._rest("POST", "profiles", p=p, json=row, prefer="resolution=merge-duplicates,return=representation", single=True)

    # --- service role (only after role checks in the API layer)
    def get_role(self, user_id):
        r = self._rest("GET", "user_roles", service=True, params={"user_id": f"eq.{user_id}", "select": "role"}, single=True)
        return r["role"] if r else None

    def set_role(self, user_id, role, granted_by):
        self._rest("POST", "user_roles", service=True, json={"user_id": user_id, "role": role, "granted_by": granted_by},
                   prefer="resolution=merge-duplicates,return=minimal")

    def list_roles(self):
        return self._rest("GET", "user_roles", service=True, params={"select": "user_id,role,granted_at"})

    def schemes_all(self):
        out, off = [], 0
        while True:
            page = self._rest("GET", "schemes", service=True, params={"select": "*", "order": "scheme_id", "limit": "1000", "offset": str(off)})
            out += page
            if len(page) < 1000:
                return out
            off += 1000

    def scheme_upsert(self, row, expected_version=None):
        if expected_version is not None:   # optimistic concurrency: two admins can't overwrite each other silently
            r = self._rest("PATCH", "schemes", service=True, params={"scheme_id": f"eq.{row['scheme_id']}", "version": f"eq.{expected_version}"}, json=row, single=True)
            if r is None:
                raise RepoError(409, "Scheme was changed by someone else; reload and retry")
            return r
        return self._rest("POST", "schemes", service=True, json=row, prefer="resolution=merge-duplicates,return=representation", single=True)

    def scheme_upsert_many(self, rows):
        for i in range(0, len(rows), 200):
            self._rest("POST", "schemes", service=True, json=rows[i:i + 200], prefer="resolution=merge-duplicates,return=minimal")

    def history_add(self, row):
        self._rest("POST", "scheme_history", service=True, json=row, prefer="return=minimal")

    def history_list(self, scheme_id):
        return self._rest("GET", "scheme_history", service=True, params={"scheme_id": f"eq.{scheme_id}", "order": "id.desc", "limit": "100"})

    def audit_add(self, actor_id, action, entity=None, entity_id=None, meta=None):
        try:
            self._rest("POST", "audit_logs", service=True, json={"actor_id": actor_id, "action": action, "entity": entity, "entity_id": entity_id, "meta": meta or {}}, prefer="return=minimal")
        except RepoError:
            log.error("audit write failed for %s", action)

    def delete_user(self, user_id):
        """Deletes the auth user; ON DELETE CASCADE removes profile, applications, bookmarks, notifications, roles."""
        r = self.http.delete(f"{self.base}/auth/v1/admin/users/{user_id}", headers=self._h(service=True))
        if r.status_code >= 400:
            raise RepoError(502, "Could not delete account")


# ------------------------------------------------------------------ Memory (tests / local dev)
class MemoryRepo:
    def __init__(self):
        self.lock = threading.Lock()
        self.apps, self.events, self.bm, self.notes = {}, [], set(), []
        self.profiles, self.roles, self.schemes, self.history, self.audit = {}, {}, {}, [], []
        self.deleted_users = []

    def list_apps(self, p):
        return sorted(({**a, "events": [e for e in self.events if e["application_id"] == a["id"]]} for a in self.apps.values() if a["user_id"] == p.user_id), key=lambda a: a["updated_at"], reverse=True)

    def create_app(self, p, row):
        a = {"id": str(uuid.uuid4()), "user_id": p.user_id, "created_at": now(), "updated_at": now(), **row}
        self.apps[a["id"]] = a; self.add_event(p, a["id"], a["status"], "Created")
        return self.get_app(p, a["id"])

    def _own(self, p, app_id):
        a = self.apps.get(app_id); return a if a and a["user_id"] == p.user_id else None

    def get_app(self, p, app_id):
        a = self._own(p, app_id)
        return {**a, "events": [e for e in self.events if e["application_id"] == app_id]} if a else None

    def update_app(self, p, app_id, fields):
        a = self._own(p, app_id)
        if not a: return None
        a.update(fields); a["updated_at"] = now(); return self.get_app(p, app_id)

    def delete_app(self, p, app_id):
        if not self._own(p, app_id): return False
        del self.apps[app_id]; self.events = [e for e in self.events if e["application_id"] != app_id]; return True

    def add_event(self, p, app_id, status, note=""):
        if self._own(p, app_id): self.events.append({"application_id": app_id, "status": status, "note": note, "created_at": now()})

    def list_bookmarks(self, p): return [s for (u, s) in self.bm if u == p.user_id]

    def toggle_bookmark(self, p, scheme_id):
        k = (p.user_id, scheme_id)
        if k in self.bm: self.bm.discard(k); return False
        self.bm.add(k); return True

    def list_notifications(self, p): return [n for n in reversed(self.notes) if n["user_id"] == p.user_id][:50]

    def add_notification(self, p, kind, title, body, app_id=None):
        self.notes.append({"id": len(self.notes) + 1, "user_id": p.user_id, "kind": kind, "title": title, "body": body, "application_id": app_id, "read": False, "created_at": now()})

    def mark_notifications_read(self, p):
        for n in self.notes:
            if n["user_id"] == p.user_id: n["read"] = True

    def get_profile(self, p): return self.profiles.get(p.user_id)

    def upsert_profile(self, p, fields):
        self.profiles[p.user_id] = {**self.profiles.get(p.user_id, {"id": p.user_id, "ocr_consent": False}), "phone": p.phone, **fields}
        return self.profiles[p.user_id]

    def get_role(self, user_id): return self.roles.get(user_id)
    def set_role(self, user_id, role, granted_by): self.roles[user_id] = role
    def list_roles(self): return [{"user_id": u, "role": r} for u, r in self.roles.items()]
    def schemes_all(self): return list(self.schemes.values())

    def scheme_upsert(self, row, expected_version=None):
        cur = self.schemes.get(row["scheme_id"])
        if expected_version is not None and (not cur or cur["version"] != expected_version):
            raise RepoError(409, "Scheme was changed by someone else; reload and retry")
        self.schemes[row["scheme_id"]] = {**(cur or {}), **row}; return self.schemes[row["scheme_id"]]

    def scheme_upsert_many(self, rows):
        for r in rows: self.schemes[r["scheme_id"]] = r

    def history_add(self, row): self.history.append({"id": len(self.history) + 1, "created_at": now(), **row})
    def history_list(self, scheme_id): return [h for h in reversed(self.history) if h["scheme_id"] == scheme_id]
    def audit_add(self, actor_id, action, entity=None, entity_id=None, meta=None):
        self.audit.append({"actor_id": actor_id, "action": action, "entity": entity, "entity_id": entity_id, "meta": meta or {}})

    def delete_user(self, user_id):
        self.deleted_users.append(user_id)
        for a in [a for a in self.apps.values() if a["user_id"] == user_id]: del self.apps[a["id"]]
        self.bm = {k for k in self.bm if k[0] != user_id}; self.notes = [n for n in self.notes if n["user_id"] != user_id]
        self.profiles.pop(user_id, None); self.roles.pop(user_id, None)


_override = {}


def set_repo(r):  # tests
    _override["r"] = r


@lru_cache(maxsize=1)
def _default():
    return SupabaseRepo() if config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY else MemoryRepo()


def repo():
    return _override.get("r") or _default()
