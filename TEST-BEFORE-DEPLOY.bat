@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install the current Node.js LTS release, then run this file again.
  pause
  exit /b 1
)
call npm run verify
if errorlevel 1 goto failed
echo.
echo ALL CHECKS PASSED.
echo - 20 automated logic and API tests passed.
echo - All selected providers run in parallel.
echo - Deep expert roles and automatic model fallback passed.
echo - All-answer synthesis, editor failover and independent review passed.
echo - Vercel API handlers and 60-second function configuration passed.
echo - Local static site, settings, security and HTTP smoke tests passed.
echo - GitHub and Vercel deployment assistants are present.
echo.
echo The software package is ready. Real provider authentication still requires your own account keys.
pause
exit /b 0
:failed
echo.
echo A deployment check failed. No deployment should be attempted until the error above is repaired.
pause
exit /b 1
