import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ACRONYM_BANNER_SELECTORS, splitAcronymBannerName } from "../app/acronym-bubble-attachment.js";
import { ACRONYM_BUBBLE_REGISTRY } from "../app/acronym-bubble-registry.js";

test("only registered acronyms in displayed names are split", () => {
  assert.deepEqual(splitAcronymBannerName("DFU Severity Score KO", ACRONYM_BUBBLE_REGISTRY), [
    { text: "DFU", expansion: "Diabetic Foot Ulcer" },
    { text: " Severity Score KO" },
  ]);
  assert.deepEqual(splitAcronymBannerName("HBOT Treatment Target KA", ACRONYM_BUBBLE_REGISTRY), [
    { text: "HBOT", expansion: "Hyperbaric Oxygen Therapy" },
    { text: " Treatment Target KA" },
  ]);
  assert.deepEqual(splitAcronymBannerName("XDFU and HBOTX", ACRONYM_BUBBLE_REGISTRY), [{ text: "XDFU and HBOTX" }]);
  assert.deepEqual(splitAcronymBannerName("KO only", ACRONYM_BUBBLE_REGISTRY), [{ text: "KO only" }]);
});

test("selectors target only the eight agreed main-view banner-name surfaces", () => {
  assert.equal(ACRONYM_BANNER_SELECTORS.length, 16);
  assert.ok(ACRONYM_BANNER_SELECTORS.every((selector) => selector.includes(" > strong") && selector.startsWith("section[aria-label=")));
  assert.ok(ACRONYM_BANNER_SELECTORS.every((selector) => !/dialog|facet|file|case/i.test(selector)));
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const block = html.split("/* ACRONYM_BUBBLE_ATTACHMENT_START */")[1]?.split("/* ACRONYM_BUBBLE_ATTACHMENT_END */")[0];
  assert.ok(block, "standalone has the shared attachment block");
  const standalone = runInNewContext(`${block}\n({selectors:ACRONYM_BANNER_SELECTORS,split:splitAcronymBannerName})`);
  assert.deepEqual(JSON.parse(JSON.stringify(standalone.selectors)), ACRONYM_BANNER_SELECTORS);
  assert.deepEqual(JSON.parse(JSON.stringify(standalone.split("DFU", ACRONYM_BUBBLE_REGISTRY))), [{ text: "DFU", expansion: "Diabetic Foot Ulcer" }]);
});
