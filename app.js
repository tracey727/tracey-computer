const form = document.querySelector("#questionForm");
const questionInput = document.querySelector("#question");
const characterCount = document.querySelector("#characterCount");
const submitButton = document.querySelector("#submitButton");
const progressSection = document.querySelector("#progressSection");
const progressTitle = document.querySelector("#progressTitle");
const progressText = document.querySelector("#progressText");
const errorSection = document.querySelector("#errorSection");
const errorText = document.querySelector("#errorText");
const resultsSection = document.querySelector("#resultsSection");
const answerGrid = document.querySelector("#answerGrid");
const finalAnswer = document.querySelector("#finalAnswer");
const finalMeta = document.querySelector("#finalMeta");
const finalWarning = document.querySelector("#finalWarning");
const timingLabel = document.querySelector("#timingLabel");
const connectionBadge = document.querySelector("#connectionBadge");
const copyButton = document.querySelector("#copyButton");
const accessCodeWrap = document.querySelector("#accessCodeWrap");
const accessCodeInput = document.querySelector("#accessCode");
const testConnectionsButton = document.querySelector("#testConnectionsButton");
const diagnosticsSection = document.querySelector("#diagnosticsSection");
const diagnosticsGrid = document.querySelector("#diagnosticsGrid");
const diagnosticsSummary = document.querySelector("#diagnosticsSummary");
const errorDetails = document.querySelector("#errorDetails");
let appRequiresAccessCode = false;

const apiSettingsForm = document.querySelector("#apiSettingsForm");
const localSetupPanel = document.querySelector("#localSetupPanel");
const deployedSetupPanel = document.querySelector("#deployedSetupPanel");
const setupModeBadge = document.querySelector("#setupModeBadge");
const saveSettingsButton = document.querySelector("#saveSettingsButton");
const settingsSaveTitle = document.querySelector("#settingsSaveTitle");
const settingsSaveMessage = document.querySelector("#settingsSaveMessage");
const showApiKeys = document.querySelector("#showApiKeys");
const setupAccessCode = document.querySelector("#setupAccessCode");

const settingInputs = {
  OPENAI_API_KEY: document.querySelector("#openaiKey"),
  ANTHROPIC_API_KEY: document.querySelector("#anthropicKey"),
  GEMINI_API_KEY: document.querySelector("#geminiKey"),
  OPENAI_MODEL: document.querySelector("#openaiModelSetting"),
  ANTHROPIC_MODEL: document.querySelector("#anthropicModelSetting"),
  GEMINI_MODEL: document.querySelector("#geminiModelSetting"),
  SYNTHESIS_PROVIDER: document.querySelector("#setupSynthesisProvider"),
  APP_ACCESS_CODE: setupAccessCode,
};

const setupStateElements = {
  openai: document.querySelector("#openaiSetupState"),
  anthropic: document.querySelector("#anthropicSetupState"),
  gemini: document.querySelector("#geminiSetupState"),
};

const providerElements = {
  openai: {
    state: document.querySelector("#openaiState"),
    model: document.querySelector("#openaiModel"),
    checkbox: document.querySelector('input[value="openai"]'),
  },
  anthropic: {
    state: document.querySelector("#anthropicState"),
    model: document.querySelector("#anthropicModel"),
    checkbox: document.querySelector('input[value="anthropic"]'),
  },
  gemini: {
    state: document.querySelector("#geminiState"),
    model: document.querySelector("#geminiModel"),
    checkbox: document.querySelector('input[value="gemini"]'),
  },
};

function formatDuration(ms = 0) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  questionInput.disabled = isLoading;
  document.querySelectorAll('input[name="provider"], #synthesisProvider, #responseDepth').forEach((element) => {
    element.disabled = isLoading;
  });
  progressSection.classList.toggle("hidden", !isLoading);
  submitButton.querySelector("span").textContent = isLoading ? "Building response…" : "Build Super Best Answer";
}

function showError(message, answers = []) {
  errorText.textContent = message;
  errorDetails.innerHTML = "";
  for (const answer of answers || []) {
    if (answer.status === "fulfilled") continue;
    const item = document.createElement("div");
    item.className = "error-detail";
    item.textContent = `${answer.label || answer.provider}: ${answer.error?.message || "The provider could not be used."}`;
    errorDetails.append(item);
  }
  errorSection.classList.remove("hidden");
}


function ensureAccessCode() {
  if (!appRequiresAccessCode || accessCodeInput.value.trim()) return true;
  showError("Enter the private APP_ACCESS_CODE before testing connections or asking a question.");
  accessCodeWrap.scrollIntoView({ behavior: "smooth", block: "center" });
  accessCodeInput.focus();
  return false;
}

