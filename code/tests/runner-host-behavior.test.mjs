import assert from "node:assert/strict";
import test from "node:test";
import { createDisposableRunnerSandbox } from "../app/runner-sandbox-host.js";

function browserHarness() {
  const messageListeners = new Set();
  const posted = [];
  const iframes = [];
  let uuid = 0;

  const window = {
    addEventListener(type, listener) { if (type === "message") messageListeners.add(listener); },
    removeEventListener(type, listener) { if (type === "message") messageListeners.delete(listener); },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  };
  const document = {
    createElement(name) {
      assert.equal(name, "iframe");
      const attributes = new Map();
      let loadListener;
      const iframe = {
        hidden: false,
        removed: false,
        contentWindow: { postMessage(message, target) { posted.push({ message, target, iframe }); } },
        setAttribute(name, value) { attributes.set(name, value); },
        getAttribute(name) { return attributes.get(name); },
        addEventListener(type, listener) { if (type === "load") loadListener = listener; },
        remove() { iframe.removed = true; },
        load() { loadListener?.(); },
      };
      iframes.push(iframe);
      return iframe;
    },
    body: { append() {} },
  };
  const crypto = { randomUUID: () => `test-${++uuid}` };
  const emit = (data, source = iframes.at(-1)?.contentWindow) => {
    for (const listener of [...messageListeners]) listener({ data, source });
  };
  const latest = (type) => [...posted].reverse().find(({ message }) => message.type === type)?.message;
  return { window, document, crypto, emit, latest, posted, iframes, messageListeners };
}

function readyMessage(sandbox, detail = { ok: true }) {
  return { runnerVersion: "1.0", type: "runner:ready", sessionId: sandbox.sessionId, ...detail };
}

async function readySandbox(harness, timeoutMs = 100) {
  const sandbox = createDisposableRunnerSandbox({
    bundleSource: "window.FAIR_KO_RUNNER={run:input=>input}",
    timeoutMs,
    document: harness.document,
    window: harness.window,
    crypto: harness.crypto,
  });
  sandbox.element.load();
  harness.emit(readyMessage(sandbox));
  await sandbox.ready;
  return sandbox;
}

test("a valid Runner result resolves while spoofed source, session, and request messages are ignored", async () => {
  const harness = browserHarness();
  const sandbox = await readySandbox(harness);
  const result = sandbox.run({ example: true });
  await Promise.resolve();
  const request = harness.latest("runner:run");
  assert.ok(request?.requestId);

  const valid = { runnerVersion: "1.0", type: "runner:result", sessionId: sandbox.sessionId, requestId: request.requestId, ok: true, output: { accepted: true } };
  harness.emit(valid, {});
  harness.emit({ ...valid, sessionId: "runner-session-wrong" });
  harness.emit({ ...valid, requestId: "runner-request-wrong" });
  const pending = await Promise.race([result.then(() => false), new Promise((resolve) => setTimeout(() => resolve(true), 12))]);
  assert.equal(pending, true, "spoofed messages leave the request pending");

  harness.emit(valid);
  assert.deepEqual(await result, { accepted: true });
  sandbox.dispose();
});

test("structured Runner exceptions cross the boundary without executing or interpreting their message", async () => {
  const harness = browserHarness();
  const sandbox = await readySandbox(harness);
  const result = sandbox.run({});
  await Promise.resolve();
  const request = harness.latest("runner:run");
  harness.emit({
    runnerVersion: "1.0",
    type: "runner:result",
    sessionId: sandbox.sessionId,
    requestId: request.requestId,
    ok: false,
    error: { name: "TypeError", message: "<img src=x onerror=alert(1)>" },
  });
  await assert.rejects(result, (error) => {
    assert.equal(error.name, "TypeError");
    assert.equal(error.message, "<img src=x onerror=alert(1)>");
    return true;
  });
  sandbox.dispose();
});

test("execution timeout rejects the request and destroys its disposable iframe", async () => {
  const harness = browserHarness();
  const sandbox = await readySandbox(harness, 15);
  await assert.rejects(sandbox.run({}), (error) => error.name === "RunnerTimeoutError");
  assert.equal(sandbox.element.removed, true);
  assert.equal(harness.messageListeners.size, 0);
});

test("initialization failure rejects readiness and destroys its disposable iframe", async () => {
  const harness = browserHarness();
  const sandbox = createDisposableRunnerSandbox({
    bundleSource: "invalid",
    timeoutMs: 100,
    document: harness.document,
    window: harness.window,
    crypto: harness.crypto,
  });
  const rejected = assert.rejects(sandbox.ready, (error) => error.name === "RunnerInitializationError" && /could not initialize/.test(error.message));
  sandbox.element.load();
  harness.emit(readyMessage(sandbox, { ok: false, error: { name: "SyntaxError", message: "could not initialize" } }));
  await rejected;
  assert.equal(sandbox.element.removed, true);
  assert.equal(harness.messageListeners.size, 0);
});

test("reset destroys the active iframe and a new sandbox receives a clean session", async () => {
  const harness = browserHarness();
  const first = await readySandbox(harness);
  first.reset();
  assert.equal(first.element.removed, true);
  assert.equal(harness.latest("runner:reset")?.sessionId, first.sessionId);

  const second = await readySandbox(harness);
  assert.notEqual(second.sessionId, first.sessionId);
  assert.notEqual(second.element, first.element);
  assert.equal(second.element.removed, false);
  second.dispose();
});
