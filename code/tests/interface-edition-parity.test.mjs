import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { INTERFACE_FAILURE_PHASES, INTERFACE_FIT_PHASES, interfaceFitPlan } from "../app/interface-motion.js";
import { INTERFACE_FAILURE_STEPS, INTERFACE_PROCESS_STAGES } from "../app/interface-playback.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

function standaloneFrozenValue(source, name) {
  const marker = `const ${name}=Object.freeze(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `standalone declares ${name}`);
  let depth = 1;
  let quote = null;
  let escaped = false;
  const valueStart = start + marker.length;
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
    else if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        const value = vm.runInNewContext(`Object.freeze(${source.slice(valueStart, index)})`);
        return JSON.parse(JSON.stringify(value));
      }
    }
  }
  assert.fail(`standalone ${name} declaration is incomplete`);
}

test("production and standalone editions retain the same Interface process contract", async () => {
  const [page, motion, styles, standalone] = await Promise.all([
    read("app/page.tsx"),
    read("app/interface-motion.js"),
    read("app/globals.css"),
    read("outputs/Knowledge-Object-Workbench.html"),
  ]);
  const standaloneStages = standalone.match(/standaloneInterfaceProcessStages=Object\.freeze\(\[([^\]]+)\]\)/)?.[1]
    .split(",").map((value) => value.replaceAll('"', ""));
  assert.deepEqual(standaloneStages, INTERFACE_PROCESS_STAGES);
  for (const [stage, step] of Object.entries(INTERFACE_FAILURE_STEPS)) {
    assert.match(standalone, new RegExp(`${stage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\":${step}`));
  }
  for (const label of ["Input Data Object", "Input Binding", "Computable Knowledge Operation", "Output Binding", "Output Data Object"]) {
    assert.ok(page.includes(label), `production includes ${label}`);
    assert.ok(standalone.includes(label), `standalone includes ${label}`);
  }
  for (const phrase of ["Input data object checked.", "Input moving above its binding.", "Input centered over the matching cavity.", "Input descending into the binding.", "Input fully seated in the binding.", "Input held in the matching cavity.", "Input entering operation.", "Press closing over input.", "Input clamped in the press.", "Input enclosed during computation.", "Press opening to reveal output.", "Output centered over its binding.", "Output snapping into binding.", "Output fully seated in the binding.", "Output held in the matching cavity.", "Output lifting out of the binding.", "Output clear of the binding.", "Output moving to delivery.", "Output delivered.", "Input data object rejected.", "Input binding rejected.", "Operation failed.", "Output binding rejected.", "Output data object rejected."]) {
    assert.ok(`${page}\n${motion}`.includes(phrase), `production includes ${phrase}`);
    assert.ok(standalone.includes(phrase), `standalone includes ${phrase}`);
  }
  for (const feature of ["aria-busy", "aria-atomic", "aria-controls", "ArrowLeft", "ArrowRight", "forced-colors", "prefers-reduced-motion"]) {
    assert.ok(`${page}\n${styles}`.includes(feature), `production retains ${feature}`);
    assert.ok(standalone.includes(feature), `standalone retains ${feature}`);
  }
});

test("standalone motion phases exactly match the production motion contract", async () => {
  const standalone = await read("outputs/Knowledge-Object-Workbench.html");
  const standaloneSuccess = standaloneFrozenValue(standalone, "standaloneExplicitFitPhases");
  const standaloneFailures = standaloneFrozenValue(standalone, "standaloneFailureFitPhases");
  assert.deepEqual(standaloneSuccess, JSON.parse(JSON.stringify(INTERFACE_FIT_PHASES)));
  assert.deepEqual(standaloneFailures, JSON.parse(JSON.stringify(INTERFACE_FAILURE_PHASES)));

  for (const failurePoint of Object.keys(INTERFACE_FAILURE_PHASES)) {
    const productionPlan = interfaceFitPlan(failurePoint).map((frame) => frame.id);
    const stopByFailure = {
      "input-data-object": "input-ready",
      "input-binding": "input-snap",
      operation: "stamp-contact",
      "output-binding": "output-snap-in",
      "output-data-object": "output-delivery",
    };
    const stopIndex = standaloneSuccess.findIndex((frame) => frame.id === stopByFailure[failurePoint]);
    const standalonePlan = [...standaloneSuccess.slice(0, stopIndex + 1), standaloneFailures[failurePoint]].map((frame) => frame.id);
    assert.deepEqual(standalonePlan, productionPlan, `${failurePoint} follows the same path in both editions`);
  }
});

