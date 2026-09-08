import { DataFactory, Parser, Writer } from "n3";
import { renderReusabilityCanonicalTemplate } from "./canonical-metadata-renderer.js";
import { assertControlledMetadataEquivalence } from "./metadata-semantic-equivalence.js";

export const REUSABILITY_ENRICHMENT_TARGET = 4;
export const REUSABILITY_ENRICHMENT_FILE = "reusability.metadata.txt";

const SCHEMA = "https://schema.org/";

function prefixesFrom(source) {
  return Object.fromEntries([...source.matchAll(/^\s*@prefix\s+([^:]*):\s*<([^>]+)>\s*\.\s*$/gim)].map((match) => [match[1], match[2]]));
}

function serializeDeterministically(quads, prefixes) {
  const prefixHeader = Object.entries(prefixes).map(([prefix, iri]) => `@prefix ${prefix}: <${iri}> .`).join("\n");
  const blankNodes = new Map();
  const canonicalTerm = (term) => {
    if (term.termType !== "BlankNode") return term;
    if (!blankNodes.has(term.id)) blankNodes.set(term.id, DataFactory.blankNode(`reusability-enrichment-${blankNodes.size + 1}`));
    return blankNodes.get(term.id);
  };
  const canonicalQuads = quads.map((quad) => DataFactory.quad(canonicalTerm(quad.subject), quad.predicate, canonicalTerm(quad.object), quad.graph));
  const body = new Writer({ prefixes }).quadsToString(canonicalQuads);
  return `${prefixHeader}\n\n${body.trimEnd()}\n`;
}

function primaryResource(quads) {
  const primary = quads.find((quad) => quad.subject.termType === "NamedNode")?.subject;
  if (!primary) throw new Error("Reusability metadata has no primary named resource.");
  return primary;
}

function replacePrimaryPredicate(source, predicate, objects) {
  const quads = new Parser({ format: "text/turtle" }).parse(source);
  const primary = primaryResource(quads);
  const retained = quads.filter((quad) => !(quad.subject.equals(primary) && quad.predicate.value === predicate));
  objects.forEach((object) => retained.push(DataFactory.quad(primary, DataFactory.namedNode(predicate), object)));
  return serializeDeterministically(retained, prefixesFrom(source));
}

function resourceLabel(iri) {
  try {
    const url = new URL(iri);
    const tail = decodeURIComponent(url.pathname.replace(/\/$/, "").split("/").at(-1) || url.hostname);
    if (url.hostname === "doi.org") return `DOI · ${decodeURIComponent(url.pathname.replace(/^\//, "").replace(/\/$/, ""))}`;
    if (url.hostname.includes("pubmed.ncbi.nlm.nih.gov")) return `PubMed · ${tail}`;
    if (url.hostname === "spdx.org") return `${tail.replace(/\.html$/i, "")} License`;
    return `${url.hostname} · ${tail}`;
  } catch { return iri; }
}

export function createReusabilityEnrichmentBaseline(canonicalSource) {
  return assertControlledMetadataEquivalence("reusability", canonicalSource, renderReusabilityCanonicalTemplate(canonicalSource, {}, reusabilityCanonicalOptions(canonicalSource)));
}

function reusabilityCanonicalOptions(canonicalSource) {
  const quads = new Parser({ format: "text/turtle" }).parse(canonicalSource);
  const primary = primaryResource(quads);
  const scopeIri = quads.find((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "usageInfo")?.object.value || "";
  return {
    scopeIri,
    licenseIris: getReusabilityLicenseOptions(canonicalSource).map(({ iri }) => iri),
    evidenceIris: getReusabilityEvidenceOptions(canonicalSource).map(({ iri }) => iri),
  };
}

export function evaluateReusabilityEnrichment(source) {
  let quads;
  try { quads = new Parser({ format: "text/turtle" }).parse(source); }
  catch (error) {
    return { valid: false, scope: false, license: false, evidence: false, complete: false, message: error instanceof Error ? error.message : "Turtle parsing failed." };
  }
  const primary = primaryResource(quads);
  const scopeLinks = quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "usageInfo").map((quad) => quad.object);
  const scope = scopeLinks.some((resource) => quads.some((quad) => quad.subject.equals(resource) && quad.predicate.value === SCHEMA + "description" && quad.object.termType === "Literal" && quad.object.value.trim().length > 10));
  const license = quads.some((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "license" && quad.object.value.trim());
  const evidence = new Set(quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "citation" && quad.object.value.trim()).map((quad) => quad.object.value)).size >= 2;
  return { valid: true, scope, license, evidence, complete: scope && license && evidence, message: "" };
}

export function getReusabilityScopeText(source) {
  const quads = new Parser({ format: "text/turtle" }).parse(source);
  const primary = primaryResource(quads);
  const scopeResources = quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "usageInfo").map((quad) => quad.object);
  return scopeResources.map((resource) => quads.find((quad) => quad.subject.equals(resource) && quad.predicate.value === SCHEMA + "description" && quad.object.termType === "Literal")?.object.value || "").find(Boolean) || "";
}

