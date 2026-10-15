import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { convertDocxToProjection } from "../app/document-projection-converter.js";
import { packageDocumentProjectionMedia } from "../app/document-projection-packager.js";
import { orderWorkshopObjects } from "../app/workshop-ordering.js";

const root = join(process.cwd(), "runner-ready-kos");
const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
const folders = orderWorkshopObjects(readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => {
  const folderPath = join(root, entry.name);
  const paths = walk(folderPath);
  const files = paths.map((path) => relative(folderPath, path).split("\\").join("/"));
  return { entry, folderName: entry.name, files, readText: (file) => readFileSync(join(folderPath, file), "utf8") };
})).map((item) => item.entry);

const records = {};
folders.forEach((folder, index) => {
  const folderPath = join(root, folder.name);
  for (const path of walk(folderPath).filter((file) => /\.docx$/i.test(file)).sort()) {
    const originalPath = relative(folderPath, path).split("\\").join("/");
    const knowledgeObjectId = `workshop-ko-${index + 1}`;
    records[`${index + 1}/${originalPath}`] = convertDocxToProjection({ docxPath: path, knowledgeObjectId, originalPath });
  }
});
const packaged = packageDocumentProjectionMedia({
  records,
  publicRoot: join(process.cwd(), "public", "docx-assets"),
});

const serialized = JSON.stringify(packaged.serverRecords, null, 2).replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
const reactPath = join(process.cwd(), "app/page.tsx");
let react = readFileSync(reactPath, "utf8");
if (/^const documentProjectionOverrides: Record<string, unknown> = /m.test(react)) react = react.replace(/^const documentProjectionOverrides: Record<string, unknown> = \{[\s\S]*?^\};/m, () => `const documentProjectionOverrides: Record<string, unknown> = ${serialized};`);
else react = react.replace(/^const base64ToBytes/m, () => `const documentProjectionOverrides: Record<string, unknown> = ${serialized};\nconst base64ToBytes`);
writeFileSync(reactPath, react);

const standalonePath = join(process.cwd(), "outputs/Knowledge-Object-Workbench.html");
let standalone = readFileSync(standalonePath, "utf8");
const compact = JSON.stringify(packaged.standaloneRecords).replaceAll("</script", "<\\/script");
if (/^const documentProjectionOverrides=/m.test(standalone)) standalone = standalone.replace(/^const documentProjectionOverrides=\{.*$/m, () => `const documentProjectionOverrides=${compact};`);
else standalone = standalone.replace(/^const base64ToBytes=/m, () => `const documentProjectionOverrides=${compact};\nconst base64ToBytes=`);
writeFileSync(standalonePath, standalone);

console.log(JSON.stringify({
  documents: Object.keys(records).length,
  derivedImages: packaged.assets.length,
  statuses: Object.values(records).reduce((counts, record) => ({ ...counts, [record.projectionStatus]: (counts[record.projectionStatus] ?? 0) + 1 }), {}),
}, null, 2));
