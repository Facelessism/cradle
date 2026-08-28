const test = require("node:test");
const assert = require("node:assert/strict");
const DiffEngine = require("../projects/file-tools/file-difference-visualizer/diffEngine");

test("DiffEngine splitLines correctly breaks multi-line text", () => {
  const text = "line1\r\nline2\nline3\rline4";
  const lines = DiffEngine.splitLines(text);
  assert.deepEqual(lines, ["line1", "line2", "line3", "line4"]);
});

test("DiffEngine computeLineDiff detects identical content", () => {
  const text = "apple\nbanana\ncherry";
  const diff = DiffEngine.computeLineDiff(text, text);
  assert.equal(diff.length, 3);
  assert.ok(diff.every((item) => item.type === "equal"));
});

test("DiffEngine computeLineDiff detects additions and deletions", () => {
  const textA = "apple\nbanana";
  const textB = "apple\norange\nbanana";
  const diff = DiffEngine.computeLineDiff(textA, textB);
  
  const stats = DiffEngine.computeDiffStats(diff);
  assert.equal(stats.additions, 1);
  assert.equal(stats.deletions, 0);
  assert.equal(stats.unchanged, 2);
});

test("DiffEngine computeLineDiff respects ignoreWhitespace option", () => {
  const textA = "  apple  \nbanana";
  const textB = "apple\n  banana  ";
  
  const diffNormal = DiffEngine.computeLineDiff(textA, textB, { ignoreWhitespace: false });
  const statsNormal = DiffEngine.computeDiffStats(diffNormal);
  assert.ok(statsNormal.totalChanges > 0);

  const diffIgnore = DiffEngine.computeLineDiff(textA, textB, { ignoreWhitespace: true });
  const statsIgnore = DiffEngine.computeDiffStats(diffIgnore);
  assert.equal(statsIgnore.totalChanges, 0);
});

test("DiffEngine generateUnifiedPatch outputs valid git patch format", () => {
  const textA = "const x = 1;\nconsole.log(x);";
  const textB = "const x = 2;\nconsole.log(x);";
  const diff = DiffEngine.computeLineDiff(textA, textB);
  const patch = DiffEngine.generateUnifiedPatch("old.js", "new.js", diff);

  assert.ok(patch.includes("--- old.js"));
  assert.ok(patch.includes("+++ new.js"));
  assert.ok(patch.includes("-const x = 1;"));
  assert.ok(patch.includes("+const x = 2;"));
});

test("DiffEngine SIZE_LIMITS has expected defaults", () => {
  assert.ok(DiffEngine.SIZE_LIMITS.maxLines > 0);
  assert.ok(DiffEngine.SIZE_LIMITS.maxFileSize > 0);
  assert.ok(DiffEngine.SIZE_LIMITS.maxCharCount > 0);
});

test("DiffEngine computeLineDiff rejects inputs exceeding maxLines", () => {
  const bigA = Array.from({ length: 30000 }, (_, i) => `line-a-${i}`).join("\n");
  const bigB = Array.from({ length: 30000 }, (_, i) => `line-b-${i}`).join("\n");

  const result = DiffEngine.computeLineDiff(bigA, bigB, { maxLines: 50000 });
  assert.ok(result.error, "should return error for oversized input");
  assert.ok(result.message.includes("too large"));
});

test("DiffEngine computeLineDiff respects custom maxLines option", () => {
  const textA = "a\nb\nc";
  const textB = "a\nb\nd";

  // 3 lines total, limit of 2 — should reject
  const result = DiffEngine.computeLineDiff(textA, textB, { maxLines: 2 });
  assert.ok(result.error, "should reject when total lines exceed custom limit");
});

test("DiffEngine computeLineDiff accepts inputs within limits", () => {
  const textA = "apple\nbanana";
  const textB = "apple\norange";

  const result = DiffEngine.computeLineDiff(textA, textB);
  assert.ok(!result.error, "should not error for small input");
  assert.ok(Array.isArray(result), "should return alignment array");
});
