import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "app/assembly-puzzle-rule.js"), "utf8").replace(/^export /gm, "").trimEnd();
const path = join(root, "outputs/Knowledge-Object-Workbench.html");
const start = "/* ASSEMBLY_PUZZLE_RULE_START */";
const end = "/* ASSEMBLY_PUZZLE_RULE_END */";
const block = `${start}\n${source}\n${end}`;
let html = readFileSync(path, "utf8");
if (html.includes(start) || html.includes(end)) {
  const from = html.indexOf(start);
  const through = html.indexOf(end, from);
  if (from < 0 || through < 0) throw new Error("Incomplete standalone assembly puzzle rule block");
  html = html.slice(0, from) + html.slice(through + end.length).replace(/^\n/, "");
}
const anchor = "function loadAssemblyTeachingCases(assembly){";
if (!html.includes(anchor)) throw new Error("Standalone assembly puzzle rule insertion point not found");
html = html.replace(anchor, `${block}\n${anchor}`);
writeFileSync(path, html);
