const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  findMissingArchitectureDocs,
  formatRelativePaths,
  getProjectDirectories,
  getRequiredSections,
  hasTemplateNoticeBlock,
  validateArchitectureStructure,
} = require("../scripts/validate-architecture-docs");

// ---------------------------------------------------------------------------
// getProjectDirectories
// ---------------------------------------------------------------------------

test("getProjectDirectories finds mini projects two levels under projects", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-architecture-")
  );
  const alpha = path.join(root, "games", "alpha-game");
  const beta = path.join(root, "math", "beta-tool");

  fs.mkdirSync(alpha, { recursive: true });
  fs.mkdirSync(beta, { recursive: true });
  fs.writeFileSync(path.join(root, "README.md"), "not a category");

  const projects = getProjectDirectories(root).map(projectDir =>
    path.relative(root, projectDir).replace(/\\/g, "/")
  );

  assert.deepEqual(projects, ["games/alpha-game", "math/beta-tool"]);
});

// ---------------------------------------------------------------------------
// findMissingArchitectureDocs
// ---------------------------------------------------------------------------

test("findMissingArchitectureDocs flags missing and empty architecture files", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-architecture-")
  );
  const valid = path.join(root, "valid-mini");
  const missing = path.join(root, "missing-mini");
  const empty = path.join(root, "empty-mini");

  fs.mkdirSync(valid, { recursive: true });
  fs.mkdirSync(missing, { recursive: true });
  fs.mkdirSync(empty, { recursive: true });
  fs.writeFileSync(path.join(valid, "ARCHITECTURE.md"), "# Architecture\n");
  fs.writeFileSync(path.join(empty, "ARCHITECTURE.md"), "   \n");

  const missingDocs = findMissingArchitectureDocs([valid, missing, empty]).map(
    projectDir => path.basename(projectDir)
  );

  assert.deepEqual(missingDocs, ["missing-mini", "empty-mini"]);
});

// ---------------------------------------------------------------------------
// formatRelativePaths
// ---------------------------------------------------------------------------

test("formatRelativePaths emits POSIX-style repo-relative paths", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const paths = [
    path.join(repoRoot, "projects", "math", "graph-theory-explorer"),
  ];

  assert.deepEqual(formatRelativePaths(paths), [
    "projects/math/graph-theory-explorer",
  ]);
});

// ---------------------------------------------------------------------------
// getRequiredSections
// ---------------------------------------------------------------------------

test("getRequiredSections returns all ## headings from the template", () => {
  const sections = getRequiredSections();

  assert.ok(Array.isArray(sections), "should return an array");
  assert.ok(sections.length > 0, "should find at least one section");

  // Spot-check a few headings that must exist in the template
  assert.ok(
    sections.includes("## Overview"),
    'should include "## Overview"'
  );
  assert.ok(
    sections.includes("## Dependencies"),
    'should include "## Dependencies"'
  );
  assert.ok(
    sections.includes("## Future Improvements"),
    'should include "## Future Improvements"'
  );

  // Every entry must start with "## "
  for (const s of sections) {
    assert.match(s, /^## /, `section "${s}" must start with "## "`);
  }
});

test("getRequiredSections reads headings from a custom template file", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-template-"));
  const templatePath = path.join(tmpDir, "ARCHITECTURE_TEMPLATE.md");

  fs.writeFileSync(
    templatePath,
    [
      "# Project Architecture",
      "",
      "## Overview",
      "",
      "<!-- placeholder -->",
      "",
      "## Dependencies",
      "",
      "<!-- placeholder -->",
    ].join("\n")
  );

  const sections = getRequiredSections(templatePath);
  assert.deepEqual(sections, ["## Overview", "## Dependencies"]);
});

test("getRequiredSections throws when the template file does not exist", () => {
  assert.throws(
    () => getRequiredSections("/nonexistent/path/ARCHITECTURE_TEMPLATE.md"),
    /Architecture template not found/
  );
});

// ---------------------------------------------------------------------------
// hasTemplateNoticeBlock
// ---------------------------------------------------------------------------

test("hasTemplateNoticeBlock returns true when the notice block is present", () => {
  const content = [
    "# Project Architecture",
    "",
    "> **This is the standardized ARCHITECTURE.md template for the Cradle repository.**",
    "> Copy this file…",
    "",
    "## Overview",
    "some text",
  ].join("\n");

  assert.equal(hasTemplateNoticeBlock(content), true);
});

