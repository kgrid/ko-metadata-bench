import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ACRONYM_BUBBLE_REGISTRY, acronymBubbleExpansion } from "../app/acronym-bubble-registry.js";

test("the first registry contains only the two approved written-out forms", () => {
  assert.deepEqual(ACRONYM_BUBBLE_REGISTRY, {
    DFU: "Diabetic Foot Ulcer",
    HBOT: "Hyperbaric Oxygen Therapy",
  });
  assert.equal(acronymBubbleExpansion("DFU"), "Diabetic Foot Ulcer");
  assert.equal(acronymBubbleExpansion("HBOT"), "Hyperbaric Oxygen Therapy");
  assert.equal(acronymBubbleExpansion("dfu"), null);
  assert.equal(acronymBubbleExpansion("KA"), null);
  assert.equal(acronymBubbleExpansion("toString"), null);
});

test("standalone carries the identical shared acronym registry", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const block = html.split("/* ACRONYM_BUBBLE_REGISTRY_START */")[1]?.split("/* ACRONYM_BUBBLE_REGISTRY_END */")[0];
  assert.ok(block, "standalone contains the generated registry block");
  const standalone = runInNewContext(`${block}\n({ registry: ACRONYM_BUBBLE_REGISTRY, expansion: acronymBubbleExpansion })`);
  assert.deepEqual(JSON.parse(JSON.stringify(standalone.registry)), ACRONYM_BUBBLE_REGISTRY);
  for (const [acronym, expansion] of Object.entries(ACRONYM_BUBBLE_REGISTRY)) {
    assert.equal(standalone.expansion(acronym), expansion);
  }
  assert.equal(standalone.expansion("unknown"), null);
});
