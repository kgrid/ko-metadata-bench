import assert from "node:assert/strict";
import test from "node:test";
import { Parser } from "n3";
import { formatTurtleIri, formatTurtleIriList, formatTurtleLiteral, formatTurtleLiteralList, formatTurtleValueList } from "../app/turtle-value-formatters.js";

function parseObject(object) {
  return new Parser({ format: "text/turtle" }).parse(`<https://example.org/subject> <https://example.org/predicate> ${object} .`)[0].object;
}

test("Turtle literal formatter safely preserves learner text", () => {
  const source = formatTurtleLiteral('Quoted "text" with \\ and\nnew line — café');
  const object = parseObject(source);
  assert.equal(object.value, 'Quoted "text" with \\ and\nnew line — café');
  assert.equal(source, '"Quoted \\"text\\" with \\\\ and\\nnew line — café"');
});

test("Turtle literal formatter supports one safe suffix", () => {
  assert.equal(parseObject(formatTurtleLiteral("Michigan", { language: "EN-us" })).language, "en-us");
  assert.equal(parseObject(formatTurtleLiteral("1.0", { datatype: "http://www.w3.org/2001/XMLSchema#decimal" })).datatype.value, "http://www.w3.org/2001/XMLSchema#decimal");
  assert.throws(() => formatTurtleLiteral("value", { language: "en", datatype: "https://example.org/type" }), /cannot have both/);
  assert.throws(() => formatTurtleLiteral("value", { language: "not valid" }), /language tag is invalid/);
});

test("Turtle literal formatter rejects unsafe control characters", () => {
  assert.throws(() => formatTurtleLiteral("unsafe\u0000value"), /control character/);
  assert.throws(() => formatTurtleLiteral(17), /must be a string/);
});

test("Turtle IRI formatter accepts absolute IRIs and rejects unsafe values", () => {
  assert.equal(formatTurtleIri("https://example.org/terms/one"), "<https://example.org/terms/one>");
  assert.equal(formatTurtleIri("urn:example:term"), "<urn:example:term>");
  assert.throws(() => formatTurtleIri("relative/path"), /absolute IRI/);
  assert.throws(() => formatTurtleIri("https://example.org/a b"), /forbidden character/);
  assert.throws(() => formatTurtleIri("https://example.org/<unsafe>"), /forbidden character/);
});

test("Turtle list formatters preserve order and apply one formatter per value", () => {
  assert.equal(formatTurtleLiteralList(["first", "second"]), '"first",\n        "second"');
  assert.equal(formatTurtleIriList(["https://example.org/1", "https://example.org/2"]), "<https://example.org/1>,\n        <https://example.org/2>");
  assert.equal(formatTurtleValueList([], formatTurtleLiteral), "");
  assert.throws(() => formatTurtleIriList(["https://example.org/1", "bad value"]), /index 1/);
});
