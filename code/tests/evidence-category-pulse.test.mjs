import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildKnowledgeViewModel, projectKnowledgeViewModel } from "../app/k-view-model.js";
import { evidenceCategoryPulseKeys } from "../app/evidence-subgraph-layout.js";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8").split("\n");
const metadataFor = (id) => {
  const line = page.find((value) => value.startsWith(`  "${id}/metadata.json":`));
  return JSON.parse(JSON.parse(line.slice(line.indexOf(":") + 1).trim().replace(/,$/, "")));
};
const modelFor = (metadata) => projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata);
const selectedKinds = (model) => {
  const graph = model.evidenceSubgraph;
  const keys = new Set(evidenceCategoryPulseKeys(graph, model.linkingCategory.category));
  assert.equal(keys.size, evidenceCategoryPulseKeys(graph, model.linkingCategory.category).length);
  assert.ok([...keys].every((key) => graph.nodes.some((node) => node.key === key)));
  return graph.nodes.filter((node) => keys.has(node.key)).map((node) => node.kind);
};

test("category pulses only metadata-derived subjects and destinations, never annotation markers", () => {
  const [wagner, decision, burden, margolis] = [1, 2, 3, 4].map((id) => modelFor(metadataFor(id)));
  assert.deepEqual(selectedKinds(wagner).sort(), ["knowledge-object", "evidential-resource", "evidential-resource"].sort());
  assert.deepEqual(selectedKinds(decision).sort(), ["knowledge-element", "evidential-resource", "evidential-resource", "specification-passage"].sort());
  const burdenKinds = selectedKinds(burden);
  assert.equal(burdenKinds.filter((kind) => kind === "knowledge-element").length, 2);
  assert.equal(burdenKinds.filter((kind) => kind === "implementation-passage").length, 2);
  assert.equal(burdenKinds.filter((kind) => kind === "evidential-resource").length, 3);
  const unevidencedRow = burden.evidenceSubgraph.nodes.find((node) => node.kind === "knowledge-element" && /Response Analysis/.test(node.label));
  assert.ok(unevidencedRow);
  assert.ok(!evidenceCategoryPulseKeys(burden.evidenceSubgraph, burden.linkingCategory.category).includes(unevidencedRow.key));
  const margolisKinds = selectedKinds(margolis);
  assert.equal(margolisKinds.filter((kind) => kind === "knowledge-element").length, 1);
  assert.equal(margolisKinds.filter((kind) => kind === "specification-passage").length, 1);
  assert.equal(margolisKinds.filter((kind) => kind === "implementation-passage").length, 2);
  assert.ok(margolisKinds.includes("evidential-resource"));
  for (const model of [wagner, decision, burden, margolis]) assert.ok(!selectedKinds(model).includes("annotation"));
});

test("None and unclassified patterns have no pulsing nodes, including the assembly", () => {
  const line = page.find((value) => value.startsWith("const EMBEDDED_ASSEMBLY:"));
  const metadata = JSON.parse(line.slice(line.indexOf("= ") + 2).replace(/;$/, "")).metadata;
  const assembly = modelFor(metadata);
  assert.equal(assembly.linkingCategory.category, "none");
  assert.deepEqual(evidenceCategoryPulseKeys(assembly.evidenceSubgraph, "none"), []);
  assert.deepEqual(evidenceCategoryPulseKeys(assembly.evidenceSubgraph, null), []);
});

test("both editions use one shared selector and the same synchronized purple edge pulse", () => {
  const server = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const serverCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const standaloneRows = readFileSync(new URL("../scripts/standalone-evidence-graph-rows.txt", import.meta.url), "utf8");
  assert.match(server, /convergent && pulseKeys\.has\(lane\.subject\.key\) \? " knowledgeGraphConvergentLane"/);
  for (const source of [standaloneRows, standalone]) {
    assert.match(source, /convergent&&pulseKeys\.has\(lane\.subject\.key\)\?" knowledgeGraphConvergentLane"/);
  }
  for (const source of [server, standalone]) {
    assert.match(source, /evidenceCategoryPulseKeys\(graph,\s*model\.linkingCategory\?\.category\)/);
    assert.match(source, /pulseKeys\.has\(item\.key\)/);
    assert.match(source, /knowledgeSubgraphHeader/);
    assert.match(source, /knowledgeSubgraphTitleRow/);
    assert.match(source, /knowledgeGraphConvergentPulse/);
    assert.match(source, /knowledgeGraphConvergentLane/);
  }
  for (const css of [serverCss, standalone]) {
    assert.match(css, /knowledgeGraphNode\.knowledgeGraphCategoryPulse/);
    assert.match(css, /knowledgeGraphSubject \.knowledgeGraphNode\.knowledgeGraphCategoryPulse\s*\{\s*background:\s*#f3edf9/);
    assert.match(css, /knowledgeGraphEdgePulse 2\.2s ease-in-out infinite/);
    assert.match(css, /@keyframes knowledgeGraphConvergentPulse/);
    assert.match(css, /@keyframes knowledgeGraphInnerRing/);
    assert.match(css, /@keyframes knowledgeGraphOuterRing/);
    assert.match(css, /knowledgeGraphConvergentPulse::before/);
    assert.match(css, /knowledgeGraphConvergentPulse::after/);
    assert.match(css, /inset:\s*-6px;?\s*border-color:\s*#c4a6e2/);
    assert.match(css, /knowledgeGraphLane:has\(\.knowledgeGraphConvergentPulse\)/);
    assert.match(css, /knowledgeGraphLane\.knowledgeGraphConvergentLane/);
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
  }
});
