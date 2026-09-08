const API_VERSION = "1.0.0";
const ZIP_MEDIA_TYPE = "application/zip";
const ACCESS_PASSWORD = "Texas";
const UTF8_FLAG = 0x0800;
const DOS_DATE_1980_01_01 = 33;

let crcTable;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    crcTable[index] = value >>> 0;
  }
  return crcTable;
}

function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const little16 = (value) => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
const little32 = (value) => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);

function joinBytes(parts) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function safePath(path) {
  const segments = String(path).replaceAll("\\", "/").split("/").filter((segment) => segment && segment !== ".");
  if (!segments.length || segments.some((segment) => segment === ".." || segment.includes("\0"))) throw new Error(`Unsafe or empty file path: ${path}`);
  return segments.join("/");
}

function slug(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "knowledge-object";
}

function bytesFor(content) {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  return new TextEncoder().encode(String(content ?? ""));
}

export function createStoredZip(files, rootFolder) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const root = safePath(rootFolder);
  for (const file of files) {
    const name = new TextEncoder().encode(`${root}/${safePath(file.path)}`);
    const content = bytesFor(file.content);
    const checksum = crc32(content);
    const localHeader = joinBytes([
      little32(0x04034b50), little16(20), little16(UTF8_FLAG), little16(0), little16(0), little16(DOS_DATE_1980_01_01),
      little32(checksum), little32(content.length), little32(content.length), little16(name.length), little16(0), name,
    ]);
    localParts.push(localHeader, content);
    centralParts.push(joinBytes([
      little32(0x02014b50), little16(20), little16(20), little16(UTF8_FLAG), little16(0), little16(0), little16(DOS_DATE_1980_01_01),
      little32(checksum), little32(content.length), little32(content.length), little16(name.length), little16(0), little16(0),
      little16(0), little16(0), little32(0), little32(localOffset), name,
    ]));
    localOffset += localHeader.length + content.length;
  }
  const centralDirectory = joinBytes(centralParts);
  const end = joinBytes([
    little32(0x06054b50), little16(0), little16(0), little16(files.length), little16(files.length),
    little32(centralDirectory.length), little32(localOffset), little16(0),
  ]);
  return joinBytes([...localParts, centralDirectory, end]);
}

async function sha256(bytes, environment) {
  const subtle = environment.crypto?.subtle;
  if (!subtle) return null;
  const digest = new Uint8Array(await subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function emit(environment, detail) {
  if (typeof environment.dispatchEvent !== "function" || typeof environment.CustomEvent !== "function") return;
  environment.dispatchEvent(new environment.CustomEvent("fdobench:knowledge-object-download", { detail }));
}

function failure(knowledgeObjectId, status, message) {
  return { ok: false, knowledgeObjectId: String(knowledgeObjectId ?? ""), status, message };
}

function requestPassword(environment, authenticate) {
  return new Promise((resolve) => {
    if (!environment.document) {
      resolve(null);
      return;
    }
    const backdrop = environment.document.createElement("div");
    backdrop.className = "koAccessAuthBackdrop";
    backdrop.innerHTML = `
      <section class="koAccessAuthDialog" role="dialog" aria-modal="true" aria-labelledby="ko-access-auth-title">
        <form>
          <header>
            <span>FDO Bench KO Access API 1.0</span>
            <h2 id="ko-access-auth-title">Password required</h2>
          </header>
          <p>Enter the password to retrieve this embedded knowledge object.</p>
          <label>
            <span>Password</span>
            <input type="password" autocomplete="off" autocapitalize="none" spellcheck="false" required />
          </label>
          <p class="koAccessAuthError" role="alert" aria-live="polite" hidden></p>
          <small>Password entry is case-sensitive.</small>
          <div class="koAccessAuthActions">
            <button type="button" data-action="cancel">Cancel</button>
            <button type="submit" class="primary">Continue</button>
          </div>
        </form>
      </section>`;
    const form = backdrop.querySelector("form");
    const input = backdrop.querySelector("input");
    const errorMessage = backdrop.querySelector(".koAccessAuthError");
    const continueButton = backdrop.querySelector('button[type="submit"]');
    const finish = (value) => {
      environment.document.removeEventListener("keydown", onKeyDown);
      backdrop.remove();
      resolve(value);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") finish(null);
    };
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      continueButton.disabled = true;
      continueButton.textContent = "Checking…";
      errorMessage.hidden = true;
      input.removeAttribute("aria-invalid");
      const result = await authenticate(input.value);
      if (result?.status === "authentication-failed") {
        errorMessage.textContent = "Incorrect password. Passwords are case-sensitive.";
        errorMessage.hidden = false;
        input.value = "";
        input.setAttribute("aria-invalid", "true");
        continueButton.disabled = false;
        continueButton.textContent = "Continue";
        input.focus();
        return;
      }
      finish(result);
    });
    backdrop.querySelector('[data-action="cancel"]').addEventListener("click", () => finish(null));
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) finish(null);
    });
    environment.document.addEventListener("keydown", onKeyDown);
    environment.document.body.append(backdrop);
    environment.setTimeout(() => input.focus(), 0);
  });
}

