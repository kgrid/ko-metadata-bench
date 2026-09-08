import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

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

function extractedDocxText(path) {
  try {
    const xml = execFileSync("unzip", ["-p", path, "word/document.xml"], { encoding: "utf8" });
    const text = xml
      .replace(/<w:tab\/?\s*>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, "\n\n").trim();
    return `[Extracted DOCX text]\n\n${text}`;
  } catch {
    return "[Extracted DOCX text unavailable]";
  }
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

function workshopNumber(root, folderName) {
  try {
    const source = readFileSync(join(root, folderName, "findability.metadata.txt"), "utf8");
    const match = source.match(/schema:identifier\s+"workshop-ko-(\d+)"/i);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

try {
  execFileSync("unzip", ["-q", zipPath, "-d", temp]);
  let root = temp;
  const rootEntries = readdirSync(root, { withFileTypes: true }).filter((entry) => !ignored(entry.name));
  if (rootEntries.length === 1 && rootEntries[0].isDirectory()) root = join(root, rootEntries[0].name);

  const folders = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !ignored(entry.name))
    .sort((a, b) => {
      const an = workshopNumber(root, a.name);
      const bn = workshopNumber(root, b.name);
      return an - bn || a.name.localeCompare(b.name);
    });
  if (folders.length < 1 || folders.length > 10) throw new Error(`Expected 1–10 KO folders; found ${folders.length}`);
  const folderNames = folders.map((folder) => folder.name);

  const textFiles = {};
  const binaryFiles = {};
  folders.forEach((folder, index) => {
    const folderPath = join(root, folder.name);
    for (const path of walk(folderPath).sort()) {
      if (!statSync(path).isFile()) continue;
      const key = `${index + 1}/${relative(folderPath, path).split("\\").join("/")}`;
      const buffer = readFileSync(path);
      if (looksText(buffer)) textFiles[key] = buffer.toString("utf8");
      else {
        binaryFiles[key] = buffer.toString("base64");
        if (/\.docx$/i.test(path)) textFiles[key] = extractedDocxText(path);
      }
    }
  });

  const reactPath = join(workspace, "app/page.tsx");
  let react = readFileSync(reactPath, "utf8");
  react = react.replace(/Math\.max\(MIN_OBJECT_COUNT, \d+\)/, `Math.max(MIN_OBJECT_COUNT, ${folders.length})`);
  react = react.replace(/const OBJECT_FOLDER_NAMES = \[[^\n]+\] as const;/, `const OBJECT_FOLDER_NAMES = ${JSON.stringify(folderNames)} as const;`);
  react = react.replace(/const DATA_VERSION = "[^"]+";/, `const DATA_VERSION = "${version}";`);
  react = replaceExactly(react, /^const objectFileOverrides: Record<string, string> = \{[\s\S]*?^\};\n^const objectBinaryOverrides:/m, `const objectFileOverrides: Record<string, string> = ${serializeForScript(textFiles, 2)};\nconst objectBinaryOverrides:`, "React text payload");
  react = replaceExactly(react, /^const objectBinaryOverrides: Record<string, string> = \{[\s\S]*?^\};\n^const base64ToBytes/m, `const objectBinaryOverrides: Record<string, string> = ${serializeForScript(binaryFiles, 2)};\nconst base64ToBytes`, "React binary payload");
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
    `const overrides=${safeText};\nconst objectBinaryOverrides=${safeBinary};\nconst base64ToBytes=`,
    "standalone embedded payloads"
  );
  writeFileSync(standalonePath, standalone);

  console.log(JSON.stringify({ version, objects: folders.map((folder) => folder.name), textFiles: Object.keys(textFiles).length, binaryFiles: Object.keys(binaryFiles).length }, null, 2));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
