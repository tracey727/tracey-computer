@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the current Node.js LTS version, then run this file again.
  pause
  exit /b 1
)
if not exist .env.local (
  echo No .env.local file exists yet. Opening the configuration helper.
  call CONFIGURE-API-KEYS.bat
  exit /b 0
)
node scripts\check-api-keys.mjs
pause
