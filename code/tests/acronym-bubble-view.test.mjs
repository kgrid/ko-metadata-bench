import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createAcronymBubbleElement, positionAcronymBubble } from "../app/acronym-bubble-view.js";

function fakeDocument() {
  return {
    createElement(tagName) {
      return {
        tagName,
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
      };
    },
  };
}

test("bubble renders only written-out text, with no native title tooltip", () => {
  const bubble = createAcronymBubbleElement(fakeDocument(), "Diabetic Foot Ulcer");
  assert.equal(bubble.tagName, "div");
  assert.equal(bubble.className, "acronymBubble");
  assert.equal(bubble.attributes.role, "tooltip");
  assert.equal(bubble.textContent, "Diabetic Foot Ulcer");
  assert.equal(bubble.attributes.title, undefined);
  assert.throws(() => createAcronymBubbleElement(fakeDocument(), " "), TypeError);
});

test("standalone carries the same bubble renderer and marker treatment", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const block = html.split("/* ACRONYM_BUBBLE_VIEW_START */")[1]?.split("/* ACRONYM_BUBBLE_VIEW_END */")[0];
  assert.ok(block);
  const render = runInNewContext(`${block}\ncreateAcronymBubbleElement`);
  const bubble = render(fakeDocument(), "Hyperbaric Oxygen Therapy");
  assert.equal(bubble.textContent, "Hyperbaric Oxygen Therapy");
  assert.match(html, /\.acronymBubbleAnchor\{/);
  assert.match(html, /\.acronymBubble::after\{/);
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.acronymBubbleAnchor \{/);
  assert.match(css, /\.acronymBubble::after \{/);
  assert.equal(typeof runInNewContext(`${block}\npositionAcronymBubble`), "function");
});

function geometry(anchorRect, bubbleRect) {
  const anchor = { getBoundingClientRect: () => ({ ...anchorRect }) };
  const values = {};
  const bubble = {
    getBoundingClientRect: () => ({ ...bubbleRect }),
    dataset: {},
    style: { setProperty: (name, value) => { values[name] = value; } },
  };
  return { anchor, bubble, values };
}

test("placement remains in view and does not move or resize the banner", () => {
  const g = geometry({ left: 315, right: 355, top: 30, bottom: 55 }, { width: 180, height: 46 });
  const before = g.anchor.getBoundingClientRect();
  const placed = positionAcronymBubble({ anchor: g.anchor, bubble: g.bubble, viewport: { innerWidth: 360, innerHeight: 300 } });
  assert.ok(placed.left >= 12 && placed.left + 180 <= 348);
  assert.ok(placed.top >= 12 && placed.top + 46 <= 288);
  assert.equal(g.bubble.dataset.side, "below");
  assert.equal(g.bubble.style.left, `${placed.left}px`);
  assert.deepEqual(g.anchor.getBoundingClientRect(), before);
});

test("placement flips above or shifts sideways to avoid neighboring controls", () => {
  const g = geometry({ left: 130, right: 170, top: 200, bottom: 225 }, { width: 160, height: 48 });
  const above = positionAcronymBubble({ anchor: g.anchor, bubble: g.bubble, viewport: { innerWidth: 320, innerHeight: 240 } });
  assert.equal(above.side, "above");
  const h = geometry({ left: 130, right: 170, top: 30, bottom: 55 }, { width: 160, height: 48 });
  const shifted = positionAcronymBubble({
    anchor: h.anchor, bubble: h.bubble, viewport: { innerWidth: 320, innerHeight: 240 },
    avoidRects: [{ left: 70, right: 210, top: 60, bottom: 120 }],
  });
  assert.equal(shifted.side, "below");
  assert.ok(shifted.left > 70);
});
