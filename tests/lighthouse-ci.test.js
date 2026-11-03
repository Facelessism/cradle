const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const LIGHTHOUSE_CONFIG = path.join(ROOT_DIR, "lighthouserc.js");
const WORKFLOW_FILE = path.join(
  ROOT_DIR,
  ".github",
  "workflows",
  "lighthouse.yml"
);
const PACKAGE_JSON = path.join(ROOT_DIR, "package.json");
const GITIGNORE = path.join(ROOT_DIR, ".gitignore");
const PRETTIERIGNORE = path.join(ROOT_DIR, ".prettierignore");

test("Lighthouse CI: configuration file exists and exports valid CI configuration", () => {
  assert.ok(fs.existsSync(LIGHTHOUSE_CONFIG), "lighthouserc.js must exist");

  const config = require(LIGHTHOUSE_CONFIG);
  assert.ok(
    config && typeof config === "object",
    "lighthouserc.js must export an object"
  );
  assert.ok(config.ci, "Configuration must have 'ci' namespace");
  assert.ok(config.ci.collect, "Configuration must specify 'collect' settings");
  assert.equal(
    config.ci.collect.staticDistDir,
    ".",
    "collect.staticDistDir must be root"
  );
  assert.ok(
    Array.isArray(config.ci.collect.url) && config.ci.collect.url.length > 0,
    "collect.url must define audit target"
  );
  assert.ok(
    config.ci.collect.numberOfRuns >= 1,
    "collect.numberOfRuns must be at least 1"
  );
});

test("Lighthouse CI: assertion thresholds meet baseline tolerances", () => {
  const config = require(LIGHTHOUSE_CONFIG);
  assert.ok(config.ci.assert, "Configuration must specify 'assert' block");
  const assertions = config.ci.assert.assertions;
  assert.ok(assertions, "Must define assertions mapping");

  // Check category thresholds
  assert.ok(
    assertions["categories:performance"],
    "Must assert performance category"
  );
  assert.ok(
    assertions["categories:accessibility"],
    "Must assert accessibility category"
  );
  assert.ok(
    assertions["categories:best-practices"],
    "Must assert best-practices category"
  );
  assert.ok(assertions["categories:seo"], "Must assert SEO category");

  const perfThreshold = assertions["categories:performance"][1]?.minScore;
  const a11yThreshold = assertions["categories:accessibility"][1]?.minScore;
  const bpThreshold = assertions["categories:best-practices"][1]?.minScore;
  const seoThreshold = assertions["categories:seo"][1]?.minScore;

  assert.ok(
    perfThreshold >= 0.8 && perfThreshold <= 0.95,
    `Performance threshold (${perfThreshold}) reasonable`
  );
  assert.ok(
    a11yThreshold >= 0.85 && a11yThreshold <= 1.0,
    `Accessibility threshold (${a11yThreshold}) reasonable`
  );
  assert.ok(
    bpThreshold >= 0.85 && bpThreshold <= 1.0,
    `Best practices threshold (${bpThreshold}) reasonable`
  );
  assert.ok(
    seoThreshold >= 0.85 && seoThreshold <= 1.0,
    `SEO threshold (${seoThreshold}) reasonable`
  );
});

test("Lighthouse CI: output directory and artifact path configuration", () => {
  const config = require(LIGHTHOUSE_CONFIG);
  assert.ok(config.ci.upload, "Configuration must specify 'upload' block");
  assert.equal(config.ci.upload.target, "filesystem");
  assert.equal(config.ci.upload.outputDir, ".lighthouseci");

  const gitignore = fs.readFileSync(GITIGNORE, "utf-8");
  assert.ok(
    gitignore.includes(".lighthouseci"),
    ".gitignore must ignore .lighthouseci/"
  );

  const prettierignore = fs.readFileSync(PRETTIERIGNORE, "utf-8");
  assert.ok(
    prettierignore.includes(".lighthouseci"),
    ".prettierignore must ignore .lighthouseci"
  );
});

test("Lighthouse CI: GitHub Actions workflow is configured with path filters and artifact upload", () => {
  assert.ok(
    fs.existsSync(WORKFLOW_FILE),
    ".github/workflows/lighthouse.yml must exist"
  );
  const workflow = fs.readFileSync(WORKFLOW_FILE, "utf-8");

  // Verify triggers and path filters
  assert.ok(
    workflow.includes("pull_request:"),
    "Workflow triggers on pull_request"
  );
  assert.ok(workflow.includes("push:"), "Workflow triggers on push to main");
  assert.ok(
    workflow.includes("paths:"),
    "Workflow uses path filters so it doesn't slow down unrelated PRs"
  );
  assert.ok(workflow.includes("index.html"), "Path filter includes index.html");
  assert.ok(workflow.includes("style.css"), "Path filter includes style.css");
  assert.ok(workflow.includes("script.js"), "Path filter includes script.js");

  // Verify LHCI execution and artifact upload
  assert.ok(workflow.includes("@lhci/cli"), "Workflow executes @lhci/cli");
  assert.ok(
    workflow.includes("upload-artifact"),
    "Workflow uploads report as artifact"
  );
  assert.ok(
    workflow.includes(".lighthouseci"),
    "Artifact path targets .lighthouseci directory"
  );
  assert.ok(
    workflow.includes("if: always()"),
    "Artifact upload runs always (even on failure) for debugging"
  );
});

test("Lighthouse CI: npm script 'lhci' is present in package.json", () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf-8"));
  assert.ok(pkg.scripts.lhci, "package.json must contain 'lhci' script");
  assert.ok(
    pkg.scripts.lhci.includes("@lhci/cli"),
    "lhci script must invoke @lhci/cli"
  );
});
