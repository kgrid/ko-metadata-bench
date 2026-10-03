import test from "node:test";
import assert from "node:assert/strict";
import { validatePackageMetadata, validateTurtleIdentifiers } from "../scripts/validate-package-metadata.mjs";

test("accepts absolute identifiers and relative identifiers resolved by @base", () => {
  const source = '@base <https://example.org/ko/> .\n<#record> <https://schema.org/identifier> <metadata.json> .';
  assert.equal(validateTurtleIdentifiers(source, "KO/existence.metadata.txt"), 1);
  assert.equal(validateTurtleIdentifiers('<https://example.org/ko> <https://schema.org/name> "KO" .', "KO/findability.metadata.txt"), 1);
});

test("reports the package file containing an unresolved identifier", () => {
  const object = {
    folderName: "HBOT3-KA",
    files: ["metadata.json", "auxiliary/aux-extra-metadata/existence.metadata.txt"],
    readText: () => '<#metadata-existence> <https://schema.org/name> "Existence" .',
  };
  assert.throws(() => validatePackageMetadata(object), /HBOT3-KA\/auxiliary\/aux-extra-metadata\/existence\.metadata\.txt: unresolved subject IRI "#metadata-existence"/);
});

test("reports every invalid metadata file in one package", () => {
  const object = {
    folderName: "KO",
    files: ["existence.metadata.txt", "findability.metadata.txt"],
    readText: () => '<#record> <https://schema.org/name> "KO" .',
  };
  assert.throws(() => validatePackageMetadata(object), (error) =>
    error.message.includes("KO/existence.metadata.txt") && error.message.includes("KO/findability.metadata.txt"));
});

test("reports malformed Turtle with its package file path", () => {
  assert.throws(
    () => validateTurtleIdentifiers('<https://example.org/ko> <https://schema.org/name> .', "KO/findability.metadata.txt"),
    /KO\/findability\.metadata\.txt: invalid Turtle:/,
  );
});

test("checks datatype identifiers after Turtle resolution", () => {
  assert.throws(
    () => validateTurtleIdentifiers('<https://example.org/ko> <https://schema.org/value> "1"^^<#number> .', "KO/existence.metadata.txt"),
    /KO\/existence\.metadata\.txt: unresolved literal datatype IRI "#number"/,
  );
  assert.equal(validateTurtleIdentifiers('@base <https://example.org/ko/> . <#record> <https://schema.org/value> "1"^^<#number> .', "KO/existence.metadata.txt"), 1);
});
