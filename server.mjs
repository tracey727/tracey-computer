import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError, getPublicHealth, runProviderDiagnostics, runSuperResponse } from "./lib/super-response.js";
import { getSettingsStatus, saveLocalSettings } from "./lib/local-settings.js";

const root = fileURLToPath(new URL(".", import.meta.url));

async function loadEnvFile(filename = ".env.local") {
  try {
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
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadEnvFile();

const port = Number.parseInt(process.env.PORT || "3000", 10);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1_000_000) {
      throw new AppError("Request body is too large.", 413, "REQUEST_TOO_LARGE");
    }
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new AppError("Request body must be valid JSON.", 400, "INVALID_JSON");
  }
}

async function serveStatic(pathname, response) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw Object.assign(new Error("Not found"), { code: "ENOENT" });
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": requested === "/index.html" ? "no-cache" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    response.end(body);
  } catch (error) {
    if (error?.code === "ENOENT") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    throw error;
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (url.pathname === "/api/health") {
      if (request.method !== "GET") return sendJson(response, 405, { ok: false, error: { message: "Use GET." } });
      return sendJson(response, 200, getPublicHealth(process.env));
    }

    if (url.pathname === "/api/settings") {
      if (request.method === "GET") return sendJson(response, 200, getSettingsStatus(process.env));
      if (request.method !== "POST") return sendJson(response, 405, { ok: false, error: { message: "Use GET or POST." } });

      const origin = String(request.headers.origin || "");
      if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return sendJson(response, 403, {
          ok: false,
          error: { code: "LOCAL_SETUP_ONLY", message: "API settings can only be changed from this computer." },
        });
      }

      const body = await readJsonBody(request);
      let status = await saveLocalSettings(body, { root, env: process.env });
      let diagnostics = body.testConnections === false
        ? null
        : await runProviderDiagnostics(process.env, fetch);

      const autoRepairs = {};
      if (diagnostics && body.autoRepairModels !== false) {
        const modelKeys = { openai: "OPENAI_MODEL", anthropic: "ANTHROPIC_MODEL", gemini: "GEMINI_MODEL" };
        for (const result of diagnostics.providers || []) {
          if (result.status === "model_unavailable" && result.recommendedModel) {
            autoRepairs[modelKeys[result.provider]] = result.recommendedModel;
          }
        }
      }

      if (Object.keys(autoRepairs).length) {
        status = await saveLocalSettings(autoRepairs, { root, env: process.env });
        diagnostics = await runProviderDiagnostics(process.env, fetch);
      }

      return sendJson(response, 200, { ...status, diagnostics, autoRepairs });
    }

    if (url.pathname === "/api/diagnostics") {
      if (request.method !== "POST") return sendJson(response, 405, { ok: false, error: { message: "Use POST." } });
      const requiredCode = process.env.APP_ACCESS_CODE?.trim();
      const suppliedCode = String(request.headers["x-app-access-code"] || "").trim();
      if (requiredCode && suppliedCode !== requiredCode) {
        return sendJson(response, 401, {
          ok: false,
          error: { code: "UNAUTHORISED", message: "The private access code is missing or incorrect." },
        });
      }
      const result = await runProviderDiagnostics(process.env, fetch);
      return sendJson(response, 200, result);
    }

    if (url.pathname === "/api/super-response") {
      if (request.method !== "POST") return sendJson(response, 405, { ok: false, error: { message: "Use POST." } });
      const requiredCode = process.env.APP_ACCESS_CODE?.trim();
      const suppliedCode = String(request.headers["x-app-access-code"] || "").trim();
      if (requiredCode && suppliedCode !== requiredCode) {
        return sendJson(response, 401, {
          ok: false,
          error: { code: "UNAUTHORISED", message: "The private access code is missing or incorrect." },
        });
      }
      const body = await readJsonBody(request);
      const result = await runSuperResponse(body, process.env, fetch);
      return sendJson(response, 200, result);
    }

    return await serveStatic(decodeURIComponent(url.pathname), response);
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    if (!(error instanceof AppError) || error.status >= 500) console.error(error);
    return sendJson(response, status, {
      ok: false,
      error: {
        code: error?.code || "INTERNAL_ERROR",
        message: error?.message || "Unexpected server error.",
        ...(error?.details ? { details: error.details } : {}),
      },
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`GENEVIEVE Super Response is running at http://localhost:${port}`);
  console.log("Press Ctrl+C to stop.");
});
