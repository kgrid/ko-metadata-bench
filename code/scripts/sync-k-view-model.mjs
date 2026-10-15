import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "app/k-view-model.js"), "utf8")
  .replace(/^import .*\n/gm, "")
  .replace(/^export /gm, "")
  .trim();
const start = "/* K_VIEW_MODEL_START */";
const end = "/* K_VIEW_MODEL_END */";
const block = `${start}\nconst { buildKnowledgeViewModel, projectKnowledgeViewModel } = (() => {\n${source}\nreturn { buildKnowledgeViewModel, projectKnowledgeViewModel };\n})();\n${end}`;
const path = join(root, "outputs/Knowledge-Object-Workbench.html");
let html = readFileSync(path, "utf8");
const from = html.indexOf(start);
const through = html.indexOf(end, from);
if (from >= 0 || through >= 0) {
  if (from < 0 || through < 0) throw new Error("Incomplete standalone Knowledge-view model block");
  html = html.slice(0, from) + block + html.slice(through + end.length);
} else {
  const oldStart = html.indexOf("function buildKnowledgeViewModel(metadata){");
  const oldEnd = html.indexOf("const annotationDestinationOverrides=", oldStart);
  if (oldStart < 0 || oldEnd < 0) throw new Error("Standalone Knowledge-view model insertion point not found");
  html = html.slice(0, oldStart) + block + "\n" + html.slice(oldEnd);
}
writeFileSync(path, html);
