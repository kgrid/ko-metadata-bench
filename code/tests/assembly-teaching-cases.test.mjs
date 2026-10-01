import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { loadAssemblyTeachingCases, projectAssemblyCaseInputs, projectAssemblyKoContributions, projectAssemblyKaDecisions, projectAssemblySynthesisMatrix } from "../app/assembly-teaching-cases.js";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const embedded = JSON.parse(page.match(/const EMBEDDED_ASSEMBLY: EmbeddedAssembly \| null = (\{.*\});/)?.[1] ?? "null");

test("all five embedded cases provide requests and semantic traces, not expected answers", () => {
  const loaded = loadAssemblyTeachingCases(embedded);
  assert.equal(loaded.error, null);
  assert.equal(loaded.cases.length, 5);
  for (const item of loaded.cases) {
    assert.ok(item.request.request_id);
    assert.equal(item.semanticTrace.trace_version, 1);
    assert.equal(Object.hasOwn(item, "expected"), false);
    assert.equal(JSON.stringify(item).includes('"expected"'), false);
  }
});

test("a missing or malformed case prevents partial presentation", () => {
  const path = "auxiliary/aux-teaching/cases/case-3.json";
  const missing = { ...embedded, textFiles: { ...embedded.textFiles } };
  delete missing.textFiles[path];
  assert.deepEqual(loadAssemblyTeachingCases(missing), { cases: [], error: "Case 3 is missing from the embedded assembly." });
  const malformed = { ...embedded, textFiles: { ...embedded.textFiles, [path]: "{" } };
  assert.match(loadAssemblyTeachingCases(malformed).error, /Case 3 cannot be read/);
  const incomplete = { ...embedded, textFiles: { ...embedded.textFiles, [path]: JSON.stringify({ id: "case-3", title: "Incomplete" }) } };
  assert.match(loadAssemblyTeachingCases(incomplete).error, /Case 3 is incomplete or malformed/);
});

test("both editions expose a ready state and an in-view error state", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(page, /loadAssemblyTeachingCases\(EMBEDDED_ASSEMBLY\)/);
  assert.match(page, /className="assemblyWorkspaceError" role="alert"/);
  assert.match(page, /useState\("case-1"\)/);
  assert.match(page, /className="assemblyWorkspace"/);
  assert.match(standalone, /loadAssemblyTeachingCases\(embeddedAssembly\)/);
  assert.ok(standalone.includes('class=\"assembly-workspace-error\" role=\"alert\"'));
  assert.match(standalone, /function openKnowledgeAssembly\(\)/);
  assert.match(standalone, /class="assembly-workspace"/);
});

test("case selection uses neutral labels and updates only the selected pane", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const reactWorkspace = page.split("function KnowledgeAssemblyWorkspace() {")[1].split("export default function Home()")[0];
  const standaloneWorkspace = standalone.split("function renderAssemblyCaseDetail(")[1].split("for(const control of [knowledgeObjectsButton")[0];
  assert.match(reactWorkspace, /setSelectedCaseId\(item.id\)/);
  assert.match(reactWorkspace, /Case \{index \+ 1\}/);
  assert.doesNotMatch(reactWorkspace, /item\.title|selectedCase\.title/);
  assert.match(standaloneWorkspace, /Case \$\{index\+1\}/);
  assert.match(standaloneWorkspace, /\.outerHTML=renderAssemblyCaseDetail\(next,loaded\.cases\)/);
  assert.doesNotMatch(standaloneWorkspace, /item\.title|selected\.title/);
  assert.match(reactWorkspace, /aria-label=\{`Case \$\{selectedIndex\} details`\}/);
  assert.match(standaloneWorkspace, /aria-label="Case \$\{index\} details"/);
  assert.doesNotMatch(reactWorkspace, /Teaching case \{selectedIndex\} of/);
  assert.doesNotMatch(standaloneWorkspace, /Teaching case \$\{index\} of/);
});

test("both editions project the same concise input facts for every case", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const source = standalone.match(/function projectAssemblyCaseInputs\(request\)\{[\s\S]*?\n\}\nfunction projectAssemblyKaDecisions/)?.[0].replace(/\nfunction projectAssemblyKaDecisions$/, "");
  assert.ok(source);
  const portableProjection = runInNewContext(`${source}\nprojectAssemblyCaseInputs`);
  const loaded = loadAssemblyTeachingCases(embedded);
  assert.equal(loaded.error, null);
  for (const item of loaded.cases) {
    const server = projectAssemblyCaseInputs(item.request);
    const portable = portableProjection(item.request);
    assert.equal(JSON.stringify(portable), JSON.stringify(server));
    assert.equal(server.facts.length, 5);
    assert.equal(JSON.stringify(server).includes('"expected"'), false);
  }
  assert.equal(projectAssemblyCaseInputs(loaded.cases[0].request).facts[4].value, "10 minutes");
  assert.equal(projectAssemblyCaseInputs(loaded.cases[1].request).facts[4].value, "70 minutes");
  assert.equal(projectAssemblyCaseInputs(loaded.cases[3].request).facts[0].value, "At-risk, intact site indicated");
  assert.equal(projectAssemblyCaseInputs(loaded.cases[4].request).facts[1].value, "Not confirmed");
});

