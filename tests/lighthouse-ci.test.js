import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const lhciConfigPath = path.join(rootDir, ".lighthouserc.json");
const workflowPath = path.join(
  rootDir,
  ".github",
  "workflows",
  "lighthouse.yml"
);

describe("Lighthouse CI Quality Gates Configuration", () => {
  it("defines valid JSON configuration in .lighthouserc.json", () => {
    assert.ok(fs.existsSync(lhciConfigPath), ".lighthouserc.json must exist");
    const raw = fs.readFileSync(lhciConfigPath, "utf8");
    const config = JSON.parse(raw);

    assert.ok(config.ci, "Expected root 'ci' object");
    assert.equal(config.ci.collect?.staticDistDir, ".");
    assert.ok(
      Array.isArray(config.ci.collect?.url) && config.ci.collect.url.length > 0,
      "Expected at least one target URL in ci.collect.url"
    );
  });

  it("enforces error-level thresholds for Performance, Accessibility, Best Practices, and SEO", () => {
    const config = JSON.parse(fs.readFileSync(lhciConfigPath, "utf8"));
    const assertions = config.ci?.assert?.assertions || {};

    const requiredCategories = [
      ["categories:performance", 0.9],
      ["categories:accessibility", 0.95],
      ["categories:best-practices", 0.95],
      ["categories:seo", 0.9],
    ];

    for (const [key, expectedMin] of requiredCategories) {
      assert.ok(Array.isArray(assertions[key]), `Missing assertion for ${key}`);
      const [severity, options] = assertions[key];
      assert.equal(
        severity,
        "error",
        `Expected ${key} assertion severity to be 'error' so CI fails on regression`
      );
      assert.ok(
        options.minScore >= expectedMin,
        `Expected ${key} minScore >= ${expectedMin}, got ${options.minScore}`
      );
    }
  });

  it("configures GitHub Actions workflow to run lhci and upload artifacts", () => {
    assert.ok(
      fs.existsSync(workflowPath),
      ".github/workflows/lighthouse.yml must exist"
    );
    const workflow = fs.readFileSync(workflowPath, "utf8");

    assert.match(workflow, /npm run lhci/);
    assert.match(workflow, /actions\/upload-artifact@v4/);
    assert.match(workflow, /\.lighthouseci\//);
  });
  it("uses the same scoped path filters for push and pull requests", () => {
    const workflow = fs.readFileSync(workflowPath, "utf8");

    // Both triggers must use the same path filter.
    assert.match(
      workflow,
      /push:\s*\n\s+branches:\s*\n\s+-\s+main\s*\n\s+paths:\s*&lighthouse_paths/
    );

    assert.match(
      workflow,
      /pull_request:\s*\n\s+branches:\s*\n\s+-\s+main\s*\n\s+paths:\s+\*lighthouse_paths/
    );

    // Extract the shared path filter.
    const match = workflow.match(
      /paths:\s*&lighthouse_paths\s*\n([\s\S]*?)\n\s*pull_request:/
    );

    assert.ok(match, "Shared Lighthouse path filter must exist");

    const paths = [...match[1].matchAll(/^\s*-\s*"([^"]+)"\s*$/gm)].map(
      item => item[1]
    );

    // Important landing-page and audited project files must trigger Lighthouse.
    const requiredPaths = [
      "index.html",
      "style.css",
      "script.js",
      "sw.js",
      "manifest.json",
      "manifest.webmanifest",
      "assets/**",
      "src/**",
      "client/**",
      "data/projects.json",
      "projects/productivity/advanced-qr-code-generator/**",
      "projects/dev-tools/json-tree-viewer/**",
      "projects/games/2048-game/**",
    ];

    for (const requiredPath of requiredPaths) {
      assert.ok(
        paths.includes(requiredPath),
        `Missing Lighthouse path filter: ${requiredPath}`
      );
    }

    // Broad patterns must not trigger audits for unrelated changes.
    const unrelatedPaths = [
      "**",
      "**/*",
      "README.md",
      "docs/**",
      "tests/**",
      "projects/**",
    ];

    for (const unrelatedPath of unrelatedPaths) {
      assert.ok(
        !paths.includes(unrelatedPath),
        `Unrelated path must not trigger Lighthouse: ${unrelatedPath}`
      );
    }
  });
});
