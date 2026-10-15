import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { basename, posix } from "node:path";
import { createDocumentProjectionRecord } from "./document-projection-contract.js";
import { sanitizeDocumentProjectionHtml } from "./document-projection-sanitizer.js";

const MAX_DOCX_XML_BYTES = 64 * 1024 * 1024;
const IMAGE_MEDIA_TYPES = Object.freeze({
  bmp: "image/bmp", gif: "image/gif", jpeg: "image/jpeg", jpg: "image/jpeg",
  png: "image/png", svg: "image/svg+xml", tif: "image/tiff", tiff: "image/tiff", webp: "image/webp",
});

const unzipText = (docxPath, entry) => execFileSync("unzip", ["-p", docxPath, entry], { encoding: "utf8", maxBuffer: MAX_DOCX_XML_BYTES });
const unzipBytes = (docxPath, entry) => execFileSync("unzip", ["-p", docxPath, entry], { encoding: "buffer", maxBuffer: MAX_DOCX_XML_BYTES });
const zipEntries = (docxPath) => execFileSync("unzip", ["-Z1", docxPath], { encoding: "utf8", maxBuffer: MAX_DOCX_XML_BYTES }).split(/\r?\n/).filter(Boolean).sort();
const optionalText = (docxPath, entries, entry) => entries.includes(entry) ? unzipText(docxPath, entry) : "";

const decodeXml = (value) => value
  .replace(/&#x([0-9a-f]+);/gi, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 16)))
  .replace(/&#(\d+);/g, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 10)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const decodeHtmlText = (value) => String(value ?? "")
  .replace(/&#x([0-9a-f]+);/gi, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 16)))
  .replace(/&#(\d+);/g, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 10)))
  .replace(/&nbsp;/gi, " ")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&amp;/gi, "&");

export const documentProjectionToPlainText = (projection) => {
  if (!projection?.sanitizedHtml) return "[Extracted DOCX text unavailable]";
  const text = decodeHtmlText(projection.sanitizedHtml
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:article|section|h[1-6]|p|li|tr|table|ol|ul)>/gi, "\n")
    .replace(/<\/(?:th|td)>/gi, "\t")
    .replace(/<hr\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\t{2,}/g, "\t")
    .replace(/\n{3,}/g, "\n\n")
    .trim());
  return text ? `[Extracted DOCX text]\n\n${text}` : "[Extracted DOCX text unavailable]";
};
const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const attribute = (xml, name) => decodeXml(xml.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? "");
const enabledProperty = (properties, name) => {
  const tag = properties.match(new RegExp(`<w:${name}\\b[^>]*\/?>`, "i"))?.[0];
  if (!tag) return false;
  return !/w:val="(?:0|false|off|none)"/i.test(tag);
};
const warning = (code, message, detail = "") => ({ code, message, ...(detail ? { detail } : {}) });
const uniqueWarnings = (warnings) => [...new Map(warnings.map((item) => [`${item.code}|${item.detail ?? ""}`, item])).values()];

const relationshipsFromXml = (xml) => {
  const relationships = new Map();
  for (const match of xml.matchAll(/<Relationship\b[^>]*\/?\s*>/gi)) {
    const id = attribute(match[0], "Id");
    if (id) relationships.set(id, {
      target: attribute(match[0], "Target"),
      targetMode: attribute(match[0], "TargetMode"),
      type: attribute(match[0], "Type"),
    });
  }
  return relationships;
};

const numberingFromXml = (xml) => {
  const abstractKinds = new Map();
  for (const match of xml.matchAll(/<w:abstractNum\b[^>]*w:abstractNumId="([^"]+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g)) {
    const format = match[2].match(/<w:numFmt\b[^>]*w:val="([^"]+)"/)?.[1] ?? "bullet";
    abstractKinds.set(match[1], format === "bullet" || format === "none" ? "unordered" : "ordered");
  }
  const numbering = new Map();
  for (const match of xml.matchAll(/<w:num\b[^>]*w:numId="([^"]+)"[^>]*>([\s\S]*?)<\/w:num>/g)) {
    const abstractId = match[2].match(/<w:abstractNumId\b[^>]*w:val="([^"]+)"/)?.[1];
    if (abstractId) numbering.set(match[1], abstractKinds.get(abstractId) ?? "unordered");
  }
  return numbering;
};

