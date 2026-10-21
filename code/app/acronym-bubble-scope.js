// Only KO/KA names on the main view banners are eligible for acronym bubbles.
// This is a display scope, not a rule for changing source metadata or names.
export const ACRONYM_BUBBLE_SCOPE = Object.freeze({
  "knowledge-objects": "ko-banner-name",
  "metadata-rig": "ko-banner-name",
  knowledge: "ko-banner-name",
  findability: "ko-banner-name",
  access: "ko-banner-name",
  interoperability: "ko-banner-name",
  reusability: "ko-banner-name",
  "knowledge-assembly": "ka-banner-name",
});

export function isAcronymBubbleInScope(view, surface) {
  return Object.hasOwn(ACRONYM_BUBBLE_SCOPE, view) && ACRONYM_BUBBLE_SCOPE[view] === surface;
}
