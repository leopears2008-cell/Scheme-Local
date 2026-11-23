# SchemeLocal - Windows Run Script (PowerShell)
# Run from the repository root: .\scripts\run.ps1
# Starts backend (port 8000) and frontend dev server (port 5173) simultaneously.

$root = Split-Path $PSScriptRoot -Parent
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$python = Join-Path $backend ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "ERROR: .venv not found. Run .\scripts\setup.ps1 first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  SchemeLocal – Starting development servers" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "  Press Ctrl+C in each window to stop." -ForegroundColor DarkGray
Write-Host ""

# Start backend in a new window
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$backend'; Write-Host 'SchemeLocal Backend' -ForegroundColor Cyan; & '$python' -m uvicorn app:app --reload --port 8000"
) -WindowStyle Normal

# Give backend 2 seconds to start, then start frontend
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$frontend'; Write-Host 'SchemeLocal Frontend' -ForegroundColor Cyan; npm run dev"
) -WindowStyle Normal

Write-Host "Both servers are starting in separate windows." -ForegroundColor Green
Write-Host "Open http://localhost:5173 in your browser." -ForegroundColor Cyan