test("both editions retain the same interface playback cadence and accessible terminal behavior", async () => {
  const [page, styles, standalone] = await Promise.all([
    read("app/page.tsx"),
    read("app/globals.css"),
    read("outputs/Knowledge-Object-Workbench.html"),
  ]);
  assert.match(page, /interval = 390/);
  assert.match(standalone, /delay=390/);
  for (const marker of [
    "The moving shape is decorative",
    "interface-process-description",
    "interface-focus-status",
    "fit-rejected",
    "fit-rebound",
    "fit-jammed",
    "forced-colors",
    "prefers-reduced-motion",
  ]) {
    assert.ok(`${page}\n${styles}`.includes(marker), `production retains ${marker}`);
    assert.ok(standalone.includes(marker), `standalone retains ${marker}`);
  }
});

test("both editions preserve the same failure materials and motion-independent cues", async () => {
  const [page, styles, standalone] = await Promise.all([
    read("app/page.tsx"),
    read("app/globals.css"),
    read("outputs/Knowledge-Object-Workbench.html"),
  ]);
  assert.match(styles, /failed:is\(\.failure-input-data-object,\.failure-output-data-object\)/);
  for (const selector of [
    "failed.failure-input-binding .token-input path",
    "failed.failure-operation .token-input path",
    "failed.failure-output-binding .token-output path",
  ]) assert.ok(standalone.includes(selector), `standalone preserves ${selector}`);
  for (const phase of ["input-rejected", "input-binding-rejected", "output-binding-rejected", "output-rejected", "output-received"]) {
    assert.match(styles, new RegExp(`prefers-reduced-motion[\\s\\S]+${phase}`), `production statically represents ${phase}`);
    assert.match(standalone, new RegExp(`prefers-reduced-motion:reduce[\\s\\S]+${phase}`), `standalone statically represents ${phase}`);
  }
  assert.match(page, /Try interface case: \$\{selectedOutcomeLabel\}/);
  assert.match(standalone, /Try interface case: \$\{selectedLabel\}/);
  assert.ok(page.includes('aria-relevant="text"'));
  assert.ok(standalone.includes('setAttribute("aria-relevant","text")'));
});

test("standalone Completed selection returns to the first stage rather than the removed sixth card", async () => {
  const standalone = await read("outputs/Knowledge-Object-Workbench.html");
  assert.match(standalone, /target=outcome==="success"\?cards\[0\]/);
  assert.doesNotMatch(standalone, /target=outcome==="success"\?cards\[5\]/);
});

test("both editions keep only stages preceding an error available for inspection", async () => {
  const [page, standalone] = await Promise.all([
    read("app/page.tsx"),
    read("outputs/Knowledge-Object-Workbench.html"),
  ]);
  assert.match(page, /const locked = Boolean\(failureStep && step >= failureStep\)/);
  assert.match(page, /tabIndex: locked \? -1 : 0/);
  assert.match(page, /onClick: locked \? undefined/);
  assert.match(standalone, /const locked=Boolean\(failureStep&&step>=failureStep\)/);
  assert.match(standalone, /card\.tabIndex=locked\?-1:0/);
  assert.match(standalone, /if\(!card\|\|card\.getAttribute\("aria-disabled"\)==="true"\)return/);
});

test("both editions cancel prior animation work before case or stage changes", async () => {
  const [page, standalone] = await Promise.all([
    read("app/page.tsx"),
    read("outputs/Knowledge-Object-Workbench.html"),
  ]);
  assert.match(page, /const selectOutcome = \(outcome: string\) => \{ clearInterfaceAnimationTimers\(\)/);
  assert.match(page, /const selectInterfaceStep = \(step: number\) => \{ clearInterfaceAnimationTimers\(\)/);
  assert.match(standalone, /\(interfacePassageTimers\.get\(result\)\|\|\[\]\)\.forEach\(clearTimeout\)/);
  assert.match(standalone, /interfacePassageTimers\.delete\(result\)/);
  assert.match(standalone, /reduceStandaloneInterfacePlayback\(standaloneInterfacePlaybackState\(result\),\{type:"select-stage",step\}\)/);
});
