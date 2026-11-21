import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const lhciConfigPath = path.join(rootDir, ".lighthouserc.json");
const workflowPath = path.join(rootDir, ".github", "workflows", "lighthouse.yml");

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
});