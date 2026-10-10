import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deriveEvidenceLinkingCategory } from "../app/evidence-linking-category.js";

const embedded = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8").split("\n");
const metadataFor = (id) => {
  const line = embedded.find((value) => value.startsWith(`  "${id}/metadata.json":`));
  return JSON.parse(JSON.parse(line.slice(line.indexOf(":") + 1).trim().replace(/,$/, "")));
};

test("the five embedded objects classify from their own metadata declarations", () => {
  const categories = [1, 2, 3, 4].map((id) => deriveEvidenceLinkingCategory(metadataFor(id)).category);
  const assemblyLine = embedded.find((value) => value.startsWith("const EMBEDDED_ASSEMBLY:"));
  const assembly = JSON.parse(assemblyLine.slice(assemblyLine.indexOf("= ") + 2).replace(/;$/, ""));
  categories.push(deriveEvidenceLinkingCategory(assembly.metadata).category);
  assert.deepEqual(categories, ["koWide", "elementSpecification", "elementsCode", "elementSpecificationCode", "none"]);
});

test("names and identifiers do not determine the category", () => {
  const metadata = metadataFor(1);
  metadata["dc:title"] = "Entirely different KO";
  metadata["@id"] = "https://example.org/unrelated";
  assert.equal(deriveEvidenceLinkingCategory(metadata).category, "koWide");
});

test("citations, documentation, and file-level implementation do not imply evidence or passage links", () => {
  const metadata = {
    "dc:source": [{ "@id": "paper" }],
    "koio:hasDocumentation": [{ "@id": "specs/cks.docx", "@type": "Specification Document" }],
    "koio:hasKnowledge": [{ "@id": "operation", implementedBy: { "@id": "src/code.js" } }],
  };
  assert.equal(deriveEvidenceLinkingCategory(metadata).category, "none");
  metadata["koio:hasKnowledge"][0]["koio:hasEvidentialBasis"] = { "@id": "paper" };
  assert.equal(deriveEvidenceLinkingCategory(metadata).category, null);
});

test("broken or unrelated passage annotations cannot manufacture a richer category", () => {
  const metadata = metadataFor(2);
  const element = metadata["koio:hasKnowledge"][0];
  element["schema:subjectOf"] = element["schema:subjectOf"].map((annotation) => ({ ...annotation, body: "some-other-element" }));
  assert.equal(deriveEvidenceLinkingCategory(metadata).category, null);
  const original = metadataFor(2);
  const spec = original["koio:hasDocumentation"].find((record) => JSON.stringify(record["@type"]).includes("Specification Document"));
  delete spec["schema:hasPart"]["http://www.w3.org/ns/oa#hasSelector"];
  assert.equal(deriveEvidenceLinkingCategory(original).category, null);
});

test("constituent evidence is not inherited and missing knowledge is not mislabeled None", () => {
  assert.equal(deriveEvidenceLinkingCategory({}).category, null);
  const assembly = {
    "koio:hasKnowledge": [
      { "@id": "assembly-operation" },
      { "@id": "constituent", "@type": "koio:KnowledgeObject", "koio:hasEvidentialBasis": { "@id": "paper" } },
    ],
  };
  assert.equal(deriveEvidenceLinkingCategory(assembly).category, "none");
});
