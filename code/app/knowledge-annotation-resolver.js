// Resolve declarations only. A route through an element is not a direct
// evidence-to-specification or evidence-to-implementation assertion.
const entries = (value) => Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
const identifier = (value) => typeof value === "string" ? value : typeof value?.["@id"] === "string" ? value["@id"] : "";
const text = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
const types = (record) => entries(record?.["@type"]).length ? entries(record["@type"]) : typeof record?.["@type"] === "string" ? [record["@type"]] : [];
const basis = (record) => entries(record?.["koio:hasEvidentialBasis"] ?? record?.hasEvidentialBasis);
const selector = (part) => {
  const value = part?.["http://www.w3.org/ns/oa#hasSelector"];
  if (!value) return null;
  const quote = (key) => typeof value[key] === "string" ? value[key] : null;
  return {
    type: text(value["@type"]),
    exact: quote("http://www.w3.org/ns/oa#exact"),
    prefix: quote("http://www.w3.org/ns/oa#prefix"),
    suffix: quote("http://www.w3.org/ns/oa#suffix"),
  };
};

export function resolveKnowledgeAnnotations(metadata) {
  const elements = entries(metadata?.["koio:hasKnowledge"] ?? metadata?.hasKnowledge)
    .filter((record) => !types(record).includes("koio:KnowledgeObject"));
  const basisLinks = [];
  const resources = [];
  const annotations = [];
  const objectId = identifier(metadata);

  function addBasis(subject, record) {
    for (const evidence of basis(record)) basisLinks.push({
      declaredOn: subject.kind, subjectId: subject.id, evidenceId: identifier(evidence),
      sourceUrl: identifier(evidence?.["http://www.w3.org/ns/oa#hasSource"]) || null,
      title: text(evidence?.["dc:title"] ?? evidence?.["schema:name"]),
      description: text(evidence?.["dc:description"] ?? evidence?.["schema:description"]),
    });
  }
  function addParts(parent, kind, declaringElementId = null) {
    for (const part of entries(parent?.["schema:hasPart"])) resources.push({
      id: identifier(part), kind, parentId: identifier(parent), declaringElementId,
      title: text(part?.["dc:title"] ?? part?.["schema:name"]),
      description: text(part?.["dc:description"] ?? part?.["schema:description"]),
      filePath: identifier(part?.["http://www.w3.org/ns/oa#hasSource"]) || (kind === "evidence" ? null : identifier(parent)),
      digest: text(part?.["schema:sha256"] ?? parent?.["schema:sha256"]),
      selector: selector(part),
    });
  }

  addBasis({ kind: "knowledge-object", id: objectId }, metadata);
  for (const source of entries(metadata?.["dc:source"] ?? metadata?.source)) addParts(source, "evidence");
  for (const document of entries(metadata?.["koio:hasDocumentation"] ?? metadata?.hasDocumentation)) {
    if (types(document).includes("Specification Document")) addParts(document, "specification");
  }
  for (const element of elements) {
    const elementId = identifier(element);
    addBasis({ kind: "knowledge-element", id: elementId }, element);
    for (const implementation of entries(element?.implementedBy)) addParts(implementation, "implementation", elementId);
  }

  for (const subject of [{ kind: "knowledge-object", id: objectId, record: metadata },
    ...elements.map((record) => ({ kind: "knowledge-element", id: identifier(record), record }))]) {
    for (const annotation of entries(subject.record?.["schema:subjectOf"])) {
      const targetId = identifier(annotation?.target);
      const bodyId = identifier(annotation?.body);
      const resource = resources.find((item) => item.id && item.id === targetId) ?? null;
      annotations.push({
        id: identifier(annotation?.id ?? annotation?.["@id"]), declaredOn: subject.kind,
        declaringSubjectId: subject.id, bodyId, targetId,
        motivation: text(annotation?.motivation),
        bodyMatchesDeclaringSubject: Boolean(subject.id && bodyId === subject.id),
        target: resource,
        resolution: resource ? "named-resource" : "unresolved-target",
      });
    }
  }
  return { objectId, basisLinks, resources, annotations };
}
