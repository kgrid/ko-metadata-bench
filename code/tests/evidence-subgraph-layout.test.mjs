import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildKnowledgeViewModel, projectKnowledgeViewModel } from "../app/k-view-model.js";
import { layoutEvidenceSubgraph } from "../app/evidence-subgraph-layout.js";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8").split("\n");
const metadataFor = (id) => {
  const line = page.find((value) => value.startsWith(`  "${id}/metadata.json":`));
  return JSON.parse(JSON.parse(line.slice(line.indexOf(":") + 1).trim().replace(/,$/, "")));
};
const lanesFor = (metadata) => layoutEvidenceSubgraph(projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata).evidenceSubgraph);

test("consistent lanes preserve each KO's declaration site without inferred links", () => {
  const [wagner, decision, burden, margolis] = [1, 2, 3, 4].map((id) => lanesFor(metadataFor(id)));
  assert.deepEqual(wagner.map((lane) => lane.basis.length), [2, 0, 0]);
  assert.deepEqual(decision.map((lane) => lane.basis.length), [0, 1]);
  assert.deepEqual(burden.map((lane) => lane.basis.length), [0, 2, 1, 0]);
  assert.deepEqual(margolis.map((lane) => lane.basis.length), [0, 1]);
  assert.equal(burden.at(-1).basis.length, 0);
  assert.ok(burden.at(-1).annotations.some((route) => route.targets.some((target) => target.node.kind === "implementation-passage")));
  assert.ok(margolis.at(-1).annotations.every((route) => route.targets.every((target) => target.node.kind !== "evidential-resource")));
  for (const lanes of [wagner, decision, burden, margolis]) {
    for (const lane of lanes) {
      assert.ok(lane.basis.every((basis) => basis.edge.from === lane.subject.key));
      assert.ok(lane.annotations.every((route) => route.edge.from === lane.subject.key && route.targets.every((target) => target.edge.from === route.annotation.key)));
    }
  }
});

test("assembly has its own empty lanes, not inherited evidence", () => {
  const line = page.find((value) => value.startsWith("const EMBEDDED_ASSEMBLY:"));
  const metadata = JSON.parse(line.slice(line.indexOf("= ") + 2).replace(/;$/, "")).metadata;
  const lanes = lanesFor(metadata);
  assert.ok(lanes.length > 0);
  assert.ok(lanes.every((lane) => lane.basis.length === 0 && lane.annotations.length === 0));
});

test("both editions label evidential-basis targets as evidence resources", () => {
  const server = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(server, /node\(basis\.resource, "evidence resource"\)/);
  assert.match(standalone, /node\(basis\.resource,"evidence resource"\)/);
  assert.doesNotMatch(server, /node\(basis\.resource, "evidential basis"\)/);
  assert.doesNotMatch(standalone, /node\(basis\.resource,"evidential basis"\)/);
});

test("the bone row treatment applies to element lanes, not the KO lane, in both editions", () => {
  const lanes = lanesFor(metadataFor(3));
  assert.equal(lanes[0].subject.kind, "knowledge-object");
  assert.ok(lanes.slice(1).every((lane) => lane.subject.kind === "knowledge-element"));
  const serverCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(serverCss, /\.knowledgeGraphLane \+ \.knowledgeGraphLane \{[^}]*background: #f6f3ee;/);
  assert.match(standalone, /\.knowledgeGraphLane\+\.knowledgeGraphLane\{[^}]*background:#f6f3ee/);
  assert.doesNotMatch(serverCss, /\.knowledgeGraphHead \+ \.knowledgeGraphLane \{ background: #f6f3ee; \}/);
  assert.doesNotMatch(standalone, /\.knowledgeGraphHead\+\.knowledgeGraphLane\{background:#f6f3ee\}/);
});
