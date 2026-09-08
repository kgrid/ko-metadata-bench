import { formatTurtleIri, formatTurtleLiteral } from "./turtle-value-formatters.js";

function replaceSection(source, heading, nextHeading, content) {
  const start = source.indexOf(heading);
  const end = start < 0 ? -1 : source.indexOf(nextHeading, start + heading.length);
  if (start < 0 || end < 0) throw new Error(`Canonical Turtle section not found: ${heading.trim()}`);
  return source.slice(0, start) + heading + content + source.slice(end);
}

function removeNamedResource(source, iri) {
  const marker = `\n${formatTurtleIri(iri)}\n`;
  const start = source.indexOf(marker);
  if (start < 0) return source;
  const next = source.indexOf("\n<", start + marker.length);
  const comment = source.indexOf("\n#", start + marker.length);
  const candidates = [next, comment].filter((value) => value >= 0);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(0, start) + source.slice(end);
}

function restoreFinalPrimaryTerminator(source, before) {
  const head = source.slice(0, before);
  const tail = source.slice(before);
  return head.replace(/\]\s*;\s*$/u, "] .\n\n") + tail.replace(/^\s*/u, "");
}

export function renderFindabilityCanonicalTemplate(canonicalSource, input = {}, options = {}) {
  const canonicalSubjectIris = new Set(options.subjectIris || []);
  const canonicalOutputTermIris = new Set(options.outputTermIris || []);
  const selectedSubjects = new Set((input.controlledSubjectIris || []).filter((iri) => canonicalSubjectIris.has(iri)));
  const requestedOutputs = new Set((input.outputTermIris || []).filter((iri) => canonicalOutputTermIris.has(iri)));
  const selectedOutputs = [...canonicalOutputTermIris].filter((iri) => requestedOutputs.has(iri));
  let source = canonicalSource;

  if (!input.fullNameConfirmed) source = source.replace(/^\s{4}schema:name[^\n]*\n\n/mu, "");
  const description = String(input.description || "").trim();
  source = description
    ? source.replace(/^\s{4}schema:abstract[^\n]*$/mu, `    schema:abstract ${formatTurtleLiteral(description)} ;`)
    : source.replace(/^\s{4}schema:abstract[^\n]*\n\n/mu, "");

  source = source.replace(/^\s{4}schema:about\s+<([^>]+)>\s*;\n\n/gmu, (statement, iri) => selectedSubjects.has(iri) ? statement : "");
  source = source.replace(/^\s{4}schema:keywords[^\n]*\n\n/gmu, "");
  const searchTerms = [...new Map((input.searchTerms || []).map((term) => String(term).trim()).filter(Boolean).map((term) => [term.toLocaleLowerCase(), term])).values()];
  if (searchTerms.length) {
    const anchor = "    schema:additionalProperty [";
    const index = source.indexOf(anchor);
    const statements = searchTerms.map((term) => `    schema:keywords ${formatTurtleLiteral(term)} ;\n`).join("\n") + "\n";
    source = source.slice(0, index) + statements + source.slice(index);
  }

  const outputStart = source.lastIndexOf("    schema:additionalProperty [");
  const outputEnd = source.indexOf("\n\n<", outputStart);
  const termSetIri = options.outputTermSetIri || "";
  if (!selectedOutputs.length && outputStart >= 0 && outputEnd >= 0 && termSetIri) {
    source = source.slice(0, outputStart) + source.slice(outputEnd);
    source = restoreFinalPrimaryTerminator(source, source.indexOf(formatTurtleIri(termSetIri)));
    source = removeNamedResource(source, termSetIri);
    for (const iri of canonicalOutputTermIris) source = removeNamedResource(source, iri);
  } else if (selectedOutputs.length < canonicalOutputTermIris.size && termSetIri) {
    const termSetStart = source.indexOf(`\n${formatTurtleIri(termSetIri)}\n`);
    const termSetEnd = source.indexOf("\n<", termSetStart + 2);
    if (termSetStart < 0 || termSetEnd < 0) throw new Error("Canonical output term-set block was not found.");
    const termSetBlock = source.slice(termSetStart, termSetEnd);
    const selectedClause = `    schema:hasDefinedTerm\n${selectedOutputs.map((iri) => `        ${formatTurtleIri(iri)}`).join(",\n")} .`;
    const updatedTermSet = termSetBlock.replace(/    schema:hasDefinedTerm\n[\s\S]*?\s\./u, selectedClause);
    source = source.slice(0, termSetStart) + updatedTermSet + source.slice(termSetEnd);
    for (const iri of canonicalOutputTermIris) if (!requestedOutputs.has(iri)) source = removeNamedResource(source, iri);
  }
  return source;
}

export function renderReusabilityCanonicalTemplate(canonicalSource, input = {}, options = {}) {
  let source = canonicalSource;
  const scopeIri = options.scopeIri || "";
  const scope = String(input.scope || "").trim();
  source = replaceSection(source, "    # 2. Scope\n", "    # 3. License\n", scope && scopeIri ? `    schema:usageInfo\n        ${formatTurtleIri(scopeIri)} ;\n\n` : "\n");
  if (scopeIri) {
    if (scope) {
      const escapedIri = scopeIri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(<${escapedIri}>[\\s\\S]*?schema:description\\s*)\"(?:\\\\.|[^\"\\\\])*\"(\\s*\\.)`, "u");
      source = source.replace(pattern, `$1${formatTurtleLiteral(scope)}$2`);
    } else source = removeNamedResource(source, scopeIri);
  }

  const requestedLicenses = new Set(input.licenseIris || []);
  const licenses = (options.licenseIris || []).filter((iri) => requestedLicenses.has(iri));
  source = replaceSection(source, "    # 3. License\n", "    # 4. Provenance\n", licenses.length ? `    schema:license\n${licenses.map((iri) => `        ${formatTurtleIri(iri)}`).join(",\n")} ;\n\n` : "\n");

  const requestedEvidence = new Set(input.evidenceIris || []);
  const evidence = (options.evidenceIris || []).filter((iri) => requestedEvidence.has(iri));
  source = replaceSection(source, "    # 6. Evidence\n", "    # 7. Identity and version\n", evidence.length ? `    schema:citation\n${evidence.map((iri) => `        ${formatTurtleIri(iri)}`).join(",\n")} ;\n\n` : "\n");
  return source;
}