function clearOutput() {
  errorSection.classList.add("hidden");
  resultsSection.classList.add("hidden");
  answerGrid.innerHTML = "";
  finalAnswer.textContent = "";
  finalWarning.classList.add("hidden");
  finalWarning.textContent = "";
  errorDetails.innerHTML = "";
}

function makeAnswerCard(answer) {
  const article = document.createElement("article");
  const statusClass = answer.status === "fulfilled" ? "" : answer.status === "skipped" ? "skipped" : "failed";
  article.className = `answer-card ${statusClass}`.trim();

  const header = document.createElement("div");
  header.className = "answer-card-header";
  const identity = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = answer.label;
  const model = document.createElement("div");
  model.className = "model-name";
  model.textContent = answer.fallbackFromModel
    ? `${answer.model || "Unknown model"} · automatic fallback from ${answer.fallbackFromModel}`
    : answer.model || "Not called";
  identity.append(title, model);

  const status = document.createElement("span");
  status.className = "status-pill";
  status.textContent = answer.status === "fulfilled" ? "COMPLETE" : answer.status === "skipped" ? "SKIPPED" : "ERROR";
  header.append(identity, status);
  article.append(header);

  if (answer.status === "fulfilled") {
    const preview = document.createElement("div");
    preview.className = "answer-preview";
    preview.textContent = answer.text;
    article.append(preview);
  } else {
    const error = document.createElement("p");
    error.className = "answer-error";
    error.textContent = answer.error?.message || "The provider did not return an answer.";
    article.append(error);
  }

  if (typeof answer.durationMs === "number") {
    const duration = document.createElement("div");
    duration.className = "answer-duration";
    duration.textContent = `Finished in ${formatDuration(answer.durationMs)}`;
    article.append(duration);
  }
  return article;
}

