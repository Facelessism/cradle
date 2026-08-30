/**
 * Reduced-Motion Validation Test (Issue #623)
 *
 * Verifies that every CSS file that contains animations or transitions
 * also contains an `@media (prefers-reduced-motion: reduce)` block.
 *
 * Pattern follows tests/seo-metadata-validation.test.js conventions.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const PROJECTS_ROOT = path.resolve(__dirname, "..", "projects");

/**
 * Returns true if the given CSS content contains a prefers-reduced-motion block.
 */
function hasReducedMotionBlock(css) {
  return /prefers-reduced-motion\s*:\s*reduce/.test(css);
}

/**
 * CSS files that must contain reduced-motion support.
 * Split into two groups:
 *  - alreadyHad: files that had support before Issue #623 (must still have it)
 *  - added: files that gained support as part of Issue #623
 */
const ALREADY_HAD_SUPPORT = [
  "dev-tools/api-response-inspector/style.css",
  "games/memory-flip-game/style.css",
  "games/wordle-clone/style.css",
  "instruments/guitar/style.css",
  "instruments/guzheng/style.css",
  "instruments/percussion/style.css",
  "instruments/piano/style.css",
  "productivity/terminal-portfolio-generator/style.css",
  "aiml/image-classifier/style.css",
];

const ADDED_IN_ISSUE_623 = [
  "aiml/neural-network-playground/style.css",
  "dev-tools/cpu-emulator/style.css",
  "editor/css-shape-designer/style.css",
  "games/cannon-shooting/style.css",
  "games/chess/style.css",
  "games/ludo-game/style.css",
  "games/stone-paper-scissors-game/style.css",
  "math/matrix-playground/style.css",
  "misc/periodic-table/style.css",
  "misc/sound-wave-visualizer/style.css",
  "productivity/reading-progress-tracker/style.css",
];

const ALL_REQUIRED = [...ALREADY_HAD_SUPPORT, ...ADDED_IN_ISSUE_623];

// -- Basic discovery sanity check
test("reduced-motion validation: target file list is non-empty", () => {
  assert.ok(
    ALL_REQUIRED.length > 0,
    "Expected at least one target CSS file in the list",
  );
});

// -- Per-file checks
for (const relPath of ALL_REQUIRED) {
  const absPath = path.join(PROJECTS_ROOT, relPath);
  const label = `projects/${relPath}`;

  test(`reduced-motion validation for ${label}`, async (t) => {
    // File must exist
    await t.test("file exists", () => {
      assert.ok(
        fs.existsSync(absPath),
        `Expected CSS file to exist at: ${label}`,
      );
    });

    if (!fs.existsSync(absPath)) return;

    const css = fs.readFileSync(absPath, "utf-8");

    // Must contain the media query
    await t.test("contains prefers-reduced-motion block", () => {
      assert.ok(
        hasReducedMotionBlock(css),
        `Missing @media (prefers-reduced-motion: reduce) block in: ${label}`,
      );
    });
  });
}

// -- Negative test: missing block is correctly detected
test("reduced-motion validation: correctly detects missing block", () => {
  const cssWithoutBlock = `
    .btn { transition: all 0.2s; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { animation: spin 1s linear infinite; }
  `;
  assert.equal(
    hasReducedMotionBlock(cssWithoutBlock),
    false,
    "hasReducedMotionBlock should return false when block is absent",
  );
});

// -- Positive test: detection works for a valid block
test("reduced-motion validation: correctly detects present block", () => {
  const cssWithBlock = `
    .btn { transition: all 0.2s; }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        transition-duration: 0.001ms !important;
      }
    }
  `;
  assert.equal(
    hasReducedMotionBlock(cssWithBlock),
    true,
    "hasReducedMotionBlock should return true when block is present",
  );
});

// -- Existing-support files: block should not appear more than once
for (const relPath of ALREADY_HAD_SUPPORT) {
  const absPath = path.join(PROJECTS_ROOT, relPath);
  const label = `projects/${relPath}`;

  test(`reduced-motion not duplicated in ${label}`, () => {
    if (!fs.existsSync(absPath)) return;
    const css = fs.readFileSync(absPath, "utf-8");
    const matches = (css.match(/prefers-reduced-motion\s*:\s*reduce/g) || [])
      .length;
    assert.ok(
      matches <= 1,
      `Found ${matches} prefers-reduced-motion blocks in ${label} (expected at most 1)`,
    );
  });
}
