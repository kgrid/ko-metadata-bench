import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  constructFindabilityMetadata,
  createFindabilityEnrichmentBaseline,
  getFindabilityOutputTermOptions,
  getFindabilitySubjectOptions,
  getFindabilityUnlockState,
} from "../app/findability-enrichment.js";
import {
  constructReusabilityMetadata,
  createReusabilityEnrichmentBaseline,
  getReusabilityEvidenceOptions,
  getReusabilityLicenseOptions,
  getReusabilityUnlockState,
} from "../app/reusability-enrichment.js";

const pageUrl = new URL("../app/page.tsx", import.meta.url);
const standaloneUrl = new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url);

function pageEmbeddedValue(source, key) {
  const marker = `  ${JSON.stringify(key)}: `;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${key} is embedded in the React edition`);
  const valueStart = start + marker.length;
  return JSON.parse(source.slice(valueStart, source.indexOf(",\n", valueStart)));
}

function standaloneOverrides(html) {
  const marker = "const overrides=";
  const start = html.indexOf(marker);
  const end = html.indexOf(";\nconst objectBinaryOverrides", start);
  assert.notEqual(start, -1, "standalone text bundle is present");
  assert.notEqual(end, -1, "standalone text bundle has a stable boundary");
  return JSON.parse(html.slice(start + marker.length, end));
}

function objectLiteralBetween(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${label} starts at a stable boundary`);
  assert.notEqual(end, -1, `${label} ends at a stable boundary`);
  return JSON.parse(source.slice(start + startMarker.length, end));
}

function pageTextOverrides(source) {
  return objectLiteralBetween(source, "const objectFileOverrides: Record<string, string> = ", ";\nconst objectBinaryOverrides", "React text bundle");
}

function pageBinaryOverrides(source) {
  return objectLiteralBetween(source, "const objectBinaryOverrides: Record<string, string> = ", ";\nconst base64ToBytes", "React binary bundle");
}

function standaloneBinaryOverrides(source) {
  return objectLiteralBetween(source, "const objectBinaryOverrides=", ";\nconst base64ToBytes", "standalone binary bundle");
}

test("React and standalone editions embed identical Findability and Reusability metadata", async () => {
  const [page, standalone] = await Promise.all([readFile(pageUrl, "utf8"), readFile(standaloneUrl, "utf8")]);
  const overrides = standaloneOverrides(standalone);
  for (let objectId = 1; objectId <= 4; objectId += 1) {
    for (const file of ["findability.metadata.txt", "reusability.metadata.txt"]) {
      const key = `${objectId}/${file}`;
      assert.equal(overrides[key], pageEmbeddedValue(page, key), `${key} remains identical in both formats`);
    }
  }
});

test("React and standalone editions embed identical complete KO payloads", async () => {
  const [page, standalone] = await Promise.all([readFile(pageUrl, "utf8"), readFile(standaloneUrl, "utf8")]);
  const pageText = pageTextOverrides(page);
  const standaloneText = standaloneOverrides(standalone);
  const pageBinary = pageBinaryOverrides(page);
  const standaloneBinary = standaloneBinaryOverrides(standalone);

  assert.deepEqual(Object.keys(standaloneText).sort(), Object.keys(pageText).sort(), "all embedded text-file paths match");
  assert.deepEqual(standaloneText, pageText, "all embedded text-file contents match");
  assert.deepEqual(Object.keys(standaloneBinary).sort(), Object.keys(pageBinary).sort(), "all embedded binary-file paths match");
  assert.deepEqual(standaloneBinary, pageBinary, "all embedded binary-file contents match");
});

