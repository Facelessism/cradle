const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const PROJECTS_JSON = path.join(REPO_ROOT, "data", "projects.json");
const GENERATOR_PATH = path.join(REPO_ROOT, "scripts", "generate-projects.js");
const SCRIPT_PATH = path.join(REPO_ROOT, "script.js");
const INDEX_PATH = path.join(REPO_ROOT, "index.html");

const projectDates = require(
  path.join(REPO_ROOT, "scripts", "projectDates.js")
);

/** Fixed reference point so these tests never depend on the real clock. */
const NOW = Date.parse("2026-07-30T12:00:00.000Z");

/**
 * Build an ISO date string a given number of days before NOW.
 *
 * @param {number} days How many days back.
 * @returns {string} `YYYY-MM-DD`.
 */
function daysAgo(days) {
  return new Date(NOW - days * projectDates.MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/* ── toIsoDate ───────────────────────────────────────────────────────── */

test("toIsoDate formats a Date as YYYY-MM-DD", () => {
  assert.equal(
    projectDates.toIsoDate(new Date("2026-07-24T19:26:14.000Z")),
    "2026-07-24"
  );
});

test("toIsoDate returns null for an invalid Date", () => {
  assert.equal(projectDates.toIsoDate(new Date("not a date")), null);
});

test("toIsoDate returns null for non-Date input", () => {
  assert.equal(projectDates.toIsoDate("2026-07-24"), null);
  assert.equal(projectDates.toIsoDate(null), null);
  assert.equal(projectDates.toIsoDate(undefined), null);
});

/* ── parseDateAdded ──────────────────────────────────────────────────── */

test("parseDateAdded accepts a plain ISO date", () => {
  const parsed = projectDates.parseDateAdded("2026-07-24");
  assert.ok(parsed instanceof Date);
  assert.equal(parsed.toISOString().slice(0, 10), "2026-07-24");
});

test("parseDateAdded accepts a full timestamp", () => {
  const parsed = projectDates.parseDateAdded("2026-07-24T19:26:14+05:30");
  assert.ok(parsed instanceof Date);
});

test("parseDateAdded rejects junk instead of returning an invalid Date", () => {
  assert.equal(projectDates.parseDateAdded("tomorrow"), null);
  assert.equal(projectDates.parseDateAdded(""), null);
  assert.equal(projectDates.parseDateAdded("   "), null);
  assert.equal(projectDates.parseDateAdded(null), null);
  assert.equal(projectDates.parseDateAdded(undefined), null);
  assert.equal(projectDates.parseDateAdded(12345), null);
});

/* ── isValidIsoDate ──────────────────────────────────────────────────── */

test("isValidIsoDate accepts only normalised YYYY-MM-DD strings", () => {
  assert.equal(projectDates.isValidIsoDate("2026-07-24"), true);
  assert.equal(projectDates.isValidIsoDate("2026-7-4"), false);
  assert.equal(projectDates.isValidIsoDate("2026-07-24T10:00:00Z"), false);
  assert.equal(projectDates.isValidIsoDate("2026-13-01"), false);
  assert.equal(projectDates.isValidIsoDate(""), false);
  assert.equal(projectDates.isValidIsoDate(null), false);
});

/* ── isNewProject ────────────────────────────────────────────────────── */

test("isNewProject is true for a project added today", () => {
  assert.equal(projectDates.isNewProject(daysAgo(0), NOW), true);
});

test("isNewProject is true inside the freshness window", () => {
  assert.equal(projectDates.isNewProject(daysAgo(1), NOW), true);
  assert.equal(projectDates.isNewProject(daysAgo(6), NOW), true);
});

test("isNewProject is false once the window has passed", () => {
  assert.equal(projectDates.isNewProject(daysAgo(8), NOW), false);
  assert.equal(projectDates.isNewProject(daysAgo(90), NOW), false);
});

test("isNewProject is false for a missing date", () => {
  assert.equal(projectDates.isNewProject(undefined, NOW), false);
  assert.equal(projectDates.isNewProject(null, NOW), false);
  assert.equal(projectDates.isNewProject("", NOW), false);
});

test("isNewProject is false for an unparseable date", () => {
  /*
   * Previously this produced NaN comparisons rather than a clear false,
   * which is easy to get subtly wrong when the comparison direction changes.
   */
  assert.equal(projectDates.isNewProject("last tuesday", NOW), false);
});

test("isNewProject is false for a date far in the future", () => {
  /*
   * A clock-skewed machine or a typo'd year would otherwise pin the "New"
   * ribbon on permanently, since a negative age is always <= the window.
   */
  assert.equal(projectDates.isNewProject("2099-01-01", NOW), false);
});

test("isNewProject tolerates one day of clock skew", () => {
  const tomorrow = new Date(NOW + projectDates.MS_PER_DAY)
    .toISOString()
    .slice(0, 10);

  assert.equal(projectDates.isNewProject(tomorrow, NOW), true);
});

/* ── projects.json contract ──────────────────────────────────────────── */

const catalog = JSON.parse(fs.readFileSync(PROJECTS_JSON, "utf-8"));

test("projects.json is a non-empty array", () => {
  assert.ok(Array.isArray(catalog));
  assert.ok(catalog.length > 0);
});

test("every project in projects.json carries a dateAdded", () => {
  const missing = catalog
    .filter(project => !project.dateAdded)
    .map(project => project.path);

  assert.deepEqual(
    missing,
    [],
    `these projects have no dateAdded, so they can never show the "New" ` +
      `ribbon: ${missing.join(", ")}`
  );
});

test("every dateAdded is a normalised YYYY-MM-DD string", () => {
  const invalid = catalog
    .filter(project => !projectDates.isValidIsoDate(project.dateAdded))
    .map(project => `${project.path} -> ${project.dateAdded}`);

  assert.deepEqual(invalid, [], `malformed dateAdded values: ${invalid}`);
});

test("no dateAdded is set in the future", () => {
  const now = Date.now();
  const future = catalog
    .filter(project => {
      const parsed = projectDates.parseDateAdded(project.dateAdded);
      return parsed && parsed.getTime() - now > projectDates.MS_PER_DAY;
    })
    .map(project => project.path);

  assert.deepEqual(future, [], `future dateAdded values: ${future}`);
});

test("dateAdded values are plausible, not epoch fallbacks", () => {
  const epochish = catalog
    .filter(project => {
      const parsed = projectDates.parseDateAdded(project.dateAdded);
      return parsed && parsed.getUTCFullYear() < 2020;
    })
    .map(project => project.path);

  assert.deepEqual(
    epochish,
    [],
    `these look like a birthtime fallback that resolved to the epoch: ${epochish}`
  );
});

/* ── Wiring guards ───────────────────────────────────────────────────── */

test("the generator writes dateAdded into every record", () => {
  const source = fs.readFileSync(GENERATOR_PATH, "utf-8");

  assert.match(source, /dateAdded:\s*resolveDateAdded\(/);
  assert.match(source, /--refresh-dates/);
});

test("the generator prefers the committed date over re-deriving it", () => {
  const source = fs.readFileSync(GENERATOR_PATH, "utf-8");

  assert.match(
    source,
    /function readExistingProjects/,
    "existing dateAdded values must be reused so published dates stay stable"
  );
});

test("script.js delegates isNewProject to the shared module", () => {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");

  assert.match(source, /CradleProjectDates/);
  assert.ok(
    !/const diffDays = \(Date\.now\(\) - new Date\(dateAdded\)\)/.test(source),
    "the old inline freshness check should be gone"
  );
});

test("index.html loads projectDates.js before script.js", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf-8");

  const datesIndex = html.indexOf("scripts/projectDates.js");
  const scriptIndex = html.indexOf('src="script.js"');

  assert.ok(datesIndex !== -1, "index.html must load scripts/projectDates.js");
  assert.ok(datesIndex < scriptIndex, "it must load before script.js");
});
