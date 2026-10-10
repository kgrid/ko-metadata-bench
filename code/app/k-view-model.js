import { resolveKnowledgeAnnotations } from "./knowledge-annotation-resolver.js";
import { deriveEvidenceLinkingCategory } from "./evidence-linking-category.js";

const asEntries = (value) => Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];

// Keep the declaration site: KO-level evidence is not attributed to every element.
export function buildKnowledgeViewModel(metadata) {
  const knowledge = asEntries(metadata?.["koio:hasKnowledge"] ?? metadata?.hasKnowledge);
  const isObjectReference = (entry) => asEntries(entry?.["@type"]).includes("koio:KnowledgeObject") || entry?.["@type"] === "koio:KnowledgeObject";
  const linkedKnowledgeObjects = knowledge.filter(isObjectReference);
  const elements = knowledge.filter((entry) => !isObjectReference(entry)).map((entry, index) => ({
    index,
    record: entry,
    implementations: asEntries(entry?.implementedBy),
    evidentialBasis: asEntries(entry?.["koio:hasEvidentialBasis"] ?? entry?.hasEvidentialBasis).map((record) => ({ record, declaredOn: "knowledge-element", elementIndex: index })),
  }));
  const koEvidentialBasis = asEntries(metadata?.["koio:hasEvidentialBasis"] ?? metadata?.hasEvidentialBasis)
    .map((record) => ({ record, declaredOn: "knowledge-object", elementIndex: null }));
  return { elements, linkedKnowledgeObjects, koEvidentialBasis };
}

const declaredText = (...values) => values.find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
const descriptionOf = (record) => declaredText(record?.["dc:description"], record?.["schema:description"]);

// A display projection does not change or infer the underlying evidence links.
export function projectKnowledgeViewModel(model, metadata, destinationStatuses = []) {
  const documentation = asEntries(metadata?.["koio:hasDocumentation"] ?? metadata?.hasDocumentation);
  const cks = documentation.find((record) =>
    asEntries(record?.["@type"]).includes("Specification Document") &&
    typeof record?.["@id"] === "string" && /\.docx$/i.test(record["@id"]));
  const citedSources = new Map(asEntries(metadata?.["dc:source"] ?? metadata?.source)
    .filter((source) => declaredText(source?.["@id"]))
    .map((source) => [source["@id"], source]));
  // An evidence resource may be a named part of a cited publication.
  // In that case its bibliographic citation belongs to the parent source.
  for (const source of citedSources.values()) {
    for (const part of asEntries(source?.["schema:hasPart"])) {
      const id = declaredText(part?.["@id"]);
      if (id && !citedSources.has(id)) citedSources.set(id, source);
    }
  }
  const evidence = (link) => {
    const record = link.record ?? {};
    const source = citedSources.get(record["@id"]) ?? {};
    const citation = declaredText(record["dc:bibliographicCitation"], source["dc:bibliographicCitation"]);
    const description = declaredText(descriptionOf(record), descriptionOf(source));
    return {
      identifier: declaredText(record["@id"]),
      name: declaredText(record["dc:title"], record["schema:name"], source["dc:title"], source["schema:name"], citation) || "Name not declared",
      citation: citation || "Citation not declared",
      description: description || "Description not declared",
      descriptionDeclared: Boolean(description),
      declaredOn: link.declaredOn,
      elementIndex: link.elementIndex,
    };
  };
  const elements = model.elements.map((element) => {
    const description = descriptionOf(element.record);
    return {
      index: element.index,
      identifier: declaredText(element.record?.["@id"]),
      name: declaredText(element.record?.["dc:title"], element.record?.["schema:name"]) || "Name not declared",
      description: description || "Description not declared",
      descriptionDeclared: Boolean(description),
      implementations: element.implementations.map((record) => ({
        path: declaredText(record?.["@id"]) || "Implementation path not declared",
        description: descriptionOf(record) || "Description not declared",
      })),
      evidentialBasis: element.evidentialBasis.map(evidence),
    };
  });
  const koEvidentialBasis = model.koEvidentialBasis.map(evidence);
  const seen = new Set();
  let evidenceCount = 0;
  for (const [index, item] of [...koEvidentialBasis, ...elements.flatMap((element) => element.evidentialBasis)].entries()) {
    // An unidentifiable reference cannot safely be merged with another one.
    const key = item.identifier || (item.citation !== "Citation not declared" ? `citation:${item.citation}` : `anonymous:${index}`);
    if (!seen.has(key)) { seen.add(key); evidenceCount += 1; }
  }
  const isKnowledgeAssembly = metadata?.["schema:category"] === "Knowledge Assembly";
  const dependencyCount = isKnowledgeAssembly
    ? new Set(model.linkedKnowledgeObjects.map((record) => declaredText(record?.["@id"])).filter(Boolean)).size
    : null;
  const annotationResolution = resolveKnowledgeAnnotations(metadata);
  return {
    elements, linkedKnowledgeObjects: model.linkedKnowledgeObjects, koEvidentialBasis, evidenceCount, dependencyCount,
    annotationResolution: {
      ...annotationResolution,
      annotations: annotationResolution.annotations.map((annotation) => ({
        ...annotation,
        destination: destinationStatuses.find((status) => status.annotationId === annotation.id && status.targetId === annotation.targetId)
          ?? { status: "not-checked", reason: "Passage has not been checked against embedded content" },
      })),
    },
    linkingCategory: deriveEvidenceLinkingCategory(metadata),
    cks: cks ? { path: cks["@id"], name: declaredText(cks["dc:title"], cks["schema:name"]) || cks["@id"] } : null,
  };
}