function renderResult(data) {
  data.answers.forEach((answer) => answerGrid.append(makeAnswerCard(answer)));
  finalAnswer.textContent = data.final.text;
  const mergedCount = data.final.sourceAnswerCount || data.summary?.successfulAnswerCount || 1;
  const attemptCount = data.final.synthesisAttempts?.length || 0;
  const flags = [
    `combined ${mergedCount} answer${mergedCount === 1 ? "" : "s"}`,
    data.final.finalReview?.status === "fulfilled" ? "independently reviewed" : "",
    attemptCount > 1 ? `editor failover ${attemptCount - 1} time${attemptCount - 1 === 1 ? "" : "s"}` : "",
    data.final.usedDeterministicMerge ? "built-in merge used" : "",
    data.final.usedSingleAnswerFallback ? "single available answer" : "",
  ].filter(Boolean);
  finalMeta.textContent = `${data.final.label} · ${data.final.model} · ${flags.join(" · ")}`;
  timingLabel.textContent = `Total ${formatDuration(data.timings.totalMs)}`;

  if (data.final.warning) {
    finalWarning.textContent = data.final.warning;
    finalWarning.classList.remove("hidden");
  }

  resultsSection.classList.remove("hidden");
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderDiagnostics(data) {
  diagnosticsGrid.innerHTML = "";
  for (const result of data.providers || []) {
    const row = document.createElement("div");
    row.className = `diagnostic-row ${result.status}`;
    const title = document.createElement("strong");
    title.textContent = `${result.label} · ${result.status === "ready" ? "READY" : result.status.replaceAll("_", " ").toUpperCase()}`;
    const message = document.createElement("p");
    message.textContent = result.message;
    row.append(title, message);
    diagnosticsGrid.append(row);

    const elements = providerElements[result.provider];
    if (elements) {
      elements.state.textContent = result.status === "ready" ? "Ready" : result.status === "missing" ? "Key needed" : "Check setup";
      elements.state.className = result.status === "ready" ? "configured" : "missing";
      if (result.model) elements.model.textContent = result.model;
      if (result.status !== "ready") elements.checkbox.checked = false;
      if (result.status === "ready") elements.checkbox.checked = true;
    }
  }

  const summary = data.summary || {};
  diagnosticsSummary.textContent = `${summary.ready || 0} ready · ${summary.errors || 0} errors · ${summary.modelUnavailable || 0} model issue${summary.modelUnavailable === 1 ? "" : "s"}`;
  diagnosticsSection.classList.remove("hidden");
  const readyCount = summary.ready || 0;
  connectionBadge.textContent = readyCount ? `${readyCount} provider${readyCount === 1 ? "" : "s"} verified` : "API setup needs attention";
  connectionBadge.classList.toggle("ready", readyCount > 0);
  connectionBadge.classList.toggle("warning", readyCount === 0);
}

function updateSetupStatus(status) {
  const configured = status.configured || {};
  for (const provider of ["openai", "anthropic", "gemini"]) {
    const saved = Boolean(configured[provider]);
    setupStateElements[provider].textContent = saved ? "Saved" : "Not saved";
    setupStateElements[provider].className = saved ? "saved" : "";
    settingInputs[`${provider === "anthropic" ? "ANTHROPIC" : provider.toUpperCase()}_API_KEY`].placeholder = saved
      ? "Saved — leave blank to keep it"
      : `Paste ${provider === "anthropic" ? "Anthropic" : provider === "openai" ? "OpenAI" : "Gemini"} API key`;
  }

  if (status.models) {
    settingInputs.OPENAI_MODEL.value = status.models.openai || settingInputs.OPENAI_MODEL.value;
    settingInputs.ANTHROPIC_MODEL.value = status.models.anthropic || settingInputs.ANTHROPIC_MODEL.value;
    settingInputs.GEMINI_MODEL.value = status.models.gemini || settingInputs.GEMINI_MODEL.value;
  }
  if (status.synthesisProvider) settingInputs.SYNTHESIS_PROVIDER.value = status.synthesisProvider;

  if (status.writable) {
    setupModeBadge.textContent = "LOCAL SECURE SETUP";
    setupModeBadge.className = "mode-badge local";
    localSetupPanel.classList.remove("hidden");
    deployedSetupPanel.classList.add("hidden");
  } else {
    setupModeBadge.textContent = "VERCEL SERVER SETUP";
    setupModeBadge.className = "mode-badge deployed";
    localSetupPanel.classList.add("hidden");
    deployedSetupPanel.classList.remove("hidden");
  }
}

async function loadSettings() {
  try {
    const response = await fetch("/api/settings", { cache: "no-store" });
    const status = await response.json();
    if (!response.ok || !status.ok) throw new Error(status?.error?.message || "Unable to load API settings.");
    updateSetupStatus(status);
  } catch (error) {
    setupModeBadge.textContent = "SETUP ERROR";
    setupModeBadge.className = "mode-badge error";
    settingsSaveTitle.textContent = "Unable to open API settings";
    settingsSaveMessage.textContent = error.message;
  }
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) throw new Error(`Health check failed (${response.status})`);
    const health = await response.json();
    const configuredCount = Object.values(health.configuredProviders).filter(Boolean).length;

    for (const [provider, elements] of Object.entries(providerElements)) {
      const configured = health.configuredProviders[provider];
      elements.model.textContent = health.models[provider];
      elements.state.textContent = configured ? "Configured — not tested" : "Key needed";
      elements.state.className = configured ? "configured" : "missing";
      elements.checkbox.checked = configured;
    }

    appRequiresAccessCode = Boolean(health.accessCodeRequired);
    accessCodeWrap.classList.toggle("hidden", !appRequiresAccessCode);
    document.querySelector("#synthesisProvider").value = health.preferredSynthesisProvider || "auto";
    document.querySelector("#responseDepth").value = health.defaultResponseDepth || "deep";

    if (configuredCount > 0) {
      connectionBadge.textContent = appRequiresAccessCode
        ? `${configuredCount} key${configuredCount === 1 ? "" : "s"} configured · enter code and test`
        : `${configuredCount} key${configuredCount === 1 ? "" : "s"} configured · run real test`;
      connectionBadge.classList.remove("ready");
      connectionBadge.classList.add("warning");
    } else {
      connectionBadge.textContent = "Add API keys to begin";
      connectionBadge.classList.add("warning");
      connectionBadge.classList.remove("ready");
    }
  } catch (error) {
    connectionBadge.textContent = "Server connection problem";
    connectionBadge.classList.add("warning");
    console.error(error);
  }
}

