import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "app/acronym-bubble-view.js"), "utf8").replace(/^export /gm, "").trimEnd();
const path = join(root, "outputs/Knowledge-Object-Workbench.html");
const start = "/* ACRONYM_BUBBLE_VIEW_START */";
const end = "/* ACRONYM_BUBBLE_VIEW_END */";
const block = `${start}\n${source}\n${end}`;
let html = readFileSync(path, "utf8");
if (html.includes(start) || html.includes(end)) {
  const from = html.indexOf(start);
  const through = html.indexOf(end, from);
  if (from < 0 || through < 0) throw new Error("Incomplete standalone acronym-bubble view block");
  html = html.slice(0, from) + html.slice(through + end.length).replace(/^\n/, "");
}
const anchor = "/* ACRONYM_BUBBLE_BEHAVIOR_START */";
if (!html.includes(anchor)) throw new Error("Standalone acronym-bubble view insertion point not found");
html = html.replace(anchor, `${block}\n${anchor}`);
writeFileSync(path, html);
