import { createTermInsightRecord } from "./term-insight.js";
import { EMBEDDED_VOCABULARY_REGISTRY } from "./term-vocabulary-registry.js";

/** Only linked, named RDF resources receive preview and details controls. */
export function isTermInsightEligible(term) {
  return term?.termType === "NamedNode";
}

/** Return a normalized user-navigable URL without fetching it. */
export function safeExternalHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let parsed;
  try { parsed = new URL(value.trim()); } catch { return null; }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
  return parsed.href;
}

/** Derive display-only IRI facts without dereferencing the IRI. */
export function deriveSafeIriFallback(iri) {
  if (typeof iri !== "string" || !/^https?:\/\//.test(iri)) return null;
  let parsed;
  try { parsed = new URL(iri); } catch { return null; }
  const fragment = parsed.hash.slice(1);
  const pathParts = parsed.pathname.split("/").filter(Boolean);
  const localPart = fragment || pathParts.at(-1) || parsed.hostname;
  const namespaceIri = fragment
    ? iri.slice(0, iri.indexOf("#") + 1)
    : pathParts.length
      ? new URL(`${pathParts.slice(0, -1).join("/")}${pathParts.length > 1 ? "/" : ""}`, `${parsed.origin}/`).href
      : `${parsed.origin}/`;
  const namespaceLabel = parsed.hostname.replace(/^www\./, "");
  const categorySource = fragment ? "fragment" : pathParts.length > 1 ? pathParts.at(-2) : pathParts.length ? pathParts[0] : "web";
  const readableCategory = (() => { try { return decodeURIComponent(categorySource); } catch { return categorySource; } })()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  const resourceCategory = `${readableCategory || "Web"} resource`;
  return Object.freeze({ namespaceLabel, namespaceIri, host: parsed.host, localIdentifier: localPart, compactIdentifier: `${namespaceLabel}:${localPart}`, resourceCategory: resourceCategory[0].toUpperCase() + resourceCategory.slice(1) });
}

/** Resolve information carried by the selected graph before any registry fallback. */
export function resolveLocalGraphTermInsightInput(graph, selectedTerm, options = {}) {
  if (!graph || !Array.isArray(graph.statements) || !selectedTerm?.id) throw new TypeError("A selected RDF graph and term are required.");
  const registry = options.registry && typeof options.registry === "object" ? options.registry : {};
  const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
  const SCHEMA = "https://schema.org/";
  const labelPredicates = [SCHEMA + "name", "http://purl.org/dc/terms/title", "http://www.w3.org/2004/02/skos/core#prefLabel", "http://www.w3.org/2000/01/rdf-schema#label", SCHEMA + "alternateName"];
  const descriptionPredicates = [SCHEMA + "description", SCHEMA + "abstract", "http://purl.org/dc/terms/description", "http://www.w3.org/2004/02/skos/core#definition", "http://www.w3.org/2000/01/rdf-schema#comment"];
  const statements = graph.statements;
  const outgoing = statements.filter((statement) => statement.subject?.id === selectedTerm.id);
  const incoming = statements.filter((statement) => statement.object?.id === selectedTerm.id);
  const languageRank = (language) => language === "en" || language.startsWith("en-") ? 0 : language === "" ? 1 : 2;
  const localLiteral = (predicates) => outgoing
    .filter((statement) => predicates.includes(statement.predicate?.value) && statement.object?.termType === "Literal")
    .map((statement, order) => ({ value: statement.object.value, rank: predicates.indexOf(statement.predicate.value), language: statement.object.language ?? "", order }))
    .sort((left, right) => left.rank - right.rank || languageRank(left.language) - languageRank(right.language) || left.order - right.order)[0]?.value ?? "";
  const fragmentLabel = (term) => {
    if (term.termType === "Literal") return term.value;
    if (term.termType === "BlankNode") return term.humanLabel || "Nested structure";
    const fragment = String(term.value ?? "").replace(/[\/#]+$/, "").split(/[\/#]/).pop() || "Resource";
    try { return decodeURIComponent(fragment).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ").trim(); } catch { return fragment; }
  };
  const registered = selectedTerm.termType === "NamedNode" ? registry[selectedTerm.value] ?? null : null;
  const iriFallback = selectedTerm.termType === "NamedNode" ? deriveSafeIriFallback(selectedTerm.value) : null;
  const label = localLiteral(labelPredicates) || selectedTerm.humanLabel || registered?.label || fragmentLabel(selectedTerm);
  const localExplanation = localLiteral(descriptionPredicates);
  const explanation = localExplanation || registered?.explanation || "";
  const descriptionStatus = localExplanation ? "local-metadata" : registered?.explanation ? "embedded-vocabulary" : selectedTerm.termType === "NamedNode" && /^https?:\/\//.test(selectedTerm.value) ? "external-source-only" : "unavailable";
  const vocabulary = registered?.vocabulary ?? (() => {
    if (selectedTerm.termType !== "NamedNode") return null;
    const namespace = [...(graph.namespaces ?? [])].filter((entry) => selectedTerm.value.startsWith(entry.iri)).sort((left, right) => right.iri.length - left.iri.length)[0];
    return namespace ? { label: namespace.prefix === "(default)" || !namespace.prefix ? namespace.iri : namespace.prefix, namespaceIri: namespace.iri }
      : iriFallback ? { label: iriFallback.namespaceLabel, namespaceIri: iriFallback.namespaceIri } : null;
  })();
  const predicateLabel = (predicate) => registry[predicate.value]?.label || predicate.presentationLabel || predicate.humanLabel || predicate.compact || fragmentLabel(predicate);
  const termLabel = (term) => {
    if (term.id === selectedTerm.id) return label;
    const ownName = statements.filter((statement) => statement.subject?.id === term.id && labelPredicates.includes(statement.predicate?.value) && statement.object?.termType === "Literal").sort((left, right) => labelPredicates.indexOf(left.predicate.value) - labelPredicates.indexOf(right.predicate.value))[0]?.object?.value;
    return ownName || term.humanLabel || registry[term.value]?.label || fragmentLabel(term);
  };
  const relationship = (statement, relatedTerm) => ({ statementId: statement.id, relationshipLabel: predicateLabel(statement.predicate), predicateIri: statement.predicate.value, relatedTermId: relatedTerm.id, relatedLabel: termLabel(relatedTerm) });
  const types = outgoing.filter((statement) => statement.predicate?.value === RDF_TYPE).map((statement) => statement.object?.value);
  const category = selectedTerm.termType === "Literal" ? "literal"
    : selectedTerm.termType === "BlankNode" ? "nested-structure"
      : types.includes(SCHEMA + "DefinedTerm") || outgoing.some((statement) => statement.predicate?.value === SCHEMA + "termCode" || statement.predicate?.value === SCHEMA + "inDefinedTermSet") ? "controlled-term"
        : types.includes(SCHEMA + "DefinedTermSet") ? "vocabulary"
          : statements.some((statement) => statement.predicate?.id === selectedTerm.id) || registered?.termKind === "property" ? "property" : "resource";
  const selectedStatement = options.statement ?? null;
  const role = options.role ?? (selectedStatement?.subject?.id === selectedTerm.id ? "subject" : selectedStatement?.predicate?.id === selectedTerm.id ? "predicate" : selectedStatement?.object?.id === selectedTerm.id ? "object" : null);
  return {
    termId: selectedTerm.id,
    label,
    category,
    compactIdentifier: selectedTerm.compact && selectedTerm.compact !== selectedTerm.value ? selectedTerm.compact : selectedTerm.termType === "BlankNode" ? `_:${selectedTerm.value}` : iriFallback?.compactIdentifier || selectedTerm.value,
    authoritativeIri: selectedTerm.termType === "NamedNode" ? selectedTerm.value : null,
    vocabulary,
    explanation,
    descriptionStatus,
    localRelationships: { incoming: incoming.map((statement) => relationship(statement, statement.subject)), outgoing: outgoing.map((statement) => relationship(statement, statement.object)) },
    statementContext: selectedStatement && role ? { statementId: selectedStatement.id, role, subjectLabel: termLabel(selectedStatement.subject), relationshipLabel: predicateLabel(selectedStatement.predicate), valueLabel: termLabel(selectedStatement.object) } : null,
    iriFallback: iriFallback ? { applied: !registered, descriptionAvailable: Boolean(explanation), namespaceLabel: iriFallback.namespaceLabel, namespaceIri: iriFallback.namespaceIri, host: iriFallback.host, resourceCategory: iriFallback.resourceCategory } : null,
    externalUrl: safeExternalHttpUrl(registered?.externalUrl) ?? (selectedTerm.termType === "NamedNode" ? safeExternalHttpUrl(selectedTerm.value) : null),
  };
}

export function resolveLocalGraphTermInsight(graph, selectedTerm, options = {}) {
  return createTermInsightRecord(resolveLocalGraphTermInsightInput(graph, selectedTerm, { ...options, registry: options.registry ?? EMBEDDED_VOCABULARY_REGISTRY }));
}
