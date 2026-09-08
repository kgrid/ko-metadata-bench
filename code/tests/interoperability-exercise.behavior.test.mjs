import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadInteroperabilityExerciseKit, projectInteroperabilityExerciseState } from "../app/interoperability-exercise.js";
import { createInteroperabilitySimulationHost } from "../app/interoperability-simulation.js";

const root = "wagner-interoperability-exercise/";
const target = { identifier: "wagner", version: "1.0", specification: "https://example.org/wagner/1.0" };

function exerciseFiles(overrides = {}) {
  const content = {
    [`${root}interoperability.exercise.json`]: JSON.stringify({ exerciseType: "interoperability", knowledgeObject: "wagner", targetKnowledgeObject: target, simulationState: { semantics: "missing", profiles: "missing", interface: "missing" } }),
    [`${root}execution/raw-execution.json`]: JSON.stringify({ executionMode: "raw", publishedBoundary: false, entryPoint: "execution/raw.js#execute", executorBinding: "host-supplied", inputExample: "examples/raw-input.json", expectedOutput: "examples/raw-output.json" }),
    [`${root}execution/contract-execution.json`]: JSON.stringify({ executionMode: "contract", publishedBoundary: true, declaredInvocation: "await knowledgeObject.run(input)", entryPoint: "execution/contract.js#execute", targetBinding: { type: "externalKnowledgeObject", ...target }, input: { profile: "CompletedQuestionnaireResponseProfile", profileArtifact: "profiles/input.json", example: "examples/valid-input.json" }, output: { profile: "WagnerAnalysisResultProfile", profileArtifact: "profiles/output.json", example: "examples/expected-output.json" } }),
    [`${root}examples/raw-input.json`]: JSON.stringify({ input1: 1, input2: 2, input3: 3 }),
    [`${root}examples/raw-output.json`]: JSON.stringify({ output1: 4 }),
    [`${root}examples/valid-input.json`]: JSON.stringify({ questions: [{ id: "clinical-question", response: 2 }] }),
    [`${root}examples/expected-output.json`]: JSON.stringify({ grade: 2, classification: "clinical classification" }),
    [`${root}semantics/input-semantics.json`]: JSON.stringify({ artifactType: "semantic-boundary-view", role: "input", concept: "Completed questionnaire", identifier: "https://example.org/CompletedQuestionnaire", meaning: "Clinical questionnaire responses" }),
    [`${root}semantics/output-semantics.json`]: JSON.stringify({ artifactType: "semantic-boundary-view", role: "output", concept: "Wagner result", identifier: "https://example.org/WagnerResult", meaning: "Clinical grade and classification" }),
    [`${root}profiles/input.json`]: JSON.stringify({ artifactType: "object-profile", profile: "CompletedQuestionnaireResponseProfile", semanticType: "Completed questionnaire", type: "object", required: ["questions"], properties: { questions: { type: "array" } }, example: { questions: [] } }),
    [`${root}profiles/output.json`]: JSON.stringify({ artifactType: "object-profile", profile: "WagnerAnalysisResultProfile", semanticType: "Wagner result", type: "object", required: ["grade"], properties: { grade: { type: "number" } }, example: { grade: 2 } }),
    [`${root}interface/interface.json`]: JSON.stringify({ artifactType: "interface-boundary-view", targetKnowledgeObject: "wagner", invocation: { language: "JavaScript", member: "run", signature: "run(input)", usage: "await knowledgeObject.run(input)" }, inputBinding: "CompletedQuestionnaireResponseProfile", outputBinding: "WagnerAnalysisResultProfile" }),
    [`${root}states/state-0.json`]: JSON.stringify({ semantics: "missing", profiles: "missing", interface: "missing" }),
    [`${root}states/state-1.json`]: JSON.stringify({ semantics: "complete", profiles: "missing", interface: "missing" }),
    [`${root}states/state-2.json`]: JSON.stringify({ semantics: "complete", profiles: "complete", interface: "missing" }),
    [`${root}states/state-3.json`]: JSON.stringify({ semantics: "complete", profiles: "complete", interface: "complete" }),
    ...overrides,
  };
  return { files: Object.keys(content), readText: (path) => content[path], target, content };
}

