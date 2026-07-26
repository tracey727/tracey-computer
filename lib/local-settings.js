import { readFile, writeFile, rename, chmod } from "node:fs/promises";
import { join } from "node:path";

const EDITABLE_KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "OPENAI_MODEL",
  "ANTHROPIC_MODEL",
  "GEMINI_MODEL",
  "SYNTHESIS_PROVIDER",
  "APP_ACCESS_CODE",
];

const SECRET_KEYS = new Set([
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "APP_ACCESS_CODE",
]);

const DEFAULT_MODELS = {
  OPENAI_MODEL: "gpt-5",
  ANTHROPIC_MODEL: "claude-sonnet-5",
  GEMINI_MODEL: "gemini-3.5-flash",
  SYNTHESIS_PROVIDER: "auto",
};

function cleanValue(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n\0]/g, "").trim().slice(0, maxLength);
}

export function isLocalSettingsWritable(env = process.env) {
  return !env.VERCEL && !env.AWS_LAMBDA_FUNCTION_NAME;
}

export function getSettingsStatus(env = process.env) {
  return {
    ok: true,
    mode: isLocalSettingsWritable(env) ? "local" : "vercel",
    writable: isLocalSettingsWritable(env),
    configured: {
      openai: Boolean(env.OPENAI_API_KEY?.trim()),
      anthropic: Boolean(env.ANTHROPIC_API_KEY?.trim()),
      gemini: Boolean((env.GEMINI_API_KEY || env.GOOGLE_API_KEY)?.trim()),
      accessCode: Boolean(env.APP_ACCESS_CODE?.trim()),
    },
    models: {
      openai: env.OPENAI_MODEL?.trim() || DEFAULT_MODELS.OPENAI_MODEL,
      anthropic: env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODELS.ANTHROPIC_MODEL,
      gemini: env.GEMINI_MODEL?.trim() || DEFAULT_MODELS.GEMINI_MODEL,
    },
    synthesisProvider: env.SYNTHESIS_PROVIDER?.trim() || DEFAULT_MODELS.SYNTHESIS_PROVIDER,
  };
}

function updateEnvText(existingText, updates) {
  const lines = existingText.replace(/^\uFEFF/, "").split(/\r?\n/);
  const seen = new Set();
  const output = lines.map((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (!match || !(match[1] in updates)) return line;
    const key = match[1];
    seen.add(key);
    return `${key}=${updates[key]}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) output.push(`${key}=${value}`);
  }

  return `${output.join("\n").replace(/\n+$/, "")}\n`;
}

export async function saveLocalSettings(input, { root, env = process.env } = {}) {
  if (!isLocalSettingsWritable(env)) {
    const error = new Error(
      "Keys cannot be saved from a deployed webpage. Add them in Vercel Project Settings → Environment Variables, then redeploy."
    );
    error.status = 409;
    error.code = "VERCEL_ENV_REQUIRED";
    throw error;
  }
  if (!root) throw new Error("Local settings root is required.");

  const incoming = input && typeof input === "object" ? input : {};
  const clearKeys = new Set(Array.isArray(incoming.clearKeys) ? incoming.clearKeys : []);
  const updates = {};

  for (const key of EDITABLE_KEYS) {
    const maxLength = SECRET_KEYS.has(key) ? 500 : 120;
    const value = cleanValue(incoming[key], maxLength);
    if (clearKeys.has(key)) {
      updates[key] = "";
      delete env[key];
    } else if (value) {
      updates[key] = value;
      env[key] = value;
    }
  }

  const envPath = join(root, ".env.local");
  const existing = await safeRead(envPath);

  for (const [key, fallback] of Object.entries(DEFAULT_MODELS)) {
    if (!env[key]?.trim()) env[key] = fallback;
    if (!(key in updates) && !existingHasValue(existing, key)) updates[key] = env[key];
  }

  if (!Object.keys(updates).length) return getSettingsStatus(env);

  const tempPath = join(root, `.env.local.${process.pid}.tmp`);
  const next = updateEnvText(existing, updates);
  await writeFile(tempPath, next, { encoding: "utf8", mode: 0o600 });
  await rename(tempPath, envPath);
  try { await chmod(envPath, 0o600); } catch { /* Windows may ignore POSIX permissions. */ }

  return getSettingsStatus(env);
}

async function safeRead(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

function existingHasValue(text, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^\\s*${escaped}\\s*=\\s*(.+)$`, "m"));
  return Boolean(match?.[1]?.trim());
}
