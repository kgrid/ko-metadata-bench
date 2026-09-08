import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const testsDirectory = join(process.cwd(), "tests");
const testFiles = readdirSync(testsDirectory)
  .filter((name) => name.endsWith(".test.mjs") && !name.endsWith("-skill.test.mjs"))
  .sort()
  .map((name) => join(testsDirectory, name));

if (!testFiles.length) {
  throw new Error("No SWA regression tests were found.");
}

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
