import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const workspace = path.resolve(import.meta.dirname, "..");
const skillRoot = path.join(workspace, "skills/create-ko-browser-runner");
const builder = path.join(skillRoot, "scripts/create_runner.mjs");

function fixture(expected = { doubled: 8 }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runner-skill-test-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src/index.js"), "module.exports = { evaluate(input) { return { doubled: input.value * 2 }; } };\n");
  const cases = path.join(root, "cases.json");
  fs.writeFileSync(cases, JSON.stringify({ cases: [{ name: "doubles a value", input: { value: 4 }, expected }] }));
  return { root, cases };
}

function build({ root, cases }) {
  return spawnSync(process.execPath, [builder, "--ko", root, "--id", "fixture-ko", "--version", "1.0", "--entry", "src/index.js", "--export", "evaluate", "--cases", cases], { cwd: workspace, encoding: "utf8" });
}

test("the Runner skill is concise, additive, and registered with UI metadata", () => {
  const instructions = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
  const ui = fs.readFileSync(path.join(skillRoot, "agents/openai.yaml"), "utf8");
  assert.match(instructions, /JavaScript-based Knowledge Object/);
  assert.match(instructions, /Never edit implementation, metadata, tests, schemas, examples, or documentation/);
  assert.match(ui, /\$create-ko-browser-runner/);
});

test("the Runner skill builds and validates a browser bundle without changing native files", () => {
  const item = fixture();
  try {
    const nativeBefore = fs.readFileSync(path.join(item.root, "src/index.js"), "utf8");
    const result = build(item);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, true);
    assert.deepEqual(report.casesPassed, ["doubles a value"]);
    assert.equal(fs.readFileSync(path.join(item.root, "src/index.js"), "utf8"), nativeBefore);
    assert.equal(fs.existsSync(path.join(item.root, "runner/runner.bundle.js")), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(item.root, "runner/runner.manifest.json"), "utf8")), {
      runnerVersion: "1.0",
      knowledgeObjectId: "fixture-ko",
      knowledgeObjectVersion: "1.0",
      bundle: "runner/runner.bundle.js",
    });
  } finally {
    fs.rmSync(item.root, { recursive: true, force: true });
  }
});

test("a parity failure publishes no Runner folder", () => {
  const item = fixture({ doubled: 9 });
  try {
    const result = build(item);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /differs from expected result/);
    assert.equal(fs.existsSync(path.join(item.root, "runner")), false);
  } finally {
    fs.rmSync(item.root, { recursive: true, force: true });
  }
});
