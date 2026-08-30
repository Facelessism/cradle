const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const STYLESHEET_PATH = path.join(__dirname, "../src/styles/accessibility.css");

test("accessibility.css stylesheet exists and includes WCAG focus indicators", () => {
  assert.ok(fs.existsSync(STYLESHEET_PATH), "src/styles/accessibility.css must exist");
  const cssContent = fs.readFileSync(STYLESHEET_PATH, "utf8");

  assert.match(cssContent, /:focus-visible/, "Includes :focus-visible rules for keyboard navigation");
  assert.match(cssContent, /outline:\s*3px\s+solid\s+#F59E0B/, "Includes dual-layer high-contrast boundary ring outline");
  assert.match(cssContent, /forced-colors:\s*active/, "Includes Windows forced-colors high contrast mode media query");
  assert.match(cssContent, /Highlight/, "Uses Highlight system color in forced-colors mode");
});
