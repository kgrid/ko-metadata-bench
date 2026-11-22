import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Script } from "node:vm";
import { inflateSync } from "fflate";
import { installEmbeddedText, previewEmbeddedText } from "../app/embedded-text.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const server = read("../app/generated-ko-data.ts");
const standalone = read("../outputs/Knowledge-Object-Workbench.html");
const attachmentDigest = "1e18a5218d9909291a04ae9a86b9bfe1924cb6adce0dddfbc3455e77e0c9dee0";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function literal(source, name) {
  const value = source.match(new RegExp(`^const ${name}(?:[^=\\n]*)= *([\\s\\S]*?);$`, "m"))?.[1];
  assert.ok(value, `Missing generated data: ${name}`);
  return JSON.parse(value);
}

for (const [edition, source, filesName, foldersName, assemblyName] of [
  ["server", server, "objectFileOverrides", "OBJECT_FOLDER_NAMES", "EMBEDDED_ASSEMBLY"],
  ["standalone", standalone, "overrides", "objectFolderNames", "embeddedAssembly"],
]) {
  test(`${edition} carries exactly the attached CMS108 files and no KA`, () => {
    const folderSource = source.replace(/^const (OBJECT_FOLDER_NAMES = .*?) as const;$/m, "const $1;");
    assert.deepEqual(literal(folderSource, foldersName), ["CMS108KOf"]);
    assert.equal(literal(source, assemblyName), null);
    const files = literal(source, filesName);
    const binaries = literal(source, "objectBinaryOverrides");
    installEmbeddedText(files, literal(source, "compressedTextOverrides"), inflateSync);
    const paths = [...Object.keys(files), ...Object.keys(binaries)].sort();
    assert.equal(paths.length, 1227);
    assert.ok(paths.every((path) => path.startsWith("1/")));
    const manifest = paths.map((key) => {
      const bytes = Object.hasOwn(binaries, key) ? Buffer.from(binaries[key], "base64") : files[key];
      return `${key.slice(2)}\0${sha256(bytes)}\n`;
    }).join("");
    assert.equal(sha256(manifest), attachmentDigest);
    assert.equal(JSON.parse(files["1/metadata.json"])["@type"], "KnowledgeObject");
    assert.ok(!Object.hasOwn(files, "1/runner/runner.manifest.json"));
    const largePath = paths.find((path) => path.endsWith("CMS108FHIR-v1.0.000-FHIR.json"));
    assert.match(previewEmbeddedText(files[largePath]), /Preview truncated/);
  });
}

test("standalone embedded files cannot break script boundaries", () => {
  const scripts = [...standalone.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 2);
  for (const [index, script] of scripts.entries()) new Script(script[1], { filename: `standalone-${index}.js` });
});
