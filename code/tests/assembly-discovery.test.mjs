import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partitionKnowledgePackages, prepareAssemblyGeneralView } from "../app/assembly-discovery.js";
import { orderWorkshopObjects } from "../app/workshop-ordering.js";
import { discoverRunnerAvailability } from "../app/runner-discovery.js";
import { loadInteroperabilityExerciseKit } from "../app/interoperability-exercise.js";

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

test("KA general-view preparation uses its own identifier and nested resources", () => {
  const identifier = "https://example.org/assembly";
  const files = ["metadata.json", "aux/existence.metadata.txt", "aux/findability.metadata.txt", "aux/access.metadata.txt", "aux/interoperability.metadata.txt", "aux/reusability.metadata.txt", "art/graphic.abstract.webp", "art/graphic.logic.webp", "src/orchestrator.js"];
  const metadata = { "@id": identifier, "dc:identifier": ["local-ka", identifier], "schema:category": "Knowledge Assembly" };
  const readText = (file) => file.endsWith("findability.metadata.txt") ? `@prefix schema: <https://schema.org/> . <${identifier}> schema:name "Example Assembly" .` : "";
  const record = prepareAssemblyGeneralView({ folderName: "renamed-folder", metadata, files, readText });
  assert.equal(record.identifier, identifier);
  assert.equal(record.displayName, "Example Assembly");
  assert.equal(record.metadataPaths["access.metadata.txt"], "aux/access.metadata.txt");
  assert.equal(record.graphicPaths["graphic.logic.webp"], "art/graphic.logic.webp");
  assert.ok(record.files.includes("src/orchestrator.js"));
  assert.throws(() => prepareAssemblyGeneralView({ folderName: "bad", metadata: { ...metadata, "schema:category": "Other" }, files, readText }), /schema:category/);
  assert.throws(() => prepareAssemblyGeneralView({ folderName: "bad", metadata: { ...metadata, "dc:identifier": ["local-ka"] }, files, readText }), /canonical HTTP/);
  assert.throws(() => prepareAssemblyGeneralView({ folderName: "bad", metadata, files: files.filter((file) => !file.endsWith("access.metadata.txt")), readText }), /access\.metadata\.txt/);
});

test("both editions retain a dedicated assembly slot and availability control", () => {
  const react = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(react, /const EMBEDDED_ASSEMBLY: EmbeddedAssembly \| null = /);
  assert.match(standalone, /const embeddedAssembly=/);
  assert.match(react, /disabled=\{!EMBEDDED_ASSEMBLY\}/);
  assert.match(standalone, /knowledgeAssemblyButton\.disabled=!embeddedAssembly/);
});

test("both editions start with four ordinary KOs and keep the embedded KA separate", () => {
  const react = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const reactAssembly = JSON.parse(react.match(/^const EMBEDDED_ASSEMBLY: EmbeddedAssembly \| null = (\{.*\});/m)?.[1] ?? "null");
  const standaloneAssembly = JSON.parse(standalone.match(/^const embeddedAssembly=(\{.*\});/m)?.[1] ?? "null");
  assert.equal(reactAssembly?.metadata?.["schema:category"], "Knowledge Assembly");
  assert.deepEqual(standaloneAssembly, reactAssembly);
  assert.equal(reactAssembly.generalView.identifier, reactAssembly.metadata["@id"]);
  assert.equal(reactAssembly.generalView.metadataPaths["access.metadata.txt"], "auxiliary/aux-extra-metadata/access.metadata.txt");
  assert.equal(reactAssembly.generalView.graphicPaths["graphic.abstract.webp"], "auxiliary/aux-documentation/graphic.abstract.webp");
  assert.equal(reactAssembly.generalView.graphicPaths["graphic.logic.webp"], "auxiliary/aux-documentation/graphic.logic.webp");
  assert.ok(reactAssembly.generalView.files.includes("src/orchestrator.js"));
  assert.match(react, /const EMBEDDED_OBJECT_COUNT = Math\.min\(MAX_OBJECT_COUNT, Math\.max\(MIN_OBJECT_COUNT, 4\)\)/);
  assert.match(standalone, /const minObjectCount=1,maxObjectCount=10,embeddedObjectCount=Math\.min\(maxObjectCount,Math\.max\(minObjectCount,4\)\)/);
  assert.match(react, /useState<"files" \| "objects" \| "assembly">\("objects"\)/);
  assert.match(standalone, /openKnowledgeObjects\(\);updateHeader\(\)/);
  assert.match(react, /activeObjectIds\.map\(\(id\) => <KnowledgeObjectShade/);
  assert.match(standalone, /const objectIds=Array\.from\(\{length:embeddedObjectCount\}/);
  assert.match(react, /<article className="assemblyObjectBar">.*Orchestration<\/button><\/article>/);
  assert.match(standalone, /class="assembly-object-bar".*Orchestration<\/button>/);
});

test("both editions expose only the KA's supplied graphics, metadata, and exercise capabilities", () => {
  const react = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const reactAssembly = JSON.parse(react.match(/^const EMBEDDED_ASSEMBLY: EmbeddedAssembly \| null = (\{.*\});/m)?.[1] ?? "null");
  const standaloneAssembly = JSON.parse(standalone.match(/^const embeddedAssembly=(\{.*\});/m)?.[1] ?? "null");
  assert.deepEqual(standaloneAssembly, reactAssembly);
  const assembly = reactAssembly;
  const { files, metadataPaths, graphicPaths } = assembly.generalView;
  for (const path of Object.values(metadataPaths)) {
    assert.ok(files.includes(path), `${path} is present in the KA`);
    assert.ok(assembly.textFiles[path]?.trim(), `${path} has embedded content`);
  }
  for (const path of Object.values(graphicPaths)) {
    assert.ok(files.includes(path), `${path} is present in the KA`);
    const bytes = Buffer.from(assembly.binaryFiles[path], "base64");
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  }
  const readText = (path) => assembly.textFiles[path] ?? null;
  const runner = discoverRunnerAvailability({ files, readText });
  assert.equal(runner.available, false);
  assert.match(runner.validationError, /No browser Runner is supplied/);
  assert.deepEqual(loadInteroperabilityExerciseKit({ files, readText, target: null }), { status: "absent" });
  assert.match(react.slice(react.indexOf("function KnowledgeObjectShade("), react.indexOf("function FindabilityGuidedEditor(")), /className="koShadeGraphic koShadeRun" disabled=\{!runner\?\.available\}/);
  assert.match(standalone.slice(standalone.indexOf("function renderKoShade("), standalone.indexOf("function renderKnowledgeObjects(")), /runner\?\.available\?"":" disabled"/);
});
