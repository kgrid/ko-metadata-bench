/** Place one preview within the visible intersection of its workspace and viewport. */
export function placeTermPreview(trigger, workspace, viewport, preview = { width: 284, height: 190 }, gap = 8, padding = 10) {
  const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
  const bounds = {
    left: Math.max(padding, workspace?.left ?? padding),
    top: Math.max(padding, workspace?.top ?? padding),
    right: Math.min(viewport.width - padding, workspace?.right ?? viewport.width - padding),
    bottom: Math.min(viewport.height - padding, workspace?.bottom ?? viewport.height - padding),
  };
  const centeredTop = trigger.top + (trigger.height - preview.height) / 2;
  const centeredLeft = trigger.left + (trigger.width - preview.width) / 2;
  const candidates = [
    { placement: "right", left: trigger.right + gap, top: centeredTop },
    { placement: "left", left: trigger.left - preview.width - gap, top: centeredTop },
    { placement: "below", left: centeredLeft, top: trigger.bottom + gap },
    { placement: "above", left: centeredLeft, top: trigger.top - preview.height - gap },
  ];
  const overflow = (candidate) => Math.max(0, bounds.left - candidate.left) + Math.max(0, candidate.left + preview.width - bounds.right)
    + Math.max(0, bounds.top - candidate.top) + Math.max(0, candidate.top + preview.height - bounds.bottom);
  const selected = candidates.find((candidate) => overflow(candidate) === 0)
    ?? candidates.toSorted((left, right) => overflow(left) - overflow(right))[0];
  return Object.freeze({
    placement: selected.placement,
    left: clamp(selected.left, bounds.left, bounds.right - preview.width),
    top: clamp(selected.top, bounds.top, bounds.bottom - preview.height),
  });
}
