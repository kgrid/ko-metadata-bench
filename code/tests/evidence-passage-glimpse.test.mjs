import { readServerSourceSync } from "./server-source.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { evidencePassageGlimpse } from "../app/evidence-passage-glimpse.js";
import { buildKnowledgeViewModel, projectKnowledgeViewModel } from "../app/k-view-model.js";

const page = readServerSourceSync();
const lines = page.split("\n");
const files = JSON.parse(page.slice(page.indexOf("const objectFileOverrides:") + "const objectFileOverrides: Record<string, string> = ".length, page.indexOf(";\nconst objectBinaryOverrides:")));
const statuses = JSON.parse(lines.find((line) => line.startsWith("const annotationDestinationOverrides:" )).split(" = ")[1].replace(/;$/, ""));
const metadataFor = (id) => JSON.parse(files[`${id}/metadata.json`]);

test("every resolved embedded CKS and code passage yields a source-derived highlighted glimpse", () => {
  for (const id of [2, 3, 4]) {
    const metadata = metadataFor(id);
    const graph = projectKnowledgeViewModel(buildKnowledgeViewModel(metadata), metadata, statuses[id]).evidenceSubgraph;
    const passages = graph.nodes.filter((node) => node.kind.endsWith("-passage"));
    assert.ok(passages.length);
    for (const passage of passages) {
      const source = files[`${id}/${passage.parentFile}`];
      const glimpse = evidencePassageGlimpse(passage, (file) => files[`${id}/${file}`]);
      assert.ok(glimpse, `${id}: ${passage.label}`);
      assert.equal(glimpse.filePath, passage.parentFile);
      assert.ok(source.includes(passage.selector.exact));
      assert.equal(glimpse.exact, passage.selector.exact.slice(0, 180));
      assert.ok(glimpse.exact.length <= 180);
    }
  }
});

test("unverified, missing, or ambiguous sources never produce a passage highlight", () => {
  const passage = { kind: "implementation-passage", parentFile: "code.js", selector: { exact: "specific()" }, verification: { status: "resolved" } };
  assert.equal(evidencePassageGlimpse({ ...passage, verification: { status: "unresolved" } }, () => "specific()"), null);
  assert.equal(evidencePassageGlimpse(passage, () => null), null);
  assert.equal(evidencePassageGlimpse(passage, () => "specific() specific()"), null);
  assert.equal(evidencePassageGlimpse({ ...passage, kind: "implementation-file" }, () => "specific()"), null);
  assert.equal(evidencePassageGlimpse({ ...passage, selector: { exact: "specific()", prefix: "not-here" } }, () => "specific()"), null);
});

test("standalone embeds the same passage-glimpse rules", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const start = html.indexOf("/* EVIDENCE_PASSAGE_GLIMPSE_START */");
  const end = html.indexOf("/* EVIDENCE_PASSAGE_GLIMPSE_END */", start);
  assert.ok(start > 0 && end > start);
  const context = vm.createContext({});
  vm.runInContext(`${html.slice(start, end)}; globalThis.run = evidencePassageGlimpse;`, context);
  const passage = { kind: "specification-passage", parentFile: "spec.docx", selector: { exact: "verified passage" }, verification: { status: "resolved" } };
  const source = "Before the verified passage comes context.";
  assert.deepEqual(JSON.parse(JSON.stringify(context.run(passage, () => source))), evidencePassageGlimpse(passage, () => source));
});
