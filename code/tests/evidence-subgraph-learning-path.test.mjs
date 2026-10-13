import { readServerSourceSync } from "./server-source.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { buildKnowledgeViewModel, projectKnowledgeViewModel } from "../app/k-view-model.js";
import { layoutEvidenceSubgraph } from "../app/evidence-subgraph-layout.js";
import { planEvidenceSubgraphActions } from "../app/evidence-subgraph-actions.js";
import { evidencePassageGlimpse } from "../app/evidence-passage-glimpse.js";

const page = readServerSourceSync();
const files = JSON.parse(page.slice(page.indexOf("const objectFileOverrides:") + "const objectFileOverrides: Record<string, string> = ".length, page.indexOf(";\nconst objectBinaryOverrides:")));
const statuses = JSON.parse(page.split("\n").find((line) => line.startsWith("const annotationDestinationOverrides:")).split(" = ")[1].replace(/;$/, ""));
const assemblyLine = page.split("\n").find((line) => line.startsWith("const EMBEDDED_ASSEMBLY:"));
const assembly = JSON.parse(assemblyLine.slice(assemblyLine.indexOf("= ") + 2).replace(/;$/, "")).metadata;
const modelFor = (id) => {
  const metadata = id === 5 ? assembly : JSON.parse(files[`${id}/metadata.json`]);
  return { metadata, model: projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata, statuses[id] ?? []) };
};
const graphFor = (id) => modelFor(id).model.evidenceSubgraph;
const passages = (graph, kind) => graph.nodes.filter((node) => node.kind === kind);

test("five embedded teaching patterns retain their distinct declared routes", () => {
  const [wagner, decision, burden, margolis, ka] = [1, 2, 3, 4, 5].map(graphFor);
  assert.equal(ka.relationships.length, 0, "KA must not inherit constituent KO evidence");
  assert.equal(passages(ka, "evidential-resource").length, 0);
  assert.deepEqual(layoutEvidenceSubgraph(wagner).map((lane) => lane.basis.length), [2, 0, 0]);
  assert.ok(wagner.relationships.filter((edge) => edge.kind === "evidential-basis").every((edge) => edge.from.startsWith("knowledge-object:")));

  const treatmentLanes = layoutEvidenceSubgraph(decision);
  assert.deepEqual(treatmentLanes.map((lane) => lane.basis.length), [0, 1]);
  assert.equal(passages(decision, "specification-passage").length, 1);
  assert.equal(passages(decision, "implementation-passage").length, 0, "implementation is file-level only");
  assert.ok(decision.fileContext.some((file) => file.kind === "implementation-file"));

  const burdenLanes = layoutEvidenceSubgraph(burden);
  assert.deepEqual(burdenLanes.map((lane) => lane.basis.length), [0, 2, 1, 0]);
  assert.deepEqual(burdenLanes.map((lane) => lane.annotations.flatMap((route) => route.targets).filter((target) => target.node.kind === "implementation-passage").length), [0, 1, 1, 1]);
  assert.equal(passages(burden, "specification-passage").length, 0);

  assert.equal(passages(margolis, "specification-passage").length, 1);
  assert.equal(passages(margolis, "implementation-passage").length, 2);
  const margolisLanes = layoutEvidenceSubgraph(margolis);
  const convergentLane = margolisLanes.find((lane) => lane.subject.kind === "knowledge-element");
  assert.ok(convergentLane, "Margolis has a declaring knowledge element");
  assert.equal(convergentLane.basis.length, 1, "the same element declares the Table 3 basis");
  assert.equal(convergentLane.specificationRoutes.length, 1, "the element has a CKS passage route");
  assert.equal(convergentLane.implementationRoutes.length, 2, "the element has both code passage routes");
  assert.ok([...convergentLane.specificationRoutes, ...convergentLane.implementationRoutes]
    .every((route) => route.edge.declaringSubjectId === convergentLane.subject.sourceId),
  "convergence is on one declaring subject, not across unrelated rows");
  assert.ok(margolis.relationships.some((edge) => edge.kind === "evidence-part"), "Table 3 must remain a part of the article");
  assert.ok(margolis.relationships.every((edge) => !(edge.from.startsWith("evidential-resource:") && /^(specification|implementation)-passage:/.test(edge.to))), "no direct evidence-to-passage claim");
});

test("selector failure never offers or paints a precise passage, while verified targets work offline", () => {
  for (const id of [2, 3, 4]) {
    const { metadata, model } = modelFor(id);
    const graph = model.evidenceSubgraph;
    for (const passage of graph.nodes.filter((node) => node.kind.endsWith("-passage"))) {
      const source = files[`${id}/${passage.parentFile}`];
      assert.ok(source, `${id}: embedded ${passage.parentFile}`);
      assert.ok(evidencePassageGlimpse(passage, () => source), `${id}: exact passage preview`);
      const selection = { kind: "node", key: passage.key };
      const working = planEvidenceSubgraphActions(graph, model, metadata, selection, () => true);
      assert.equal(working.actions[0]?.label, "Follow passage");
      const failed = { ...passage, verification: { status: "unresolved", reason: "selector did not match" } };
      const failedGraph = { ...graph, nodes: graph.nodes.map((node) => node.key === passage.key ? failed : node) };
      assert.equal(evidencePassageGlimpse(failed, () => source), null);
      const unavailable = planEvidenceSubgraphActions(failedGraph, model, metadata, selection, () => true);
      assert.equal(unavailable.actions.length, 0);
      assert.match(unavailable.notice, /No whole-file substitute/);
    }
  }
});
