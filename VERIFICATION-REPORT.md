# GENEVIEVE Super Response v1.7 Verification Report

## Result

**PASS — local, GitHub and Vercel deployment package verified.**

## Automated results

- 20 automated tests passed.
- Vercel API-handler tests passed.
- JavaScript syntax checks passed.
- Static project and deployment validation passed.
- Real local HTTP smoke test passed.
- Package contains no genuine API key.

## Behaviour verified

- OpenAI, Claude and Gemini requests execute in parallel.
- Missing providers are skipped without stopping configured providers.
- Deep mode assigns different expert roles to reduce duplicate answers.
- Every successful first answer is supplied to the final synthesis stage.
- Preferred synthesis-provider failure automatically falls through to another configured provider.
- A different available provider performs the optional final quality review.
- If every AI synthesis attempt fails, the deterministic merger preserves all successful answers.
- Authentication, quota, restriction, timeout and unavailable-model errors are classified safely.
- Runtime model fallback retries with a compatible model when the configured model is unavailable.
- Connection diagnostics never return provider secrets.

## Windows launcher verified by inspection and integration checks

- `START-GENEVIEVE.bat` calls the PowerShell launch controller.
- The controller checks Node.js, creates `.env.local` when needed, detects an existing GENEVIEVE server, finds a free port, starts the hidden server, polls `/api/health`, and only then opens the exact `127.0.0.1` address.
- No manual `localhost` entry is required.
- `STOP-GENEVIEVE.bat` terminates the saved process tree.
- `CREATE-DESKTOP-SHORTCUT.bat` creates a normal Windows shortcut.

The local build environment is Linux, so the final ZIP includes a separate GitHub Actions `windows-latest` job. That job parses every PowerShell file with the native Windows parser and launches the real Node server on Windows to test the homepage, health route and writable local settings route. The Linux package verification separately executed the underlying Node server and all core routes.

## Deployment configuration

- Node.js 22 is used in both Linux and Windows GitHub Actions jobs.
- Vercel functions use a 60-second maximum duration for broad plan compatibility.
- API keys remain server-side.
- GitHub publishing excludes `.env.local`, `.vercel`, logs and local process-state files.
- The Vercel deployment assistant verifies the live health and protected diagnostics routes after production deployment.

## Account-dependent boundary

No test environment can validate the user’s real OpenAI, Anthropic or Google credentials without receiving those private credentials. The in-app connection tester and Vercel deployment assistant perform that final account-specific validation on the user’s own computer and account.
