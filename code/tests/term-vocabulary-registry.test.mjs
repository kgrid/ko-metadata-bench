import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  EMBEDDED_VOCABULARY_REGISTRY,
  EMBEDDED_VOCABULARY_TERMS,
  EMBEDDED_VOCABULARY_REGISTRY_VERSION,
  getEmbeddedVocabularyTerm,
  serializeEmbeddedVocabularyRegistry,
} from "../app/term-vocabulary-registry.js";

test("embedded vocabulary registry is deterministic, compact, and offline", () => {
  assert.equal(EMBEDDED_VOCABULARY_REGISTRY_VERSION, "1.0");
  assert.ok(Object.isFrozen(EMBEDDED_VOCABULARY_TERMS));
  assert.deepEqual(EMBEDDED_VOCABULARY_TERMS.map(({ iri }) => iri), [...EMBEDDED_VOCABULARY_TERMS.map(({ iri }) => iri)].sort((left, right) => left.localeCompare(right)));
  for (const term of EMBEDDED_VOCABULARY_TERMS) {
    assert.equal(EMBEDDED_VOCABULARY_REGISTRY[term.iri], term);
    assert.equal(getEmbeddedVocabularyTerm(term.iri), term);
    assert.ok(term.explanation.length >= 20 && term.explanation.length <= 180);
    assert.match(term.iri, /^https?:\/\//);
    assert.match(term.externalUrl, /^https?:\/\//);
    assert.ok(Object.isFrozen(term));
    assert.ok(Object.isFrozen(term.vocabulary));
  }
  assert.equal(getEmbeddedVocabularyTerm("https://example.invalid/term"), null);
  assert.doesNotMatch(fs.readFileSync(new URL("../app/term-vocabulary-registry.js", import.meta.url), "utf8"), /\bfetch\s*\(|XMLHttpRequest|WebSocket/);
});

test("registry covers the recurring vocabularies and KOIO terms used by the KOs", () => {
  const required = [
    "https://schema.org/termCode",
    "http://www.w3.org/ns/prov#Entity",
    "http://purl.org/dc/terms/conformsTo",
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
    "https://kgrid.org/koio#KnowledgeObject",
    "https://kgrid.org/koio#Knowledge",
    "https://kgrid.org/koio#Test",
    "https://kgrid.org/koio#hasKnowledge",
    "https://kgrid.org/koio#hasService",
    "https://kgrid.org/koio#hasTest",
    "https://kgrid.org/koio#hasDocumentation",
  ];
  required.forEach((iri) => assert.ok(getEmbeddedVocabularyTerm(iri), `Missing ${iri}`));
});

test("standalone edition contains the exact shared vocabulary snapshot", () => {
  const standalone = fs.readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const match = standalone.match(/\/\* EMBEDDED_VOCABULARY_REGISTRY_START \*\/\s*const embeddedVocabularyRegistry=Object\.freeze\((\{[\s\S]*?\})\);\s*\/\* EMBEDDED_VOCABULARY_REGISTRY_END \*\//);
  assert.ok(match, "Standalone vocabulary registry snapshot is present");
  assert.deepEqual(JSON.parse(match[1]), JSON.parse(serializeEmbeddedVocabularyRegistry()));
});
