import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSettingsStatus, saveLocalSettings } from "../lib/local-settings.js";

test("local API setup saves secrets without returning them", async () => {
  const root = await mkdtemp(join(tmpdir(), "genevieve-settings-"));
  const env = {};
  try {
    const result = await saveLocalSettings(
      {
        OPENAI_API_KEY: "openai-secret",
        ANTHROPIC_API_KEY: "anthropic-secret",
        GEMINI_API_KEY: "gemini-secret",
        APP_ACCESS_CODE: "private-code",
        OPENAI_MODEL: "gpt-5.6-luna",
      },
      { root, env }
    );

    assert.equal(result.configured.openai, true);
    assert.equal(result.configured.anthropic, true);
    assert.equal(result.configured.gemini, true);
    assert.equal(JSON.stringify(result).includes("openai-secret"), false);

    const file = await readFile(join(root, ".env.local"), "utf8");
    assert.match(file, /OPENAI_API_KEY=openai-secret/);
    assert.match(file, /ANTHROPIC_API_KEY=anthropic-secret/);
    assert.match(file, /GEMINI_API_KEY=gemini-secret/);
    assert.equal(env.OPENAI_API_KEY, "openai-secret");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("deployed mode refuses browser key storage", async () => {
  await assert.rejects(
    () => saveLocalSettings({ OPENAI_API_KEY: "secret" }, { root: "/tmp", env: { VERCEL: "1" } }),
    (error) => error.code === "VERCEL_ENV_REQUIRED" && error.status === 409
  );
  assert.equal(getSettingsStatus({ VERCEL: "1" }).writable, false);
});
