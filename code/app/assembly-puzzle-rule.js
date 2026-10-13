// Puzzle roles follow the four constituent KO contributions, not their display names.
export const ASSEMBLY_PUZZLE_PIECES = Object.freeze(["wagner", "decision", "margolis", "burden"]);
export const ASSEMBLY_PUZZLE_SLOTS = Object.freeze(["slot-1", "slot-2", "slot-3", "slot-4"]);

// The fixed arrow in the orchestration layout points from slot 1 to slot 2.
export const ASSEMBLY_PUZZLE_DEPENDENCY = Object.freeze({ from: "slot-1", to: "slot-2", source: "wagner", target: "decision" });

// Shuffle once when the puzzle opens; later moves and an invalid reset retain
// that order so pieces do not jump around while someone is working.
export function shuffleAssemblyPuzzlePieces(random = Math.random) {
  const pieces = [...ASSEMBLY_PUZZLE_PIECES];
  for (let index = pieces.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [pieces[index], pieces[other]] = [pieces[other], pieces[index]];
  }
  return pieces;
}

// A move into an occupied slot swaps two placed pieces. A piece brought from
// the starting area sends the displaced piece back there instead.
/** @param {Record<string, string>} placement
 * @param {string} piece
 * @param {string | null} [targetSlot]
 */
export function moveAssemblyPuzzlePiece(placement, piece, targetSlot = null) {
  if (!ASSEMBLY_PUZZLE_PIECES.includes(piece) || (targetSlot !== null && !ASSEMBLY_PUZZLE_SLOTS.includes(targetSlot))) return placement;
  const sourceSlot = ASSEMBLY_PUZZLE_SLOTS.find((slot) => placement[slot] === piece);
  if (sourceSlot === targetSlot) return placement;
  const next = { ...placement };
  if (sourceSlot) delete next[sourceSlot];
  if (targetSlot) {
    const displaced = next[targetSlot];
    next[targetSlot] = piece;
    if (displaced && sourceSlot) next[sourceSlot] = displaced;
  }
  return next;
}

// A partial arrangement is never judged: the UI will check only after all
// four slots have pieces. Independent slots 3 and 4 have no order constraint.
export function evaluateAssemblyPuzzle(placement) {
  if (!placement || typeof placement !== "object" || Array.isArray(placement)) {
    return { status: "incomplete", reason: null };
  }
  const pieces = ASSEMBLY_PUZZLE_SLOTS.map((slot) => placement[slot]);
  if (pieces.some((piece) => piece == null)) return { status: "incomplete", reason: null };
  if (Object.keys(placement).length !== ASSEMBLY_PUZZLE_SLOTS.length
    || new Set(pieces).size !== ASSEMBLY_PUZZLE_PIECES.length
    || pieces.some((piece) => !ASSEMBLY_PUZZLE_PIECES.includes(piece))) {
    return { status: "unworkable", reason: "four-distinct-kos-required" };
  }
  if (placement[ASSEMBLY_PUZZLE_DEPENDENCY.from] !== ASSEMBLY_PUZZLE_DEPENDENCY.source
    || placement[ASSEMBLY_PUZZLE_DEPENDENCY.to] !== ASSEMBLY_PUZZLE_DEPENDENCY.target) {
    return { status: "unworkable", reason: "severity-must-feed-treatment-decision" };
  }
  return { status: "workable", reason: null };
}

export function assemblyPuzzleFailureMessage(reason) {
  return reason === "four-distinct-kos-required"
    ? "This arrangement needs four distinct Knowledge Objects."
    : "This arrangement cannot work: DFU Severity Score must feed HBOT Treatment Decision.";
}
