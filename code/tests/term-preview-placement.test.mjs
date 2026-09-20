import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { placeTermPreview } from "../app/term-preview-placement.js";

const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
const viewport = { width: 1000, height: 800 };
const workspace = rect(0, 0, 1000, 800);
const preview = { width: 200, height: 100 };

test("adaptive term previews prefer right, then flip left, below, and above", () => {
  assert.equal(placeTermPreview(rect(300, 300, 40, 20), workspace, viewport, preview).placement, "right");
  assert.equal(placeTermPreview(rect(900, 300, 40, 20), workspace, viewport, preview).placement, "left");
  const narrowWorkspace = rect(0, 0, 300, 800);
  assert.equal(placeTermPreview(rect(130, 120, 40, 20), narrowWorkspace, viewport, preview).placement, "below");
  assert.equal(placeTermPreview(rect(130, 700, 40, 20), narrowWorkspace, viewport, preview).placement, "above");
});

test("adaptive term previews remain inside the visible workspace and viewport intersection", () => {
  const result = placeTermPreview(rect(470, 360, 20, 20), rect(200, 100, 300, 300), { width: 480, height: 360 }, preview);
  assert.ok(result.left >= 200 && result.left + preview.width <= 470);
  assert.ok(result.top >= 100 && result.top + preview.height <= 350);
});

test("standalone embeds the same adaptive placement function", () => {
  const standalone = fs.readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.ok(standalone.includes(`const placeTermPreview=${placeTermPreview.toString()};`));
});
