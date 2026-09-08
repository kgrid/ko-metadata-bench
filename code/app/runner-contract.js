export const RUNNER_CONTRACT_VERSION = "1.0";
export const RUNNER_GLOBAL = "FAIR_KO_RUNNER";

export const RUNNER_MESSAGE = Object.freeze({
  INIT: "runner:init",
  READY: "runner:ready",
  RUN: "runner:run",
  RESULT: "runner:result",
  RESET: "runner:reset",
});

const MANIFEST_KEYS = new Set([
  "runnerVersion",
  "knowledgeObjectId",
  "knowledgeObjectVersion",
  "bundle",
]);

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isText = (value) => typeof value === "string" && value.trim().length > 0;

function isSafeBundlePath(value) {
  if (!isText(value) || !value.endsWith(".js") || value.includes("\\")) return false;
  if (value.startsWith("/") || /^[a-z][a-z\d+.-]*:/i.test(value)) return false;
  return !value.split("/").some((segment) => !segment || segment === "." || segment === "..");
}

export function runnerManifestErrors(manifest) {
  if (!isRecord(manifest)) return ["Manifest must be an object."];
  const errors = [];
  for (const key of Object.keys(manifest)) {
    if (!MANIFEST_KEYS.has(key)) errors.push(`Unexpected manifest field: ${key}.`);
  }
  if (manifest.runnerVersion !== RUNNER_CONTRACT_VERSION) errors.push(`runnerVersion must be ${RUNNER_CONTRACT_VERSION}.`);
  if (!isText(manifest.knowledgeObjectId)) errors.push("knowledgeObjectId must be a non-empty string.");
  if (!isText(manifest.knowledgeObjectVersion)) errors.push("knowledgeObjectVersion must be a non-empty string.");
  if (!isSafeBundlePath(manifest.bundle)) errors.push("bundle must be a safe relative .js path.");
  return errors;
}

export function validateRunnerManifest(manifest) {
  return runnerManifestErrors(manifest).length === 0;
}

export function assertRunnerManifest(manifest) {
  const errors = runnerManifestErrors(manifest);
  if (errors.length) throw new TypeError(errors.join(" "));
  return manifest;
}

export function validateRunnerExport(value) {
  return isRecord(value) && typeof value.run === "function";
}

export function runnerMessage(type, sessionId, detail = {}) {
  if (!Object.values(RUNNER_MESSAGE).includes(type)) throw new TypeError(`Unknown Runner message type: ${type}.`);
  if (!isText(sessionId)) throw new TypeError("Runner messages require a sessionId.");
  if (!isRecord(detail)) throw new TypeError("Runner message detail must be an object.");
  return { runnerVersion: RUNNER_CONTRACT_VERSION, type, sessionId, ...detail };
}

export function validateRunnerMessage(message) {
  if (!isRecord(message)) return false;
  if (message.runnerVersion !== RUNNER_CONTRACT_VERSION || !isText(message.sessionId)) return false;
  if (!Object.values(RUNNER_MESSAGE).includes(message.type)) return false;
  if ([RUNNER_MESSAGE.RUN, RUNNER_MESSAGE.RESULT].includes(message.type) && !isText(message.requestId)) return false;
  if (message.type === RUNNER_MESSAGE.RESULT && typeof message.ok !== "boolean") return false;
  return true;
}
