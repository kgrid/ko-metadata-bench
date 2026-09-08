import { DataFactory, Parser, Writer } from "n3";
import { renderFindabilityCanonicalTemplate } from "./canonical-metadata-renderer.js";
import { assertControlledMetadataEquivalence } from "./metadata-semantic-equivalence.js";

export const FINDABILITY_ENRICHMENT_TARGET = 4;
export const FINDABILITY_ENRICHMENT_FILE = "findability.metadata.txt";

const SCHEMA = "https://schema.org/";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const CONTROLLED_SUBJECT_PRESENTATION = new Map([
  ["http://id.nlm.nih.gov/mesh/D017719", { label: "Diabetic Foot", description: "Foot problems associated with diabetes, including ulceration and related complications." }],
  ["http://id.nlm.nih.gov/mesh/D011379", { label: "Prognosis", description: "A prediction of the probable outcome of a disease based on an individual’s condition and comparable situations." }],
  ["http://id.nlm.nih.gov/mesh/D014945", { label: "Wound Healing", description: "Restoration of integrity to injured tissue." }],
]);

function prefixesFrom(source) {
  return Object.fromEntries([...source.matchAll(/^\s*@prefix\s+([^:]*):\s*<([^>]+)>\s*\.\s*$/gim)].map((match) => [match[1], match[2]]));
}

function serializeDeterministically(quads, prefixes) {
  const prefixHeader = Object.entries(prefixes).map(([prefix, iri]) => `@prefix ${prefix}: <${iri}> .`).join("\n");
  const blankNodes = new Map();
  const canonicalTerm = (term) => {
    if (term.termType !== "BlankNode") return term;
    if (!blankNodes.has(term.id)) blankNodes.set(term.id, DataFactory.blankNode(`enrichment-${blankNodes.size + 1}`));
    return blankNodes.get(term.id);
  };
  const canonicalQuads = quads.map((quad) => DataFactory.quad(canonicalTerm(quad.subject), quad.predicate, canonicalTerm(quad.object), quad.graph));
  const body = new Writer({ prefixes }).quadsToString(canonicalQuads);
  return `${prefixHeader}\n\n${body.trimEnd()}\n`;
}

function enrichmentContext(quads) {
  const primary = quads.find((quad) => quad.subject.termType === "NamedNode")?.subject;
  if (!primary) throw new Error("Findability metadata has no primary named resource.");
  const additionalProperties = quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "additionalProperty");
  const outputProperty = additionalProperties.find((quad) => quads.some((candidate) => candidate.subject.equals(quad.object) && candidate.predicate.value === SCHEMA + "name" && candidate.object.value === "Output classification"))?.object;
  const termSet = outputProperty ? quads.find((quad) => quad.subject.equals(outputProperty) && quad.predicate.value === SCHEMA + "valueReference")?.object : undefined;
  const definedTerms = termSet ? quads.filter((quad) => quad.subject.equals(termSet) && quad.predicate.value === SCHEMA + "hasDefinedTerm").map((quad) => quad.object) : [];
  return { primary, outputProperty, termSet, definedTerms };
}

function replacePrimaryPredicate(source, predicate, objects) {
  const quads = new Parser({ format: "text/turtle" }).parse(source);
  const { primary } = enrichmentContext(quads);
  const retained = quads.filter((quad) => !(quad.subject.equals(primary) && quad.predicate.value === predicate));
  for (const object of objects) retained.push(DataFactory.quad(primary, DataFactory.namedNode(predicate), object));
  return serializeDeterministically(retained, prefixesFrom(source));
}

function reachableSubjectQuads(quads, roots) {
  const subjects = new Map(roots.map((term) => [term.id, term]));
  const queue = [...roots];
  while (queue.length) {
    const subject = queue.shift();
    for (const quad of quads.filter((candidate) => candidate.subject.equals(subject))) {
      if ((quad.object.termType === "BlankNode" || quad.object.termType === "NamedNode") && !subjects.has(quad.object.id)) {
        subjects.set(quad.object.id, quad.object);
        queue.push(quad.object);
      }
    }
  }
  return quads.filter((quad) => subjects.has(quad.subject.id));
}

