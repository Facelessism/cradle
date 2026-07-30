const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO_ROOT = path.resolve(__dirname, "..");
const FILTER_PATH = path.join(REPO_ROOT, "scripts", "projectFilter.js");
const WORKER_PATH = path.join(REPO_ROOT, "scripts", "worker.js");
const SCRIPT_PATH = path.join(REPO_ROOT, "script.js");
const INDEX_PATH = path.join(REPO_ROOT, "index.html");

const projectFilter = require(FILTER_PATH);

const PROJECTS = [
  { title: "2048 Game", category: "games", path: "projects/games/2048-game/" },
  {
    title: "JSON Converter",
    category: "dev-tools",
    path: "projects/dev-tools/json-converter/",
  },
  {
    title: "URL Parser",
    category: "dev-tools",
    path: "projects/dev-tools/url-parser/",
  },
  {
    title: "Invoice Generator",
    category: "productivity",
    path: "projects/productivity/invoice-generator/",
  },
];

function titlesOf(projects) {
  return projects.map(project => project.title);
}

/* ── formatCategoryLabel ─────────────────────────────────────────────── */

test("formatCategoryLabel uppercases a single-word category", () => {
  assert.equal(projectFilter.formatCategoryLabel("games"), "GAMES");
});

test("formatCategoryLabel replaces every hyphen, not just the first", () => {
  assert.equal(projectFilter.formatCategoryLabel("dev-tools"), "DEV TOOLS");
  assert.equal(
    projectFilter.formatCategoryLabel("ai-ml-experiments"),
    "AI ML EXPERIMENTS"
  );
});

test("formatCategoryLabel tolerates non-string input", () => {
  assert.equal(projectFilter.formatCategoryLabel(undefined), "");
  assert.equal(projectFilter.formatCategoryLabel(null), "");
  assert.equal(projectFilter.formatCategoryLabel(42), "");
});

/* ── normalizeQuery ──────────────────────────────────────────────────── */

test("normalizeQuery lowercases and trims", () => {
  assert.equal(projectFilter.normalizeQuery("  JSON  "), "json");
});

test("normalizeQuery returns an empty string for non-string input", () => {
  assert.equal(projectFilter.normalizeQuery(undefined), "");
  assert.equal(projectFilter.normalizeQuery(null), "");
});

/* ── filterProjects ──────────────────────────────────────────────────── */

test("filterProjects returns everything for the default state", () => {
  const result = projectFilter.filterProjects(PROJECTS, {
    selectedCategory: "all",
    query: "",
  });

  assert.equal(result.length, PROJECTS.length);
});

test("filterProjects narrows by category", () => {
  const result = projectFilter.filterProjects(PROJECTS, {
    selectedCategory: "dev-tools",
    query: "",
  });

  assert.deepEqual(titlesOf(result), ["JSON Converter", "URL Parser"]);
});

test("filterProjects matches a project title case-insensitively", () => {
  const result = projectFilter.filterProjects(PROJECTS, {
    selectedCategory: "all",
    query: "json",
  });

  assert.deepEqual(titlesOf(result), ["JSON Converter"]);
});

test("filterProjects matches the raw category slug", () => {
  const result = projectFilter.filterProjects(PROJECTS, {
    selectedCategory: "all",
    query: "dev-tools",
  });

  assert.deepEqual(titlesOf(result), ["JSON Converter", "URL Parser"]);
});

test("filterProjects matches the spaced category label", () => {
  const result = projectFilter.filterProjects(PROJECTS, {
    selectedCategory: "all",
    query: "dev tools",
  });

  assert.deepEqual(titlesOf(result), ["JSON Converter", "URL Parser"]);
});

test("filterProjects combines category and query", () => {
  const result = projectFilter.filterProjects(PROJECTS, {
    selectedCategory: "dev-tools",
    query: "url",
  });

  assert.deepEqual(titlesOf(result), ["URL Parser"]);
});

test("filterProjects returns an empty array when nothing matches", () => {
  const result = projectFilter.filterProjects(PROJECTS, {
    selectedCategory: "all",
    query: "no-such-project",
  });

  assert.deepEqual(result, []);
});

test("filterProjects does not mutate the input array", () => {
  const input = PROJECTS.slice();

  projectFilter.filterProjects(input, {
    selectedCategory: "games",
    query: "",
  });

  assert.equal(input.length, PROJECTS.length);
});

test("filterProjects survives malformed records instead of throwing", () => {
  const messy = [
    null,
    undefined,
    {},
    { title: "Valid", category: "games" },
    { category: "games" },
    { title: 12345, category: "games" },
  ];

  const result = projectFilter.filterProjects(messy, {
    selectedCategory: "games",
    query: "valid",
  });

  assert.deepEqual(titlesOf(result), ["Valid"]);
});