test("hasTemplateNoticeBlock returns false when the notice block has been removed", () => {
  const content = [
    "# Project Architecture",
    "",
    "## Overview",
    "Snake Game is a classic arcade game…",
    "",
    "## Dependencies",
    "None.",
  ].join("\n");

  assert.equal(hasTemplateNoticeBlock(content), false);
});

// ---------------------------------------------------------------------------
// validateArchitectureStructure
// ---------------------------------------------------------------------------

test("validateArchitectureStructure passes when all required sections are present", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-arch-struct-")
  );
  const projectDir = path.join(root, "good-mini");
  fs.mkdirSync(projectDir, { recursive: true });

  const requiredSections = ["## Overview", "## Dependencies"];
  const content = [
    "# Project Architecture",
    "",
    "## Overview",
    "A great project.",
    "",
    "## Dependencies",
    "None.",
  ].join("\n");

  fs.writeFileSync(path.join(projectDir, "ARCHITECTURE.md"), content);

  const issues = validateArchitectureStructure([projectDir], requiredSections);
  assert.deepEqual(issues, []);
});

test("validateArchitectureStructure reports missing sections", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-arch-struct-")
  );
  const projectDir = path.join(root, "incomplete-mini");
  fs.mkdirSync(projectDir, { recursive: true });

  const requiredSections = [
    "## Overview",
    "## Dependencies",
    "## Future Improvements",
  ];
  const content = [
    "# Project Architecture",
    "",
    "## Overview",
    "A great project.",
    // "## Dependencies" is intentionally absent
    // "## Future Improvements" is intentionally absent
  ].join("\n");

  fs.writeFileSync(path.join(projectDir, "ARCHITECTURE.md"), content);

  const issues = validateArchitectureStructure([projectDir], requiredSections);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].projectDir, projectDir);
  assert.deepEqual(issues[0].missingSections, [
    "## Dependencies",
    "## Future Improvements",
  ]);
  assert.equal(issues[0].hasNoticeBlock, false);
});

test("validateArchitectureStructure reports un-removed template notice block", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-arch-struct-")
  );
  const projectDir = path.join(root, "notice-mini");
  fs.mkdirSync(projectDir, { recursive: true });

  const requiredSections = ["## Overview"];
  const content = [
    "# Project Architecture",
    "",
    "> **This is the standardized ARCHITECTURE.md template for the Cradle repository.**",
    "",
    "## Overview",
    "Some content.",
  ].join("\n");

  fs.writeFileSync(path.join(projectDir, "ARCHITECTURE.md"), content);

  const issues = validateArchitectureStructure([projectDir], requiredSections);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].hasNoticeBlock, true);
  assert.deepEqual(issues[0].missingSections, []);
});

test("validateArchitectureStructure skips projects without ARCHITECTURE.md", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-arch-struct-")
  );
  const projectDir = path.join(root, "no-arch-mini");
  fs.mkdirSync(projectDir, { recursive: true });
  // No ARCHITECTURE.md created — should be silently skipped

  const issues = validateArchitectureStructure([projectDir], ["## Overview"]);
  assert.deepEqual(issues, []);
});

test("validateArchitectureStructure skips empty ARCHITECTURE.md files", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-arch-struct-")
  );
  const projectDir = path.join(root, "empty-mini");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, "ARCHITECTURE.md"), "   \n");

  const issues = validateArchitectureStructure([projectDir], ["## Overview"]);
  assert.deepEqual(issues, []);
});

// ---------------------------------------------------------------------------
// Integration: validateArchitectureStructure works correctly against real projects
// ---------------------------------------------------------------------------

