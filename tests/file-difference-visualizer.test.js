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

// Issue #702: Protective Size & Line Threshold Tests

test("DiffEngine.validateInputSize accepts inputs below default limits", () => {
  const textA = "a".repeat(100);
  const textB = "b".repeat(100);
  const res = DiffEngine.validateInputSize(textA, textB);

  assert.equal(res.valid, true);
  assert.equal(res.error, null);
});

test("DiffEngine.validateInputSize accepts inputs exactly at configured limit", () => {
  const textA = "hello"; // 5 bytes
  const textB = "world"; // 5 bytes
  const res = DiffEngine.validateInputSize(textA, textB, { maxSizeBytes: 5, maxLines: 10 });

  assert.equal(res.valid, true);
  assert.equal(res.error, null);
});

test("DiffEngine.validateInputSize rejects when file A byte size exceeds limit", () => {
  const textA = "a".repeat(100);
  const textB = "small";
  const res = DiffEngine.validateInputSize(textA, textB, { maxSizeBytes: 50 });

  assert.equal(res.valid, false);
  assert.equal(res.exceededLimit, "size");
  assert.equal(res.file, "A");
  assert.match(res.error, /Original file \(A\) size/);
  assert.match(res.error, /exceeds maximum limit/);
});

test("DiffEngine.validateInputSize rejects when file B byte size exceeds limit even if file A is small", () => {
  const textA = "small";
  const textB = "b".repeat(100);
  const res = DiffEngine.validateInputSize(textA, textB, { maxSizeBytes: 50 });

  assert.equal(res.valid, false);
  assert.equal(res.exceededLimit, "size");
  assert.equal(res.file, "B");
  assert.match(res.error, /Modified file \(B\) size/);
  assert.match(res.error, /exceeds maximum limit/);
});

test("DiffEngine.validateInputSize rejects when line count exceeds maxLines for file A", () => {
  const textA = Array(15).fill("line").join("\n");
  const textB = "single line";
  const res = DiffEngine.validateInputSize(textA, textB, { maxLines: 10 });

  assert.equal(res.valid, false);
  assert.equal(res.exceededLimit, "lines");
  assert.equal(res.file, "A");
  assert.match(res.error, /Original file \(A\) line count \(15\) exceeds maximum limit of 10 lines/);
});

test("DiffEngine.validateInputSize rejects when line count exceeds maxLines for file B", () => {
  const textA = "single line";
  const textB = Array(15).fill("line").join("\n");
  const res = DiffEngine.validateInputSize(textA, textB, { maxLines: 10 });

  assert.equal(res.valid, false);
  assert.equal(res.exceededLimit, "lines");
  assert.equal(res.file, "B");
  assert.match(res.error, /Modified file \(B\) line count \(15\) exceeds maximum limit of 10 lines/);
});

test("DiffEngine.computeLineDiff rejects oversized input without producing diff output", () => {
  const textA = "a".repeat(200);
  const textB = "b".repeat(10);
  const diff = DiffEngine.computeLineDiff(textA, textB, { maxSizeBytes: 100 });

  assert.equal(diff.length, 0);
  assert.ok(diff.error);
  assert.match(diff.error, /exceeds maximum limit/);
});

test("DiffEngine.computeDiffStats and generateUnifiedPatch handle rejected diff error safely", () => {
  const textA = Array(20).fill("line").join("\n");
  const textB = "line";
  const diff = DiffEngine.computeLineDiff(textA, textB, { maxLines: 5 });

  const stats = DiffEngine.computeDiffStats(diff);
  assert.equal(stats.totalChanges, 0);
  assert.equal(stats.totalLines, 0);
  assert.ok(stats.error);

  const patch = DiffEngine.generateUnifiedPatch("fileA.txt", "fileB.txt", diff);
  assert.match(patch, /# Error generating patch/);
});

