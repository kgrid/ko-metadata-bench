// A display layout, not an inference engine: every connector is backed by a
// relationship in the evidence-subgraph projection.
export function layoutEvidenceSubgraph(graph) {
  const byKey = new Map(graph.nodes.map((node) => [node.key, node]));
  const from = (key, kind) => graph.relationships.filter((edge) => edge.from === key && edge.kind === kind);
  return graph.nodes.filter((node) => node.kind === "knowledge-object" || node.kind === "knowledge-element").map((subject) => {
    const basis = from(subject.key, "evidential-basis").map((edge) => {
      const resource = byKey.get(edge.to);
      const parent = resource?.parentSourceId && graph.nodes.find((node) => node.kind === "evidential-resource" && node.sourceId === resource.parentSourceId);
      const partEdge = parent && graph.relationships.find((item) => item.kind === "evidence-part" && item.from === parent.key && item.to === resource.key);
      return { edge, resource, parent: partEdge ? parent : null, partEdge: partEdge || null };
    });
    const annotations = from(subject.key, "subject-of-annotation").map((edge) => ({
      edge,
      annotation: byKey.get(edge.to),
      targets: from(edge.to, "annotation-target").map((targetEdge) => ({ edge: targetEdge, node: byKey.get(targetEdge.to) })),
    }));
    const routesTo = (kind) => annotations.flatMap((route) => {
      const targets = route.targets.filter((target) => target.node?.kind === kind);
      return targets.length ? [{ ...route, targets }] : [];
    });
    return {
      subject, basis, annotations,
      specificationRoutes: routesTo("specification-passage"),
      implementationRoutes: routesTo("implementation-passage"),
      unresolvedRoutes: annotations.filter((route) => !route.targets.length),
    };
  });
}

// Nodes witnessing a linking-detail category, not an inferred RDF route or
// a judgment of evidence quality. Every key must already exist in the graph.
export function evidenceCategoryPulseKeys(graph, category) {
  if (!category || category === "none") return [];
  const keys = new Set();
  const includeBasis = (lane) => {
    for (const basis of lane.basis) {
      if (basis.parent) keys.add(basis.parent.key);
      if (basis.resource) keys.add(basis.resource.key);
    }
  };
  const includeTargets = (routes) => {
    for (const route of routes) for (const target of route.targets) {
      if (target.node) keys.add(target.node.key);
    }
  };
  for (const lane of layoutEvidenceSubgraph(graph)) {
    const ko = lane.subject.kind === "knowledge-object";
    const evidence = lane.basis.length > 0;
    const specification = lane.specificationRoutes.length > 0;
    const implementation = lane.implementationRoutes.length > 0;
    const qualifies = category === "koWide" ? ko && evidence
      : category === "elementSpecification" ? !ko && evidence && specification
      : category === "elementsCode" ? !ko && evidence && implementation
      : category === "elementSpecificationCode" ? !ko && evidence && specification && implementation
      : false;
    if (!qualifies) continue;
    keys.add(lane.subject.key);
    includeBasis(lane);
    if (category === "elementSpecification" || category === "elementSpecificationCode") includeTargets(lane.specificationRoutes);
    if (category === "elementsCode" || category === "elementSpecificationCode") includeTargets(lane.implementationRoutes);
  }
  return [...keys];
}
