import assert from "node:assert/strict";
import test from "node:test";
import { INTERFACE_FAILURE_PHASES, INTERFACE_FIT_PHASES, INTERFACE_MOTION_STATIONS, interfaceFitPlan, interfaceMotionFrame, interfaceMotionPhaseForStep, interfaceMotionStation } from "../app/interface-motion.js";
import { INTERFACE_PROCESS_STAGES } from "../app/interface-playback.js";

test("the interface uses one ordered horizontal motion path", () => {
  assert.deepEqual(INTERFACE_MOTION_STATIONS.map((station) => station.stage), INTERFACE_PROCESS_STAGES);
  assert.deepEqual(INTERFACE_MOTION_STATIONS.map((station) => station.x), [10, 30, 50, 70, 90]);
  assert.ok(INTERFACE_MOTION_STATIONS.every((station, index, all) => index === 0 || station.x > all[index - 1].x));
});

test("motion stations clamp safely and change form only after the operation", () => {
  assert.equal(interfaceMotionStation(-10), INTERFACE_MOTION_STATIONS[0]);
  assert.equal(interfaceMotionStation(100), INTERFACE_MOTION_STATIONS[4]);
  assert.deepEqual(INTERFACE_MOTION_STATIONS.map((station) => station.form), ["input", "input", "input", "output", "output"]);
});

test("the motion contract declares explicit input and output snap phases", () => {
  const inputFitting = INTERFACE_FIT_PHASES.filter((frame) => frame.stage === "input-binding");
  const outputFitting = INTERFACE_FIT_PHASES.filter((frame) => frame.stage === "output-binding");
  assert.deepEqual(inputFitting.map((frame) => frame.id), ["input-approach", "input-align", "input-snap", "input-seated", "input-locked"]);
  assert.deepEqual(inputFitting.map((frame) => frame.fit), ["approach", "align", "snap-in", "seated", "seated"]);
  assert.deepEqual(outputFitting.map((frame) => frame.id), ["output-approach", "output-snap-in", "output-seated", "output-locked", "output-release", "output-snap-out"]);
  assert.deepEqual(outputFitting.map((frame) => frame.fit), ["approach", "snap-in", "seated", "seated", "release", "snap-out"]);
  assert.equal(interfaceMotionFrame("input-seated").x, 30);
  assert.equal(interfaceMotionFrame("output-seated").x, 70);
  assert.equal(interfaceMotionPhaseForStep(2), "input-seated");
  assert.equal(interfaceMotionPhaseForStep(4), "output-seated");
});

test("failures end with their own physical terminal phase", () => {
  assert.equal(interfaceFitPlan("input-data-object").at(-1).id, "input-rejected");
  assert.equal(interfaceFitPlan("input-binding").at(-1).id, "input-binding-rejected");
  assert.equal(interfaceFitPlan("operation").at(-1).id, "operation-failed");
  assert.equal(interfaceFitPlan("output-binding").at(-1).id, "output-binding-rejected");
  assert.equal(interfaceFitPlan("output-data-object").at(-1).id, "output-rejected");
  assert.deepEqual(Object.values(INTERFACE_FAILURE_PHASES).map((frame) => frame.fit), ["rejected", "rebound", "jammed", "rebound", "rejected"]);
  for (const frame of Object.values(INTERFACE_FAILURE_PHASES)) assert.equal(interfaceMotionFrame(frame.id), frame);
  assert.equal(interfaceFitPlan().at(-1).id, "output-received");
});

test("an operation failure never presents a completed transformation", () => {
  const failedOperation = interfaceFitPlan("operation");
  assert.equal(failedOperation.at(-2).id, "stamp-contact");
  assert.equal(failedOperation.at(-1).form, "input");
  assert.ok(!failedOperation.some((frame) => frame.id === "stamp-transform" || frame.id === "stamp-up"));
});

test("the operation declares entry, stamping, transformation, and reveal phases", () => {
  const operationFrames = INTERFACE_FIT_PHASES.filter((frame) => frame.stage === "operation");
  assert.deepEqual(operationFrames.map((frame) => frame.id), ["operation-entry", "stamp-down", "stamp-contact", "stamp-transform", "stamp-up"]);
  assert.deepEqual(operationFrames.map((frame) => frame.form), ["input", "input", "input", "transform", "output"]);
  assert.deepEqual(operationFrames.map((frame) => frame.fit), ["travel", "stamp-down", "stamp-contact", "stamp-transform", "stamp-up"]);
  assert.deepEqual(operationFrames.map((frame) => frame.x), [44, 49, 50, 50, 52]);
  assert.ok(INTERFACE_FIT_PHASES.slice(0, INTERFACE_FIT_PHASES.indexOf(operationFrames[0])).every((frame) => frame.form === "input"));
  assert.ok(INTERFACE_FIT_PHASES.slice(INTERFACE_FIT_PHASES.indexOf(operationFrames.at(-1)) + 1).every((frame) => frame.form === "output"));
  assert.equal(interfaceMotionPhaseForStep(3), "stamp-transform");
});

test("successful delivery releases, snaps out, carries, and hands off the output", () => {
  const delivery = INTERFACE_FIT_PHASES.filter((frame) => ["output-release", "output-snap-out", "output-delivery", "output-received"].includes(frame.id));
  assert.deepEqual(delivery.map((frame) => frame.form), ["output", "output", "output", "output"]);
  assert.deepEqual(delivery.map((frame) => frame.x), [70, 70, 86, 90]);
  assert.equal(interfaceMotionPhaseForStep(5), "output-received");
  assert.equal(interfaceFitPlan("output-data-object").at(-2).id, "output-delivery");
  assert.equal(interfaceFitPlan().at(-1).id, "output-received");
});
