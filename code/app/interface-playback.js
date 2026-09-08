export const INTERFACE_PROCESS_STAGES = Object.freeze(["input-data-object", "input-binding", "operation", "output-binding", "output-data-object"]);
export const INTERFACE_FAILURE_STEPS = Object.freeze(Object.fromEntries(INTERFACE_PROCESS_STAGES.map((name, index) => [name, index + 1])));

export function interfaceRunPlan(outcome, simulationCases = []) {
  const simulationCase = simulationCases.find((candidate) => candidate.outcome === outcome) ?? null;
  const failurePoint = simulationCase?.failurePoint ?? null;
  const stop = failurePoint ? INTERFACE_FAILURE_STEPS[failurePoint] ?? INTERFACE_PROCESS_STAGES.length : INTERFACE_PROCESS_STAGES.length;
  return Object.freeze({ outcome, simulationCase, failurePoint, stop, steps: Object.freeze(Array.from({ length: stop }, (_, index) => index + 1)) });
}

export function createInterfacePlaybackState() {
  return { outcome: "success", step: 1, phase: "idle", showCaseDetail: false, runId: 0 };
}

export function interfacePlaybackReducer(state, event) {
  switch (event.type) {
    case "reset": return { ...createInterfacePlaybackState(), step: event.step ?? 1, runId: state.runId + 1 };
    case "select-case": return { outcome: event.outcome, step: event.failurePoint ? event.stop : 1, phase: "idle", showCaseDetail: Boolean(event.failurePoint), runId: state.runId + 1 };
    case "select-stage": return { ...state, step: event.step, phase: state.phase === "running" ? "idle" : state.phase, showCaseDetail: false, runId: state.phase === "running" ? state.runId + 1 : state.runId };
    case "start": return { ...state, step: 1, phase: "running", showCaseDetail: false, runId: event.runId };
    case "advance": return event.runId === state.runId && state.phase === "running" ? { ...state, step: event.step } : state;
    case "complete": return event.runId === state.runId ? { ...state, step: event.step, phase: "complete", showCaseDetail: event.showCaseDetail } : state;
    case "cancel": return { ...state, phase: state.phase === "running" ? "idle" : state.phase, runId: state.runId + 1 };
    default: return state;
  }
}