function load(overrides) {
  const fixture = exerciseFiles(overrides);
  return { fixture, result: loadInteroperabilityExerciseKit(fixture) };
}

test("exercise discovery requires the independent configuration file", () => {
  let reads = 0;
  const result = loadInteroperabilityExerciseKit({ files: [`${root}semantics/input-semantics.json`, `${root}execution/raw-execution.json`], readText: () => { reads += 1; return "{}"; }, target });
  assert.deepEqual(result, { status: "absent" });
  assert.equal(reads, 0, "an absent exercise must not inspect unrelated KO files");
});

test("element-level semantics preserve question text and coded-value meanings", () => {
  const fixture = exerciseFiles();
  const input = JSON.parse(fixture.content[`${root}semantics/input-semantics.json`]);
  input.elements = [{ name: "questions", meaning: "The supplied questions.", members: [{ position: 1, id: "Q01", text: "First question?", meaning: "Meaning of the first question." }], values: [{ value: "1", meaning: "Present." }] }];
  fixture.content[`${root}semantics/input-semantics.json`] = JSON.stringify(input);
  const result = loadInteroperabilityExerciseKit(fixture);
  assert.equal(result.status, "valid");
  assert.equal(result.artifacts.semantics.input.data.elements[0].members[0].text, "First question?");
  assert.equal(result.artifacts.semantics.input.data.elements[0].values[0].meaning, "Present.");
});

test("a failure before the first interface stage may declare no passed steps", () => {
  const specification = { artifactType: "interface-boundary-view", targetKnowledgeObject: "wagner", invocation: { language: "JavaScript", member: "run", signature: "run(input)", usage: "await knowledgeObject.run(input)" }, inputBinding: "CompletedQuestionnaireResponseProfile", outputBinding: "WagnerAnalysisResultProfile", outcomes: { errors: { definitions: [{ code: "INVALID_INPUT" }] } }, simulationCases: [{ id: "invalid-input", outcome: "INVALID_INPUT", failurePoint: "input-data-object", cause: "The input is invalid.", expected: {}, actual: {}, passedSteps: [] }] };
  const { result } = load({ [`${root}interface/interface.json`]: JSON.stringify(specification) });
  assert.equal(result.status, "valid");
  assert.deepEqual(result.artifacts.interface.data.simulationCases[0].passedSteps, []);
});

test("target identity and version are enforced before educational use", () => {
  const fixture = exerciseFiles();
  const wrongIdentity = loadInteroperabilityExerciseKit({ ...fixture, target: { ...target, identifier: "other" } });
  const wrongVersion = loadInteroperabilityExerciseKit({ ...fixture, target: { ...target, version: "2.0" } });
  assert.equal(wrongIdentity.status, "invalid");
  assert.match(wrongIdentity.diagnostics[0], /identifier does not match/);
  assert.equal(wrongVersion.status, "invalid");
  assert.match(wrongVersion.diagnostics[0], /version does not match/);
});

test("all eight facet combinations reveal only their own educational facet", () => {
  for (const semantics of ["missing", "complete"]) for (const profiles of ["missing", "complete"]) for (const interfac of ["missing", "complete"]) {
    const result = projectInteroperabilityExerciseState({ semantics, profiles, interface: interfac });
    assert.deepEqual(result.visible, { semantics: semantics === "complete", profiles: profiles === "complete", interface: interfac === "complete" });
    assert.equal(result.rawExecutionAvailable, true);
    assert.equal(result.contractExecutionAvailable, interfac === "complete");
  }
});

