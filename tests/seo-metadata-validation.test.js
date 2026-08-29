const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { getDiskProjects } = require("../scripts/validate-mini-projects");

const BASE_URL = "https://facelessism.github.io/cradle/";

/**
 * Extract the content attribute value from a meta tag with the given property.
 * Returns an array of all matches (to detect duplicates).
 */
function getMetaPropertyValues(html, property) {
  const regex = new RegExp(
    `<meta\\s+[^>]*property=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["'][^>]*/?>|` +
    `<meta\\s+[^>]*content=["']([^"']*)["'][^>]*property=["']${escapeRegex(property)}["'][^>]*/?>`,
    "gi",
  );
  const values = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    values.push(match[1] ?? match[2]);
  }
  return values;
}

/**
 * Extract all canonical link href values.
 * Returns an array of all matches (to detect duplicates).
 */
function getCanonicalValues(html) {
  const regex =
    /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*\/?>|<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["'][^>]*\/?>/gi;
  const values = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    values.push(match[1] ?? match[2]);
  }
  return values;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAbsoluteUrl(url) {
  return /^https?:\/\//.test(url);
}

function isLocalhostUrl(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(url);
}

const diskProjects = getDiskProjects();

test("SEO metadata validation discovers mini projects", () => {
  assert.ok(
    diskProjects.length > 0,
    "Expected to discover at least one mini project on disk",
  );
});

for (const project of diskProjects) {
  const indexPath = path.join(project.absPath, "index.html");
  const relIndexPath = `${project.relPath}index.html`;

  test(`SEO metadata validation for ${relIndexPath}`, async (t) => {
    // ── File must exist ──────────────────────────────────────
    const exists = fs.existsSync(indexPath);
    assert.ok(exists, `index.html does not exist at ${relIndexPath}`);
    if (!exists) return;

    const html = fs.readFileSync(indexPath, "utf-8");
    const missing = [];
    const issues = [];

    // ── Must have a <head> section ───────────────────────────
    const hasHead = /<head[\s>]/i.test(html);
    if (!hasHead) {
      issues.push("Missing <head> section");
    }

    // ── Canonical link ───────────────────────────────────────
    const canonicals = getCanonicalValues(html);

    await t.test("canonical link exists", () => {
      if (canonicals.length === 0) missing.push("canonical");
      assert.ok(
        canonicals.length > 0,
        `Missing <link rel="canonical"> in ${relIndexPath}`,
      );
    });

    await t.test("no duplicate canonical tags", () => {
      assert.ok(
        canonicals.length <= 1,
        `Found ${canonicals.length} canonical tags in ${relIndexPath} (expected at most 1)`,
      );
    });

    if (canonicals.length === 1) {
      await t.test("canonical URL is not empty", () => {
        assert.ok(
          canonicals[0].trim().length > 0,
          `Canonical URL is empty in ${relIndexPath}`,
        );
      });

      await t.test("canonical URL is absolute", () => {
        assert.ok(
          isAbsoluteUrl(canonicals[0]),
          `Canonical URL "${canonicals[0]}" is not an absolute URL in ${relIndexPath}`,
        );
      });

      await t.test("canonical URL is not localhost", () => {
        assert.ok(
          !isLocalhostUrl(canonicals[0]),
          `Canonical URL "${canonicals[0]}" points to localhost in ${relIndexPath}`,
        );
      });
    }

    // ── og:title ─────────────────────────────────────────────
    const ogTitles = getMetaPropertyValues(html, "og:title");

    await t.test("og:title exists", () => {
      if (ogTitles.length === 0) missing.push("og:title");
      assert.ok(
        ogTitles.length > 0,
        `Missing <meta property="og:title"> in ${relIndexPath}`,
      );
    });

    await t.test("no duplicate og:title", () => {
      assert.ok(
        ogTitles.length <= 1,
        `Found ${ogTitles.length} og:title tags in ${relIndexPath} (expected at most 1)`,
      );
    });

    if (ogTitles.length === 1) {
      await t.test("og:title is not empty", () => {
        assert.ok(
          ogTitles[0].trim().length > 0,
          `og:title content is empty in ${relIndexPath}`,
        );
      });
    }

    // ── og:description ───────────────────────────────────────
    const ogDescs = getMetaPropertyValues(html, "og:description");

    await t.test("og:description exists", () => {
      if (ogDescs.length === 0) missing.push("og:description");
      assert.ok(
        ogDescs.length > 0,
        `Missing <meta property="og:description"> in ${relIndexPath}`,
      );
    });

    await t.test("no duplicate og:description", () => {
      assert.ok(
        ogDescs.length <= 1,
        `Found ${ogDescs.length} og:description tags in ${relIndexPath} (expected at most 1)`,
      );
    });

    if (ogDescs.length === 1) {
      await t.test("og:description is not empty", () => {
        assert.ok(
          ogDescs[0].trim().length > 0,
          `og:description content is empty in ${relIndexPath}`,
        );
      });
    }

    // ── og:url ───────────────────────────────────────────────
    const ogUrls = getMetaPropertyValues(html, "og:url");

    await t.test("og:url exists", () => {
      if (ogUrls.length === 0) missing.push("og:url");
      assert.ok(
        ogUrls.length > 0,
        `Missing <meta property="og:url"> in ${relIndexPath}`,
      );
    });

    await t.test("no duplicate og:url", () => {
      assert.ok(
        ogUrls.length <= 1,
        `Found ${ogUrls.length} og:url tags in ${relIndexPath} (expected at most 1)`,
      );
    });

    if (ogUrls.length === 1) {
      await t.test("og:url is not empty", () => {
        assert.ok(
          ogUrls[0].trim().length > 0,
          `og:url content is empty in ${relIndexPath}`,
        );
      });

      await t.test("og:url is absolute", () => {
        assert.ok(
          isAbsoluteUrl(ogUrls[0]),
          `og:url "${ogUrls[0]}" is not an absolute URL in ${relIndexPath}`,
        );
      });

      await t.test("og:url is not localhost", () => {
        assert.ok(
          !isLocalhostUrl(ogUrls[0]),
          `og:url "${ogUrls[0]}" points to localhost in ${relIndexPath}`,
        );
      });
    }

    // ── og:type (optional but checked for duplicates) ────────
    const ogTypes = getMetaPropertyValues(html, "og:type");

    await t.test("no duplicate og:type", () => {
      assert.ok(
        ogTypes.length <= 1,
        `Found ${ogTypes.length} og:type tags in ${relIndexPath} (expected at most 1)`,
      );
    });

    // ── Canonical ↔ og:url consistency ───────────────────────
    if (canonicals.length === 1 && ogUrls.length === 1) {
      await t.test("canonical URL matches og:url", () => {
        assert.equal(
          canonicals[0],
          ogUrls[0],
          `Canonical URL "${canonicals[0]}" does not match og:url "${ogUrls[0]}" in ${relIndexPath}`,
        );
      });
    }

    // ── Summary of missing metadata ──────────────────────────
    if (missing.length > 0) {
      await t.test("summary of missing metadata", () => {
        assert.fail(
          `SEO metadata validation failed for:\n${relIndexPath}\n\nMissing:\n${missing.map((m) => `- ${m}`).join("\n")}`,
        );
      });
    }
  });
}