test("both editions project four KO contributions and recorded handoffs without expected answers", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const source = standalone.match(/function projectAssemblyKoContributions\(trace\)\{[\s\S]*?\n\}\nfunction projectAssemblyKaDecisions/)?.[0].replace(/\nfunction projectAssemblyKaDecisions$/, "");
  assert.ok(source);
  const portableProjection = runInNewContext(`${source}\nprojectAssemblyKoContributions`);
  const loaded = loadAssemblyTeachingCases(embedded);
  assert.equal(loaded.error, null);
  for (const item of loaded.cases) {
    const server = projectAssemblyKoContributions(item.semanticTrace);
    assert.equal(JSON.stringify(portableProjection(item.semanticTrace)), JSON.stringify(server));
    assert.deepEqual(Object.keys(server), ["wagner", "decision", "margolis", "burden"]);
    assert.match(server.decision.entry, /Wagner grade .* → HBOT Decision/);
    assert.equal(JSON.stringify(server).includes('"expected"'), false);
  }
  assert.equal(projectAssemblyKoContributions(loaded.cases[0].semanticTrace).burden.result, "Low execution burden");
  assert.equal(projectAssemblyKoContributions(loaded.cases[1].semanticTrace).burden.result, "High execution burden");
  assert.equal(projectAssemblyKoContributions(loaded.cases[3].semanticTrace).margolis.exit, null);
  assert.equal(projectAssemblyKoContributions(loaded.cases[4].semanticTrace).burden.exit, null);
  assert.match(page, /className="assemblyKoModules"/);
  assert.match(standalone, /class="assembly-ko-modules"/);
  assert.equal((page.split("function KnowledgeAssemblyWorkspace() {")[1].split("export default function Home()")[0].match(/className="assemblyKoModule"/g) ?? []).length, 4);
  assert.match(standalone, /module\("Wagner".*module\("HBOT Decision".*module\("Margolis".*module\("Burden"/);
});

test("both editions separate KO facts from ordered KA decisions and stop before synthesis in cases 4–5", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const source = standalone.match(/function projectAssemblyKaDecisions\(trace\)\{[\s\S]*?\n\}\nfunction renderAssemblyCaseDetail/)?.[0].replace(/\nfunction renderAssemblyCaseDetail$/, "");
  assert.ok(source);
  const portableProjection = runInNewContext(`${source}\nprojectAssemblyKaDecisions`);
  const loaded = loadAssemblyTeachingCases(embedded);
  assert.equal(loaded.error, null);
  for (const [index, item] of loaded.cases.entries()) {
    const decisions = projectAssemblyKaDecisions(item.semanticTrace);
    assert.equal(JSON.stringify(portableProjection(item.semanticTrace)), JSON.stringify(decisions));
    assert.equal(decisions.join.result, "Four-KO join passed");
    assert.equal(JSON.stringify(decisions).includes('"expected"'), false);
    assert.ok(decisions.final.result);
    if (index < 3) {
      assert.equal(decisions.bands.length, 2);
      assert.ok(decisions.synthesis.result.startsWith("Rule "));
      assert.equal(decisions.stop, null);
    } else {
      assert.equal(decisions.bands, null);
      assert.equal(decisions.synthesis, null);
      assert.match(decisions.stop, /No band projection or synthesis rule/);
    }
  }
  assert.match(page, /className="srOnly">\{contributions\.decision\.entry\}/);
  assert.match(page, /Assembly stages/);
  assert.match(page, /Assembly output/);
  assert.match(standalone, /class="assembly-ko-sr-only"/);
  assert.match(standalone, /Assembly stages/);
  assert.match(standalone, /Assembly output/);
});

test("both editions project the KA's twelve declared synthesis cells and select only applicable cases", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const source = standalone.match(/function projectAssemblySynthesisMatrix\(assembly,trace\)\{[\s\S]*?\n\}\nfunction renderAssemblyCaseDetail/)?.[0].replace(/\nfunction renderAssemblyCaseDetail$/, "");
  assert.ok(source);
  const portableProjection = runInNewContext(`${source}\nprojectAssemblySynthesisMatrix`);
  const cases = loadAssemblyTeachingCases(embedded).cases;
  for (const [index, item] of cases.entries()) {
    const matrix = projectAssemblySynthesisMatrix(embedded, item.semanticTrace);
    assert.equal(matrix.cells.length, 12);
    assert.equal(matrix.error, null);
    assert.equal(JSON.stringify(portableProjection(embedded, item.semanticTrace)), JSON.stringify(matrix));
    assert.equal(matrix.selectedRule === null, index >= 3);
    if (matrix.selectedRule) assert.equal(matrix.cells.filter((cell) => cell.rule === matrix.selectedRule).length, 1);
  }
});

test("both editions keep one case-content scroller and a horizontal narrow case selector", () => {
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(page, /className="assemblyCaseButtons"/);
  assert.match(standalone, /class="assembly-case-buttons"/);
  assert.match(styles, /\.assemblyCaseDetail \{[^}]*overflow-y: auto/);
  assert.match(standalone, /\.assembly-case-detail\{[^}]*overflow-y:auto/);
  assert.match(styles, /\.assemblyExercise \.viewStickyControls \{ position: relative; top: auto/);
  assert.match(standalone, /\.assembly-exercise \.view-sticky-controls\{position:relative;top:auto/);
  assert.match(styles, /\.assemblyCaseButtons \{ display: flex/);
  assert.match(standalone, /\.assembly-case-buttons\{display:flex/);
  assert.match(styles, /\.assemblyCaseSummary \{ display: grid; gap: 10px/);
  assert.match(standalone, /\.assembly-case-summary\{display:grid;gap:10px/);
  assert.match(styles, /\.assemblyKoModules \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(standalone, /\.assembly-ko-modules\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.assemblyDecisionSteps \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(standalone, /\.assembly-decision-steps\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
