import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createAcronymBubbleBehavior } from "../app/acronym-bubble-behavior.js";

class Target {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  contains(target) { return target === this; }
  emit(type, properties = {}) {
    const event = {
      type, target: this, ...properties,
      prevented: false, stopped: false,
      preventDefault() { this.prevented = true; },
      stopPropagation() { this.stopped = true; },
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    return event;
  }
}

function exerciseBehavior(create) {
  const root = new Target();
  const dfu = new Target();
  const hbot = new Target();
  const events = [];
  const behavior = create({
    root,
    onShow: ({ anchor, expansion }) => events.push(["show", anchor === dfu ? "DFU" : "HBOT", expansion]),
    onHide: ({ anchor }) => events.push(["hide", anchor === dfu ? "DFU" : "HBOT"]),
  });
  const unregisterDfu = behavior.register(dfu, "Diabetic Foot Ulcer");
  behavior.register(hbot, "Hyperbaric Oxygen Therapy");

  dfu.emit("pointerenter", { pointerType: "mouse" });
  assert.equal(behavior.active()?.expansion, "Diabetic Foot Ulcer");
  hbot.emit("pointerenter", { pointerType: "pen" });
  assert.equal(behavior.active()?.expansion, "Hyperbaric Oxygen Therapy");
  assert.deepEqual(events.slice(0, 3), [
    ["show", "DFU", "Diabetic Foot Ulcer"],
    ["hide", "DFU"],
    ["show", "HBOT", "Hyperbaric Oxygen Therapy"],
  ]);
  hbot.emit("pointerleave", { pointerType: "pen" });
  assert.equal(behavior.active(), null);

  dfu.emit("focus");
  assert.equal(behavior.active()?.anchor, dfu);
  const escape = root.emit("keydown", { key: "Escape" });
  assert.equal(behavior.active(), null);
  assert.equal(escape.prevented, true);
  assert.equal(escape.stopped, true);

  dfu.emit("pointerdown", { pointerType: "touch" });
  dfu.emit("focus");
  assert.equal(behavior.active()?.anchor, dfu);
  dfu.emit("pointerdown", { pointerType: "touch" });
  assert.equal(behavior.active(), null);
  dfu.emit("pointerdown", { pointerType: "touch" });
  root.emit("pointerdown", { pointerType: "touch", target: new Target() });
  assert.equal(behavior.active(), null);
  dfu.emit("blur");
  dfu.emit("focus");
  assert.equal(behavior.active()?.anchor, dfu);

  unregisterDfu();
  assert.equal(behavior.active(), null);
  dfu.emit("pointerenter", { pointerType: "mouse" });
  assert.equal(behavior.active(), null);
  behavior.destroy();
  hbot.emit("focus");
  assert.equal(behavior.active(), null);
  assert.equal(root.listeners.get("keydown")?.size, 0);
}

test("shared behavior handles hover, focus, touch, dismissal, exclusivity, and cleanup", () => {
  exerciseBehavior(createAcronymBubbleBehavior);
});

test("standalone carries the same reusable behavior", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const block = html.split("/* ACRONYM_BUBBLE_BEHAVIOR_START */")[1]?.split("/* ACRONYM_BUBBLE_BEHAVIOR_END */")[0];
  assert.ok(block, "standalone contains the generated behavior block");
  const standaloneCreate = runInNewContext(`${block}\ncreateAcronymBubbleBehavior`);
  exerciseBehavior(standaloneCreate);
});
