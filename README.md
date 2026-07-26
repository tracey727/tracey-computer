# GENEVIEVE Super Response v1.6

A secure multi-model web application for Windows, GitHub and Vercel.

## Critical GitHub/Vercel 404 fix

This release creates a deterministic `public/index.html` during every build and tells Vercel exactly which build command and output directory to use. The downloadable ZIP is also packaged with the project files at the ZIP root, not hidden inside an extra parent folder.

For GitHub, `package.json`, `vercel.json`, `index.html`, `api`, `lib`, `scripts` and `public` must all appear on the repository's first page. Do not upload one enclosing folder that contains those files.

For Vercel, use:

- Framework Preset: **Other**
- Root Directory: **leave blank / repository root**
- Build Command: detected from `vercel.json` as `npm run build`
- Output Directory: detected from `vercel.json` as `public`

Do not manually set an old output directory such as `dist`, `build`, or the previous enclosing folder name.

It sends one question to every selected, working AI provider in parallel, gives each provider a different expert role in Deep mode, combines every useful answer, audits disagreements, and produces one final **Super Best Answer**.

## What changed in v1.6

- One-click Windows launch. You no longer type `localhost` or any web address.
- The launcher waits for the server to be ready before opening the browser.
- It uses `127.0.0.1` directly, detects occupied ports, and moves automatically from port 3000 up to 3015 when needed.
- API keys can be pasted into the app’s own secure local setup page.
- Local keys are written only to `.env.local`, which Git ignores.
- Model discovery and automatic fallback recover when a configured model is unavailable to your account.
- Deep Expert Panel mode assigns different roles to OpenAI, Claude and Gemini instead of asking all three to produce near-identical answers.
- One model synthesises every successful answer; a different available model performs a final quality review.
- The Vercel deployment budget is capped at 60 seconds for broad Hobby/Pro compatibility.
- GitHub and Vercel deployment assistants are included.
- Deployment verification stops rather than falsely claiming success when a live route or provider connection fails.

## Start on your Windows computer

1. Extract the ZIP into a new folder.
2. Double-click **`START-GENEVIEVE.bat`**.
3. Wait. The browser opens automatically when the server is ready.
4. In **Connect your API keys**, paste at least one provider key.
5. Select **Save keys & test connections**.
6. When a provider shows **READY**, enter a question and select **Build Super Best Answer**.

Do not type `localhost`. Do not open `index.html` directly. Always use `START-GENEVIEVE.bat`.

To close the local background server, double-click **`STOP-GENEVIEVE.bat`**.

To place a convenient icon on your Windows desktop, double-click **`CREATE-DESKTOP-SHORTCUT.bat`** once.

## API keys

The application does not contain shared or free provider keys. Each provider issues keys only inside the account that owns the billing and permissions.

Supported server variables:

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
APP_ACCESS_CODE=
```

Create keys using the providers’ official consoles:

- OpenAI API Platform: `https://platform.openai.com/api-keys`
- Anthropic Claude Platform: `https://platform.claude.com/settings/keys`
- Google AI Studio: `https://aistudio.google.com/app/apikey`

A ChatGPT subscription and OpenAI API billing are separate products.

## How the Super Best Answer is built

### Deep Expert Panel mode

- **OpenAI:** solution architecture, practical implementation and reasoning verification.
- **Claude:** risks, ambiguity, edge cases and safeguards.
- **Gemini:** alternative strategies, comparisons and overlooked opportunities.

The three first answers run simultaneously. Every successful answer is then placed into one synthesis prompt. The final editor must preserve unique useful points, remove repetition, reconcile contradictions and mark unresolved uncertainty. A second available provider reviews the combined draft before it is returned.

If one provider fails, the others continue. If the preferred synthesis model fails, another configured provider is tried. If every AI synthesis attempt fails, the deterministic merger preserves and de-duplicates all successful answers instead of losing them.

## Automatic model recovery

The connection tester lists models available to each API account. When a locally configured model is unavailable, the server selects the best compatible model from a maintained fallback list, saves that repair locally, and tests again. Runtime requests also retry once with an available compatible model when a provider rejects the configured model.

Current defaults:

```env
OPENAI_MODEL=gpt-5.6-luna
ANTHROPIC_MODEL=claude-sonnet-5
GEMINI_MODEL=gemini-3.5-flash
```

All model names remain editable under **Advanced connection settings**.

## Publish to a private GitHub repository

Double-click **`PUBLISH-TO-GITHUB.bat`**.

The assistant:

1. Runs all tests and deployment checks.
2. Signs into GitHub CLI when needed.
3. Creates a private repository or updates the existing `origin` repository.
4. Pushes the verified project.
5. Opens the repository in your browser.

Git and GitHub CLI must be installed. The script opens the official installer page when either is missing. `.env.local` is excluded from Git and must never be committed.

The included GitHub Action runs the full Linux verification suite and a separate real `windows-latest` PowerShell/server smoke test on every push and pull request.

## Deploy to Vercel

The safest complete path is:

1. Start the app locally and save/test at least one API key.
2. Double-click **`DEPLOY-TO-VERCEL.bat`**.
3. Complete the Vercel browser login and project selection.

The deployment assistant then:

- runs all 20+ automated tests and the local smoke test;
- creates a private access code when one is not already present;
- uploads provider keys and the access code as **Sensitive** Vercel variables for Production and Preview;
- creates the production deployment;
- calls the live `/api/health` route;
- calls the protected live `/api/diagnostics` route;
- opens the live address only after verification succeeds.

The script never uploads `.env.local` to GitHub.

You can also import the private GitHub repository through the Vercel dashboard. In that case, add these variables manually under **Project → Settings → Environment Variables** for Production and Preview, then redeploy:

```text
OPENAI_API_KEY
ANTHROPIC_API_KEY
GEMINI_API_KEY
APP_ACCESS_CODE
```

## Manual verification

Run:

```text
TEST-BEFORE-DEPLOY.bat
```

Or from a terminal:

```bash
npm run verify
```

This executes unit tests, API-handler tests, static deployment validation and a real local HTTP smoke test.

## Security

- API keys are server-side only.
- Keys are never returned by `/api/health`, `/api/settings` or diagnostics.
- The browser never stores provider secrets in local storage.
- Deployed browser key saving is deliberately blocked.
- `APP_ACCESS_CODE` protects the expensive API routes on public Vercel addresses.
- Provider errors are classified without exposing the submitted key.
- `.env.local`, `.vercel`, logs and local process-state files are excluded from Git.

See `SECURITY.md` for more detail.

## Important limitation

The project can be fully built and tested without account access, but no one can issue provider API credentials or complete provider billing on behalf of the account owner. The included deployment assistant performs the authenticated Vercel steps after you sign in.
