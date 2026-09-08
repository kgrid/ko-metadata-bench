import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import N3 from "n3";

const noop = () => {};

function startupDocument() {
  let emptyNode;
  const makeNode = () => new Proxy({
    innerHTML: "", textContent: "", value: "", checked: false, hidden: false, disabled: false,
    dataset: {}, style: {}, className: "",
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, setAttribute: noop, getAttribute: () => null,
    append: noop, appendChild: noop, prepend: noop, before: noop, after: noop, remove: noop,
    replaceWith: noop, insertAdjacentHTML: noop, showModal: noop, close: noop, click: noop, focus: noop,
    querySelector: () => emptyNode, querySelectorAll: () => [], closest: () => null,
    getBoundingClientRect: () => ({ width: 1000, height: 700, left: 0, top: 0 }), getContext: () => null,
  }, { get: (target, property) => target[property], set: (target, property, value) => (target[property] = value, true) });
  emptyNode = makeNode();
  const workspace = makeNode();
  const exercises = ["F", "A", "I", "R"].map((exercise) => { const node = makeNode(); node.dataset.exercise = exercise; return node; });
  return {
    workspace,
    document: {
      documentElement: emptyNode, body: emptyNode, head: emptyNode,
      querySelector: (selector) => selector === ".workspaces" ? workspace : emptyNode,
      querySelectorAll: (selector) => selector === "[data-exercise]" ? exercises : [],
      getElementById: makeNode, createElement: makeNode, addEventListener: noop, removeEventListener: noop,
    },
  };
}

test("the standalone edition completes startup and mounts all four embedded KO panels", async () => {
  const html = await readFile(new URL("../outputs/Knowledge-Object-Workbench.html", import.meta.url), "utf8");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  const { document, workspace } = startupDocument();
  const context = {
    N3, document, console: { log: noop, warn: noop, error: noop },
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    MutationObserver: class { observe() {} disconnect() {} },
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    requestAnimationFrame: () => 0, cancelAnimationFrame: noop, setTimeout: () => 0, clearTimeout: noop, queueMicrotask: noop,
    Blob, URL, TextEncoder, TextDecoder, crypto: crypto.webcrypto, CSS: { escape: String }, navigator: {}, performance: { now: () => 0 }, structuredClone,
    atob: (value) => Buffer.from(value, "base64").toString("binary"), btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    CustomEvent: class {}, KeyboardEvent: class {}, Event: class {},
  };
  context.window = context;
  context.self = context;
  context.global = context;
  vm.createContext(context);
  assert.doesNotThrow(() => vm.runInContext(scripts[1], context, { timeout: 30_000 }));
  assert.equal((workspace.innerHTML.match(/class="ko-object-shade"/g) ?? []).length, 4);
});
