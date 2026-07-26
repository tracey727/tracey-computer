import test from "node:test";
import assert from "node:assert/strict";
import { AppError, getPublicHealth, runSuperResponse } from "../lib/super-response.js";

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const noRetry = { TRANSIENT_RETRIES: "0", FINAL_REVIEW_ENABLED: "false" };

test("health exposes readiness and model names without exposing keys", () => {
  const health = getPublicHealth({
    OPENAI_API_KEY: "secret",
    OPENAI_MODEL: "answer-model",
    OPENAI_SYNTHESIS_MODEL: "synthesis-model",
  });

  assert.equal(health.configuredProviders.openai, true);
  assert.equal(health.configuredProviders.anthropic, false);
  assert.equal(health.models.openai, "answer-model");
  assert.equal(health.synthesisModels.openai, "synthesis-model");
  assert.equal(JSON.stringify(health).includes("secret"), false);
});

test("one successful provider returns its answer without an unnecessary synthesis call", async () => {
  let calls = 0;
  const mockFetch = async (url) => {
    calls += 1;
    assert.match(String(url), /openai\.com/);
    return jsonResponse({ model: "mock-openai", output_text: "A strong standalone answer." });
  };

  const result = await runSuperResponse(
    { question: "Test question", providers: ["openai"] },
    { ...noRetry, OPENAI_API_KEY: "test", OPENAI_MODEL: "mock-openai" },
    mockFetch
  );

  assert.equal(result.ok, true);
  assert.equal(result.answers[0].status, "fulfilled");
  assert.equal(result.final.text, "A strong standalone answer.");
  assert.equal(result.final.usedSingleAnswerFallback, true);
  assert.equal(result.final.sourceAnswerCount, 1);
  assert.equal(calls, 1);
});

test("all three successful answers are included and OpenAI creates one final answer", async () => {
  const seenPrompts = [];
  const mockFetch = async (url, options) => {
    const target = String(url);
    const body = JSON.parse(options.body);

    if (target.includes("openai.com")) {
      seenPrompts.push(body.input);
      if (typeof body.input === "string" && body.input.includes("CANDIDATE ANSWERS")) {
        return jsonResponse({ model: "openai-synth", output_text: "Combined final answer." });
      }
      return jsonResponse({ model: "openai-model", output_text: "OpenAI unique point." });
    }
    if (target.includes("anthropic.com")) {
      const prompt = body.messages[0].content;
      seenPrompts.push(prompt);
      return jsonResponse({ model: "claude-model", content: [{ type: "text", text: "Claude unique point." }] });
    }
    if (target.includes("googleapis.com")) {
      const prompt = body.contents[0].parts[0].text;
      seenPrompts.push(prompt);
      return jsonResponse({ candidates: [{ content: { parts: [{ text: "Gemini unique point." }] } }] });
    }
    throw new Error(`Unexpected URL: ${target}`);
  };

  const result = await runSuperResponse(
    {
      question: "Compare the answers",
      providers: ["openai", "anthropic", "gemini"],
      synthesisProvider: "openai",
    },
    {
      ...noRetry,
      OPENAI_API_KEY: "openai-key",
      ANTHROPIC_API_KEY: "anthropic-key",
      GEMINI_API_KEY: "gemini-key",
    },
    mockFetch
  );

  const synthesisPrompt = seenPrompts.find((prompt) => prompt.includes("CANDIDATE ANSWERS"));
  assert.ok(synthesisPrompt);
  assert.match(synthesisPrompt, /OpenAI unique point/);
  assert.match(synthesisPrompt, /Claude unique point/);
  assert.match(synthesisPrompt, /Gemini unique point/);
  assert.equal(result.answers.filter((answer) => answer.status === "fulfilled").length, 3);
  assert.equal(result.final.text, "Combined final answer.");
  assert.equal(result.final.provider, "openai");
  assert.equal(result.final.sourceAnswerCount, 3);
  assert.deepEqual(result.final.sourceProviders, ["openai", "anthropic", "gemini"]);
  assert.equal(result.summary.successfulAnswerCount, 3);
});

