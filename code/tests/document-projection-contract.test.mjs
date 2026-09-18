import assert from "node:assert/strict";
import test from "node:test";
import {
  DOCUMENT_PROJECTION_CONTRACT_VERSION,
  DOCUMENT_PROJECTION_STATUSES,
  createDocumentProjectionRecord,
  isDocumentProjectionRecord,
} from "../app/document-projection-contract.js";

const base = {
  knowledgeObjectId: "workshop-ko-2",
  originalPath: "spec/clinical-summary.docx",
  originalFileAvailable: true,
  originalByteLength: 1200,
};

test("defines the shared DOCX projection vocabulary", () => {
  assert.equal(DOCUMENT_PROJECTION_CONTRACT_VERSION, "1.0");
  assert.deepEqual(DOCUMENT_PROJECTION_STATUSES, ["complete", "partial", "unavailable"]);
});

test("creates a complete immutable and JSON-serializable projection", () => {
  const record = createDocumentProjectionRecord({
    ...base,
    sanitizedHtml: "<article><h1>Clinical summary</h1></article>",
    embeddedImages: [{ imageId: "figure-1", sourcePath: "word/media/image1.png", mediaType: "image/png", contentBase64: "aW1hZ2U=", byteLength: 5, altText: "Decision diagram" }],
  });
  assert.equal(record.projectionStatus, "complete");
  assert.equal(record.fileId, "workshop-ko-2:spec/clinical-summary.docx");
  assert.equal(record.fileName, "clinical-summary.docx");
  assert.equal(record.originalMediaType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(record.embeddedImages[0].fileName, "image1.png");
  assert.ok(Object.isFrozen(record));
  assert.ok(Object.isFrozen(record.embeddedImages));
  assert.ok(isDocumentProjectionRecord(JSON.parse(JSON.stringify(record))));
});

test("accepts a same-origin derived image URL for the server edition", () => {
  const record = createDocumentProjectionRecord({
    ...base,
    sanitizedHtml: "<article><figure><img></figure></article>",
    embeddedImages: [{ imageId: "figure-1", sourcePath: "word/media/image1.png", mediaType: "image/png", resourceUrl: "/docx-assets/workshop-ko-2/abc123/image1.png", byteLength: 5, altText: "Decision diagram" }],
  });
  assert.equal(record.embeddedImages[0].resourceUrl, "/docx-assets/workshop-ko-2/abc123/image1.png");
  assert.equal("contentBase64" in record.embeddedImages[0], false);
  assert.ok(isDocumentProjectionRecord(JSON.parse(JSON.stringify(record))));
});

test("derives partial status when readable HTML has conversion warnings", () => {
  const record = createDocumentProjectionRecord({
    ...base,
    fileId: "ko2-summary",
    sanitizedHtml: "<article><p>Readable content</p></article>",
    conversionWarnings: [{ code: "embedded-object-omitted", message: "An unsupported embedded object was omitted.", detail: "word/embeddings/object1.bin" }],
  });
  assert.equal(record.projectionStatus, "partial");
  assert.equal(record.conversionWarnings[0].code, "EMBEDDED-OBJECT-OMITTED");
});

test("derives unavailable status when no readable HTML exists", () => {
  const record = createDocumentProjectionRecord({
    ...base,
    sanitizedHtml: "",
    conversionWarnings: [{ code: "conversion-failed", message: "The Word document could not be converted." }],
  });
  assert.equal(record.projectionStatus, "unavailable");
  assert.equal(record.sanitizedHtml, "");
  assert.equal(record.originalFileAvailable, true);
});

test("rejects unsafe paths and inconsistent unavailable projections", () => {
  assert.throws(() => createDocumentProjectionRecord({ ...base, originalPath: "../secret.docx" }), /originalPath/);
  assert.throws(() => createDocumentProjectionRecord({ ...base, originalPath: "spec/summary.pdf" }), /\.docx/);
  assert.throws(() => createDocumentProjectionRecord({ ...base, embeddedImages: [{ imageId: "figure-1", sourcePath: "outside/image.png", mediaType: "image/png", contentBase64: "aW1hZ2U=" }] }), /word\/media/);
  assert.throws(() => createDocumentProjectionRecord({ ...base, sanitizedHtml: "<p>Text</p>", embeddedImages: [{ imageId: "figure-1", sourcePath: "word/media/image.png", mediaType: "image/png", resourceUrl: "https://tracker.example/image.png" }] }), /same-origin/);
  assert.throws(() => createDocumentProjectionRecord({ ...base, sanitizedHtml: "<p>Text</p>", embeddedImages: [{ imageId: "figure-1", sourcePath: "word/media/image.png", mediaType: "image/png", contentBase64: "aW1hZ2U=", resourceUrl: "/docx-assets/ko/image.png" }] }), /exactly one/);
});
