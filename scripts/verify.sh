#!/usr/bin/env bash
# Reproducible check of the project from a clean state. Stops at the first failure.
# Needs: Python 3.12, Node 20+, network access for the first install.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "== backend: clean virtual environment from requirements.txt"
python3 -m venv "$ROOT/backend/.venv-verify"
"$ROOT/backend/.venv-verify/bin/pip" install -q -r "$ROOT/backend/requirements.txt"
echo "== backend: tests"
(cd "$ROOT/backend" && .venv-verify/bin/python -m pytest tests -q -p no:cacheprovider -rs)

echo "== frontend: clean install from the lockfile"
(cd "$ROOT/frontend" && npm ci --silent)
echo "== frontend: tests, type-check and build"
(cd "$ROOT/frontend" && npm test && npm run build)

echo "== browser smoke test (needs the backend on :8000 and the built frontend on :5173; skipped if not running)"
if curl -s localhost:8000/health >/dev/null && curl -s localhost:5173/ >/dev/null; then
  python3 "$ROOT/tests/e2e/ui_smoke.py"
else
  echo "SKIPPED: start the backend and the preview server first (see tests/e2e/ui_smoke.py)"
fi
echo "== all steps finished"
