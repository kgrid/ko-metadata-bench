import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolveKnowledgeAnnotations } from "../app/knowledge-annotation-resolver.js";
import { evidenceActionUrl, markVerifiedPassage, safeEvidenceUrl } from "../app/passage-navigation.js";

const embedded = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8").split("\n");
function metadataFor(id) {
  const line = embedded.find((value) => value.startsWith(`  "${id}/metadata.json":`));
  return JSON.parse(JSON.parse(line.slice(line.indexOf(":") + 1).trim().replace(/,$/, "")));
}

test("evidence actions use declared publication URLs and reject unsafe schemes", () => {
  assert.equal(safeEvidenceUrl("javascript:alert(1)"), null);
  assert.equal(safeEvidenceUrl("https://user:secret@example.org/paper"), null);
  assert.equal(safeEvidenceUrl("https://example.org/paper"), "https://example.org/paper");
  const expected = {
    1: ["https://doi.org/10.1177/107110078100200202"],
    2: ["https://uhms.org/images/CPG/UHM_42-3_CPG_for_DFU.pdf"],
    3: ["https://doi.org/10.2337/dc09-1754"],
    4: ["https://pmc.ncbi.nlm.nih.gov/articles/instance/9246994/bin/NIHMS1801579-supplement-1.pdf"],
  };
  for (const id of [1, 2, 3, 4]) {
    const links = resolveKnowledgeAnnotations(metadataFor(id)).basisLinks;
    assert.equal(evidenceActionUrl({ basisLinks: links }, links[0].evidenceId), expected[id][0]);
  }
});

function fakeRoot(parts) {
  const root = { nodes: [], ownerDocument: null };
  const doc = {
    createTreeWalker: () => { let index = 0; return { nextNode: () => root.nodes[index++] ?? null }; },
    createElement: () => ({ className: "", textContent: "", scrollIntoView() { root.scrolled = this; } }),
    createTextNode: (text) => ({ textContent: text }),
  };
  root.ownerDocument = doc;
  root.nodes = parts.map((text) => ({ textContent: text, replaceWith(...nodes) { const at = root.nodes.indexOf(this); root.nodes.splice(at, 1, ...nodes); } }));
  return root;
}

test("a unique passage spanning rendered text nodes is highlighted and scrolled into view", () => {
  const root = fakeRoot(["Before Alpha ", "Beta", " Gamma after"]);
  const result = markVerifiedPassage(root, { exact: "Alpha\nBeta Gamma" });
  assert.deepEqual(result, { ok: true, reason: null, highlightedNodes: 3 });
  assert.equal(root.nodes.filter((node) => node.className === "knowledgePassageHighlight").length, 3);
  assert.equal(root.scrolled?.textContent, "Alpha");
});

test("missing and ambiguous rendered passages do not receive a false precise highlight", () => {
  const missing = fakeRoot(["Another passage"]);
  assert.match(markVerifiedPassage(missing, { exact: "Target passage" }).reason, /not found/);
  assert.equal(missing.nodes.filter((node) => node.className).length, 0);
  const repeated = fakeRoot(["Target passage. Target passage."]);
  assert.match(markVerifiedPassage(repeated, { exact: "Target passage." }).reason, /2 locations/);
  assert.equal(repeated.nodes.filter((node) => node.className).length, 0);
});

test("both embedded CKS viewers contain one complete selected passage", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const start = page.indexOf("const documentProjectionOverrides:");
  const end = page.indexOf("const base64ToBytes", start);
  const projections = JSON.parse(page.slice(page.indexOf("= ", start) + 2, end).trim().replace(/;$/, ""));
  for (const id of [2, 4]) {
    const annotation = resolveKnowledgeAnnotations(metadataFor(id)).annotations.find((item) => item.target?.kind === "specification");
    const html = projections[`${id}/${annotation.target.filePath}`].sanitizedHtml;
    const visibleText = html.replace(/<[^>]*>/g, " ").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ");
    const exact = annotation.target.selector.exact.replace(/\s+/g, " ");
    assert.equal(visibleText.split(exact).length - 1, 1, `KO ${id} CKS projection has one exact passage`);
  }
});

test("standalone embeds the same safe source and passage-navigation rules", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const block = html.split("/* KNOWLEDGE_PASSAGE_NAVIGATION_START */")[1].split("/* KNOWLEDGE_PASSAGE_NAVIGATION_END */")[0];
  const context = vm.createContext({ URL });
  vm.runInContext(`${block}\nthis.safe = evidenceActionUrl`, context);
  const links = resolveKnowledgeAnnotations(metadataFor(4)).basisLinks;
  assert.equal(context.safe({ basisLinks: links }, links[0].evidenceId), evidenceActionUrl({ basisLinks: links }, links[0].evidenceId));
});
