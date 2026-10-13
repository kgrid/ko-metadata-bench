import { readServerSourceSync } from "./server-source.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { addAssemblyToActiveObjects, createInitialActiveObjects, isAssemblyActive } from "../app/active-knowledge-objects.js";

const assembly = { metadata: { "schema:category": "Knowledge Assembly" }, generalView: { identifier: "https://example.org/ka" } };

test("the session starts with four KOs and loads one distinct KA", () => {
  const initial = createInitialActiveObjects([1, 2, 3, 4]);
  assert.deepEqual(initial, [1, 2, 3, 4].map((objectId) => ({ kind: "knowledge-object", objectId })));
  assert.equal(isAssemblyActive(initial), false);
  const loaded = addAssemblyToActiveObjects(initial, assembly);
  assert.equal(initial.length, 4);
  assert.equal(loaded.length, 5);
  assert.deepEqual(loaded[4], { kind: "knowledge-assembly", identifier: "https://example.org/ka" });
  assert.equal(isAssemblyActive(loaded), true);
  assert.strictEqual(addAssemblyToActiveObjects(loaded, assembly), loaded);
});

test("loading requires the prepared embedded KA", () => {
  const initial = createInitialActiveObjects([1, 2, 3, 4]);
  assert.throws(() => addAssemblyToActiveObjects(initial, null), /prepared Knowledge Assembly/);
  assert.throws(() => addAssemblyToActiveObjects(initial, { ...assembly, generalView: {} }), /prepared Knowledge Assembly/);
  assert.throws(() => addAssemblyToActiveObjects(initial, { ...assembly, metadata: { "schema:category": "Other" } }), /prepared Knowledge Assembly/);
});

test("standalone shares the same active-object decisions and rejects invalid assemblies", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const source = readFileSync(new URL("../app/active-knowledge-objects.js", import.meta.url), "utf8")
    .replace(/^export /gm, "").trim();
  assert.ok(html.includes(source));
  const start = html.indexOf("/* ACTIVE_OBJECT_RULE_START */");
  const end = html.indexOf("/* ACTIVE_OBJECT_RULE_END */", start);
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({});
  vm.runInContext(`${html.slice(start, end)}; globalThis.run = (ids, candidate) => { const initial = createInitialActiveObjects(ids); const loaded = addAssemblyToActiveObjects(initial, candidate); return { initial, loaded, active: isAssemblyActive(loaded), duplicate: addAssemblyToActiveObjects(loaded, candidate).length }; };`, context);
  const actual = JSON.parse(JSON.stringify(context.run([1, 2, 3, 4], assembly)));
  const initial = createInitialActiveObjects([1, 2, 3, 4]);
  const loaded = addAssemblyToActiveObjects(initial, assembly);
  assert.deepEqual(actual, { initial, loaded, active: isAssemblyActive(loaded), duplicate: addAssemblyToActiveObjects(loaded, assembly).length });
  assert.throws(() => context.run([1, 2, 3, 4], null), /prepared Knowledge Assembly/);
});

test("both editions keep the active list in session memory", () => {
  const react = readServerSourceSync();
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(react, /useState\(\(\) => createInitialActiveObjects\(OBJECT_IDS\)\)/);
  assert.match(react, /setActiveObjects\(\(current\) => addAssemblyToActiveObjects\(current, EMBEDDED_ASSEMBLY\)\)/);
  assert.match(standalone, /let activeObjects=createInitialActiveObjects\(objectIds\)/);
  assert.match(standalone, /activeObjects=addAssemblyToActiveObjects\(activeObjects,embeddedAssembly\)/);
  assert.doesNotMatch(react, /localStorage.*activeObjects|sessionStorage.*activeObjects/);
  assert.doesNotMatch(standalone, /localStorage.*activeObjects|sessionStorage.*activeObjects/);
});

test("a fresh page initialization restores the four-KO state", () => {
  const initialIds = [1, 2, 3, 4];
  const loaded = addAssemblyToActiveObjects(createInitialActiveObjects(initialIds), assembly);
  assert.equal(loaded.length, 5);
  const afterReload = createInitialActiveObjects(initialIds);
  assert.deepEqual(afterReload.map((object) => object.objectId), initialIds);
  assert.equal(isAssemblyActive(afterReload), false);
  assert.notStrictEqual(afterReload, loaded);
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(standalone, /const objectIds=Array\.from\(\{length:embeddedObjectCount\}/);
  assert.match(standalone, /let activeObjects=createInitialActiveObjects\(objectIds\)/);
});

test("both editions project the loaded assembly fifth in every general view", () => {
  const react = readServerSourceSync();
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(react, /activeObjectIds: ObjectId\[\] = useMemo\(\(\) => activeObjects\.map/);
  for (const projection of ["koGrid", "findabilityGrid", "accessibilityGrid", "interoperabilityGrid", "reusabilityGrid", "metadataRigGrid"]) {
    assert.match(react, new RegExp(`className="${projection}"[^>]*>\\s*\\{activeObjectIds\\.map`));
  }
  assert.match(standalone, /objectIds\.push\(assemblyVirtualId\)/);
  assert.match(standalone, /const embeddedResourceIds=embeddedAssembly\?\[\.\.\.objectIds,assemblyVirtualId\]:objectIds/);
  assert.match(standalone, /objectDisplayNames\.push\(embeddedAssembly\.generalView/);
  assert.match(react, /FINDABILITY_ENRICHMENT_TARGET_IDENTIFIER/);
  assert.match(standalone, /enrichmentTargetIdentifier="workshop-ko-4"/);
});
