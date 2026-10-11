import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { buildKnowledgeViewModel, projectKnowledgeViewModel } from "../app/k-view-model.js";
import { inspectEvidenceSubgraphNode, inspectEvidenceSubgraphRelationship } from "../app/evidence-subgraph-inspector.js";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8").split("\n");
const metadataFor = (id) => {
  const line = page.find((value) => value.startsWith(`  "${id}/metadata.json":`));
  return JSON.parse(JSON.parse(line.slice(line.indexOf(":") + 1).trim().replace(/,$/, "")));
};
const project = (metadata) => projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata).evidenceSubgraph;
const value = (detail, label) => detail.rows.find((row) => row.label === label)?.value;

test("node inspection preserves citation, identity, file, selector and verification facts", () => {
  const metadata = metadataFor(4), graph = project(metadata);
  const evidence = graph.nodes.find((node) => node.kind === "evidential-resource");
  const evidenceDetail = inspectEvidenceSubgraphNode(graph, metadata, evidence.key);
  assert.equal(value(evidenceDetail, "Identifier"), evidence.sourceId);
  assert.ok(value(evidenceDetail, "Description"));
  assert.ok(value(evidenceDetail, "Citation"));
  const table = graph.nodes.find((node) => node.kind === "evidential-resource" && node.sourceId.includes("evidence-margolis-table3"));
  assert.match(value(inspectEvidenceSubgraphNode(graph, metadata, table.key), "Evidence-target annotation"), /annotation-margolis-table3/);
  const passage = graph.nodes.find((node) => node.kind === "implementation-passage");
  const passageDetail = inspectEvidenceSubgraphNode(graph, metadata, passage.key);
  assert.equal(value(passageDetail, "Contained in"), "src/prognosis.js");
  assert.equal(value(passageDetail, "Exact passage"), passage.selector.exact);
  assert.equal(value(passageDetail, "Passage verification"), "not-checked");
  assert.equal(inspectEvidenceSubgraphNode(graph, metadata, "not-a-node"), null);
});

test("relationship inspection gives exact declared triple and annotation route only where present", () => {
  const metadata = metadataFor(4), graph = project(metadata);
  const basisIndex = graph.relationships.findIndex((edge) => edge.kind === "evidential-basis");
  const basis = graph.relationships[basisIndex];
  const basisDetail = inspectEvidenceSubgraphRelationship(graph, metadata, basisIndex);
  assert.equal(value(basisDetail, "Subject"), graph.nodes.find((node) => node.key === basis.from).sourceId);
  assert.equal(value(basisDetail, "Predicate"), "koio:hasEvidentialBasis");
  assert.equal(value(basisDetail, "Object"), graph.nodes.find((node) => node.key === basis.to).sourceId);
  assert.equal(value(basisDetail, "Selector exact"), undefined);
  const targetIndex = graph.relationships.findIndex((edge) => edge.kind === "annotation-target" && graph.nodes.find((node) => node.key === edge.to)?.kind === "implementation-passage");
  const target = graph.relationships[targetIndex];
  const targetDetail = inspectEvidenceSubgraphRelationship(graph, metadata, targetIndex);
  assert.equal(value(targetDetail, "Subject"), graph.nodes.find((node) => node.key === target.from).sourceId);
  assert.equal(value(targetDetail, "Object"), graph.nodes.find((node) => node.key === target.to).sourceId);
  assert.equal(value(targetDetail, "Selector exact"), graph.nodes.find((node) => node.key === target.to).selector.exact);
  assert.equal(value(targetDetail, "Target file"), "src/prognosis.js");
  assert.equal(inspectEvidenceSubgraphRelationship(graph, metadata, -1), null);
});

test("standalone embeds identical node and relationship inspection", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const start = html.indexOf("/* EVIDENCE_SUBGRAPH_INSPECTOR_START */");
  const end = html.indexOf("/* EVIDENCE_SUBGRAPH_INSPECTOR_END */", start);
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({});
  vm.runInContext(`${html.slice(start, end)};globalThis.inspectNode=inspectEvidenceSubgraphNode;globalThis.inspectEdge=inspectEvidenceSubgraphRelationship;`, context);
  const metadata = metadataFor(4), graph = project(metadata);
  const node = graph.nodes.find((item) => item.kind === "implementation-passage");
  const edgeIndex = graph.relationships.findIndex((edge) => edge.kind === "annotation-target");
  assert.deepEqual(JSON.parse(JSON.stringify(context.inspectNode(graph, metadata, node.key))), inspectEvidenceSubgraphNode(graph, metadata, node.key));
  assert.deepEqual(JSON.parse(JSON.stringify(context.inspectEdge(graph, metadata, edgeIndex))), inspectEvidenceSubgraphRelationship(graph, metadata, edgeIndex));
});
