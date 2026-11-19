const test = require("node:test");
const assert = require("node:assert/strict");

const {
  diffArrays,
  myersDiff,
  toLines,
  toWordTokens,
  toCharTokens,
  normalizeToken,
  areTokensEqual,
  escapeHtml,
  inlineWordDiff,
  inlineCharDiff,
  generateUnifiedPatch,
} = require("../projects/dev-tools/text-diff-checker/diffEngine.js");

test("diffArrays identifies equal values", () => {
  assert.deepEqual(diffArrays(["a", "b"], ["a", "b"]), [
    { type: "equal", value: "a" },
    { type: "equal", value: "b" },
  ]);
});

test("diffArrays identifies additions", () => {
  assert.deepEqual(diffArrays(["a"], ["a", "b"]), [
    { type: "equal", value: "a" },
    { type: "add", value: "b" },
  ]);
});

test("diffArrays identifies deletions", () => {
  assert.deepEqual(diffArrays(["a", "b"], ["a"]), [
    { type: "equal", value: "a" },
    { type: "del", value: "b" },
  ]);
});

test("diffArrays handles completely different arrays", () => {
  const result = diffArrays(["old"], ["new"]);

  assert.deepEqual(result, [
    { type: "del", value: "old" },
    { type: "add", value: "new" },
  ]);
});

test("diffArrays handles empty arrays", () => {
  assert.deepEqual(diffArrays([], []), []);
});

test("toLines splits text by newline", () => {
  assert.deepEqual(toLines("line one\nline two\nline three"), [
    "line one",
    "line two",
    "line three",
  ]);
});

test("toLines returns empty array for empty text", () => {
  assert.deepEqual(toLines(""), []);
});

test("toWordTokens preserves whitespace", () => {
  assert.deepEqual(toWordTokens("hello world"), ["hello", " ", "world"]);
});

test("toWordTokens handles multiple spaces", () => {
  assert.deepEqual(toWordTokens("hello   world"), ["hello", "   ", "world"]);
});

test("toWordTokens returns empty array for empty text", () => {
  assert.deepEqual(toWordTokens(""), []);
});

test("escapeHtml escapes HTML-sensitive characters", () => {
  assert.equal(
    escapeHtml('<script>alert("XSS & test")</script>'),
    '&lt;script&gt;alert("XSS &amp; test")&lt;/script&gt;'
  );
});

test("inlineWordDiff highlights deleted words on the left", () => {
  const result = inlineWordDiff("hello world", "hello there");

  assert.match(result.leftHtml, /word-del/);
  assert.match(result.rightHtml, /word-add/);

  assert.match(result.leftHtml, /world/);
  assert.match(result.rightHtml, /there/);
});

test("inlineWordDiff preserves unchanged words", () => {
  const result = inlineWordDiff("hello world", "hello there");

  assert.match(result.leftHtml, /hello/);
  assert.match(result.rightHtml, /hello/);
});

test("inlineWordDiff escapes HTML in changed words", () => {
  const result = inlineWordDiff("<script>", "safe");

  assert.match(result.leftHtml, /&lt;script&gt;/);
  assert.doesNotMatch(result.leftHtml, /<script>/);
});

test("toCharTokens splits string into individual characters", () => {
  assert.deepEqual(toCharTokens("hello"), ["h", "e", "l", "l", "o"]);
  assert.deepEqual(toCharTokens(""), []);
});

test("myersDiff identifies minimal edits with prefix and suffix matching", () => {
  const oldArr = ["alpha", "beta", "gamma", "delta"];
  const newArr = ["alpha", "beta", "zeta", "delta"];
  const diff = myersDiff(oldArr, newArr);

  assert.deepEqual(diff, [
    { type: "equal", value: "alpha" },
    { type: "equal", value: "beta" },
    { type: "del", value: "gamma" },
    { type: "add", value: "zeta" },
    { type: "equal", value: "delta" },
  ]);
});

test("myersDiff handles empty arrays and one-sided emptiness", () => {
  assert.deepEqual(myersDiff([], []), []);
  assert.deepEqual(myersDiff(["foo"], []), [{ type: "del", value: "foo" }]);
  assert.deepEqual(myersDiff([], ["bar"]), [{ type: "add", value: "bar" }]);
});

test("normalizeToken applies whitespace, case, and line ending ignore rules", () => {
  assert.equal(normalizeToken("  Hello  ", { ignoreWhitespace: true }), "Hello");
  assert.equal(normalizeToken("Hello World", { ignoreCase: true }), "hello world");
  assert.equal(normalizeToken("Hello\r", { trimLineEndings: true }), "Hello");
  assert.equal(
    normalizeToken("  Hello World\r\n  ", {
      ignoreWhitespace: true,
      ignoreCase: true,
      trimLineEndings: true,
    }),
    "hello world"
  );
});

test("areTokensEqual compares tokens respecting ignore rules", () => {
  assert.equal(areTokensEqual("  test  ", "test", { ignoreWhitespace: true }), true);
  assert.equal(areTokensEqual("TEST", "test", { ignoreCase: true }), true);
  assert.equal(areTokensEqual("line\r", "line", { trimLineEndings: true }), true);
  assert.equal(areTokensEqual("foo", "bar"), false);
});

test("myersDiff respects ignore rules when matching", () => {
  const oldArr = ["Hello World", "FOO"];
  const newArr = ["hello world", "foo"];
  const diff = myersDiff(oldArr, newArr, { ignoreCase: true });

  assert.equal(diff.every((d) => d.type === "equal"), true);
});

test("inlineCharDiff highlights character-level additions and deletions", () => {
  const res = inlineCharDiff("const val = 10;", "const val = 20;");
  assert.match(res.leftHtml, /<span class="char-del">1<\/span>/);
  assert.match(res.rightHtml, /<span class="char-add">2<\/span>/);
  assert.match(res.leftHtml, /const val = /);
  assert.match(res.rightHtml, /const val = /);
});

test("inlineCharDiff escapes HTML entities", () => {
  const res = inlineCharDiff("<div>", "<span>");
  assert.match(res.leftHtml, /&lt;/);
  assert.doesNotMatch(res.leftHtml, /<div>/);
  assert.match(res.rightHtml, /&lt;/);
  assert.doesNotMatch(res.rightHtml, /<span>/);
});

test("generateUnifiedPatch produces standard git patch format", () => {
  const oldText = "line1\nline2\nline3\nline4\nline5";
  const newText = "line1\nline2 changed\nline3\nline4\nline5";
  const patch = generateUnifiedPatch(oldText, newText, {
    oldFilename: "test.txt",
    newFilename: "test.txt",
  });

  assert.match(patch, /--- a\/test\.txt/);
  assert.match(patch, /\+\+\+ b\/test\.txt/);
  assert.match(patch, /@@ -\d+,\d+ \+\d+,\d+ @@/);
  assert.match(patch, /-line2/);
  assert.match(patch, /\+line2 changed/);
  assert.match(patch, / line1/);
});

test("generateUnifiedPatch returns clean message when identical", () => {
  const patch = generateUnifiedPatch("identical\ncontent", "identical\ncontent");
  assert.equal(patch, "# No differences found. Files are identical.\n");
});
