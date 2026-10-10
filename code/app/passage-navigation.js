// Navigate only after the rendered viewer contains one exact text-quote match.
// The build-time digest/selector check is separate from this display check.
export function safeEvidenceUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function evidenceActionUrl(annotationResolution, evidenceId) {
  const declaration = annotationResolution?.basisLinks?.find((link) => link.evidenceId === evidenceId);
  return safeEvidenceUrl(declaration?.sourceUrl) ?? safeEvidenceUrl(evidenceId);
}

export function markVerifiedPassage(root, selector) {
  const exact = selector?.exact;
  if (!root || typeof exact !== "string" || !exact.trim()) return { ok: false, reason: "No exact passage selector is available" };
  const expected = exact.match(/\S+/gu) ?? [];
  const tokens = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const matches = node.textContent.matchAll(/\S+/gu);
    for (const match of matches) tokens.push({ node, text: match[0], start: match.index, end: match.index + match[0].length });
  }
  const starts = [];
  for (let start = 0; start <= tokens.length - expected.length; start += 1) {
    if (expected.every((part, offset) => tokens[start + offset].text === part)) starts.push(start);
  }
  if (starts.length !== 1) return { ok: false, reason: starts.length ? `Rendered passage matches ${starts.length} locations` : "Exact passage not found in this viewer" };
  const selected = tokens.slice(starts[0], starts[0] + expected.length);
  const groups = [];
  for (const token of selected) {
    const previous = groups.at(-1);
    if (previous?.node === token.node) previous.end = token.end;
    else groups.push({ node: token.node, start: token.start, end: token.end });
  }
  let firstMark = null;
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const { node, start, end } = groups[index];
    const mark = root.ownerDocument.createElement("mark");
    mark.className = "knowledgePassageHighlight";
    mark.textContent = node.textContent.slice(start, end);
    const before = root.ownerDocument.createTextNode(node.textContent.slice(0, start));
    const after = root.ownerDocument.createTextNode(node.textContent.slice(end));
    node.replaceWith(before, mark, after);
    firstMark = mark;
  }
  firstMark?.scrollIntoView({ block: "center", behavior: "instant" });
  return { ok: true, reason: null, highlightedNodes: groups.length };
}
