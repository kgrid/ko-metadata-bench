import { safeEvidenceUrl } from "./passage-navigation.js";

const actionIdOf = (value) => typeof value === "string" ? value : value?.["@id"] ?? value?.id ?? null;

function recordFor(metadata, id) {
  if (!id) return null;
  let found = null;
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (actionIdOf(value) === id && Object.keys(value).length > Object.keys(found ?? {}).length) found = value;
    Object.values(value).forEach(visit);
  };
  visit(metadata);
  return found;
}

// These are affordances for a selected graph target, not additional graph edges.
export function planEvidenceSubgraphActions(graph, model, metadata, selection, availableFile) {
  const node = selection?.kind === "node"
    ? graph.nodes.find((item) => item.key === selection.key)
    : selection?.kind === "edge"
      ? graph.nodes.find((item) => item.key === graph.relationships[selection.index]?.to)
      : null;
  if (!node) return { actions: [], notice: null };
  if (node.kind === "evidential-resource") {
    const record = recordFor(metadata, node.sourceId);
    const url = safeEvidenceUrl(actionIdOf(record?.["http://www.w3.org/ns/oa#hasSource"]))
      ?? safeEvidenceUrl(node.sourceUrl)
      ?? safeEvidenceUrl(node.sourceId);
    return { actions: url ? [{ kind: "evidence", label: "Open evidence source", url }] : [], notice: url ? null : "No safe HTTP or HTTPS evidence source is declared for this target." };
  }
  if (node.kind === "specification-passage" || node.kind === "implementation-passage") {
    const file = node.parentFile;
    const status = node.verification?.status ?? "not-checked";
    if (status === "resolved" && node.selector?.exact && file && availableFile(file, node.kind)) {
      return { actions: [{ kind: "passage", label: "Follow passage", file, passageKind: node.kind, title: node.label, selector: node.selector }], notice: null };
    }
    return { actions: [], notice: `Precise passage navigation unavailable: ${node.verification?.reason ?? status}. No whole-file substitute is shown.` };
  }
  if (node.kind === "knowledge-object" || node.kind === "knowledge-element") {
    const actions = [];
    const specification = model.cks?.path;
    if (specification && availableFile(specification, "specification-file")) actions.push({ kind: "specification", label: "View Specification", file: specification });
    if (node.kind === "knowledge-element") {
      const element = model.elements.find((item) => item.identifier === node.sourceId);
      for (const implementation of element?.implementations ?? []) {
        if (availableFile(implementation.path, "implementation-file")) actions.push({ kind: "implementation", label: "View Implementation", file: implementation.path });
      }
    }
    return { actions, notice: null };
  }
  return { actions: [], notice: null };
}
