import { INTERFACE_PROCESS_STAGES } from "./interface-playback.js";

export const INTERFACE_MOTION_STATIONS = Object.freeze([
  Object.freeze({ stage: "input-data-object", x: 10, form: "input" }),
  Object.freeze({ stage: "input-binding", x: 30, form: "input" }),
  Object.freeze({ stage: "operation", x: 50, form: "input" }),
  Object.freeze({ stage: "output-binding", x: 70, form: "output" }),
  Object.freeze({ stage: "output-data-object", x: 90, form: "output" }),
]);

export const INTERFACE_FIT_PHASES = Object.freeze([
  Object.freeze({ id: "input-ready", step: 1, stage: "input-data-object", x: 10, form: "input", fit: "travel", status: "Input data object checked." }),
  Object.freeze({ id: "input-approach", step: 2, stage: "input-binding", x: 30, form: "input", fit: "approach", status: "Input moving above its binding." }),
  Object.freeze({ id: "input-align", step: 2, stage: "input-binding", x: 30, form: "input", fit: "align", status: "Input centered over the matching cavity." }),
  Object.freeze({ id: "input-snap", step: 2, stage: "input-binding", x: 30, form: "input", fit: "snap-in", status: "Input descending into the binding." }),
  Object.freeze({ id: "input-seated", step: 2, stage: "input-binding", x: 30, form: "input", fit: "seated", status: "Input fully seated in the binding." }),
  Object.freeze({ id: "input-locked", step: 2, stage: "input-binding", x: 30, form: "input", fit: "seated", status: "Input held in the matching cavity." }),
  Object.freeze({ id: "operation-entry", step: 3, stage: "operation", x: 44, form: "input", fit: "travel", status: "Input entering operation." }),
  Object.freeze({ id: "stamp-down", step: 3, stage: "operation", x: 49, form: "input", fit: "stamp-down", status: "Press closing over input." }),
  Object.freeze({ id: "stamp-contact", step: 3, stage: "operation", x: 50, form: "input", fit: "stamp-contact", status: "Input clamped in the press." }),
  Object.freeze({ id: "stamp-transform", step: 3, stage: "operation", x: 50, form: "transform", fit: "stamp-transform", status: "Input enclosed during computation." }),
  Object.freeze({ id: "stamp-up", step: 3, stage: "operation", x: 52, form: "output", fit: "stamp-up", status: "Press opening to reveal output." }),
  Object.freeze({ id: "output-approach", step: 4, stage: "output-binding", x: 70, form: "output", fit: "approach", status: "Output centered over its binding." }),
  Object.freeze({ id: "output-snap-in", step: 4, stage: "output-binding", x: 70, form: "output", fit: "snap-in", status: "Output snapping into binding." }),
  Object.freeze({ id: "output-seated", step: 4, stage: "output-binding", x: 70, form: "output", fit: "seated", status: "Output fully seated in the binding." }),
  Object.freeze({ id: "output-locked", step: 4, stage: "output-binding", x: 70, form: "output", fit: "seated", status: "Output held in the matching cavity." }),
  Object.freeze({ id: "output-release", step: 4, stage: "output-binding", x: 70, form: "output", fit: "release", status: "Output lifting out of the binding." }),
  Object.freeze({ id: "output-snap-out", step: 4, stage: "output-binding", x: 70, form: "output", fit: "snap-out", status: "Output clear of the binding." }),
  Object.freeze({ id: "output-delivery", step: 5, stage: "output-data-object", x: 86, form: "output", fit: "delivery", status: "Output moving to delivery." }),
  Object.freeze({ id: "output-received", step: 5, stage: "output-data-object", x: 90, form: "output", fit: "received", status: "Output delivered." }),
]);

const FIT_FAILURE_STOP = Object.freeze({
  "input-data-object": "input-ready",
  "input-binding": "input-snap",
  operation: "stamp-contact",
  "output-binding": "output-snap-in",
  "output-data-object": "output-delivery",
});

export const INTERFACE_FAILURE_PHASES = Object.freeze({
  "input-data-object": Object.freeze({ id: "input-rejected", step: 1, stage: "input-data-object", x: 10, form: "input", fit: "rejected", status: "Input data object rejected." }),
  "input-binding": Object.freeze({ id: "input-binding-rejected", step: 2, stage: "input-binding", x: 27, form: "input", fit: "rebound", status: "Input binding rejected." }),
  operation: Object.freeze({ id: "operation-failed", step: 3, stage: "operation", x: 50, form: "input", fit: "jammed", status: "Operation failed." }),
  "output-binding": Object.freeze({ id: "output-binding-rejected", step: 4, stage: "output-binding", x: 67, form: "output", fit: "rebound", status: "Output binding rejected." }),
  "output-data-object": Object.freeze({ id: "output-rejected", step: 5, stage: "output-data-object", x: 86, form: "output", fit: "rejected", status: "Output data object rejected." }),
});

export function interfaceMotionFrame(phase, fallbackStep = 1) {
  return INTERFACE_FIT_PHASES.find((frame) => frame.id === phase)
    ?? Object.values(INTERFACE_FAILURE_PHASES).find((frame) => frame.id === phase)
    ?? INTERFACE_FIT_PHASES.find((frame) => frame.step === fallbackStep)
    ?? INTERFACE_FIT_PHASES[0];
}

export function interfaceMotionPhaseForStep(step) {
  return ["input-ready", "input-seated", "stamp-transform", "output-seated", "output-received"][Math.max(0, Math.min(4, Number(step || 1) - 1))];
}

export function interfaceFitPlan(failurePoint = null) {
  const stopId = failurePoint ? FIT_FAILURE_STOP[failurePoint] : null;
  const stopIndex = stopId ? INTERFACE_FIT_PHASES.findIndex((frame) => frame.id === stopId) : INTERFACE_FIT_PHASES.length - 1;
  const plan = INTERFACE_FIT_PHASES.slice(0, Math.max(0, stopIndex) + 1);
  const failureFrame = failurePoint ? INTERFACE_FAILURE_PHASES[failurePoint] : null;
  return failureFrame ? [...plan, failureFrame] : plan;
}

export function interfaceMotionStation(step) {
  const index = Math.max(0, Math.min(INTERFACE_MOTION_STATIONS.length - 1, Number(step || 1) - 1));
  return INTERFACE_MOTION_STATIONS[index];
}

if (INTERFACE_MOTION_STATIONS.some((station, index) => station.stage !== INTERFACE_PROCESS_STAGES[index])) {
  throw new Error("Interface motion stations must follow the five-stage process order.");
}
