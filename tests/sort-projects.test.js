const test = require("node:test");
const assert = require("node:assert");

const {
  SORT_MODES,
  DEFAULT_SORT_MODE,
  isSortMode,
  normalizeSortMode,
  labelForSortMode,
  sortProjects,
} = require("../scripts/sort-projects.js");

const CATALOG = [
  {
    title: "Meme Generator",
    category: "misc",
    path: "projects/misc/meme-generator/",
    dateAdded: "2026-07-20",
  },
  {
    title: "Chess",
    category: "games",
    path: "projects/games/chess/",
    dateAdded: "2026-07-28",
  },
  {
    title: "Url Parser",
    category: "dev-tools",
    path: "projects/dev-tools/url-parser/",
  },
  {
    title: "2048 Game",
    category: "games",
    path: "projects/games/2048-game/",
    dateAdded: "2026-07-31",
  },
];

const titles = projects => projects.map(project => project.title);

test("the default mode is the current build-time ordering", () => {
  assert.strictEqual(DEFAULT_SORT_MODE, "title-asc");
});

test("every advertised mode has a label and is recognised", () => {
  assert.ok(SORT_MODES.length >= 4);

  SORT_MODES.forEach(option => {
    assert.strictEqual(typeof option.value, "string");
    assert.strictEqual(typeof option.label, "string");
    assert.ok(option.label.length > 0);
    assert.ok(isSortMode(option.value));
  });
});

test("normalizeSortMode falls back to A → Z for anything unknown", () => {
  assert.strictEqual(normalizeSortMode("title-desc"), "title-desc");

  for (const bad of ["nope", "", null, undefined, 7, {}]) {
    assert.strictEqual(normalizeSortMode(bad), DEFAULT_SORT_MODE);
  }
});

test("labelForSortMode never returns undefined", () => {
  assert.strictEqual(labelForSortMode("newest"), "Newest first");
  assert.strictEqual(labelForSortMode("garbage"), "A → Z");
});

test("title-asc sorts alphabetically, numbers first", () => {
  assert.deepStrictEqual(titles(sortProjects(CATALOG, "title-asc")), [
    "2048 Game",
    "Chess",
    "Meme Generator",
    "Url Parser",
  ]);
});

test("title-desc is the exact reverse of title-asc", () => {
  assert.deepStrictEqual(
    titles(sortProjects(CATALOG, "title-desc")),
    titles(sortProjects(CATALOG, "title-asc")).reverse()
  );
});

test("category sorts by category, then by title within it", () => {
  assert.deepStrictEqual(titles(sortProjects(CATALOG, "category")), [
    "Url Parser", // dev-tools
    "2048 Game", // games
    "Chess", // games
    "Meme Generator", // misc
  ]);
});

test("newest sorts by dateAdded, most recent first", () => {
  assert.deepStrictEqual(titles(sortProjects(CATALOG, "newest")).slice(0, 3), [
    "2048 Game",
    "Chess",
    "Meme Generator",
  ]);
});

test("newest puts projects without a dateAdded last, never drops them", () => {
  const result = sortProjects(CATALOG, "newest");

  assert.strictEqual(result.length, CATALOG.length);
  assert.strictEqual(result[result.length - 1].title, "Url Parser");
});

test("newest falls back to title order when no project has a date", () => {
  const undated = CATALOG.map(({ dateAdded, ...rest }) => rest);

  assert.deepStrictEqual(
    titles(sortProjects(undated, "newest")),
    titles(sortProjects(undated, "title-asc"))
  );
});

test("newest treats an unparseable dateAdded as missing", () => {
  const projects = [
    { title: "Broken", category: "misc", path: "a/", dateAdded: "not-a-date" },
    { title: "Good", category: "misc", path: "b/", dateAdded: "2026-07-31" },
  ];

  assert.deepStrictEqual(titles(sortProjects(projects, "newest")), [
    "Good",
    "Broken",
  ]);
});

test("ordering is deterministic for equal keys", () => {
  const sameTitle = [
    { title: "Twin", category: "games", path: "projects/games/b/" },
    { title: "Twin", category: "games", path: "projects/games/a/" },
  ];

  const first = sortProjects(sameTitle, "title-asc");
  const second = sortProjects([...sameTitle].reverse(), "title-asc");

  assert.deepStrictEqual(
    first.map(project => project.path),
    second.map(project => project.path)
  );
  assert.strictEqual(first[0].path, "projects/games/a/");
});

test("an unknown mode sorts as A → Z rather than throwing", () => {
  assert.deepStrictEqual(
    titles(sortProjects(CATALOG, "by-vibes")),
    titles(sortProjects(CATALOG, "title-asc"))
  );
});

test("sortProjects does not mutate its input", () => {
  const snapshot = titles(CATALOG);

  sortProjects(CATALOG, "title-desc");

  assert.deepStrictEqual(titles(CATALOG), snapshot);
});

test("sortProjects is defensive about bad input", () => {
  assert.deepStrictEqual(sortProjects(null), []);
  assert.deepStrictEqual(sortProjects(undefined), []);
  assert.deepStrictEqual(sortProjects("nope"), []);
  assert.strictEqual(sortProjects([null, undefined]).length, 0);
});

test("sortProjects tolerates entries with a missing title or category", () => {
  const messy = [
    { path: "a/" },
    { title: "Named", category: "misc", path: "b/" },
    { title: "Other", path: "c/" },
  ];

  assert.doesNotThrow(() => sortProjects(messy, "category"));
  assert.strictEqual(sortProjects(messy, "category").length, 3);
});

test("sorting the real catalog keeps every project", () => {
  const projects = require("../data/projects.json");

  SORT_MODES.forEach(option => {
    const sorted = sortProjects(projects, option.value);

    assert.strictEqual(
      sorted.length,
      projects.length,
      `${option.value} changed the project count`
    );
    assert.deepStrictEqual(
      new Set(sorted.map(project => project.path)),
      new Set(projects.map(project => project.path)),
      `${option.value} lost or duplicated a project`
    );
  });
});

test("the shipped catalog is already in title-asc order", () => {
  const projects = require("../data/projects.json");

  // generate-projects.js sorts at build time; the default mode must therefore
  // be a no-op so the initial paint does not reshuffle the grid.
  assert.deepStrictEqual(
    titles(sortProjects(projects, "title-asc")),
    titles(projects)
  );
});
