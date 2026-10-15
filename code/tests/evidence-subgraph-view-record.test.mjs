import { readServerSourceSync } from "./server-source.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { buildKnowledgeViewModel, projectKnowledgeViewModel } from "../app/k-view-model.js";
import { buildEvidenceSubgraphViewRecord } from "../app/evidence-subgraph-view-record.js";

const page = readServerSourceSync();
const files = JSON.parse(page.slice(page.indexOf("const objectFileOverrides:") + "const objectFileOverrides: Record<string, string> = ".length, page.indexOf(";\nconst objectBinaryOverrides:")));
const statuses = JSON.parse(page.split("\n").find((line) => line.startsWith("const annotationDestinationOverrides:")).split(" = ")[1].replace(/;$/, ""));
const assemblyLine = page.split("\n").find((line) => line.startsWith("const EMBEDDED_ASSEMBLY:"));
const assembly = JSON.parse(assemblyLine.slice(assemblyLine.indexOf("= ") + 2).replace(/;$/, "")).metadata;
const fixture = (id) => {
  const metadata = id === 5 ? assembly : JSON.parse(files[`${id}/metadata.json`]);
  const model = projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata, statuses[id] ?? []);
  const readText = (file) => files[`${id}/${file}`] ?? null;
  const availableFile = (file) => typeof readText(file) === "string";
  return { metadata, model, readText, availableFile };
};
const recordFor = (id, build = buildEvidenceSubgraphViewRecord) => {
  const { metadata, model, readText, availableFile } = fixture(id);
  return build(model.evidenceSubgraph, model, metadata, readText, availableFile);
};

test("view records keep routes on the exact declaring subject in all five patterns", () => {
  const [wagner, decision, burden, margolis, assemblyRecord] = [1, 2, 3, 4, 5].map((id) => recordFor(id));
  assert.deepEqual(wagner.rows.map((row) => row.basis.length), [2, 0, 0]);
  assert.deepEqual(decision.rows.map((row) => [row.specificationRoutes.length, row.implementationRoutes.length]), [[0, 0], [1, 0]]);
  assert.deepEqual(burden.rows.map((row) => [row.specificationRoutes.length, row.implementationRoutes.length]), [[0, 0], [0, 1], [0, 1], [0, 1]]);
  assert.equal(burden.rows.at(-1).basis.length, 0);
  assert.equal(margolis.rows.at(-1).annotationRoutes.filter((route) => route.targets.some((target) => target.targetType === "specification-passage")).length, 1);
  assert.equal(margolis.rows.at(-1).annotationRoutes.filter((route) => route.targets.some((target) => target.targetType === "implementation-passage")).length, 2);
  for (const record of [decision, burden, margolis]) {
    for (const row of record.rows) {
      assert.ok(row.annotationRoutes.every((route) => route.declaringSubjectId === row.declaringSubject.sourceId && route.subjectOf.declaringSubjectId === row.declaringSubject.sourceId));
      assert.ok(row.annotationRoutes.every((route) => route.targets.every((target) => target.target.from === route.annotationKey)));
    }
  }
  assert.ok(assemblyRecord.rows.every((row) => !row.basis.length && !row.annotationRoutes.length));
  assert.ok(assemblyRecord.rows.every((row) => row.density === "empty"));
  assert.equal(wagner.rows[0].density, "sparse");
  assert.equal(margolis.rows.at(-1).density, "populated");
});

test("passages have source-derived glimpses and only verified, available follow actions", () => {
  const record = recordFor(4);
  const passage = Object.values(record.nodesByKey).find((node) => node.targetType === "implementation-passage");
  assert.equal(passage.containingFile, "src/prognosis.js");
  assert.equal(passage.displayFile, "prognosis.js");
  assert.equal(passage.verification.status, "resolved");
  assert.equal(passage.passageState, "verified");
  assert.ok(passage.glimpse.exact);
  assert.equal(passage.followAction.kind, "passage");
  const { metadata, model, availableFile } = fixture(4);
  const noSource = buildEvidenceSubgraphViewRecord(model.evidenceSubgraph, model, metadata, () => null, availableFile);
  assert.equal(noSource.nodesByKey[passage.key].glimpse, null);
  assert.equal(noSource.nodesByKey[passage.key].followAction, null);
  assert.equal(noSource.nodesByKey[passage.key].passageState, "unavailable");
  const unresolvedGraph = structuredClone(model.evidenceSubgraph);
  unresolvedGraph.nodes.find((node) => node.key === passage.key).verification = { status: "unresolved", reason: "selector did not match" };
  const unresolved = buildEvidenceSubgraphViewRecord(unresolvedGraph, model, metadata, (file) => files[`4/${file}`], availableFile);
  assert.equal(unresolved.nodesByKey[passage.key].verification.status, "unresolved");
  assert.equal(unresolved.nodesByKey[passage.key].followAction, null);
  assert.equal(unresolved.nodesByKey[passage.key].passageState, "unresolved");
});

test("whole-file references remain available as inspector context, not passage targets", () => {
  const wagner = recordFor(1);
  const decision = recordFor(2);
  assert.ok(wagner.rows[0].specificationFiles.length > 0);
  assert.equal(wagner.rows[0].specificationRoutes.length, 0);
  assert.ok(decision.rows[1].implementationFiles.some((file) => file.path === "src/decision.js"));
  assert.equal(decision.rows[1].implementationRoutes.length, 0);
  assert.equal(decision.rows[1].specificationRoutes.length, 1);
});

test("direct graph actions exist only for safe sources and verified exact passages", () => {
  const margolis = recordFor(4);
  const evidence = Object.values(margolis.nodesByKey).find((node) => node.kind === "evidential-resource" && node.followAction?.url?.endsWith("NIHMS1801579-supplement-1.pdf"));
  assert.equal(evidence.followAction.kind, "evidence");
  const passages = Object.values(margolis.nodesByKey).filter((node) => node.passageState === "verified");
  assert.equal(passages.length, 3);
  assert.ok(passages.every((node) => node.followAction?.kind === "passage" && node.glimpse?.exact));
  const { metadata, model, availableFile } = fixture(4);
  const failed = buildEvidenceSubgraphViewRecord(model.evidenceSubgraph, model, metadata, () => null, availableFile);
  assert.ok(Object.values(failed.nodesByKey).filter((node) => node.targetType).every((node) => node.followAction === null));
});

test("standalone embeds and uses the identical view-record rules", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const block = (name) => html.slice(html.indexOf(`/* ${name}_START */`), html.indexOf(`/* ${name}_END */`) + `/* ${name}_END */`.length);
  const context = vm.createContext({ URL });
  vm.runInContext([
    block("EVIDENCE_SUBGRAPH_LAYOUT"),
    block("EVIDENCE_PASSAGE_GLIMPSE"),
    block("KNOWLEDGE_PASSAGE_NAVIGATION"),
    block("EVIDENCE_SUBGRAPH_ACTIONS"),
    block("EVIDENCE_SUBGRAPH_VIEW_RECORD"),
    "globalThis.buildRecord = buildEvidenceSubgraphViewRecord;",
  ].join("\n"), context);
  assert.match(html, /const viewRecord=buildEvidenceSubgraphViewRecord\(/);
  for (const id of [1, 2, 3, 4, 5]) {
    assert.deepEqual(JSON.parse(JSON.stringify(recordFor(id, context.buildRecord))), recordFor(id));
  }
});
