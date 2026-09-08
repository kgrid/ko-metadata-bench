import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const react = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
const runnerConfig = readFileSync(new URL("../app/runner-input-config.js", import.meta.url), "utf8");

test("both editions open a full-screen Runner shell from each available KO Run action", () => {
  assert.match(react, /setGraphicView\("runner"\)/);
  assert.match(react, /<KnowledgeObjectRunnerView objectId=\{objectId\}/);
  assert.match(standalone, /openKnowledgeObjectRunnerView\(objectId\)/);
  assert.match(standalone, /if\(objectId\)openKnowledgeObjectRunnerView\(objectId\)/);
});

test("both Runner shells expose only Restore and Run as workflow controls", () => {
  const reactRunner = react.slice(react.indexOf("function KnowledgeObjectRunnerView"), react.indexOf("function graphicAbstractFile"));
  const standaloneRunner = standalone.slice(standalone.indexOf("function openConfiguredRunnerPhase8"), standalone.indexOf("openKnowledgeObjectRunnerView=openConfiguredRunnerPhase8"));
  for (const edition of [reactRunner, standaloneRunner]) {
    assert.match(edition, /Browser Runner/);
    assert.match(edition, />Input</);
    assert.match(edition, />Output</);
    assert.match(edition, />Run</);
    assert.match(edition, />Restore</);
    assert.match(edition, /Close Runner/);
    assert.doesNotMatch(edition, />Reset</);
    assert.doesNotMatch(edition, /Use example/);
    assert.doesNotMatch(edition, /Output presentation|data-mode=|koRunnerMode|ko-runner-mode|koRunnerActions|ko-runner-actions/);
  }
});

test("both shells enable Run only after a configured input and an isolated host are ready", () => {
  assert.match(react, /disabled=\{!inputAvailable \|\| hostState !== "ready"\}>Run<\/button>/);
  assert.match(standalone, /run\.disabled=busy\|\|preparing\|\|!ready/);
});

test("both editions expose declarative human-readable forms and supplied examples", () => {
  assert.match(react, /runnerInputConfig\(knowledgeObjectId,/);
  assert.match(react, /runnerExampleState\(inputConfig\)/);
  assert.match(react, />Generated request<\/summary>/);
  assert.match(standalone, /function runnerFormConfig\(id,objectId\)/);
  assert.match(standalone, /runnerExampleState\(config\)/);
  assert.match(standalone, /Generated request/);
});

test("Restore returns the complete Runner session to its supplied opening state in both editions", () => {
  const reactRunner = react.slice(react.indexOf("function KnowledgeObjectRunnerView"), react.indexOf("function graphicAbstractFile"));
  const standaloneRunner = standalone.slice(standalone.indexOf("function openConfiguredRunnerPhase8"), standalone.indexOf("openKnowledgeObjectRunnerView=openConfiguredRunnerPhase8"));
  for (const edition of [reactRunner, standaloneRunner]) {
    assert.match(edition, /runnerExampleState/);
    assert.match(edition, /RunnerOutput|null/);
    assert.match(edition, /RunnerHasResult|hasResult=false/);
    assert.match(edition, /RunnerFailure|runnerFailure=null/);
    assert.match(edition, /sandboxGeneration|prepare\(\)/);
  }
});

test("both Runner views disclose the particular operation without claiming to run the complete KO", () => {
  assert.match(react, /className="koRunnerScope"/);
  assert.match(standalone, /class="ko-runner-scope"/);
  for (const statement of ["Runs Wagner response analysis.", "Runs the HBOT treatment-decision operation.", "Runs burden-range calculation.", "Runs DFU prognostic evaluation."]) {
    assert.match(runnerConfig, new RegExp(statement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(standalone, new RegExp(statement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(react, /Runs the complete knowledge object|Executes every capability|Fully implements the CKS/);
  assert.doesNotMatch(standalone, /Runs the complete knowledge object|Executes every capability|Fully implements the CKS/);
});

test("both editions use the human-readable output projection without a secondary output mode", () => {
  assert.match(react, /projectRunnerOutput\(inputConfig, runnerOutput\)/);
  assert.match(react, /<RunnerOutputProjection model=\{outputProjection\}/);
  assert.match(standalone, /function runnerOutputModel\(config,output\)/);
  assert.match(standalone, /renderRunnerOutputModel\(runnerOutputModel\(config,outputValue\)\)/);
  assert.match(react, /JSON\.stringify\(result, null, 2\)/);
  assert.match(standalone, /JSON\.stringify\(value,null,2\)/);
  assert.doesNotMatch(react, /human-readable output projection will be added/);
});

test("structured KO errors and host execution failures use distinct presentation paths", () => {
  assert.match(react, /Knowledge-object error/);
  assert.match(react, /Operation stopped\./);
  assert.match(standalone, /Knowledge-object error/);
  assert.match(standalone, /Operation stopped\./);
});

test("both editions contain Runner failures and keep technical details collapsed", () => {
  for (const edition of [react, standalone]) {
    assert.match(edition, /Runner unavailable\./);
    assert.match(edition, /Execution timed out\./);
    assert.match(edition, /Output unavailable\./);
    assert.match(edition, /Technical details/);
    assert.doesNotMatch(edition, /error\?\.stack|error\.stack/);
  }
  assert.match(react, /RunnerMalformedOutputError/);
  assert.match(standalone, /RunnerMalformedOutputError/);
});

test("Runner output and failure text cannot be interpreted as parent-page HTML", () => {
  const reactRunner = react.slice(react.indexOf("function RunnerOutputProjection"), react.indexOf("function graphicAbstractFile"));
  assert.doesNotMatch(reactRunner, /dangerouslySetInnerHTML/);
  assert.match(reactRunner, /<dd>\{item\.value\}<\/dd>/);
  assert.match(reactRunner, /<p>\{error\.message\}<\/p>/);
  assert.match(standalone, /function renderRunnerOutputModel\(model\)[\s\S]*?escapeHtml\(item\.value\)/);
  assert.match(standalone, /function renderRunnerFailureStandalone\(failure\)[\s\S]*?escapeHtml\(failure\.summary\)/);
});

test("closing a Runner removes only its full-screen layer and preserves the Knowledge Objects view", () => {
  assert.match(react, /onClose=\{\(\) => setGraphicView\(null\)\}/);
  assert.match(react, /<div className="koGrid">\{OBJECT_IDS\.map/);
  assert.match(standalone, /close=\(\)=>\{sandbox\?\.dispose\(\);document\.removeEventListener\("keydown",escape\);view\.remove\(\)\}/);
  assert.match(standalone, /class="ko-grid"/);
  assert.doesNotMatch(standalone, /close=\(\)=>\{[^}]*workspace\.innerHTML/);
});

test("Runner shell is two-column on desktop and one-column on narrow screens", () => {
  assert.match(css, /\.koRunnerBody[^}]+grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width: 780px\)[^{]+\{ \.koRunnerBody \{ grid-template-columns: 1fr/);
  assert.match(standalone, /\.ko-runner-body\{[^}]+grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(standalone, /@media\(max-width:780px\)\{\.ko-runner-body\{grid-template-columns:1fr/);
});
