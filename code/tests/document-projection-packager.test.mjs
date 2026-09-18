import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDocumentProjectionRecord } from "../app/document-projection-contract.js";
import { packageDocumentProjectionMedia } from "../app/document-projection-packager.js";

test("packages server images as static assets and standalone images as embedded data", () => {
  const root = mkdtempSync(join(tmpdir(), "docx-media-"));
  try {
    const record = createDocumentProjectionRecord({
      knowledgeObjectId: "workshop-ko-2",
      originalPath: "spec/clinical-summary.docx",
      originalFileAvailable: true,
      sanitizedHtml: '<article><img data-docx-image-id="image-1" alt="Diagram"></article>',
      embeddedImages: [{ imageId: "image-1", sourcePath: "word/media/image one.png", mediaType: "image/png", contentBase64: "aW1hZ2U=", byteLength: 5, altText: "Diagram" }],
    });
    const result = packageDocumentProjectionMedia({
      records: { "2/spec/clinical-summary.docx": record },
      publicRoot: root,
    });

    const standaloneImage = result.standaloneRecords["2/spec/clinical-summary.docx"].embeddedImages[0];
    const serverImage = result.serverRecords["2/spec/clinical-summary.docx"].embeddedImages[0];
    assert.equal(standaloneImage.contentBase64, "aW1hZ2U=");
    assert.equal("resourceUrl" in standaloneImage, false);
    assert.equal("contentBase64" in serverImage, false);
    assert.match(serverImage.resourceUrl, /^\/docx-assets\/workshop-ko-2\/[a-f0-9]{12}\/image%20one\.png$/);
    assert.equal(readFileSync(result.assets[0].destination, "utf8"), "image");
    assert.equal(result.assets[0].byteLength, 5);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
