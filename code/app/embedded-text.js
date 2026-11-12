// Keep large resources compressed until opened or exported.
export function installEmbeddedText(files, compressed, inflate) {
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
  for (const [path, record] of Object.entries(compressed)) {
    Object.defineProperty(files, path, {
      enumerable: true,
      get() {
        const bytes = Uint8Array.from(atob(record.base64), (char) => char.charCodeAt(0));
        return decoder.decode(inflate(bytes, new Uint8Array(record.byteLength)));
      },
    });
  }
}

export function previewEmbeddedText(source) {
  const limit = 250_000;
  return source.length > limit
    ? source.slice(0, limit) + "\n\n[Preview truncated. The embedded KO export contains the full file.]"
    : source;
}