export function createKnowledgeObjectAccessApi({ objects, getEmbeddedFiles, getWorkingFiles, environment = globalThis }) {
  const aliases = new Map();
  const authenticatedPreparations = new WeakSet();
  for (const object of objects) {
    for (const alias of [object.id, ...(object.aliases || [])]) aliases.set(String(alias).trim().toLowerCase(), object);
  }

  const resolve = (identifier) => aliases.get(String(identifier ?? "").trim().toLowerCase()) || null;

  async function prepareKnowledgeObjectZip(options = {}) {
    const requestedId = options.knowledgeObjectId;
    if (options.password === undefined) return failure(requestedId, "authentication-required", "A password is required by FDO Bench KO Access API 1.0.");
    if (options.password !== ACCESS_PASSWORD) return failure(requestedId, "authentication-failed", "The supplied password is incorrect. Passwords are case-sensitive.");
    const object = resolve(requestedId);
    if (!object) return failure(requestedId, "knowledge-object-not-found", `No embedded knowledge object has the identifier '${String(requestedId ?? "")}'.`);
    if (options.format && options.format !== "zip") return failure(object.id, "format-not-supported", "The KO access API currently supports only ZIP representations.");
    const content = options.content || "embedded";
    if (!new Set(["embedded", "working"]).has(content)) return failure(object.id, "content-not-supported", "Content must be 'embedded' or 'working'.");
    try {
      const files = (content === "working" ? getWorkingFiles(object) : getEmbeddedFiles(object)).map((file) => ({ path: safePath(file.path), content: file.content }));
      if (!files.length) return failure(object.id, "knowledge-object-empty", "The embedded knowledge object contains no files.");
      const archiveName = `${slug(object.id)}${content === "working" ? "-working-copy" : ""}.zip`;
      const bytes = createStoredZip(files, slug(object.id));
      const prepared = {
        ok: true,
        apiVersion: API_VERSION,
        status: "prepared",
        knowledgeObjectId: object.id,
        knowledgeObjectName: object.name,
        content,
        format: "zip",
        fileName: archiveName,
        mediaType: ZIP_MEDIA_TYPE,
        fileCount: files.length,
        byteLength: bytes.length,
        sha256: await sha256(bytes, environment),
        blob: new Blob([bytes], { type: ZIP_MEDIA_TYPE }),
      };
      authenticatedPreparations.add(prepared);
      return prepared;
    } catch (error) {
      return failure(object.id, "archive-generation-failed", error instanceof Error ? error.message : "The ZIP archive could not be generated.");
    }
  }

  async function savePreparedDownload(prepared) {
    if (!prepared?.ok || prepared.status !== "prepared" || !(prepared.blob instanceof Blob) || !authenticatedPreparations.has(prepared)) {
      const result = failure(prepared?.knowledgeObjectId, "invalid-prepared-download", "Prepare a valid KO ZIP before saving it.");
      emit(environment, result);
      return result;
    }
    if (!environment.document || !environment.URL?.createObjectURL) {
      const result = failure(prepared.knowledgeObjectId, "download-environment-unavailable", "This environment cannot actuate a browser download.");
      emit(environment, result);
      return result;
    }
    const url = environment.URL.createObjectURL(prepared.blob);
    const anchor = environment.document.createElement("a");
    anchor.href = url;
    anchor.download = prepared.fileName;
    anchor.hidden = true;
    environment.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    environment.setTimeout(() => environment.URL.revokeObjectURL(url), 1000);
    const { blob: _blob, ...receipt } = prepared;
    const result = { ...receipt, ok: true, status: "download-started" };
    emit(environment, result);
    return result;
  }

  async function downloadKnowledgeObject(options = {}) {
    const { password: _ignoredPassword, ...request } = options;
    const prepared = await requestPassword(environment, (password) => prepareKnowledgeObjectZip({ ...request, password }));
    if (prepared === null) {
      const cancelled = failure(options.knowledgeObjectId, "authentication-cancelled", "Password entry was cancelled. No knowledge object was downloaded.");
      emit(environment, cancelled);
      return cancelled;
    }
    if (!prepared.ok) {
      emit(environment, prepared);
      return prepared;
    }
    return savePreparedDownload(prepared);
  }

  return Object.freeze({
    version: API_VERSION,
    listKnowledgeObjects: () => objects.map(({ id, name }) => ({ id, name })),
    prepareKnowledgeObjectZip,
    savePreparedDownload,
    downloadKnowledgeObject,
  });
}

export const KNOWLEDGE_OBJECT_ACCESS_API_VERSION = API_VERSION;
