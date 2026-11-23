#!/usr/bin/env bash
# SchemeLocal – Run (macOS / Linux)
# Run from the repository root: bash scripts/run.sh
# Starts backend (:8000) and frontend (:5173) in background processes.
# Ctrl+C kills both.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
PYTHON="$BACKEND/.venv/bin/python"

if [ ! -f "$PYTHON" ]; then
    echo "ERROR: .venv not found. Run: bash scripts/setup.sh first."
    exit 1
fi

cleanup() {
    echo ""
    echo "Stopping servers…"
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    exit 0
}
trap cleanup INT TERM

echo ""
echo "====================================================="
echo "  SchemeLocal – Starting development servers"
echo "====================================================="
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo "  Press Ctrl+C to stop both."
echo ""

# Start backend
(cd "$BACKEND" && "$PYTHON" -m uvicorn app:app --reload --port 8000) &
BACKEND_PID=$!

# Give backend 2 seconds to initialise
sleep 2

# Start frontend
(cd "$FRONTEND" && npm run dev) &
FRONTEND_PID=$!

echo "Both servers started. Backend PID=$BACKEND_PID, Frontend PID=$FRONTEND_PID"
wait
