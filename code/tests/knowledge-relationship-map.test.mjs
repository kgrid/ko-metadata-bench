import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { buildKnowledgeViewModel, projectKnowledgeViewModel } from "../app/k-view-model.js";
import { buildKnowledgeRelationshipMap } from "../app/knowledge-relationship-map.js";

const embedded = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8").split("\n");
function metadataFor(id) {
  const line = embedded.find((value) => value.startsWith(`  "${id}/metadata.json":`));
  return JSON.parse(JSON.parse(line.slice(line.indexOf(":") + 1).trim().replace(/,$/, "")));
}
const mapFor = (metadata) => buildKnowledgeRelationshipMap(projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata));

test("Wagner's two sources point to the whole KO and not either element", () => {
  const map = mapFor(metadataFor(1));
  assert.equal(map.wholeKoSources.length, 2);
  assert.equal(map.branches.length, 0);
  assert.match(map.descriptor, /KO/i);
});

test("Regimen Burden has three distinct element branches, including code without declared evidence", () => {
  const map = mapFor(metadataFor(3));
  assert.equal(map.wholeKoSources.length, 0);
  assert.equal(map.branches.length, 3);
  assert.deepEqual(map.branches.map((branch) => branch.evidence.length), [2, 1, 0]);
  assert.deepEqual(map.branches.map((branch) => branch.implementationPassages.length), [1, 1, 1]);
  assert.equal(map.branches[2].specificationPassages.length, 0);
});

test("Treatment Decision and Margolis retain their distinct passage patterns", () => {
  const decision = mapFor(metadataFor(2));
  const margolis = mapFor(metadataFor(4));
  assert.deepEqual([decision.branches[0].evidence.length, decision.branches[0].specificationPassages.length, decision.branches[0].implementationPassages.length], [1, 1, 0]);
  assert.deepEqual([margolis.branches[0].evidence.length, margolis.branches[0].specificationPassages.length, margolis.branches[0].implementationPassages.length], [1, 1, 2]);
});

test("the assembly map declares no own basis or inherited evidence", () => {
  const line = embedded.find((value) => value.startsWith("const EMBEDDED_ASSEMBLY:"));
  const assembly = JSON.parse(line.slice(line.indexOf("= ") + 2).replace(/;$/, ""));
  const map = mapFor(assembly.metadata);
  assert.equal(map.wholeKoSources.length, 0);
  assert.equal(map.branches.length, 0);
  assert.equal(map.constituentEvidenceInherited, false);
});

test("standalone uses the identical relationship-map projection", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const block = html.split("/* KNOWLEDGE_RELATIONSHIP_MAP_START */")[1].split("/* KNOWLEDGE_RELATIONSHIP_MAP_END */")[0];
  const context = vm.createContext({});
  vm.runInContext(`${block}\nthis.project = buildKnowledgeRelationshipMap`, context);
  const model = projectKnowledgeViewModel(buildKnowledgeViewModel(metadataFor(3)), metadataFor(3));
  assert.deepEqual(JSON.parse(JSON.stringify(context.project(model))), buildKnowledgeRelationshipMap(model));
  assert.match(html, /renderKnowledgeRelationshipMap\(model\).*knowledge-card-body/s);
});
