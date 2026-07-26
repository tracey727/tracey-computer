# Security guidance

## Provider secrets

- Never place API keys in `index.html`, `app.js`, screenshots, chat messages, GitHub issues or source control.
- Use the in-app API Connection Setup only while running locally. It writes secrets to `.env.local` on that computer.
- `.env.local` is excluded by `.gitignore` and is never included in the deployment ZIP.
- The deployed Vercel page cannot write provider keys from the browser.
- `DEPLOY-TO-VERCEL.bat` transfers saved keys through the authenticated Vercel CLI as Sensitive variables for Production and Preview.
- Rotate a key immediately if it is exposed.

## Public deployment protection

- Set `APP_ACCESS_CODE` before sharing a Vercel address.
- The deployment assistant generates a strong code automatically when none exists.
- `/api/super-response` and `/api/diagnostics` require this code when configured.
- Keep the GitHub repository private unless the owner deliberately decides otherwise.
- Review provider usage dashboards and set spending limits where available.

## Application boundaries

- This package is intended for owner-controlled use. It does not include public user accounts, per-user billing, CAPTCHA or distributed rate limiting.
- Add proper identity, rate limiting and abuse monitoring before offering unrestricted use to other people.
- AI output may be incomplete or wrong. Important medical, legal, financial and safety decisions require appropriate professional verification.
