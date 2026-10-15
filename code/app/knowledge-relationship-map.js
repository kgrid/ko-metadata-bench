// This is a display projection of separate declarations, not a transitive
// evidence-to-CKS or evidence-to-code relationship.
export function buildKnowledgeRelationshipMap(model) {
  const annotationLinks = model.annotationResolution?.annotations ?? [];
  const passagesFor = (element, kind) => annotationLinks
    .filter((annotation) => annotation.declaringSubjectId === element.identifier
      && annotation.bodyMatchesDeclaringSubject && annotation.target?.kind === kind)
    .map((annotation) => ({
      identifier: annotation.targetId,
      title: annotation.target?.title || annotation.targetId || "Unnamed passage",
      status: annotation.destination?.status ?? "not-checked",
      reason: annotation.destination?.reason ?? null,
      filePath: annotation.target?.filePath ?? null,
      selector: annotation.target?.selector ?? null,
    }));
  const source = (basis) => ({ identifier: basis.identifier, name: basis.name });
  return {
    category: model.linkingCategory?.category ?? null,
    descriptor: model.linkingCategory?.route ?? model.linkingCategory?.reason ?? "Linking pattern unavailable",
    wholeKoSources: (model.koEvidentialBasis ?? []).map(source),
    branches: (model.elements ?? [])
      .map((element) => ({
        elementIndex: element.index,
        elementId: element.identifier,
        elementName: element.name,
        evidence: element.evidentialBasis.map(source),
        specificationPassages: passagesFor(element, "specification"),
        implementationPassages: passagesFor(element, "implementation"),
      }))
      .filter((branch) => branch.evidence.length || branch.specificationPassages.length || branch.implementationPassages.length),
    constituentEvidenceInherited: false,
  };
}
