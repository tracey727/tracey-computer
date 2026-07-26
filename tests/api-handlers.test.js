import test from "node:test";
import assert from "node:assert/strict";
import healthHandler from "../api/health.js";
import superResponseHandler from "../api/super-response.js";
import diagnosticsHandler from "../api/diagnostics.js";
import settingsHandler from "../api/settings.js";

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    end(value = "") {
      this.body = String(value);
    },
  };
}

test("Vercel health handler returns safe JSON", () => {
  const response = createResponse();
  healthHandler({ method: "GET" }, response);

  assert.equal(response.statusCode, 200);
  const data = JSON.parse(response.body);
  assert.equal(data.ok, true);
  assert.equal(data.service, "GENEVIEVE Super Response");
  assert.equal(JSON.stringify(data).includes("API_KEY"), false);
});

test("Vercel super-response handler rejects unsupported methods", async () => {
  const response = createResponse();
  await superResponseHandler({ method: "GET", headers: {} }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(JSON.parse(response.body).error.code, "METHOD_NOT_ALLOWED");
});

test("Vercel super-response handler safely rejects malformed JSON", async () => {
  const response = createResponse();
  await superResponseHandler(
    { method: "POST", headers: {}, body: "{not-json" },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).error.code, "INVALID_JSON");
});


test("Vercel diagnostics handler rejects unsupported methods", async () => {
  const response = createResponse();
  await diagnosticsHandler({ method: "GET", headers: {} }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(JSON.parse(response.body).error.code, "METHOD_NOT_ALLOWED");
});


test("Vercel settings handler exposes instructions but never accepts browser secrets", () => {
  const getResponse = createResponse();
  settingsHandler({ method: "GET" }, getResponse);
  assert.equal(getResponse.statusCode, 200);
  assert.equal(JSON.parse(getResponse.body).writable, false);

  const postResponse = createResponse();
  settingsHandler({ method: "POST" }, postResponse);
  assert.equal(postResponse.statusCode, 409);
  assert.equal(JSON.parse(postResponse.body).error.code, "VERCEL_ENV_REQUIRED");
});
