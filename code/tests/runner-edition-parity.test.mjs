import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import { createRunnerInput, projectRunnerOutput, runnerExampleState, runnerInputConfig } from "../app/runner-input-config.js";

const pageUrl = new URL("../app/page.tsx", import.meta.url);
const standaloneUrl = new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url);

function jsonBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `found ${startMarker}`);
  assert.notEqual(end, -1, `found ${endMarker}`);
  return JSON.parse(source.slice(start + startMarker.length, end));
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function standaloneRunnerApi(html) {
  const start = html.indexOf("const runnerYesNo=");
  const end = html.indexOf("function runnerFieldsHtml", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return vm.runInNewContext(`${html.slice(start, end)};({runnerFormConfig,runnerExampleState,configuredRunnerInput})`);
}

function standaloneOutputProjector(html) {
  const start = html.indexOf("function runnerOutputModel(config,output)");
  const end = html.indexOf("function runnerOperationScope", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return vm.runInNewContext(`${html.slice(start, end)};runnerOutputModel`);
}

const outputFixtures = {
  1: { analysis_status: "grade_computed", question_ids: ["Q01"], responses: ["1"], wagner_score: [2], grade_label: ["Deep ulcer"] },
  2: { status: "completed", result_id: "OUTPUT-02", display_text: "Suggest adding HBO₂ urgently after surgery.", evidence_quality: "moderate", recommendation_strength: "conditional", rule_id: "ALG-03" },
  3: { status: "completed", execution_burden_level: { display_text: "Low execution burden", primary_driver: "Repeated attendance" }, objective_burden: { overall_burden_range: { episodes: [30, 40] } } },
  4: { status: "success", display_probability_percent: "20.3%", prognostic_group: "AREA_GE_2__DURATION_GE_8", area_category: "AREA-GE-2", duration_category: "DUR-GE-8" },
};

test("both editions embed byte-identical Runner manifests and bundle source", async () => {
  const [page, standalone] = await Promise.all([readFile(pageUrl, "utf8"), readFile(standaloneUrl, "utf8")]);
  const reactFiles = jsonBetween(page, "const objectFileOverrides: Record<string, string> = ", ";\nconst objectBinaryOverrides");
  const standaloneFiles = jsonBetween(standalone, "const overrides=", ";\nconst objectBinaryOverrides");
  const runnerPaths = Object.keys(reactFiles).filter((path) => /\/runner\/(runner\.manifest\.json|runner\.bundle\.js)$/.test(path)).sort();
  assert.equal(runnerPaths.length, 8);
  assert.deepEqual(Object.keys(standaloneFiles).filter((path) => /\/runner\/(runner\.manifest\.json|runner\.bundle\.js)$/.test(path)).sort(), runnerPaths);
  for (const path of runnerPaths) assert.equal(standaloneFiles[path], reactFiles[path], `${path} remains byte-identical`);
});

test("both editions derive the same visible input configuration and exact example request", async () => {
  const standalone = await readFile(standaloneUrl, "utf8");
  const api = standaloneRunnerApi(standalone);
  for (let number = 1; number <= 4; number += 1) {
    const id = `workshop-ko-${number}`;
    const reactConfig = runnerInputConfig(id);
    const standaloneConfig = api.runnerFormConfig(id);
    const visible = (config) => ({ title: config.title, exampleName: config.exampleName, fields: config.fields.map(({ key, label, type, options, defaultValue, min, step, unit }) => ({ key, label, type, options, defaultValue, min, step, unit })) });
    assert.deepEqual(plain(visible(standaloneConfig)), plain(visible(reactConfig)), `${id} visible form contract matches`);
    assert.deepEqual(plain(api.configuredRunnerInput(standaloneConfig, api.runnerExampleState(standaloneConfig))), plain(createRunnerInput(reactConfig, runnerExampleState(reactConfig))), `${id} example request matches`);
  }
});

test("both editions produce the same human-readable output models", async () => {
  const standalone = await readFile(standaloneUrl, "utf8");
  const api = standaloneRunnerApi(standalone);
  const projectStandalone = standaloneOutputProjector(standalone);
  for (let number = 1; number <= 4; number += 1) {
    const id = `workshop-ko-${number}`;
    assert.deepEqual(plain(projectStandalone(api.runnerFormConfig(id), outputFixtures[number])), plain(projectRunnerOutput(runnerInputConfig(id), outputFixtures[number])), `${id} output projection matches`);
  }
});

test("both editions share the Runner protocol, sandbox, timeout, and failure language", async () => {
  const [page, host, contract, standalone] = await Promise.all([readFile(pageUrl, "utf8"), readFile(new URL("../app/runner-sandbox-host.js", import.meta.url), "utf8"), readFile(new URL("../app/runner-contract.js", import.meta.url), "utf8"), readFile(standaloneUrl, "utf8")]);
  const react = `${page}\n${host}\n${contract}`;
  for (const marker of ["runner:init", "runner:ready", "runner:run", "runner:result", "runner:reset", "FAIR_KO_RUNNER", "allow-scripts", "RunnerTimeoutError", "RunnerInitializationError", "RunnerMalformedOutputError", "Execution timed out.", "Output unavailable.", "Runner unavailable.", "Operation stopped.", "Technical details"]) {
    assert.ok(react.includes(marker), `React implementation retains ${marker}`);
    assert.ok(standalone.includes(marker), `standalone implementation retains ${marker}`);
  }
  assert.doesNotMatch(standalone, /allow-same-origin/);
  assert.match(standalone, /timeoutMs=5000/);
  for (const sentence of [
    "The operation did not finish within five seconds. Restore the Runner to try again.",
    "The Runner returned a result that could not be represented safely as JSON.",
    "The isolated Runner could not be prepared:",
    "The declared Runner operation did not complete:",
  ]) {
    assert.ok(react.includes(sentence));
    assert.ok(standalone.includes(sentence));
  }
});

test("the standalone edition has no required external runtime or Runner fetch", async () => {
  const standalone = await readFile(standaloneUrl, "utf8");
  assert.match(standalone, /^<!DOCTYPE html>/i);
  assert.doesNotMatch(standalone, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(standalone, /<link\b[^>]*\brel=["']stylesheet["']/i);
  const runnerStart = standalone.indexOf("function runnerSandboxDocumentStandalone");
  const runnerEnd = standalone.indexOf("function mountKoFlips", runnerStart);
  const runnerSection = standalone.slice(runnerStart, runnerEnd);
  assert.doesNotMatch(runnerSection, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
  assert.match(runnerSection, /record\.bundleSource/);
  assert.match(runnerSection, /iframe\.srcdoc=/);
});
