import { layoutEvidenceSubgraph } from "./evidence-subgraph-layout.js";
import { planEvidenceSubgraphActions } from "./evidence-subgraph-actions.js";
import { evidencePassageGlimpse } from "./evidence-passage-glimpse.js";

// View data only: rows preserve each declaration and the graph remains the
// authority for RDF relationships. No evidence-to-passage edge is inferred.
export function buildEvidenceSubgraphViewRecord(graph, model, metadata, readText, availableFile) {
  const sourceText = typeof readText === "function" ? readText : () => null;
  const canOpenFile = typeof availableFile === "function" ? availableFile : () => false;
  const isPassage = (kind) => kind === "specification-passage" || kind === "implementation-passage";
  const nodesByKey = {};
  for (const node of graph.nodes) {
    const passage = isPassage(node.kind);
    const glimpse = passage ? evidencePassageGlimpse(node, sourceText) : null;
    const { actions, notice } = planEvidenceSubgraphActions(graph, model, metadata, { kind: "node", key: node.key }, canOpenFile);
    const followAction = node.kind === "evidential-resource"
      ? actions.find((action) => action.kind === "evidence") ?? null
      : passage && glimpse ? actions.find((action) => action.kind === "passage") ?? null : null;
    const passageState = !passage ? null
      : node.verification?.status === "unresolved" ? "unresolved"
      : node.verification?.status === "resolved" ? (glimpse && followAction ? "verified" : "unavailable")
      : "not-checked";
    const declaringSubjectIds = [...new Set(graph.relationships
      .filter((edge) => edge.to === node.key && (edge.kind === "evidential-basis" || edge.kind === "annotation-target"))
      .map((edge) => edge.declaringSubjectId))];
    nodesByKey[node.key] = {
      key: node.key,
      kind: node.kind,
      sourceId: node.sourceId,
      declaringSubjectIds,
      targetType: passage ? node.kind : null,
      containingFile: passage ? node.parentFile ?? null : null,
      displayFile: passage && node.parentFile ? node.parentFile.split("/").at(-1) : null,
      verification: passage ? node.verification ?? { status: "not-checked" } : null,
      passageState,
      glimpse,
      followAction,
      followNotice: followAction ? null : notice,
    };
  }
  const rows = layoutEvidenceSubgraph(graph).map((lane) => {
    const populatedColumns = Number(lane.basis.length > 0)
      + Number(lane.specificationRoutes.length > 0)
      + Number(lane.implementationRoutes.length > 0);
    const filesFor = (kind) => graph.fileContext.filter((file) => file.kind === kind && file.declaringSubjectId === lane.subject.sourceId);
    return {
      ...lane,
      density: populatedColumns === 0 && !lane.unresolvedRoutes.length ? "empty" : populatedColumns <= 1 ? "sparse" : "populated",
      declaringSubject: { key: lane.subject.key, kind: lane.subject.kind, sourceId: lane.subject.sourceId },
      specificationFiles: filesFor("specification-file"),
      implementationFiles: filesFor("implementation-file"),
      annotationRoutes: lane.annotations.map((route) => ({
        declaringSubjectId: lane.subject.sourceId,
        subjectOf: route.edge,
        annotationId: route.annotation.sourceId,
        annotationKey: route.annotation.key,
        targets: route.targets.map((target) => ({
          target: target.edge,
          targetKey: target.node.key,
          targetType: target.node.kind,
          containingFile: nodesByKey[target.node.key].containingFile,
          verification: nodesByKey[target.node.key].verification,
          passageState: nodesByKey[target.node.key].passageState,
          glimpse: nodesByKey[target.node.key].glimpse,
          followAction: nodesByKey[target.node.key].followAction,
        })),
      })),
    };
  });
  return { objectId: graph.objectId, rows, nodesByKey, fileContext: graph.fileContext };
}
