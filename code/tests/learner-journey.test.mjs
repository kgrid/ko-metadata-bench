import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Parser } from "n3";
import {
  constructFindabilityMetadata,
  createFindabilityEnrichmentBaseline,
  getFindabilityEnrichmentInput,
  getFindabilityOutputTermOptions,
  getFindabilitySubjectOptions,
  getFindabilityUnlockState,
} from "../app/findability-enrichment.js";
import {
  constructReusabilityMetadata,
  createReusabilityEnrichmentBaseline,
  getReusabilityEnrichmentInput,
  getReusabilityEvidenceOptions,
  getReusabilityLicenseOptions,
  getReusabilityUnlockState,
} from "../app/reusability-enrichment.js";

const pageUrl = new URL("../app/page.tsx", import.meta.url);
const standaloneUrl = new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url);

function embeddedValue(source, key) {
  const marker = `  ${JSON.stringify(key)}: `;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${key} is embedded`);
  const valueStart = start + marker.length;
  return JSON.parse(source.slice(valueStart, source.indexOf(",\n", valueStart)));
}

function progress(state) {
  return { completed: state.completed, total: state.total, unlocked: state.unlocked };
}

test("Findability learner journey stays guided until every requirement is complete", async () => {
  const page = await readFile(pageUrl, "utf8");
  const canonical = embeddedValue(page, "4/findability.metadata.txt");
  const subjects = getFindabilitySubjectOptions(canonical);
  const outputs = getFindabilityOutputTermOptions(canonical);
  const baseline = createFindabilityEnrichmentBaseline(canonical);

  assert.deepEqual(progress(getFindabilityUnlockState(baseline)), { completed: 0, total: 5, unlocked: false });

  const partial = constructFindabilityMetadata(canonical, {
    fullNameConfirmed: true,
    description: "A learner description long enough to be accepted.",
    controlledSubjectIris: [subjects[0].iri],
    searchTerms: ["diabetic foot ulcer", "healing prognosis"],
    outputTermIris: outputs.slice(0, 3).map(({ iri }) => iri),
  });
  assert.deepEqual(progress(getFindabilityUnlockState(partial)), { completed: 3, total: 5, unlocked: false });
  assert.deepEqual(getFindabilityEnrichmentInput(partial).outputTermIris, outputs.slice(0, 3).map(({ iri }) => iri));

  const complete = constructFindabilityMetadata(canonical, {
    ...getFindabilityEnrichmentInput(partial),
    searchTerms: ["diabetic foot ulcer", "healing prognosis", "wound duration"],
    outputTermIris: outputs.map(({ iri }) => iri),
  });
  assert.deepEqual(progress(getFindabilityUnlockState(complete)), { completed: 5, total: 5, unlocked: true });
  assert.doesNotThrow(() => new Parser({ format: "text/turtle" }).parse(complete));

  const reset = createFindabilityEnrichmentBaseline(canonical);
  assert.equal(reset, baseline);
  assert.deepEqual(progress(getFindabilityUnlockState(reset)), { completed: 0, total: 5, unlocked: false });
});

test("Reusability learner journey requires both evidence sources before Table and Source", async () => {
  const page = await readFile(pageUrl, "utf8");
  const canonical = embeddedValue(page, "4/reusability.metadata.txt");
  const licenses = getReusabilityLicenseOptions(canonical);
  const evidence = getReusabilityEvidenceOptions(canonical);
  const baseline = createReusabilityEnrichmentBaseline(canonical);

  assert.deepEqual(progress(getReusabilityUnlockState(baseline)), { completed: 0, total: 3, unlocked: false });
  assert.equal(evidence.length, 2, "the exercise has exactly two required evidence choices");

  const oneEvidence = constructReusabilityMetadata(canonical, {
    scope: "Appropriate for the declared first-visit assessment context.",
    licenseIris: licenses.map(({ iri }) => iri),
    evidenceIris: [evidence[0].iri],
  });
  assert.deepEqual(progress(getReusabilityUnlockState(oneEvidence)), { completed: 2, total: 3, unlocked: false });
  assert.deepEqual(getReusabilityEnrichmentInput(oneEvidence).evidenceIris, [evidence[0].iri]);

  const complete = constructReusabilityMetadata(canonical, {
    ...getReusabilityEnrichmentInput(oneEvidence),
    evidenceIris: evidence.map(({ iri }) => iri),
  });
  assert.deepEqual(progress(getReusabilityUnlockState(complete)), { completed: 3, total: 3, unlocked: true });
  assert.doesNotThrow(() => new Parser({ format: "text/turtle" }).parse(complete));

  const reset = createReusabilityEnrichmentBaseline(canonical);
  assert.equal(reset, baseline);
  assert.deepEqual(progress(getReusabilityUnlockState(reset)), { completed: 0, total: 3, unlocked: false });
});

test("both editions expose the same learner gates and reload from embedded baselines", async () => {
  const [page, standalone] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(standaloneUrl, "utf8"),
  ]);

  assert.match(page, /findabilityNeedsGuidedEntry && findabilityEnrichment/);
  assert.match(page, /reusabilityNeedsGuidedEntry && reusabilityEnrichment/);
  assert.match(page, /isTurtle && !metadataNeedsGuidedEntry/);
  assert.match(standalone, /if\(enrichment\.complete\)return;/);
  assert.match(standalone, /Guided metadata entry/);

  for (const source of [page, standalone]) {
    assert.doesNotMatch(source, /localStorage|sessionStorage/);
  }

  const findabilityBaseline = createFindabilityEnrichmentBaseline(embeddedValue(page, "4/findability.metadata.txt"));
  const reusabilityBaseline = createReusabilityEnrichmentBaseline(embeddedValue(page, "4/reusability.metadata.txt"));
  assert.equal(getFindabilityUnlockState(findabilityBaseline).unlocked, false);
  assert.equal(getReusabilityUnlockState(reusabilityBaseline).unlocked, false);
});
