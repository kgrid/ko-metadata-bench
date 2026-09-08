import test from "node:test";
import assert from "node:assert/strict";
import {
  createInterfacePlaybackState,
  interfacePlaybackReducer,
  interfaceRunPlan,
  INTERFACE_PROCESS_STAGES,
} from "../app/interface-playback.js";

const cases = [
  { outcome: "INVALID_INPUT", failurePoint: "input-data-object" },
  { outcome: "CONTRACT_MISMATCH", failurePoint: "input-binding" },
  { outcome: "EXECUTION_FAILED", failurePoint: "operation" },
];

test("the interface run plan is deterministic for success and every supplied failure", () => {
  assert.deepEqual(INTERFACE_PROCESS_STAGES, ["input-data-object", "input-binding", "operation", "output-binding", "output-data-object"]);
  assert.deepEqual(interfaceRunPlan("success", cases).steps, [1, 2, 3, 4, 5]);
  assert.deepEqual(interfaceRunPlan("INVALID_INPUT", cases).steps, [1]);
  assert.deepEqual(interfaceRunPlan("CONTRACT_MISMATCH", cases).steps, [1, 2]);
  assert.deepEqual(interfaceRunPlan("EXECUTION_FAILED", cases).steps, [1, 2, 3]);
});

test("the run plan preserves the selected case and safely completes unknown outcomes", () => {
  for (const simulationCase of cases) {
    const plan = interfaceRunPlan(simulationCase.outcome, cases);
    assert.equal(plan.simulationCase, simulationCase);
    assert.equal(plan.failurePoint, simulationCase.failurePoint);
    assert.equal(plan.stop, INTERFACE_PROCESS_STAGES.indexOf(simulationCase.failurePoint) + 1);
    assert.deepEqual(plan.steps, Array.from({ length: plan.stop }, (_, index) => index + 1));
  }
  const unknown = interfaceRunPlan("NOT_DECLARED", cases);
  assert.deepEqual(unknown, {
    outcome: "NOT_DECLARED",
    simulationCase: null,
    failurePoint: null,
    stop: 5,
    steps: [1, 2, 3, 4, 5],
  });
});

test("case selection establishes one coherent idle state", () => {
  const initial = createInterfacePlaybackState();
  const plan = interfaceRunPlan("CONTRACT_MISMATCH", cases);
  const selected = interfacePlaybackReducer(initial, { type: "select-case", outcome: plan.outcome, stop: plan.stop, failurePoint: plan.failurePoint });
  assert.deepEqual(selected, { outcome: "CONTRACT_MISMATCH", step: 2, phase: "idle", showCaseDetail: true, runId: 1 });
});

test("playback advances and completes only for the active run", () => {
  const started = interfacePlaybackReducer(createInterfacePlaybackState(), { type: "start", runId: 7 });
  const advanced = interfacePlaybackReducer(started, { type: "advance", step: 2, runId: 7 });
  const stale = interfacePlaybackReducer(advanced, { type: "advance", step: 5, runId: 6 });
  const completed = interfacePlaybackReducer(stale, { type: "complete", step: 3, showCaseDetail: true, runId: 7 });
  assert.equal(advanced.step, 2);
  assert.equal(stale, advanced);
  assert.deepEqual(completed, { outcome: "success", step: 3, phase: "complete", showCaseDetail: true, runId: 7 });
});

test("manual inspection cancels a running sequence without losing the selected case", () => {
  const started = interfacePlaybackReducer(createInterfacePlaybackState(), { type: "start", runId: 2 });
  const inspected = interfacePlaybackReducer(started, { type: "select-stage", step: 4 });
  assert.deepEqual(inspected, { outcome: "success", step: 4, phase: "idle", showCaseDetail: false, runId: 3 });
});

test("case switching invalidates an active run and lands on the selected failure point", () => {
  const running = interfacePlaybackReducer(createInterfacePlaybackState(), { type: "start", runId: 4 });
  const plan = interfaceRunPlan("EXECUTION_FAILED", cases);
  const selected = interfacePlaybackReducer(running, { type: "select-case", outcome: plan.outcome, stop: plan.stop, failurePoint: plan.failurePoint });
  assert.deepEqual(selected, { outcome: "EXECUTION_FAILED", step: 3, phase: "idle", showCaseDetail: true, runId: 5 });
  assert.equal(interfacePlaybackReducer(selected, { type: "advance", step: 5, runId: 4 }), selected);
  assert.equal(interfacePlaybackReducer(selected, { type: "complete", step: 5, showCaseDetail: false, runId: 4 }), selected);
});

test("cancel and reset prevent late animation events from changing the interface", () => {
  const running = interfacePlaybackReducer(createInterfacePlaybackState(), { type: "start", runId: 9 });
  const cancelled = interfacePlaybackReducer(running, { type: "cancel" });
  assert.deepEqual(cancelled, { outcome: "success", step: 1, phase: "idle", showCaseDetail: false, runId: 10 });
  assert.equal(interfacePlaybackReducer(cancelled, { type: "advance", step: 4, runId: 9 }), cancelled);
  assert.equal(interfacePlaybackReducer(cancelled, { type: "complete", step: 5, showCaseDetail: true, runId: 9 }), cancelled);

  const reset = interfacePlaybackReducer({ ...cancelled, outcome: "INVALID_INPUT", step: 3, showCaseDetail: true }, { type: "reset", step: 2 });
  assert.deepEqual(reset, { outcome: "success", step: 2, phase: "idle", showCaseDetail: false, runId: 11 });
});

test("idle stage inspection is stable and unknown events are harmless", () => {
  const initial = createInterfacePlaybackState();
  const inspected = interfacePlaybackReducer(initial, { type: "select-stage", step: 5 });
  assert.deepEqual(inspected, { outcome: "success", step: 5, phase: "idle", showCaseDetail: false, runId: 0 });
  assert.equal(interfacePlaybackReducer(inspected, { type: "not-an-interface-event" }), inspected);
});
