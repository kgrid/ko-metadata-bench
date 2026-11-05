/** Build the shared, text-only bubble; attachment to banners is separate. */
export function createAcronymBubbleElement(document, expansion) {
  if (!document?.createElement || typeof expansion !== "string" || !expansion.trim()) {
    throw new TypeError("A document and nonempty written-out form are required.");
  }
  const bubble = document.createElement("div");
  bubble.className = "acronymBubble";
  bubble.setAttribute("role", "tooltip");
  bubble.textContent = expansion;
  return bubble;
}

/** Place a fixed bubble without changing the anchor or its banner's layout. */
export function positionAcronymBubble({ anchor, bubble, viewport, avoidRects = [] }) {
  if (!anchor?.getBoundingClientRect || !bubble?.getBoundingClientRect || !bubble?.style || !bubble?.dataset) {
    throw new TypeError("An anchor and a measurable bubble are required.");
  }
  const view = viewport ?? anchor.ownerDocument?.defaultView;
  const width = view?.innerWidth;
  const height = view?.innerHeight;
  if (!(width > 0 && height > 0)) throw new TypeError("A positive viewport is required.");
  const target = anchor.getBoundingClientRect();
  const measured = bubble.getBoundingClientRect();
  const bubbleWidth = Math.min(measured.width, width - 24);
  const bubbleHeight = Math.min(measured.height, height - 24);
  const margin = 12;
  const gap = 12;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const positions = [
    (target.left + target.right - bubbleWidth) / 2,
    target.left,
    target.right - bubbleWidth,
  ].map((left) => clamp(left, margin, Math.max(margin, width - margin - bubbleWidth)));
  const candidates = [];
  for (const side of ["below", "above"]) {
    const top = side === "below" ? target.bottom + gap : target.top - gap - bubbleHeight;
    if (top < margin || top + bubbleHeight > height - margin) continue;
    for (const left of positions) {
      const rect = { left, top, right: left + bubbleWidth, bottom: top + bubbleHeight };
      const overlap = avoidRects.reduce((sum, item) => sum + Math.max(0, Math.min(rect.right, item.right) - Math.max(rect.left, item.left)) * Math.max(0, Math.min(rect.bottom, item.bottom) - Math.max(rect.top, item.top)), 0);
      candidates.push({ side, left, top, overlap, offset: Math.abs((left + bubbleWidth / 2) - (target.left + target.right) / 2) });
    }
  }
  candidates.sort((a, b) => a.overlap - b.overlap || a.offset - b.offset);
  const chosen = candidates[0] ?? {
    side: "below",
    left: positions[0],
    top: clamp(target.bottom + gap, margin, Math.max(margin, height - margin - bubbleHeight)),
  };
  bubble.style.left = `${chosen.left}px`;
  bubble.style.top = `${chosen.top}px`;
  bubble.style.setProperty("--acronym-bubble-pointer-x", `${clamp((target.left + target.right) / 2 - chosen.left, 10, Math.max(10, bubbleWidth - 10))}px`);
  bubble.dataset.side = chosen.side;
  return { left: chosen.left, top: chosen.top, side: chosen.side };
}
