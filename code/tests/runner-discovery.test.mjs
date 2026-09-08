import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  discoverKnowledgeObjectRunners,
  discoverRunnerAvailability,
  RUNNER_MANIFEST_PATH,
} from "../app/runner-discovery.js";

const metadata = JSON.stringify({ "dc:identifier": ["workshop-ko-1", "https://example.test/ko/1"], "dc:version": "1.0" });
const manifest = JSON.stringify({
  runnerVersion: "1.0",
  knowledgeObjectId: "workshop-ko-1",
  knowledgeObjectVersion: "1.0",
  bundle: "runner/runner.bundle.js",
});

function discover(changes = {}) {
  const sources = {
    "metadata.json": metadata,
    [RUNNER_MANIFEST_PATH]: manifest,
    "runner/runner.bundle.js": "globalThis.__runnerDiscoveryMustNotExecute = true;",
    ...changes,
  };
  return discoverRunnerAvailability({ files: Object.keys(sources), readText: (file) => sources[file] });
}

test("discovers a structurally available Runner without executing its bundle", () => {
  delete globalThis.__runnerDiscoveryMustNotExecute;
  const record = discover();
  assert.equal(record.available, true);
  assert.equal(record.manifest.knowledgeObjectId, "workshop-ko-1");
  assert.match(record.bundleSource, /__runnerDiscoveryMustNotExecute/);
  assert.equal(record.validationError, null);
  assert.equal(globalThis.__runnerDiscoveryMustNotExecute, undefined);
});

test("reports absent, malformed, mismatched, unsafe, and missing Runner structures", () => {
  assert.equal(discoverRunnerAvailability({ files: ["metadata.json"], readText: () => metadata }).available, false);
  assert.match(discover({ [RUNNER_MANIFEST_PATH]: "{" }).validationError, /valid JSON/);
  assert.match(discover({ [RUNNER_MANIFEST_PATH]: manifest.replace("workshop-ko-1", "workshop-ko-2") }).validationError, /identity/);
  assert.match(discover({ [RUNNER_MANIFEST_PATH]: manifest.replace('"1.0","bundle"', '"2.0","bundle"') }).validationError, /version/);
  assert.match(discover({ [RUNNER_MANIFEST_PATH]: manifest.replace("runner/runner.bundle.js", "../runner.js") }).validationError, /safe relative/);
  const sources = { "metadata.json": metadata, [RUNNER_MANIFEST_PATH]: manifest };
  const missing = discoverRunnerAvailability({ files: Object.keys(sources), readText: (file) => sources[file] });
  assert.match(missing.validationError, /bundle.*missing/i);
});

test("derives one temporary record per knowledge object", () => {
  const sources = { 1: { "metadata.json": metadata, [RUNNER_MANIFEST_PATH]: manifest, "runner/runner.bundle.js": "source" }, 2: { "metadata.json": metadata } };
  const records = discoverKnowledgeObjectRunners([1, 2], (id) => Object.keys(sources[id]), (id, file) => sources[id][file]);
  assert.equal(records[1].available, true);
  assert.equal(records[2].available, false);
});

test("all currently embedded KOs supply structurally available matching Runners", () => {
  const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const payload = source.match(/const objectFileOverrides: Record<string, string> = (\{[\s\S]*?\});\nconst objectBinaryOverrides:/);
  assert.ok(payload, "React embedded text payload should be present");
  const sources = JSON.parse(payload[1]);
  const ids = [...new Set(Object.keys(sources).map((path) => Number(path.split("/")[0])))].sort((a, b) => a - b);
  const records = discoverKnowledgeObjectRunners(
    ids,
    (id) => Object.keys(sources).filter((path) => path.startsWith(`${id}/`)).map((path) => path.slice(String(id).length + 1)),
    (id, file) => sources[`${id}/${file}`],
  );
  assert.equal(ids.length, 4);
  for (const id of ids) {
    assert.equal(records[id].available, true, records[id].validationError);
    assert.equal(records[id].manifest.knowledgeObjectId, `workshop-ko-${id}`);
    assert.equal(records[id].manifest.knowledgeObjectVersion, "1.0");
  }
});

test("both SWA editions include and derive the same temporary Runner record shape", () => {
  const react = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const reactDiscovery = readFileSync(new URL("../app/runner-discovery.js", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  for (const marker of ["runnerAvailabilityByObject", "available", "manifest", "bundleSource", "validationError"]) {
    assert.ok(`${react}\n${reactDiscovery}`.includes(marker), `React edition should include ${marker}`);
    assert.ok(standalone.includes(marker), `standalone edition should include ${marker}`);
  }
});
