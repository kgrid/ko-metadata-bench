import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { validateAnnotationDestinations } from "../app/annotation-destination-validator.js";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const standalone = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
const between = (source, start, end) => JSON.parse(source.slice(source.indexOf("= ", source.indexOf(start)) + 2, source.indexOf(end, source.indexOf(start))).trim().replace(/;$/, ""));
const texts = between(page, "const objectFileOverrides:", "const objectBinaryOverrides:");
const binaries = between(page, "const objectBinaryOverrides:", "const objectStaticAssetOverrides:");
const statuses = between(page, "const annotationDestinationOverrides:", "const EMBEDDED_ASSEMBLY:");

test("current embedded local passages have unique selectors and matching file digests", () => {
  for (const id of [1, 2, 3, 4]) {
    const prefix = `${id}/`;
    const metadata = JSON.parse(texts[`${prefix}metadata.json`]);
    const files = [...new Set([...Object.keys(texts), ...Object.keys(binaries)].filter((path) => path.startsWith(prefix)).map((path) => path.slice(prefix.length)))];
    const checked = validateAnnotationDestinations(metadata, {
      files,
      readBytes: (file) => binaries[`${prefix}${file}`] ? Buffer.from(binaries[`${prefix}${file}`], "base64") : Buffer.from(texts[`${prefix}${file}`], "utf8"),
      readPassageText: (file) => texts[`${prefix}${file}`],
    });
    assert.deepEqual(checked, statuses[id]);
    assert.ok(checked.every((record) => record.status === "resolved" || record.status === "external"));
  }
});

test("missing files, changed digests, and nonunique selectors remain unresolved", () => {
  const source = "before exact after";
  const digest = createHash("sha256").update(source).digest("hex");
  const metadata = {
    "koio:hasKnowledge": [{
      "@id": "element", "schema:subjectOf": { id: "annotation", type: "Annotation", motivation: "linking", body: "element", target: "passage" },
      implementedBy: { "@id": "code.js", "schema:sha256": digest, "schema:hasPart": {
        "@id": "passage", "http://www.w3.org/ns/oa#hasSource": { "@id": "code.js" },
        "http://www.w3.org/ns/oa#hasSelector": { "@type": "http://www.w3.org/ns/oa#TextQuoteSelector", "http://www.w3.org/ns/oa#exact": "exact" },
      } },
    }],
  };
  const check = (files, text, bytes = source) => validateAnnotationDestinations(metadata, {
    files, readBytes: () => Buffer.from(bytes), readPassageText: () => text,
  })[0];
  assert.match(check([], source).reason, /missing/);
  assert.match(check(["code.js"], source, "changed").reason, /digest/);
  assert.match(check(["code.js"], "exact exact").reason, /2 passages/);
  assert.equal(check(["code.js"], source).status, "resolved");
});

test("external publication targets are recorded without reading or fetching them", () => {
  const metadata = {
    "dc:source": [{ "@id": "https://example.org/article", "schema:hasPart": { "@id": "https://example.org/article#table" } }],
    "koio:hasKnowledge": [{ "@id": "element", "schema:subjectOf": {
      id: "annotation", type: "Annotation", motivation: "linking", body: "element", target: "https://example.org/article#table",
    } }],
  };
  const [result] = validateAnnotationDestinations(metadata, {
    files: [], readBytes: () => { throw new Error("unexpected read"); }, readPassageText: () => { throw new Error("unexpected read"); },
  });
  assert.equal(result.status, "external");
});

test("both editions carry identical destination status records", () => {
  const portable = JSON.parse(standalone.match(/^const annotationDestinationOverrides=(.*);$/m)?.[1] ?? "null");
  assert.deepEqual(portable, statuses);
  assert.match(page, /Passage unresolved:/);
  assert.match(standalone, /Passage unresolved:/);
  assert.match(page, /whole file is not a substitute/);
  assert.match(standalone, /whole file is not a substitute/);
});
