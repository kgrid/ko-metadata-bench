import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { buildKnowledgeViewModel, projectKnowledgeViewModel } from "../app/k-view-model.js";

const embedded = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8").split("\n");
function embeddedMetadata(id) {
  const line = embedded.find((value) => value.startsWith(`  "${id}/metadata.json":`));
  return JSON.parse(JSON.parse(line.slice(line.indexOf(":") + 1).trim().replace(/,$/, "")));
}

test("the four embedded KOs retain the exact evidence declaration site", () => {
  const models = [1, 2, 3, 4].map((id) => buildKnowledgeViewModel(embeddedMetadata(id)));
  assert.deepEqual(models.map((model) => model.elements.length), [2, 1, 3, 1]);
  assert.deepEqual(models.map((model) => model.koEvidentialBasis.length), [2, 0, 0, 0]);
  assert.deepEqual(models.map((model) => model.elements.map((element) => element.evidentialBasis.length)), [[0, 0], [1], [2, 1, 0], [1]]);
  assert.equal(models[0].koEvidentialBasis[0].declaredOn, "knowledge-object");
  assert.equal(models[2].elements[1].evidentialBasis[0].elementIndex, 1);
  assert.equal(models[2].elements[1].implementations[0]["@id"], "src/questionnaire-logic.js");
});

test("single values, absent declarations, and duplicate references are preserved without inference", () => {
  const source = { "koio:hasKnowledge": { "@id": "one", implementedBy: { "@id": "code.js" }, "koio:hasEvidentialBasis": { "@id": "paper" } }, "koio:hasEvidentialBasis": [{ "@id": "paper" }] };
  const model = buildKnowledgeViewModel(source);
  assert.equal(model.elements[0].implementations[0]["@id"], "code.js");
  assert.equal(model.elements[0].evidentialBasis[0].declaredOn, "knowledge-element");
  assert.equal(model.koEvidentialBasis[0].declaredOn, "knowledge-object");
  assert.deepEqual(buildKnowledgeViewModel({}), { elements: [], linkedKnowledgeObjects: [], koEvidentialBasis: [] });
});

test("source citations and documentation do not imply evidential basis", () => {
  const metadata = {
    "dc:source": [{ "@id": "paper", "dc:bibliographicCitation": "A cited paper" }],
    "koio:hasDocumentation": [{ "@id": "specs/clinical-spec.docx", "@type": ["InformationArtifact", "Specification Document"] }],
    "koio:hasKnowledge": [{ "@id": "element", "dc:title": "An element", implementedBy: { "@id": "src/logic.js" } }],
  };
  const projection = projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata);
  assert.equal(projection.evidenceCount, 0);
  assert.deepEqual(projection.elements[0].evidentialBasis, []);
  assert.deepEqual(projection.koEvidentialBasis, []);
  assert.equal(projection.cks?.path, "specs/clinical-spec.docx");
});

test("a named evidence part inherits the citation of its containing source", () => {
  const metadata = {
    "dc:source": [{
      "@id": "https://example.org/paper",
      "dc:bibliographicCitation": "Example authors. Example paper.",
      "schema:hasPart": { "@id": "https://example.org/paper#figure-6", "dc:title": "Figure 6" },
    }],
    "koio:hasKnowledge": [{
      "@id": "decision-logic",
      "koio:hasEvidentialBasis": [{ "@id": "https://example.org/paper#figure-6", "dc:title": "Figure 6" }],
    }],
  };
  const projection = projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata);
  assert.equal(projection.elements[0].evidentialBasis[0].citation, "Example authors. Example paper.");
  assert.equal(projection.elements[0].evidentialBasis[0].name, "Figure 6");
  assert.equal(projection.evidenceCount, 1);
});

test("assembly evidence does not inherit from referenced knowledge objects", () => {
  const metadata = {
    "schema:category": "Knowledge Assembly",
    "koio:hasKnowledge": [
      { "@id": "assembly-operation", "dc:title": "Assembly operation" },
      { "@id": "constituent-ko", "@type": "koio:KnowledgeObject", "koio:hasEvidentialBasis": [{ "@id": "constituent-paper" }] },
    ],
  };
  const projection = projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata);
  assert.equal(projection.dependencyCount, 1);
  assert.equal(projection.evidenceCount, 0);
  assert.deepEqual(projection.elements[0].evidentialBasis, []);
  assert.deepEqual(projection.koEvidentialBasis, []);
});

