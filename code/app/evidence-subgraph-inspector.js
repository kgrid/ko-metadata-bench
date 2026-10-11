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
  return {
    title: node.label,
    kind: node.kind.replaceAll("-", " "),
    rows: rows(
      row("Identifier", node.sourceId),
      row("Description", description ?? "Not declared"),
      row("Citation", node.kind === "evidential-resource" ? citation ?? "Not declared" : citation),
      row("Evidence-target annotation", evidenceTargetAnnotations.join(" · ")),
      row("Source", source),
      row("Contained in", node.parentFile ?? node.parentSourceId),
      row("File context", fileContext.map((item) => item.path).filter(Boolean).join(" · ")),
      row("Declaring subject", node.declarationSite),
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
  const selector = target?.selector ?? targetRecord?.["http://www.w3.org/ns/oa#hasSelector"];
  const exact = selector?.exact ?? selector?.["http://www.w3.org/ns/oa#exact"];
  const prefix = selector?.prefix ?? selector?.["http://www.w3.org/ns/oa#prefix"];
  const suffix = selector?.suffix ?? selector?.["http://www.w3.org/ns/oa#suffix"];
  return {
    title: edge.sourceField,
    kind: "Directed relationship",
    rows: rows(
      row("Subject", subject.sourceId),
      row("Predicate", edge.sourceField),
      row("Object", object.sourceId),
      row("Declaring subject", edge.declaringSubjectId),
      row("Annotation", annotation?.sourceId),
      row("Annotation body", annotation?.bodyId),
      row("Annotation target", annotation?.targetId),
      row("Selector exact", exact),
      row("Selector prefix", prefix),
      row("Selector suffix", suffix),
      row("Target file", target?.parentFile ?? targetRecord?.["http://www.w3.org/ns/oa#hasSource"]?.["@id"]),
      row("Verification", target?.verification?.status),
    ),
  };
}
