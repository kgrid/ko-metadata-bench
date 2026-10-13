import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { publishStagedKos } from "../scripts/publish-staged-kos.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ko-publish-"));
  const stage = join(root, "stage");
  const live = join(root, "live");
  mkdirSync(stage);
  mkdirSync(live);
  const names = ["ko-assets", "docx-assets", "page.tsx", "standalone.html"];
  const replacements = names.map((name, index) => {
    const directory = index < 2;
    const staged = join(stage, name);
    const target = join(live, name);
    if (directory) { mkdirSync(staged); mkdirSync(target); }
    writeFileSync(directory ? join(staged, "data") : staged, `new-${name}`);
    writeFileSync(directory ? join(target, "data") : target, `old-${name}`);
    return { staged, target, directory, name };
  });
  return { root, stage, replacements };
}

function content(item) {
  return readFileSync(item.directory ? join(item.target, "data") : item.target, "utf8");
}

test("publishes assets and both editions together after staging", () => {
  const { root, stage, replacements } = fixture();
  try {
    publishStagedKos({ stagingRoot: stage, replacements });
    for (const item of replacements) assert.equal(content(item), `new-${item.name}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a failure midway restores both editions and both asset trees", () => {
  const { root, stage, replacements } = fixture();
  let calls = 0;
  try {
    assert.throws(() => publishStagedKos({
      stagingRoot: stage,
      replacements,
      rename: (from, to) => {
        if (++calls === 8) throw new Error("injected standalone publication failure");
        renameSync(from, to);
      },
    }), /injected standalone publication failure/);
    for (const item of replacements) assert.equal(content(item), `old-${item.name}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
