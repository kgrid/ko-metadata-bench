import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Parser } from "n3";
import { confirmFindabilityFullName, constructFindabilityMetadata, createFindabilityEnrichmentBaseline, evaluateFindabilityEnrichment, FINDABILITY_ENRICHMENT_TARGET, getCanonicalFindabilityName, getFindabilityEnrichmentInput, getFindabilityOutputTermOptions, getFindabilitySubjectOptions, getFindabilityUnlockState, setFindabilityControlledSubjects, setFindabilityDescription, setFindabilityOutputTerms, setFindabilitySearchTerms } from "../app/findability-enrichment.js";

async function canonicalTargetSource() {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const key = `  "${FINDABILITY_ENRICHMENT_TARGET}/findability.metadata.txt": `;
  const start = source.indexOf(key);
  assert.notEqual(start, -1, "canonical target metadata is embedded");
  const valueStart = start + key.length;
  return JSON.parse(source.slice(valueStart, source.indexOf(",\n", valueStart)));
}

test("KO 4 begins with valid incomplete Findability working metadata", async () => {
  const canonical = await canonicalTargetSource();
  const baseline = createFindabilityEnrichmentBaseline(canonical);
  assert.doesNotThrow(() => new Parser({ format: "text/turtle" }).parse(baseline));
  const state = evaluateFindabilityEnrichment(baseline);
  assert.deepEqual({ fullName: state.fullName, description: state.description, controlledSubject: state.controlledSubject, searchTerms: state.searchTerms, outputVocabulary: state.outputVocabulary, complete: state.complete }, { fullName: false, description: false, controlledSubject: false, searchTerms: false, outputVocabulary: false, complete: false });
  assert.match(baseline, /schema:identifier\s+"workshop-ko-4"/);
  assert.match(baseline, /schema:version\s+"1\.0"/);
  assert.doesNotMatch(baseline, /schema:name\s+"Two-Factor Prognostic Model for Diabetic Foot Ulcer Healing by 16 Weeks"/);
  assert.match(baseline, /Computational method/);
  assert.doesNotMatch(baseline, /schema:abstract|schema:about|schema:keywords|Output classification|ALG-0[1-4]|prognostic-groups/);
});

test("complete canonical KO 4 metadata satisfies all Findability unlock requirements", async () => {
  const state = evaluateFindabilityEnrichment(await canonicalTargetSource());
  assert.deepEqual({ valid: state.valid, fullName: state.fullName, description: state.description, controlledSubject: state.controlledSubject, searchTerms: state.searchTerms, outputVocabulary: state.outputVocabulary, complete: state.complete }, { valid: true, fullName: true, description: true, controlledSubject: true, searchTerms: true, outputVocabulary: true, complete: true });
});

test("KO 4 full name is canonical and can only be confirmed, not renamed", async () => {
  const canonical = await canonicalTargetSource();
  const baseline = createFindabilityEnrichmentBaseline(canonical);
  assert.equal(getCanonicalFindabilityName(canonical), "Two-Factor Prognostic Model for Diabetic Foot Ulcer Healing by 16 Weeks");
  const confirmed = confirmFindabilityFullName(baseline, canonical);
  assert.equal(evaluateFindabilityEnrichment(confirmed).fullName, true);
  assert.match(confirmed, /schema:name "Two-Factor Prognostic Model for Diabetic Foot Ulcer Healing by 16 Weeks"/);
});

test("Findability working baseline generation is deterministic", async () => {
  const canonical = await canonicalTargetSource();
  assert.equal(createFindabilityEnrichmentBaseline(canonical), createFindabilityEnrichmentBaseline(canonical));
});

test("guided Findability edits create a valid complete record without exposing RDF authoring", async () => {
  const canonical = await canonicalTargetSource();
  let working = createFindabilityEnrichmentBaseline(canonical);
  working = confirmFindabilityFullName(working, canonical);
  working = setFindabilityDescription(working, "A learner-supplied description of the prognostic knowledge object.");
  const subject = getFindabilitySubjectOptions(canonical)[0];
  assert.ok(subject?.iri, "canonical metadata supplies a controlled subject choice");
  working = setFindabilityControlledSubjects(working, canonical, [subject.iri]);
  working = setFindabilitySearchTerms(working, ["diabetic foot ulcer", "healing prognosis", "wound duration"]);
  const outputTerms = getFindabilityOutputTermOptions(canonical);
  assert.equal(outputTerms.length, 4, "canonical metadata supplies four output choices");
  working = setFindabilityOutputTerms(working, canonical, outputTerms.map((term) => term.iri));
  assert.doesNotThrow(() => new Parser({ format: "text/turtle" }).parse(working));
  assert.equal(evaluateFindabilityEnrichment(working).complete, true);
  assert.match(working, /learner-supplied description/);
  assert.match(working, /diabetic foot ulcer/);
});

