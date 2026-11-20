"""Generate docs/SCHEME_QUALITY_REPORT.md from the actual scheme files. No numbers are typed in by hand.
Run:  python tools/quality_report.py
This reports data completeness and source-domain checks only. It does NOT check that any scheme is current or accurate;
that requires a human reviewer against the official source."""
import collections
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import schemes_store as st  # noqa: E402

rows = st._load_json_rows()
norm = lambda s: re.sub(r"[^a-z0-9]", "", (s or "").lower())
status = collections.Counter(st.effective_status(r) for r in rows)
origin = collections.Counter(r.get("origin") for r in rows)
level = collections.Counter(r.get("government_level") for r in rows)
states = collections.Counter(r.get("state") or "(central/none)" for r in rows)
cats = collections.Counter(r.get("category") for r in rows)
no_benefit = [r["scheme_id"] for r in rows if not r.get("official_benefits")]
no_elig = [r["scheme_id"] for r in rows if not r.get("official_eligibility")]
no_docs = [r["scheme_id"] for r in rows if not r.get("documents")]
no_src = [r["scheme_id"] for r in rows if not r.get("official_source_url")]
non_official = [(r["scheme_id"], r.get("official_source_url")) for r in rows
                if r.get("official_source_url") and not st.is_official_host(r["official_source_url"])]
names = collections.defaultdict(list)
for r in rows:
    names[norm(r["official_name"])].append(r["scheme_id"])
dups = {k: v for k, v in names.items() if len(v) > 1 and k}
name_only = [r["scheme_id"] for r in rows if not r.get("official_benefits") and not r.get("official_eligibility")]
verified_count = status.get("verified", 0)
pct = lambda n: f"{100 * n / len(rows):.0f}%" if rows else "n/a"

out = [
    "# Scheme data quality report",
    "",
    f"Generated {datetime.now(timezone.utc):%Y-%m-%d %H:%M UTC} by `backend/tools/quality_report.py` from the scheme files in `backend/schemes/`.",
    "",
    "**What this report is:** a completeness and consistency check of the data we hold.",
    "**What it is not:** proof that any scheme is current, accurate or officially approved. Only a named reviewer checking an official source can mark a scheme *verified*.",
    "",
    "## Totals",
    "",
    f"- Total scheme records: **{len(rows)}**",
    f"- Officially **verified** (human-reviewed, with source and reviewer): **{verified_count}**",
    f"- Status counts: " + ", ".join(f"{k} {v}" for k, v in sorted(status.items())),
    f"- Origin: " + ", ".join(f"{k} {v}" for k, v in origin.most_common()),
    f"- Level: " + ", ".join(f"{k} {v}" for k, v in level.most_common()),
    "",
    "## Completeness",
    "",
    f"- Records with no benefit text: {len(no_benefit)} ({pct(len(no_benefit))})",
    f"- Records with no eligibility text: {len(no_elig)} ({pct(len(no_elig))})",
    f"- Records with no documents list: {len(no_docs)} ({pct(len(no_docs))})",
    f"- Records with **name only** (no benefit and no eligibility): {len(name_only)} ({pct(len(name_only))}). These are discovery placeholders, not eligibility records.",
    f"- Records with no official source URL: {len(no_src)}",
    "",
    "## Source domains",
    "",
    f"- Sources on a government domain: {len(rows) - len(non_official) - len(no_src)}",
    f"- Sources NOT on a government domain: {len(non_official)}. These are shown with a warning in the app. They need replacing with official sources or review.",
    "",
    "## Duplicates",
    "",
    f"- Duplicate name groups (same normalised official name): {len(dups)}. Nothing has been deleted; each group needs a reviewer decision.",
    "",
]
for k, ids in sorted(dups.items(), key=lambda x: x[0])[:50]:
    out.append(f"- `{', '.join(ids)}`")
out += ["", "## Breakdown by state", ""] + [f"- {k}: {v}" for k, v in states.most_common()]
out += ["", "## Breakdown by category", ""] + [f"- {k}: {v}" for k, v in cats.most_common()]
out += ["", "## Non-government source links (first 60)", ""] + [f"- `{sid}` → {u}" for sid, u in non_official[:60]]
out += ["", "## Records missing a source", ""] + [f"- `{sid}`" for sid in no_src]
(ROOT.parent / "docs").mkdir(exist_ok=True)
(ROOT.parent / "docs" / "SCHEME_QUALITY_REPORT.md").write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"records={len(rows)} verified={verified_count} non_official_sources={len(non_official)} duplicate_groups={len(dups)} name_only={len(name_only)}")
