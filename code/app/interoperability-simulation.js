const clone = (value) => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));

const targetKey = (target) => [target?.identifier, target?.version ?? "", target?.specification ?? ""].join("|");

export function createInteroperabilitySimulationHost() {
  const bindings = new Map();
  const registerBinding = (target, simulate) => {
    if (!target?.identifier || typeof simulate !== "function") throw new TypeError("A target identifier and simulation function are required.");
    const key = targetKey(target);
    bindings.set(key, simulate);
    return () => bindings.delete(key);
  };
  const hasBinding = (target) => bindings.has(targetKey(target));
  const simulate = ({ target, mode, input, expectedOutput, manifest }) => {
    const binding = bindings.get(targetKey(target));
    if (!binding) return Object.freeze({ status: "binding-unavailable", mode, message: "No host-supplied simulation binding is available for this exercise target." });
    try {
      const output = binding(Object.freeze({ target: clone(target), mode, input: clone(input), expectedOutput: clone(expectedOutput), manifest: clone(manifest) }));
      if (output && typeof output.then === "function") throw new TypeError("Simulation bindings must return synchronously.");
      return Object.freeze({ status: "completed", mode, output: clone(output), binding: "host-supplied-simulation", implementationInvoked: false });
    } catch (error) {
      return Object.freeze({ status: "failed", mode, message: error instanceof Error ? error.message : "The host-supplied simulation binding failed.", implementationInvoked: false });
    }
  };
  return Object.freeze({ registerBinding, hasBinding, simulate });
}

/** Teaching-only fixture replay. It never imports or invokes a KO implementation. */
export function fixtureReplaySimulationBinding({ expectedOutput }) {
  return clone(expectedOutput);
}
