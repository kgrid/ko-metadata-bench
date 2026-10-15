import { Parser } from "n3";

const isAbsoluteIri = (value) => {
  try { return Boolean(new URL(value).protocol); }
  catch { return false; }
};

export function validateTurtleIdentifiers(source, filePath) {
  let statements;
  try { statements = new Parser({ format: "text/turtle" }).parse(source); }
  catch (error) {
    throw new Error(`${filePath}: invalid Turtle: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }

  for (const statement of statements) {
    for (const [role, term] of [["subject", statement.subject], ["predicate", statement.predicate], ["object", statement.object], ["graph", statement.graph]]) {
      if (term.termType === "NamedNode" && !isAbsoluteIri(term.value)) {
        throw new Error(`${filePath}: unresolved ${role} IRI ${JSON.stringify(term.value)}; declare a valid @base or use an absolute IRI.`);
      }
      if (term.termType === "Literal" && term.datatype && !isAbsoluteIri(term.datatype.value)) {
        throw new Error(`${filePath}: unresolved literal datatype IRI ${JSON.stringify(term.datatype.value)}; declare a valid @base or use an absolute IRI.`);
      }
    }
  }
  return statements.length;
}

export function validatePackageMetadata(object) {
  const errors = [];
  for (const path of object.files.filter((file) => /\.metadata\.txt$/i.test(file)).sort()) {
    try { validateTurtleIdentifiers(object.readText(path), `${object.folderName}/${path}`); }
    catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  }
  if (errors.length) throw new Error(errors.join("\n"));
}
