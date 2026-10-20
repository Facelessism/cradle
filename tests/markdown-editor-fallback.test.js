const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SCRIPT_PATH = path.resolve(
  __dirname,
  "..",
  "projects",
  "editor",
  "markdown-editor",
  "script.js"
);
const SCRIPT_SOURCE = fs.readFileSync(SCRIPT_PATH, "utf-8");

function createElement() {
  const listeners = new Map();

  return {
    value: "",
    selectionStart: 0,
    selectionEnd: 0,
    innerHTML: "",
    textContent: "",
    style: {},
    dataset: {},
    listeners,
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    setRangeText(text, start, end) {
      this.value = this.value.slice(0, start) + text + this.value.slice(end);
    },
    focus() {},
    click() {},
    closest() {
      return null;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 100, height: 100 };
    },
    querySelector() {
      return createElement();
    },
  };
}

function runEditor(marked) {
  const elements = new Map();
  let lastBlob = null;

  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    createElement() {
      return createElement();
    },
    addEventListener() {},
    body: {
      appendChild() {},
      removeChild() {},
    },
  };

  const window = {};
  if (marked) window.marked = marked;

  const sandbox = {
    document,
    window,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
    setInterval: () => 0,
    clearInterval: () => {},
    console,
    Blob: class {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
      }
    },
    URL: {
      createObjectURL(blob) {
        lastBlob = blob;
        return "blob:markdown-editor-test";
      },
      revokeObjectURL() {},
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(SCRIPT_SOURCE, sandbox, { filename: SCRIPT_PATH });

  return {
    elements,
    getLastBlob: () => lastBlob,
  };
}

test("editor initializes and shows a raw fallback when marked is missing", () => {
  const { elements } = runEditor();

  const editor = elements.get("editor");
  const preview = elements.get("preview");

  assert.match(editor.value, /Welcome to Markdown Editor/);
  assert.match(preview.innerHTML, /Live preview is unavailable/);
  assert.match(preview.innerHTML, /<pre class="preview-fallback">/);
  assert.match(preview.innerHTML, /Welcome to Markdown Editor/);
  assert.doesNotMatch(preview.innerHTML, /<h1>/);
  assert.match(elements.get("charCount").textContent, /chars$/);
  assert.match(elements.get("wordCount").textContent, /words$/);
});

test("editor uses marked when the library is available", () => {
  let parseCalls = 0;
  const fakeMarked = {
    setOptions() {},
    use() {},
    Renderer: class {
      code() {
        return "";
      }
    },
    parse(markdown) {
      parseCalls += 1;
      return `<h1>${markdown.split("\n")[0]}</h1>`;
    },
  };

  const { elements } = runEditor(fakeMarked);
  const preview = elements.get("preview");

  assert.equal(parseCalls, 1);
  assert.match(preview.innerHTML, /<h1># Welcome to Markdown Editor<\/h1>/);
  assert.doesNotMatch(preview.innerHTML, /Live preview is unavailable/);
});

test("HTML export falls back to an escaped pre block without marked", () => {
  const { elements, getLastBlob } = runEditor();

  const handler = elements.get("btn-export-html").listeners.get("click");
  assert.equal(typeof handler, "function");
  handler();

  const blob = getLastBlob();
  assert.ok(blob, "export should create a Blob");

  const exported = blob.parts[0];
  assert.match(exported, /<pre>/);
  assert.match(exported, /Welcome to Markdown Editor/);
  assert.doesNotMatch(exported, /<h1>/);
  assert.equal(blob.options.type, "text/html;charset=utf-8");
});
