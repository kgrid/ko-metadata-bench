import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ASSEMBLY_PUZZLE_PIECES, ASSEMBLY_PUZZLE_SLOTS, ASSEMBLY_PUZZLE_DEPENDENCY, assemblyPuzzleFailureMessage, evaluateAssemblyPuzzle, moveAssemblyPuzzlePiece, shuffleAssemblyPuzzlePieces } from "../app/assembly-puzzle-rule.js";

const placement = (pieces) => Object.fromEntries(ASSEMBLY_PUZZLE_SLOTS.map((slot, index) => [slot, pieces[index]]));
const permutations = (pieces) => pieces.length === 0 ? [[]] : pieces.flatMap((piece, index) =>
  permutations(pieces.filter((_, other) => other !== index)).map((rest) => [piece, ...rest]));

test("opening order is shuffled without changing the puzzle roles or rules", () => {
  const original = [...ASSEMBLY_PUZZLE_PIECES];
  const first = shuffleAssemblyPuzzlePieces(() => 0);
  const second = shuffleAssemblyPuzzlePieces(() => 0.999);
  assert.notDeepEqual(first, second);
  assert.deepEqual(new Set(first), new Set(original));
  assert.deepEqual(new Set(second), new Set(original));
  assert.deepEqual(ASSEMBLY_PUZZLE_PIECES, original);
});

test("the fixed arrow requires Severity Score upstream of Treatment Decision", () => {
  assert.deepEqual(ASSEMBLY_PUZZLE_DEPENDENCY, { from: "slot-1", to: "slot-2", source: "wagner", target: "decision" });
  const workable = permutations(ASSEMBLY_PUZZLE_PIECES).filter((pieces) =>
    evaluateAssemblyPuzzle(placement(pieces)).status === "workable");
  assert.deepEqual(workable, [
    ["wagner", "decision", "margolis", "burden"],
    ["wagner", "decision", "burden", "margolis"],
  ]);
  for (const pieces of permutations(ASSEMBLY_PUZZLE_PIECES)) {
    const result = evaluateAssemblyPuzzle(placement(pieces));
    if (pieces[0] === "wagner" && pieces[1] === "decision") continue;
    assert.deepEqual(result, { status: "unworkable", reason: "severity-must-feed-treatment-decision" });
  }
});

test("only four distinct constituent KOs complete the puzzle", () => {
  assert.deepEqual(evaluateAssemblyPuzzle({}), { status: "incomplete", reason: null });
  assert.deepEqual(evaluateAssemblyPuzzle(placement(["decision", "wagner", "margolis", null])), { status: "incomplete", reason: null });
  for (const pieces of [
    ["wagner", "decision", "margolis", "margolis"],
    ["wagner", "decision", "margolis", "other"],
  ]) assert.deepEqual(evaluateAssemblyPuzzle(placement(pieces)), { status: "unworkable", reason: "four-distinct-kos-required" });
  assert.deepEqual(evaluateAssemblyPuzzle({ ...placement(ASSEMBLY_PUZZLE_PIECES), "slot-5": "other" }), { status: "unworkable", reason: "four-distinct-kos-required" });
});

test("placement moves, swaps, and returns pieces without duplicating them", () => {
  const empty = {};
  const one = moveAssemblyPuzzlePiece(empty, "wagner", "slot-1");
  assert.deepEqual(empty, {});
  assert.deepEqual(one, { "slot-1": "wagner" });
  const two = moveAssemblyPuzzlePiece(one, "decision", "slot-2");
  assert.deepEqual(moveAssemblyPuzzlePiece(two, "wagner", "slot-2"), { "slot-1": "decision", "slot-2": "wagner" });
  assert.deepEqual(moveAssemblyPuzzlePiece(two, "wagner", "slot-3"), { "slot-2": "decision", "slot-3": "wagner" });
  assert.deepEqual(moveAssemblyPuzzlePiece(two, "burden", "slot-2"), { "slot-1": "wagner", "slot-2": "burden" });
  assert.deepEqual(moveAssemblyPuzzlePiece(two, "wagner", null), { "slot-2": "decision" });
  assert.equal(moveAssemblyPuzzlePiece(two, "other", "slot-3"), two);
  assert.equal(moveAssemblyPuzzlePiece(two, "wagner", "slot-9"), two);
});

test("failure explanations name the constraint without relying on color", () => {
  assert.match(assemblyPuzzleFailureMessage("severity-must-feed-treatment-decision"), /DFU Severity Score must feed HBOT Treatment Decision/);
  assert.match(assemblyPuzzleFailureMessage("four-distinct-kos-required"), /four distinct Knowledge Objects/);
});

test("the standalone carries the same shared puzzle rule", () => {
  const html = readFileSync(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const block = html.split("/* ASSEMBLY_PUZZLE_RULE_START */")[1]?.split("/* ASSEMBLY_PUZZLE_RULE_END */")[0];
  assert.ok(block, "standalone contains the generated rule block");
  const standalone = runInNewContext(`${block}\n({ pieces: ASSEMBLY_PUZZLE_PIECES, slots: ASSEMBLY_PUZZLE_SLOTS, dependency: ASSEMBLY_PUZZLE_DEPENDENCY, evaluate: evaluateAssemblyPuzzle, move: moveAssemblyPuzzlePiece, failure: assemblyPuzzleFailureMessage, shuffle: shuffleAssemblyPuzzlePieces })`);
  assert.deepEqual(JSON.parse(JSON.stringify([standalone.pieces, standalone.slots, standalone.dependency])),
    [ASSEMBLY_PUZZLE_PIECES, ASSEMBLY_PUZZLE_SLOTS, ASSEMBLY_PUZZLE_DEPENDENCY]);
  for (const pieces of permutations(ASSEMBLY_PUZZLE_PIECES)) {
    assert.deepEqual(JSON.parse(JSON.stringify(standalone.evaluate(placement(pieces)))), evaluateAssemblyPuzzle(placement(pieces)));
  }
  assert.deepEqual(JSON.parse(JSON.stringify(standalone.move({ "slot-1": "wagner", "slot-2": "decision" }, "wagner", "slot-2"))),
    moveAssemblyPuzzlePiece({ "slot-1": "wagner", "slot-2": "decision" }, "wagner", "slot-2"));
  assert.equal(standalone.failure("severity-must-feed-treatment-decision"), assemblyPuzzleFailureMessage("severity-must-feed-treatment-decision"));
  assert.deepEqual(JSON.parse(JSON.stringify(standalone.shuffle(() => 0))), shuffleAssemblyPuzzlePieces(() => 0));
});