test("validateArchitectureStructure returns an array when run against real projects", () => {
  const {
    getProjectDirectories: getRealDirs,
    findMissingArchitectureDocs: findMissing,
    validateArchitectureStructure: validate,
    getRequiredSections: getSections,
  } = require("../scripts/validate-architecture-docs");

  const allDirs = getRealDirs();
  const missingDirs = findMissing(allDirs);
  const presentDirs = allDirs.filter(d => !missingDirs.includes(d));
  const requiredSections = getSections();

  const issues = validate(presentDirs, requiredSections);

  // Result must always be an array
  assert.ok(Array.isArray(issues), "validateArchitectureStructure must return an array");

  // Every issue must have the expected shape
  for (const issue of issues) {
    assert.ok(
      typeof issue.projectDir === "string",
      "each issue must have a projectDir string"
    );
    assert.ok(
      Array.isArray(issue.missingSections),
      "each issue must have a missingSections array"
    );
    assert.ok(
      typeof issue.hasNoticeBlock === "boolean",
      "each issue must have a hasNoticeBlock boolean"
    );
    // Every missing section must start with "## "
    for (const section of issue.missingSections) {
      assert.match(section, /^## /, `missing section "${section}" must start with "## "`);
    }
  }
});

// ---------------------------------------------------------------------------
// Issue #305: Redundant README.md next to ARCHITECTURE.md
// ---------------------------------------------------------------------------

/**
 * Returns the absolute paths of every mini project directory under the
 * repo's projects/ tree. Reused here so this test stays in sync with the
 * production discovery logic in scripts/validate-architecture-docs.js.
 */
function listAllProjectDirectories() {
  const projectsRoot = path.resolve(__dirname, "..", "projects");
  const result = [];

  for (const category of fs.readdirSync(projectsRoot, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryPath = path.join(projectsRoot, category.name);
    for (const mini of fs.readdirSync(categoryPath, { withFileTypes: true })) {
      if (!mini.isDirectory()) continue;
      result.push(path.join(categoryPath, mini.name));
    }
  }

  return result.sort();
}

test("Issue #305: no mini project has both a README.md and an ARCHITECTURE.md", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const offenders = [];

  for (const projectDir of listAllProjectDirectories()) {
    const hasReadme = fs.existsSync(path.join(projectDir, "README.md"));
    const hasArchitecture = fs.existsSync(path.join(projectDir, "ARCHITECTURE.md"));

    if (hasReadme && hasArchitecture) {
      offenders.push(path.relative(repoRoot, projectDir).replace(/\\/g, "/"));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "Mini projects should keep a single ARCHITECTURE.md and not also " +
      "carry a README.md. Offending projects:\n  " +
      offenders.join("\n  ")
  );
});

// ---------------------------------------------------------------------------
// File Reference Validation Tests
// ---------------------------------------------------------------------------

test("validateArchitectureStructure flags nonexistent file references", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-arch-file-refs-")
  );
  const projectDir = path.join(root, "broken-refs-mini");
  fs.mkdirSync(projectDir, { recursive: true });

  const requiredSections = ["## Overview"];
  const content = [
    "# Project Architecture",
    "",
    "## Overview",
    "We use [index.html](index.html) and [missing.js](missing.js).",
    "Check <a href=\"nonexistent.css\">style</a>.",
    "Ignore [Google](https://google.com) and [Anchor](#overview).",
  ].join("\n");

  fs.writeFileSync(path.join(projectDir, "index.html"), "<html></html>");
  fs.writeFileSync(path.join(projectDir, "ARCHITECTURE.md"), content);

  const issues = validateArchitectureStructure([projectDir], requiredSections);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].projectDir, projectDir);
  assert.equal(issues[0].brokenReferences.length, 2);
  assert.equal(issues[0].brokenReferences[0].target, "missing.js");
  assert.equal(issues[0].brokenReferences[0].lineNumber, 4);
  assert.equal(issues[0].brokenReferences[1].target, "nonexistent.css");
  assert.equal(issues[0].brokenReferences[1].lineNumber, 5);
});

test("validateArchitectureStructure passes when all local file references exist on disk", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-arch-valid-refs-")
  );
  const projectDir = path.join(root, "valid-refs-mini");
  fs.mkdirSync(projectDir, { recursive: true });

  const requiredSections = ["## Overview"];
  const content = [
    "# Project Architecture",
    "",
    "## Overview",
    "Source: [script.js](script.js), stylesheet: [style.css](style.css).",
    "HTML entry: <a href=\"index.html\">index.html</a>.",
    "External links are ignored: [MDN](https://developer.mozilla.org) and [#top](#top).",
  ].join("\n");

  fs.writeFileSync(path.join(projectDir, "script.js"), "console.log('hi');");
  fs.writeFileSync(path.join(projectDir, "style.css"), "body {}");
  fs.writeFileSync(path.join(projectDir, "index.html"), "<html></html>");
  fs.writeFileSync(path.join(projectDir, "ARCHITECTURE.md"), content);

  const issues = validateArchitectureStructure([projectDir], requiredSections);

  assert.deepEqual(issues, []);
});

