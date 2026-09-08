import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Parser } from "n3";
import { constructReusabilityMetadata, createReusabilityEnrichmentBaseline, evaluateReusabilityEnrichment, getReusabilityEnrichmentInput, getReusabilityEvidenceOptions, getReusabilityEvidencePresentationOptions, getReusabilityLicenseOptions, getReusabilityUnlockState, REUSABILITY_ENRICHMENT_TARGET, setReusabilityEvidence, setReusabilityLicenses, setReusabilityScope } from "../app/reusability-enrichment.js";

async function canonicalTargetSource() {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const key = `  "${REUSABILITY_ENRICHMENT_TARGET}/reusability.metadata.txt": `;
  const start = source.indexOf(key);
  assert.notEqual(start, -1, "canonical target metadata is embedded");
  const valueStart = start + key.length;
  return JSON.parse(source.slice(valueStart, source.indexOf(",\n", valueStart)));
}

async function embeddedTargetFile(file) {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const key = `  "${REUSABILITY_ENRICHMENT_TARGET}/${file}": `;
  const start = source.indexOf(key);
  assert.notEqual(start, -1, `${file} is embedded`);
  const valueStart = start + key.length;
  return JSON.parse(source.slice(valueStart, source.indexOf(",\n", valueStart)));
}

test("KO 4 begins with valid Reusability metadata missing only Scope, License, and Evidence", async () => {
  const baseline = createReusabilityEnrichmentBaseline(await canonicalTargetSource());
  assert.doesNotThrow(() => new Parser({ format: "text/turtle" }).parse(baseline));
  assert.deepEqual(evaluateReusabilityEnrichment(baseline), { valid: true, scope: false, license: false, evidence: false, complete: false, message: "" });
  assert.match(baseline, /Assigns one diabetic foot ulcer/);
  assert.match(baseline, /prov:has_provenance/);
  assert.match(baseline, /schema:hasPart/);
  assert.match(baseline, /schema:identifier\s+"workshop-ko-4"/);
  assert.match(baseline, /schema:version\s+"1\.0"/);
  const quads = new Parser({ format: "text/turtle" }).parse(baseline);
  assert.equal(quads.some((quad) => ["usageInfo", "license", "citation"].some((name) => quad.predicate.value === `https://schema.org/${name}`)), false);
  assert.doesNotMatch(baseline, /<https:\/\/github\.com\/kgrid-objects\/FAIR-DO-Workshop\/tree\/main\/collection\/margolis-dfu-prognostic#scope>\s*\n\s*a /);
});

test("complete canonical KO 4 metadata satisfies all Reusability unlock requirements", async () => {
  assert.deepEqual(evaluateReusabilityEnrichment(await canonicalTargetSource()), { valid: true, scope: true, license: true, evidence: true, complete: true, message: "" });
});

test("Evidence choices use compact citations with identifiers as secondary information", async () => {
  const options = getReusabilityEvidencePresentationOptions(await canonicalTargetSource(), await embeddedTargetFile("metadata.json"));
  assert.equal(options.length, 2);
  assert.ok(options.every((option) => option.citation.includes("Margolis DJ, et al.")));
  assert.ok(options.every((option) => option.citation.includes("Further evidence that wound size and duration are strong prognostic markers")));
  assert.deepEqual(options.map((option) => option.identifier), ["DOI · 10.1111/wrr.13019", "PubMed · 35470507"]);
});

test("Reusability working baseline generation is deterministic", async () => {
  const canonical = await canonicalTargetSource();
  assert.equal(createReusabilityEnrichmentBaseline(canonical), createReusabilityEnrichmentBaseline(canonical));
});

test("guided Reusability edits create a valid complete record", async () => {
  const canonical = await canonicalTargetSource();
  let working = createReusabilityEnrichmentBaseline(canonical);
  working = setReusabilityScope(working, canonical, "Applies to the declared population and first-visit assessment context.");
  const licenses = getReusabilityLicenseOptions(canonical);
  const evidence = getReusabilityEvidenceOptions(canonical);
  assert.equal(licenses.length, 1);
  assert.equal(evidence.length, 2);
  working = setReusabilityLicenses(working, canonical, licenses.map((option) => option.iri));
  working = setReusabilityEvidence(working, canonical, evidence.map((option) => option.iri));
  assert.doesNotThrow(() => new Parser({ format: "text/turtle" }).parse(working));
  assert.equal(evaluateReusabilityEnrichment(working).complete, true);
  assert.match(working, /Applies to the declared population/);
  assert.match(working, /spdx\.org\/licenses\/MIT\.html/);
  assert.match(working, /doi\.org\/10\.1111\/wrr\.13019/);
});

test("both declared evidence items are mandatory", async () => {
  const canonical = await canonicalTargetSource();
  const evidence = getReusabilityEvidenceOptions(canonical);
  assert.equal(evidence.length, 2);
  let working = createReusabilityEnrichmentBaseline(canonical);
  working = setReusabilityScope(working, canonical, "Applies to the declared population and assessment context.");
  working = setReusabilityLicenses(working, canonical, getReusabilityLicenseOptions(canonical).map((option) => option.iri));
  working = setReusabilityEvidence(working, canonical, [evidence[0].iri]);
  assert.equal(evaluateReusabilityEnrichment(working).evidence, false);
  assert.equal(getReusabilityUnlockState(working).unlocked, false);
  working = setReusabilityEvidence(working, canonical, evidence.map((option) => option.iri));
  assert.equal(evaluateReusabilityEnrichment(working).evidence, true);
  assert.equal(getReusabilityUnlockState(working).unlocked, true);
});

test("incomplete Reusability work preserves partial controlled selections", async () => {
  const canonical = await canonicalTargetSource();
  const evidence = getReusabilityEvidenceOptions(canonical);
  const partial = constructReusabilityMetadata(canonical, {
    scope: "A valid learner scope that remains incomplete.",
    licenseIris: [],
    evidenceIris: [evidence[0].iri],
  });
  const recovered = getReusabilityEnrichmentInput(partial);
  assert.equal(recovered.scope, "A valid learner scope that remains incomplete.");
  assert.deepEqual(recovered.evidenceIris, [evidence[0].iri]);
  assert.deepEqual(recovered.licenseIris, []);
  assert.equal(getReusabilityUnlockState(partial).unlocked, false);
  assert.doesNotThrow(() => new Parser({ format: "text/turtle" }).parse(partial));
});

test("Reusability construction is deterministic, idempotent, and independent of selection order", async () => {
  const canonical = await canonicalTargetSource();
  const licenses = getReusabilityLicenseOptions(canonical).map((option) => option.iri);
  const evidence = getReusabilityEvidenceOptions(canonical).map((option) => option.iri);
  const input = { scope: "Applies to the declared population and assessment context.", licenseIris: licenses, evidenceIris: evidence };
  const first = constructReusabilityMetadata(canonical, input);
  const reordered = constructReusabilityMetadata(canonical, { ...input, licenseIris: [...licenses].reverse(), evidenceIris: [...evidence].reverse() });
  const rebuilt = constructReusabilityMetadata(canonical, getReusabilityEnrichmentInput(first));
  assert.equal(first, reordered);
  assert.equal(first, rebuilt);
  assert.equal(evaluateReusabilityEnrichment(first).complete, true);
});

test("Reusability construction preserves the canonical document outside controlled insertion points", async () => {
  const canonical = await canonicalTargetSource();
  assert.equal(constructReusabilityMetadata(canonical, getReusabilityEnrichmentInput(canonical)), canonical);
  const constructed = constructReusabilityMetadata(canonical, {
    scope: 'A learner scope with "quotes" and a newline.\nIt remains safe Turtle.',
    licenseIris: getReusabilityLicenseOptions(canonical).map(({ iri }) => iri),
    evidenceIris: getReusabilityEvidenceOptions(canonical).map(({ iri }) => iri),
  });
  assert.match(constructed, /# 4\. Provenance/);
  assert.match(constructed, /# Minimal Reusability Profile/);
  assert.equal(constructed.includes('\\"quotes\\" and a newline.\\nIt remains safe Turtle'), true);
  assert.doesNotThrow(() => new Parser({ format: "text/turtle" }).parse(constructed));
});

test("Reusability unlocks only after all three requirements are valid", async () => {
  const canonical = await canonicalTargetSource();
  const status = ({ completed, total, unlocked }) => ({ completed, total, unlocked });
  assert.deepEqual(status(getReusabilityUnlockState(createReusabilityEnrichmentBaseline(canonical))), { completed: 0, total: 3, unlocked: false });
  assert.deepEqual(status(getReusabilityUnlockState(canonical)), { completed: 3, total: 3, unlocked: true });
});
