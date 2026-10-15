import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const generated = readFileSync(new URL("../app/generated-ko-data.ts", import.meta.url), "utf8");

test("server application code imports generated KO data instead of embedding it", () => {
  assert.match(page, /from "\.\/generated-ko-data"/);
  assert.doesNotMatch(page, /^const (?:EMBEDDED_ASSEMBLY|objectFileOverrides|objectBinaryOverrides|documentProjectionOverrides)\s*[:=]/m);
  assert.match(generated, /^const EMBEDDED_ASSEMBLY: EmbeddedAssembly \| null = /m);
  assert.match(generated, /^const objectFileOverrides: Record<string, string> = /m);
  assert.match(generated, /^const documentProjectionOverrides: Record<string, unknown> = /m);
  assert.ok(Buffer.byteLength(page) < Buffer.byteLength(generated) / 10);
});

test("KO updater publishes the generated server module and standalone together", () => {
  const updater = readFileSync(new URL("../scripts/update-embedded-kos.mjs", import.meta.url), "utf8");
  assert.match(updater, /generatedPath = join\(workspace, "app\/generated-ko-data\.ts"\)/);
  assert.match(updater, /staged: stagedGeneratedPath, target: generatedPath/);
  assert.match(updater, /staged: stagedStandalonePath, target: standalonePath/);
  assert.doesNotMatch(updater, /writeFileSync\(reactPath, react\)/);
});
