import { getSettingsStatus } from "../lib/local-settings.js";

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
}

export default function handler(request, response) {
  if (request.method === "GET") {
    return sendJson(response, 200, getSettingsStatus({ ...process.env, VERCEL: process.env.VERCEL || "1" }));
  }

  response.setHeader("Allow", "GET");
  return sendJson(response, 409, {
    ok: false,
    error: {
      code: "VERCEL_ENV_REQUIRED",
      message:
        "This deployed app cannot save API keys from the browser. Add OPENAI_API_KEY, ANTHROPIC_API_KEY and GEMINI_API_KEY in Vercel Project Settings → Environment Variables, then redeploy.",
    },
  });
}
