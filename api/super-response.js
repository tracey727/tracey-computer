import { AppError, runSuperResponse } from "../lib/super-response.js";

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
}

function parseBody(body) {
  if (body == null || body === "") return {};
  if (typeof body === "object" && !Buffer.isBuffer(body)) return body;

  const text = Buffer.isBuffer(body) ? body.toString("utf8") : String(body);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("Request body must be valid JSON.", 400, "INVALID_JSON");
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use POST for this endpoint." },
    });
  }

  try {
    const requiredCode = process.env.APP_ACCESS_CODE?.trim();
    const suppliedCode = String(request.headers["x-app-access-code"] || "").trim();
    if (requiredCode && suppliedCode !== requiredCode) {
      return sendJson(response, 401, {
        ok: false,
        error: { code: "UNAUTHORISED", message: "The private access code is missing or incorrect." },
      });
    }

    const result = await runSuperResponse(parseBody(request.body), process.env, fetch);
    return sendJson(response, 200, result);
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    if (status >= 500) console.error(error);
    return sendJson(response, status, {
      ok: false,
      error: {
        code: error?.code || "INTERNAL_ERROR",
        message: error?.message || "Unexpected server error.",
        ...(error?.details ? { details: error.details } : {}),
      },
    });
  }
}
