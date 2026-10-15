const ALLOWED_TAGS = new Set([
  "article", "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "em", "u", "span", "br", "ul", "ol", "li",
  "table", "thead", "tbody", "tr", "th", "td", "a", "figure",
  "img", "sup", "section", "hr",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);
const ALLOWED_CLASSES = new Set([
  "docx-projection", "docx-tab", "docx-image", "docx-footnote-ref",
  "docx-footnotes", "docx-section-break",
]);
const SAFE_ID = /^docx-footnote-[A-Za-z0-9_.:-]+$/;
const SAFE_IMAGE_ID = /^image-[1-9][0-9]*$/;

const escapeAttribute = (value) => value
  .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;");

const attributes = (source) => {
  const result = [];
  const pattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const match of source.matchAll(pattern)) result.push([match[1].toLowerCase(), match[2] ?? match[3] ?? ""]);
  return result;
};

const safeHref = (value) => /^(?:https?:\/\/|mailto:)[^\s"'<>]+$/i.test(value)
  || /^#docx-footnote-[A-Za-z0-9_.:-]+$/.test(value);

const sanitizeAttributes = (tag, source) => {
  const kept = [];
  for (const [name, value] of attributes(source)) {
    if (name === "class") {
      const classes = value.split(/\s+/).filter((item) => ALLOWED_CLASSES.has(item));
      if (classes.length) kept.push(`class="${escapeAttribute(classes.join(" "))}"`);
    } else if (tag === "a" && name === "href" && safeHref(value)) {
      kept.push(`href="${escapeAttribute(value)}"`);
    } else if (tag === "a" && name === "rel" && /^(?:noopener noreferrer|noreferrer noopener)$/.test(value)) {
      kept.push('rel="noopener noreferrer"');
    } else if (name === "id" && SAFE_ID.test(value)) {
      kept.push(`id="${escapeAttribute(value)}"`);
    } else if (tag === "img" && name === "data-docx-image-id" && SAFE_IMAGE_ID.test(value)) {
      kept.push(`data-docx-image-id="${escapeAttribute(value)}"`);
    } else if (tag === "img" && name === "alt") {
      kept.push(`alt="${escapeAttribute(value)}"`);
    }
  }
  if (tag === "a" && kept.some((item) => item.startsWith('href="http'))) {
    if (!kept.some((item) => item.startsWith('rel="'))) kept.push('rel="noopener noreferrer"');
  }
  return kept.length ? ` ${kept.join(" ")}` : "";
};

/**
 * Final, edition-neutral safety boundary for derived document HTML.
 * It intentionally allows only passive document structure. Scripts, styles,
 * forms, media sources, event handlers, and embedded browsing contexts cannot
 * survive this pass.
 */
export function sanitizeDocumentProjectionHtml(input) {
  const source = typeof input === "string" ? input : "";
  const removed = new Set();
  let working = source.replace(/<(script|style|iframe|frame|object|embed|applet|form|button|input|textarea|select|video|audio|source|link|meta|base|svg|math|canvas)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (_, tag) => {
    removed.add(tag.toLowerCase());
    return "";
  });
  working = working.replace(/<(script|style|iframe|frame|object|embed|applet|form|button|input|textarea|select|video|audio|source|link|meta|base|svg|math|canvas)\b[^>]*\/?\s*>/gi, (_, tag) => {
    removed.add(tag.toLowerCase());
    return "";
  });

  const openTags = [];
  const html = working.replace(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g, (token) => {
    if (token.startsWith("<!--")) {
      removed.add("comment");
      return "";
    }
    const closing = /^<\//.test(token);
    const tag = token.match(/^<\/?\s*([A-Za-z0-9]+)/)?.[1]?.toLowerCase() ?? "";
    if (!ALLOWED_TAGS.has(tag)) {
      removed.add(tag || "unknown");
      return "";
    }
    if (closing) {
      if (VOID_TAGS.has(tag)) return "";
      const position = openTags.lastIndexOf(tag);
      if (position < 0) {
        removed.add(`unmatched-${tag}`);
        return "";
      }
      openTags.splice(position, 1);
      return `</${tag}>`;
    }
    const result = `<${tag}${sanitizeAttributes(tag, token)}>`;
    if (!VOID_TAGS.has(tag)) openTags.push(tag);
    return result;
  });

  return Object.freeze({
    html: html.trim(),
    removedConstructs: Object.freeze([...removed].sort()),
  });
}
