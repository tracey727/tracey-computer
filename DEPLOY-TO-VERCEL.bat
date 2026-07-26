@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy-vercel.ps1"
if errorlevel 1 (
  echo.
  echo Deployment did not complete. Read the exact message above.
)
pause
