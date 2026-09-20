import assert from "node:assert/strict";
import test from "node:test";
import { createTermInsightRecord, isTermInsightRecord, TERM_INSIGHT_CONTRACT_VERSION } from "../app/term-insight.js";

const input = () => ({
  termId: "NamedNode:https://schema.org/termCode",
  label: "termCode",
  category: "property",
  compactIdentifier: "schema:termCode",
  authoritativeIri: "https://schema.org/termCode",
  vocabulary: { label: "Schema.org", namespaceIri: "https://schema.org/" },
  explanation: "A code that identifies this term within its defined term set.",
  descriptionStatus: "embedded-vocabulary",
  localRelationships: {
    incoming: [{ statementId: "s2", relationshipLabel: "uses property", predicateIri: "https://schema.org/termCode", relatedTermId: "term:b", relatedLabel: "Wagner grade 1" }],
    outgoing: [
      { statementId: "s3", relationshipLabel: "range", predicateIri: "https://schema.org/rangeIncludes", relatedTermId: "term:z", relatedLabel: "Text" },
      { statementId: "s1", relationshipLabel: "domain", predicateIri: "https://schema.org/domainIncludes", relatedTermId: "term:a", relatedLabel: "DefinedTerm" },
    ],
  },
  statementContext: { statementId: "current", role: "predicate", subjectLabel: "Wagner grade 1", relationshipLabel: "term code", valueLabel: "1" },
  externalUrl: "https://schema.org/termCode",
});

test("creates one deterministic edition-neutral Term Insight record", () => {
  const record = createTermInsightRecord(input());
  assert.equal(record.contractVersion, TERM_INSIGHT_CONTRACT_VERSION);
  assert.deepEqual(Object.keys(record), ["contractVersion", "termId", "label", "category", "compactIdentifier", "authoritativeIri", "vocabulary", "explanation", "descriptionStatus", "localRelationships", "statementContext", "iriFallback", "externalUrl"]);
  assert.deepEqual(record.localRelationships.outgoing.map(({ relationshipLabel }) => relationshipLabel), ["domain", "range"]);
  assert.equal(JSON.stringify(record), JSON.stringify(createTermInsightRecord(input())));
  assert.equal(isTermInsightRecord(record), true);
});

test("deeply freezes the record and its relationship collections", () => {
  const record = createTermInsightRecord(input());
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.vocabulary), true);
  assert.equal(Object.isFrozen(record.localRelationships), true);
  assert.equal(Object.isFrozen(record.localRelationships.incoming), true);
  assert.equal(Object.isFrozen(record.localRelationships.incoming[0]), true);
  assert.equal(Object.isFrozen(record.statementContext), true);
});

test("supports sparse offline insights without inventing descriptions or links", () => {
  const record = createTermInsightRecord({ termId: "urn:term:unknown", label: "Unknown term", category: "resource", compactIdentifier: "ex:unknown" });
  assert.equal(record.authoritativeIri, null);
  assert.equal(record.vocabulary, null);
  assert.equal(record.explanation, "");
  assert.equal(record.descriptionStatus, "unavailable");
  assert.deepEqual(record.localRelationships, { incoming: [], outgoing: [] });
  assert.equal(record.statementContext, null);
  assert.equal(record.iriFallback, null);
  assert.equal(record.externalUrl, null);
});

test("rejects unsafe external actions and malformed statement context", () => {
  assert.throws(() => createTermInsightRecord({ ...input(), externalUrl: "javascript:alert(1)" }), /HTTP or HTTPS/);
  assert.throws(() => createTermInsightRecord({ ...input(), statementContext: { ...input().statementContext, role: "graph" } }), /role must be one of/);
  assert.throws(() => createTermInsightRecord({ ...input(), category: "link" }), /category must be one of/);
});
