import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createDocumentProjectionRecord } from "./document-projection-contract.js";

const assetDirectory = (recordKey) => createHash("sha256").update(recordKey).digest("hex").slice(0, 12);
const encodeUrlPath = (parts) => parts.map(encodeURIComponent).join("/");

/**
 * Creates edition-specific media transports from the same converted records.
 * The standalone records retain Base64 bytes. Server records contain only
 * same-origin static URLs, while the bytes are written under public/.
 */
export function packageDocumentProjectionMedia({ records, publicRoot, publicUrlRoot = "/docx-assets" }) {
  if (!records || typeof records !== "object" || Array.isArray(records)) throw new TypeError("records must be an object.");
  if (typeof publicRoot !== "string" || !publicRoot) throw new TypeError("publicRoot must be a non-empty path.");
  if (publicUrlRoot !== "/docx-assets") throw new TypeError("publicUrlRoot must use the fixed /docx-assets boundary.");

  rmSync(publicRoot, { recursive: true, force: true });
  const serverRecords = {};
  const standaloneRecords = {};
  const assets = [];

  for (const key of Object.keys(records).sort()) {
    const record = records[key];
    standaloneRecords[key] = record;
    const directory = assetDirectory(key);
    const serverImages = record.embeddedImages.map((image) => {
      if (!image.contentBase64) throw new TypeError(`${key} does not contain standalone image bytes for ${image.imageId}.`);
      const fileName = basename(image.sourcePath);
      const bytes = Buffer.from(image.contentBase64, "base64");
      const relativeParts = [record.knowledgeObjectId, directory, fileName];
      const destination = join(publicRoot, ...relativeParts);
      mkdirSync(join(publicRoot, record.knowledgeObjectId, directory), { recursive: true });
      writeFileSync(destination, bytes);
      const resourceUrl = `${publicUrlRoot}/${encodeUrlPath(relativeParts)}`;
      assets.push(Object.freeze({ recordKey: key, imageId: image.imageId, resourceUrl, byteLength: bytes.byteLength, destination }));
      return {
        imageId: image.imageId,
        sourcePath: image.sourcePath,
        mediaType: image.mediaType,
        resourceUrl,
        byteLength: image.byteLength,
        altText: image.altText,
      };
    });
    serverRecords[key] = createDocumentProjectionRecord({
      ...record,
      embeddedImages: serverImages,
    });
  }

  return Object.freeze({
    serverRecords: Object.freeze(serverRecords),
    standaloneRecords: Object.freeze(standaloneRecords),
    assets: Object.freeze(assets),
  });
}
