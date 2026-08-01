const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  ALL_CATEGORIES,
  formatCategoryLabel,
  getSearchableCategory,
  normalizeQuery,
  matchesProject,
  filterProjects,
} = require("../scripts/filter-projects.js");

const CATALOG = [
  { title: "Chess", category: "games", path: "projects/games/chess/" },
  { title: "2048 Game", category: "games", path: "projects/games/2048-game/" },
  {
    title: "URL Parser",
    category: "dev-tools",
    path: "projects/dev-tools/url-parser/",
  },
  {
    title: "JSON Converter",
    category: "dev-tools",
    path: "projects/dev-tools/json-converter/",
  },
  {
    title: "Meme Generator",
    category: "misc",
    path: "projects/misc/meme-generator/",
  },
];

const titles = projects => projects.map(project => project.title);

test("formatCategoryLabel uppercases and replaces every hyphen", () => {
  assert.strictEqual(formatCategoryLabel("dev-tools"), "DEV TOOLS");
  assert.strictEqual(formatCategoryLabel("games"), "GAMES");
  // The previous inline copies used .replace("-", " "), which stopped after
  // the first hyphen and produced "FILE TOOLS-EXTRA".
  assert.strictEqual(formatCategoryLabel("file-tools-extra"), "FILE TOOLS EXTRA");
});

test("formatCategoryLabel tolerates missing input", () => {
  assert.strictEqual(formatCategoryLabel(null), "");
  assert.strictEqual(formatCategoryLabel(undefined), "");
});

test("getSearchableCategory matches both the slug and the display label", () => {
  const haystack = getSearchableCategory("dev-tools");

  assert.ok(haystack.includes("dev-tools"));
  assert.ok(haystack.includes("dev tools"));
});

test("normalizeQuery lowercases and trims", () => {
  assert.strictEqual(normalizeQuery("  CheSS  "), "chess");
  assert.strictEqual(normalizeQuery(null), "");
});

test("filterProjects with no criteria returns everything", () => {
  assert.deepStrictEqual(titles(filterProjects(CATALOG)), titles(CATALOG));
});

test("filterProjects narrows by category", () => {
  const result = filterProjects(CATALOG, { category: "games" });

  assert.deepStrictEqual(titles(result), ["Chess", "2048 Game"]);
});

test("filterProjects matches a title substring, case-insensitively", () => {
  assert.deepStrictEqual(titles(filterProjects(CATALOG, { query: "cHe" })), [
    "Chess",
  ]);
});

test("filterProjects matches a category slug and its display label", () => {
  assert.deepStrictEqual(titles(filterProjects(CATALOG, { query: "dev-tools" })), [
    "URL Parser",
    "JSON Converter",
  ]);
  assert.deepStrictEqual(titles(filterProjects(CATALOG, { query: "dev tools" })), [
    "URL Parser",
    "JSON Converter",
  ]);
});

test("filterProjects applies category and query together", () => {
  const result = filterProjects(CATALOG, {
    category: "dev-tools",
    query: "json",
  });

  assert.deepStrictEqual(titles(result), ["JSON Converter"]);
});

test("filterProjects returns nothing when the query matches nothing", () => {
  assert.deepStrictEqual(filterProjects(CATALOG, { query: "zzzz" }), []);
});

test("filterProjects treats a whitespace-only query as empty", () => {
  assert.strictEqual(filterProjects(CATALOG, { query: "   " }).length, 5);
});

test("filterProjects preserves catalog order and does not mutate its input", () => {
  const snapshot = titles(CATALOG);
  const result = filterProjects(CATALOG, { category: "games" });

  result.push({ title: "Injected" });

  assert.deepStrictEqual(titles(CATALOG), snapshot);
  assert.strictEqual(CATALOG.length, 5);
});

