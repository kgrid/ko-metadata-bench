import { discoverResourceMap } from "./resource-discovery.js";

export function inspectWorkshopOrder({ folderName, files, readText }) {
  const resources = discoverResourceMap({ files, readText });
  const findabilityPath = resources.resolve("findability.metadata.txt");
  if (!findabilityPath) return Object.freeze({ folderName, valid: false, number: null, findabilityPath: null, diagnostic: "Findability metadata could not be discovered." });
  let source;
  try { source = String(readText(findabilityPath)); }
  catch { return Object.freeze({ folderName, valid: false, number: null, findabilityPath, diagnostic: "Findability metadata could not be read." }); }
  const identifiers = [...source.matchAll(/schema:identifier\s+"workshop-ko-(\d+)"/gi)].map((match) => Number(match[1]));
  const unique = [...new Set(identifiers)];
  if (!unique.length) return Object.freeze({ folderName, valid: false, number: null, findabilityPath, diagnostic: 'Findability metadata does not declare a schema:identifier of the form "workshop-ko-N".' });
  if (unique.length !== 1 || !Number.isSafeInteger(unique[0]) || unique[0] < 1) return Object.freeze({ folderName, valid: false, number: null, findabilityPath, diagnostic: "Findability metadata declares conflicting or invalid workshop identifiers." });
  return Object.freeze({ folderName, valid: true, number: unique[0], findabilityPath, diagnostic: null });
}

export function orderWorkshopObjects(objects) {
  const inspected = objects.map((object) => ({ ...object, workshop: inspectWorkshopOrder(object) }));
  const inadequate = inspected.filter((object) => !object.workshop.valid);
  if (inadequate.length) throw new Error(`Workshop ordering requires adequate findability metadata:\n${inadequate.map((object) => `- ${object.folderName}: ${object.workshop.diagnostic}`).join("\n")}`);
  const seen = new Map();
  for (const object of inspected) {
    const prior = seen.get(object.workshop.number);
    if (prior) throw new Error(`Duplicate workshop identifier workshop-ko-${object.workshop.number}: ${prior} and ${object.folderName}`);
    seen.set(object.workshop.number, object.folderName);
  }
  return inspected.sort((a, b) => a.workshop.number - b.workshop.number || a.folderName.localeCompare(b.folderName));
}
