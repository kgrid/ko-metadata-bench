import assert from "node:assert/strict";
import test from "node:test";
import { inspectWorkshopOrder, orderWorkshopObjects } from "../app/workshop-ordering.js";

const existence = (path) => `@prefix koer: <https://example.org/koer/> .
@prefix dcterms: <http://purl.org/dc/terms/> .

<#findability>
  a koer:MetadataComponent ;
  koer:filePath "${path}" ;
  dcterms:type "findability" .`;
const source = (number) => `@prefix schema: <https://schema.org/> .\n<urn:ko> schema:identifier "workshop-ko-${number}" .`;
const fixture = (folderName, number, nested = false) => {
  const findabilityPath = nested ? "auxiliary/metadata/findability.metadata.txt" : "findability.metadata.txt";
  const sources = { [findabilityPath]: source(number), ...(nested ? { "auxiliary/metadata/existence.metadata.txt": existence(findabilityPath) } : {}) };
  return { folderName, files: Object.keys(sources), readText: (file) => sources[file] };
};

test("orders old and nested KOs by discovered workshop identifier", () => {
  const ordered = orderWorkshopObjects([fixture("third", 3), fixture("first", 1, true), fixture("second", 2)]);
  assert.deepEqual(ordered.map((item) => item.folderName), ["first", "second", "third"]);
  assert.equal(ordered[0].workshop.findabilityPath, "auxiliary/metadata/findability.metadata.txt");
});

test("reports inadequate findability metadata instead of silently sorting", () => {
  const missing = inspectWorkshopOrder({ folderName: "missing", files: ["metadata.json"], readText: () => "{}" });
  assert.equal(missing.valid, false);
  assert.match(missing.diagnostic, /could not be discovered/);
  const sources = { "findability.metadata.txt": '@prefix schema: <https://schema.org/> .\n<urn:ko> schema:name "No ordering identifier" .' };
  assert.throws(() => orderWorkshopObjects([{ folderName: "malformed", files: Object.keys(sources), readText: (file) => sources[file] }]), /does not declare/);
});

test("rejects duplicate workshop numbers", () => {
  assert.throws(() => orderWorkshopObjects([fixture("one", 1), fixture("also-one", 1, true)]), /Duplicate workshop identifier/);
});
