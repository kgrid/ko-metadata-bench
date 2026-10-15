function normalizedIdentifiers(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return values.flatMap((entry) => {
    if (typeof entry === "string") return [entry.trim()];
    if (entry && typeof entry === "object") {
      const candidate = entry["@id"] ?? entry.value ?? entry.identifier;
      return typeof candidate === "string" ? [candidate.trim()] : [];
    }
    return [];
  }).filter(Boolean);
}

export function identifiersFromMetadataJson(source) {
  try {
    const metadata = JSON.parse(source);
    return [...new Set([
      ...normalizedIdentifiers(metadata["dc:identifier"]),
      ...normalizedIdentifiers(metadata.identifier),
      ...normalizedIdentifiers(metadata["schema:identifier"]),
    ])];
  } catch {
    return [];
  }
}

export function resolveObjectIdByIdentifier(objectIds, readMetadataJson, identifier) {
  const matches = objectIds.filter((objectId) => identifiersFromMetadataJson(readMetadataJson(objectId)).includes(identifier));
  if (matches.length !== 1) {
    throw new Error(`Knowledge-object identifier ${JSON.stringify(identifier)} matched ${matches.length} embedded objects; exactly one is required.`);
  }
  return matches[0];
}
