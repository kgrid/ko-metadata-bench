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
  assert.deepEqual(wagner.map((lane) => [lane.specificationRoutes.length, lane.implementationRoutes.length]), [[0, 0], [0, 0], [0, 0]]);
  assert.deepEqual(decision.map((lane) => [lane.specificationRoutes.length, lane.implementationRoutes.length]), [[0, 0], [1, 0]]);
  assert.deepEqual(burden.map((lane) => [lane.specificationRoutes.length, lane.implementationRoutes.length]), [[0, 0], [0, 1], [0, 1], [0, 1]]);
  assert.deepEqual(margolis.map((lane) => [lane.specificationRoutes.length, lane.implementationRoutes.length]), [[0, 0], [1, 2]]);
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

test("Declaring Subject nodes alone receive the stronger graph border in both editions", () => {
  const serverCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(serverCss, /\.knowledgeGraphSubject \.knowledgeGraphNode \{ border: 2px solid #3a3a3c;/);
  assert.match(standalone, /\.knowledgeGraphSubject \.knowledgeGraphNode\{border:2px solid #3a3a3c/);
});

test("annotations are compact selectable route markers, while subjects and destinations remain prominent", () => {
  const server = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const serverCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  for (const source of [server, standalone]) {
    assert.match(source, /knowledgeGraphAnnotation/);
    assert.match(source, /knowledgeGraphDestination/);
    assert.match(source, /Inspect \$\{(?:escapeHtml\()?kind/);
  }
  assert.match(serverCss, /\.knowledgeGraphNode\.knowledgeGraphAnnotation \{[^}]*border-radius: 999px;[^}]*box-shadow: none;/);
  assert.match(standalone, /\.knowledgeGraphNode\.knowledgeGraphAnnotation\{[^}]*border-radius:999px;[^}]*box-shadow:none;/);
  assert.match(serverCss, /\.knowledgeGraphDestination \{ border-color: #6e6e73;/);
  assert.match(standalone, /\.knowledgeGraphDestination\{border-color:#6e6e73/);
});

test("both editions render four aligned columns with compact evidence nodes", () => {
  const server = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const serverCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  for (const source of [server, standalone]) {
    assert.match(source, /<span>Specification passages<\/span><span>Implementation passages<\/span>/);
    assert.match(source, /knowledgeGraphSpecification/);
    assert.match(source, /knowledgeGraphImplementation/);
  }
  assert.match(serverCss, /\.knowledgeGraphEvidence \.knowledgeGraphNode \{ width: min\(100%, 138px\); min-height: 108px; \}/);
  assert.match(standalone, /\.knowledgeGraphEvidence \.knowledgeGraphNode\{width:min\(100%,138px\);min-height:108px\}/);
});

test("absence is an unlinked inline state, not a node-like card, in both editions", () => {
  const server = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const serverCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  for (const source of [server, standalone]) {
    assert.doesNotMatch(source, /knowledgeGraphAbsent["{]/);
    assert.match(source, /knowledgeGraphAbsence/);
    assert.match(source, /knowledgeGraphLane is/);
  }
  assert.match(serverCss, /\.knowledgeGraphLane\.isEmpty > div \{ padding-top: 6px; padding-bottom: 6px; \}/);
  assert.match(standalone, /\.knowledgeGraphLane\.isEmpty>div\{padding-top:6px;padding-bottom:6px\}/);
  assert.doesNotMatch(serverCss, /\.knowledgeGraphAbsence \{[^}]*border:/);
  assert.doesNotMatch(standalone, /\.knowledgeGraphAbsence\{[^}]*border:/);
});

test("both editions show passage status without placing whole-file context in graph rows", () => {
  const server = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  for (const source of [server, standalone]) {
    assert.match(source, /knowledgeGraphContainingFile/);
    assert.match(source, /knowledgeGraphPassageStatus/);
    assert.match(source, /knowledgeGraphUnverifiedPassage/);
    assert.doesNotMatch(source, /knowledgeGraphFileContext/);
    assert.doesNotMatch(source, /Whole file · no passage/);
    assert.match(source, /Selector unresolved/);
  }
});

test("both editions expose direct graph actions without nesting them in inspector controls", () => {
  const server = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  for (const source of [server, standalone]) {
    assert.match(source, /knowledgeGraphNodeGroup/);
    assert.match(source, /knowledgeGraphDirectAction/);
    assert.match(source, /View passage/);
    assert.match(source, /Open source ↗/);
  }
  assert.match(standalone, /\[data-graph-follow\]/);
});

test("both editions preserve grouped reading order, touch targets, and inspector focus at narrow width", () => {
  const server = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const serverCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  for (const source of [server, standalone]) {
    const evidence = source.indexOf("knowledgeGraphEvidence", source.indexOf("knowledgeGraphHead"));
    const subject = source.indexOf("knowledgeGraphSubject", evidence);
    const specification = source.indexOf("knowledgeGraphSpecification", subject);
    const implementation = source.indexOf("knowledgeGraphImplementation", specification);
    assert.ok(evidence < subject && subject < specification && specification < implementation);
    assert.match(source, /knowledgeGraphDirectAction/);
    assert.match(source, /knowledgeGraphInspector/);
    assert.match(source, /role="group" aria-label=/);
    assert.match(source, /Inspect relationship:/);
    assert.match(source, /Inspect .*kind/);
    assert.match(source, /Close evidence graph inspector/);
  }
  assert.match(serverCss, /\.knowledgeGraphLane \{ grid-template-columns: minmax\(0,1fr\); margin: 8px 6px;/);
  assert.match(standalone, /\.knowledgeGraphLane\{grid-template-columns:minmax\(0,1fr\);margin:8px 6px;/);
  assert.match(standalone, /role="group" aria-label="\$\{escapeHtml\(/);
  assert.doesNotMatch(standalone, /role="group" aria-label="\$\{esc\(/);
  assert.match(serverCss, /\.knowledgeGraphDirectAction, \.knowledgeGraphEdge[^}]*min-height: 40px;/);
  assert.match(standalone, /\.knowledgeGraphDirectAction,\.knowledgeGraphEdge[^}]*min-height:40px;/);
});

test("only whole-KO graph nodes carry the compact KO logo in both editions", () => {
  const server = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const serverCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  for (const source of [server, standalone]) {
    assert.match(source, /knowledgeGraphKoMark/);
    assert.match(source, /item\.kind\s*===?\s*"knowledge-object"/);
    assert.match(source, /aria-hidden/);
  }
  assert.match(serverCss, /\.knowledgeGraphKoMark\s*\{[^}]*background:\s*#1d1d1f;[^}]*color:\s*#fff/);
  assert.match(standalone, /\.knowledgeGraphKoMark\{[^}]*background:#1d1d1f;[^}]*color:#fff/);
});
