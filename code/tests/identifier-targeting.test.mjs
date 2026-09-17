import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { identifiersFromMetadataJson, resolveObjectIdByIdentifier } from "../app/knowledge-object-target.js";

test("extracts stable knowledge-object identifiers from metadata.json", () => {
  const source = JSON.stringify({ "dc:identifier": ["canonical-iri", "workshop-ko-4"] });
  assert.deepEqual(identifiersFromMetadataJson(source), ["canonical-iri", "workshop-ko-4"]);
});

test("resolves the enrichment target by identifier rather than numeric position", () => {
  const metadata = new Map([
    [1, JSON.stringify({ "dc:identifier": ["workshop-ko-2"] })],
    [2, JSON.stringify({ "dc:identifier": ["workshop-ko-4"] })],
    [3, JSON.stringify({ "dc:identifier": ["workshop-ko-1"] })],
    [4, JSON.stringify({ "dc:identifier": ["workshop-ko-3"] })],
  ]);
  assert.equal(resolveObjectIdByIdentifier([1, 2, 3, 4], (id) => metadata.get(id), "workshop-ko-4"), 2);
});

test("rejects missing or duplicate target identifiers", () => {
  assert.throws(() => resolveObjectIdByIdentifier([1], () => "{}", "workshop-ko-4"), /matched 0 embedded objects/);
  assert.throws(() => resolveObjectIdByIdentifier([1, 2], () => JSON.stringify({ "dc:identifier": "workshop-ko-4" }), "workshop-ko-4"), /matched 2 embedded objects/);
});

test("both SWA editions target enrichment by identifier, not embedded slot", async () => {
  const [page, standalone] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8"),
  ]);
  assert.match(page, /resolveObjectIdByIdentifier\(OBJECT_IDS/);
  assert.match(standalone, /resolveObjectIdByIdentifierStandalone\(objectIds/);
  for (const source of [page, standalone]) {
    assert.doesNotMatch(source, /(?:object|objectId|o)\s*[!=]==?\s*4\s*&&\s*(?:file|fileName|f)\s*===\s*["'](?:findability|reusability)\.metadata\.txt/);
    assert.doesNotMatch(source, /canonicalSeedValue\(4,\s*["'](?:findability|reusability)\.metadata\.txt/);
  }
});
