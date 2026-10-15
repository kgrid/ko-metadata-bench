export const DOCUMENT_PROJECTION_CONTRACT_VERSION = "1.0";

export const DOCUMENT_PROJECTION_STATUSES = Object.freeze([
  "complete",
  "partial",
  "unavailable",
]);

const WORD_DOCUMENT_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/;
const SAFE_MIME_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const SAFE_DERIVED_IMAGE_URL = /^\/docx-assets\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/;

const requiredString = (value, label) => {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
  return value.trim();
};

const identifier = (value, label) => {
  const normalized = requiredString(value, label);
  if (!SAFE_IDENTIFIER.test(normalized)) throw new TypeError(`${label} contains unsupported characters.`);
  return normalized;
};

const originalPath = (value) => {
  const normalized = requiredString(value, "originalPath");
  if (normalized.startsWith("/") || normalized.includes("\\") || /^[a-z][a-z\d+.-]*:/i.test(normalized)) {
    throw new TypeError("originalPath must be a relative POSIX path.");
  }
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) throw new TypeError("originalPath must not contain empty or relative traversal segments.");
  if (!/\.docx$/i.test(parts.at(-1))) throw new TypeError("originalPath must identify a .docx file.");
  return parts.join("/");
};

const optionalByteLength = (value, label) => {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} must be a non-negative safe integer or null.`);
  return value;
};

const normalizeWarning = (value, index) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`conversionWarnings[${index}] must be an object.`);
  const warning = {
    code: identifier(value.code, `conversionWarnings[${index}].code`).toUpperCase(),
    message: requiredString(value.message, `conversionWarnings[${index}].message`),
  };
  if (value.detail !== undefined && value.detail !== null && String(value.detail).trim()) warning.detail = String(value.detail).trim();
  return Object.freeze(warning);
};

const normalizeImage = (value, index) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`embeddedImages[${index}] must be an object.`);
  const sourcePath = requiredString(value.sourcePath, `embeddedImages[${index}].sourcePath`);
  if (!sourcePath.startsWith("word/media/") || sourcePath.includes("\\") || sourcePath.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new TypeError(`embeddedImages[${index}].sourcePath must be a safe word/media path.`);
  }
  const fileName = sourcePath.split("/").at(-1);
  const mediaType = requiredString(value.mediaType, `embeddedImages[${index}].mediaType`).toLowerCase();
  if (!SAFE_MIME_TYPE.test(mediaType) || !mediaType.startsWith("image/")) throw new TypeError(`embeddedImages[${index}].mediaType must be an image MIME type.`);
  const contentBase64 = typeof value.contentBase64 === "string" ? value.contentBase64.replace(/\s+/g, "") : "";
  const resourceUrl = typeof value.resourceUrl === "string" ? value.resourceUrl.trim() : "";
  if (Boolean(contentBase64) === Boolean(resourceUrl)) {
    throw new TypeError(`embeddedImages[${index}] must contain exactly one of contentBase64 or resourceUrl.`);
  }
  if (contentBase64 && !BASE64.test(contentBase64)) throw new TypeError(`embeddedImages[${index}].contentBase64 must contain valid Base64 data.`);
  if (resourceUrl && (!SAFE_DERIVED_IMAGE_URL.test(resourceUrl) || resourceUrl.includes("..") || resourceUrl.includes("\\"))) {
    throw new TypeError(`embeddedImages[${index}].resourceUrl must be a safe same-origin DOCX asset URL.`);
  }
  return Object.freeze({
    imageId: identifier(value.imageId, `embeddedImages[${index}].imageId`),
    sourcePath,
    fileName,
    mediaType,
    ...(contentBase64 ? { contentBase64 } : { resourceUrl }),
    byteLength: optionalByteLength(value.byteLength, `embeddedImages[${index}].byteLength`),
    altText: typeof value.altText === "string" ? value.altText.trim() : "",
  });
};

/**
 * Creates the edition-neutral, JSON-serializable record used for every derived
 * DOCX projection. Conversion and sanitization happen upstream; this boundary
 * validates their output and derives a self-consistent projection status.
 */
export function createDocumentProjectionRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Document projection input must be an object.");
  const knowledgeObjectId = identifier(input.knowledgeObjectId, "knowledgeObjectId");
  const path = originalPath(input.originalPath);
  const fileName = path.split("/").at(-1);
  const fileId = input.fileId === undefined ? `${knowledgeObjectId}:${path}` : identifier(input.fileId, "fileId");
  const sanitizedHtml = typeof input.sanitizedHtml === "string" ? input.sanitizedHtml.trim() : "";
  const embeddedImages = Object.freeze((Array.isArray(input.embeddedImages) ? input.embeddedImages : []).map(normalizeImage));
  const conversionWarnings = Object.freeze((Array.isArray(input.conversionWarnings) ? input.conversionWarnings : []).map(normalizeWarning));
  const originalFileAvailable = input.originalFileAvailable === true;
  const projectionStatus = sanitizedHtml ? (conversionWarnings.length ? "partial" : "complete") : "unavailable";
  if (projectionStatus === "unavailable" && embeddedImages.length) throw new TypeError("An unavailable projection cannot contain embedded images.");

  return Object.freeze({
    contractVersion: DOCUMENT_PROJECTION_CONTRACT_VERSION,
    knowledgeObjectId,
    fileId,
    originalPath: path,
    fileName,
    originalMediaType: WORD_DOCUMENT_MEDIA_TYPE,
    originalFileAvailable,
    originalByteLength: optionalByteLength(input.originalByteLength, "originalByteLength"),
    sanitizedHtml,
    embeddedImages,
    conversionWarnings,
    projectionStatus,
  });
}

export function isDocumentProjectionRecord(value) {
  try {
    const normalized = createDocumentProjectionRecord(value);
    return JSON.stringify(normalized) === JSON.stringify(value);
  } catch {
    return false;
  }
}
