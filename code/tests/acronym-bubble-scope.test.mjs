import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ACRONYM_BUBBLE_SCOPE, isAcronymBubbleInScope } from "../app/acronym-bubble-scope.js";

test("only main-view KO and KA banner names are in the first acronym-bubble scope", () => {
  assert.deepEqual(Object.keys(ACRONYM_BUBBLE_SCOPE), [
    "knowledge-objects", "metadata-rig", "knowledge", "findability", "access",
    "interoperability", "reusability", "knowledge-assembly",
  ]);
  for (const view of Object.keys(ACRONYM_BUBBLE_SCOPE)) {
    const eligible = view === "knowledge-assembly" ? "ka-banner-name" : "ko-banner-name";
    assert.equal(isAcronymBubbleInScope(view, eligible), true);
    for (const excluded of ["view-title", "facet", "metadata-table", "case-content", "dialog", "file-name", "search-result"]) {
      assert.equal(isAcronymBubbleInScope(view, excluded), false);
    }
  }
  assert.equal(isAcronymBubbleInScope("orchestration", "ko-banner-name"), false);
  assert.equal(isAcronymBubbleInScope("knowledge-assembly", "ko-banner-name"), false);
});

test("standalone carries the identical shared acronym-bubble scope", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const block = html.split("/* ACRONYM_BUBBLE_SCOPE_START */")[1]?.split("/* ACRONYM_BUBBLE_SCOPE_END */")[0];
  assert.ok(block, "standalone contains the generated scope block");
  const standalone = runInNewContext(`${block}\n({ scope: ACRONYM_BUBBLE_SCOPE, eligible: isAcronymBubbleInScope })`);
  assert.deepEqual(JSON.parse(JSON.stringify(standalone.scope)), ACRONYM_BUBBLE_SCOPE);
  for (const [view, surface] of Object.entries(ACRONYM_BUBBLE_SCOPE)) {
    assert.equal(standalone.eligible(view, surface), true);
    assert.equal(standalone.eligible(view, "metadata-table"), false);
  }
});
