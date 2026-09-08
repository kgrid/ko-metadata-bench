const TURTLE_IRI_FORBIDDEN = /[\u0000-\u0020<>"{}|^`\\]/u;
const TURTLE_LITERAL_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const LANGUAGE_TAG = /^[A-Za-z]+(?:-[A-Za-z0-9]+)*$/u;

function requiredString(value, label) {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string.`);
  return value;
}

export function formatTurtleLiteral(value, options = {}) {
  const literal = requiredString(value, "Turtle literal").normalize("NFC");
  if (TURTLE_LITERAL_FORBIDDEN.test(literal)) throw new TypeError("Turtle literal contains an unsupported control character.");
  const language = options.language ? requiredString(options.language, "Language tag") : "";
  const datatype = options.datatype ? requiredString(options.datatype, "Datatype IRI") : "";
  if (language && datatype) throw new TypeError("A Turtle literal cannot have both a language and a datatype.");
  if (language && !LANGUAGE_TAG.test(language)) throw new TypeError("Turtle literal language tag is invalid.");
  const escaped = literal
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
  const suffix = language ? `@${language.toLowerCase()}` : datatype ? `^^${formatTurtleIri(datatype)}` : "";
  return `"${escaped}"${suffix}`;
}

export function formatTurtleIri(value) {
  const iri = requiredString(value, "Turtle IRI").trim().normalize("NFC");
  if (!iri || TURTLE_IRI_FORBIDDEN.test(iri)) throw new TypeError("Turtle IRI is empty or contains a forbidden character.");
  try {
    const parsed = new URL(iri);
    if (!parsed.protocol) throw new Error();
  } catch {
    throw new TypeError("Turtle IRI must be an absolute IRI.");
  }
  return `<${iri}>`;
}

export function formatTurtleValueList(values, formatter, { indent = "        ", separator = ",\n" } = {}) {
  if (!Array.isArray(values)) throw new TypeError("Turtle value list must be an array.");
  if (typeof formatter !== "function") throw new TypeError("Turtle value list requires a formatter.");
  const formatted = values.map((value, index) => {
    try { return formatter(value); }
    catch (error) { throw new TypeError(`Invalid Turtle value at index ${index}: ${error instanceof Error ? error.message : String(error)}`); }
  });
  return formatted.join(`${separator}${indent}`);
}

export function formatTurtleLiteralList(values, options) {
  return formatTurtleValueList(values, (value) => formatTurtleLiteral(value, options));
}

export function formatTurtleIriList(values) {
  return formatTurtleValueList(values, formatTurtleIri);
}
