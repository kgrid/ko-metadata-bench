import { EVIDENCE_SUBGRAPH_NODE_KINDS as N, EVIDENCE_SUBGRAPH_RELATIONSHIP_KINDS as R, permitsEvidenceSubgraphRelationship } from "./evidence-subgraph-contract.js";

const entries = (value) => Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
const idOf = (value) => typeof value === "string" ? value : typeof value?.["@id"] === "string" ? value["@id"] : "";
const labelOf = (record, fallback) => record?.["dc:title"] || record?.["schema:name"] || fallback;
const nodeKey = (kind, id) => `${kind}:${id}`;

// This is a declared-metadata projection, not a transitive evidence claim.
// File-level facts remain context; annotation targets retain their declared kind.
export function projectEvidenceSubgraph(metadata, knowledgeModel, annotationResolution) {
  const nodes = [];
  const relationships = [];
  const fileContext = [];
  const seen = new Set();
  const addNode = (kind, id, fields = {}) => {
    if (!id) return null;
    const key = nodeKey(kind, id);
    if (!seen.has(key)) { nodes.push({ key, kind, sourceId: id, ...fields }); seen.add(key); }
    else {
      const existing = nodes.find((node) => node.key === key);
      for (const [field, value] of Object.entries(fields)) {
        if (value == null) continue;
        if (existing[field] == null || (field === "label" && existing[field] === id && value !== id)) existing[field] = value;
      }
    }
    return key;
  };
  const addEdge = (kind, subject, object, sourceField, declaringSubjectId) => {
    if (!subject || !object || !permitsEvidenceSubgraphRelationship(kind, subject.kind, object.kind)) return;
    relationships.push({ kind, from: subject.key, to: object.key, sourceField, declaringSubjectId });
  };
  const ref = (kind, key) => key ? { kind, key } : null;
  const objectId = idOf(metadata);
  const koKey = addNode(N.KNOWLEDGE_OBJECT, objectId, { label: labelOf(metadata, objectId), declarationSite: objectId });
  const elementKeys = new Map();
  for (const element of knowledgeModel.elements) {
    const id = idOf(element.record);
    const key = addNode(N.KNOWLEDGE_ELEMENT, id, { label: labelOf(element.record, id), declarationSite: objectId });
    if (key) elementKeys.set(id, key);
    for (const implementation of element.implementations) fileContext.push({ kind: "implementation-file", declaringSubjectId: id, sourceId: idOf(implementation), path: idOf(implementation) });
  }
  for (const document of entries(metadata?.["koio:hasDocumentation"] ?? metadata?.hasDocumentation)) {
    if (entries(document?.["@type"]).includes("Specification Document")) fileContext.push({ kind: "specification-file", declaringSubjectId: objectId, sourceId: idOf(document), path: idOf(document) });
  }
  const cited = entries(metadata?.["dc:source"] ?? metadata?.source);
  const citedById = new Map(cited.map((record) => [idOf(record), record]));
  const basisIds = new Set(annotationResolution.basisLinks.map((link) => link.evidenceId).filter(Boolean));
  for (const source of cited) {
    const sourceId = idOf(source);
    const parts = entries(source?.["schema:hasPart"]);
    if (!basisIds.has(sourceId) && !parts.some((part) => basisIds.has(idOf(part)))) continue;
    const parentKey = addNode(N.EVIDENTIAL_RESOURCE, sourceId, { label: labelOf(source, sourceId), declarationSite: sourceId });
    for (const part of parts) {
      const partId = idOf(part);
      if (!basisIds.has(partId)) continue;
      const partKey = addNode(N.EVIDENTIAL_RESOURCE, partId, { label: labelOf(part, partId), declarationSite: sourceId, parentSourceId: sourceId });
      addEdge(R.EVIDENCE_PART, ref(N.EVIDENTIAL_RESOURCE, parentKey), ref(N.EVIDENTIAL_RESOURCE, partKey), "schema:hasPart", sourceId);
    }
  }
  for (const basis of annotationResolution.basisLinks) {
    const subjectKind = basis.declaredOn === N.KNOWLEDGE_OBJECT ? N.KNOWLEDGE_OBJECT : N.KNOWLEDGE_ELEMENT;
    const subjectKey = subjectKind === N.KNOWLEDGE_OBJECT ? koKey : elementKeys.get(basis.subjectId);
    const evidenceId = basis.evidenceId;
    const citedRecord = citedById.get(evidenceId);
    const evidenceKey = addNode(N.EVIDENTIAL_RESOURCE, evidenceId, {
      label: basis.title || labelOf(citedRecord, evidenceId), declarationSite: basis.subjectId,
      sourceUrl: basis.sourceUrl,
    });
    addEdge(R.EVIDENTIAL_BASIS, ref(subjectKind, subjectKey), ref(N.EVIDENTIAL_RESOURCE, evidenceKey), "koio:hasEvidentialBasis", basis.subjectId);
  }
  for (const annotation of annotationResolution.annotations) {
    // Evidence-side specificity is already shown by hasPart and hasEvidentialBasis.
    // Keep evidence-target annotations in metadata for inspection, not as a
    // duplicate route in this deliberately narrow teaching graph.
    if (annotation.target?.kind === "evidence") continue;
    const subjectKind = annotation.declaredOn === N.KNOWLEDGE_OBJECT ? N.KNOWLEDGE_OBJECT : N.KNOWLEDGE_ELEMENT;
    const subjectKey = subjectKind === N.KNOWLEDGE_OBJECT ? koKey : elementKeys.get(annotation.declaringSubjectId);
    const annotationKey = addNode(N.ANNOTATION, annotation.id, {
      label: annotation.id, declarationSite: annotation.declaringSubjectId, bodyId: annotation.bodyId,
      targetId: annotation.targetId, motivation: annotation.motivation,
      bodyMatchesDeclaringSubject: annotation.bodyMatchesDeclaringSubject,
    });
    addEdge(R.SUBJECT_OF_ANNOTATION, ref(subjectKind, subjectKey), ref(N.ANNOTATION, annotationKey), "schema:subjectOf", annotation.declaringSubjectId);
    if (!annotation.bodyMatchesDeclaringSubject || !annotation.target) continue;
    const kind = {
      evidence: N.EVIDENTIAL_RESOURCE,
      specification: N.SPECIFICATION_PASSAGE,
      implementation: N.IMPLEMENTATION_PASSAGE,
    }[annotation.target.kind];
    if (!kind) continue;
    const targetKey = addNode(kind, annotation.targetId, {
      label: annotation.target.title || annotation.targetId,
      declarationSite: annotation.target.parentId,
      parentSourceId: annotation.target.parentId,
      ...(kind === N.EVIDENTIAL_RESOURCE
        ? { sourceUrl: annotation.target.filePath }
        : {
          parentFile: annotation.target.filePath,
          selector: annotation.target.selector,
          digest: annotation.target.digest,
          verification: annotation.destination ?? { status: "not-checked", reason: "Passage has not been checked against embedded content" },
        }),
    });
    addEdge(R.ANNOTATION_TARGET, ref(N.ANNOTATION, annotationKey), ref(kind, targetKey), "target", annotation.declaringSubjectId);
  }
  return { objectId, nodes, relationships, fileContext };
}
