// Inspector facts come from the declared graph and its source metadata. This
// does not add graph edges or imply an evidence-to-code assertion.
const text = (...values) => values.find((value) => typeof value === "string" && value.trim())?.trim() ?? null;

function recordsById(metadata) {
  const records = new Map();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const id = text(value["@id"], value.id);
    if (id && Object.keys(value).length >= Object.keys(records.get(id) ?? {}).length) records.set(id, value);
    Object.values(value).forEach(visit);
  };
  visit(metadata);
  return records;
}

const row = (label, value) => value === null || value === undefined || value === "" ? null : { label, value: String(value) };
const rows = (...items) => items.filter(Boolean);
const rdfStep = (edge, byKey) => {
  const subject = byKey.get(edge.from), object = byKey.get(edge.to);
  return subject && object ? `${subject.sourceId} — ${edge.sourceField} → ${object.sourceId}` : null;
};
const annotationBodyStep = (annotation, records) => {
  const record = annotation && records.get(annotation.sourceId);
  const body = text(record?.body, record?.["http://www.w3.org/ns/oa#hasBody"]?.["@id"], record?.["http://www.w3.org/ns/oa#hasBody"]);
  return body ? `${annotation.sourceId} — body → ${body}` : null;
};
const routeEdgesForNode = (graph, node) => {
  const direct = graph.relationships.filter((edge) => edge.from === node.key || edge.to === node.key);
  const annotations = direct.filter((edge) => edge.kind === "annotation-target").map((edge) => edge.from);
  const companions = graph.relationships.filter((edge) => edge.kind === "subject-of-annotation" && annotations.includes(edge.to));
  return [...new Set([...companions, ...direct])];
};

export function inspectEvidenceSubgraphNode(graph, metadata, key) {
  const node = graph.nodes.find((item) => item.key === key);
  if (!node) return null;
  const records = recordsById(metadata);
  const record = records.get(node.sourceId) ?? {};
  const parent = records.get(node.parentSourceId) ?? {};
  const fileContext = graph.fileContext.filter((item) => item.declaringSubjectId === node.sourceId);
  const description = text(record["dc:description"], record["schema:description"]);
  const citation = text(record["dc:bibliographicCitation"], parent["dc:bibliographicCitation"]);
  const source = text(node.sourceUrl, record["http://www.w3.org/ns/oa#hasSource"]?.["@id"], record["http://www.w3.org/ns/oa#hasSource"]);
  const evidenceTargetAnnotations = node.kind === "evidential-resource"
    ? [...records.values()].filter((item) => item?.target === node.sourceId || item?.target?.["@id"] === node.sourceId).map((item) => text(item.id, item["@id"])).filter(Boolean)
    : [];
  const selector = node.selector;
  const byKey = new Map(graph.nodes.map((item) => [item.key, item]));
  const route = routeEdgesForNode(graph, node);
  const annotation = node.kind === "annotation" ? node : route.map((edge) => byKey.get(edge.from)).find((item) => item?.kind === "annotation");
  return {
    title: node.label,
    kind: node.kind.replaceAll("-", " "),
    summary: node.kind === "annotation" ? "The declaring subject links to this annotation. Its declared body and target explain what the annotation connects."
      : node.kind.endsWith("-passage") ? "The declaring subject reaches this passage through an annotation, not through a direct evidence-to-passage statement."
      : node.kind === "evidential-resource" ? "Only the declared evidential-basis and resource-part relationships shown below connect this resource in the graph."
      : "The statements below show this subject’s declared evidence and annotation relationships.",
    rows: rows(
      row("Identifier", node.sourceId),
      row("Description", description ?? "Not declared"),
      row("Citation", node.kind === "evidential-resource" ? citation ?? "Not declared" : citation),
      row("Evidence-target annotation", evidenceTargetAnnotations.join(" · ")),
      row("Source", source),
      row("Contained in", node.parentFile ?? node.parentSourceId),
      row("File context", fileContext.map((item) => item.path).filter(Boolean).join(" · ")),
      row("Declaring subject", node.declarationSite),
      ...route.map((edge, index) => row(`RDF step ${index + 1}`, rdfStep(edge, byKey))),
      row("Annotation body statement", annotationBodyStep(annotation, records)),
      row("Annotation body", node.bodyId),
      row("Annotation target", node.targetId),
      row("Motivation", node.motivation),
      row("Selector type", selector?.type),
      row("Exact passage", selector?.exact),
      row("Selector prefix", selector?.prefix),
      row("Selector suffix", selector?.suffix),
      row("File digest (SHA-256)", node.digest),
      row("Passage verification", node.verification?.status),
      row("Verification detail", node.verification?.reason),
    ),
  };
}

