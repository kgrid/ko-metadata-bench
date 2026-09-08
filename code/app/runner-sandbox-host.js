import {
  RUNNER_CONTRACT_VERSION,
  RUNNER_GLOBAL,
  RUNNER_MESSAGE,
  runnerMessage,
  validateRunnerMessage,
} from "./runner-contract.js";

function randomId(cryptoApi, prefix) {
  const value = typeof cryptoApi?.randomUUID === "function"
    ? cryptoApi.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}

export function runnerSandboxDocument() {
  const bootstrap = `
(() => {
  "use strict";
  const VERSION = ${JSON.stringify(RUNNER_CONTRACT_VERSION)};
  const GLOBAL = ${JSON.stringify(RUNNER_GLOBAL)};
  let sessionId = null;
  let runner = null;
  const send = (type, detail = {}) => parent.postMessage({ runnerVersion: VERSION, type, sessionId, ...detail }, "*");
  const errorRecord = (error) => ({
    name: typeof error?.name === "string" ? error.name : "Error",
    message: typeof error?.message === "string" ? error.message : "Runner execution failed."
  });
  addEventListener("message", async (event) => {
    const message = event.data;
    if (!message || typeof message !== "object" || message.runnerVersion !== VERSION) return;
    if (message.type === "runner:init") {
      if (sessionId || typeof message.sessionId !== "string" || !message.sessionId || typeof message.bundleSource !== "string") return;
      sessionId = message.sessionId;
      try {
        const script = document.createElement("script");
        script.textContent = message.bundleSource;
        document.head.append(script);
        runner = window[GLOBAL];
        if (!runner || typeof runner.run !== "function") throw new TypeError("Runner export is unavailable.");
        send("runner:ready", { ok: true });
      } catch (error) {
        send("runner:ready", { ok: false, error: errorRecord(error) });
      }
      return;
    }
    if (!sessionId || message.sessionId !== sessionId) return;
    if (message.type === "runner:run" && typeof message.requestId === "string" && message.requestId) {
      try {
        const output = await Promise.resolve(runner.run(message.input));
        send("runner:result", { requestId: message.requestId, ok: true, output });
      } catch (error) {
        send("runner:result", { requestId: message.requestId, ok: false, error: errorRecord(error) });
      }
    }
  });
})();`;
  // Some self-contained schema validators generate functions at initialization.
  // This remains confined to an opaque-origin, network-denied disposable iframe.
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; img-src 'none'; media-src 'none'; font-src 'none'; style-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; base-uri 'none'; form-action 'none'"><script>${bootstrap.replaceAll("</script", "<\\/script")}</script></head><body></body></html>`;
}

export function createDisposableRunnerSandbox({
  bundleSource,
  timeoutMs = 5000,
  document: documentApi = globalThis.document,
  window: windowApi = globalThis.window,
  crypto: cryptoApi = globalThis.crypto,
} = {}) {
  if (typeof bundleSource !== "string") throw new TypeError("Runner bundle source must be text.");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError("Runner timeout must be a positive number of milliseconds.");
  if (!documentApi?.createElement || !windowApi?.addEventListener) throw new TypeError("A browser document and window are required.");

  const sessionId = randomId(cryptoApi, "runner-session");
  const iframe = documentApi.createElement("iframe");
  iframe.hidden = true;
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("aria-hidden", "true");
  iframe.srcdoc = runnerSandboxDocument();
  let disposed = false;
  let activeRequestId = null;
  const pending = new Map();
  let resolveReady;
  let rejectReady;
  let readySettled = false;
  let initializationTimer = null;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });

  const dispose = (reason = new Error("Runner session was closed.")) => {
    if (disposed) return;
    disposed = true;
    if (initializationTimer !== null) windowApi.clearTimeout(initializationTimer);
    windowApi.removeEventListener("message", receive);
    iframe.remove();
    for (const request of pending.values()) {
      windowApi.clearTimeout(request.timer);
      request.reject(reason);
    }
    pending.clear();
    activeRequestId = null;
  };

  const receive = (event) => {
    if (disposed || event.source !== iframe.contentWindow || !validateRunnerMessage(event.data)) return;
    const message = event.data;
    if (message.sessionId !== sessionId) return;
    if (message.type === RUNNER_MESSAGE.READY) {
      if (readySettled) return;
      readySettled = true;
      if (initializationTimer !== null) windowApi.clearTimeout(initializationTimer);
      if (message.ok === false) {
        const error = new Error(message.error?.message || "Runner initialization failed.");
        error.name = "RunnerInitializationError";
        rejectReady(error);
        dispose(error);
      } else resolveReady();
      return;
    }
    if (message.type !== RUNNER_MESSAGE.RESULT) return;
    const request = pending.get(message.requestId);
    if (!request) return;
    pending.delete(message.requestId);
    windowApi.clearTimeout(request.timer);
    activeRequestId = null;
    if (message.ok) request.resolve(message.output);
    else {
      const error = new Error(message.error?.message || "Runner execution failed.");
      error.name = message.error?.name || "Error";
      request.reject(error);
    }
  };

  windowApi.addEventListener("message", receive);
  iframe.addEventListener("load", () => {
    if (disposed) return;
    iframe.contentWindow?.postMessage(runnerMessage(RUNNER_MESSAGE.INIT, sessionId, { bundleSource }), "*");
  }, { once: true });
  documentApi.body.append(iframe);
  initializationTimer = windowApi.setTimeout(() => {
    if (disposed || readySettled) return;
    readySettled = true;
    const error = new Error(`Runner initialization exceeded ${timeoutMs} milliseconds.`);
    error.name = "RunnerInitializationError";
    rejectReady(error);
    dispose(error);
  }, timeoutMs);

  const run = async (input) => {
    await ready;
    if (disposed) throw new Error("Runner session was closed.");
    if (activeRequestId) {
      const error = new Error("A Runner request is already in progress.");
      error.name = "RunnerBusyError";
      throw error;
    }
    if (typeof structuredClone === "function") structuredClone(input);
    const requestId = randomId(cryptoApi, "runner-request");
    activeRequestId = requestId;
    return new Promise((resolve, reject) => {
      const timer = windowApi.setTimeout(() => {
        const request = pending.get(requestId);
        if (!request) return;
        pending.delete(requestId);
        activeRequestId = null;
        const error = new Error(`Runner execution exceeded ${timeoutMs} milliseconds.`);
        error.name = "RunnerTimeoutError";
        request.reject(error);
        dispose(error);
      }, timeoutMs);
      pending.set(requestId, { resolve, reject, timer });
      iframe.contentWindow?.postMessage(runnerMessage(RUNNER_MESSAGE.RUN, sessionId, { requestId, input }), "*");
    });
  };

  const reset = () => {
    if (!disposed) iframe.contentWindow?.postMessage(runnerMessage(RUNNER_MESSAGE.RESET, sessionId), "*");
    dispose(new Error("Runner session was reset."));
  };

  return Object.freeze({ sessionId, ready, run, reset, dispose, element: iframe });
}
