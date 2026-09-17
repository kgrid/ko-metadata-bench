import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { discoverResourceMap } from "../app/resource-discovery.js";

const existence = `@prefix koer: <https://example.org/koer/> .
@prefix dcterms: <http://purl.org/dc/terms/> .

<#findability>
  a koer:MetadataComponent ;
  koer:filePath "auxiliary/metadata/findability.metadata.txt" ;
  dcterms:type "findability" .

<#core>
  a koer:MetadataComponent ;
  koer:filePath "metadata.json" ;
  dcterms:type "core" .`;

test("uses existence declarations before filename fallback", () => {
  const sources = { "auxiliary/metadata/existence.metadata.txt": existence, "auxiliary/metadata/findability.metadata.txt": "declared", "other/findability.metadata.txt": "duplicate", "metadata.json": "{}" };
  const discovery = discoverResourceMap({ files: Object.keys(sources), readText: (file) => sources[file] });
  assert.equal(discovery.resolve("findability.metadata.txt"), "auxiliary/metadata/findability.metadata.txt");
  assert.equal(discovery.resolve("metadata.json"), "metadata.json");
});

test("supports old root-oriented KOs and unique nested fallback", () => {
  const old = discoverResourceMap({ files: ["metadata.json", "findability.metadata.txt", "runner/runner.manifest.json"], readText: () => "" });
  assert.equal(old.resolve("findability.metadata.txt"), "findability.metadata.txt");
  const nested = discoverResourceMap({ files: ["metadata.json", "auxiliary/aux-runner/runner.manifest.json"], readText: () => "" });
  assert.equal(nested.resolve("runner/runner.manifest.json"), "auxiliary/aux-runner/runner.manifest.json");
});

test("does not guess when fallback basenames are ambiguous", () => {
  const discovery = discoverResourceMap({ files: ["a/runner.manifest.json", "b/runner.manifest.json"], readText: () => "" });
  assert.equal(discovery.resolve("runner/runner.manifest.json"), null);
});

test("the standalone edition carries the same discovery policy", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  for (const marker of ["discoverResourceMapStandalone", "existencePath", "declaredByType", "resolveObjectResource"]) {
    assert.ok(standalone.includes(marker), `standalone discovery should include ${marker}`);
  }
});
