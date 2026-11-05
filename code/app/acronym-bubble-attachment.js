// Only the main-view KO/KA banner names may receive acronym anchors.
export const ACRONYM_BANNER_SELECTORS = Object.freeze([
  'section[aria-label="Knowledge Objects explorer"] .koObjectShade > summary > strong',
  'section[aria-label="Knowledge Objects explorer"] .ko-object-shade > summary > strong',
  'section[aria-label="Metadata rig"] .metadataRigCard > summary > strong',
  'section[aria-label="Metadata rig"] .metadata-rig-card > summary > strong',
  'section[aria-label="Knowledge exercise"] .knowledgeCard > summary > strong',
  'section[aria-label="Knowledge exercise"] .knowledge-card > summary > strong',
  'section[aria-label="Findability exercise"] .resultGroup > summary > strong',
  'section[aria-label="Findability exercise"] .result-group > summary > strong',
  'section[aria-label="Accessibility exercise"] .accessibilityCard > summary > strong',
  'section[aria-label="Accessibility exercise"] .accessibility-card > summary > strong',
  'section[aria-label="Interoperability exercise"] .interoperabilityPanel > summary > strong',
  'section[aria-label="Interoperability exercise"] .interoperability-panel > summary > strong',
  'section[aria-label="Reusability exercise"] .reusabilityCard > summary > strong',
  'section[aria-label="Reusability exercise"] .reusability-card > summary > strong',
  'section[aria-label="Knowledge Assembly explorer"].assemblyLanding .assemblyObjectBar > strong',
  'section[aria-label="Knowledge Assembly explorer"].assembly-landing .assembly-object-bar > strong',
]);

export function splitAcronymBannerName(name, registry) {
  if (typeof name !== "string" || !registry || typeof registry !== "object") return [];
  const acronyms = Object.keys(registry).filter((key) => /^[A-Z][A-Z0-9]*$/.test(key));
  if (!acronyms.length) return [{ text: name }];
  const expression = new RegExp(`\\b(${acronyms.sort((a, b) => b.length - a.length).join("|")})\\b`, "g");
  const parts = [];
  let cursor = 0;
  for (const match of name.matchAll(expression)) {
    if (match.index > cursor) parts.push({ text: name.slice(cursor, match.index) });
    parts.push({ text: match[0], expansion: registry[match[0]] });
    cursor = match.index + match[0].length;
  }
  if (cursor < name.length) parts.push({ text: name.slice(cursor) });
  return parts.length ? parts : [{ text: name }];
}

export function installAcronymBannerBubbles(document, { registry, createBehavior, createBubble, positionBubble }) {
  const view = document.defaultView;
  if (!document.body || !view?.MutationObserver) throw new TypeError("A browser document is required.");
  const registrations = new Map();
  let visibleBubble = null;
  const show = ({ anchor, expansion }) => {
    visibleBubble?.remove();
    visibleBubble = createBubble(document, expansion);
    visibleBubble.id = "active-acronym-bubble";
    document.body.append(visibleBubble);
    anchor.setAttribute("aria-describedby", visibleBubble.id);
    reposition();
  };
  const hide = ({ anchor }) => {
    anchor.removeAttribute("aria-describedby");
    visibleBubble?.remove();
    visibleBubble = null;
  };
  const behavior = createBehavior({ root: document, onShow: show, onHide: hide });
  function reposition() {
    const active = behavior.active();
    if (!active || !visibleBubble || !active.anchor.isConnected) return;
    const banner = active.anchor.closest("summary, .assemblyObjectBar, .assembly-object-bar");
    const avoidRects = [...(banner?.querySelectorAll("button, a, [role='button']") ?? [])]
      .filter((item) => item !== active.anchor && item.getBoundingClientRect().width)
      .map((item) => item.getBoundingClientRect());
    positionBubble({ anchor: active.anchor, bubble: visibleBubble, viewport: view, avoidRects });
  }
  const decorate = () => {
    for (const [anchor, remove] of registrations) {
      if (!anchor.isConnected) { remove(); registrations.delete(anchor); }
    }
    for (const strong of document.querySelectorAll(ACRONYM_BANNER_SELECTORS.join(","))) {
      if (strong.querySelector(".acronymBubbleAnchor")) continue;
      const parts = splitAcronymBannerName(strong.textContent ?? "", registry);
      if (!parts.some((part) => part.expansion)) continue;
      strong.replaceChildren(...parts.map((part) => {
        if (!part.expansion) return document.createTextNode(part.text);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "acronymBubbleAnchor";
        button.textContent = part.text;
        button.setAttribute("aria-label", `${part.text}: ${part.expansion}`);
        button.addEventListener("click", (event) => {
          const summary = button.closest("summary");
          if (!summary) return;
          event.preventDefault();
          event.stopPropagation();
          behavior.hide(button);
          summary.click();
        });
        button.addEventListener("keydown", (event) => { if (event.key !== "Escape") event.stopPropagation(); });
        registrations.set(button, behavior.register(button, part.expansion));
        return button;
      }));
    }
  };
  const observer = new view.MutationObserver(decorate);
  observer.observe(document.querySelector(".workspaces") ?? document.body, { childList: true, subtree: true });
  view.addEventListener("resize", reposition);
  view.addEventListener("scroll", reposition, true);
  decorate();
  return () => {
    observer.disconnect();
    view.removeEventListener("resize", reposition);
    view.removeEventListener("scroll", reposition, true);
    behavior.destroy();
    for (const anchor of registrations.keys()) {
      const strong = anchor.parentElement;
      if (strong?.matches?.("strong") && strong.isConnected) strong.textContent = strong.textContent;
    }
    registrations.clear();
    visibleBubble?.remove();
    visibleBubble = null;
  };
}
