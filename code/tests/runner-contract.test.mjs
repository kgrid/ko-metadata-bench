import assert from "node:assert/strict";
import test from "node:test";
import {
  RUNNER_CONTRACT_VERSION,
  RUNNER_GLOBAL,
  RUNNER_MESSAGE,
  assertRunnerManifest,
  runnerMessage,
  validateRunnerExport,
  validateRunnerManifest,
  validateRunnerMessage,
} from "../app/runner-contract.js";

const manifest = {
  runnerVersion: "1.0",
  knowledgeObjectId: "workshop-ko-1",
  knowledgeObjectVersion: "1.0",
  bundle: "runner/runner.bundle.js",
};

test("the Runner contract is browser-JavaScript-only and has one fixed export", () => {
  assert.equal(RUNNER_CONTRACT_VERSION, "1.0");
  assert.equal(RUNNER_GLOBAL, "FAIR_KO_RUNNER");
  assert.equal(validateRunnerExport({ run() {} }), true);
  assert.equal(validateRunnerExport({ execute() {} }), false);
});

test("a minimal four-field Runner manifest is valid", () => {
  assert.equal(validateRunnerManifest(manifest), true);
  assert.equal(assertRunnerManifest(manifest), manifest);
});

test("Runner manifests reject runtime choices, unsafe paths, and unknown fields", () => {
  assert.equal(validateRunnerManifest({ ...manifest, language: "python" }), false);
  assert.equal(validateRunnerManifest({ ...manifest, bundle: "../runner.js" }), false);
  assert.equal(validateRunnerManifest({ ...manifest, bundle: "https://example.org/runner.js" }), false);
  assert.throws(() => assertRunnerManifest({ ...manifest, runnerVersion: "2.0" }), /runnerVersion/);
});

test("the message contract has five lifecycle messages", () => {
  assert.deepEqual(Object.values(RUNNER_MESSAGE), ["runner:init", "runner:ready", "runner:run", "runner:result", "runner:reset"]);
});

test("Runner messages require version, session, and request correlation", () => {
  const run = runnerMessage(RUNNER_MESSAGE.RUN, "session-1", { requestId: "request-1", input: { answer: 1 } });
  const result = runnerMessage(RUNNER_MESSAGE.RESULT, "session-1", { requestId: "request-1", ok: true, output: { value: 2 } });
  assert.equal(validateRunnerMessage(run), true);
  assert.equal(validateRunnerMessage(result), true);
  assert.equal(validateRunnerMessage({ ...run, requestId: "" }), false);
  assert.equal(validateRunnerMessage({ ...result, ok: "yes" }), false);
});