export function inspectEvidenceSubgraphRelationship(graph, metadata, edgeIndex) {
  const edge = graph.relationships[edgeIndex];
  if (!edge) return null;
  const byKey = new Map(graph.nodes.map((node) => [node.key, node]));
  const subject = byKey.get(edge.from), object = byKey.get(edge.to);
  if (!subject || !object) return null;
  const records = recordsById(metadata);
  const annotation = edge.kind === "annotation-target" ? subject
    : edge.kind === "subject-of-annotation" ? object
    : graph.nodes.find((node) => node.kind === "annotation" && node.bodyId === subject.sourceId && node.targetId === object.sourceId);
  const target = annotation && graph.nodes.find((node) => node.sourceId === annotation.targetId);
  const targetRecord = annotation && records.get(annotation.targetId);
  const objectRecord = records.get(object.sourceId) ?? {};
  const objectParent = records.get(object.parentSourceId) ?? {};
  const selector = target?.selector ?? targetRecord?.["http://www.w3.org/ns/oa#hasSelector"];
  const exact = selector?.exact ?? selector?.["http://www.w3.org/ns/oa#exact"];
  const prefix = selector?.prefix ?? selector?.["http://www.w3.org/ns/oa#prefix"];
  const suffix = selector?.suffix ?? selector?.["http://www.w3.org/ns/oa#suffix"];
  const annotationRoute = annotation ? graph.relationships.filter((item) =>
    (item.kind === "subject-of-annotation" && item.to === annotation.key)
    || (item.kind === "annotation-target" && item.from === annotation.key)) : [edge];
  return {
    title: edge.sourceField,
    kind: "Directed relationship",
    summary: edge.kind === "evidential-basis" ? "This statement declares an evidential basis for its subject. It does not by itself identify a specification or code passage."
      : edge.kind === "evidence-part" ? "This statement identifies a part of an evidence resource; it does not by itself declare a knowledge element’s evidential basis."
      : "The two RDF steps below connect a declaring subject to an annotation and that annotation to its target. They do not assert a direct evidence-to-passage relationship.",
    rows: rows(
      row("Subject", subject.sourceId),
      row("Predicate", edge.sourceField),
      row("Object", object.sourceId),
      row("Citation", text(objectRecord["dc:bibliographicCitation"], objectParent["dc:bibliographicCitation"])),
      row("Declaring subject", edge.declaringSubjectId),
      ...annotationRoute.map((item, index) => row(`RDF step ${index + 1}`, rdfStep(item, byKey))),
      row("Annotation body statement", annotationBodyStep(annotation, records)),
      row("Annotation", annotation?.sourceId),
      row("Annotation body", annotation?.bodyId),
      row("Annotation target", annotation?.targetId),
      row("Selector type", selector?.type ?? selector?.["@type"]),
      row("Selector exact", exact),
      row("Selector prefix", prefix),
      row("Selector suffix", suffix),
      row("Target file", target?.parentFile ?? targetRecord?.["http://www.w3.org/ns/oa#hasSource"]?.["@id"]),
      row("File digest (SHA-256)", target?.digest),
      row("Verification", target?.verification?.status),
      row("Verification detail", target?.verification?.reason),
    ),
  };
}
