import { createHash } from "node:crypto";
import { resolveKnowledgeAnnotations } from "./knowledge-annotation-resolver.js";

const localPath = (path) => typeof path === "string" && path.length > 0
  && !path.startsWith("/") && !path.includes("\\")
  && !path.split("/").some((segment) => segment === ".." || segment === "." || !segment);
const countMatches = (source, exact, prefix, suffix) => {
  let count = 0;
  for (let at = source.indexOf(exact); at !== -1; at = source.indexOf(exact, at + 1)) {
    if ((!prefix || source.slice(0, at).endsWith(prefix))
        && (!suffix || source.slice(at + exact.length).startsWith(suffix))) count += 1;
  }
  return count;
};

// External evidence is never fetched. A local passage resolves only when its
// source exists, its declared digest agrees, and its quote selects one passage.
export function validateAnnotationDestinations(metadata, { files, readBytes, readPassageText }) {
  const known = new Set(files);
  const { annotations } = resolveKnowledgeAnnotations(metadata);
  return annotations.map((annotation) => {
    const base = { annotationId: annotation.id, declaringSubjectId: annotation.declaringSubjectId,
      targetId: annotation.targetId, kind: annotation.target?.kind ?? null };
    const unresolved = (reason) => ({ ...base, status: "unresolved", reason });
    if (!annotation.bodyMatchesDeclaringSubject) return unresolved("Annotation body does not match its declaring subject");
    if (!annotation.target) return unresolved("Named target is not declared");
    if (annotation.target.kind === "evidence") return { ...base, status: "external", reason: "Open external publication deliberately" };
    const { filePath, digest, selector } = annotation.target;
    if (!localPath(filePath) || !known.has(filePath)) return unresolved("Local passage file is missing");
    let bytes;
    try { bytes = readBytes(filePath); }
    catch { return unresolved("Local passage file cannot be read"); }
    if (!bytes) return unresolved("Local passage file cannot be read");
    if (digest && createHash("sha256").update(bytes).digest("hex").toLowerCase() !== digest.toLowerCase()) {
      return unresolved("Local passage file digest does not match metadata");
    }
    if (selector?.type !== "http://www.w3.org/ns/oa#TextQuoteSelector" || !selector.exact) {
      return unresolved("Text quote selector is missing or unsupported");
    }
    let source;
    try { source = readPassageText(filePath); }
    catch { return unresolved("Passage text is unavailable"); }
    if (typeof source !== "string") return unresolved("Passage text is unavailable");
    const matches = countMatches(source, selector.exact, selector.prefix, selector.suffix);
    if (matches !== 1) return unresolved(matches ? `Selector matches ${matches} passages` : "Selector matches no passage");
    return { ...base, status: "resolved", reason: null, filePath };
  });
}
