import assert from "node:assert/strict";

export function pageTextOverrides(source) {
  const startMarker = "const objectFileOverrides: Record<string, string> = ";
  const endMarker = ";\nconst objectBinaryOverrides";
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, "React text bundle starts at a stable boundary");
  assert.notEqual(end, -1, "React text bundle ends at a stable boundary");
  return JSON.parse(source.slice(start + startMarker.length, end));
}

export function embeddedLogicalEntry(source, objectId, logicalName) {
  const files = pageTextOverrides(source);
  const prefix = `${objectId}/`;
  const matches = Object.keys(files).filter((key) =>
    key.startsWith(prefix) && (key === `${objectId}/${logicalName}` || key.endsWith(`/${logicalName}`))
  );
  assert.equal(matches.length, 1, `${logicalName} is discovered exactly once for object ${objectId}`);
  const [key] = matches;
  return { key, value: files[key] };
}

export function embeddedLogicalValue(source, objectId, logicalName) {
  return embeddedLogicalEntry(source, objectId, logicalName).value;
}
