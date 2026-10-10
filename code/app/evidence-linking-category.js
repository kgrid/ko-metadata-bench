// These are categories of declared linking detail, never evidence-quality scores.
export const EVIDENCE_LINKING_CATEGORIES = Object.freeze({
  none: { label: "None", route: "No direct evidence links" },
  koWide: { label: "KO-wide", route: "Evidence → whole KO" },
  elementSpecification: { label: "Element + specification", route: "Evidence → knowledge element → CKS passage" },
  elementsCode: { label: "Elements + code", route: "Evidence → knowledge elements → corresponding code passages" },
  elementSpecificationCode: { label: "Element + specification + code", route: "Evidence → knowledge element → CKS passage + code passages" },
});

const entries = (value) => Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
const types = (record) => Array.isArray(record?.["@type"]) ? record["@type"] : [record?.["@type"]];
const isConstituent = (record) => types(record).includes("koio:KnowledgeObject");
const idOf = (record) => typeof record?.["@id"] === "string" ? record["@id"] : "";
const basisOf = (record) => entries(record?.["koio:hasEvidentialBasis"] ?? record?.hasEvidentialBasis).filter((basis) => idOf(basis));
const selectorOf = (part) => part?.["http://www.w3.org/ns/oa#hasSelector"];
const sourceOf = (part) => idOf(part?.["http://www.w3.org/ns/oa#hasSource"]);

function passageIds(records) {
  return new Set(records.flatMap((record) => entries(record?.["schema:hasPart"])
    .filter((part) => idOf(part) && sourceOf(part) === idOf(record)
      && types(part).includes("http://www.w3.org/ns/oa#SpecificResource")
      && types(selectorOf(part)).includes("http://www.w3.org/ns/oa#TextQuoteSelector")
      && typeof selectorOf(part)?.["http://www.w3.org/ns/oa#exact"] === "string"
      && selectorOf(part)["http://www.w3.org/ns/oa#exact"].length > 0)
    .map(idOf)));
}

function targetsFor(element) {
  return new Set(entries(element?.["schema:subjectOf"])
    .filter((annotation) => annotation?.type === "Annotation"
      && annotation?.motivation === "linking" && annotation?.body === idOf(element)
      && typeof annotation?.target === "string")
    .map((annotation) => annotation.target));
}

// Unrecognized or mixed patterns are deliberately not forced into a teaching category.
export function deriveEvidenceLinkingCategory(metadata) {
  const knowledge = entries(metadata?.["koio:hasKnowledge"] ?? metadata?.hasKnowledge);
  const elements = knowledge.filter((entry) => !isConstituent(entry));
  if (!metadata || !elements.length) return { category: null, reason: "Knowledge elements are not declared" };

  const koBasisCount = basisOf(metadata).length;
  const specificationPassages = passageIds(entries(metadata["koio:hasDocumentation"] ?? metadata.hasDocumentation)
    .filter((record) => types(record).includes("Specification Document")));
  const profiles = elements.map((element) => {
    const targets = targetsFor(element);
    const codePassages = passageIds(entries(element.implementedBy));
    return {
      basisCount: basisOf(element).length,
      specification: [...targets].some((target) => specificationPassages.has(target)),
      code: [...targets].some((target) => codePassages.has(target)),
    };
  });
  const evidenced = profiles.filter((profile) => profile.basisCount > 0);
  const anySpecification = profiles.some((profile) => profile.specification);
  const anyCode = profiles.some((profile) => profile.code);
  const choose = (category) => ({ category, ...EVIDENCE_LINKING_CATEGORIES[category] });

  // Constituent-KO references never contribute evidence to an assembly.
  if (!koBasisCount && !evidenced.length) return choose("none");
  if (koBasisCount && !evidenced.length && !anySpecification && !anyCode) return choose("koWide");
  if (!koBasisCount && elements.length === 1 && evidenced.length === 1) {
    if (evidenced[0].specification && evidenced[0].code) return choose("elementSpecificationCode");
    if (evidenced[0].specification && !evidenced[0].code) return choose("elementSpecification");
  }
  if (!koBasisCount && elements.length > 1 && evidenced.length > 1
      && profiles.every((profile) => profile.code && !profile.specification)) return choose("elementsCode");
  return { category: null, reason: "Declared links do not match a defined teaching pattern" };
}