test("State 0 exposes only an opaque raw boundary", () => {
  const { result } = load();
  assert.equal(result.status, "valid");
  const state = projectInteroperabilityExerciseState(result.states["state-0.json"]);
  assert.deepEqual(state.visible, { semantics: false, profiles: false, interface: false });
  assert.deepEqual(result.execution.rawInput.data, { input1: 1, input2: 2, input3: 3 });
  assert.deepEqual(result.execution.rawOutput.data, { output1: 4 });
  const opaqueSurface = JSON.stringify({ input: result.execution.rawInput.data, output: result.execution.rawOutput.data });
  assert.doesNotMatch(opaqueSurface, /wagner|clinical|question|response|grade|classification|run\s*\(/i);
});

test("States 1 through 3 follow the deliberate reveal sequence", () => {
  const { result } = load();
  assert.equal(result.status, "valid");
  const state1 = projectInteroperabilityExerciseState(result.states["state-1.json"]);
  const state2 = projectInteroperabilityExerciseState(result.states["state-2.json"]);
  const state3 = projectInteroperabilityExerciseState(result.states["state-3.json"]);
  assert.deepEqual(state1.visible, { semantics: true, profiles: false, interface: false });
  assert.equal(result.artifacts.semantics.input.data.meaning, "Clinical questionnaire responses");
  assert.deepEqual(state2.visible, { semantics: true, profiles: true, interface: false });
  assert.deepEqual(result.artifacts.profiles.input.data.required, ["questions"]);
  assert.equal(state2.contractExecutionAvailable, false);
  assert.deepEqual(state3.visible, { semantics: true, profiles: true, interface: true });
  assert.equal(result.artifacts.interface.data.invocation.signature, "run(input)");
  assert.equal(result.artifacts.interface.data.inputBinding, "CompletedQuestionnaireResponseProfile");
  assert.equal(state3.contractExecutionAvailable, true);
});

test("raw execution remains available in every supplied teaching state", () => {
  const { result } = load();
  assert.equal(result.status, "valid");
  for (const state of Object.values(result.states)) assert.equal(projectInteroperabilityExerciseState(state).rawExecutionAvailable, true);
});

test("contract execution requires and uses an externally supplied binding", () => {
  const { result } = load();
  assert.equal(result.status, "valid");
  const host = createInteroperabilitySimulationHost();
  const request = { target: result.target, mode: "contract", input: result.execution.contractInput.data, expectedOutput: result.execution.contractOutput.data, manifest: result.execution.contractManifest.data };
  assert.equal(host.simulate(request).status, "binding-unavailable");
  let calls = 0;
  host.registerBinding(result.target, ({ expectedOutput }) => { calls += 1; return expectedOutput; });
  const completed = host.simulate(request);
  assert.equal(calls, 1);
  assert.equal(completed.status, "completed");
  assert.equal(completed.binding, "host-supplied-simulation");
  assert.equal(completed.implementationInvoked, false);
});

test("missing and malformed artifacts fail safely without changing supplied content", () => {
  const missing = exerciseFiles();
  delete missing.content[`${root}profiles/output.json`];
  missing.files = Object.keys(missing.content);
  const missingResult = loadInteroperabilityExerciseKit(missing);
  assert.equal(missingResult.status, "invalid");
  assert.match(missingResult.diagnostics[0], /Output profile is missing/);

  const malformed = exerciseFiles({ [`${root}interface/interface.json`]: "{" });
  const before = new Map(Object.entries(malformed.content));
  const malformedResult = loadInteroperabilityExerciseKit(malformed);
  assert.equal(malformedResult.status, "invalid");
  assert.match(malformedResult.diagnostics[0], /Interface description is not valid JSON/);
  assert.deepEqual(new Map(Object.entries(malformed.content)), before, "validation must not mutate KO or published metadata content");
});

test("published metadata remains ordinary KO content and reusable modules contain no clinical assumptions", async () => {
  const published = "@prefix schema: <https://schema.org/> .\n<https://example.org/wagner/1.0> schema:identifier \"wagner\" .";
  const before = published;
  load();
  assert.equal(published, before);
  const reusable = `${await readFile(new URL("../app/interoperability-exercise.js", import.meta.url), "utf8")}\n${await readFile(new URL("../app/interoperability-simulation.js", import.meta.url), "utf8")}`;
  assert.doesNotMatch(reusable, /Wagner|questionnaire|clinical|grade|classification/i);
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Published KO metadata remains available/);
  assert.match(page, /exerciseDiscovery\.status === "invalid"/);
  const projection = page.slice(page.indexOf("function SimulationCaseProjection"), page.indexOf("function InterfaceSpecificationProjection"));
  assert.doesNotMatch(projection, /Wagner|questionnaire|clinical/i, "The error projection must not contain KO-specific teaching logic.");
});
