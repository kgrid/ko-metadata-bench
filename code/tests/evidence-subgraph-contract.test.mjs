import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  EVIDENCE_SUBGRAPH_NODE_KINDS as NODES,
  EVIDENCE_SUBGRAPH_RELATIONSHIP_KINDS as EDGES,
  EVIDENCE_SUBGRAPH_RELATIONSHIP_RULES as RULES,
  permitsEvidenceSubgraphRelationship,
} from "../app/evidence-subgraph-contract.js";

test("the contract permits only the scoped evidence-linking nodes and directed relationships", () => {
  assert.deepEqual(Object.values(NODES), [
    "knowledge-object", "knowledge-element", "evidential-resource", "annotation",
    "specification-passage", "implementation-passage",
  ]);
  assert.deepEqual(Object.values(EDGES), [
    "evidential-basis", "evidence-part", "subject-of-annotation", "annotation-target",
  ]);
  assert.equal(permitsEvidenceSubgraphRelationship(EDGES.EVIDENTIAL_BASIS, NODES.KNOWLEDGE_OBJECT, NODES.EVIDENTIAL_RESOURCE), true);
  assert.equal(permitsEvidenceSubgraphRelationship(EDGES.EVIDENTIAL_BASIS, NODES.KNOWLEDGE_ELEMENT, NODES.EVIDENTIAL_RESOURCE), true);
  assert.equal(permitsEvidenceSubgraphRelationship(EDGES.EVIDENCE_PART, NODES.EVIDENTIAL_RESOURCE, NODES.EVIDENTIAL_RESOURCE), true);
  assert.equal(permitsEvidenceSubgraphRelationship(EDGES.SUBJECT_OF_ANNOTATION, NODES.KNOWLEDGE_ELEMENT, NODES.ANNOTATION), true);
  assert.equal(permitsEvidenceSubgraphRelationship(EDGES.ANNOTATION_TARGET, NODES.ANNOTATION, NODES.EVIDENTIAL_RESOURCE), false);
  assert.equal(permitsEvidenceSubgraphRelationship(EDGES.ANNOTATION_TARGET, NODES.ANNOTATION, NODES.SPECIFICATION_PASSAGE), true);
  assert.equal(permitsEvidenceSubgraphRelationship(EDGES.ANNOTATION_TARGET, NODES.ANNOTATION, NODES.IMPLEMENTATION_PASSAGE), true);
});

test("file-level links and inferred evidence-to-code edges cannot enter the subgraph", () => {
  assert.equal(permitsEvidenceSubgraphRelationship("implementedBy", NODES.KNOWLEDGE_ELEMENT, NODES.IMPLEMENTATION_PASSAGE), false);
  assert.equal(permitsEvidenceSubgraphRelationship(EDGES.EVIDENTIAL_BASIS, NODES.EVIDENTIAL_RESOURCE, NODES.IMPLEMENTATION_PASSAGE), false);
  assert.equal(permitsEvidenceSubgraphRelationship(EDGES.ANNOTATION_TARGET, NODES.KNOWLEDGE_ELEMENT, NODES.IMPLEMENTATION_PASSAGE), false);
  assert.equal(Object.values(RULES).some((rule) => rule.sourceField === "dc:source"), false);
  assert.equal(readFileSync(new URL("../app/evidence-subgraph-contract.js", import.meta.url), "utf8").includes("workshop-ko-"), false);
});

test("the documented claim boundaries match the allowed graph relationships", () => {
  const contract = readFileSync(new URL("../docs/EVIDENCE-SUBGRAPH-CONTRACT.md", import.meta.url), "utf8");
  assert.match(contract, /Absence is not a relationship/);
  assert.match(contract, /The KA does not inherit evidence/);
  assert.match(contract, /A route through an element is not a direct assertion/);
  assert.equal(permitsEvidenceSubgraphRelationship("not-declared", NODES.KNOWLEDGE_ELEMENT, NODES.EVIDENTIAL_RESOURCE), false);
  assert.equal(permitsEvidenceSubgraphRelationship(EDGES.EVIDENTIAL_BASIS, NODES.EVIDENTIAL_RESOURCE, NODES.IMPLEMENTATION_PASSAGE), false);
  assert.equal(permitsEvidenceSubgraphRelationship(EDGES.EVIDENTIAL_BASIS, NODES.EVIDENTIAL_RESOURCE, NODES.SPECIFICATION_PASSAGE), false);
  assert.equal(permitsEvidenceSubgraphRelationship(EDGES.ANNOTATION_TARGET, NODES.KNOWLEDGE_OBJECT, NODES.IMPLEMENTATION_PASSAGE), false);
});

test("the portable edition receives the identical shared contract", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const block = html.split("/* EVIDENCE_SUBGRAPH_CONTRACT_START */")[1]?.split("/* EVIDENCE_SUBGRAPH_CONTRACT_END */")[0];
  assert.ok(block, "standalone contains the shared contract");
  const context = vm.createContext({});
  vm.runInContext(`${block}\nthis.contract = { nodes: EVIDENCE_SUBGRAPH_NODE_KINDS, edges: EVIDENCE_SUBGRAPH_RELATIONSHIP_KINDS, rules: EVIDENCE_SUBGRAPH_RELATIONSHIP_RULES, permits: permitsEvidenceSubgraphRelationship };`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.contract.nodes)), NODES);
  assert.deepEqual(JSON.parse(JSON.stringify(context.contract.rules)), RULES);
  assert.equal(context.contract.permits(EDGES.EVIDENTIAL_BASIS, NODES.KNOWLEDGE_ELEMENT, NODES.EVIDENTIAL_RESOURCE), true);
});
