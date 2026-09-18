import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { orderWorkshopObjects } from "../app/workshop-ordering.js";
import { convertDocxToProjection, documentProjectionToPlainText } from "../app/document-projection-converter.js";
import { packageDocumentProjectionMedia } from "../app/document-projection-packager.js";

const [zipPath, version] = process.argv.slice(2);
if (!zipPath || !version) throw new Error("Usage: node scripts/update-embedded-kos.mjs <archive.zip> <version>");

const workspace = process.cwd();
const temp = mkdtempSync(join(tmpdir(), "fdo-bench-kos-"));
const ignored = (name) => name === "__MACOSX" || name === ".DS_Store" || name.startsWith("._");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (ignored(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function looksText(buffer) {
  if (buffer.includes(0)) return false;
  const decoded = buffer.toString("utf8");
  return !decoded.includes("\uFFFD");
}

function replaceExactly(source, pattern, replacement, label) {
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) throw new Error(`Could not uniquely replace ${label}`);
  // Use a replacer function so `$&`, `$'`, `$`` and `$n` inside embedded KO
  // source remain literal content rather than String.replace directives.
  return source.replace(pattern, () => replacement);
}

function serializeForScript(value, indent) {
  return JSON.stringify(value, null, indent)
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

try {
  execFileSync("unzip", ["-q", zipPath, "-d", temp]);
  let root = temp;
  const rootEntries = readdirSync(root, { withFileTypes: true }).filter((entry) => !ignored(entry.name));
  if (rootEntries.length === 1 && rootEntries[0].isDirectory()) root = join(root, rootEntries[0].name);

  const candidates = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !ignored(entry.name));
  const folders = orderWorkshopObjects(candidates.map((entry) => {
    const folderPath = join(root, entry.name);
    const paths = walk(folderPath);
    const files = paths.map((path) => relative(folderPath, path).split("\\").join("/"));
    return { entry, folderName: entry.name, files, readText: (file) => readFileSync(join(folderPath, file), "utf8") };
  })).map((object) => object.entry);
  if (folders.length < 1 || folders.length > 10) throw new Error(`Expected 1–10 KO folders; found ${folders.length}`);
  const folderNames = folders.map((folder) => folder.name);

  const textFiles = {};
  const binaryFiles = {};
  const serverBinaryFiles = {};
  const serverStaticFiles = {};
  const documentProjections = {};
  const serverKoAssetRoot = join(workspace, "public", "ko-assets");
  rmSync(serverKoAssetRoot, { recursive: true, force: true });
  folders.forEach((folder, index) => {
    const folderPath = join(root, folder.name);
    for (const path of walk(folderPath).sort()) {
      if (!statSync(path).isFile()) continue;
      const key = `${index + 1}/${relative(folderPath, path).split("\\").join("/")}`;
      const buffer = readFileSync(path);
      if (looksText(buffer)) textFiles[key] = buffer.toString("utf8");
      else {
        binaryFiles[key] = buffer.toString("base64");
        if (/\.pdf$/i.test(path)) {
          const relativePath = relative(folderPath, path).split("\\").join("/");
          const destination = join(serverKoAssetRoot, String(index + 1), relativePath);
          mkdirSync(dirname(destination), { recursive: true });
          copyFileSync(path, destination);
          serverStaticFiles[key] = {
            url: `/ko-assets/${[String(index + 1), ...relativePath.split("/")].map(encodeURIComponent).join("/")}`,
            byteLength: buffer.byteLength,
          };
        } else {
          serverBinaryFiles[key] = binaryFiles[key];
        }
        if (/\.docx$/i.test(path)) {
          const projection = convertDocxToProjection({
            docxPath: path,
            knowledgeObjectId: `workshop-ko-${index + 1}`,
            originalPath: relative(folderPath, path).split("\\").join("/"),
          });
          documentProjections[key] = projection;
          textFiles[key] = documentProjectionToPlainText(projection);
        }
      }
    }
  });
  const packagedDocumentProjections = packageDocumentProjectionMedia({
    records: documentProjections,
    publicRoot: join(workspace, "public", "docx-assets"),
  });

  const reactPath = join(workspace, "app/page.tsx");
  let react = readFileSync(reactPath, "utf8");
  react = react.replace(/Math\.max\(MIN_OBJECT_COUNT, \d+\)/, `Math.max(MIN_OBJECT_COUNT, ${folders.length})`);
  react = react.replace(/const OBJECT_FOLDER_NAMES = \[[^\n]+\] as const;/, `const OBJECT_FOLDER_NAMES = ${JSON.stringify(folderNames)} as const;`);
  react = react.replace(/const DATA_VERSION = "[^"]+";/, `const DATA_VERSION = "${version}";`);
  react = replaceExactly(react, /^const objectFileOverrides: Record<string, string> = \{[\s\S]*?^\};\n^const objectBinaryOverrides:/m, `const objectFileOverrides: Record<string, string> = ${serializeForScript(textFiles, 2)};\nconst objectBinaryOverrides:`, "React text payload");
  react = replaceExactly(react, /^const objectBinaryOverrides: Record<string, string> = \{[\s\S]*?^const base64ToBytes/m, `const objectBinaryOverrides: Record<string, string> = ${serializeForScript(serverBinaryFiles, 2)};\nconst objectStaticAssetOverrides: Record<string, { url: string; byteLength: number }> = ${serializeForScript(serverStaticFiles, 2)};\nconst documentProjectionOverrides: Record<string, unknown> = ${serializeForScript(packagedDocumentProjections.serverRecords, 2)};\nconst base64ToBytes`, "React binary, static-asset, and document-projection payloads");
  writeFileSync(reactPath, react);

  const standalonePath = join(workspace, "outputs/Knowledge-Object-Workbench.html");
  let standalone = readFileSync(standalonePath, "utf8");
  standalone = standalone.replace(/Math\.max\(minObjectCount,\d+\)/, `Math.max(minObjectCount,${folders.length})`);
  standalone = standalone.replace(/const objectFolderNames=\[[^\n]+\];/, `const objectFolderNames=${JSON.stringify(folderNames)};`);
  standalone = standalone.replace(/const dataVersion="[^"]+"/, `const dataVersion="${version}"`);
  const safeText = serializeForScript(textFiles).replaceAll("</script", "<\\/script");
  const safeBinary = serializeForScript(binaryFiles);
  standalone = replaceExactly(
    standalone,
    /^const overrides=\{[\s\S]*?^const base64ToBytes=/m,
    `const overrides=${safeText};\nconst objectBinaryOverrides=${safeBinary};\nconst documentProjectionOverrides=${serializeForScript(packagedDocumentProjections.standaloneRecords).replaceAll("</script", "<\\/script")};\nconst base64ToBytes=`,
    "standalone embedded payloads"
  );
  writeFileSync(standalonePath, standalone);

  console.log(JSON.stringify({ version, objects: folders.map((folder) => folder.name), textFiles: Object.keys(textFiles).length, standaloneBinaryFiles: Object.keys(binaryFiles).length, serverBinaryFiles: Object.keys(serverBinaryFiles).length, serverStaticPdfFiles: Object.keys(serverStaticFiles).length, derivedDocumentImages: packagedDocumentProjections.assets.length }, null, 2));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
