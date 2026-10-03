import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { loadAssemblyTeachingCases, projectAssemblyCaseInputs, projectAssemblyKoContributions, projectAssemblyKoExchange, projectAssemblyKaDecisions, projectAssemblySynthesisMatrix } from "../app/assembly-teaching-cases.js";

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
  const reactWorkspace = page.split("function KnowledgeAssemblyCaseView() {")[1].split("function KnowledgeAssemblyWorkspace(")[0];
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

test("both editions present one KA bar and open the unchanged case workspace through Orchestration", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(page, /className="assemblyObjectBar"/);
  assert.match(page, /EMBEDDED_ASSEMBLY\.metadata\["dc:title"\]/);
  assert.match(page, /<button type="button" onClick=\{\(\) => setCaseViewOpen\(true\)\}>Orchestration<\/button>/);
  assert.match(page, /<KnowledgeAssemblyCaseView \/>/);
  assert.match(page, /aria-label="Close orchestration"/);
  assert.match(standalone, /class="assembly-object-bar"/);
  assert.match(standalone, /embeddedAssembly\.metadata\?\.\["dc:title"\]/);
  assert.match(standalone, /data-open-orchestration>Orchestration<\/button>/);
  assert.match(standalone, /function openAssemblyCaseView\(trigger\)/);
  assert.match(standalone, /aria-label="Close orchestration"/);
});