const imageRecords = (docxPath, entries, warnings) => {
  const byPath = new Map();
  const images = [];
  entries.filter((entry) => /^word\/media\/[^/]+$/i.test(entry)).forEach((entry, index) => {
    const extension = entry.split(".").at(-1)?.toLowerCase() ?? "";
    const mediaType = IMAGE_MEDIA_TYPES[extension];
    if (!mediaType) {
      warnings.push(warning("UNSUPPORTED-IMAGE-FORMAT", `An embedded ${extension || "unknown"} image could not be projected.`, entry));
      return;
    }
    const bytes = unzipBytes(docxPath, entry);
    const record = { imageId: `image-${index + 1}`, sourcePath: entry, mediaType, contentBase64: bytes.toString("base64"), byteLength: bytes.byteLength, altText: "" };
    images.push(record);
    byPath.set(entry, record);
  });
  return { images, byPath };
};

const safeHyperlink = (target) => {
  if (/^(?:https?:|mailto:)/i.test(target)) return target;
  if (/^#[A-Za-z][\w:.-]*$/.test(target)) return target;
  return "";
};

const makeRenderer = ({ relationships, numbering, imagesByPath, warnings }) => {
  const placedImages = new Set();

  const drawingHtml = (drawing) => {
    const relationshipId = drawing.match(/r:embed="([^"]+)"/)?.[1] ?? "";
    const relationship = relationships.get(relationshipId);
    const target = relationship?.target ? posix.normalize(posix.join("word", relationship.target)) : "";
    const image = imagesByPath.get(target);
    if (!image) {
      warnings.push(warning("IMAGE-REFERENCE-UNRESOLVED", "An embedded image reference could not be resolved.", relationshipId || target));
      return "";
    }
    const docProperties = drawing.match(/<wp:docPr\b[^>]*\/?\s*>/)?.[0] ?? "";
    const altText = attribute(docProperties, "descr") || attribute(docProperties, "title") || "";
    if (altText && !image.altText) image.altText = altText;
    placedImages.add(image.imageId);
    return `<figure class="docx-image"><img data-docx-image-id="${escapeHtml(image.imageId)}" alt="${escapeHtml(altText)}"></figure>`;
  };

  const runHtml = (run) => {
    const pieces = [];
    const tokens = run.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?\s*>|<w:br\b[^>]*\/?\s*>|<w:drawing\b[^>]*>[\s\S]*?<\/w:drawing>|<w:footnoteReference\b[^>]*w:id="([^"]+)"[^>]*\/?\s*>/g);
    for (const token of tokens) {
      if (token[1] !== undefined) pieces.push(escapeHtml(decodeXml(token[1])));
      else if (/^<w:tab/.test(token[0])) pieces.push("<span class=\"docx-tab\">\t</span>");
      else if (/^<w:br/.test(token[0])) pieces.push("<br>");
      else if (/^<w:drawing/.test(token[0])) pieces.push(drawingHtml(token[0]));
      else if (token[2] !== undefined) pieces.push(`<sup class="docx-footnote-ref"><a href="#docx-footnote-${escapeHtml(token[2])}">${escapeHtml(token[2])}</a></sup>`);
    }
    const content = pieces.join("");
    if (!content) return "";
    const properties = run.match(/<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/)?.[1] ?? "";
    let result = content;
    if (enabledProperty(properties, "b")) result = `<strong>${result}</strong>`;
    if (enabledProperty(properties, "i")) result = `<em>${result}</em>`;
    if (enabledProperty(properties, "u")) result = `<u>${result}</u>`;
    return result;
  };

  const inlineHtml = (container) => {
    const pieces = [];
    const tokens = /<w:hyperlink\b[^>]*>[\s\S]*?<\/w:hyperlink>|<w:r\b[^>]*>[\s\S]*?<\/w:r>/g;
    for (const match of container.matchAll(tokens)) {
      if (match[0].startsWith("<w:hyperlink")) {
        const content = [...match[0].matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)].map((run) => runHtml(run[0])).join("");
        const relationshipId = match[0].match(/r:id="([^"]+)"/)?.[1];
        const anchor = match[0].match(/w:anchor="([^"]+)"/)?.[1];
        const rawTarget = relationshipId ? relationships.get(relationshipId)?.target ?? "" : anchor ? `#${anchor}` : "";
        const target = safeHyperlink(rawTarget);
        if (target) pieces.push(`<a href="${escapeHtml(target)}"${/^https?:/i.test(target) ? ' rel="noopener noreferrer"' : ""}>${content}</a>`);
        else {
          if (rawTarget) warnings.push(warning("UNSAFE-HYPERLINK-OMITTED", "A hyperlink target was omitted because its scheme is not safe.", rawTarget));
          pieces.push(content);
        }
      } else pieces.push(runHtml(match[0]));
    }
    return pieces.join("");
  };

  const paragraphHtml = (paragraph) => {
    const content = inlineHtml(paragraph);
    const sectionBreak = /<w:sectPr\b/.test(paragraph) ? '<hr class="docx-section-break">' : "";
    if (!content) return sectionBreak;
    const style = paragraph.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1] ?? "";
    const heading = style.match(/^Heading\s*([1-6])$/i)?.[1];
    if (heading) return `<h${heading}>${content}</h${heading}>${sectionBreak}`;
    if (/<w:numPr\b/.test(paragraph)) {
      const numId = paragraph.match(/<w:numId\b[^>]*w:val="([^"]+)"/)?.[1] ?? "";
      return `<li data-docx-list="${numbering.get(numId) ?? "unordered"}">${content}</li>${sectionBreak}`;
    }
    return `<p>${content}</p>${sectionBreak}`;
  };

  const tableHtml = (table) => {
    const rows = [...table.matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)].map((rowMatch) => {
      const cellTag = /<w:tblHeader\b/.test(rowMatch[0]) ? "th" : "td";
      const cells = [...rowMatch[0].matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)].map((cellMatch) => {
        const paragraphs = [...cellMatch[0].matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((match) => paragraphHtml(match[0])).filter(Boolean).join("");
        return `<${cellTag}>${paragraphs}</${cellTag}>`;
      }).join("");
      return cells ? `<tr>${cells}</tr>` : "";
    }).join("");
    return rows ? `<table><tbody>${rows}</tbody></table>` : "";
  };

  return { paragraphHtml, tableHtml, placedImages };
};

