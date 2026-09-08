import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const react = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");

test("both editions place a Runner-aware Run action between Logic and Files", () => {
  assert.match(react, />Logic<\/button>}<button[^>]+koShadeRun[\s\S]*?>Run<\/button><button[^>]+koShadeFileCount/);
  assert.match(standalone, />Logic<\/button>`:""}<button[^>]+ko-shade-run[\s\S]*?>Run<\/button><button[^>]+ko-shade-file-count/);
});

test("Run availability and disabled explanations come from structural discovery", () => {
  assert.match(react, /disabled=\{!runner\?\.available}/);
  assert.match(react, /runner\?\.validationError/);
  assert.match(standalone, /runnerAvailabilityByObject\[objectId\]/);
  assert.match(standalone, /No browser Runner is supplied by this knowledge object\./);
});

test("both editions reserve one aligned panel-action column for Run", () => {
  assert.match(css, /grid-template-columns: auto minmax\(0,1fr\) 68px 44px 44px 64px/);
  assert.match(standalone, /grid-template-columns:auto minmax\(0,1fr\) 68px 44px 44px 64px/);
});
