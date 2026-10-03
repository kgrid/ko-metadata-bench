export function createInitialActiveObjects(objectIds) {
  return objectIds.map((objectId) => ({ kind: "knowledge-object", objectId }));
}

export function isAssemblyActive(activeObjects) {
  return activeObjects.some((object) => object.kind === "knowledge-assembly");
}

export function addAssemblyToActiveObjects(activeObjects, assembly) {
  if (!assembly?.generalView?.identifier || assembly.metadata?.["schema:category"] !== "Knowledge Assembly") {
    throw new Error("A prepared Knowledge Assembly is required before loading it as a Knowledge Object.");
  }
  if (isAssemblyActive(activeObjects)) return activeObjects;
  return [...activeObjects, { kind: "knowledge-assembly", identifier: assembly.generalView.identifier }];
}
