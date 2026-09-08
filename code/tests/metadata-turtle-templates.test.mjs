import assert from "node:assert/strict";
import test from "node:test";
import { establishKo4CanonicalTurtleTemplates } from "../app/metadata-turtle-templates.js";

const findability = '@prefix schema: <https://schema.org/> .\n@prefix prov: <http://www.w3.org/ns/prov#> .\n\n<https://example.org/ko-4>\n    # authored spacing\n    schema:name "Example" .\n';
const reusability = '@prefix schema: <https://schema.org/> .\n@prefix prov: <http://www.w3.org/ns/prov#> .\n\n<https://example.org/ko-4>\n    # 1. Purpose\n    schema:description "Example" .\n';

test("KO 4 canonical Turtle templates preserve authored source exactly", () => {
  const templates = establishKo4CanonicalTurtleTemplates({ findability, reusability });
  assert.equal(templates.findability.source, findability);
  assert.equal(templates.reusability.source, reusability);
  assert.equal(templates.findability.primarySubject, "https://example.org/ko-4");
  assert.equal(templates.reusability.fileName, "reusability.metadata.txt");
  assert.equal(Object.isFrozen(templates), true);
  assert.equal(Object.isFrozen(templates.findability), true);
  assert.deepEqual(templates.findability.prefixes.map(({ prefix }) => prefix), ["schema", "prov"]);
});

test("canonical Turtle templates reject incomplete template resources", () => {
  assert.throws(() => establishKo4CanonicalTurtleTemplates({ findability: "", reusability }), /canonical Turtle source is required/);
  assert.throws(() => establishKo4CanonicalTurtleTemplates({ findability: "<https://example.org/ko-4> schema:name \"Example\" .", reusability }), /schema prefix/);
});

test("canonical templates expose only the eight controlled insertion points", () => {
  const templates = establishKo4CanonicalTurtleTemplates({ findability, reusability });
  assert.deepEqual(templates.findability.insertionPoints.map(({ id }) => id), ["fullName", "description", "controlledSubjects", "searchTerms", "outputVocabulary"]);
  assert.deepEqual(templates.reusability.insertionPoints.map(({ id }) => id), ["scope", "license", "evidence"]);
  assert.equal(new Set([...templates.findability.insertionPoints, ...templates.reusability.insertionPoints].map(({ id }) => id)).size, 8);
  assert.equal(templates.findability.insertionPoints.every(({ learnerControlled }) => learnerControlled), true);
});

test("controlled insertion-point contracts are immutable and semantically located", () => {
  const templates = establishKo4CanonicalTurtleTemplates({ findability, reusability });
  const outputVocabulary = templates.findability.insertionPoints.find(({ id }) => id === "outputVocabulary");
  const evidence = templates.reusability.insertionPoints.find(({ id }) => id === "evidence");
  assert.equal(Object.isFrozen(templates.findability.insertionPoints), true);
  assert.equal(Object.isFrozen(outputVocabulary.sourceLocator), true);
  assert.equal(outputVocabulary.sourceLocator.qualifier.value, "Output classification");
  assert.deepEqual(outputVocabulary.cardinality, { min: 4, max: 4 });
  assert.equal(evidence.sourceLocator.predicate, "https://schema.org/citation");
  assert.deepEqual(evidence.cardinality, { min: 2, max: 2 });
});
