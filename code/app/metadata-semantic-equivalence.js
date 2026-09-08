import { Parser } from "n3";

const SCHEMA = "https://schema.org/";

function parse(source, label) {
  try { return new Parser({ format: "text/turtle" }).parse(source); }
  catch (error) { throw new TypeError(`${label} is not valid Turtle: ${error instanceof Error ? error.message : String(error)}`); }
}

function primaryResource(quads, label) {
  const primary = quads.find((quad) => quad.subject.termType === "NamedNode")?.subject;
  if (!primary) throw new TypeError(`${label} has no primary named resource.`);
  return primary;
}

function reachableSubjects(quads, roots) {
  const ids = new Set(roots.map((term) => term.id));
  const queue = [...roots];
  while (queue.length) {
    const subject = queue.shift();
    for (const quad of quads.filter((candidate) => candidate.subject.equals(subject))) {
      if ((quad.object.termType === "BlankNode" || quad.object.termType === "NamedNode") && !ids.has(quad.object.id)) {
        ids.add(quad.object.id);
        queue.push(quad.object);
      }
    }
  }
  return ids;
}

function controlledQuadIds(profile, quads, primary) {
  const controlled = new Set();
  const add = (quad) => controlled.add(quad);
  if (profile === "findability") {
    const direct = new Set([SCHEMA + "name", SCHEMA + "abstract", SCHEMA + "about", SCHEMA + "keywords"]);
    quads.filter((quad) => quad.subject.equals(primary) && direct.has(quad.predicate.value)).forEach(add);
    const outputLinks = quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "additionalProperty" && quads.some((candidate) => candidate.subject.equals(quad.object) && candidate.predicate.value === SCHEMA + "name" && candidate.object.value === "Output classification"));
    outputLinks.forEach(add);
    const outputSubjects = reachableSubjects(quads, outputLinks.map((quad) => quad.object));
    quads.filter((quad) => outputSubjects.has(quad.subject.id)).forEach(add);
  } else if (profile === "reusability") {
    const direct = new Set([SCHEMA + "usageInfo", SCHEMA + "license", SCHEMA + "citation"]);
    const scopeLinks = quads.filter((quad) => quad.subject.equals(primary) && quad.predicate.value === SCHEMA + "usageInfo");
    quads.filter((quad) => quad.subject.equals(primary) && direct.has(quad.predicate.value)).forEach(add);
    const scopeSubjects = reachableSubjects(quads, scopeLinks.map((quad) => quad.object));
    quads.filter((quad) => scopeSubjects.has(quad.subject.id)).forEach(add);
  } else throw new TypeError(`Unsupported semantic-equivalence profile: ${profile}`);
  return controlled;
}

function protectedSignatures(profile, quads, primary) {
  const controlled = controlledQuadIds(profile, quads, primary);
  const outgoing = new Map();
  for (const quad of quads) {
    const list = outgoing.get(quad.subject.id) || [];
    list.push(quad);
    outgoing.set(quad.subject.id, list);
  }
  const termSignature = (term, trail = new Set()) => {
    if (term.termType === "NamedNode") return `<${term.value}>`;
    if (term.termType === "Literal") return JSON.stringify(["Literal", term.value, term.language || "", term.datatype?.value || ""]);
    if (term.termType !== "BlankNode") return `${term.termType}:${term.value}`;
    if (trail.has(term.id)) return "_:cycle";
    const nextTrail = new Set(trail).add(term.id);
    const statements = (outgoing.get(term.id) || []).filter((quad) => !controlled.has(quad)).map((quad) => `${termSignature(quad.predicate, nextTrail)}=${termSignature(quad.object, nextTrail)}`).sort();
    return `_[${statements.join("|")}]`;
  };
  return new Set(quads.filter((quad) => !controlled.has(quad)).map((quad) => `${termSignature(quad.subject)} ${termSignature(quad.predicate)} ${termSignature(quad.object)}`));
}

export function validateControlledMetadataEquivalence(profile, canonicalSource, workingSource) {
  const canonical = parse(canonicalSource, "Canonical metadata");
  const working = parse(workingSource, "Working metadata");
  const canonicalPrimary = primaryResource(canonical, "Canonical metadata");
  const workingPrimary = primaryResource(working, "Working metadata");
  const canonicalProtected = protectedSignatures(profile, canonical, canonicalPrimary);
  const workingProtected = protectedSignatures(profile, working, workingPrimary);
  const missing = [...canonicalProtected].filter((signature) => !workingProtected.has(signature));
  const added = [...workingProtected].filter((signature) => !canonicalProtected.has(signature));
  return Object.freeze({
    valid: true,
    equivalent: canonicalPrimary.value === workingPrimary.value && !missing.length && !added.length,
    primaryMatches: canonicalPrimary.value === workingPrimary.value,
    missing: Object.freeze(missing),
    added: Object.freeze(added),
  });
}

export function assertControlledMetadataEquivalence(profile, canonicalSource, workingSource) {
  const result = validateControlledMetadataEquivalence(profile, canonicalSource, workingSource);
  if (!result.equivalent) throw new Error(`Generated ${profile} metadata changed protected RDF semantics.`);
  return workingSource;
}
