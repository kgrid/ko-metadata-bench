import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runnerSandboxDocument } from "../app/runner-sandbox-host.js";

const host = readFileSync(new URL("../app/runner-sandbox-host.js", import.meta.url), "utf8");
const react = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
const standaloneHost = standalone.slice(
  standalone.indexOf("function runnerSandboxDocumentStandalone"),
  standalone.indexOf("function mountKoFlips"),
);

test("the disposable Runner document is self-contained and denies external capabilities", () => {
  const document = runnerSandboxDocument();
  assert.match(document, /^<!doctype html>/);
  assert.match(document, /default-src 'none'/);
  assert.match(document, /connect-src 'none'/);
  assert.match(document, /frame-src 'none'/);
  assert.doesNotMatch(document, /<script[^>]+src=/i);
  assert.doesNotMatch(document, /<link\b/i);
});

test("both editions use an opaque-origin script-only sandbox", () => {
  assert.match(host, /setAttribute\("sandbox", "allow-scripts"\)/);
  assert.doesNotMatch(host, /allow-same-origin/);
  assert.match(standalone, /setAttribute\("sandbox","allow-scripts"\)/);
  assert.doesNotMatch(standalone, /allow-same-origin/);
});

test("the parent validates source, session, request, and message type", () => {
  assert.match(host, /event\.source !== iframe\.contentWindow/);
  assert.match(host, /message\.sessionId !== sessionId/);
  assert.match(host, /pending\.get\(message\.requestId\)/);
  assert.match(host, /validateRunnerMessage\(event\.data\)/);
  assert.match(standalone, /event\.source!==iframe\.contentWindow/);
  assert.match(standalone, /event\.data\.sessionId!==sessionId/);
  assert.match(standalone, /pending\.get\(message\.requestId\)/);
});

test("Runner code is inserted only inside the sandbox and never evaluated by the parent", () => {
  assert.match(host, /script\.textContent = message\.bundleSource/);
  assert.doesNotMatch(host, /\beval\s*\(|new Function/);
  assert.match(standaloneHost, /script\.textContent=message\.bundleSource/);
  assert.doesNotMatch(standaloneHost, /\beval\s*\(|new Function/);
});

test("Runner sessions are created on demand and disposed on React and standalone close", () => {
  assert.match(react, /createDisposableRunnerSandbox\(\{ bundleSource \}\)/);
  assert.match(react, /sandbox\.dispose\(\)/);
  assert.match(standalone, /createDisposableRunnerSandboxStandalone\(runnerRecord\.bundleSource\)/);
  assert.match(standalone, /close=\(\)=>\{sandbox\?\.dispose\(\)/);
});

test("input is checked for structured cloning before it crosses the sandbox boundary", () => {
  assert.match(host, /structuredClone\(input\)/);
  assert.match(standalone, /structuredClone\(input\)/);
});

test("both hosts bound execution to five seconds and reject duplicate runs", () => {
  assert.match(host, /timeoutMs = 5000/);
  assert.match(host, /if \(activeRequestId\)/);
  assert.match(host, /RunnerBusyError/);
  assert.match(host, /RunnerTimeoutError/);
  assert.match(standaloneHost, /timeoutMs=5000/);
  assert.match(standaloneHost, /if\(activeRequestId\)/);
  assert.match(standaloneHost, /RunnerBusyError/);
  assert.match(standaloneHost, /RunnerTimeoutError/);
});

test("timeouts destroy the iframe and clear request bookkeeping", () => {
  assert.match(host, /request\.reject\(error\);\s*dispose\(error\)/);
  assert.match(host, /iframe\.remove\(\)/);
  assert.match(host, /pending\.clear\(\)/);
  assert.match(standaloneHost, /request\.reject\(error\);dispose\(error\)/);
  assert.match(standaloneHost, /iframe\.remove\(\)/);
  assert.match(standaloneHost, /pending\.clear\(\)/);
});

test("initialization failures and initialization timeouts also destroy the disposable iframe", () => {
  assert.match(host, /RunnerInitializationError/);
  assert.match(host, /Runner initialization exceeded/);
  assert.match(host, /rejectReady\(error\);\s*dispose\(error\)/);
  assert.match(standalone, /createDisposableRunnerSandboxStandalonePhase10/);
  assert.match(standalone, /RunnerInitializationError/);
  assert.match(standalone, /Runner initialization exceeded/);
  assert.match(standalone, /rejectReady\(error\);dispose\(error\)/);
});

test("Restore disposes the old sandbox and the UI prepares a fresh session", () => {
  assert.match(host, /const reset = \(\) =>/);
  assert.match(host, /Runner session was reset/);
  assert.match(react, /sandboxRef\.current\?\.reset\(\)/);
  assert.match(react, /setSandboxGeneration\(\(value\) => value \+ 1\)/);
  assert.match(standaloneHost, /reset=\(\)=>/);
  assert.match(standaloneHost, /sandbox\?\.reset\(\)/);
  assert.match(standaloneHost, /prepare\(\)/);
});

test("the shell includes a restrained pending and timeout presentation", () => {
  assert.match(react, /setHostState\("running"\)/);
  assert.match(react, /Running…/);
  assert.match(react, /Execution timed out\. Restore to try again\./);
  assert.match(react, /disabled=\{!canRestore \|\| hostState === "preparing" \|\| hostState === "running"\}/);
});