if (apiSettingsForm) {
  apiSettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveSettingsButton.disabled = true;
    saveSettingsButton.textContent = "Saving and testing…";
    settingsSaveTitle.textContent = "Connecting to provider APIs";
    settingsSaveMessage.textContent = "Keys are being saved locally, then checked against each provider.";

    const payload = { testConnections: true };
    for (const [name, input] of Object.entries(settingInputs)) {
      const value = input.value.trim();
      if (value) payload[name] = value;
    }

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data?.error?.message || `Settings returned ${response.status}.`);

      const submittedAccessCode = payload.APP_ACCESS_CODE || "";
      for (const secretName of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "APP_ACCESS_CODE"]) {
        settingInputs[secretName].value = "";
      }
      if (submittedAccessCode) accessCodeInput.value = submittedAccessCode;

      updateSetupStatus(data);
      await loadHealth();
      if (data.diagnostics) renderDiagnostics(data.diagnostics);

      const ready = data.diagnostics?.summary?.ready || 0;
      settingsSaveTitle.textContent = ready ? `${ready} provider connection${ready === 1 ? "" : "s"} ready` : "Keys saved, but connections need attention";
      settingsSaveMessage.textContent = ready
        ? "You can now ask a question and build one Super Best Answer."
        : "Read the API connection results below for the exact provider error.";
    } catch (error) {
      settingsSaveTitle.textContent = "API setup did not complete";
      settingsSaveMessage.textContent = error.message || "Unable to save API settings.";
    } finally {
      saveSettingsButton.disabled = false;
      saveSettingsButton.textContent = "Save keys & test connections";
    }
  });
}

showApiKeys?.addEventListener("change", () => {
  const type = showApiKeys.checked ? "text" : "password";
  settingInputs.OPENAI_API_KEY.type = type;
  settingInputs.ANTHROPIC_API_KEY.type = type;
  settingInputs.GEMINI_API_KEY.type = type;
  settingInputs.APP_ACCESS_CODE.type = type;
});

testConnectionsButton.addEventListener("click", async () => {
  clearOutput();
  if (!ensureAccessCode()) return;
  testConnectionsButton.disabled = true;
  testConnectionsButton.textContent = "Testing connections…";
  diagnosticsSection.classList.add("hidden");
  try {
    const response = await fetch("/api/diagnostics", {
      method: "POST",
      headers: {
        ...(accessCodeWrap.classList.contains("hidden") ? {} : { "x-app-access-code": accessCodeInput.value }),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data?.error?.message || `Connection test returned ${response.status}.`);
    renderDiagnostics(data);
  } catch (error) {
    showError(error?.message || "Unable to test API connections.");
  } finally {
    testConnectionsButton.disabled = false;
    testConnectionsButton.textContent = "Run real API connection test";
  }
});

questionInput.addEventListener("input", () => {
  characterCount.textContent = `${questionInput.value.length.toLocaleString("en-AU")} / 12,000`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearOutput();

  if (!ensureAccessCode()) return;

  const providers = [...document.querySelectorAll('input[name="provider"]:checked')].map((input) => input.value);
  if (!providers.length) {
    showError("Connect and select at least one provider first.");
    document.querySelector("#api-setup").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  setLoading(true);
  progressTitle.textContent = "Consulting selected models…";
  const depth = document.querySelector("#responseDepth").value;
  progressText.textContent = depth === "deep"
    ? "Three specialised expert roles run in parallel, then one editor combines every useful point and another available model audits the final draft."
    : "Answers run in parallel, then one editor combines every successful response and another available model reviews the final draft.";

  try {
    const response = await fetch("/api/super-response", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessCodeWrap.classList.contains("hidden") ? {} : { "x-app-access-code": accessCodeInput.value }),
      },
      body: JSON.stringify({
        question: questionInput.value,
        providers,
        synthesisProvider: document.querySelector("#synthesisProvider").value,
        responseDepth: document.querySelector("#responseDepth").value,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      const requestError = new Error(data?.error?.message || `Server returned ${response.status}.`);
      requestError.answers = data?.error?.details?.answers || [];
      throw requestError;
    }
    renderResult(data);
  } catch (error) {
    showError(error?.message || "Unexpected error. Check the server and API keys, then try again.", error?.answers || []);
  } finally {
    setLoading(false);
  }
});


try {
  const savedAccessCode = sessionStorage.getItem("genevieve-access-code");
  if (savedAccessCode) accessCodeInput.value = savedAccessCode;
} catch {
  // Session storage may be disabled; the user can still enter the code manually.
}

accessCodeInput?.addEventListener("input", () => {
  try {
    if (accessCodeInput.value) sessionStorage.setItem("genevieve-access-code", accessCodeInput.value);
    else sessionStorage.removeItem("genevieve-access-code");
  } catch {
    // Ignore storage restrictions.
  }
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(finalAnswer.textContent || "");
    copyButton.textContent = "Copied";
    setTimeout(() => { copyButton.textContent = "Copy answer"; }, 1400);
  } catch {
    copyButton.textContent = "Copy failed";
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js").catch(console.error));
}

Promise.all([loadSettings(), loadHealth()]);
