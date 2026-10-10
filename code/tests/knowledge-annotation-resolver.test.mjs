import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolveKnowledgeAnnotations } from "../app/knowledge-annotation-resolver.js";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8").split("\n");
const embeddedMetadata = (id) => {
  const line = page.find((value) => value.startsWith(`  "${id}/metadata.json":`));
  return JSON.parse(JSON.parse(line.slice(line.indexOf(":") + 1).trim().replace(/,$/, "")));
};

test("basis declarations preserve their KO or element subject", () => {
  const records = [1, 2, 3, 4].map((id) => resolveKnowledgeAnnotations(embeddedMetadata(id)));
  assert.deepEqual(records.map((record) => record.basisLinks.length), [2, 1, 3, 1]);
  assert.ok(records[0].basisLinks.every((link) => link.declaredOn === "knowledge-object"));
  assert.ok(records.slice(1).every((record) => record.basisLinks.every((link) => link.declaredOn === "knowledge-element")));
  assert.equal(new Set(records[2].basisLinks.map((link) => link.subjectId)).size, 2);
});

test("annotations resolve named evidence, CKS, and code resources without joining their subjects", () => {
  const decision = resolveKnowledgeAnnotations(embeddedMetadata(2));
  assert.deepEqual(decision.annotations.map((link) => link.target?.kind), ["evidence", "specification"]);
  assert.equal(decision.annotations[1].target.filePath, "specs/UHMS_Figure_6_DFU_HBO2_Algorithm_CKS_Version_1_0.docx");
  assert.equal(decision.annotations[1].target.digest?.length, 64);
  assert.ok(decision.annotations[1].target.selector.exact);

  const burden = resolveKnowledgeAnnotations(embeddedMetadata(3));
  assert.deepEqual(burden.annotations.map((link) => link.target?.kind), ["implementation", "implementation", "implementation"]);
  assert.ok(burden.annotations.every((link) => link.bodyMatchesDeclaringSubject));
  assert.ok(burden.annotations.every((link) => link.bodyId === link.declaringSubjectId));
  assert.ok(burden.annotations.every((link) => link.target.digest?.length === 64 && link.target.selector.exact));
  assert.ok(burden.annotations.every((link) => !burden.basisLinks.some((basis) => basis.evidenceId === link.bodyId)));

  const prognostic = resolveKnowledgeAnnotations(embeddedMetadata(4));
  assert.deepEqual(prognostic.annotations.map((link) => link.target?.kind), ["evidence", "specification", "implementation", "implementation"]);
  assert.ok(prognostic.annotations.every((link) => link.resolution === "named-resource"));
});

test("unresolved targets and mismatched annotation bodies remain explicit", () => {
  const metadata = embeddedMetadata(2);
  const element = metadata["koio:hasKnowledge"][0];
  element["schema:subjectOf"].push({ id: "missing", type: "Annotation", body: "other-element", target: "unknown" });
  const last = resolveKnowledgeAnnotations(metadata).annotations.at(-1);
  assert.equal(last.resolution, "unresolved-target");
  assert.equal(last.target, null);
  assert.equal(last.bodyMatchesDeclaringSubject, false);
});

test("KA-owned links stay separate from constituent KO references", () => {
  const line = page.find((value) => value.startsWith("const EMBEDDED_ASSEMBLY:"));
  const assembly = JSON.parse(line.slice(line.indexOf("= ") + 2).replace(/;$/, ""));
  const resolved = resolveKnowledgeAnnotations(assembly.metadata);
  assert.deepEqual(resolved.basisLinks, []);
  assert.deepEqual(resolved.annotations, []);
  assert.equal(resolved.objectId, assembly.metadata["@id"]);
});

test("standalone edition embeds the same resolver and returns identical records", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const start = html.indexOf("/* KNOWLEDGE_ANNOTATION_RESOLVER_START */");
  const end = html.indexOf("/* KNOWLEDGE_ANNOTATION_RESOLVER_END */", start);
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({});
  vm.runInContext(`${html.slice(start, end)}; globalThis.resolve = resolveKnowledgeAnnotations;`, context);
  for (const id of [1, 2, 3, 4]) {
    const metadata = embeddedMetadata(id);
    assert.deepEqual(JSON.parse(JSON.stringify(context.resolve(metadata))), resolveKnowledgeAnnotations(metadata));
  }
});
