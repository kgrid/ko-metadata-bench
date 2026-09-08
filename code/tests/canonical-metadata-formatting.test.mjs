import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Parser } from "n3";
import { constructFindabilityMetadata, getFindabilityEnrichmentInput, getFindabilityOutputTermOptions, getFindabilitySubjectOptions } from "../app/findability-enrichment.js";
import { constructReusabilityMetadata, getReusabilityEnrichmentInput, getReusabilityEvidenceOptions, getReusabilityLicenseOptions } from "../app/reusability-enrichment.js";

const pageUrl = new URL("../app/page.tsx", import.meta.url);
const standaloneUrl = new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url);
const rendererUrl = new URL("../app/canonical-metadata-renderer.js", import.meta.url);

function embeddedValue(source, key) {
  const marker = `  ${JSON.stringify(key)}: `;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${key} is embedded`);
  const valueStart = start + marker.length;
  return JSON.parse(source.slice(valueStart, source.indexOf(",\n", valueStart)));
}

function prefixBlock(source) {
  return source.split("\n\n", 1)[0];
}

function comments(source) {
  return source.split("\n").filter((line) => line.trimStart().startsWith("#"));
}

test("complete guided construction is an exact canonical formatting round trip", async () => {
  const page = await readFile(pageUrl, "utf8");
  const findability = embeddedValue(page, "4/findability.metadata.txt");
  const reusability = embeddedValue(page, "4/reusability.metadata.txt");
  assert.equal(constructFindabilityMetadata(findability, getFindabilityEnrichmentInput(findability)), findability);
  assert.equal(constructReusabilityMetadata(reusability, getReusabilityEnrichmentInput(reusability)), reusability);
});

test("incomplete Findability formatting preserves authored document structure", async () => {
  const page = await readFile(pageUrl, "utf8");
  const canonical = embeddedValue(page, "4/findability.metadata.txt");
  const subjects = getFindabilitySubjectOptions(canonical);
  const outputs = getFindabilityOutputTermOptions(canonical);
  const working = constructFindabilityMetadata(canonical, {
    fullNameConfirmed: true,
    description: 'A learner description with "quoted text".\nIt remains readable.',
    controlledSubjectIris: subjects.slice(0, 2).map(({ iri }) => iri),
    searchTerms: ["diabetic foot ulcer", "healing prognosis", "wound duration"],
    outputTermIris: outputs.slice(0, 2).map(({ iri }) => iri),
  });
  assert.equal(prefixBlock(working), prefixBlock(canonical));
  assert.deepEqual(comments(working), comments(canonical));
  assert.match(working, /    schema:abstract "A learner description with \\"quoted text\\"\.\\nIt remains readable\." ;/);
  assert.match(working, /    schema:keywords "diabetic foot ulcer" ;\n\n    schema:keywords "healing prognosis" ;\n\n    schema:keywords "wound duration" ;/);
  assert.match(working, /    schema:hasDefinedTerm\n        <[^>]+\/alg-01>,\n        <[^>]+\/alg-02> \./);
  assert.doesNotMatch(working, /_:enrichment-/);
  assert.doesNotThrow(() => new Parser({ format: "text/turtle" }).parse(working));
});

test("incomplete Reusability formatting preserves headings and multiline alignment", async () => {
  const page = await readFile(pageUrl, "utf8");
  const canonical = embeddedValue(page, "4/reusability.metadata.txt");
  const working = constructReusabilityMetadata(canonical, {
    scope: 'Use for a declared learner context.\nDo not use outside that scope.',
    licenseIris: getReusabilityLicenseOptions(canonical).map(({ iri }) => iri),
    evidenceIris: getReusabilityEvidenceOptions(canonical).slice(0, 1).map(({ iri }) => iri),
  });
  assert.equal(prefixBlock(working), prefixBlock(canonical));
  assert.deepEqual(comments(working), comments(canonical));
  assert.match(working, /    # 2\. Scope\n    schema:usageInfo\n        <[^>]+#scope> ;\n\n    # 3\. License/);
  assert.match(working, /    schema:description\n        "Use for a declared learner context\.\\nDo not use outside that scope\." \./);
  assert.match(working, /    # 6\. Evidence\n    schema:citation\n        <https:\/\/doi\.org\/10\.1111\/wrr\.13019> ;\n\n    # 7\. Identity and version/);
  assert.doesNotMatch(working, /_:reusability-enrichment-/);
  assert.doesNotThrow(() => new Parser({ format: "text/turtle" }).parse(working));
});

test("both editions retain the canonical-template formatting implementation", async () => {
  const [renderer, standalone] = await Promise.all([readFile(rendererUrl, "utf8"), readFile(standaloneUrl, "utf8")]);
  assert.match(renderer, /export function renderFindabilityCanonicalTemplate/);
  assert.match(renderer, /export function renderReusabilityCanonicalTemplate/);
  assert.match(standalone, /findabilityEnrichmentBaseline=assertControlledMetadataEquivalence\("findability",findabilityEnrichmentCanonicalSource,renderFindabilityCanonicalTemplate/);
  assert.match(standalone, /reusabilityEnrichmentBaseline=assertControlledMetadataEquivalence\("reusability",reusabilityEnrichmentCanonicalSource,renderReusabilityCanonicalTemplate/);
  assert.match(standalone, /schema:hasDefinedTerm\\n\$\{selectedOutputs\.map/);
});
