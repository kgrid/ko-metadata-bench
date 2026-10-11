// The Explore graph is a projection of declared evidence-linking metadata,
// not a graph of every KO file or an evidence-quality assessment.
export const EVIDENCE_SUBGRAPH_NODE_KINDS = Object.freeze({
  KNOWLEDGE_OBJECT: "knowledge-object",
  KNOWLEDGE_ELEMENT: "knowledge-element",
  EVIDENTIAL_RESOURCE: "evidential-resource",
  ANNOTATION: "annotation",
  SPECIFICATION_PASSAGE: "specification-passage",
  IMPLEMENTATION_PASSAGE: "implementation-passage",
});

export const EVIDENCE_SUBGRAPH_RELATIONSHIP_KINDS = Object.freeze({
  EVIDENTIAL_BASIS: "evidential-basis",
  EVIDENCE_PART: "evidence-part",
  SUBJECT_OF_ANNOTATION: "subject-of-annotation",
  ANNOTATION_TARGET: "annotation-target",
});

// Direction follows the declaring metadata subject, not a pedagogical
// evidence-to-knowledge arrow. File-level implementation/documentation links
// are contextual facts, never passage-level graph edges.
export const EVIDENCE_SUBGRAPH_RELATIONSHIP_RULES = Object.freeze({
  [EVIDENCE_SUBGRAPH_RELATIONSHIP_KINDS.EVIDENTIAL_BASIS]: Object.freeze({
    sourceField: "koio:hasEvidentialBasis",
    subjects: Object.freeze([EVIDENCE_SUBGRAPH_NODE_KINDS.KNOWLEDGE_OBJECT, EVIDENCE_SUBGRAPH_NODE_KINDS.KNOWLEDGE_ELEMENT]),
    objects: Object.freeze([EVIDENCE_SUBGRAPH_NODE_KINDS.EVIDENTIAL_RESOURCE]),
  }),
  [EVIDENCE_SUBGRAPH_RELATIONSHIP_KINDS.EVIDENCE_PART]: Object.freeze({
    sourceField: "schema:hasPart",
    subjects: Object.freeze([EVIDENCE_SUBGRAPH_NODE_KINDS.EVIDENTIAL_RESOURCE]),
    objects: Object.freeze([EVIDENCE_SUBGRAPH_NODE_KINDS.EVIDENTIAL_RESOURCE]),
  }),
  [EVIDENCE_SUBGRAPH_RELATIONSHIP_KINDS.SUBJECT_OF_ANNOTATION]: Object.freeze({
    sourceField: "schema:subjectOf",
    subjects: Object.freeze([EVIDENCE_SUBGRAPH_NODE_KINDS.KNOWLEDGE_OBJECT, EVIDENCE_SUBGRAPH_NODE_KINDS.KNOWLEDGE_ELEMENT]),
    objects: Object.freeze([EVIDENCE_SUBGRAPH_NODE_KINDS.ANNOTATION]),
  }),
  [EVIDENCE_SUBGRAPH_RELATIONSHIP_KINDS.ANNOTATION_TARGET]: Object.freeze({
    sourceField: "target",
    subjects: Object.freeze([EVIDENCE_SUBGRAPH_NODE_KINDS.ANNOTATION]),
    objects: Object.freeze([EVIDENCE_SUBGRAPH_NODE_KINDS.SPECIFICATION_PASSAGE, EVIDENCE_SUBGRAPH_NODE_KINDS.IMPLEMENTATION_PASSAGE]),
  }),
});

export function permitsEvidenceSubgraphRelationship(kind, subjectKind, objectKind) {
  const rule = EVIDENCE_SUBGRAPH_RELATIONSHIP_RULES[kind];
  return Boolean(rule && rule.subjects.includes(subjectKind) && rule.objects.includes(objectKind));
}
