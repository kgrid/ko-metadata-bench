import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

// Source-level parity tests inspect the server's generated literals and UI
// together, though production keeps the KO payload outside page.tsx.
const dataUrl = new URL("../app/generated-ko-data.ts", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);

export const readServerSourceSync = () => `${readFileSync(dataUrl, "utf8")}\n${readFileSync(pageUrl, "utf8")}`;
export const readServerSource = async () => `${await readFile(dataUrl, "utf8")}\n${await readFile(pageUrl, "utf8")}`;
