import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeDocumentProjectionHtml } from "../app/document-projection-sanitizer.js";

test("preserves the passive document vocabulary used by DOCX projections", () => {
  const input = '<article class="docx-projection"><h1>Heading</h1><p><strong>Bold</strong> <em>italic</em> <u>underlined</u></p><ol><li>First</li></ol><table><tbody><tr><th>Term</th><td>Value</td></tr></tbody></table><figure class="docx-image"><img data-docx-image-id="image-1" alt="Diagram"></figure><sup class="docx-footnote-ref"><a href="#docx-footnote-1">1</a></sup><section class="docx-footnotes"><ol><li id="docx-footnote-1">Note</li></ol></section><hr class="docx-section-break"><a href="https://example.org/evidence">Evidence</a></article>';
  const result = sanitizeDocumentProjectionHtml(input);
  assert.equal(result.removedConstructs.length, 0);
  assert.match(result.html, /<h1>Heading<\/h1>/);
  assert.match(result.html, /data-docx-image-id="image-1" alt="Diagram"/);
  assert.match(result.html, /href="#docx-footnote-1"/);
  assert.match(result.html, /href="https:\/\/example\.org\/evidence" rel="noopener noreferrer"/);
});

test("removes active, tracking, and embedded content while retaining readable text", () => {
  const input = '<article class="docx-projection hostile" onclick="steal()" contenteditable="true">'
    + '<script>steal()</script><style>@import "https://tracker.example/x.css";</style>'
    + '<p style="background:url(https://tracker.example/pixel)" onmouseover="steal()">Readable</p>'
    + '<a href="javascript:steal()" target="_blank">Unsafe link text</a>'
    + '<a href="https://example.org" onclick="steal()">Safe link</a>'
    + '<img src="https://tracker.example/pixel" onerror="steal()" data-docx-image-id="image-2" alt="Embedded">'
    + '<iframe src="https://tracker.example"></iframe><object data="payload"></object>'
    + '<form action="https://tracker.example"><input name="secret"></form>'
    + '</article>';
  const result = sanitizeDocumentProjectionHtml(input);
  assert.equal(result.html, '<article class="docx-projection"><p>Readable</p><a>Unsafe link text</a><a href="https://example.org" rel="noopener noreferrer">Safe link</a><img data-docx-image-id="image-2" alt="Embedded"></article>');
  assert.deepEqual(result.removedConstructs, ["form", "iframe", "object", "script", "style"]);
  assert.doesNotMatch(result.html, /(?:script|onclick|onmouseover|onerror|contenteditable|javascript:|tracker\.example|target=|src=|style=|object|iframe|form|input)/i);
});

test("allows only explicitly safe hyperlink schemes and local footnote anchors", () => {
  const result = sanitizeDocumentProjectionHtml('<p><a href="mailto:person@example.org">Mail</a><a href="#docx-footnote-2">Note</a><a href="data:text/html,bad">Data</a><a href="//tracker.example">Protocol relative</a></p>');
  assert.match(result.html, /href="mailto:person@example\.org"/);
  assert.match(result.html, /href="#docx-footnote-2"/);
  assert.doesNotMatch(result.html, /data:text|tracker\.example/);
});
