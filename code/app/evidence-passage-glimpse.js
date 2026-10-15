// A glimpse is derived from the embedded source, never from the selector alone.
// Build-time resolution is necessary, then the current source must still have
// exactly one match (including declared prefix/suffix context).
export function evidencePassageGlimpse(passage, readText, contextSize = 36) {
  if (!passage || !["specification-passage", "implementation-passage"].includes(passage.kind)
      || passage.verification?.status !== "resolved" || !passage.parentFile) return null;
  const { exact, prefix, suffix } = passage.selector ?? {};
  if (typeof exact !== "string" || !exact.length) return null;
  const source = readText(passage.parentFile);
  if (typeof source !== "string") return null;
  const matches = [];
  for (let at = source.indexOf(exact); at !== -1; at = source.indexOf(exact, at + 1)) {
    if ((!prefix || source.slice(0, at).endsWith(prefix))
        && (!suffix || source.slice(at + exact.length).startsWith(suffix))) matches.push(at);
  }
  if (matches.length !== 1) return null;
  const at = matches[0], end = at + exact.length;
  const width = Number.isFinite(contextSize) ? Math.max(0, Math.min(120, contextSize)) : 36;
  return {
    filePath: passage.parentFile,
    before: `${at > width ? "…" : ""}${source.slice(Math.max(0, at - width), at)}`,
    exact: source.slice(at, Math.min(end, at + 180)),
    truncated: end > at + 180,
    after: end > at + 180 ? "" : `${source.slice(end, end + width)}${end + width < source.length ? "…" : ""}`,
  };
}