const bodyBlocks = (xml) => {
  const body = xml.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/)?.[1] ?? "";
  const blocks = [];
  const tokens = /<w:(p|tbl)\b[^>]*>|<\/w:(p|tbl)>/g;
  let match; let start = -1; let kind = ""; let depth = 0;
  while ((match = tokens.exec(body))) {
    const opening = !match[0].startsWith("</");
    const tokenKind = match[1] || match[2];
    if (start < 0 && opening) { start = match.index; kind = tokenKind; depth = 1; }
    else if (start >= 0) {
      if (opening && tokenKind === kind) depth += 1;
      if (!opening && tokenKind === kind) depth -= 1;
      if (depth === 0) { blocks.push({ kind, xml: body.slice(start, tokens.lastIndex) }); start = -1; kind = ""; }
    }
  }
  return blocks;
};

const normalizeLists = (html) => html.replace(/(?:<li data-docx-list="(?:ordered|unordered)">[\s\S]*?<\/li>)+/g, (group) => {
  const items = [...group.matchAll(/<li data-docx-list="(ordered|unordered)">([\s\S]*?)<\/li>/g)];
  let result = ""; let kind = ""; let content = "";
  const flush = () => { if (content) result += `<${kind === "ordered" ? "ol" : "ul"}>${content}</${kind === "ordered" ? "ol" : "ul"}>`; content = ""; };
  for (const item of items) {
    if (kind && item[1] !== kind) flush();
    kind = item[1];
    content += `<li>${item[2]}</li>`;
  }
  flush();
  return result;
});

