const test = require("node:test");
const assert = require("node:assert/strict");
const { escapeHtml } = require("../src/components/ui/escapeHtml.js");

test("escapeHtml escapes all five special characters", () => {
  assert.equal(
    escapeHtml('<script>alert("XSS & Test")</script>'),
    "&lt;script&gt;alert(&quot;XSS &amp; Test&quot;)&lt;/script&gt;"
  );
  assert.equal(escapeHtml("John's Chip"), "John&#039;s Chip");
});

test("escapeHtml leaves plain text untouched", () => {
  assert.equal(escapeHtml("Normal Text"), "Normal Text");
  assert.equal(escapeHtml(""), "");
});

test("escapeHtml treats null and undefined as empty string", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("escapeHtml coerces non-string values via String()", () => {
  assert.equal(escapeHtml(42), "42");
  assert.equal(escapeHtml(0), "0");
  assert.equal(escapeHtml(true), "true");
});

test("escapeHtml escapes already-escaped HTML entities", () => {
  assert.equal(escapeHtml("&amp;"), "&amp;amp;");
  assert.equal(escapeHtml("&lt;script&gt;"), "&amp;lt;script&amp;gt;");
});
