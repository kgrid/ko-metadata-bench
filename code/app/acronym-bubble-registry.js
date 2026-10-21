// Written-out forms only. View eligibility is defined separately in acronym-bubble-scope.js.
export const ACRONYM_BUBBLE_REGISTRY = Object.freeze({
  DFU: "Diabetic Foot Ulcer",
  HBOT: "Hyperbaric Oxygen Therapy",
});

export function acronymBubbleExpansion(acronym) {
  return Object.hasOwn(ACRONYM_BUBBLE_REGISTRY, acronym) ? ACRONYM_BUBBLE_REGISTRY[acronym] : null;
}
