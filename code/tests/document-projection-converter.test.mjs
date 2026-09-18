import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { convertDocxToProjection, documentProjectionToPlainText } from "../app/document-projection-converter.js";

const createFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "docx-projection-"));
  const word = join(root, "word");
  execFileSync("mkdir", ["-p", join(word, "media"), join(word, "_rels")]);
  writeFileSync(join(word, "document.xml"), `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="relationships" xmlns:wp="drawing" xmlns:a="art"><w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Safe &amp; deterministic</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:b/><w:i/></w:rPr><w:t>Strong text</w:t></w:r><w:hyperlink r:id="rIdLink"><w:r><w:t>Evidence</w:t></w:r></w:hyperlink></w:p>
    <w:p><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>First step</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Second step</w:t></w:r></w:p>
    <w:tbl><w:tr><w:trPr><w:tblHeader/></w:trPr><w:tc><w:p><w:r><w:t>Cell one</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cell two</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="Figure" descr="Decision diagram"/><a:graphic><a:graphicData><a:blip r:embed="rIdImage"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
    <w:p><w:r><w:t>See note</w:t><w:footnoteReference w:id="1"/></w:r></w:p>
    <w:p><w:pPr><w:sectPr/></w:pPr><w:r><w:t>New section</w:t></w:r></w:p>
    <w:p><w:r><w:object><o:OLEObject/></w:object></w:r></w:p>
  </w:body></w:document>`);
  writeFileSync(join(word, "_rels", "document.xml.rels"), `<Relationships>
    <Relationship Id="rIdLink" Type="hyperlink" Target="https://example.org/evidence" TargetMode="External"/>
    <Relationship Id="rIdImage" Type="image" Target="media/image1.png"/>
  </Relationships>`);
  writeFileSync(join(word, "numbering.xml"), `<w:numbering><w:abstractNum w:abstractNumId="8"><w:lvl><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="8"/></w:num></w:numbering>`);
  writeFileSync(join(word, "footnotes.xml"), `<w:footnotes><w:footnote w:id="1"><w:p><w:r><w:t>Supporting footnote.</w:t></w:r></w:p></w:footnote></w:footnotes>`);
  writeFileSync(join(word, "media", "image1.png"), Buffer.from("image"));
  const docx = join(root, "fixture.docx");
  execFileSync("zip", ["-q", "-r", docx, "word"], { cwd: root });
  return { root, docx };
};

test("deterministically converts a DOCX package into the shared projection contract", () => {
  const fixture = createFixture();
  try {
    const input = { docxPath: fixture.docx, knowledgeObjectId: "workshop-ko-9", originalPath: "spec/fixture.docx" };
    const first = convertDocxToProjection(input);
    const second = convertDocxToProjection(input);
    assert.deepEqual(first, second);
    assert.equal(first.projectionStatus, "partial");
    assert.match(first.sanitizedHtml, /<h1>Safe &amp; deterministic<\/h1>/);
    assert.match(first.sanitizedHtml, /<em><strong>Strong text<\/strong><\/em>/);
    assert.match(first.sanitizedHtml, /<a href="https:\/\/example\.org\/evidence" rel="noopener noreferrer">Evidence<\/a>/);
    assert.match(first.sanitizedHtml, /<ol><li>First step<\/li><li>Second step<\/li><\/ol>/);
    assert.match(first.sanitizedHtml, /<table><tbody><tr><th><p>Cell one<\/p><\/th>/);
    assert.match(first.sanitizedHtml, /<figure class="docx-image"><img data-docx-image-id="image-1" alt="Decision diagram"><\/figure>/);
    assert.match(first.sanitizedHtml, /<sup class="docx-footnote-ref"><a href="#docx-footnote-1">1<\/a><\/sup>/);
    assert.match(first.sanitizedHtml, /<section class="docx-footnotes"><hr><ol><li id="docx-footnote-1">/);
    assert.match(first.sanitizedHtml, /<hr class="docx-section-break">/);
    assert.equal(first.embeddedImages.length, 1);
    assert.equal(first.embeddedImages[0].contentBase64, "aW1hZ2U=");
    assert.equal(first.embeddedImages[0].altText, "Decision diagram");
    assert.ok(first.conversionWarnings.some((item) => item.code === "EMBEDDED-OBJECT-OMITTED"));
    assert.ok(!first.conversionWarnings.some((item) => item.code.endsWith("-PENDING")));
    const plainText = documentProjectionToPlainText(first);
    assert.match(plainText, /^\[Extracted DOCX text\]/);
    assert.match(plainText, /Safe & deterministic/);
    assert.match(plainText, /Strong text/);
    assert.match(plainText, /Cell one/);
    assert.match(plainText, /Cell two/);
    assert.doesNotMatch(plainText, /<[^>]+>/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("plain-text DOCX previews use the successful projection without a second unzip path", () => {
  assert.equal(documentProjectionToPlainText({ sanitizedHtml: "" }), "[Extracted DOCX text unavailable]");
  assert.equal(
    documentProjectionToPlainText({ sanitizedHtml: "<article><h1>Large document</h1><p>Readable content &amp; meaning.</p></article>" }),
    "[Extracted DOCX text]\n\nLarge document\nReadable content & meaning.",
  );
});

test("real KO projections are embedded identically in both editions at build time", () => {
  const react = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  assert.match(react, /const documentProjectionOverrides: Record<string, unknown> = \{/);
  assert.match(standalone, /const documentProjectionOverrides=\{/);
});

test("both editions derive the large Wagner DOCX preview from its successful projection", () => {
  const key = "1/specs/kgrid.org_Meggitt_Wagner_Questionnaire_CKS_Version_1_0.docx";
  const react = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const reactFiles = JSON.parse(react.match(/const objectFileOverrides: Record<string, string> = (\{[\s\S]*?\});\nconst objectBinaryOverrides:/)?.[1] ?? "{}");
  const standaloneFiles = JSON.parse(standalone.match(/const overrides=(\{[\s\S]*?\});\nconst objectBinaryOverrides=/)?.[1] ?? "{}");
  for (const files of [reactFiles, standaloneFiles]) {
    assert.match(files[key], /^\[Extracted DOCX text\]\n\nCOMPUTABLE KNOWLEDGE/);
    assert.doesNotMatch(files[key], /Extracted DOCX text unavailable/);
  }
  assert.equal(reactFiles[key], standaloneFiles[key]);
});
