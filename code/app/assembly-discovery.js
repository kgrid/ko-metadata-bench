export const KNOWLEDGE_ASSEMBLY_CATEGORY = "Knowledge Assembly";
import { discoverResourceMap } from "./resource-discovery.js";
import { Parser } from "n3";

const METADATA_FILES = ["existence.metadata.txt", "findability.metadata.txt", "access.metadata.txt", "interoperability.metadata.txt", "reusability.metadata.txt", "metadata.json"];
const GRAPHIC_FILES = ["graphic.abstract.webp", "graphic.logic.webp"];

// Prepare the separately embedded KA for eventual use by the ordinary KO views.
// Its canonical identifier comes from its own metadata, never its array position.
export function prepareAssemblyGeneralView(candidate) {
  const metadata = candidate?.metadata;
  if (metadata?.["schema:category"] !== KNOWLEDGE_ASSEMBLY_CATEGORY) {
    throw new Error(`${candidate?.folderName ?? "Assembly"}: schema:category must be "Knowledge Assembly"`);
  }
  const identifier = metadata["@id"];
  const declaredIdentifiers = Array.isArray(metadata["dc:identifier"])
    ? metadata["dc:identifier"] : [metadata["dc:identifier"]];
  if (typeof identifier !== "string" || !/^https?:\/\/\S+$/.test(identifier) || !declaredIdentifiers.includes(identifier)) {
    throw new Error(`${candidate.folderName}: metadata.json must declare a canonical HTTP(S) @id also present in dc:identifier`);
  }
  const files = [...new Set(candidate.files)].sort();
  const resources = discoverResourceMap({ files, readText: candidate.readText });
  const metadataPaths = Object.fromEntries(METADATA_FILES.map((name) => [name, resources.resolve(name)]));
  const graphicPaths = Object.fromEntries(GRAPHIC_FILES.map((name) => [name, resources.resolve(name)]));
  for (const [name, path] of Object.entries(metadataPaths)) {
    if (!path) throw new Error(`${candidate.folderName}: missing or ambiguous ${name}`);
  }
  for (const [name, path] of Object.entries(graphicPaths)) {
    if (!path) throw new Error(`${candidate.folderName}: missing or ambiguous ${name}`);
  }
  const names = new Parser({ format: "text/turtle" }).parse(candidate.readText(metadataPaths["findability.metadata.txt"]))
    .filter((statement) => statement.subject.value === identifier && statement.predicate.value === "https://schema.org/name" && statement.object.termType === "Literal")
    .map((statement) => statement.object.value.trim());
  if (names.length !== 1 || !names[0]) throw new Error(`${candidate.folderName}: findability metadata must declare one schema:name for its canonical identifier`);
  return Object.freeze({ identifier, displayName: names[0], metadataPaths: Object.freeze(metadataPaths), graphicPaths: Object.freeze(graphicPaths), files: Object.freeze(files) });
}

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
