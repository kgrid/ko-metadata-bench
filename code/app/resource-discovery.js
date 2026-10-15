const LOGICAL_TYPE_BY_NAME = Object.freeze({
  "existence.metadata.txt": "existence",
  "metadata.json": "core",
  "access.metadata.txt": "accessibility",
  "findability.metadata.txt": "findability",
  "interoperability.metadata.txt": "interoperability",
  "reusability.metadata.txt": "reusability",
});

const normalizePath = (value) => {
  if (typeof value !== "string" || !value || value.includes("\\") || value.startsWith("/") || /^[a-z][a-z\d+.-]*:/i.test(value)) return null;
  const parts = value.split("/");
  return parts.some((part) => !part || part === "." || part === "..") ? null : parts.join("/");
};

const baseName = (value) => value.split("/").at(-1)?.toLowerCase() ?? "";
const uniqueByBaseName = (files, requested) => {
  const matches = files.filter((file) => baseName(file) === baseName(requested));
  return matches.length === 1 ? matches[0] : null;
};

function declaredComponents(source, fileSet) {
  const byType = {};
  if (typeof source !== "string") return byType;
  for (const block of source.split(/\n\s*\n/)) {
    const path = normalizePath(block.match(/koer:filePath\s+"([^"]+)"/i)?.[1]);
    const type = block.match(/dcterms:type\s+"([^"]+)"/i)?.[1]?.trim().toLowerCase();
    if (path && type && fileSet.has(path) && !Object.hasOwn(byType, type)) byType[type] = path;
  }
  return byType;
}

/** Existence declarations win; older KOs fall back only to a unique basename. */
export function discoverResourceMap({ files, readText }) {
  const normalizedFiles = [...new Set((Array.isArray(files) ? files : []).map(normalizePath).filter(Boolean))];
  const fileSet = new Set(normalizedFiles);
  const existencePath = fileSet.has("existence.metadata.txt") ? "existence.metadata.txt" : uniqueByBaseName(normalizedFiles, "existence.metadata.txt");
  const byType = existencePath ? declaredComponents(readText(existencePath), fileSet) : {};
  if (existencePath && !byType.existence) byType.existence = existencePath;
  const resolve = (requested) => {
    const safe = normalizePath(requested);
    if (!safe) return null;
    if (fileSet.has(safe)) return safe;
    const type = LOGICAL_TYPE_BY_NAME[baseName(safe)];
    if (type && byType[type]) return byType[type];
    return uniqueByBaseName(normalizedFiles, safe);
  };
  return Object.freeze({ existencePath: existencePath ?? null, declaredByType: Object.freeze({ ...byType }), resolve });
}
