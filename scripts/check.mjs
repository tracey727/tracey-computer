import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { getPublicHealth } from "../lib/super-response.js";

const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "server.mjs",
  "api/super-response.js",
  "api/diagnostics.js",
  "api/health.js",
  "api/settings.js",
  "lib/local-settings.js",
  "lib/super-response.js",
  "vercel.json",
  ".env.example",
  ".github/workflows/ci.yml",
  "scripts/smoke.mjs",
  "scripts/check-api-keys.mjs",
  "scripts/build.mjs",
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "public/service-worker.js",
  "CONFIGURE-API-KEYS.bat",
  "TEST-API-KEYS.bat",
  "tests/super-response.test.js",
  "tests/api-handlers.test.js",
  "tests/local-settings.test.js",
  "tests/deployment-output.test.js",
  "OPEN-API-SETUP.bat",
  "START-GENEVIEVE.bat",
  "STOP-GENEVIEVE.bat",
  "CREATE-DESKTOP-SHORTCUT.bat",
  "DEPLOY-TO-VERCEL.bat",
  "scripts/windows-launch.ps1",
  "scripts/windows-stop.ps1",
  "scripts/create-shortcut.ps1",
  "scripts/deploy-vercel.ps1",
  "scripts/publish-github.ps1",
  "scripts/windows-ci-smoke.ps1",
  "PUBLISH-TO-GITHUB.bat",
];

for (const file of requiredFiles) {
  await access(new URL(`../${file}`, import.meta.url), constants.R_OK);
}

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));

if (packageJson.type !== "module") throw new Error("package.json must use ES modules.");
if (!packageJson.scripts?.verify || !packageJson.scripts?.build) throw new Error("package.json is missing the build or verify script.");
if (vercel.framework !== null) throw new Error("vercel.json must explicitly use the Other framework preset.");
if (vercel.buildCommand !== "npm run build") throw new Error("Vercel must run the deterministic static build.");
if (vercel.outputDirectory !== "public") throw new Error("Vercel outputDirectory must be public to prevent homepage 404 errors.");
if (!vercel.rewrites?.some((rule) => rule.source === "/" && rule.destination === "/index.html")) {
  throw new Error("Vercel must explicitly map the homepage to /index.html.");
}
if (vercel.functions?.["api/*.js"]?.maxDuration !== 60) {
  throw new Error("Vercel API functions must stay within the universally compatible 60-second deployment budget.");
}

const source = await readFile(new URL("../lib/super-response.js", import.meta.url), "utf8");
for (const providerHost of ["api.openai.com", "api.anthropic.com", "generativelanguage.googleapis.com"]) {
  if (!source.includes(providerHost)) throw new Error(`Missing provider endpoint: ${providerHost}`);
}
if (!source.includes("synthesisAttempts")) throw new Error("Synthesis failover logic is missing.");
if (!source.includes("deterministicMerge")) throw new Error("All-answer fallback merger is missing.");
if (!source.includes("finalReview")) throw new Error("Final answer quality review is missing.");
if (!source.includes("runProviderDiagnostics")) throw new Error("Provider connection diagnostics are missing.");
if (!source.includes("AUTHENTICATION_FAILED")) throw new Error("Friendly API-key error classification is missing.");
if (!source.includes("callProvider")) throw new Error("Automatic model fallback is missing.");
if (!source.includes("PROVIDER_ROLES")) throw new Error("Deep expert-panel role diversification is missing.");

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
if (!html.includes("apiSettingsForm") || !html.includes("Save keys &amp; test connections")) {
  throw new Error("In-app API connection setup is missing.");
}

const health = getPublicHealth({});
if (!health.ok || health.service !== "GENEVIEVE Super Response") {
  throw new Error("Health configuration check failed.");
}

console.log(
  `Project check passed: ${requiredFiles.length} required files, one-click Windows launcher, deterministic public/index.html output, explicit Vercel homepage routing, three provider endpoints, automatic model fallback, deep expert roles, synthesis failover, diagnostics, final review and all-answer fallback.`
);
