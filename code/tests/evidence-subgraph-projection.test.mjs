import { readServerSourceSync } from "./server-source.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { buildKnowledgeViewModel, projectKnowledgeViewModel } from "../app/k-view-model.js";

const page = readServerSourceSync().split("\n");
const metadataFor = (id) => {
  const line = page.find((value) => value.startsWith(`  "${id}/metadata.json":`));
  return JSON.parse(JSON.parse(line.slice(line.indexOf(":") + 1).trim().replace(/,$/, "")));
};
const project = (metadata, statuses = []) => projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata, statuses).evidenceSubgraph;

test("four KO patterns preserve declaration sites and passage provenance", () => {
  const graphs = [1, 2, 3, 4].map((id) => project(metadataFor(id)));
  assert.deepEqual(graphs.map((graph) => graph.relationships.filter((edge) => edge.kind === "evidential-basis").length), [2, 1, 3, 1]);
  assert.ok(graphs[0].relationships.filter((edge) => edge.kind === "evidential-basis").every((edge) => edge.from.startsWith("knowledge-object:")));
  assert.ok(graphs[2].relationships.filter((edge) => edge.kind === "evidential-basis").every((edge) => edge.from.startsWith("knowledge-element:")));
  assert.deepEqual(graphs.map((graph) => graph.nodes.filter((node) => node.kind === "specification-passage").length), [0, 1, 0, 1]);
  assert.deepEqual(graphs.map((graph) => graph.nodes.filter((node) => node.kind === "implementation-passage").length), [0, 0, 3, 2]);
  assert.ok(graphs[3].nodes.some((node) => node.kind === "evidential-resource" && node.label === "Supplementary Table 3"));
  assert.ok(!graphs[3].nodes.some((node) => node.kind === "annotation" && node.sourceId.includes("annotation-margolis-table3")));
  assert.ok(!graphs[1].nodes.some((node) => node.kind === "annotation" && node.sourceId.includes("annotation-uhms-figure6")));
  const code = graphs[3].nodes.find((node) => node.kind === "implementation-passage");
  assert.equal(code.parentFile, "src/prognosis.js");
  assert.ok(code.selector.exact && code.digest);
  assert.equal(code.verification.status, "not-checked");
  assert.ok(graphs[3].fileContext.some((file) => file.kind === "implementation-file" && file.path === "src/prognosis.js"));
  assert.ok(graphs.every((graph) => !graph.relationships.some((edge) => edge.from.startsWith("evidential-resource:") && edge.to.startsWith("implementation-passage:"))));
});

test("evidence labels prefer declared titles, then names, then exact identifiers", () => {
  const sourceId = "https://doi.org/10.1002/dmrr.3273";
  const metadata = metadataFor(1);
  const source = metadata["dc:source"].find((record) => record["@id"] === sourceId);
  const basis = metadata["koio:hasEvidentialBasis"].find((record) => record["@id"] === sourceId);
  const label = () => project(metadata).nodes.find((node) => node.kind === "evidential-resource" && node.sourceId === sourceId).label;
  source["schema:name"] = "Readable source name";
  delete source["dc:title"];
  basis["dc:title"] = "  Preferred evidence title  ";
  assert.equal(label(), "Preferred evidence title");
  basis["dc:title"] = "   ";
  assert.equal(label(), "Readable source name");
  delete source["schema:name"];
  basis["schema:name"] = "Basis record name";
  assert.equal(label(), "Basis record name");
  delete basis["schema:name"];
  assert.equal(label(), sourceId);
});

test("an evidence-target annotation is not drawn as a second route or mistaken for a basis assertion", () => {
  const metadata = structuredClone(metadataFor(4));
  delete metadata["koio:hasKnowledge"][0]["koio:hasEvidentialBasis"];
  const graph = project(metadata);
  assert.equal(graph.relationships.filter((edge) => edge.kind === "evidential-basis").length, 0);
  assert.ok(!graph.nodes.some((node) => node.kind === "annotation" && node.sourceId.includes("annotation-margolis-table3")));
  assert.ok(!graph.relationships.some((edge) => edge.kind === "annotation-target" && edge.to.startsWith("evidential-resource:")));
  assert.ok(!graph.nodes.some((node) => node.kind === "evidential-resource" && node.sourceId.includes("evidence-margolis-table3")), "without a basis link the source is outside this narrow graph");
});

test("verified status attaches to the exact passage without changing declared edges", () => {
  const baseline = project(metadataFor(4));
  const passage = baseline.nodes.find((node) => node.kind === "implementation-passage");
  const annotation = baseline.nodes.find((node) => node.kind === "annotation" && node.targetId === passage.sourceId);
  const verified = project(metadataFor(4), [{ annotationId: annotation.sourceId, targetId: passage.sourceId, status: "resolved", filePath: "src/prognosis.js" }]);
  assert.equal(verified.nodes.find((node) => node.key === passage.key).verification.status, "resolved");
  assert.deepEqual(verified.relationships, baseline.relationships);
});

test("KA imports neither constituent evidence nor absent edges", () => {
  const line = page.find((value) => value.startsWith("const EMBEDDED_ASSEMBLY:"));
  const metadata = JSON.parse(line.slice(line.indexOf("= ") + 2).replace(/;$/, "")).metadata;
  const graph = project(metadata);
  assert.equal(graph.nodes.filter((node) => node.kind === "knowledge-object").length, 1);
  assert.equal(graph.nodes.filter((node) => node.kind === "evidential-resource").length, 0);
  assert.equal(graph.relationships.length, 0);
});

test("standalone uses the identical graph projection for all embedded objects", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const start = html.indexOf("/* KNOWLEDGE_ANNOTATION_RESOLVER_START */");
  const end = html.indexOf("function renderKnowledge(){", start);
  const context = vm.createContext({});
  vm.runInContext(`${html.slice(start, end)}; globalThis.projectGraph = metadata => projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata).evidenceSubgraph;`, context);
  for (const id of [1, 2, 3, 4]) assert.deepEqual(JSON.parse(JSON.stringify(context.projectGraph(metadataFor(id)))), project(metadataFor(id)));
});