test("synthesis automatically fails over to the next configured provider", async () => {
  const mockFetch = async (url, options) => {
    const target = String(url);
    const body = JSON.parse(options.body);

    if (target.includes("openai.com")) {
      if (body.input.includes("CANDIDATE ANSWERS")) {
        return jsonResponse({ error: { message: "OpenAI synthesis unavailable" } }, 400);
      }
      return jsonResponse({ model: "openai-model", output_text: "OpenAI answer." });
    }

    if (target.includes("anthropic.com")) {
      const prompt = body.messages[0].content;
      if (prompt.includes("CANDIDATE ANSWERS")) {
        return jsonResponse({
          model: "claude-synth",
          content: [{ type: "text", text: "Claude produced the final combined answer." }],
        });
      }
      return jsonResponse({
        model: "claude-model",
        content: [{ type: "text", text: "Claude answer." }],
      });
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  const result = await runSuperResponse(
    {
      question: "Use both answers",
      providers: ["openai", "anthropic"],
      synthesisProvider: "openai",
    },
    {
      ...noRetry,
      OPENAI_API_KEY: "openai-key",
      ANTHROPIC_API_KEY: "anthropic-key",
    },
    mockFetch
  );

  assert.equal(result.final.provider, "anthropic");
  assert.equal(result.final.text, "Claude produced the final combined answer.");
  assert.equal(result.final.synthesisAttempts.length, 2);
  assert.equal(result.final.synthesisAttempts[0].status, "rejected");
  assert.equal(result.final.synthesisAttempts[1].status, "fulfilled");
  assert.equal(result.final.usedDeterministicMerge, false);
});

test("if every synthesis server fails, the built-in merger preserves every successful answer", async () => {
  const mockFetch = async (url, options) => {
    const target = String(url);
    const body = JSON.parse(options.body);

    if (target.includes("openai.com")) {
      if (body.input.includes("CANDIDATE ANSWERS")) {
        return jsonResponse({ error: { message: "OpenAI synthesis failed" } }, 400);
      }
      return jsonResponse({ model: "openai-model", output_text: "First unique recommendation." });
    }

    if (target.includes("anthropic.com")) {
      const prompt = body.messages[0].content;
      if (prompt.includes("CANDIDATE ANSWERS")) {
        return jsonResponse({ error: { message: "Claude synthesis failed" } }, 400);
      }
      return jsonResponse({
        model: "claude-model",
        content: [{ type: "text", text: "Second unique safeguard." }],
      });
    }

    throw new Error(`Unexpected URL: ${target}`);
  };

  const result = await runSuperResponse(
    { question: "Merge safely", providers: ["openai", "anthropic"] },
    {
      ...noRetry,
      OPENAI_API_KEY: "openai-key",
      ANTHROPIC_API_KEY: "anthropic-key",
    },
    mockFetch
  );

  assert.equal(result.final.usedDeterministicMerge, true);
  assert.match(result.final.text, /First unique recommendation/);
  assert.match(result.final.text, /Second unique safeguard/);
  assert.equal(result.final.sourceAnswerCount, 2);
  assert.equal(result.final.synthesisAttempts.length, 2);
  assert.match(result.final.warning, /preserved and de-duplicated every successful answer/i);
});

test("missing provider keys are skipped while configured providers still work", async () => {
  const result = await runSuperResponse(
    { question: "Hello", providers: ["openai", "gemini"] },
    { ...noRetry, OPENAI_API_KEY: "test" },
    async () => jsonResponse({ model: "mock", output_text: "Hello back." })
  );

  assert.equal(result.answers[0].status, "fulfilled");
  assert.equal(result.answers[1].status, "skipped");
  assert.equal(result.final.text, "Hello back.");
  assert.equal(result.summary.skippedAnswerCount, 1);
});

test("empty questions are rejected", async () => {
  await assert.rejects(
    () =>
      runSuperResponse(
        { question: "   " },
        { ...noRetry, OPENAI_API_KEY: "test" },
        async () => jsonResponse({})
      ),
    (error) => error instanceof AppError && error.status === 400 && error.code === "QUESTION_REQUIRED"
  );
});


test("final quality review receives every source answer and the combined draft", async () => {
  const prompts = [];
  const mockFetch = async (url, options) => {
    const target = String(url);
    const body = JSON.parse(options.body);
    const prompt = target.includes("openai.com")
      ? body.input
      : target.includes("anthropic.com")
        ? body.messages[0].content
        : body.contents[0].parts[0].text;
    prompts.push(prompt);

    if (prompt.includes("CURRENT COMBINED DRAFT")) {
      assert.match(prompt, /OpenAI source point/);
      assert.match(prompt, /Claude source point/);
      assert.match(prompt, /Initial combined draft/);
      return jsonResponse({
        model: "claude-review",
        content: [{ type: "text", text: "Reviewed super best answer." }],
      });
    }
    if (prompt.includes("CANDIDATE ANSWERS")) {
      return jsonResponse({ model: "openai-synth", output_text: "Initial combined draft." });
    }
    if (target.includes("openai.com")) {
      return jsonResponse({ model: "openai-answer", output_text: "OpenAI source point." });
    }
    return jsonResponse({
      model: "claude-answer",
      content: [{ type: "text", text: "Claude source point." }],
    });
  };

  const result = await runSuperResponse(
    {
      question: "Create one best answer",
      providers: ["openai", "anthropic"],
      synthesisProvider: "openai",
    },
    {
      TRANSIENT_RETRIES: "0",
      FINAL_REVIEW_ENABLED: "true",
      OPENAI_API_KEY: "openai-key",
      ANTHROPIC_API_KEY: "anthropic-key",
    },
    mockFetch
  );

  assert.equal(result.final.text, "Reviewed super best answer.");
  assert.equal(result.final.sourceAnswerCount, 2);
  assert.equal(result.final.finalReview.status, "fulfilled");
  assert.equal(result.final.finalReview.provider, "anthropic");
});

test("connection diagnostics validates keys and configured model access without exposing secrets", async () => {
  const { runProviderDiagnostics } = await import("../lib/super-response.js");
  const mockFetch = async (url) => {
    const target = String(url);
    if (target.endsWith("/v1/models")) {
      return jsonResponse({ data: [{ id: "gpt-5-mini" }, { id: "gpt-5" }] });
    }
    if (target.endsWith("/v1/responses")) {
      return jsonResponse({ model: "gpt-5", output_text: "OK" });
    }
    if (target.includes("anthropic.com/v1/models")) {
      return jsonResponse({ data: [{ id: "claude-sonnet-5" }] });
    }
    if (target.includes("anthropic.com/v1/messages")) {
      return jsonResponse({ model: "claude-sonnet-5", content: [{ type: "text", text: "OK" }] });
    }
    if (target.includes("googleapis.com/v1beta/models?pageSize")) {
      return jsonResponse({
        models: [{ name: "models/gemini-3.5-flash", supportedGenerationMethods: ["generateContent"] }],
      });
    }
    if (target.includes("googleapis.com/v1beta/models/gemini-3.5-flash:generateContent")) {
      return jsonResponse({ candidates: [{ content: { parts: [{ text: "OK" }] } }] });
    }
    throw new Error(`Unexpected URL: ${target}`);
  };

  const result = await runProviderDiagnostics(
    {
      ...noRetry,
      OPENAI_API_KEY: "openai-secret",
      ANTHROPIC_API_KEY: "anthropic-secret",
      GEMINI_API_KEY: "gemini-secret",
    },
    mockFetch
  );

  assert.equal(result.summary.ready, 3);
  assert.equal(result.providers.every((item) => item.status === "ready"), true);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("openai-secret"), false);
  assert.equal(serialized.includes("anthropic-secret"), false);
  assert.equal(serialized.includes("gemini-secret"), false);
});

test("connection diagnostics explains an invalid API key clearly", async () => {
  const { runProviderDiagnostics } = await import("../lib/super-response.js");
  const result = await runProviderDiagnostics(
    { ...noRetry, OPENAI_API_KEY: "bad-key" },
    async () => jsonResponse({ error: { message: "Incorrect API key provided" } }, 401)
  );

  const openai = result.providers.find((item) => item.provider === "openai");
  assert.equal(openai.status, "error");
  assert.equal(openai.error.code, "AUTHENTICATION_FAILED");
  assert.match(openai.message, /rejected the API key/i);
});

test("when all providers fail the error includes safe provider-specific reasons", async () => {
  await assert.rejects(
    () => runSuperResponse(
      { question: "Hello", providers: ["openai"] },
      { ...noRetry, OPENAI_API_KEY: "bad-key" },
      async () => jsonResponse({ error: { message: "Incorrect API key provided" } }, 401)
    ),
    (error) => {
      assert.equal(error.code, "NO_PROVIDER_ANSWERS");
      assert.equal(error.details.answers[0].error.code, "AUTHENTICATION_FAILED");
      assert.equal(JSON.stringify(error.details).includes("bad-key"), false);
      return true;
    }
  );
});


test("provider requests automatically recover when the configured model is unavailable", async () => {
  let responseCalls = 0;
  const mockFetch = async (url, options = {}) => {
    const target = String(url);
    if (target.endsWith("/v1/responses")) {
      responseCalls += 1;
      const body = JSON.parse(options.body);
      if (body.model === "unavailable-model") {
        return jsonResponse({ error: { message: "model not found" } }, 404);
      }
      assert.equal(body.model, "gpt-5");
      return jsonResponse({ model: "gpt-5", output_text: "Recovered answer." });
    }
    if (target.endsWith("/v1/models")) {
      return jsonResponse({ data: [{ id: "text-embedding-3-small" }, { id: "gpt-5" }] });
    }
    throw new Error(`Unexpected URL: ${target}`);
  };

  const result = await runSuperResponse(
    { question: "Recover", providers: ["openai"], responseDepth: "deep" },
    { ...noRetry, OPENAI_API_KEY: "key", OPENAI_MODEL: "unavailable-model" },
    mockFetch
  );

  assert.equal(result.final.text, "Recovered answer.");
  assert.equal(result.answers[0].model, "gpt-5");
  assert.equal(result.answers[0].fallbackFromModel, "unavailable-model");
  assert.equal(responseCalls, 2);
});

test("deep mode assigns different expert roles to provider prompts", async () => {
  const prompts = [];
  const mockFetch = async (url, options) => {
    const target = String(url);
    const body = JSON.parse(options.body);
    if (target.includes("openai.com")) {
      prompts.push(body.input);
      return jsonResponse({ model: "openai", output_text: "OpenAI answer" });
    }
    if (target.includes("anthropic.com")) {
      prompts.push(body.messages[0].content);
      return jsonResponse({ model: "claude", content: [{ type: "text", text: "Claude answer" }] });
    }
    throw new Error(`Unexpected URL: ${target}`);
  };

  await runSuperResponse(
    { question: "Design carefully", providers: ["openai", "anthropic"], responseDepth: "deep", synthesisProvider: "openai" },
    { ...noRetry, OPENAI_API_KEY: "key", ANTHROPIC_API_KEY: "key" },
    mockFetch
  );

  assert.ok(prompts.some((prompt) => prompt.includes("solution architect")));
  assert.ok(prompts.some((prompt) => prompt.includes("critical reviewer")));
});

test("connection diagnostics catches billing or quota failures by making a real generation request", async () => {
  const { runProviderDiagnostics } = await import("../lib/super-response.js");
  const result = await runProviderDiagnostics(
    { ...noRetry, OPENAI_API_KEY: "valid-looking-key", OPENAI_MODEL: "gpt-5" },
    async (url) => {
      const target = String(url);
      if (target.endsWith("/v1/models")) {
        return jsonResponse({ data: [{ id: "gpt-5" }] });
      }
      if (target.endsWith("/v1/responses")) {
        return jsonResponse({ error: { message: "insufficient_quota" } }, 429);
      }
      throw new Error(`Unexpected URL: ${target}`);
    }
  );

  const openai = result.providers.find((item) => item.provider === "openai");
  assert.equal(openai.status, "error");
  assert.equal(openai.error.code, "QUOTA_OR_BILLING");
  assert.match(openai.message, /billing, quota or a rate limit/i);
});