test("readable projections resolve citations and count distinct sources without merging links", () => {
  const projections = [1, 2, 3, 4].map((id) => {
    const metadata = embeddedMetadata(id);
    return projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata);
  });
  assert.deepEqual(projections.map((projection) => projection.evidenceCount), [2, 1, 3, 1]);
  assert.match(projections[0].koEvidentialBasis[0].citation, /Wagner/);
  assert.equal(projections[0].elements[0].evidentialBasis.length, 0);
  assert.match(projections[1].elements[0].evidentialBasis[0].citation, /Huang/);
  assert.equal(projections[2].elements[1].evidentialBasis[0].declaredOn, "knowledge-element");
  assert.equal(projections[2].elements[1].implementations[0].path, "src/questionnaire-logic.js");
  assert.equal(projections[3].elements[0].descriptionDeclared, true);
  for (const projection of projections) {
    assert.match(projection.cks?.path ?? "", /^specs\/.*CKS.*\.docx$/i);
    assert.ok(projection.cks?.name);
  }

  const shared = { "@id": "paper", "dc:bibliographicCitation": "Example citation" };
  const metadata = { "koio:hasEvidentialBasis": [shared], "koio:hasKnowledge": [{ "@id": "element", "koio:hasEvidentialBasis": [shared] }] };
  const projection = projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata);
  assert.equal(projection.evidenceCount, 1);
  assert.equal(projection.koEvidentialBasis.length, 1);
  assert.equal(projection.elements[0].evidentialBasis.length, 1);
  assert.equal(projection.elements[0].description, "Description not declared");
  assert.equal(projection.elements[0].descriptionDeclared, false);
  assert.equal(projection.cks, null);
});

test("standalone and server editions produce the same readable projection", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const start = html.indexOf("/* KNOWLEDGE_ANNOTATION_RESOLVER_START */");
  const end = html.indexOf("function renderKnowledge(){", start);
  const context = vm.createContext({});
  vm.runInContext(`${html.slice(start, end)}; globalThis.project = metadata => projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata);`, context);
  for (const id of [1, 2, 3, 4]) {
    const metadata = embeddedMetadata(id);
    assert.deepEqual(JSON.parse(JSON.stringify(context.project(metadata))), projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata));
  }
});

test("the KA counts its own orchestration knowledge, not four referenced constituent KOs", () => {
  const line = embedded.find((value) => value.startsWith("const EMBEDDED_ASSEMBLY:"));
  const metadata = JSON.parse(line.slice(line.indexOf(" = ") + 3, -1)).metadata;
  const projection = projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata);
  assert.equal(projection.elements.length, 1);
  assert.equal(projection.linkedKnowledgeObjects.length, 4);
  assert.equal(projection.evidenceCount, 0);
  assert.equal(projection.dependencyCount, 4);
  assert.equal(projectKnowledgeViewModel(buildKnowledgeViewModel(embeddedMetadata(1)), embeddedMetadata(1)).dependencyCount, null);
});

test("only an explicitly categorized KA receives a deduplicated dependency count", () => {
  const references = [{ "@id": "https://example.org/ko-a", "@type": "koio:KnowledgeObject" }, { "@id": "https://example.org/ko-a", "@type": "koio:KnowledgeObject" }, { "@id": "https://example.org/ko-b", "@type": "koio:KnowledgeObject" }];
  const metadata = { "schema:category": "Knowledge Assembly", "koio:hasKnowledge": references };
  assert.equal(projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata).dependencyCount, 2);
  const ordinary = { ...metadata, "schema:category": "Knowledge Object" };
  assert.equal(projectKnowledgeViewModel(buildKnowledgeViewModel(ordinary), ordinary).dependencyCount, null);
});
