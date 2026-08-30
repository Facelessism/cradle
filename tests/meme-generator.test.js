const test = require("node:test");
const assert = require("node:assert/strict");

const {
  wrapText,
  getDefaultMemeOptions,
  isCanvasTainted,
  exportMemeCanvas,
} = require("../projects/misc/meme-generator/memeEngine");

const {
  getSavedMemes,
  saveMemePreset,
  deleteMemePreset,
} = require("../projects/misc/meme-generator/memeStorage");

const { setupLocalStorageMock } = require("./helpers/localstorage-mock");

setupLocalStorageMock();

test("getDefaultMemeOptions provides valid default values", () => {
  const opts = getDefaultMemeOptions();

  assert.equal(opts.fontSize, 36);
  assert.equal(opts.textColor, "#FFFFFF");
  assert.equal(opts.strokeColor, "#000000");
  assert.ok(opts.topText.length > 0);
});

test("wrapText correctly splits long text into line array", () => {
  const mockCtx = {
    measureText: text => ({ width: text.length * 10 }),
  };

  const lines = wrapText(
    mockCtx,
    "THIS IS A VERY LONG MEME CAPTION THAT WRAPS",
    150
  );

  assert.ok(lines.length > 1);
  assert.equal(lines[0], "THIS IS A VERY");
});

test("memeStorage manages presets in localStorage", () => {
  localStorage.clear();

  assert.equal(getSavedMemes().length, 0);

  saveMemePreset({
    topText: "HELLO",
    bottomText: "WORLD",
    fontSize: 32,
    textColor: "#FFFFFF",
    strokeColor: "#000000",
  });

  const saved = getSavedMemes();

  assert.equal(saved.length, 1);
  assert.equal(saved[0].topText, "HELLO");

  deleteMemePreset(saved[0].id);

  assert.equal(getSavedMemes().length, 0);
});

test("isCanvasTainted returns false for an accessible canvas", () => {
  const canvas = {
    getContext: () => ({
      getImageData: () => ({}),
    }),
  };

  assert.equal(isCanvasTainted(canvas), false);
});

test("isCanvasTainted returns true for a tainted canvas", () => {
  const canvas = {
    getContext: () => ({
      getImageData: () => {
        throw new DOMException("Canvas is tainted", "SecurityError");
      },
    }),
  };

  assert.equal(isCanvasTainted(canvas), true);
});

test("exportMemeCanvas returns a PNG data URL for an accessible canvas", () => {
  const canvas = {
    getContext: () => ({
      getImageData: () => ({}),
    }),
    toDataURL: type => {
      assert.equal(type, "image/png");
      return "data:image/png;base64,test";
    },
  };

  assert.equal(
    exportMemeCanvas(canvas),
    "data:image/png;base64,test"
  );
});

test("exportMemeCanvas rejects tainted canvases with an actionable error", () => {
  const canvas = {
    getContext: () => ({
      getImageData: () => {
        throw new DOMException("Canvas is tainted", "SecurityError");
      },
    }),
  };

  assert.throws(
    () => exportMemeCanvas(canvas),
    /cross-origin image.*exported|Upload a local image/i
  );
});

// Security & DOM Safety Tests for Issue #723

test("script.js does not contain unsafe innerHTML assignments", () => {
  const fs = require("node:fs");
  const scriptContent = fs.readFileSync(
    require.resolve("../projects/misc/meme-generator/script.js"),
    "utf8"
  );

  // Ensure no innerHTML property assignment exists in script.js
  assert.doesNotMatch(
    scriptContent,
    /\.innerHTML\s*=/i,
    "script.js must not assign to innerHTML"
  );
});

test("meme preset storage preserves special characters and HTML payloads safely", () => {
  localStorage.clear();

  const xssPayloads = {
    topText: "<script>alert('xss')</script>",
    bottomText: '<img src=x onerror="alert(1)"> & "quotes" & <tags>',
    fontSize: 36,
    textColor: "#FFFFFF",
    strokeColor: "#000000",
  };

  saveMemePreset(xssPayloads);
  const saved = getSavedMemes();

  assert.equal(saved.length, 1);
  assert.equal(saved[0].topText, "<script>alert('xss')</script>");
  assert.equal(
    saved[0].bottomText,
    '<img src=x onerror="alert(1)"> & "quotes" & <tags>'
  );

  deleteMemePreset(saved[0].id);
});

