import assert from "node:assert/strict";
import test from "node:test";
import { hydrateDocumentProjectionHtml, resolveDocumentProjection } from "../app/document-projection-view.js";

const html = '<article><img data-docx-image-id="image-1" alt="Diagram"></article>';

test("hydrates a server DOCX image with its derived static resource", () => {
  const projected = hydrateDocumentProjectionHtml({ sanitizedHtml: html, embeddedImages: [{ imageId: "image-1", mediaType: "image/png", resourceUrl: "/docx-assets/workshop-ko-2/hash/image.png" }] });
  assert.match(projected, /src="\/docx-assets\/workshop-ko-2\/hash\/image\.png"/);
});

test("hydrates a standalone DOCX image with its embedded data resource", () => {
  const projected = hydrateDocumentProjectionHtml({ sanitizedHtml: html, embeddedImages: [{ imageId: "image-1", mediaType: "image/png", contentBase64: "aW1hZ2U=" }] });
  assert.match(projected, /src="data:image\/png;base64,aW1hZ2U="/);
});

test("does not hydrate unsafe or external DOCX image resources", () => {
  const projected = hydrateDocumentProjectionHtml({ sanitizedHtml: html, embeddedImages: [{ imageId: "image-1", mediaType: "image/png", resourceUrl: "https://tracker.example/image.png" }] });
  assert.doesNotMatch(projected, /src=/);
  assert.doesNotMatch(projected, /tracker\.example/);
});

test("resolves reorganized KO documents by one unique same-object filename", () => {
  const projections = {
    "1/summary.docx": { fileName: "summary.docx", sanitizedHtml: "<p>KO 1</p>" },
    "2/summary.docx": { fileName: "summary.docx", sanitizedHtml: "<p>KO 2</p>" },
  };
  assert.equal(resolveDocumentProjection(projections, 1, "specs/summary.docx"), projections["1/summary.docx"]);
  assert.equal(resolveDocumentProjection(projections, 2, "documents/summary.docx"), projections["2/summary.docx"]);
});

test("does not guess when same-object document filenames are ambiguous", () => {
  const projections = {
    "1/a/summary.docx": { fileName: "summary.docx" },
    "1/b/summary.docx": { fileName: "summary.docx" },
  };
  assert.equal(resolveDocumentProjection(projections, 1, "specs/summary.docx"), undefined);
});
