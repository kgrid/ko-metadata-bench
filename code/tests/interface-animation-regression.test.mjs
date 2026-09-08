import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { INTERFACE_FAILURE_PHASES, INTERFACE_FIT_PHASES, interfaceFitPlan } from "../app/interface-motion.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

function standaloneFrozenValue(source, name) {
  const marker = `const ${name}=Object.freeze(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `standalone declares ${name}`);
  const valueStart = start + marker.length;
  let depth = 1;
  let quote = null;
  let escaped = false;
  for (let index = valueStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")" && --depth === 0) return JSON.parse(JSON.stringify(vm.runInNewContext(`Object.freeze(${source.slice(valueStart, index)})`)));
  }
  assert.fail(`standalone ${name} declaration is incomplete`);
}

test("successful interface motion retains the complete teaching sequence", () => {
  assert.deepEqual(INTERFACE_FIT_PHASES.map((frame) => frame.id), [
    "input-ready", "input-approach", "input-align", "input-snap", "input-seated", "input-locked",
    "operation-entry", "stamp-down", "stamp-contact", "stamp-transform", "stamp-up",
    "output-approach", "output-snap-in", "output-seated", "output-locked", "output-release", "output-snap-out",
    "output-delivery", "output-received",
  ]);
  assert.deepEqual(INTERFACE_FIT_PHASES.map((frame) => frame.form), [
    "input", "input", "input", "input", "input", "input", "input", "input", "input", "transform",
    "output", "output", "output", "output", "output", "output", "output", "output", "output",
  ]);
  assert.equal(INTERFACE_FIT_PHASES.at(-1).status, "Output delivered.");
});

test("each failure stops at its own boundary without leaking later behavior", () => {
  const matrix = {
    "input-data-object": { before: "input-ready", terminal: "input-rejected", form: "input", fit: "rejected", forbidden: ["input-approach", "stamp-transform", "output-received"] },
    "input-binding": { before: "input-snap", terminal: "input-binding-rejected", form: "input", fit: "rebound", forbidden: ["input-seated", "stamp-transform", "output-received"] },
    operation: { before: "stamp-contact", terminal: "operation-failed", form: "input", fit: "jammed", forbidden: ["stamp-transform", "stamp-up", "output-received"] },
    "output-binding": { before: "output-snap-in", terminal: "output-binding-rejected", form: "output", fit: "rebound", forbidden: ["output-seated", "output-release", "output-received"] },
    "output-data-object": { before: "output-delivery", terminal: "output-rejected", form: "output", fit: "rejected", forbidden: ["output-received"] },
  };
  for (const [failurePoint, expected] of Object.entries(matrix)) {
    const plan = interfaceFitPlan(failurePoint);
    const ids = plan.map((frame) => frame.id);
    assert.equal(plan.at(-2).id, expected.before, `${failurePoint} reaches its declared boundary`);
    assert.equal(plan.at(-1).id, expected.terminal, `${failurePoint} has its own terminal phase`);
    assert.equal(plan.at(-1).form, expected.form, `${failurePoint} preserves material identity`);
    assert.equal(plan.at(-1).fit, expected.fit, `${failurePoint} preserves physical behavior`);
    for (const forbidden of expected.forbidden) assert.ok(!ids.includes(forbidden), `${failurePoint} never reaches ${forbidden}`);
  }
});

test("the standalone edition embeds the exact production motion and failure contracts", async () => {
  const standalone = await read("outputs/Knowledge-Object-Workbench.html");
  assert.deepEqual(standaloneFrozenValue(standalone, "standaloneExplicitFitPhases"), JSON.parse(JSON.stringify(INTERFACE_FIT_PHASES)));
  assert.deepEqual(standaloneFrozenValue(standalone, "standaloneFailureFitPhases"), JSON.parse(JSON.stringify(INTERFACE_FAILURE_PHASES)));
});

test("presentation regressions cannot collapse material, motion, or accessibility distinctions", async () => {
  const [page, styles, standalone] = await Promise.all([
    read("app/page.tsx"),
    read("app/globals.css"),
    read("outputs/Knowledge-Object-Workbench.html"),
  ]);
  assert.match(styles, /failed:is\(\.failure-input-data-object,\.failure-output-data-object\)/);
  assert.doesNotMatch(styles, /failed:not\(\.failure-input-binding\)/);
  for (const behavior of ["interfaceDieSeat", "interfaceDieRelease", "interfaceDieTopOpen", "interfaceStampDescend", "interfaceObjectReject", "interfaceBindingRebound", "interfaceOperationCrush"]) assert.match(styles, new RegExp(behavior));
  for (const behavior of ["standalone-die-seat", "standalone-die-release", "standalone-die-top-open", "standalone-stamp-descend", "standalone-object-reject", "standalone-binding-rebound", "standalone-operation-crush"]) assert.match(standalone, new RegExp(behavior));
  for (const marker of ["prefers-reduced-motion", "forced-colors", "aria-live", "aria-atomic", "aria-relevant", "Try interface case:"]) {
    assert.ok(`${page}\n${styles}`.includes(marker), `production retains ${marker}`);
    assert.ok(standalone.includes(marker), `standalone retains ${marker}`);
  }
});
