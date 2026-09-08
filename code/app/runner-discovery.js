import { runnerManifestErrors } from "./runner-contract.js";

export const RUNNER_MANIFEST_PATH = "runner/runner.manifest.json";

const unavailable = (validationError, manifest = null) => Object.freeze({
  available: false,
  manifest,
  bundleSource: null,
  validationError,
});

const text = (value) => typeof value === "string" ? value : null;

function metadataIdentity(metadata) {
  const identifiers = Array.isArray(metadata?.["dc:identifier"])
    ? metadata["dc:identifier"]
    : [metadata?.["dc:identifier"]];
  return {
    identifiers: identifiers.filter((value) => typeof value === "string" && value.trim()),
    version: typeof metadata?.["dc:version"] === "string" ? metadata["dc:version"].trim() : "",
  };
}

/**
 * Discovers a KO-supplied browser Runner using structural evidence only.
 * Bundle source is retained as inert text; this function never evaluates it.
 */
export function discoverRunnerAvailability({ files, readText }) {
  const fileSet = new Set(Array.isArray(files) ? files : []);
  if (!fileSet.has(RUNNER_MANIFEST_PATH)) {
    return unavailable("No browser Runner is supplied by this knowledge object.");
  }

  let manifest;
  try {
    manifest = JSON.parse(text(readText(RUNNER_MANIFEST_PATH)) ?? "");
  } catch {
    return unavailable("The Runner manifest is not valid JSON.");
  }

  const manifestErrors = runnerManifestErrors(manifest);
  if (manifestErrors.length) return unavailable(manifestErrors.join(" "), manifest);

  let metadata;
  try {
    metadata = JSON.parse(text(readText("metadata.json")) ?? "");
  } catch {
    return unavailable("The knowledge object identity record is not valid JSON.", manifest);
  }

  const identity = metadataIdentity(metadata);
  if (!identity.identifiers.includes(manifest.knowledgeObjectId)) {
    return unavailable("The Runner identity does not match this knowledge object.", manifest);
  }
  if (!identity.version || identity.version !== manifest.knowledgeObjectVersion) {
    return unavailable("The Runner version does not match this knowledge object.", manifest);
  }
  if (!fileSet.has(manifest.bundle)) {
    return unavailable("The Runner bundle declared by the manifest is missing.", manifest);
  }

  const bundleSource = text(readText(manifest.bundle));
  if (bundleSource === null) {
    return unavailable("The Runner bundle is not available as browser JavaScript text.", manifest);
  }

  return Object.freeze({
    available: true,
    manifest: Object.freeze({ ...manifest }),
    bundleSource,
    validationError: null,
  });
}

export function discoverKnowledgeObjectRunners(objectIds, filesForObject, readText) {
  return Object.freeze(Object.fromEntries(objectIds.map((id) => [
    id,
    discoverRunnerAvailability({
      files: filesForObject(id),
      readText: (file) => readText(id, file),
    }),
  ])));
}
