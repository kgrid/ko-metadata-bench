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