test("filterProjects is defensive about bad input", () => {
  assert.deepStrictEqual(filterProjects(null), []);
  assert.deepStrictEqual(filterProjects(undefined), []);
  assert.deepStrictEqual(filterProjects([null, undefined], { query: "a" }), []);
});

test("filterProjects survives entries with a missing title", () => {
  const withHole = [...CATALOG, { category: "games", path: "projects/x/" }];

  assert.doesNotThrow(() => filterProjects(withHole, { query: "chess" }));
  assert.deepStrictEqual(titles(filterProjects(withHole, { query: "chess" })), [
    "Chess",
  ]);
});

test("matchesProject honours ALL_CATEGORIES", () => {
  assert.ok(matchesProject(CATALOG[0], ALL_CATEGORIES, ""));
  assert.ok(!matchesProject(CATALOG[0], "misc", ""));
});

/* ── Worker contract ──────────────────────────────────────────────────────
 * The worker cannot be imported directly under Node (no importScripts, no
 * postMessage), so it is evaluated in a VM sandbox that supplies both. This
 * pins the request/reply contract the main thread relies on for sequencing.
 */

function runWorkerInSandbox(messages) {
  const scriptsDir = path.resolve(__dirname, "..", "scripts");
  const workerSource = fs.readFileSync(
    path.join(scriptsDir, "worker.js"),
    "utf-8"
  );
  const filterSource = fs.readFileSync(
    path.join(scriptsDir, "filter-projects.js"),
    "utf-8"
  );

  const replies = [];
  const sandbox = { self: null };
  sandbox.self = {
    importScripts(file) {
      assert.strictEqual(file, "./filter-projects.js");
      vm.runInContext(filterSource, sandbox.context);
    },
    postMessage(payload) {
      replies.push(payload);
    },
  };

  sandbox.context = vm.createContext(sandbox);
  sandbox.importScripts = sandbox.self.importScripts;
  vm.runInContext(workerSource, sandbox.context);

  messages.forEach(data => sandbox.self.onmessage({ data }));

  return replies;
}

test("worker echoes the requestId it was given", () => {
  const replies = runWorkerInSandbox([
    { requestId: 7, allProjects: CATALOG, selectedCategory: "games", query: "" },
  ]);

  assert.strictEqual(replies.length, 1);
  assert.strictEqual(replies[0].requestId, 7);
  assert.deepStrictEqual(titles(replies[0].projects), ["Chess", "2048 Game"]);
});

test("worker results match the main-thread fallback for the same criteria", () => {
  const criteria = { category: "dev-tools", query: "parser" };
  const [reply] = runWorkerInSandbox([
    {
      requestId: 1,
      allProjects: CATALOG,
      selectedCategory: criteria.category,
      query: criteria.query,
    },
  ]);

  assert.deepStrictEqual(
    titles(reply.projects),
    titles(filterProjects(CATALOG, criteria))
  );
});

test("worker keeps request ids distinct so stale replies are identifiable", () => {
  const replies = runWorkerInSandbox([
    { requestId: 1, allProjects: CATALOG, selectedCategory: "all", query: "ch" },
    {
      requestId: 2,
      allProjects: CATALOG,
      selectedCategory: "all",
      query: "chess",
    },
  ]);

  assert.deepStrictEqual(
    replies.map(reply => reply.requestId),
    [1, 2]
  );
  // A consumer that keeps only the highest id it has issued lands on "chess"
  // regardless of the order these two replies are delivered in.
  const latest = 2;
  const applied = replies.filter(reply => reply.requestId === latest);
  assert.deepStrictEqual(titles(applied[0].projects), ["Chess"]);
});

test("worker handles an empty message payload without throwing", () => {
  const replies = runWorkerInSandbox([undefined]);

  assert.strictEqual(replies.length, 1);
  // Array.from() because the worker runs in a separate VM realm, so its arrays
  // do not share this realm's Array.prototype.
  assert.deepStrictEqual(Array.from(replies[0].projects), []);
});
