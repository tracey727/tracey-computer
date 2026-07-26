# GENEVIEVE Super Response v1.7 — Deployment Checklist

## Local acceptance

- [ ] Extracted into a new folder rather than overwriting v1.4.
- [ ] Double-clicked `START-GENEVIEVE.bat`.
- [ ] Browser opened automatically at `127.0.0.1`.
- [ ] At least one provider key saved through the API Connection Setup page.
- [ ] At least one provider reports READY.
- [ ] A real question produced a final Super Best Answer.
- [ ] `TEST-BEFORE-DEPLOY.bat` completes without errors.

## GitHub

- [ ] Repository is private.
- [ ] `.env.local` is not visible in the repository.
- [ ] GitHub Actions verification is green.
- [ ] `package.json`, `vercel.json`, `api/`, `lib/`, `index.html`, `app.js` and `styles.css` are at repository root.

## Vercel

- [ ] Project root is the repository root, not a parent folder.
- [ ] Framework Preset is Other/None.
- [ ] No unnecessary Build Command is configured.
- [ ] `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and/or `GEMINI_API_KEY` exist in Production.
- [ ] The same required provider keys exist in Preview.
- [ ] `APP_ACCESS_CODE` exists in Production and Preview.
- [ ] A fresh deployment was created after changing environment variables.
- [ ] `/api/health` returns the GENEVIEVE service payload.
- [ ] Test API connections reports at least one READY provider.
- [ ] A live question produces one final answer.

Using `DEPLOY-TO-VERCEL.bat` performs and verifies most Vercel items automatically after account login.
