const test = require("node:test");
const assert = require("node:assert");

const {
  RECENT_PROJECTS_LIMIT,
  isUsableEntry,
  sanitizeRecentProjects,
  reconcileRecentProjects,
  sameEntries,
} = require("../scripts/recent-projects.js");

const CHESS = {
  title: "Chess",
  category: "games",
  path: "projects/games/chess/",
};
const MONOPOLY = {
  title: "Monopoly",
  category: "games",
  path: "projects/games/monopoly/",
};
const URL_PARSER = {
  title: "Url Parser",
  category: "dev-tools",
  path: "projects/dev-tools/url-parser/",
};

const CATALOG = [CHESS, MONOPOLY, URL_PARSER];

const paths = entries => entries.map(entry => entry.path);

test("isUsableEntry rejects anything without the three identity fields", () => {
  assert.ok(isUsableEntry(CHESS));
  assert.ok(!isUsableEntry(null));
  assert.ok(!isUsableEntry({ title: "Chess", category: "games" }));
  assert.ok(!isUsableEntry({ ...CHESS, path: "" }));
  assert.ok(!isUsableEntry({ ...CHESS, path: 42 }));
});

test("sanitizeRecentProjects drops malformed entries", () => {
  const result = sanitizeRecentProjects([
    CHESS,
    null,
    { title: "No path", category: "games" },
    URL_PARSER,
  ]);

  assert.deepStrictEqual(paths(result), [CHESS.path, URL_PARSER.path]);
});

test("sanitizeRecentProjects removes duplicate paths, keeping the most recent", () => {
  const result = sanitizeRecentProjects([
    { ...CHESS, title: "Chess (newer)" },
    MONOPOLY,
    { ...CHESS, title: "Chess (older)" },
  ]);

  assert.deepStrictEqual(paths(result), [CHESS.path, MONOPOLY.path]);
  assert.strictEqual(result[0].title, "Chess (newer)");
});

test("sanitizeRecentProjects enforces the limit", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    title: `Project ${i}`,
    category: "misc",
    path: `projects/misc/p${i}/`,
  }));

  assert.strictEqual(
    sanitizeRecentProjects(many).length,
    RECENT_PROJECTS_LIMIT
  );
  assert.strictEqual(sanitizeRecentProjects(many, 2).length, 2);
});

test("sanitizeRecentProjects normalises a missing dateAdded to null", () => {
  const [entry] = sanitizeRecentProjects([CHESS]);

  assert.strictEqual(entry.dateAdded, null);
});

test("sanitizeRecentProjects is defensive about non-array input", () => {
  assert.deepStrictEqual(sanitizeRecentProjects(null), []);
  assert.deepStrictEqual(sanitizeRecentProjects("nope"), []);
  assert.deepStrictEqual(sanitizeRecentProjects(undefined), []);
});

test("reconcileRecentProjects drops a project that no longer exists", () => {
  const stored = [CHESS, { ...MONOPOLY, path: "projects/games/deleted/" }];
  const { entries, removed, changed } = reconcileRecentProjects(
    stored,
    CATALOG
  );

  assert.deepStrictEqual(paths(entries), [CHESS.path]);
  assert.deepStrictEqual(paths(removed), ["projects/games/deleted/"]);
  assert.strictEqual(changed, true);
});

test("reconcileRecentProjects refreshes a stale title", () => {
  const stored = [{ ...CHESS, title: "Chess Old Name" }];
  const { entries, changed } = reconcileRecentProjects(stored, CATALOG);

  assert.strictEqual(entries[0].title, "Chess");
  assert.strictEqual(changed, true);
});

test("reconcileRecentProjects refreshes a changed category", () => {
  const stored = [{ ...URL_PARSER, category: "misc" }];
  const { entries } = reconcileRecentProjects(stored, CATALOG);

  assert.strictEqual(entries[0].category, "dev-tools");
});

test("reconcileRecentProjects picks up a dateAdded that the catalog gained", () => {
  const catalog = [{ ...CHESS, dateAdded: "2026-07-30" }];
  const { entries } = reconcileRecentProjects([CHESS], catalog);

  assert.strictEqual(entries[0].dateAdded, "2026-07-30");
});

test("reconcileRecentProjects preserves recency order", () => {
  const stored = [URL_PARSER, CHESS, MONOPOLY];
  const { entries } = reconcileRecentProjects(stored, CATALOG);

  assert.deepStrictEqual(paths(entries), [
    URL_PARSER.path,
    CHESS.path,
    MONOPOLY.path,
  ]);
});

test("reconcileRecentProjects reports no change when everything is current", () => {
  const stored = sanitizeRecentProjects([CHESS, MONOPOLY]);
  const { entries, changed, removed } = reconcileRecentProjects(
    stored,
    CATALOG
  );

  assert.strictEqual(changed, false);
  assert.deepStrictEqual(removed, []);
  assert.deepStrictEqual(paths(entries), [CHESS.path, MONOPOLY.path]);
});

test("an empty catalog is treated as not-yet-loaded and never wipes history", () => {
  const stored = sanitizeRecentProjects([CHESS, MONOPOLY]);

  for (const catalog of [[], null, undefined]) {
    const { entries, removed } = reconcileRecentProjects(stored, catalog);

    assert.deepStrictEqual(paths(entries), [CHESS.path, MONOPOLY.path]);
    assert.deepStrictEqual(removed, []);
  }
});

test("reconcileRecentProjects still sanitizes when the catalog is unavailable", () => {
  const { entries, changed } = reconcileRecentProjects([CHESS, null], []);

  assert.deepStrictEqual(paths(entries), [CHESS.path]);
  assert.strictEqual(changed, true);
});

test("reconcileRecentProjects ignores catalog entries without a path", () => {
  const catalog = [{ title: "Broken", category: "games" }, CHESS];
  const { entries } = reconcileRecentProjects([CHESS], catalog);

  assert.deepStrictEqual(paths(entries), [CHESS.path]);
});

test("reconcileRecentProjects does not mutate its inputs", () => {
  const stored = [{ ...CHESS, title: "Stale" }];
  const catalogCopy = JSON.parse(JSON.stringify(CATALOG));

  reconcileRecentProjects(stored, catalogCopy);

  assert.strictEqual(stored[0].title, "Stale");
  assert.deepStrictEqual(catalogCopy, CATALOG);
});

test("reconcileRecentProjects removing everything yields an empty list", () => {
  const stored = [
    { title: "Gone", category: "games", path: "projects/games/gone/" },
  ];
  const { entries, removed, changed } = reconcileRecentProjects(
    stored,
    CATALOG
  );

  assert.deepStrictEqual(entries, []);
  assert.strictEqual(removed.length, 1);
  assert.strictEqual(changed, true);
});

test("sameEntries compares structurally, not by reference", () => {
  assert.ok(sameEntries([{ ...CHESS, dateAdded: null }], [{ ...CHESS }]));
  assert.ok(!sameEntries([CHESS], [MONOPOLY]));
  assert.ok(!sameEntries([CHESS], []));
  assert.ok(!sameEntries(null, []));
});
