import { spawn } from "node:child_process";
import { once } from "node:events";

const port = 43123 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const accessCode = "deployment-smoke-code";

const child = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    APP_ACCESS_CODE: accessCode,
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    GEMINI_API_KEY: "",
    GOOGLE_API_KEY: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => { output += chunk; });
child.stderr.on("data", (chunk) => { output += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Local server exited before becoming ready.\n${output}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Local server did not become ready.\n${output}`);
}

async function expectStatus(path, options, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, options);
  if (response.status !== expectedStatus) {
    const text = await response.text();
    throw new Error(`${path} returned ${response.status}, expected ${expectedStatus}. Body: ${text}`);
  }
  return response;
}

try {
  await waitForServer();

  const home = await expectStatus("/", {}, 200);
  const html = await home.text();
  if (!html.includes("GENEVIEVE Super Response")) {
    throw new Error("Homepage did not contain the expected application title.");
  }

  const settings = await expectStatus("/api/settings", {}, 200);
  const settingsData = await settings.json();
  if (!settingsData.ok || settingsData.writable !== true) {
    throw new Error("Local API settings endpoint was not writable.");
  }

  const health = await expectStatus("/api/health", {}, 200);
  const healthData = await health.json();
  if (!healthData.ok || healthData.service !== "GENEVIEVE Super Response") {
    throw new Error("Health endpoint returned an unexpected payload.");
  }
  if (JSON.stringify(healthData).toLowerCase().includes("deployment-smoke-code")) {
    throw new Error("Health endpoint exposed the private access code.");
  }

  await expectStatus(
    "/api/super-response",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "test" }),
    },
    401
  );

  await expectStatus(
    "/api/diagnostics",
    { method: "POST" },
    401
  );

  const diagnostics = await expectStatus(
    "/api/diagnostics",
    {
      method: "POST",
      headers: { "x-app-access-code": accessCode },
    },
    200
  );
  const diagnosticsData = await diagnostics.json();
  if (!diagnosticsData.ok || diagnosticsData.summary.missing !== 3) {
    throw new Error("Diagnostics endpoint returned an unexpected payload.");
  }

  await expectStatus(
    "/api/super-response",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-access-code": accessCode,
      },
      body: JSON.stringify({ question: "   " }),
    },
    400
  );

  await expectStatus("/api/super-response", { method: "GET" }, 405);
  await expectStatus("/missing-page", {}, 404);

  console.log("Local server smoke test passed: static site, local API settings, health route, access protection, validation and 404 handling.");
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit"),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}
