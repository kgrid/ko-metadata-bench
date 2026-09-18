import assert from "node:assert/strict";
import test from "node:test";
import { loadInteroperabilityExerciseKit } from "../app/interoperability-exercise.js";
import { resolveObjectIdByIdentifier } from "../app/knowledge-object-target.js";
import { discoverResourceMap } from "../app/resource-discovery.js";
import { discoverRunnerAvailability } from "../app/runner-discovery.js";
import { inspectWorkshopOrder } from "../app/workshop-ordering.js";

const TARGET = Object.freeze({ identifier: "meggitt-wagner-cks", version: "1.0", specification: "https://kgrid.org/cks/meggitt-wagner/versions/cks-1.0" });
const json = (value) => JSON.stringify(value);
const metadataJson = json({ "dc:identifier": ["workshop-ko-1", TARGET.identifier], "dc:version": TARGET.version });
const findability = '@prefix schema: <https://schema.org/> .\n<urn:wagner> schema:identifier "workshop-ko-1" .';

function exerciseFiles(root) {
  const path = (relative) => `${root}${relative}`;
  return {
    [path("interoperability.exercise.json")]: json({ exerciseType: "interoperability", knowledgeObject: TARGET.identifier, targetKnowledgeObject: TARGET, simulationState: { semantics: "complete", profiles: "complete", interface: "complete" } }),
    [path("execution/raw-execution.json")]: json({ executionMode: "raw", publishedBoundary: false, entryPoint: "run", executorBinding: "host", inputExample: "examples/raw-input.json", expectedOutput: "examples/raw-output.json" }),
    [path("execution/contract-execution.json")]: json({ executionMode: "contract", publishedBoundary: true, declaredInvocation: "run(input)", entryPoint: "run", targetBinding: { type: "externalKnowledgeObject", ...TARGET }, input: { profile: "InputProfile", profileArtifact: "profiles/InputProfile.json", example: "examples/valid-input.json" }, output: { profile: "OutputProfile", profileArtifact: "profiles/OutputProfile.json", example: "examples/expected-output.json" } }),
    [path("examples/raw-input.json")]: json({ value: "opaque input" }),
    [path("examples/raw-output.json")]: json({ value: "opaque output" }),
    [path("examples/valid-input.json")]: json({ value: "declared input" }),
    [path("examples/expected-output.json")]: json({ value: "declared output" }),
    [path("semantics/input-semantics.json")]: json({ artifactType: "semantic-boundary-view", role: "input", concept: "Input", identifier: "urn:input", meaning: "Declared input meaning.", elements: [] }),
    [path("semantics/output-semantics.json")]: json({ artifactType: "semantic-boundary-view", role: "output", concept: "Output", identifier: "urn:output", meaning: "Declared output meaning.", elements: [] }),
    [path("profiles/InputProfile.json")]: json({ artifactType: "object-profile", profile: "InputProfile", semanticType: "urn:input", type: "object", required: ["value"], properties: { value: { type: "string" } }, example: { value: "declared input" } }),
    [path("profiles/OutputProfile.json")]: json({ artifactType: "object-profile", profile: "OutputProfile", semanticType: "urn:output", type: "object", required: ["value"], properties: { value: { type: "string" } }, example: { value: "declared output" } }),
    [path("interface/interface.json")]: json({ artifactType: "interface-boundary-view", targetKnowledgeObject: TARGET.identifier, invocation: { language: "JavaScript", member: "run", signature: "run(input)", usage: "await run(input)" }, inputBinding: "InputProfile", outputBinding: "OutputProfile" }),
    [path("states/complete.json")]: json({ semantics: "complete", profiles: "complete", interface: "complete" }),
  };
}

function existenceMetadata(paths) {
  const declarations = [["existence", paths.existence], ["core", paths.core], ["accessibility", paths.accessibility], ["findability", paths.findability], ["interoperability", paths.interoperability], ["reusability", paths.reusability]];
  return `@prefix koer: <https://example.org/koer/> .\n@prefix dcterms: <http://purl.org/dc/terms/> .\n\n${declarations.map(([type, filePath], index) => `<#component-${index}>\n  koer:filePath "${filePath}" ;\n  dcterms:type "${type}" .`).join("\n\n")}`;
}

