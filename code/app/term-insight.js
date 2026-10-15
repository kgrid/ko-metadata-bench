export const TERM_INSIGHT_CONTRACT_VERSION = "1.1";

export const TERM_INSIGHT_CATEGORIES = Object.freeze([
  "property",
  "resource",
  "controlled-term",
  "vocabulary",
  "literal",
  "nested-structure",
]);

export const TERM_INSIGHT_STATEMENT_ROLES = Object.freeze(["subject", "predicate", "object"]);
export const TERM_INSIGHT_DESCRIPTION_STATUSES = Object.freeze(["local-metadata", "embedded-vocabulary", "external-source-only", "unavailable"]);

const requiredString = (value, label) => {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
  return value.trim();
};

const optionalString = (value) => typeof value === "string" ? value.trim() : "";

const absoluteIri = (value, label, { webOnly = false } = {}) => {
  if (value === undefined || value === null || value === "") return null;
  const normalized = requiredString(value, label);
  let parsed;
  try { parsed = new URL(normalized); }
  catch { throw new TypeError(`${label} must be an absolute IRI.`); }
  if (webOnly && !["http:", "https:"].includes(parsed.protocol)) throw new TypeError(`${label} must use HTTP or HTTPS.`);
  return normalized;
};

const normalizeVocabulary = (value) => {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("vocabulary must be an object or null.");
  return Object.freeze({
    label: requiredString(value.label, "vocabulary.label"),
    namespaceIri: absoluteIri(value.namespaceIri, "vocabulary.namespaceIri"),
  });
};

const normalizeRelationship = (value, direction, index) => {
  const label = `localRelationships.${direction}[${index}]`;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return Object.freeze({
    statementId: requiredString(value.statementId, `${label}.statementId`),
    relationshipLabel: requiredString(value.relationshipLabel, `${label}.relationshipLabel`),
    predicateIri: absoluteIri(value.predicateIri, `${label}.predicateIri`),
    relatedTermId: requiredString(value.relatedTermId, `${label}.relatedTermId`),
    relatedLabel: requiredString(value.relatedLabel, `${label}.relatedLabel`),
  });
};

const relationshipOrder = (left, right) => left.relationshipLabel.localeCompare(right.relationshipLabel)
  || left.relatedLabel.localeCompare(right.relatedLabel)
  || left.predicateIri.localeCompare(right.predicateIri)
  || left.statementId.localeCompare(right.statementId);

const normalizeRelationshipList = (value, direction) => Object.freeze(
  (Array.isArray(value) ? value : [])
    .map((relationship, index) => normalizeRelationship(relationship, direction, index))
    .sort(relationshipOrder),
);

const normalizeStatementContext = (value) => {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("statementContext must be an object or null.");
  const role = requiredString(value.role, "statementContext.role");
  if (!TERM_INSIGHT_STATEMENT_ROLES.includes(role)) throw new TypeError(`statementContext.role must be one of ${TERM_INSIGHT_STATEMENT_ROLES.join(", ")}.`);
  return Object.freeze({
    statementId: requiredString(value.statementId, "statementContext.statementId"),
    role,
    subjectLabel: requiredString(value.subjectLabel, "statementContext.subjectLabel"),
    relationshipLabel: requiredString(value.relationshipLabel, "statementContext.relationshipLabel"),
    valueLabel: requiredString(value.valueLabel, "statementContext.valueLabel"),
  });
};

const normalizeIriFallback = (value) => {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("iriFallback must be an object or null.");
  return Object.freeze({
    applied: Boolean(value.applied),
    descriptionAvailable: Boolean(value.descriptionAvailable),
    namespaceLabel: requiredString(value.namespaceLabel, "iriFallback.namespaceLabel"),
    namespaceIri: absoluteIri(value.namespaceIri, "iriFallback.namespaceIri"),
    host: requiredString(value.host, "iriFallback.host"),
    resourceCategory: requiredString(value.resourceCategory, "iriFallback.resourceCategory"),
  });
};

/**
 * Creates the edition-neutral, JSON-serializable record used by both the
 * transient Linked Data preview and the persistent Term Details inspector.
 * Resolution happens upstream; this boundary normalizes, validates, sorts,
 * and deeply freezes the resulting insight.
 */
export function createTermInsightRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Term Insight input must be an object.");
  const category = requiredString(input.category, "category");
  if (!TERM_INSIGHT_CATEGORIES.includes(category)) throw new TypeError(`category must be one of ${TERM_INSIGHT_CATEGORIES.join(", ")}.`);
  const authoritativeIri = absoluteIri(input.authoritativeIri, "authoritativeIri");
  const externalUrl = absoluteIri(input.externalUrl, "externalUrl", { webOnly: true });
  return Object.freeze({
    contractVersion: TERM_INSIGHT_CONTRACT_VERSION,
    termId: requiredString(input.termId, "termId"),
    label: requiredString(input.label, "label"),
    category,
    compactIdentifier: requiredString(input.compactIdentifier, "compactIdentifier"),
    authoritativeIri,
    vocabulary: normalizeVocabulary(input.vocabulary),
    explanation: optionalString(input.explanation),
    descriptionStatus: TERM_INSIGHT_DESCRIPTION_STATUSES.includes(input.descriptionStatus) ? input.descriptionStatus : "unavailable",
    localRelationships: Object.freeze({
      incoming: normalizeRelationshipList(input.localRelationships?.incoming, "incoming"),
      outgoing: normalizeRelationshipList(input.localRelationships?.outgoing, "outgoing"),
    }),
    statementContext: normalizeStatementContext(input.statementContext),
    iriFallback: normalizeIriFallback(input.iriFallback),
    externalUrl,
  });
}

export function isTermInsightRecord(value) {
  try {
    const normalized = createTermInsightRecord(value);
    return JSON.stringify(normalized) === JSON.stringify(value);
  } catch {
    return false;
  }
}
