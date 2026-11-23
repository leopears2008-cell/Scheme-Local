# SchemeLocal - Windows Setup Script (PowerShell)
# Run from the repository root: .\scripts\setup.ps1
# This script: creates .venv, installs backend deps, installs frontend deps, copies .env examples.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  SchemeLocal – Setup" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$root = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

# ── Backend ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[1/4] Setting up Python virtual environment..." -ForegroundColor Yellow
$venv = Join-Path $backend ".venv"
if (-not (Test-Path $venv)) {
    python -m venv $venv
    Write-Host "  Created .venv" -ForegroundColor Green
} else {
    Write-Host "  .venv already exists, skipping." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "[2/4] Installing backend dependencies..." -ForegroundColor Yellow
$pip = Join-Path $venv "Scripts\pip.exe"
& $pip install -r (Join-Path $backend "requirements.txt") --quiet
Write-Host "  Backend dependencies installed." -ForegroundColor Green

# .env
$envFile = Join-Path $backend ".env"
$envExample = Join-Path $backend ".env.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host ""
    Write-Host "  Copied backend/.env.example → backend/.env" -ForegroundColor Green
    Write-Host "  ACTION REQUIRED: open backend/.env and fill in your keys." -ForegroundColor Magenta
} else {
    Write-Host "  backend/.env already exists." -ForegroundColor DarkGray
}

# ── Frontend ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Installing frontend dependencies (npm ci)..." -ForegroundColor Yellow
Push-Location $frontend
npm ci --silent
Pop-Location
Write-Host "  Frontend dependencies installed." -ForegroundColor Green

$feEnv = Join-Path $frontend ".env"
$feExample = Join-Path $frontend ".env.example"
if (-not (Test-Path $feEnv)) {
    Copy-Item $feExample $feEnv
    Write-Host "  Copied frontend/.env.example → frontend/.env" -ForegroundColor Green
} else {
    Write-Host "  frontend/.env already exists." -ForegroundColor DarkGray
}

# ── Summary ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit backend/.env  — add GEMINI_API_KEY, SUPABASE_* keys" -ForegroundColor White
Write-Host "  2. Edit frontend/.env — add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY" -ForegroundColor White
Write-Host "  3. Run:  .\scripts\run.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Find and Check work without any keys (guest mode / local JSON)." -ForegroundColor DarkGray
Write-Host "Talk, Docs, Voice need GEMINI_API_KEY." -ForegroundColor DarkGray
Write-Host "Admin, Track, Apply history need Supabase." -ForegroundColor DarkGray
Write-Host ""
