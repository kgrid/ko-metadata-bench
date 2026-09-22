import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { deriveSafeIriFallback, isTermInsightEligible, resolveLocalGraphTermInsight, resolveLocalGraphTermInsightInput, safeExternalHttpUrl } from "../app/term-insight-local.js";
import { EMBEDDED_VOCABULARY_REGISTRY } from "../app/term-vocabulary-registry.js";

const term = (id, termType, value, compact = value, humanLabel = "") => ({ id, termType, value, compact, humanLabel, language: "", datatype: "" });
const resource = term("resource", "NamedNode", "https://example.org/terms/grade-1", "ex:grade-1", "Fallback grade");
const definedTerm = term("defined-term", "NamedNode", "https://schema.org/DefinedTerm", "schema:DefinedTerm", "DefinedTerm");
const termSet = term("term-set", "NamedNode", "https://example.org/grade-scale", "ex:grade-scale", "Grade scale");
const name = term("name", "Literal", "Superficial ulcer", '"Superficial ulcer"');
const description = term("description", "Literal", "An ulcer limited to superficial tissue.", '"An ulcer limited to superficial tissue."');
const code = term("code", "Literal", "1", '"1"');
const predicates = {
  type: term("p-type", "NamedNode", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "rdf:type", "type"),
  name: term("p-name", "NamedNode", "https://schema.org/name", "schema:name", "name"),
  description: term("p-description", "NamedNode", "https://schema.org/description", "schema:description", "description"),
  code: term("p-code", "NamedNode", "https://schema.org/termCode", "schema:termCode", "termCode"),
  member: term("p-member", "NamedNode", "https://schema.org/inDefinedTermSet", "schema:inDefinedTermSet", "inDefinedTermSet"),
  defines: term("p-defines", "NamedNode", "https://schema.org/hasDefinedTerm", "schema:hasDefinedTerm", "hasDefinedTerm"),
};
const statement = (id, subject, predicate, object) => ({ id, subject, predicate, object, graph: null });
const graph = { namespaces: [{ prefix: "ex", iri: "https://example.org/" }, { prefix: "schema", iri: "https://schema.org/" }], statements: [statement("s1", resource, predicates.type, definedTerm), statement("s2", resource, predicates.name, name), statement("s3", resource, predicates.description, description), statement("s4", resource, predicates.code, code), statement("s5", resource, predicates.member, termSet), statement("s6", termSet, predicates.defines, resource)] };

