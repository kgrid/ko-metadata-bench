import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

// Keep the original teaching collection available to tests without shipping it in
// either CMS108 edition. Only package data and its generated assets come from Git.
const workshopRevision = "e1a88935275ddf1c93c3a259c7301d1b5ba5bb5a";
const source = process.cwd();
const fixture = mkdtempSync(join(tmpdir(), "bench-workshop-fixture-"));
const mode = process.argv[2];
if (!["regression", "fast", "visual"].includes(mode)) throw new Error("Expected regression, fast, or visual");
const readOriginal = (path) => execFileSync("git", ["show", `${workshopRevision}:code/${path}`], {
  cwd: source, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
});
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: fixture, stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  return result.status ?? 1;
};
const replaceBlock = (current, original, pattern) => {
  const oldBlock = original.match(pattern)?.[0];
  if (!oldBlock || !pattern.test(current)) throw new Error(`Missing fixture data block: ${pattern}`);
  return current.replace(pattern, () => oldBlock);
};

try {
  cpSync(source, fixture, {
    recursive: true,
    filter: (path) => !["node_modules", "dist", ".playwright-browsers", "test-results", ".wrangler"].includes(basename(path)),
  });
  for (const path of ["node_modules", ".playwright-browsers"]) {
    symlinkSync(join(source, path), join(fixture, path), "dir");
  }
  const originalData = readOriginal("app/generated-ko-data.ts")
    .replace("const objectFileOverrides:", "const compressedTextOverrides = {};\nconst objectFileOverrides:")
    .replace("export { OBJECT_FOLDER_NAMES,", "export { compressedTextOverrides, OBJECT_FOLDER_NAMES,");
  writeFileSync(join(fixture, "app/generated-ko-data.ts"), originalData);
  const standalonePath = "outputs/Knowledge-Object-Workbench.html";
  const original = readOriginal(standalonePath);
  let html = readFileSync(join(fixture, standalonePath), "utf8");
  for (const pattern of [
    /^const minObjectCount=.*$/m,
    /^const objectFolderNames=.*$/m,
    /^const objectDisplayNames=.*$/m,
    /^const annotationDestinationOverrides=.*$/m,
    /^const embeddedAssembly=.*$/m,
    /^const overrides=\{[\s\S]*?(?=^const base64ToBytes=)/m,
  ]) html = replaceBlock(html, original, pattern);
  html = html.replace(/\/\* EMBEDDED_TEXT_START \*\/[\s\S]*?\/\* EMBEDDED_TEXT_END \*\//, () => {
    const helper = readFileSync(join(source, "app/embedded-text.js"), "utf8").replace(/^export /gm, "");
    return `/* EMBEDDED_TEXT_START */\n${helper}\nconst compressedTextOverrides = {};\n/* EMBEDDED_TEXT_END */`;
  });
  writeFileSync(join(fixture, standalonePath), html);

  const assets = execFileSync("git", ["archive", workshopRevision, "public"], {
    cwd: source, maxBuffer: 32 * 1024 * 1024,
  });
  execFileSync("tar", ["-xf", "-", "-C", fixture], { input: assets });
  const build = run("npm", ["run", "build"]);
  process.exitCode = build || run("npm", ["run", `test:workshop:${mode}`]);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
