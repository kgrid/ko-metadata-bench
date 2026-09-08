import assert from "node:assert/strict";
import test from "node:test";
import { assertControlledMetadataEquivalence, validateControlledMetadataEquivalence } from "../app/metadata-semantic-equivalence.js";

const findability = `@prefix schema: <https://schema.org/> .
<https://example.org/ko>
  schema:identifier "fixed" ;
  schema:name "Canonical name" ;
  schema:abstract "Canonical description" ;
  schema:additionalProperty [ schema:name "Programming language" ; schema:value "JavaScript" ] .
`;

const reusability = `@prefix schema: <https://schema.org/> .
<https://example.org/ko>
  schema:description "Fixed purpose" ;
  schema:usageInfo <https://example.org/ko#scope> ;
  schema:license <https://spdx.org/licenses/MIT.html> ;
  schema:citation <https://doi.org/10.1000/example> .
<https://example.org/ko#scope> schema:description "Canonical scope" .
`;

test("semantic equivalence permits only controlled Findability changes", () => {
  const allowed = findability.replace('schema:name "Canonical name"', 'schema:name "Learner-confirmed name"').replace('schema:abstract "Canonical description"', 'schema:abstract "Learner description"');
  assert.equal(validateControlledMetadataEquivalence("findability", findability, allowed).equivalent, true);
  const protectedChange = allowed.replace('schema:value "JavaScript"', 'schema:value "Python"');
  const result = validateControlledMetadataEquivalence("findability", findability, protectedChange);
  assert.equal(result.equivalent, false);
  assert.ok(result.missing.length && result.added.length);
  assert.throws(() => assertControlledMetadataEquivalence("findability", findability, protectedChange), /protected RDF semantics/);
});

test("semantic equivalence permits only controlled Reusability changes", () => {
  const allowed = reusability.replace("Canonical scope", "Learner scope").replace("https://spdx.org/licenses/MIT.html", "https://spdx.org/licenses/Apache-2.0.html");
  assert.equal(validateControlledMetadataEquivalence("reusability", reusability, allowed).equivalent, true);
  const protectedChange = allowed.replace("Fixed purpose", "Changed purpose");
  assert.equal(validateControlledMetadataEquivalence("reusability", reusability, protectedChange).equivalent, false);
});

test("semantic equivalence rejects a changed primary resource or invalid Turtle", () => {
  assert.equal(validateControlledMetadataEquivalence("findability", findability, findability.replaceAll("https://example.org/ko", "https://example.org/other")).primaryMatches, false);
  assert.throws(() => validateControlledMetadataEquivalence("findability", findability, "not Turtle"), /not valid Turtle/);
});