export function setReusabilityScope(source, canonicalSource, text) {
  const current = new Parser({ format: "text/turtle" }).parse(source);
  const canonical = new Parser({ format: "text/turtle" }).parse(canonicalSource);
  const currentPrimary = primaryResource(current);
  const canonicalPrimary = primaryResource(canonical);
  const currentScopes = current.filter((quad) => quad.subject.equals(currentPrimary) && quad.predicate.value === SCHEMA + "usageInfo").map((quad) => quad.object);
  const canonicalScope = canonical.find((quad) => quad.subject.equals(canonicalPrimary) && quad.predicate.value === SCHEMA + "usageInfo")?.object;
  const retained = current.filter((quad) => !(quad.subject.equals(currentPrimary) && quad.predicate.value === SCHEMA + "usageInfo") && !currentScopes.some((resource) => quad.subject.equals(resource)));
  const value = String(text).trim();
  if (value && canonicalScope) {
    retained.push(DataFactory.quad(currentPrimary, DataFactory.namedNode(SCHEMA + "usageInfo"), canonicalScope));
    retained.push(...canonical.filter((quad) => quad.subject.equals(canonicalScope) && quad.predicate.value !== SCHEMA + "description"));
    retained.push(DataFactory.quad(canonicalScope, DataFactory.namedNode(SCHEMA + "description"), DataFactory.literal(value)));
  }
  return serializeDeterministically(retained, prefixesFrom(source));
}

export function getReusabilityLicenseOptions(canonicalSource) {
  const quads = new Parser({ format: "text/turtle" }).parse(canonicalSource);
  const primary = primaryResource(quads);
  return quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "license").map((quad) => ({ iri: quad.object.value, label: resourceLabel(quad.object.value), description: "The terms that govern permitted reuse of this knowledge object." }));
}

export function getSelectedReusabilityLicenses(source) {
  const quads = new Parser({ format: "text/turtle" }).parse(source);
  const primary = primaryResource(quads);
  return quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "license").map((quad) => quad.object.value);
}

export function setReusabilityLicenses(source, canonicalSource, selectedIris) {
  const requested = new Set(selectedIris);
  const selected = getReusabilityLicenseOptions(canonicalSource).map((option) => option.iri).filter((iri) => requested.has(iri)).map((iri) => DataFactory.namedNode(iri));
  return replacePrimaryPredicate(source, SCHEMA + "license", selected);
}

export function getReusabilityEvidenceOptions(canonicalSource) {
  const quads = new Parser({ format: "text/turtle" }).parse(canonicalSource);
  const primary = primaryResource(quads);
  return quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "citation").map((quad) => ({ iri: quad.object.value, label: resourceLabel(quad.object.value), description: "A declared source supporting the knowledge represented by this object." }));
}

function normalizedDoi(value) {
  return String(value || "").match(/10\.\d{4,9}\/[A-Z0-9._;()/:+-]+/i)?.[0].replace(/[.,;]+$/, "").toLowerCase() || "";
}

function compactBibliographicCitation(value) {
  const citation = String(value || "").replace(/^[A-Z]+-/, "").trim();
  const parts = citation.split(/\.\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return citation;
  const firstAuthor = parts[0].split(",")[0].trim();
  const year = citation.match(/\b(?:19|20)\d{2}\b/)?.[0];
  return `${firstAuthor}${parts[0].includes(",") ? ", et al." : ""} “${parts[1]}” ${parts[2]}${year ? ` (${year})` : ""}.`;
}

export function getReusabilityEvidencePresentationOptions(canonicalSource, metadataSource) {
  const options = getReusabilityEvidenceOptions(canonicalSource);
  let records = [];
  try {
    const metadata = JSON.parse(metadataSource || "{}");
    records = Array.isArray(metadata["dc:source"]) ? metadata["dc:source"] : [];
  } catch { /* Fall back to identifier-only evidence labels. */ }
  return options.map((option) => {
    const optionDoi = normalizedDoi(option.iri);
    const record = records.find((candidate) => candidate?.["@id"] === option.iri || (optionDoi && (normalizedDoi(candidate?.["@id"]) === optionDoi || normalizedDoi(candidate?.["dc:bibliographicCitation"]) === optionDoi)));
    const fullCitation = String(record?.["dc:bibliographicCitation"] || "").trim();
    return { ...option, citation: fullCitation ? compactBibliographicCitation(fullCitation) : option.label, identifier: option.label, fullCitation };
  });
}

export function getSelectedReusabilityEvidence(source) {
  const quads = new Parser({ format: "text/turtle" }).parse(source);
  const primary = primaryResource(quads);
  return quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "citation").map((quad) => quad.object.value);
}

export function setReusabilityEvidence(source, canonicalSource, selectedIris) {
  const requested = new Set(selectedIris);
  const selected = getReusabilityEvidenceOptions(canonicalSource).map((option) => option.iri).filter((iri) => requested.has(iri)).map((iri) => DataFactory.namedNode(iri));
  return replacePrimaryPredicate(source, SCHEMA + "citation", selected);
}

export function getReusabilityEnrichmentInput(source) {
  return {
    scope: getReusabilityScopeText(source),
    licenseIris: getSelectedReusabilityLicenses(source),
    evidenceIris: getSelectedReusabilityEvidence(source),
  };
}

export function constructReusabilityMetadata(canonicalSource, input = {}) {
  return assertControlledMetadataEquivalence("reusability", canonicalSource, renderReusabilityCanonicalTemplate(canonicalSource, input, reusabilityCanonicalOptions(canonicalSource)));
}

export function getReusabilityUnlockState(source) {
  const state = evaluateReusabilityEnrichment(source);
  const completed = [state.scope, state.license, state.evidence].filter(Boolean).length;
  return { ...state, completed, total: 3, unlocked: state.valid && state.complete };
}
