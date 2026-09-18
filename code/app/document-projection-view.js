const SAFE_IMAGE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/;
const SAFE_MEDIA_TYPE = /^image\/(?:png|jpeg|gif|webp|svg\+xml|bmp|tiff)$/i;
const SAFE_RESOURCE_URL = /^\/docx-assets\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/;
const SAFE_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const escapeAttribute = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function hydrateDocumentProjectionHtml(record) {
  if (!record || typeof record !== "object" || typeof record.sanitizedHtml !== "string") return "";
  let html = record.sanitizedHtml;
  const images = Array.isArray(record.embeddedImages) ? record.embeddedImages : [];
  images.forEach((image) => {
    if (!image || !SAFE_IMAGE_ID.test(String(image.imageId ?? "")) || !SAFE_MEDIA_TYPE.test(String(image.mediaType ?? ""))) return;
    const resourceUrl = typeof image.resourceUrl === "string" && SAFE_RESOURCE_URL.test(image.resourceUrl) && !image.resourceUrl.includes("..") ? image.resourceUrl : "";
    const contentBase64 = typeof image.contentBase64 === "string" && SAFE_BASE64.test(image.contentBase64) ? image.contentBase64 : "";
    const source = resourceUrl || (contentBase64 ? `data:${image.mediaType};base64,${contentBase64}` : "");
    if (!source) return;
    const marker = `data-docx-image-id="${image.imageId}"`;
    html = html.split(marker).join(`src="${escapeAttribute(source)}" ${marker}`);
  });
  return html;
}

export function resolveDocumentProjection(projections, objectId, file) {
  if (!projections || typeof projections !== "object") return undefined;
  const exact = projections[`${objectId}/${file}`];
  if (exact) return exact;
  const fileName = String(file ?? "").split("/").at(-1)?.toLowerCase();
  if (!fileName) return undefined;
  const matches = Object.entries(projections).filter(([projectionKey, projection]) => {
    if (!projectionKey.startsWith(`${objectId}/`) || !projection || typeof projection !== "object") return false;
    return String(projection.fileName ?? "").toLowerCase() === fileName;
  });
  return matches.length === 1 ? matches[0][1] : undefined;
}