test("both editions route metadata-dependent views through their working copy", async () => {
  const [page, standalone] = await Promise.all([readFile(pageUrl, "utf8"), readFile(standaloneUrl, "utf8")]);
  for (const consumer of ["searchKnowledgeObjects", "findabilityFacets", "knowledgeObjectPurpose", "reusabilityFacets"]) {
    const start = page.indexOf(`function ${consumer}`);
    assert.notEqual(start, -1, `${consumer} exists in React`);
    assert.match(page.slice(start, start + 9000), /workingFileValue\(/, `${consumer} reads the React working copy`);
  }
  for (const signature of ["function searchAll(query)", "function findabilityFacets(objectId)", "function knowledgeObjectPurpose(objectId)", "function getReusabilityFacets(objectId)"]) {
    const start = standalone.indexOf(signature);
    assert.notEqual(start, -1, `${signature} exists in standalone`);
    assert.match(standalone.slice(start, start + 16000), /value\(objectId,/, `${signature} reads the standalone working copy`);
  }
});

test("metadata completion transitions directly from guided entry to the normal Table view", async () => {
  const [page, standalone] = await Promise.all([readFile(pageUrl, "utf8"), readFile(standaloneUrl, "utf8")]);
  assert.match(page, /findabilityNeedsGuidedEntry[\s\S]*?<FindabilityGuidedEditor/);
  assert.match(page, /reusabilityNeedsGuidedEntry[\s\S]*?<ReusabilityGuidedEditor/);
  assert.match(page, /setRdfView\("human"\); onEdit\(nextValue\)/, "guided edits return React to Table presentation");
  assert.match(page, /metadataNeedsGuidedEntry \? "Guided metadata entry"/);
  assert.doesNotMatch(page, /MetadataUnlockNotice|metadataUnlockNotice/);

  assert.match(standalone, /if\(enrichment\.complete\)return;/, "completed standalone Reusability metadata keeps the normal renderer");
  assert.match(standalone, /root\.querySelector\("\.editor-foot span"\)\.textContent="Guided metadata entry"/);
  assert.doesNotMatch(standalone, /metadata-unlock-notice|metadata complete<\/strong>/);
});

test("complete enrichment lasts for the session and reset restores only the selected baseline", async () => {
  const page = await readFile(pageUrl, "utf8");
  const canonicalFindability = pageEmbeddedValue(page, "4/findability.metadata.txt");
  const canonicalReusability = pageEmbeddedValue(page, "4/reusability.metadata.txt");
  const findabilityKey = "4/findability.metadata.txt";
  const reusabilityKey = "4/reusability.metadata.txt";

  const findability = constructFindabilityMetadata(canonicalFindability, {
    fullNameConfirmed: true,
    description: "A persisted learner description.",
    controlledSubjectIris: getFindabilitySubjectOptions(canonicalFindability).slice(0, 1).map(({ iri }) => iri),
    searchTerms: ["diabetic foot ulcer", "healing prognosis", "wound duration"],
    outputTermIris: getFindabilityOutputTermOptions(canonicalFindability).map(({ iri }) => iri),
  });
  const reusability = constructReusabilityMetadata(canonicalReusability, {
    scope: "A persisted learner scope.",
    licenseIris: getReusabilityLicenseOptions(canonicalReusability).map(({ iri }) => iri),
    evidenceIris: getReusabilityEvidenceOptions(canonicalReusability).map(({ iri }) => iri),
  });
  assert.equal(getFindabilityUnlockState(findability).unlocked, true);
  assert.equal(getReusabilityUnlockState(reusability).unlocked, true);

  const sessionDrafts = { [findabilityKey]: findability, [reusabilityKey]: reusability };
  assert.equal(getFindabilityUnlockState(sessionDrafts[findabilityKey]).unlocked, true);
  assert.equal(getReusabilityUnlockState(sessionDrafts[reusabilityKey]).unlocked, true);

  const reset = Object.fromEntries(Object.entries(sessionDrafts).filter(([key]) => key !== findabilityKey));
  const findabilityBaseline = createFindabilityEnrichmentBaseline(canonicalFindability);
  const reusabilityBaseline = createReusabilityEnrichmentBaseline(canonicalReusability);
  assert.equal(getFindabilityUnlockState(reset[findabilityKey] ?? findabilityBaseline).unlocked, false);
  assert.equal(getReusabilityUnlockState(reset[reusabilityKey] ?? reusabilityBaseline).unlocked, true);
});

test("neither edition persists learner changes across reloads", async () => {
  const [page, standalone] = await Promise.all([readFile(pageUrl, "utf8"), readFile(standaloneUrl, "utf8")]);
  assert.doesNotMatch(page, /localStorage|sessionStorage|loadDrafts|saveDrafts|DRAFT_STORAGE_KEY/);
  assert.doesNotMatch(page, /Session changes|modifiedCount|changeDot|statusDot/);
  assert.doesNotMatch(standalone, /localStorage|sessionStorage|draftStorageKey|loadStoredDrafts|Saved locally|Recovered locally/);
  assert.doesNotMatch(standalone, /Session changes|changedCount|class="dot"|class="green"|>Modified</);
});

test("both editions retain the same guided-editor contract", async () => {
  const [page, styles, standalone] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(standaloneUrl, "utf8"),
  ]);
  const sharedCopy = [
    "Make this Knowledge Object findable",
    "Confirm the established name. It cannot be changed in this exercise.",
    "Enter more than 10 characters.",
    "Enter one search term on each of the first three lines.",
    "Confirm all four result groupings defined by this knowledge object.",
    "Make this Knowledge Object reusable",
    "Enter more than 10 characters describing appropriate use.",
    "Select both declared records supporting the knowledge represented by this object.",
    "Resetting will discard edits in progress.",
    "Guided metadata entry",
    "Simulated AI Support",
    "This knowledge object uses a diabetic foot ulcer’s initial wound area and duration to place it into a published prognostic group and estimate its probability of healing within 16 weeks.",
    "diabetic foot ulcer healing prognosis",
    "16-week wound healing probability",
    "baseline wound area and duration",
    "pretreatment DFU prognostic stratification",
    "Margolis two-factor prognostic model",
    "Intended for demonstration, education, and research involving one established diabetic foot ulcer at its first clinical assessment. Wound area and duration must describe the same ulcer and use supported units. The knowledge object assigns one of four published pretreatment prognostic groups and its associated probability of healing by 16 weeks. It does not diagnose or measure ulcers, calculate individualized continuous risk, consider factors beyond area and duration, evaluate treatments or HBOT eligibility, or recommend care. Use beyond the source populations and settings requires independent validation and clinical governance.",
  ];
  for (const text of sharedCopy) {
    assert.ok(page.includes(text), `React includes: ${text}`);
    assert.ok(standalone.includes(text), `standalone includes: ${text}`);
  }

  assert.match(page, /rows=\{3\}/, "React guided text areas use the three-line presentation");
  assert.match(standalone, /rows="3"/, "standalone guided text areas use the three-line presentation");
  assert.match(styles, /\.guidedField > div\.guidedFieldHeading \{ display: flex;/, "React places simulated support in the Description heading row");
  assert.match(standalone, /\.guided-field>\.guided-field-heading\{display:flex!important/, "standalone places simulated support in the Description heading row");
  assert.match(page, /setRdfView\("human"\); onEdit\(nextValue\)/, "React completes into Table view");
  assert.match(standalone, /commitGuidedMetadataTransition\(gate,nextValue/, "standalone uses the same completion transition");
});

test("Reset is absent until relevant and occupies the left editor-header position", async () => {
  const [page, styles, standalone] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(standaloneUrl, "utf8"),
  ]);

  assert.match(page, /\{modified && <button className="editorControlButton editorResetButton"/);
  assert.doesNotMatch(page, />Reset<\/button>\}\s*<\/div>/);
  assert.match(styles, /\.editorResetButton \{[^}]*margin-right: auto/);

  assert.match(standalone, /\$\{changed\(s\.object,s\.file\)\?'<button class="reset">Reset<\/button>':""\}/);
  assert.doesNotMatch(standalone, /class="reset"[^>]*disabled/);
  assert.match(standalone, /\.editor-bar>\.reset\{[^}]*margin-right:auto/);
  assert.match(standalone, /if\(shouldShow&&!reset&&bar\)/, "standalone reveals Reset as soon as an edit becomes resettable");
});

test("both editions use an in-app Reset confirmation instead of the browser prompt", async () => {
  const [page, standalone] = await Promise.all([readFile(pageUrl, "utf8"), readFile(standaloneUrl, "utf8")]);
  for (const source of [page, standalone]) {
    assert.ok(source.includes("Reset this metadata?"));
    assert.ok(source.includes("Resetting will discard edits in progress."));
    assert.ok(source.includes('role="alertdialog"'));
    assert.ok(source.includes('aria-modal="true"'));
    assert.doesNotMatch(source, /(?:window\.)?confirm\("Resetting will discard edits in progress\."\)/);
  }
  assert.match(page, /event\.key === "Escape"/);
  assert.match(standalone, /event\.key==="Escape"/);
});

test("both editions share the centered FAIR control-bar arrangement", async () => {
  const [page, styles, standalone] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(standaloneUrl, "utf8"),
  ]);
  for (const source of [page, standalone]) {
    assert.ok(source.includes("Metadata Rig"));
    assert.ok(source.includes("Metadata Exercises"));
    assert.doesNotMatch(source, />METADATA EDITOR<\/button>/);
  }
  assert.match(page, /contextDestinations contextDestinationsLeft/);
  assert.match(page, /exerciseControlCluster/);
  assert.match(styles, /grid-template-columns: minmax\(0,1fr\) auto minmax\(0,1fr\)/);
  assert.match(standalone, /context-destinations context-destinations-left/);
  assert.match(standalone, /exercise-control-cluster/);
});