test("validateArchitectureStructure flags broken img src and script src HTML attributes", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-arch-html-attrs-")
  );
  const projectDir = path.join(root, "html-attrs-mini");
  fs.mkdirSync(projectDir, { recursive: true });

  const requiredSections = ["## Overview"];
  const content = [
    "# Project Architecture",
    "",
    "## Overview",
    "Embed: <img src=\"missing-icon.png\" alt=\"icon\" />.",
    "Script: <script src=\"missing-lib.js\"></script>.",
    "Valid: <img src=\"logo.svg\" alt=\"logo\" />.",
  ].join("\n");

  // Only logo.svg exists — missing-icon.png and missing-lib.js do not.
  fs.writeFileSync(path.join(projectDir, "logo.svg"), "<svg></svg>");
  fs.writeFileSync(path.join(projectDir, "ARCHITECTURE.md"), content);

  const issues = validateArchitectureStructure([projectDir], requiredSections);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].projectDir, projectDir);
  assert.equal(issues[0].brokenReferences.length, 2);
  assert.equal(issues[0].brokenReferences[0].target, "missing-icon.png");
  assert.equal(issues[0].brokenReferences[0].lineNumber, 4);
  assert.equal(issues[0].brokenReferences[1].target, "missing-lib.js");
  assert.equal(issues[0].brokenReferences[1].lineNumber, 5);
});

test("validateArchitectureStructure reports broken references only for the affected project", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-arch-multi-")
  );
  const cleanDir = path.join(root, "clean-mini");
  const brokenDir = path.join(root, "broken-mini");
  fs.mkdirSync(cleanDir, { recursive: true });
  fs.mkdirSync(brokenDir, { recursive: true });

  const requiredSections = ["## Overview"];

  // Clean project — all references resolve.
  const cleanContent = [
    "# Project Architecture",
    "",
    "## Overview",
    "Uses [script.js](script.js).",
  ].join("\n");
  fs.writeFileSync(path.join(cleanDir, "script.js"), "");
  fs.writeFileSync(path.join(cleanDir, "ARCHITECTURE.md"), cleanContent);

  // Broken project — script.js is referenced but absent.
  const brokenContent = [
    "# Project Architecture",
    "",
    "## Overview",
    "Uses [script.js](script.js) and <img src=\"thumbnail.png\" />.",
  ].join("\n");
  fs.writeFileSync(path.join(brokenDir, "ARCHITECTURE.md"), brokenContent);
  // Neither script.js nor thumbnail.png is created in brokenDir.

  const issues = validateArchitectureStructure(
    [cleanDir, brokenDir],
    requiredSections
  );

  assert.equal(issues.length, 1, "only the broken project should produce an issue");
  assert.equal(issues[0].projectDir, brokenDir);
  assert.equal(issues[0].brokenReferences.length, 2);
  assert.equal(issues[0].brokenReferences[0].target, "script.js");
  assert.equal(issues[0].brokenReferences[1].target, "thumbnail.png");
});

test("validateArchitectureStructure ignores external URLs while flagging missing local assets", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-arch-ext-vs-local-")
  );
  const projectDir = path.join(root, "mixed-refs-mini");
  fs.mkdirSync(projectDir, { recursive: true });

  const requiredSections = ["## Overview"];
  const content = [
    "# Project Architecture",
    "",
    "## Overview",
    "CDN: <script src=\"https://cdn.example.com/lib.js\"></script>",
    "Mail: <a href=\"mailto:dev@example.com\">Contact</a>",
    "Data URI: <img src=\"data:image/png;base64,abc\" />",
    "Protocol-relative: <script src=\"//unpkg.com/pkg\"></script>",
    "Local missing: <script src=\"app.js\"></script>",
  ].join("\n");

  fs.writeFileSync(path.join(projectDir, "ARCHITECTURE.md"), content);
  // app.js is deliberately not created.

  const issues = validateArchitectureStructure([projectDir], requiredSections);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].brokenReferences.length, 1,
    "only the local missing asset should be flagged, not external URLs");
  assert.equal(issues[0].brokenReferences[0].target, "app.js");
});