function fixture(layout) {
  const nested = layout === "nested";
  const metadataRoot = nested ? "auxiliary/aux-extra-metadata/" : "";
  const documentationRoot = nested ? "auxiliary/aux-documentation/" : "";
  const runnerRoot = nested ? "auxiliary/aux-runner/" : "runner/";
  const exerciseRoot = nested ? "auxiliary/aux-interoperability-exercise/" : "wagner-interoperability-exercise/";
  const paths = { existence: `${metadataRoot}existence.metadata.txt`, core: "metadata.json", accessibility: `${metadataRoot}access.metadata.txt`, findability: `${metadataRoot}findability.metadata.txt`, interoperability: `${metadataRoot}interoperability.metadata.txt`, reusability: `${metadataRoot}reusability.metadata.txt` };
  const sources = {
    [paths.core]: metadataJson, [paths.accessibility]: "accessibility", [paths.findability]: findability, [paths.interoperability]: "interoperability", [paths.reusability]: "reusability",
    [`${documentationRoot}graphic.abstract.webp`]: "abstract-binary-placeholder", [`${documentationRoot}graphic.logic.webp`]: "logic-binary-placeholder",
    [`${runnerRoot}runner.manifest.json`]: json({ runnerVersion: "1.0", knowledgeObjectId: "workshop-ko-1", knowledgeObjectVersion: "1.0", bundle: `${runnerRoot}runner.bundle.js` }),
    [`${runnerRoot}runner.bundle.js`]: "/* inert fixture; never executed */", ...exerciseFiles(exerciseRoot),
  };
  if (nested) sources[paths.existence] = existenceMetadata(paths);
  return Object.freeze({ layout, paths, sources: Object.freeze(sources), files: Object.keys(sources), readText: (file) => sources[file] });
}

for (const layout of ["root-oriented", "nested"]) {
  test(`${layout} KO exposes the same logical SWA resources`, () => {
    const ko = fixture(layout);
    const resources = discoverResourceMap({ files: ko.files, readText: ko.readText });
    for (const logicalName of ["metadata.json", "access.metadata.txt", "findability.metadata.txt", "interoperability.metadata.txt", "reusability.metadata.txt", "graphic.abstract.webp", "graphic.logic.webp", "runner/runner.manifest.json"]) assert.ok(resources.resolve(logicalName), `${layout} ${logicalName} should resolve`);
    assert.equal(ko.readText(resources.resolve("findability.metadata.txt")), findability);
    assert.deepEqual(inspectWorkshopOrder({ folderName: layout, files: ko.files, readText: ko.readText }), { folderName: layout, valid: true, number: 1, findabilityPath: ko.paths.findability, diagnostic: null });
    const runner = discoverRunnerAvailability({ files: ko.files, readText: ko.readText });
    assert.equal(runner.available, true);
    assert.equal(runner.bundleSource, "/* inert fixture; never executed */");
    const exercise = loadInteroperabilityExerciseKit({ files: ko.files, readText: ko.readText, target: TARGET });
    assert.equal(exercise.status, "valid", exercise.diagnostics?.join(" "));
    assert.equal(exercise.target.identifier, TARGET.identifier);
  });
}

test("identifier targeting remains stable when a nested KO moves to another embedded slot", () => {
  const oldKo = fixture("root-oriented"), nestedKo = fixture("nested");
  const metadataBySlot = new Map([[7, json({ "dc:identifier": "workshop-ko-7" })], [2, nestedKo.readText("metadata.json")]]);
  assert.equal(resolveObjectIdByIdentifier([7, 2], (id) => metadataBySlot.get(id), "workshop-ko-1"), 2);
  assert.equal(oldKo.readText("metadata.json"), nestedKo.readText("metadata.json"));
});
