import { readServerSourceSync } from "./server-source.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { buildKnowledgeViewModel, projectKnowledgeViewModel } from "../app/k-view-model.js";
import { planEvidenceSubgraphActions } from "../app/evidence-subgraph-actions.js";

const page = readServerSourceSync().split("\n");
const metadataFor = (id) => {
  const line = page.find((value) => value.startsWith(`  "${id}/metadata.json":`));
  return JSON.parse(JSON.parse(line.slice(line.indexOf(":") + 1).trim().replace(/,$/, "")));
};
const modelFor = (metadata, statuses = []) => projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata, statuses);
const nodeSelection = (node) => ({ kind: "node", key: node.key });
const available = () => true;

test("selected evidence uses its declared source, not a convenient identifier URL", () => {
  const metadata = metadataFor(4), model = modelFor(metadata), graph = model.evidenceSubgraph;
  const part = graph.nodes.find((node) => node.kind === "evidential-resource" && node.parentSourceId);
  const plan = planEvidenceSubgraphActions(graph, model, metadata, nodeSelection(part), available);
  assert.equal(plan.actions[0].label, "Open evidence source");
  assert.match(plan.actions[0].url, /NIHMS1801579-supplement-1\.pdf$/);
  const basisIndex = graph.relationships.findIndex((edge) => edge.kind === "evidential-basis");
  assert.equal(planEvidenceSubgraphActions(graph, model, metadata, { kind: "edge", index: basisIndex }, available).actions[0].url, plan.actions[0].url);
});

test("unsafe or absent source destinations do not become navigation actions", () => {
  const metadata = { "@id": "https://example.org/ko", "dc:source": [{ "@id": "javascript:alert(1)" }] };
  const graph = { nodes: [{ key: "evidential-resource:javascript:alert(1)", kind: "evidential-resource", sourceId: "javascript:alert(1)" }], relationships: [] };
  const plan = planEvidenceSubgraphActions(graph, {}, metadata, nodeSelection(graph.nodes[0]), available);
  assert.deepEqual(plan.actions, []);
  assert.match(plan.notice, /No safe HTTP or HTTPS/);
});

test("knowledge element offers whole-file context as distinct actions", () => {
  const metadata = metadataFor(4), model = modelFor(metadata), graph = model.evidenceSubgraph;
  const element = graph.nodes.find((node) => node.kind === "knowledge-element");
  const actions = planEvidenceSubgraphActions(graph, model, metadata, nodeSelection(element), available).actions;
  assert.ok(actions.some((action) => action.label === "View Specification" && action.kind === "specification"));
  assert.ok(actions.some((action) => action.label === "View Implementation" && action.file === "src/prognosis.js"));
  assert.ok(!actions.some((action) => action.kind === "passage"));
});

test("only verified and available exact targets offer Follow passage", () => {
  const metadata = metadataFor(4), initial = modelFor(metadata), initialNode = initial.evidenceSubgraph.nodes.find((node) => node.kind === "implementation-passage");
  const unresolved = planEvidenceSubgraphActions(initial.evidenceSubgraph, initial, metadata, nodeSelection(initialNode), available);
  assert.equal(unresolved.actions.length, 0);
  assert.match(unresolved.notice, /No whole-file substitute/);
  const annotation = initial.evidenceSubgraph.nodes.find((node) => node.kind === "annotation" && node.targetId === initialNode.sourceId);
  const model = modelFor(metadata, [{ annotationId: annotation.sourceId, targetId: initialNode.sourceId, status: "resolved", filePath: "src/prognosis.js" }]);
  const target = model.evidenceSubgraph.nodes.find((node) => node.key === initialNode.key);
  const plan = planEvidenceSubgraphActions(model.evidenceSubgraph, model, metadata, nodeSelection(target), available);
  assert.equal(plan.actions[0].label, "Follow passage");
  assert.equal(plan.actions[0].selector.exact, target.selector.exact);
  assert.equal(planEvidenceSubgraphActions(model.evidenceSubgraph, model, metadata, nodeSelection(target), () => false).actions.length, 0);
});

test("standalone embeds the same action-planning rules", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const start = html.indexOf("/* EVIDENCE_SUBGRAPH_ACTIONS_START */");
  const end = html.indexOf("/* EVIDENCE_SUBGRAPH_ACTIONS_END */", start);
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({ safeEvidenceUrl: (value) => { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; } } });
  vm.runInContext(`${html.slice(start, end)};globalThis.plan=planEvidenceSubgraphActions;`, context);
  const metadata = metadataFor(4), model = modelFor(metadata), node = model.evidenceSubgraph.nodes.find((item) => item.kind === "evidential-resource" && item.parentSourceId);
  const expected = planEvidenceSubgraphActions(model.evidenceSubgraph, model, metadata, nodeSelection(node), available);
  assert.deepEqual(JSON.parse(JSON.stringify(context.plan(model.evidenceSubgraph, model, metadata, nodeSelection(node), available))), expected);
});