test("both editions expose a collapsible Principles control row for each metadata file", async () => {
  const [page, styles, standalone] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(standaloneUrl, "utf8"),
  ]);
  for (const label of ["Findability Principles", "Accessibility Principles", "Interoperability Principles", "Reusability Principles", "Existence Principles"]) {
    assert.ok(page.includes(label), `React includes ${label}`);
    assert.ok(standalone.includes(label), `standalone includes ${label}`);
  }
  for (const label of ["Unique KO ID", "Unique KO Metadata ID", "KO Access", "KO Metadata Access", "Specified Interface", "Object References", "License", "Dependencies", "Button 1", "Button 2"]) {
    assert.ok(page.includes(label), `React Principles tray includes ${label}`);
    assert.ok(standalone.includes(label), `standalone Principles tray includes ${label}`);
  }
  assert.match(page, /aria-expanded=\{principlesOpen\}/);
  assert.match(page, /principlesControlRow/);
  assert.match(styles, /\.principlesControlRow \{/);
  assert.match(standalone, /s\.principlesOpen=!s\.principlesOpen;render\(side\)/);
  assert.match(standalone, /class="principles-control-row"/);
  assert.match(styles, /justify-content: center/);
  assert.match(standalone, /justify-content:center/);
  for (const source of [page, standalone]) {
    assert.ok(source.includes("Based on FAIR Principles"));
    assert.ok(source.includes("for Research Software"));
    assert.ok(source.includes("https://zenodo.org/records/6623556#.YqCJTJNBwlw"));
  }
  assert.match(styles, /\.principlesReference \{ position: absolute; right: 14px/);
  assert.match(standalone, /\.principles-reference\{position:absolute;right:14px/);
});

test("both editions place existence metadata between reusability metadata and metadata.json", async () => {
  const [page, standalone] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(standaloneUrl, "utf8"),
  ]);
  for (const source of [page, standalone]) {
    const reusability = source.indexOf('"reusability.metadata.txt"');
    const existence = source.indexOf('"existence.metadata.txt"');
    const information = source.indexOf('"metadata.json"', existence);
    assert.ok(reusability >= 0 && existence > reusability && information > existence);
    assert.ok(source.includes('"existence.metadata.txt":"Existence"') || source.includes('"existence.metadata.txt": "Existence"'));
  }
});

test("principal KO grids scroll only when their rows exceed the available viewport", async () => {
  const [styles, standalone] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(standaloneUrl, "utf8"),
  ]);
  for (const className of ["koGrid", "searchResults", "accessibilityGrid", "interoperabilityGrid", "reusabilityGrid", "metadataRigGrid"]) {
    assert.ok(styles.includes(`.${className}`), `React styles include ${className}`);
  }
  assert.match(styles, /max-height: calc\(100vh - 300px\)/);
  assert.match(styles, /overflow-y: auto/);
  assert.match(styles, /\.appFooter \{ flex: 0 0 35px; \}/);
  assert.match(standalone, /max-height:calc\(100vh - 300px\)/);
  assert.match(standalone, /overflow-y:auto/);
  assert.match(standalone, /\.app-footer\{flex:0 0 35px\}/);
});