test("all four declared output groupings are required", async () => {
  const canonical = await canonicalTargetSource();
  const options = getFindabilityOutputTermOptions(canonical);
  let working = createFindabilityEnrichmentBaseline(canonical);
  working = setFindabilityOutputTerms(working, canonical, options.slice(0, 3).map((term) => term.iri));
  assert.equal(evaluateFindabilityEnrichment(working).outputVocabulary, false);
  working = setFindabilityOutputTerms(working, canonical, options.map((term) => term.iri));
  assert.equal(evaluateFindabilityEnrichment(working).outputVocabulary, true);
});

test("incomplete Findability work preserves partial controlled selections", async () => {
  const canonical = await canonicalTargetSource();
  const subjects = getFindabilitySubjectOptions(canonical);
  const outputs = getFindabilityOutputTermOptions(canonical);
  const partial = constructFindabilityMetadata(canonical, {
    fullNameConfirmed: true,
    description: "A valid but deliberately incomplete learner description.",
    controlledSubjectIris: subjects.slice(0, 2).map(({ iri }) => iri),
    searchTerms: ["first term", "second term"],
    outputTermIris: outputs.slice(0, 2).map(({ iri }) => iri),
  });
  const recovered = getFindabilityEnrichmentInput(partial);
  assert.deepEqual(recovered.controlledSubjectIris, subjects.slice(0, 2).map(({ iri }) => iri));
  assert.deepEqual(recovered.outputTermIris, outputs.slice(0, 2).map(({ iri }) => iri));
  assert.deepEqual(recovered.searchTerms, ["first term", "second term"]);
  assert.equal(getFindabilityUnlockState(partial).unlocked, false);
  assert.doesNotThrow(() => new Parser({ format: "text/turtle" }).parse(partial));
});

test("Findability construction is deterministic, idempotent, and independent of selection order", async () => {
  const canonical = await canonicalTargetSource();
  const subjects = getFindabilitySubjectOptions(canonical).map((option) => option.iri);
  const outputs = getFindabilityOutputTermOptions(canonical).map((option) => option.iri);
  const input = { fullNameConfirmed: true, description: "A deterministic learner description.", controlledSubjectIris: subjects, searchTerms: ["wound duration", "healing prognosis", "diabetic foot ulcer"], outputTermIris: outputs };
  const first = constructFindabilityMetadata(canonical, input);
  const reordered = constructFindabilityMetadata(canonical, { ...input, controlledSubjectIris: [...subjects].reverse(), outputTermIris: [...outputs].reverse() });
  const rebuilt = constructFindabilityMetadata(canonical, getFindabilityEnrichmentInput(first));
  assert.equal(first, reordered);
  assert.equal(first, rebuilt);
  assert.equal(evaluateFindabilityEnrichment(first).complete, true);
});

test("Findability construction preserves the canonical document outside controlled insertion points", async () => {
  const canonical = await canonicalTargetSource();
  assert.equal(constructFindabilityMetadata(canonical, getFindabilityEnrichmentInput(canonical)), canonical);
  const constructed = constructFindabilityMetadata(canonical, {
    fullNameConfirmed: true,
    description: 'A learner description with "quotes" and a newline.\nThe metadata remain valid.',
    controlledSubjectIris: getFindabilitySubjectOptions(canonical).slice(0, 1).map(({ iri }) => iri),
    searchTerms: ["first term", "second term", "third term"],
    outputTermIris: getFindabilityOutputTermOptions(canonical).map(({ iri }) => iri),
  });
  assert.match(constructed, /# Identification, description, subject, type, technical characteristics, and indexing only\./);
  assert.match(constructed, /schema:name "Computational method"/);
  assert.equal(constructed.includes('\\"quotes\\" and a newline.\\nThe metadata remain valid'), true);
  assert.doesNotThrow(() => new Parser({ format: "text/turtle" }).parse(constructed));
});

test("Findability unlocks only after all five requirements are valid", async () => {
  const canonical = await canonicalTargetSource();
  const status = ({ completed, total, unlocked }) => ({ completed, total, unlocked });
  assert.deepEqual(status(getFindabilityUnlockState(createFindabilityEnrichmentBaseline(canonical))), { completed: 0, total: 5, unlocked: false });
  assert.deepEqual(status(getFindabilityUnlockState(canonical)), { completed: 5, total: 5, unlocked: true });
});
