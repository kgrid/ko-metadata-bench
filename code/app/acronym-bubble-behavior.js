/**
 * Shared, presentation-independent interaction for one floating acronym bubble.
 * The caller supplies the anchor, written-out form, and show/hide rendering hooks.
 */
export function createAcronymBubbleBehavior({ root, onShow, onHide }) {
  if (!root?.addEventListener || !root?.removeEventListener || typeof onShow !== "function" || typeof onHide !== "function") {
    throw new TypeError("A document root and show/hide callbacks are required.");
  }

  const registrations = new Map();
  let active = null;
  let touchAnchor = null;

  const hide = (anchor = null) => {
    if (!active || (anchor && active.anchor !== anchor)) return;
    const previous = active;
    active = null;
    onHide(previous);
  };
  const show = (anchor) => {
    const expansion = registrations.get(anchor)?.expansion;
    if (!expansion || active?.anchor === anchor) return;
    hide();
    active = { anchor, expansion };
    onShow(active);
  };
  const toggle = (anchor) => active?.anchor === anchor ? hide(anchor) : show(anchor);

  const onRootPointerDown = (event) => {
    const outside = !active?.anchor.contains(event.target);
    if (active && outside) hide();
    if (outside || event.pointerType !== "touch") touchAnchor = null;
  };
  const onRootKeyDown = (event) => {
    if (event.key !== "Escape" || !active) return;
    event.preventDefault();
    event.stopPropagation();
    hide();
  };
  root.addEventListener("pointerdown", onRootPointerDown);
  root.addEventListener("keydown", onRootKeyDown);

  return {
    register(anchor, expansion) {
      if (!anchor?.addEventListener || !anchor?.removeEventListener || !anchor?.contains || typeof expansion !== "string" || !expansion.trim()) {
        throw new TypeError("An anchor and a nonempty written-out form are required.");
      }
      if (registrations.has(anchor)) throw new Error("This acronym anchor is already registered.");
      const onPointerEnter = (event) => { if (event.pointerType !== "touch") show(anchor); };
      const onPointerLeave = (event) => { if (event.pointerType !== "touch") hide(anchor); };
      const onPointerDown = (event) => {
        if (event.pointerType !== "touch") return;
        touchAnchor = anchor;
        toggle(anchor);
      };
      const onFocus = () => { if (touchAnchor !== anchor) show(anchor); };
      const onBlur = () => { hide(anchor); if (touchAnchor === anchor) touchAnchor = null; };
      anchor.addEventListener("pointerenter", onPointerEnter);
      anchor.addEventListener("pointerleave", onPointerLeave);
      anchor.addEventListener("pointerdown", onPointerDown);
      anchor.addEventListener("focus", onFocus);
      anchor.addEventListener("blur", onBlur);
      const remove = () => {
        if (!registrations.has(anchor)) return;
        hide(anchor);
        anchor.removeEventListener("pointerenter", onPointerEnter);
        anchor.removeEventListener("pointerleave", onPointerLeave);
        anchor.removeEventListener("pointerdown", onPointerDown);
        anchor.removeEventListener("focus", onFocus);
        anchor.removeEventListener("blur", onBlur);
        if (touchAnchor === anchor) touchAnchor = null;
        registrations.delete(anchor);
      };
      registrations.set(anchor, { expansion, remove });
      return remove;
    },
    hide,
    active: () => active,
    destroy() {
      for (const { remove } of registrations.values()) remove();
      root.removeEventListener("pointerdown", onRootPointerDown);
      root.removeEventListener("keydown", onRootKeyDown);
    },
  };
}
