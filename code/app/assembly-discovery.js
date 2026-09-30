export const KNOWLEDGE_ASSEMBLY_CATEGORY = "Knowledge Assembly";

// Classification precedes workshop-number discovery: an assembly does not
// need the findability metadata used to order ordinary workshop KOs.
export function partitionKnowledgePackages(candidates) {
  const knowledgeObjects = [];
  let knowledgeAssembly = null;
  for (const candidate of candidates) {
    const metadata = candidate.files.includes("metadata.json")
      ? JSON.parse(candidate.readText("metadata.json"))
      : null;
    if (metadata?.["schema:category"] === KNOWLEDGE_ASSEMBLY_CATEGORY) {
      if (knowledgeAssembly) throw new Error("Only one Knowledge Assembly may be embedded");
      knowledgeAssembly = { ...candidate, metadata };
    } else {
      knowledgeObjects.push(candidate);
    }
  }
  return { knowledgeObjects, knowledgeAssembly };
}
