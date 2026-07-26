import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runProviderDiagnostics } from "../lib/super-response.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function loadEnvFile(filename = ".env.local") {
  const text = await readFile(join(root, filename), "utf8");
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

try {
  await loadEnvFile();
  console.log("\nGENEVIEVE API CONNECTION TEST\n");
  const result = await runProviderDiagnostics(process.env, fetch);
  for (const item of result.providers) {
    const symbol = item.status === "ready" ? "OK" : item.status === "missing" ? "--" : "!!";
    console.log(`[${symbol}] ${item.label}: ${item.message}`);
    if (item.error?.technicalMessage && item.error.technicalMessage !== item.message) {
      console.log(`     Provider detail: ${item.error.technicalMessage}`);
    }
  }
  console.log(`\nReady: ${result.summary.ready} | Missing: ${result.summary.missing} | Errors: ${result.summary.errors} | Model issues: ${result.summary.modelUnavailable}`);
  console.log("\nNo secret key values were printed.\n");
  process.exitCode = result.summary.ready > 0 ? 0 : 1;
} catch (error) {
  console.error(`\nConnection test could not run: ${error?.message || error}\n`);
  process.exitCode = 1;
}
