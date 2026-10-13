import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";

/** Publish prepared KO files, restoring all old targets if any rename fails. */
export function publishStagedKos({ stagingRoot, replacements, rename = renameSync }) {
  const completed = [];
  try {
    for (const [index, { staged, target }] of replacements.entries()) {
      if (!existsSync(staged)) throw new Error(`Missing staged replacement: ${staged}`);
      const backup = join(stagingRoot, `backup-${index}`);
      const hadOriginal = existsSync(target);
      if (hadOriginal) rename(target, backup);
      const entry = { staged, target, backup, hadOriginal, installed: false };
      completed.push(entry);
      rename(staged, target);
      entry.installed = true;
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of completed.reverse()) {
      try {
        if (entry.installed) rename(entry.target, entry.staged);
        if (entry.hadOriginal) rename(entry.backup, entry.target);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors],
        `KO publication failed and rollback was incomplete; preserve ${stagingRoot} for recovery`);
    }
    throw error;
  }
}
