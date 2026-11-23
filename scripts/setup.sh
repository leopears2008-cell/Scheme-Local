#!/usr/bin/env bash
# SchemeLocal – Setup (macOS / Linux)
# Run from the repository root: bash scripts/setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo ""
echo "====================================================="
echo "  SchemeLocal – Setup"
echo "====================================================="

# Backend
echo ""
echo "[1/4] Creating Python virtual environment..."
if [ ! -d "$BACKEND/.venv" ]; then
    python3 -m venv "$BACKEND/.venv"
    echo "  Created .venv"
else
    echo "  .venv already exists, skipping."
fi

echo ""
echo "[2/4] Installing backend dependencies..."
"$BACKEND/.venv/bin/pip" install -r "$BACKEND/requirements.txt" --quiet
echo "  Backend dependencies installed."

if [ ! -f "$BACKEND/.env" ]; then
    cp "$BACKEND/.env.example" "$BACKEND/.env"
    echo "  Copied backend/.env.example → backend/.env"
    echo "  ACTION REQUIRED: open backend/.env and fill in your keys."
else
    echo "  backend/.env already exists."
fi

# Frontend
echo ""
echo "[3/4] Installing frontend dependencies (npm ci)..."
cd "$FRONTEND" && npm ci --silent
echo "  Frontend dependencies installed."

if [ ! -f "$FRONTEND/.env" ]; then
    cp "$FRONTEND/.env.example" "$FRONTEND/.env"
    echo "  Copied frontend/.env.example → frontend/.env"
fi

echo ""
echo "[4/4] Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit backend/.env  — add GEMINI_API_KEY, SUPABASE_* keys"
echo "  2. Edit frontend/.env — add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY"
echo "  3. Run:  bash scripts/run.sh"
echo ""
echo "Find and Check work without any keys (guest mode / local JSON)."
echo ""