export function createFindabilityEnrichmentBaseline(canonicalSource) {
  return assertControlledMetadataEquivalence("findability", canonicalSource, renderFindabilityCanonicalTemplate(canonicalSource, {}, findabilityCanonicalOptions(canonicalSource)));
}

function findabilityCanonicalOptions(canonicalSource) {
  const subjectIris = getFindabilitySubjectOptions(canonicalSource).map(({ iri }) => iri);
  const outputTermIris = getFindabilityOutputTermOptions(canonicalSource).map(({ iri }) => iri);
  const outputTermSetIri = getFindabilityOutputVocabularyOptions(canonicalSource)[0]?.iri || "";
  return { subjectIris, outputTermIris, outputTermSetIri };
}

export function getCanonicalFindabilityName(canonicalSource) {
  const quads = new Parser({ format: "text/turtle" }).parse(canonicalSource);
  const { primary } = enrichmentContext(quads);
  const name = quads.find((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "name")?.object.value.trim();
  if (!name) throw new Error("Canonical Findability metadata has no full name.");
  return name;
}

export function confirmFindabilityFullName(workingSource, canonicalSource) {
  const quads = new Parser({ format: "text/turtle" }).parse(workingSource);
  const { primary } = enrichmentContext(quads);
  const withoutName = quads.filter((quad) => !(quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "name"));
  withoutName.push(DataFactory.quad(primary, DataFactory.namedNode(SCHEMA + "name"), DataFactory.literal(getCanonicalFindabilityName(canonicalSource))));
  return serializeDeterministically(withoutName, prefixesFrom(workingSource));
}

export function setFindabilityNameConfirmation(workingSource, canonicalSource, confirmed) {
  return confirmed ? confirmFindabilityFullName(workingSource, canonicalSource) : replacePrimaryPredicate(workingSource, SCHEMA + "name", []);
}

export function setFindabilityDescription(source, description) {
  const value = String(description).trim();
  return replacePrimaryPredicate(source, SCHEMA + "abstract", value ? [DataFactory.literal(value)] : []);
}

export function setFindabilitySearchTerms(source, terms) {
  const values = [...new Map(terms.map((term) => String(term).trim()).filter(Boolean).map((term) => [term.toLocaleLowerCase(), term])).values()];
  return replacePrimaryPredicate(source, SCHEMA + "keywords", values.map((value) => DataFactory.literal(value)));
}

export function getFindabilitySubjectOptions(canonicalSource) {
  const quads = new Parser({ format: "text/turtle" }).parse(canonicalSource);
  const { primary } = enrichmentContext(quads);
  return quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "about" && quad.object.termType === "NamedNode").map((quad) => {
    const presentation = CONTROLLED_SUBJECT_PRESENTATION.get(quad.object.value);
    const label = quads.find((candidate) => candidate.subject.equals(quad.object) && candidate.predicate.value === SCHEMA + "name" && candidate.object.termType === "Literal")?.object.value;
    const description = quads.find((candidate) => candidate.subject.equals(quad.object) && candidate.predicate.value === SCHEMA + "description" && candidate.object.termType === "Literal")?.object.value;
    return { iri: quad.object.value, label: label || presentation?.label || decodeURIComponent(quad.object.value.replace(/[\/#]+$/, "").split(/[\/#]/).at(-1) || quad.object.value), description: description || presentation?.description || "A controlled subject identified by this vocabulary term." };
  });
}

export function getSelectedFindabilitySubjects(source) {
  const quads = new Parser({ format: "text/turtle" }).parse(source);
  const { primary } = enrichmentContext(quads);
  return quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "about" && quad.object.termType === "NamedNode").map((quad) => quad.object.value);
}

export function getFindabilityTextValues(source) {
  const quads = new Parser({ format: "text/turtle" }).parse(source);
  const { primary } = enrichmentContext(quads);
  const values = (predicate) => quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === predicate && quad.object.termType === "Literal").map((quad) => quad.object.value);
  return { description: values(SCHEMA + "abstract")[0] || "", searchTerms: values(SCHEMA + "keywords") };
}

export function setFindabilityControlledSubjects(source, canonicalSource, selectedIris) {
  const canonicalQuads = new Parser({ format: "text/turtle" }).parse(canonicalSource);
  const requested = new Set(selectedIris);
  const selected = getFindabilitySubjectOptions(canonicalSource).filter((option) => requested.has(option.iri)).map((option) => DataFactory.namedNode(option.iri));
  let updated = replacePrimaryPredicate(source, SCHEMA + "about", selected);
  const updatedQuads = new Parser({ format: "text/turtle" }).parse(updated);
  const additions = reachableSubjectQuads(canonicalQuads, selected).filter((quad) => !updatedQuads.some((candidate) => candidate.equals(quad)));
  return serializeDeterministically([...updatedQuads, ...additions], prefixesFrom(updated));
}

export function getFindabilityOutputVocabularyOptions(canonicalSource) {
  const quads = new Parser({ format: "text/turtle" }).parse(canonicalSource);
  const { outputProperty, termSet } = enrichmentContext(quads);
  if (!outputProperty || !termSet) return [];
  const label = quads.find((quad) => quad.subject.equals(termSet) && quad.predicate.value === SCHEMA + "name" && quad.object.termType === "Literal")?.object.value || termSet.value;
  return [{ iri: termSet.value, label }];
}

export function getFindabilityOutputTermOptions(canonicalSource) {
  const quads = new Parser({ format: "text/turtle" }).parse(canonicalSource);
  const { termSet } = enrichmentContext(quads);
  if (!termSet) return [];
  return quads.filter((quad) => quad.subject.equals(termSet) && quad.predicate.value === SCHEMA + "hasDefinedTerm").map((quad) => {
    const statements = quads.filter((candidate) => candidate.subject.equals(quad.object));
    const literal = (predicate) => statements.find((candidate) => candidate.predicate.value === SCHEMA + predicate && candidate.object.termType === "Literal")?.object.value || "";
    return { iri: quad.object.value, label: literal("name") || quad.object.value, code: literal("termCode"), description: literal("description") };
  });
}

export function getSelectedFindabilityOutputTerms(source) {
  const quads = new Parser({ format: "text/turtle" }).parse(source);
  const { termSet } = enrichmentContext(quads);
  return termSet ? quads.filter((quad) => quad.subject.equals(termSet) && quad.predicate.value === SCHEMA + "hasDefinedTerm").map((quad) => quad.object.value) : [];
}

export function setFindabilityOutputTerms(source, canonicalSource, selectedIris) {
  const current = new Parser({ format: "text/turtle" }).parse(source);
  const canonical = new Parser({ format: "text/turtle" }).parse(canonicalSource);
  const currentContext = enrichmentContext(current);
  const canonicalContext = enrichmentContext(canonical);
  const requested = new Set(selectedIris);
  const selected = getFindabilityOutputTermOptions(canonicalSource).map((option) => option.iri).filter((iri) => requested.has(iri));
  const removableSubjects = [currentContext.outputProperty, currentContext.termSet, ...currentContext.definedTerms].filter(Boolean);
  const retained = current.filter((quad) => !(quad.subject.equals(currentContext.primary) && quad.predicate.value === SCHEMA + "additionalProperty" && currentContext.outputProperty && quad.object.equals(currentContext.outputProperty)) && !removableSubjects.some((subject) => quad.subject.equals(subject)));
  if (selected.length && canonicalContext.outputProperty && canonicalContext.termSet) {
    const rootLink = canonical.find((quad) => quad.subject.equals(canonicalContext.primary) && quad.predicate.value === SCHEMA + "additionalProperty" && quad.object.equals(canonicalContext.outputProperty));
    if (rootLink) retained.push(DataFactory.quad(currentContext.primary, rootLink.predicate, rootLink.object));
    retained.push(...canonical.filter((quad) => quad.subject.equals(canonicalContext.outputProperty)));
    retained.push(...canonical.filter((quad) => quad.subject.equals(canonicalContext.termSet) && quad.predicate.value !== SCHEMA + "hasDefinedTerm"));
    for (const iri of selected) {
      const term = DataFactory.namedNode(iri);
      retained.push(DataFactory.quad(canonicalContext.termSet, DataFactory.namedNode(SCHEMA + "hasDefinedTerm"), term));
      retained.push(...canonical.filter((quad) => quad.subject.equals(term)));
    }
  }
  return serializeDeterministically(retained, prefixesFrom(source));
}

export function getSelectedFindabilityOutputVocabulary(source) {
  const quads = new Parser({ format: "text/turtle" }).parse(source);
  return enrichmentContext(quads).termSet?.value || "";
}

export function setFindabilityOutputVocabulary(source, canonicalSource, selectedIri) {
  const current = new Parser({ format: "text/turtle" }).parse(source);
  const canonical = new Parser({ format: "text/turtle" }).parse(canonicalSource);
  const currentContext = enrichmentContext(current);
  const canonicalContext = enrichmentContext(canonical);
  const removableSubjects = [currentContext.outputProperty, currentContext.termSet, ...currentContext.definedTerms].filter(Boolean);
  const retained = current.filter((quad) => !(quad.subject.equals(currentContext.primary) && quad.predicate.value === SCHEMA + "additionalProperty" && currentContext.outputProperty && quad.object.equals(currentContext.outputProperty)) && !removableSubjects.some((subject) => quad.subject.equals(subject)));
  if (selectedIri && canonicalContext.outputProperty && canonicalContext.termSet?.value === selectedIri) {
    const rootLink = canonical.find((quad) => quad.subject.equals(canonicalContext.primary) && quad.predicate.value === SCHEMA + "additionalProperty" && quad.object.equals(canonicalContext.outputProperty));
    if (rootLink) retained.push(DataFactory.quad(currentContext.primary, rootLink.predicate, rootLink.object));
    retained.push(...reachableSubjectQuads(canonical, [canonicalContext.outputProperty]));
  }
  return serializeDeterministically(retained, prefixesFrom(source));
}

export function getFindabilityEnrichmentInput(source) {
  const state = evaluateFindabilityEnrichment(source);
  const text = getFindabilityTextValues(source);
  return {
    fullNameConfirmed: state.fullName,
    description: text.description,
    controlledSubjectIris: getSelectedFindabilitySubjects(source),
    searchTerms: text.searchTerms,
    outputTermIris: getSelectedFindabilityOutputTerms(source),
  };
}

export function constructFindabilityMetadata(canonicalSource, input = {}) {
  return assertControlledMetadataEquivalence("findability", canonicalSource, renderFindabilityCanonicalTemplate(canonicalSource, input, findabilityCanonicalOptions(canonicalSource)));
}

export function evaluateFindabilityEnrichment(source) {
  let quads;
  try { quads = new Parser({ format: "text/turtle" }).parse(source); }
  catch (error) {
    return { valid: false, fullName: false, description: false, controlledSubject: false, searchTerms: false, outputVocabulary: false, complete: false, message: error instanceof Error ? error.message : "Turtle parsing failed." };
  }
  const { primary, outputProperty, termSet } = enrichmentContext(quads);
  const values = (predicate) => quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === predicate).map((quad) => quad.object.value.trim()).filter(Boolean);
  const fullName = values(SCHEMA + "name").length > 0;
  const description = values(SCHEMA + "abstract").some((value) => value.length > 10);
  const controlledSubject = values(SCHEMA + "about").length > 0;
  const searchTerms = new Set(values(SCHEMA + "keywords").map((value) => value.toLocaleLowerCase())).size >= 3;
  const outputVocabulary = Boolean(outputProperty && termSet && new Set(quads.filter((quad) => quad.subject.equals(termSet) && quad.predicate.value === SCHEMA + "hasDefinedTerm").map((quad) => quad.object.value)).size >= 4 && quads.some((quad) => quad.subject.equals(outputProperty) && quad.predicate.value === RDF_TYPE && quad.object.value === SCHEMA + "PropertyValue"));
  return { valid: true, fullName, description, controlledSubject, searchTerms, outputVocabulary, complete: fullName && description && controlledSubject && searchTerms && outputVocabulary, message: "" };
}

export function getFindabilityUnlockState(source) {
  const state = evaluateFindabilityEnrichment(source);
  const completed = [state.fullName, state.description, state.controlledSubject, state.searchTerms, state.outputVocabulary].filter(Boolean).length;
  return { ...state, completed, total: 5, unlocked: state.valid && state.complete };
}
