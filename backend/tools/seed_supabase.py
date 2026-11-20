"""Load scheme records into Supabase `public.schemes`. Uses the SERVICE role key (server-side only).

    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python tools/seed_supabase.py          # send
    python tools/seed_supabase.py --dry-run                                               # report only, no network

Columns come from supabase/migrations/0001_init.sql (see seed_mapping.py). Records are validated before sending,
rejects are reported with reasons, duplicates are dropped, and seeding never marks a scheme 'verified'.
Re-running is safe: rows are upserted by scheme_id.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tools"))

import config  # noqa: E402
from schemes_store import _load_json_rows  # noqa: E402
from seed_mapping import build_rows, schema_columns  # noqa: E402

BATCH = 100


def main(argv):
    dry = "--dry-run" in argv
    cols = schema_columns()
    rows, report = build_rows(_load_json_rows(), cols)
    print(f"schema columns: {len(cols)}")
    print(f"accepted: {report['accepted']}  rejected: {len(report['rejected'])}  duplicates dropped: {len(report['duplicates'])}")
    for r in report["rejected"][:20]:
        print(f"  REJECT {r['scheme_id']}: {'; '.join(r['reasons'])}")
    mapped = sum(1 for v in report["notes"].values() if v)
    print(f"records with mapping notes: {mapped} (e.g. legacy keys moved into the 'extra' column)")
    if dry:
        print("dry run: nothing sent")
        return 0
    if not (config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY):
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (never commit them)")
        return 2
    from repo import RepoError, SupabaseRepo
    repo = SupabaseRepo()
    sent = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        try:
            repo.scheme_upsert_many(batch)
            sent += len(batch)
        except RepoError as e:
            print(f"batch {i // BATCH} failed with status {e.status}; nothing from this batch was confirmed")
            return 1
    print(f"sent {sent} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
