const FACETS = ["semantics", "profiles", "interface"];

const isFacetState = (value) => value === "complete" || value === "missing";

function parseFacetState(value, label) {
  if (!value || typeof value !== "object") throw new Error(`${label} must be an object.`);
  const state = {};
  for (const facet of FACETS) {
    if (!isFacetState(value[facet])) throw new Error(`${label}.${facet} must be "complete" or "missing".`);
    state[facet] = value[facet];
  }
  return state;
}

/** Independent educational projection. It never infers one facet from another. */
export function projectInteroperabilityExerciseState(value) {
  const state = parseFacetState(value, "exercise state");
  const visible = Object.freeze(Object.fromEntries(FACETS.map((facet) => [facet, state[facet] === "complete"])));
  const firstMissing = FACETS.findIndex((facet) => !visible[facet]);
  return Object.freeze({
    state: Object.freeze(state),
    visible,
    complete: FACETS.every((facet) => visible[facet]),
    primaryStage: firstMissing === -1 ? 3 : firstMissing,
    nextPrimaryFacet: firstMissing === -1 ? null : FACETS[firstMissing],
    rawExecutionAvailable: true,
    contractExecutionAvailable: visible.interface,
  });
}

function normalizeReference(reference) {
  if (typeof reference !== "string" || !reference.trim()) throw new Error("Artifact reference must be a non-empty string.");
  const value = reference.trim();
  if (value.startsWith("/") || value.includes("\\") || /^[a-z][a-z0-9+.-]*:/i.test(value)) throw new Error(`Artifact reference must be relative to the exercise root: ${value}`);
  const parts = value.split("/").filter((part) => part && part !== ".");
  if (parts.some((part) => part === "..")) throw new Error(`Artifact reference escapes the exercise root: ${value}`);
  return parts.join("/");
}

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
function requireRecord(value, label) {
  if (!isRecord(value)) throw new Error(`${label} must be a JSON object.`);
  return value;
}
function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value;
}
function requireBoolean(value, expected, label) {
  if (value !== expected) throw new Error(`${label} must be ${expected}.`);
  return value;
}
function requireStringArray(value, label) {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${label} must be a non-empty array of strings.`);
  return [...value];
}
function parseSemanticElements(value, label) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const names = new Set();
  return Object.freeze(value.map((candidate, index) => {
    const elementLabel = `${label}[${index}]`, element = requireRecord(candidate, elementLabel);
    const name = requireString(element.name, `${elementLabel}.name`);
    if (names.has(name)) throw new Error(`${label} contains duplicate element name "${name}".`);
    names.add(name);
    const members = element.members === undefined ? [] : element.members;
    if (!Array.isArray(members)) throw new Error(`${elementLabel}.members must be an array.`);
    const parsedMembers = members.map((candidateMember, memberIndex) => {
      const memberLabel = `${elementLabel}.members[${memberIndex}]`, member = requireRecord(candidateMember, memberLabel);
      if (!Number.isInteger(member.position) || member.position < 1) throw new Error(`${memberLabel}.position must be a positive integer.`);
      return Object.freeze({ position: member.position, id: requireString(member.id, `${memberLabel}.id`), text: requireString(member.text, `${memberLabel}.text`), meaning: requireString(member.meaning, `${memberLabel}.meaning`) });
    });
    const values = element.values === undefined ? [] : element.values;
    if (!Array.isArray(values)) throw new Error(`${elementLabel}.values must be an array.`);
    const parsedValues = values.map((candidateValue, valueIndex) => {
      const valueLabel = `${elementLabel}.values[${valueIndex}]`, semanticValue = requireRecord(candidateValue, valueLabel);
      if (typeof semanticValue.value !== "string" && typeof semanticValue.value !== "number") throw new Error(`${valueLabel}.value must be a string or number.`);
      return Object.freeze({ ...semanticValue, meaning: requireString(semanticValue.meaning, `${valueLabel}.meaning`) });
    });
    return Object.freeze({ ...element, name, meaning: requireString(element.meaning, `${elementLabel}.meaning`), members: Object.freeze(parsedMembers), values: Object.freeze(parsedValues) });
  }));
}
function parseSemanticArtifact(value, role, label) {
  const artifact = requireRecord(value, label);
  if (artifact.artifactType !== "semantic-boundary-view") throw new Error(`${label}.artifactType must be "semantic-boundary-view".`);
  if (artifact.role !== role) throw new Error(`${label}.role must be "${role}".`);
  return Object.freeze({ artifactType: artifact.artifactType, role, concept: requireString(artifact.concept, `${label}.concept`), identifier: requireString(artifact.identifier, `${label}.identifier`), meaning: requireString(artifact.meaning, `${label}.meaning`), elements: parseSemanticElements(artifact.elements, `${label}.elements`) });
}
function parseObjectProfile(value, label) {
  const artifact = requireRecord(value, label);
  if (artifact.artifactType !== "object-profile") throw new Error(`${label}.artifactType must be "object-profile".`);
  if (artifact.type !== "object") throw new Error(`${label}.type must be "object".`);
  const properties = requireRecord(artifact.properties, `${label}.properties`);
  const required = requireStringArray(artifact.required, `${label}.required`);
  for (const property of required) if (!Object.hasOwn(properties, property)) throw new Error(`${label}.properties is missing required property definition "${property}".`);
  return Object.freeze({ artifactType: artifact.artifactType, profile: requireString(artifact.profile, `${label}.profile`), semanticType: requireString(artifact.semanticType, `${label}.semanticType`), type: "object", required, properties, example: requireRecord(artifact.example, `${label}.example`) });
}
function parseInterfaceArtifact(value, label) {
  const artifact = requireRecord(value, label), invocation = requireRecord(artifact.invocation, `${label}.invocation`);
  if (artifact.artifactType !== "interface-boundary-view") throw new Error(`${label}.artifactType must be "interface-boundary-view".`);
  requireString(artifact.targetKnowledgeObject, `${label}.targetKnowledgeObject`);
  requireString(invocation.language, `${label}.invocation.language`);
  requireString(invocation.member, `${label}.invocation.member`);
  requireString(invocation.signature, `${label}.invocation.signature`);
  requireString(invocation.usage, `${label}.invocation.usage`);
  requireString(artifact.inputBinding, `${label}.inputBinding`);
  requireString(artifact.outputBinding, `${label}.outputBinding`);
  if (artifact.interfaceSpecification !== undefined) requireRecord(artifact.interfaceSpecification, `${label}.interfaceSpecification`);
  if (artifact.bindings !== undefined) requireRecord(artifact.bindings, `${label}.bindings`);
  if (artifact.outcomes !== undefined) requireRecord(artifact.outcomes, `${label}.outcomes`);
  if (artifact.simulationCases !== undefined) {
    if (!Array.isArray(artifact.simulationCases)) throw new Error(`${label}.simulationCases must be an array.`);
    const outcomes = new Set((artifact.outcomes?.errors?.definitions ?? []).map((item) => item?.code).filter(Boolean));
    const failurePoints = new Set(["input-data-object", "input-binding", "operation", "output-binding", "output-data-object", "defined-outcomes"]);
    const ids = new Set(), caseOutcomes = new Set();
    artifact.simulationCases.forEach((entry, index) => {
      const caseLabel = `${label}.simulationCases[${index}]`, simulationCase = requireRecord(entry, caseLabel);
      const id = requireString(simulationCase.id, `${caseLabel}.id`), outcome = requireString(simulationCase.outcome, `${caseLabel}.outcome`), failurePoint = requireString(simulationCase.failurePoint, `${caseLabel}.failurePoint`);
      requireString(simulationCase.cause, `${caseLabel}.cause`);
      requireRecord(simulationCase.expected, `${caseLabel}.expected`);
      requireRecord(simulationCase.actual, `${caseLabel}.actual`);
      if (simulationCase.title !== undefined) requireString(simulationCase.title, `${caseLabel}.title`);
      if (simulationCase.explanation !== undefined) requireString(simulationCase.explanation, `${caseLabel}.explanation`);
      if (simulationCase.remediation !== undefined) requireString(simulationCase.remediation, `${caseLabel}.remediation`);
      if (simulationCase.passedSteps !== undefined) {
        if (!Array.isArray(simulationCase.passedSteps) || simulationCase.passedSteps.some((step) => typeof step !== "string" || !step.trim())) throw new Error(`${caseLabel}.passedSteps must be an array of interface-step strings.`);
        const passedSteps = [...simulationCase.passedSteps];
        for (const step of passedSteps) if (!failurePoints.has(step)) throw new Error(`${caseLabel}.passedSteps contains an unrecognized interface step.`);
      }
      for (const excerpt of ["inputExcerpt", "bindingExcerpt", "operationExcerpt"]) if (simulationCase[excerpt] !== undefined) requireRecord(simulationCase[excerpt], `${caseLabel}.${excerpt}`);
      if (ids.has(id)) throw new Error(`${label}.simulationCases contains duplicate id "${id}".`);
      if (caseOutcomes.has(outcome)) throw new Error(`${label}.simulationCases contains duplicate outcome "${outcome}".`);
      if (!failurePoints.has(failurePoint)) throw new Error(`${caseLabel}.failurePoint is not a recognized interface step.`);
      if (!outcomes.has(outcome)) throw new Error(`${caseLabel}.outcome does not match a declared error outcome.`);
      ids.add(id); caseOutcomes.add(outcome);
    });
  }
  return Object.freeze({ ...artifact, invocation: Object.freeze({ ...invocation }) });
}
function parseRawManifest(value, label) {
  const manifest = requireRecord(value, label);
  if (manifest.executionMode !== "raw") throw new Error(`${label}.executionMode must be "raw".`);
  requireBoolean(manifest.publishedBoundary, false, `${label}.publishedBoundary`);
  return Object.freeze({ executionMode: "raw", publishedBoundary: false, entryPoint: requireString(manifest.entryPoint, `${label}.entryPoint`), executorBinding: requireString(manifest.executorBinding, `${label}.executorBinding`), inputExample: requireString(manifest.inputExample, `${label}.inputExample`), expectedOutput: requireString(manifest.expectedOutput, `${label}.expectedOutput`) });
}
function parseContractManifest(value, label) {
  const manifest = requireRecord(value, label), targetBinding = requireRecord(manifest.targetBinding, `${label}.targetBinding`), input = requireRecord(manifest.input, `${label}.input`), output = requireRecord(manifest.output, `${label}.output`);
  if (manifest.executionMode !== "contract") throw new Error(`${label}.executionMode must be "contract".`);
  requireBoolean(manifest.publishedBoundary, true, `${label}.publishedBoundary`);
  if (targetBinding.type !== "externalKnowledgeObject") throw new Error(`${label}.targetBinding.type must be "externalKnowledgeObject".`);
  const parsePort = (port, portLabel) => Object.freeze({ profile: requireString(port.profile, `${portLabel}.profile`), profileArtifact: requireString(port.profileArtifact, `${portLabel}.profileArtifact`), example: requireString(port.example, `${portLabel}.example`) });
  return Object.freeze({ executionMode: "contract", publishedBoundary: true, declaredInvocation: requireString(manifest.declaredInvocation, `${label}.declaredInvocation`), entryPoint: requireString(manifest.entryPoint, `${label}.entryPoint`), targetBinding: Object.freeze({ type: "externalKnowledgeObject", identifier: requireString(targetBinding.identifier, `${label}.targetBinding.identifier`), version: requireString(targetBinding.version, `${label}.targetBinding.version`), specification: requireString(targetBinding.specification, `${label}.targetBinding.specification`) }), input: parsePort(input, `${label}.input`), output: parsePort(output, `${label}.output`) });
}

/**
 * Pure loader for an independent Interoperability View exercise kit.
 * It receives an isolated file list and reader; it has no UI, storage, KO
 * implementation, or published-metadata dependencies.
 */
export function loadInteroperabilityExerciseKit({ files, readText, target }) {
  const normalizedFiles = [...new Set(files)].sort();
  const configFiles = normalizedFiles.filter((file) => file === "interoperability.exercise.json" || file.endsWith("/interoperability.exercise.json"));
  if (!configFiles.length) return { status: "absent" };
  if (configFiles.length !== 1) return { status: "invalid", diagnostics: ["Multiple interoperability exercise configurations were found."] };

  const configPath = configFiles[0];
  const root = configPath.includes("/") ? configPath.slice(0, configPath.lastIndexOf("/") + 1) : "";
  const rootFiles = new Set(normalizedFiles.filter((file) => file.startsWith(root)));
  const parseJson = (path, label) => {
    if (!rootFiles.has(path)) throw new Error(`${label} is missing: ${path.slice(root.length)}`);
    try { return JSON.parse(String(readText(path))); }
    catch { throw new Error(`${label} is not valid JSON: ${path.slice(root.length)}`); }
  };
  const resolve = (reference, label) => {
    const relative = normalizeReference(reference);
    const path = `${root}${relative}`;
    if (!rootFiles.has(path)) throw new Error(`${label} is missing: ${relative}`);
    return path;
  };
  const resolveJson = (reference, label) => {
    const path = resolve(reference, label);
    return { path, data: parseJson(path, label) };
  };

  try {
    const config = parseJson(configPath, "Exercise configuration");
    if (config.exerciseType !== "interoperability") throw new Error('exerciseType must be "interoperability".');
    if (!config.targetKnowledgeObject || typeof config.targetKnowledgeObject !== "object") throw new Error("targetKnowledgeObject must identify the exercise target.");
    const exerciseTarget = config.targetKnowledgeObject;
    if (typeof config.knowledgeObject !== "string" || !config.knowledgeObject.trim()) throw new Error("knowledgeObject must identify the exercise target.");
    if (config.knowledgeObject !== exerciseTarget.identifier) throw new Error("knowledgeObject does not match targetKnowledgeObject.identifier.");
    if (!target || typeof target.identifier !== "string" || !target.identifier.trim()) throw new Error("The selected knowledge object's identifier is unavailable; the exercise target cannot be validated.");
    if (exerciseTarget.identifier !== target.identifier) throw new Error("Exercise target identifier does not match the selected knowledge object.");
    if (target.version && exerciseTarget.version !== target.version) throw new Error("Exercise target version does not match the selected knowledge object.");
    if (target.specification && exerciseTarget.specification !== target.specification) throw new Error("Exercise target specification does not match the selected knowledge object.");
    const state = parseFacetState(config.simulationState, "simulationState");
    const rawManifestArtifact = resolveJson("execution/raw-execution.json", "Raw execution manifest");
    const contractManifestArtifact = resolveJson("execution/contract-execution.json", "Contract execution manifest");
    const rawManifest = parseRawManifest(rawManifestArtifact.data, "Raw execution manifest");
    const contractManifest = parseContractManifest(contractManifestArtifact.data, "Contract execution manifest");

    const rawInput = resolveJson(rawManifest.inputExample, "Raw input example");
    const rawOutput = resolveJson(rawManifest.expectedOutput, "Raw expected output");
    const contractInputReference = contractManifest.inputExample ?? contractManifest.input?.example;
    const contractOutputReference = contractManifest.expectedOutput ?? contractManifest.output?.example;
    const contractInput = resolveJson(contractInputReference, "Contract input example");
    const contractOutput = resolveJson(contractOutputReference, "Contract output example");
    const inputProfileReference = contractManifest.input?.profileArtifact;
    const outputProfileReference = contractManifest.output?.profileArtifact;

    const inputSemanticsArtifact = resolveJson("semantics/input-semantics.json", "Input semantics");
    const outputSemanticsArtifact = resolveJson("semantics/output-semantics.json", "Output semantics");
    const inputProfileArtifact = resolveJson(inputProfileReference, "Input profile");
    const outputProfileArtifact = resolveJson(outputProfileReference, "Output profile");
    const interfaceArtifact = resolveJson("interface/interface.json", "Interface description");
    const artifacts = Object.freeze({
      semantics: Object.freeze({ input: Object.freeze({ path: inputSemanticsArtifact.path, data: parseSemanticArtifact(inputSemanticsArtifact.data, "input", "Input semantics") }), output: Object.freeze({ path: outputSemanticsArtifact.path, data: parseSemanticArtifact(outputSemanticsArtifact.data, "output", "Output semantics") }) }),
      profiles: Object.freeze({ input: Object.freeze({ path: inputProfileArtifact.path, data: parseObjectProfile(inputProfileArtifact.data, "Input profile") }), output: Object.freeze({ path: outputProfileArtifact.path, data: parseObjectProfile(outputProfileArtifact.data, "Output profile") }) }),
      interface: Object.freeze({ path: interfaceArtifact.path, data: parseInterfaceArtifact(interfaceArtifact.data, "Interface description") }),
    });
    if (contractManifest.targetBinding.identifier !== exerciseTarget.identifier || contractManifest.targetBinding.version !== exerciseTarget.version || contractManifest.targetBinding.specification !== exerciseTarget.specification) throw new Error("Contract execution target does not match the exercise target.");
    if (artifacts.interface.data.targetKnowledgeObject !== exerciseTarget.identifier) throw new Error("Interface description target does not match the exercise target.");
    if (contractManifest.input.profile !== artifacts.profiles.input.data.profile || artifacts.interface.data.inputBinding !== artifacts.profiles.input.data.profile) throw new Error("Input profile bindings are inconsistent.");
    if (contractManifest.output.profile !== artifacts.profiles.output.data.profile || artifacts.interface.data.outputBinding !== artifacts.profiles.output.data.profile) throw new Error("Output profile bindings are inconsistent.");
    for (const role of ["input", "output"]) for (const element of artifacts.semantics[role].data.elements) if (!Object.hasOwn(artifacts.profiles[role].data.properties, element.name)) throw new Error(`${role === "input" ? "Input" : "Output"} semantic element "${element.name}" is not declared by its object profile.`);
    const inputQuestions = artifacts.semantics.input.data.elements.find((element) => element.name === "question_ids")?.members ?? [];
    const outputQuestions = artifacts.semantics.output.data.elements.find((element) => element.name === "question_ids")?.members ?? [];
    if (inputQuestions.length && outputQuestions.length && JSON.stringify(inputQuestions.map(({ position, id, text }) => ({ position, id, text }))) !== JSON.stringify(outputQuestions.map(({ position, id, text }) => ({ position, id, text })))) throw new Error("Input and output question semantics are inconsistent.");

    const states = {};
    for (const path of [...rootFiles].filter((file) => file.startsWith(`${root}states/`) && file.endsWith(".json")).sort()) {
      states[path.slice(`${root}states/`.length)] = parseFacetState(parseJson(path, "Exercise state preset"), `state preset ${path.slice(root.length)}`);
    }
    if (!Object.keys(states).length) throw new Error("At least one exercise state preset is required.");

    return {
      status: "valid",
      root,
      configPath,
      config,
      target: { identifier: target.identifier, version: target.version ?? null, specification: target.specification ?? null },
      state,
      states,
      artifacts,
      execution: {
        rawManifest: Object.freeze({ path: rawManifestArtifact.path, data: rawManifest }),
        contractManifest: Object.freeze({ path: contractManifestArtifact.path, data: contractManifest }),
        rawInput: Object.freeze({ path: rawInput.path, data: requireRecord(rawInput.data, "Raw input example") }),
        rawOutput: Object.freeze({ path: rawOutput.path, data: requireRecord(rawOutput.data, "Raw expected output") }),
        contractInput: Object.freeze({ path: contractInput.path, data: requireRecord(contractInput.data, "Contract input example") }),
        contractOutput: Object.freeze({ path: contractOutput.path, data: requireRecord(contractOutput.data, "Contract output example") }),
      },
    };
  } catch (error) {
    return { status: "invalid", configPath, root, diagnostics: [error instanceof Error ? error.message : "Invalid interoperability exercise kit."] };
  }
}

export const INTEROPERABILITY_EXERCISE_FACETS = Object.freeze([...FACETS]);