test("local graph facts take precedence and retain type, code, membership, and relationships", () => {
  const insight = resolveLocalGraphTermInsight(graph, resource, { statement: graph.statements[4], role: "subject" });
  assert.equal(insight.label, "Superficial ulcer");
  assert.equal(insight.explanation, "An ulcer limited to superficial tissue.");
  assert.equal(insight.descriptionStatus, "local-metadata");
  assert.equal(insight.category, "controlled-term");
  assert.equal(insight.vocabulary.label, "ex");
  assert.deepEqual(insight.localRelationships.outgoing.map(({ predicateIri }) => predicateIri).sort(), ["http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "https://schema.org/description", "https://schema.org/inDefinedTermSet", "https://schema.org/name", "https://schema.org/termCode"]);
  assert.equal(insight.localRelationships.incoming[0].predicateIri, "https://schema.org/hasDefinedTerm");
  assert.equal(insight.statementContext.relationshipLabel, "inDefinedTermSet");
  assert.equal(insight.statementContext.valueLabel, "Grade scale");
});

test("subject, relationship, and value controls retain their complete statement context", () => {
  const sourceStatement = graph.statements[4];
  const selections = [
    [sourceStatement.subject, "subject"],
    [sourceStatement.predicate, "predicate"],
    [sourceStatement.object, "object"],
  ];
  for (const [selected, role] of selections) {
    const insight = resolveLocalGraphTermInsight(graph, selected, { statement: sourceStatement, role });
    assert.equal(insight.statementContext.statementId, sourceStatement.id);
    assert.equal(insight.statementContext.role, role);
    assert.equal(insight.statementContext.subjectLabel, "Superficial ulcer");
    assert.equal(insight.statementContext.relationshipLabel, "inDefinedTermSet");
    assert.equal(insight.statementContext.valueLabel, "Grade scale");
  }
});

test("embedded vocabulary is consulted only when local information is absent", () => {
  const schemaTerm = term("schema-term", "NamedNode", "https://schema.org/termCode", "schema:termCode", "");
  const insight = resolveLocalGraphTermInsight({ namespaces: graph.namespaces, statements: [] }, schemaTerm);
  assert.equal(insight.label, EMBEDDED_VOCABULARY_REGISTRY[schemaTerm.value].label);
  assert.equal(insight.explanation, EMBEDDED_VOCABULARY_REGISTRY[schemaTerm.value].explanation);
  assert.equal(insight.descriptionStatus, "embedded-vocabulary");
  assert.equal(insight.category, "property");
  assert.equal(insight.iriFallback.applied, false);
});

test("unknown web IRIs receive deterministic offline fallback facts without an invented description", () => {
  const unknown = term("unknown", "NamedNode", "https://vocab.example.org/clinical/measurementType", "https://vocab.example.org/clinical/measurementType", "");
  const insight = resolveLocalGraphTermInsight({ namespaces: [], statements: [] }, unknown, { registry: {} });
  assert.equal(insight.label, "measurement Type");
  assert.equal(insight.compactIdentifier, "vocab.example.org:measurementType");
  assert.equal(insight.vocabulary.label, "vocab.example.org");
  assert.equal(insight.vocabulary.namespaceIri, "https://vocab.example.org/clinical/");
  assert.equal(insight.explanation, "");
  assert.equal(insight.descriptionStatus, "external-source-only");
  assert.deepEqual(insight.iriFallback, { applied: true, descriptionAvailable: false, namespaceLabel: "vocab.example.org", namespaceIri: "https://vocab.example.org/clinical/", host: "vocab.example.org", resourceCategory: "Clinical resource" });
});

test("IRI fallback derivation does not perform network resolution", () => {
  assert.deepEqual(deriveSafeIriFallback("https://example.org/vocabulary#SomeTerm"), { namespaceLabel: "example.org", namespaceIri: "https://example.org/vocabulary#", host: "example.org", localIdentifier: "SomeTerm", compactIdentifier: "example.org:SomeTerm", resourceCategory: "Fragment resource" });
  assert.equal(deriveSafeIriFallback("urn:example:term"), null);
});

test("external source navigation accepts only credential-free HTTP and HTTPS URLs", () => {
  assert.equal(safeExternalHttpUrl("https://schema.org/termCode"), "https://schema.org/termCode");
  assert.equal(safeExternalHttpUrl("http://example.org/source"), "http://example.org/source");
  assert.equal(safeExternalHttpUrl("HTTPS://EXAMPLE.ORG/source"), "https://example.org/source");
  assert.equal(safeExternalHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalHttpUrl("data:text/html,unsafe"), null);
  assert.equal(safeExternalHttpUrl("mailto:user@example.org"), null);
  assert.equal(safeExternalHttpUrl("file:///tmp/source"), null);
  assert.equal(safeExternalHttpUrl("https://user:secret@example.org/source"), null);
  assert.equal(safeExternalHttpUrl("not a URL"), null);
});

test("previews and details exclude literals and blank structural nodes", () => {
  assert.equal(isTermInsightEligible(term("named", "NamedNode", "https://example.org/term")), true);
  assert.equal(isTermInsightEligible(term("literal", "Literal", "ordinary text")), false);
  assert.equal(isTermInsightEligible(term("blank", "BlankNode", "b1")), false);
  assert.equal(isTermInsightEligible(null), false);
});

test("unsupported named terms remain usable without invented descriptions", () => {
  const unsupported = term("unsupported", "NamedNode", "urn:example:unsupported", "urn:example:unsupported", "Unsupported term");
  const insight = resolveLocalGraphTermInsight({ namespaces: [], statements: [] }, unsupported, { registry: {} });
  assert.equal(insight.label, "Unsupported term");
  assert.equal(insight.explanation, "");
  assert.equal(insight.descriptionStatus, "unavailable");
  assert.equal(insight.vocabulary, null);
  assert.equal(insight.externalUrl, null);
});

test("Term Insight resolution remains fully offline", () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = () => { fetchCalls += 1; throw new Error("Network access is forbidden in this test."); };
  try {
    const insight = resolveLocalGraphTermInsight(graph, resource, { statement: graph.statements[4], role: "subject" });
    assert.equal(insight.label, "Superficial ulcer");
    assert.equal(insight.explanation, "An ulcer limited to superficial tissue.");
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preview and full-page details consume one identical resolved label and explanation", () => {
  const previewInsight = resolveLocalGraphTermInsight(graph, resource, { statement: graph.statements[4], role: "subject" });
  const detailsInsight = resolveLocalGraphTermInsight(graph, resource, { statement: graph.statements[4], role: "subject" });
  assert.deepEqual(
    { label: previewInsight.label, explanation: previewInsight.explanation },
    { label: detailsInsight.label, explanation: detailsInsight.explanation },
  );
  assert.equal(previewInsight.label, "Superficial ulcer");
  assert.equal(previewInsight.explanation, "An ulcer limited to superficial tissue.");
  const reactSource = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(reactSource, /rdfTermPreview[\s\S]*?<strong>\{insight!\.label\}<\/strong><p>\{insight!\.explanation/);
  assert.match(reactSource, /rdfTermDetailsBackdrop[\s\S]*?<h2 id="rdf-term-details-title">\{insight\.label\}<\/h2>[\s\S]*?\{insight\.explanation \? <p>\{insight\.explanation\}<\/p>/);
});

test("standalone edition embeds the exact local-first resolver", () => {
  const standalone = fs.readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.ok(standalone.includes(`const deriveSafeIriFallback=${deriveSafeIriFallback.toString()};`));
  assert.ok(standalone.includes(`const safeExternalHttpUrl=${safeExternalHttpUrl.toString()};`));
  assert.ok(standalone.includes(`const isTermInsightEligible=${isTermInsightEligible.toString()};`));
  assert.ok(standalone.includes(`const resolveLocalGraphTermInsightInput=${resolveLocalGraphTermInsightInput.toString()};`));
  const detailsStart = standalone.indexOf("/* LOCAL_TERM_DETAILS_START */");
  const applicationEnd = standalone.indexOf("    openKnowledgeObjects();updateHeader();\n})();");
  assert.ok(detailsStart > -1 && detailsStart < applicationEnd, "standalone term interaction must be installed inside the application scope");
  assert.equal(standalone.match(/\/\* LOCAL_TERM_DETAILS_START \*\//g)?.length, 1);
  const details = standalone.match(/\/\* LOCAL_TERM_DETAILS_START \*\/([\s\S]*?)\/\* LOCAL_TERM_DETAILS_END \*\//)?.[1] ?? "";
  assert.match(details, /Semantic meaning/);
  assert.match(details, /Role in this statement/);
  assert.match(details, /RDF identifiers/);
  assert.match(details, /rdf-term-details-backdrop/);
  assert.match(details, /aria-modal/);
  assert.match(details, /rdf-term-details-body/);
  assert.match(details, /rdf-term-details-backdrop\{overflow-x:hidden;overflow-y:auto/);
  assert.match(details, /Local relationships/);
  assert.match(details, /term-insight-relationship-groups/);
  assert.doesNotMatch(details, /more relationships in this metadata graph/);
  assert.doesNotMatch(details, /relationships\.slice\(0,10\)/);
  assert.match(details, /Term-set membership/);
  assert.match(details, /Term code/);
  assert.match(details, /data-statement-id/);
  assert.match(details, /data-term-role/);
  assert.match(details, /statement,role/);
  assert.match(details, /rdfTermStatementContext/);
  assert.match(details, /tr\[data-statement-id\]/);
  assert.match(details, /rdf-term-preview/);
  assert.match(details, /setTimeout\(open,320\)/);
  assert.match(details, /setTimeout\(hideRdfTermPreview,140\)/);
  assert.match(details, /pointerenter/);
  assert.match(details, /event\.key==="Escape"/);
  assert.match(details, /aria-haspopup="dialog"/);
  assert.match(details, /aria-describedby/);
  assert.match(details, /role","tooltip"/);
  assert.match(details, /removeAttribute\("aria-describedby"\)/);
  assert.match(details, /button\.focus\(\)/);
  assert.match(details, /rdf-term-button:focus-visible/);
  assert.match(details, /if\(!isTermInsightEligible\(\{termType:button\.dataset\.termType\}\)\)return/);
  assert.match(details, /Embedded vocabulary description/);
  assert.match(details, /External source identified/);
  assert.match(details, /Open Source/);
  assert.match(details, /noopener noreferrer/);
});
