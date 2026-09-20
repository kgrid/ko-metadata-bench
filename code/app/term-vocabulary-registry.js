export const EMBEDDED_VOCABULARY_REGISTRY_VERSION = "1.0";

const VOCABULARIES = Object.freeze({
  schema: Object.freeze({ label: "Schema.org", namespaceIri: "https://schema.org/" }),
  prov: Object.freeze({ label: "PROV-O", namespaceIri: "http://www.w3.org/ns/prov#" }),
  dcterms: Object.freeze({ label: "Dublin Core Terms", namespaceIri: "http://purl.org/dc/terms/" }),
  rdf: Object.freeze({ label: "RDF", namespaceIri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#" }),
  koio: Object.freeze({ label: "KOIO 2.1", namespaceIri: "https://kgrid.org/koio#" }),
});

const DEFINITIONS = [
  ["schema", "Action", "class", "An activity that can be performed on or with a resource."],
  ["schema", "CreativeWork", "class", "A created work, including a document, dataset, or software-related resource."],
  ["schema", "DefinedTerm", "class", "A term whose meaning is established by a vocabulary or term set."],
  ["schema", "DefinedTermSet", "class", "A collection that defines and organizes controlled terms."],
  ["schema", "DownloadAction", "class", "An action that retrieves a resource for local use."],
  ["schema", "EntryPoint", "class", "A declared location and protocol for accessing an action."],
  ["schema", "Organization", "class", "An organized group, institution, or other collective agent."],
  ["schema", "PropertyValue", "class", "A structured property-and-value assertion."],
  ["schema", "SoftwareApplication", "class", "Software intended to perform an application-level function."],
  ["schema", "SoftwareSourceCode", "class", "Source code or a source-code package."],
  ["schema", "ViewAction", "class", "An action that presents a resource for viewing."],
  ["schema", "about", "property", "Identifies the subject matter described by a resource."],
  ["schema", "abstract", "property", "Provides a concise summary of a resource."],
  ["schema", "actionApplication", "property", "Identifies the application used to perform an action."],
  ["schema", "additionalProperty", "property", "Adds a structured property not covered by a more specific field."],
  ["schema", "additionalType", "property", "Supplies an additional type from an external vocabulary."],
  ["schema", "affiliation", "property", "Identifies an organization with which a person or agent is affiliated."],
  ["schema", "alternateName", "property", "Provides another name by which a resource is known."],
  ["schema", "citation", "property", "Links a resource to a work that it cites or supports it."],
  ["schema", "contentType", "property", "Declares the media type or content type of a resource."],
  ["schema", "datePublished", "property", "States when a resource was first published."],
  ["schema", "description", "property", "Provides a human-readable description of a resource."],
  ["schema", "email", "property", "Provides an electronic mail address."],
  ["schema", "hasDefinedTerm", "property", "Links a term set to a term it defines."],
  ["schema", "hasPart", "property", "Links a resource to one of its constituent parts."],
  ["schema", "identifier", "property", "Provides an identifier assigned to a resource."],
  ["schema", "inDefinedTermSet", "property", "Links a controlled term to the term set that defines it."],
  ["schema", "isPartOf", "property", "Links a resource to a larger resource that contains it."],
  ["schema", "keywords", "property", "Supplies words or phrases useful for discovery."],
  ["schema", "license", "property", "Links to or names the license governing reuse."],
  ["schema", "name", "property", "Provides the primary human-readable name of a resource."],
  ["schema", "object", "property", "Identifies the object affected by an action."],
  ["schema", "potentialAction", "property", "Declares an action that can be performed with a resource."],
  ["schema", "result", "property", "Identifies the result produced by an action."],
  ["schema", "subjectOf", "property", "Links a resource to material that describes or concerns it."],
  ["schema", "target", "property", "Links an action to the entry point through which it is performed."],
  ["schema", "termCode", "property", "Provides the code assigned to a term within its defining vocabulary."],
  ["schema", "url", "property", "Provides a web address for a resource."],
  ["schema", "urlTemplate", "property", "Provides a URL pattern used to invoke or access an action."],
  ["schema", "usageInfo", "property", "Links to information explaining how a resource may be used."],
  ["schema", "value", "property", "Provides the value carried by a structured property assertion."],
  ["schema", "valueReference", "property", "Links a value to a reference that qualifies or defines it."],
  ["schema", "version", "property", "States the version assigned to a resource."],
  ["prov", "Entity", "class", "A physical, digital, conceptual, or other thing with a fixed aspect."],
  ["prov", "has_provenance", "property", "Links a resource to provenance information describing its history."],
  ["prov", "wasAttributedTo", "property", "Identifies an agent responsible for an entity."],
  ["prov", "wasDerivedFrom", "property", "Identifies an earlier entity from which this entity was derived."],
  ["dcterms", "conformsTo", "property", "Identifies a standard or specification to which a resource conforms."],
  ["dcterms", "title", "property", "Provides a name given to a resource."],
  ["dcterms", "type", "property", "States the nature or genre of a resource."],
  ["rdf", "type", "property", "States that a resource is an instance of a class."],
  ["koio", "KnowledgeObject", "class", "A bounded digital object that packages knowledge and the resources needed to use it."],
  ["koio", "Knowledge", "class", "A knowledge-bearing resource contained by a Knowledge Object."],
  ["koio", "Test", "class", "A resource that checks an aspect of a Knowledge Object or its knowledge."],
  ["koio", "hasDocumentation", "property", "Links a Knowledge Object to documentation supplied with it."],
  ["koio", "hasKnowledge", "property", "Links a Knowledge Object to a knowledge-bearing resource it contains."],
  ["koio", "hasService", "property", "Links a Knowledge Object to a service through which it can be used."],
  ["koio", "hasTest", "property", "Links a Knowledge Object to a test supplied with it."],
];

const KOIO_DOCUMENTATION_ANCHORS = Object.freeze({
  KnowledgeObject: "knowledge-object",
  Knowledge: "knowledge",
  Test: "test",
  hasDocumentation: "has-documentation",
  hasKnowledge: "has-knowledge",
  hasService: "has-service",
  hasTest: "has-test",
});

const externalUrlFor = (vocabularyKey, localName) => vocabularyKey === "koio"
  ? `https://github.com/kgrid/koio#${KOIO_DOCUMENTATION_ANCHORS[localName] ?? localName.toLowerCase()}`
  : `${VOCABULARIES[vocabularyKey].namespaceIri}${localName}`;

const entries = DEFINITIONS.map(([vocabularyKey, localName, termKind, explanation]) => {
  const vocabulary = VOCABULARIES[vocabularyKey];
  const iri = `${vocabulary.namespaceIri}${localName}`;
  return Object.freeze({
    iri,
    label: localName,
    termKind,
    compactIdentifier: `${vocabularyKey}:${localName}`,
    vocabulary,
    explanation,
    externalUrl: externalUrlFor(vocabularyKey, localName),
  });
}).sort((left, right) => left.iri.localeCompare(right.iri));

export const EMBEDDED_VOCABULARY_TERMS = Object.freeze(entries);
export const EMBEDDED_VOCABULARY_REGISTRY = Object.freeze(Object.fromEntries(entries.map((entry) => [entry.iri, entry])));

export function getEmbeddedVocabularyTerm(iri) {
  return typeof iri === "string" ? EMBEDDED_VOCABULARY_REGISTRY[iri] ?? null : null;
}

export function serializeEmbeddedVocabularyRegistry() {
  return JSON.stringify({
    version: EMBEDDED_VOCABULARY_REGISTRY_VERSION,
    terms: EMBEDDED_VOCABULARY_TERMS,
  });
}
