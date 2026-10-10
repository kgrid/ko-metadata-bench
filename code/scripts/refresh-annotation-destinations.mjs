import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateAnnotationDestinations } from "../app/annotation-destination-validator.js";

const root = process.cwd();
const pagePath = join(root, "app/page.tsx");
const standalonePath = join(root, "outputs/Knowledge-Object-Workbench.html");
let page = readFileSync(pagePath, "utf8");
let standalone = readFileSync(standalonePath, "utf8");
function recordBetween(start, end) {
  const from = page.indexOf(start);
  const to = page.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Embedded payload not found: ${start}`);
  return JSON.parse(page.slice(page.indexOf("= ", from) + 2, to).trim().replace(/;$/, ""));
}
const texts = recordBetween("const objectFileOverrides:", "const objectBinaryOverrides:");
const binaries = recordBetween("const objectBinaryOverrides:", "const objectStaticAssetOverrides:");
const results = {};
for (let index = 1; index <= 4; index += 1) {
  const prefix = `${index}/`;
  const files = [...new Set([...Object.keys(texts), ...Object.keys(binaries)].filter((path) => path.startsWith(prefix)).map((path) => path.slice(prefix.length)))];
  const metadata = JSON.parse(texts[`${prefix}metadata.json`]);
  results[index] = validateAnnotationDestinations(metadata, {
    files,
    readBytes: (file) => binaries[`${prefix}${file}`] ? Buffer.from(binaries[`${prefix}${file}`], "base64") : Buffer.from(texts[`${prefix}${file}`] ?? "", "utf8"),
    readPassageText: (file) => texts[`${prefix}${file}`] ?? null,
  });
}
const serialized = JSON.stringify(results);
page = page.replace(/^const annotationDestinationOverrides:[^\n]+$/m,
  `const annotationDestinationOverrides: Record<string, Array<{ annotationId: string; targetId: string; kind: string | null; status: string; reason: string | null; filePath?: string }>> = ${serialized};`);
standalone = standalone.replace(/^const annotationDestinationOverrides=[^\n]+;$/m,
  `const annotationDestinationOverrides=${serialized};`);
writeFileSync(pagePath, page);
writeFileSync(standalonePath, standalone);
for (const [id, records] of Object.entries(results)) {
  console.log(`${id}: ${records.map((record) => `${record.kind || "unknown"} ${record.status}${record.reason ? ` (${record.reason})` : ""}`).join("; ")}`);
}