test("both editions center a distinct press-in loading action below the KA bar", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /Orchestration<\/button><\/article>\s*<div className="assemblyLoadControl">\{assemblyLoaded[\s\S]*?Load as Knowledge Object<\/button>/);
  assert.match(standalone, /Orchestration<\/button><\/article><div class="assembly-load-control">\$\{loaded\?'<span class="assembly-loaded-status" role="status">Loaded as a Knowledge Object<\/span>':'<button type="button" data-load-assembly>Load as Knowledge Object<\/button>'\}/);
  assert.match(styles, /\.assemblyLoadControl \{ flex: 1; min-height: 160px; width: 100%; display: grid; place-items: center;/);
  assert.match(styles, /\.assemblyLoadedStatus \{ box-shadow: inset/);
  assert.match(standalone, /\.assembly-load-control\{flex:1;min-height:160px;width:100%;display:grid;place-items:center;/);
  assert.match(standalone, /\.assembly-loaded-status\{box-shadow:inset/);
});

test("both editions keep a compact KA bar and a plain centered Case View title", () => {
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const reactCaseView = page.split("function KnowledgeAssemblyCaseView() {")[1].split("function KnowledgeAssemblyWorkspace(")[0];
  const portableCaseView = standalone.split("function openAssemblyCaseView(trigger){")[1].split("function openKnowledgeAssembly(){")[0];
  assert.match(styles, /\.assemblyObjectBar \{ width: min\(760px,100%\)/);
  assert.match(standalone, /\.assembly-object-bar\{width:min\(760px,100%\)/);
  assert.match(reactCaseView, /<h2>Assembly Orchestration<\/h2>/);
  assert.match(portableCaseView, /<h2>Assembly Orchestration<\/h2>/);
  assert.doesNotMatch(reactCaseView, /koInstrumentMark|Explore the assembly of Knowledge Objects/);
  assert.doesNotMatch(portableCaseView, /ko-instrument-mark|Explore the assembly of Knowledge Objects/);
});

test("all four KO exchanges use each case's actual inputs, native outputs, and KA handoffs in both editions", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const source = standalone.split("function projectAssemblyKoExchange(caseRecord,role){")[1].split("function projectAssemblyKaDecisions(trace){")[0];
  const portable = runInNewContext(`(function projectAssemblyKoExchange(caseRecord,role){${source})`, {});
  const cases = loadAssemblyTeachingCases(embedded).cases;
  for (const item of cases) {
    const exchange = projectAssemblyKoExchange(item, "wagner");
    assert.ok(exchange);
    assert.equal(exchange.input.source, item.request.wagner_response_artifact);
    assert.equal(exchange.output.source, item.semanticTrace.ko_outputs.wagner.native_output);
    assert.equal(exchange.input.sections[0].items.length, item.request.wagner_response_artifact.question_ids.length);
    assert.equal(exchange.handoff.source.length, 2);
    assert.equal(JSON.stringify(portable(item, "wagner")), JSON.stringify(exchange));
  }
  for (const item of cases) for (const [role, key, dependency] of [
    ["decision", "hbot_decision", "DEP-HBOT-DECISION"],
    ["margolis", "margolis", "DEP-MARGOLIS"],
    ["burden", "burden", "DEP-BURDEN"],
  ]) {
    const exchange = projectAssemblyKoExchange(item, role);
    assert.ok(exchange, `${item.id} ${role} exchange`);
    assert.equal(exchange.input.source, item.semanticTrace.handoffs.find((handoff) => handoff.to === dependency).value);
    assert.equal(exchange.output.source, item.semanticTrace.ko_outputs[key].native_output);
    assert.equal(JSON.stringify(portable(item, role)), JSON.stringify(exchange));
    assert.equal(exchange.handoff.source.length, item.semanticTrace.handoffs.some((handoff) => String(handoff.from).startsWith(`${dependency}.`)) ? 2 : 1);
  }
  assert.match(page, /<AssemblyKoExchangeView exchange=\{exchange\}/);
  assert.match(standalone, /data-assembly-ko="\$\{role\}"/);
  for (const role of ["wagner", "decision", "margolis", "burden"]) {
    assert.match(page, new RegExp(`setSelectedKoRole\\("${role}"\\)`));
    assert.match(standalone, new RegExp(`contributions\\.[a-z]+[^\\n]+,"${role}"\\)`));
  }
});

test("both editions use a lower-right I/O button on each Case View KO card", () => {
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const caseView = page.split("function KnowledgeAssemblyCaseView() {")[1].split("function KnowledgeAssemblyWorkspace(")[0];
  assert.equal((caseView.match(/className="assemblyKoInspectButton"/g) ?? []).length, 4);
  assert.equal((caseView.match(/>I\/O<\/button>/g) ?? []).length, 4);
  assert.match(standalone, /class="assembly-ko-inspect-button"[^>]+>I\/O<\/button>/);
  assert.match(styles, /\.assemblyKoInspectButton \{[^}]*align-self: flex-end;[^}]*margin-top: auto;/);
  assert.match(standalone, /\.assembly-ko-inspect-button\{[^}]*align-self:flex-end;[^}]*margin-top:auto;/);
  assert.doesNotMatch(caseView, /View input · output · handoff/);
  assert.doesNotMatch(standalone, /View input · output · handoff/);
});

test("both editions compact the KO exchange without hiding long source records", () => {
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(page, /className="assemblyKoExchangeSecondary"/);
  assert.match(standalone, /class="assembly-ko-exchange-secondary"/);
  assert.match(styles, /\.assemblyKoExchangeBody \{[^}]*grid-template-columns: minmax\(0,1\.55fr\) minmax\(0,1fr\)/);
  assert.match(standalone, /\.assembly-ko-exchange-body\{[^}]*grid-template-columns:minmax\(0,1\.55fr\) minmax\(0,1fr\)/);
  assert.match(styles, /\.assemblyKoExchangeBody \{[^}]*overflow: auto/);
  assert.match(standalone, /\.assembly-ko-exchange-body\{[^}]*overflow:auto/);
});

test("all Case View KO headings have the same thin divider in both editions", () => {
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(styles, /\.assemblyKoModule h5 \{[^}]*border-bottom: 1px solid #d2d2d7/);
  assert.match(standalone, /\.assembly-ko-module h5\{[^}]*border-bottom:1px solid #d2d2d7/);
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
  assert.equal((page.split("function KnowledgeAssemblyCaseView() {")[1].split("function KnowledgeAssemblyWorkspace(")[0].match(/className="assemblyKoModule(?: assemblyKoModuleInteractive)?"/g) ?? []).length, 4);
  assert.match(standalone, /module\(objectName\(1\).*module\(objectName\(2\).*module\(objectName\(4\).*module\(objectName\(3\)/);
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

test("both editions show two short stages and one plain-language matrix selection", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const reactStages = page.split('<h5>Assembly stages</h5>')[1].split('</article>')[0];
  const portableStages = standalone.split('<h5>Assembly stages</h5>')[1].split('</article>')[0];
  assert.equal((reactStages.match(/className="assemblyStageCard/g) ?? []).length, 3);
  assert.equal((portableStages.match(/class="assembly-stage-card/g) ?? []).length, 3);
  assert.match(reactStages, /Matrix selection/);
  assert.match(portableStages, /matrixSelection/);
  assert.match(reactStages, /Four KO Output Checks/);
  assert.match(portableStages, /Four KO Output Checks/);
  assert.match(reactStages, /HBOT use/);
  assert.match(portableStages, /HBOT use/);
  assert.doesNotMatch(reactStages, /→ \$\{kaDecisions\.final\.result\}/);
  assert.doesNotMatch(standalone, /→ \$\{decisions\.final\.result\}/);
  assert.doesNotMatch(reactStages, /join\.detail|gate\.detail|synthesis\.result/);
  assert.doesNotMatch(portableStages, /join\.detail|gate\.detail|synthesis\.result/);
});

test("both editions show concise case identities and join status without changing case records", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(page, /<dt>Person<\/dt><dd>Person \{selectedIndex\}<\/dd>/);
  assert.match(page, /<dt>Ulcer \/ site<\/dt><dd>Ulcer \{selectedIndex\}<\/dd>/);
  assert.match(standalone, /<dt>Person<\/dt><dd>Person \$\{index\}<\/dd>/);
  assert.match(standalone, /<dt>Ulcer \/ site<\/dt><dd>Ulcer \$\{index\}<\/dd>/);
  assert.match(page, /join\.result === "Four-KO join passed" \? "Passed"/);
  assert.match(standalone, /join\.result==="Four-KO join passed"\?"Passed"/);
});

test("unconfirmed DFU status uses the shared missing-facet red in both editions", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /fact.label === "Diabetic foot ulcer" && fact.value === "Not confirmed" \? "notConfirmed"/);
  assert.match(standalone, /fact.label==="Diabetic foot ulcer"&&fact.value==="Not confirmed"/);
  assert.match(styles, /--status-red: #b42318/);
  assert.match(standalone, /--status-red:#b42318/);
  assert.match(styles, /\.assemblyInputFacts dd\.notConfirmed \{ color: var\(--status-red\)/);
  assert.match(standalone, /\.assembly-input-facts dd\.not-confirmed\{color:var\(--status-red\)/);
  assert.match(styles, /\.facetCount\.incompleteFacets \{[^}]*color: var\(--status-red\)/);
});

test("KA contribution headings reuse the Knowledge Objects view names in both editions", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  for (const [contribution, objectId] of [["wagner", 1], ["decision", 2], ["margolis", 4], ["burden", 3]]) {
    assert.ok(page.includes(`<h5>{objectName(${objectId})}</h5><strong>{contributions.${contribution}.result}</strong>`));
    assert.ok(standalone.includes(`module(objectName(${objectId}),contributions.${contribution},`));
  }
});

test("both editions project the KA's twelve declared synthesis cells and select only applicable cases", () => {
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(page, /letter\.toUpperCase\(\)\)\} for<\/span><span>HBOT Therapy<\/span>/);
  assert.match(standalone, /letter\.toUpperCase\(\)\)\)} for<\/span><span>HBOT Therapy<\/span>/);
  assert.match(readFileSync(new URL("../app/globals.css", import.meta.url), "utf8"), /\.assemblyMatrixCell strong \{ display: grid; color: #6e6e73/);
  assert.match(standalone, /\.assembly-matrix-cell strong\{display:grid;color:#6e6e73/);
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

test("both editions compact case content while retaining narrow-screen scrolling", () => {
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
  assert.match(styles, /\.assemblyCaseSummary \{ display: grid; gap: 6px/);
  assert.match(standalone, /\.assembly-case-summary\{display:grid;gap:6px/);
  assert.doesNotMatch(page, /No synthesis cell selected; this path stopped/);
  assert.doesNotMatch(standalone, /No synthesis cell selected; this path stopped/);
  assert.match(styles, /\.assemblyKoModules \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(standalone, /\.assembly-ko-modules\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.assemblyDecisionSteps \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(standalone, /\.assembly-decision-steps\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
