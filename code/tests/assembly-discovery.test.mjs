import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partitionKnowledgePackages } from "../app/assembly-discovery.js";
import { orderWorkshopObjects } from "../app/workshop-ordering.js";

function candidate(folderName, category, number) {
  const metadata = category === undefined ? {} : { "schema:category": category };
  const findability = number ? `@prefix schema: <https://schema.org/> .\n<urn:${folderName}> schema:identifier "workshop-ko-${number}" .` : null;
  const files = ["metadata.json", ...(findability ? ["findability.metadata.txt"] : [])];
  return {
    folderName,
    files,
    readText: (file) => file === "metadata.json" ? JSON.stringify(metadata) : findability,
  };
}

test("one declared assembly is separated before KO workshop ordering", () => {
  const ko2 = candidate("second", undefined, 2);
  const assembly = candidate("assembly-without-findability", "Knowledge Assembly");
  const ko1 = candidate("first", "Other Category", 1);
  const partition = partitionKnowledgePackages([ko2, assembly, ko1]);
  assert.equal(partition.knowledgeAssembly.folderName, assembly.folderName);
  assert.deepEqual(orderWorkshopObjects(partition.knowledgeObjects).map((item) => item.folderName), ["first", "second"]);
});

test("no assembly leaves ordinary KO loading unchanged", () => {
  const ko = candidate("ordinary", undefined, 1);
  assert.deepEqual(partitionKnowledgePackages([ko]), { knowledgeObjects: [ko], knowledgeAssembly: null });
});

test("only the exact declared category selects an assembly", () => {
  const others = [candidate("lowercase", "knowledge assembly", 1), candidate("near", "Knowledge Assemblies", 2)];
  assert.deepEqual(partitionKnowledgePackages(others).knowledgeObjects, others);
});

test("more than one declared assembly fails instead of selecting one", () => {
  assert.throws(() => partitionKnowledgePackages([
    candidate("assembly-a", "Knowledge Assembly"),
    candidate("assembly-b", "Knowledge Assembly"),
  ]), /Only one Knowledge Assembly/);
});

test("both editions retain a dedicated assembly slot and availability control", () => {
  const react = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(react, /const EMBEDDED_ASSEMBLY: EmbeddedAssembly \| null = /);
  assert.match(standalone, /const embeddedAssembly=/);
  assert.match(react, /disabled=\{!EMBEDDED_ASSEMBLY\}/);
  assert.match(standalone, /knowledgeAssemblyButton\.disabled=!embeddedAssembly/);
});
