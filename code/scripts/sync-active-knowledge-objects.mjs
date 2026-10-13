import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "app/active-knowledge-objects.js"), "utf8")
  .replace(/^export /gm, "")
  .trim();
const start = "/* ACTIVE_OBJECT_RULE_START */";
const end = "/* ACTIVE_OBJECT_RULE_END */";
const block = `${start}\nconst { createInitialActiveObjects, isAssemblyActive, addAssemblyToActiveObjects } = (() => {\n${source}\nreturn { createInitialActiveObjects, isAssemblyActive, addAssemblyToActiveObjects };\n})();\n${end}`;
const path = join(root, "outputs/Knowledge-Object-Workbench.html");
let html = readFileSync(path, "utf8");
const from = html.indexOf(start);
const through = html.indexOf(end, from);
if (from >= 0 || through >= 0) {
  if (from < 0 || through < 0) throw new Error("Incomplete standalone active-object rule block");
  html = html.slice(0, from) + block + html.slice(through + end.length);
} else {
  const oldStart = html.indexOf("const createInitialActiveObjects=ids=>");
  const oldEnd = html.indexOf("let activeObjects=createInitialActiveObjects(objectIds);", oldStart);
  if (oldStart < 0 || oldEnd < 0) throw new Error("Standalone active-object rule insertion point not found");
  html = html.slice(0, oldStart) + block + "\n" + html.slice(oldEnd);
}
writeFileSync(path, html);