const footnotesHtml = (xml, renderer) => {
  const notes = [...xml.matchAll(/<w:footnote\b[^>]*w:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:footnote>/g)]
    .filter((match) => !String(match[1]).startsWith("-"))
    .map((match) => {
      const body = [...match[2].matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((paragraph) => renderer.paragraphHtml(paragraph[0])).filter(Boolean).join("");
      return body ? `<li id="docx-footnote-${escapeHtml(match[1])}">${body}</li>` : "";
    }).filter(Boolean).join("");
  return notes ? `<section class="docx-footnotes"><hr><ol>${notes}</ol></section>` : "";
};

const detectUnsupportedConstructs = (xml, entries, warnings) => {
  const checks = [
    [/<(?:w:object|o:OLEObject)\b/i, "EMBEDDED-OBJECT-OMITTED", "An embedded object was not included in the projection."],
    [/<c:chart\b/i, "CHART-OMITTED", "A chart was not included in the projection."],
    [/<dgm:relIds\b/i, "SMARTART-OMITTED", "A SmartArt graphic was not included in the projection."],
    [/<w:(?:txbxContent|pict)\b/i, "TEXTBOX-OMITTED", "A text box or legacy drawing was not included in the projection."],
    [/<m:oMath(?:Para)?\b/i, "EQUATION-SIMPLIFIED", "An equation may be simplified in the projection."],
  ];
  checks.forEach(([pattern, code, message]) => { if (pattern.test(xml)) warnings.push(warning(code, message)); });
  if (entries.includes("word/comments.xml") || /<w:commentRangeStart\b/.test(xml)) warnings.push(warning("COMMENTS-OMITTED", "Document comments are not included in the projection."));
};

export function convertDocxToProjection({ docxPath, knowledgeObjectId, fileId, originalPath }) {
  const warnings = [];
  try {
    const entries = zipEntries(docxPath);
    if (!entries.includes("word/document.xml")) throw new Error("The DOCX package does not contain word/document.xml.");
    const xml = unzipText(docxPath, "word/document.xml");
    const relationships = relationshipsFromXml(optionalText(docxPath, entries, "word/_rels/document.xml.rels"));
    const numbering = numberingFromXml(optionalText(docxPath, entries, "word/numbering.xml"));
    const { images, byPath } = imageRecords(docxPath, entries, warnings);
    const renderer = makeRenderer({ relationships, numbering, imagesByPath: byPath, warnings });
    const blocks = bodyBlocks(xml);
    let body = normalizeLists(blocks.map((block) => block.kind === "tbl" ? renderer.tableHtml(block.xml) : renderer.paragraphHtml(block.xml)).filter(Boolean).join(""));
    body += footnotesHtml(optionalText(docxPath, entries, "word/footnotes.xml"), renderer);
    images.filter((image) => !renderer.placedImages.has(image.imageId)).forEach((image) => warnings.push(warning("UNPLACED-IMAGE", "An embedded image was extracted but its document position could not be preserved.", image.sourcePath)));
    detectUnsupportedConstructs(xml, entries, warnings);
    if (!body) warnings.push(warning("NO-READABLE-CONTENT", "No readable document content could be converted."));
    const sanitation = sanitizeDocumentProjectionHtml(body ? `<article class="docx-projection">${body}</article>` : "");
    if (sanitation.removedConstructs.length) {
      warnings.push(warning(
        "UNSAFE-CONTENT-REMOVED",
        "Unsafe or unsupported generated HTML content was removed.",
        sanitation.removedConstructs.join(", "),
      ));
    }
    return createDocumentProjectionRecord({
      knowledgeObjectId, fileId, originalPath,
      originalFileAvailable: true,
      originalByteLength: statSync(docxPath).size,
      sanitizedHtml: sanitation.html,
      embeddedImages: images,
      conversionWarnings: uniqueWarnings(warnings),
    });
  } catch (error) {
    return createDocumentProjectionRecord({
      knowledgeObjectId, fileId,
      originalPath: originalPath || basename(docxPath),
      originalFileAvailable: true,
      originalByteLength: statSync(docxPath).size,
      sanitizedHtml: "",
      conversionWarnings: [warning("CONVERSION-FAILED", "The Word document could not be converted.", error instanceof Error ? error.message : String(error))],
    });
  }
}