test("filterProjects returns an empty array for non-array input", () => {
  assert.deepEqual(projectFilter.filterProjects(null, {}), []);
  assert.deepEqual(projectFilter.filterProjects(undefined, {}), []);
  assert.deepEqual(projectFilter.filterProjects("nope", {}), []);
});

test("filterProjects defaults to the 'all' category when omitted", () => {
  const result = projectFilter.filterProjects(PROJECTS, {});
  assert.equal(result.length, PROJECTS.length);
});

/* ── Worker contract ─────────────────────────────────────────────────── */

/**
 * Evaluate `scripts/worker.js` inside a minimal Worker-like sandbox so the
 * message contract can be asserted without a real browser.
 */
function runWorker(message) {
  const posted = [];
  const sandbox = {
    console,
    postMessage: null,
    importScripts(relativePath) {
      const resolved = path.join(REPO_ROOT, "scripts", relativePath);
      const source = fs.readFileSync(resolved, "utf-8");
      vm.runInContext(source, sandbox.__context, { filename: resolved });
    },
  };

  sandbox.self = sandbox;
  sandbox.postMessage = value => posted.push(value);

  const context = vm.createContext(sandbox);
  sandbox.__context = context;

  vm.runInContext(fs.readFileSync(WORKER_PATH, "utf-8"), context, {
    filename: WORKER_PATH,
  });

  sandbox.onmessage({ data: message });

  return posted;
}

test("worker filters using the shared module and echoes the requestId", () => {
  const posted = runWorker({
    requestId: 7,
    allProjects: PROJECTS,
    selectedCategory: "dev-tools",
    query: "",
  });

  assert.equal(posted.length, 1);
  assert.equal(posted[0].ok, true);
  assert.equal(posted[0].requestId, 7);
  assert.deepEqual(titlesOf(posted[0].projects), [
    "JSON Converter",
    "URL Parser",
  ]);
});

test("worker answers a malformed payload instead of dying", () => {
  /*
   * An undefined payload used to throw inside the worker (destructuring
   * `e.data`), which surfaced as an uncaught worker error and left the grid
   * stuck. It must now always post a well-formed reply.
   */
  const posted = runWorker(undefined);

  assert.equal(posted.length, 1);
  assert.equal(posted[0].ok, true);
  assert.equal(posted[0].projects.length, 0);
});

test("worker replies even when the project list contains junk", () => {
  const posted = runWorker({
    requestId: 3,
    allProjects: [null, undefined, { title: "OK", category: "games" }],
    selectedCategory: "games",
    query: "ok",
  });

  assert.equal(posted.length, 1);
  assert.equal(posted[0].ok, true);
  assert.equal(posted[0].requestId, 3);
  assert.deepEqual(titlesOf(posted[0].projects), ["OK"]);
});

test("worker agrees with the main-thread fallback for the same input", () => {
  const query = "dev tools";
  const workerResult = runWorker({
    requestId: 1,
    allProjects: PROJECTS,
    selectedCategory: "all",
    query,
  })[0].projects;

  const localResult = projectFilter.filterProjects(PROJECTS, {
    selectedCategory: "all",
    query,
  });

  assert.deepEqual(titlesOf(workerResult), titlesOf(localResult));
});

/* ── Regression guards ───────────────────────────────────────────────── */

test("script.js never constructs a Worker outside a try block", () => {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");

  assert.match(
    source,
    /try\s*\{[\s\S]*new Worker\(/,
    "new Worker() must stay inside try/catch — an unguarded call throws " +
      "under file:// and aborts the whole module."
  );
});

test("script.js registers worker error handlers", () => {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");

  assert.match(source, /onerror\s*=/, "worker.onerror must be handled");
  assert.match(
    source,
    /onmessageerror\s*=/,
    "worker.onmessageerror must be handled"
  );
});

test("worker.js no longer duplicates the filter predicate", () => {
  const source = fs.readFileSync(WORKER_PATH, "utf-8");

  assert.match(source, /importScripts\(["']\.\/projectFilter\.js["']\)/);
  assert.ok(
    !source.includes("function getSearchableCategory"),
    "the filter predicate must live only in scripts/projectFilter.js"
  );
});

test("index.html loads projectFilter.js before script.js", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf-8");

  const filterIndex = html.indexOf("scripts/projectFilter.js");
  const scriptIndex = html.indexOf('src="script.js"');

  assert.ok(
    filterIndex !== -1,
    "index.html must load scripts/projectFilter.js"
  );
  assert.ok(scriptIndex !== -1, "index.html must load script.js");
  assert.ok(
    filterIndex < scriptIndex,
    "projectFilter.js must be loaded before script.js so the global exists"
  );
});
