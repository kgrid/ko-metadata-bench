const SCHEMA = "https://schema.org/";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const CONTROLLED_INSERTION_POINTS = deepFreeze({
  findability: [
    { id: "fullName", label: "Full name", learnerControlled: true, valueKind: "confirmed-literal", cardinality: { min: 1, max: 1 }, sourceLocator: { subject: "primary", predicate: `${SCHEMA}name` } },
    { id: "description", label: "Description", learnerControlled: true, valueKind: "literal", cardinality: { min: 1, max: 1 }, sourceLocator: { subject: "primary", predicate: `${SCHEMA}abstract` } },
    { id: "controlledSubjects", label: "Controlled subjects", learnerControlled: true, valueKind: "iri-list", cardinality: { min: 1, max: null }, sourceLocator: { subject: "primary", predicate: `${SCHEMA}about` } },
    { id: "searchTerms", label: "Search terms", learnerControlled: true, valueKind: "literal-list", cardinality: { min: 3, max: null }, sourceLocator: { subject: "primary", predicate: `${SCHEMA}keywords` } },
    {
      id: "outputVocabulary", label: "Applicable output vocabulary", learnerControlled: true, valueKind: "linked-defined-term-set", cardinality: { min: 4, max: 4 },
      sourceLocator: { subject: "primary", predicate: `${SCHEMA}additionalProperty`, qualifier: { predicate: `${SCHEMA}name`, value: "Output classification" }, controlledPredicates: [`${SCHEMA}valueReference`, `${SCHEMA}hasDefinedTerm`] },
    },
  ],
  reusability: [
    {
      id: "scope", label: "Scope", learnerControlled: true, valueKind: "linked-literal", cardinality: { min: 1, max: 1 },
      sourceLocator: { subject: "primary", predicate: `${SCHEMA}usageInfo`, controlledPredicates: [`${SCHEMA}description`] },
    },
    { id: "license", label: "License", learnerControlled: true, valueKind: "iri", cardinality: { min: 1, max: 1 }, sourceLocator: { subject: "primary", predicate: `${SCHEMA}license` } },
    { id: "evidence", label: "Evidence", learnerControlled: true, valueKind: "iri-list", cardinality: { min: 2, max: 2 }, sourceLocator: { subject: "primary", predicate: `${SCHEMA}citation` } },
  ],
});

const TEMPLATE_DEFINITIONS = deepFreeze({
  findability: { fileName: "findability.metadata.txt", profileLabel: "Findability", insertionPoints: CONTROLLED_INSERTION_POINTS.findability },
  reusability: { fileName: "reusability.metadata.txt", profileLabel: "Reusability", insertionPoints: CONTROLLED_INSERTION_POINTS.reusability },
});

function establishCanonicalTurtleTemplate(profile, source) {
  const definition = TEMPLATE_DEFINITIONS[profile];
  if (!definition) throw new TypeError(`Unsupported metadata template profile: ${profile}`);
  if (typeof source !== "string" || !source.trim()) throw new TypeError(`${definition.profileLabel} canonical Turtle source is required.`);
  const prefixes = [...source.matchAll(/^\s*@prefix\s+([^:]*):\s*<([^>]+)>\s*\.\s*$/gim)].map((match) => Object.freeze({ prefix: match[1], iri: match[2] }));
  if (!prefixes.some(({ prefix }) => prefix === "schema")) throw new TypeError(`${definition.profileLabel} canonical Turtle source must declare the schema prefix.`);
  const primarySubject = source.match(/^\s*<([^>]+)>\s*$/m)?.[1];
  if (!primarySubject) throw new TypeError(`${definition.profileLabel} canonical Turtle source must contain a primary named subject.`);
  return Object.freeze({
    profile,
    fileName: definition.fileName,
    profileLabel: definition.profileLabel,
    source,
    prefixes: Object.freeze(prefixes),
    primarySubject,
    insertionPoints: definition.insertionPoints,
  });
}

export function establishKo4CanonicalTurtleTemplates({ findability, reusability }) {
  return Object.freeze({
    findability: establishCanonicalTurtleTemplate("findability", findability),
    reusability: establishCanonicalTurtleTemplate("reusability", reusability),
  });
}
