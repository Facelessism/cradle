const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const SCRIPT_PATH = path.join(REPO_ROOT, "script.js");
const INDEX_PATH = path.join(REPO_ROOT, "index.html");

const urlState = require(path.join(REPO_ROOT, "scripts", "urlState.js"));

const CATEGORIES = ["games", "dev-tools", "productivity", "aiml", "misc"];

/**
 * Build a fake `history` that records the calls made against it.
 *
 * @returns {object} History stub with a `calls` array.
 */
function makeHistory() {
  const calls = [];

  return {
    calls,
    pushState(state, title, url) {
      calls.push({ type: "push", state, url });
    },
    replaceState(state, title, url) {
      calls.push({ type: "replace", state, url });
    },
  };
}

/**
 * Build a fake `location`.
 *
 * @param {string} [search] Query string including `?`.
 * @param {string} [hash] Fragment including `#`.
 * @returns {object} Location stub.
 */
function makeLocation(search, hash) {
  return {
    pathname: "/cradle/",
    search: search || "",
    hash: hash || "",
  };
}

/* ── parseFilterState ────────────────────────────────────────────────── */

test("parseFilterState returns defaults for an empty query string", () => {
  assert.deepEqual(urlState.parseFilterState(""), {
    query: "",
    category: "all",
  });
  assert.deepEqual(urlState.parseFilterState("?"), {
    query: "",
    category: "all",
  });
});

test("parseFilterState reads the search query", () => {
  assert.deepEqual(urlState.parseFilterState("?q=json"), {
    query: "json",
    category: "all",
  });
});

test("parseFilterState reads the category", () => {
  assert.deepEqual(urlState.parseFilterState("?category=games", CATEGORIES), {
    query: "",
    category: "games",
  });
});

test("parseFilterState reads both parameters together", () => {
  assert.deepEqual(
    urlState.parseFilterState("?q=parser&category=dev-tools", CATEGORIES),
    { query: "parser", category: "dev-tools" }
  );
});

test("parseFilterState works without a leading question mark", () => {
  assert.deepEqual(urlState.parseFilterState("q=json"), {
    query: "json",
    category: "all",
  });
});

test("parseFilterState decodes percent-encoded queries", () => {
  assert.deepEqual(urlState.parseFilterState("?q=json%20converter"), {
    query: "json converter",
    category: "all",
  });
});

test("parseFilterState decodes a plus as a space", () => {
  assert.deepEqual(urlState.parseFilterState("?q=json+converter"), {
    query: "json converter",
    category: "all",
  });
});

test("parseFilterState falls back to all for an unknown category", () => {
  /*
   * A stale or hand-edited link would otherwise filter the grid down to
   * nothing with no visible explanation.
   */
  assert.deepEqual(
    urlState.parseFilterState("?category=no-such-category", CATEGORIES),
    { query: "", category: "all" }
  );
});

test("parseFilterState keeps an unvalidated category when none are known", () => {
  assert.deepEqual(urlState.parseFilterState("?category=games"), {
    query: "",
    category: "games",
  });
  assert.deepEqual(urlState.parseFilterState("?category=games", []), {
    query: "",
    category: "games",
  });
});

test("parseFilterState trims and clamps an overlong query", () => {
  const long = "x".repeat(500);
  const parsed = urlState.parseFilterState(`?q=${long}`);

  assert.equal(parsed.query.length, urlState.MAX_QUERY_LENGTH);
});

test("parseFilterState trims surrounding whitespace", () => {
  assert.equal(urlState.parseFilterState("?q=%20json%20").query, "json");
});

test("parseFilterState ignores unrelated parameters", () => {
  assert.deepEqual(urlState.parseFilterState("?utm_source=x&q=json"), {
    query: "json",
    category: "all",
  });
});

test("parseFilterState tolerates non-string input", () => {
  assert.deepEqual(urlState.parseFilterState(null), {
    query: "",
    category: "all",
  });
  assert.deepEqual(urlState.parseFilterState(undefined), {
    query: "",
    category: "all",
  });
  assert.deepEqual(urlState.parseFilterState(42), {
    query: "",
    category: "all",
  });
});

/* ── serializeFilterState ────────────────────────────────────────────── */

test("serializeFilterState returns nothing for the default view", () => {
  assert.equal(
    urlState.serializeFilterState({ query: "", category: "all" }),
    ""
  );
  assert.equal(urlState.serializeFilterState({}), "");
  assert.equal(urlState.serializeFilterState(), "");
});

test("serializeFilterState writes only the parameters in use", () => {
  assert.equal(
    urlState.serializeFilterState({ query: "json", category: "all" }),
    "?q=json"
  );
  assert.equal(
    urlState.serializeFilterState({ query: "", category: "games" }),
    "?category=games"
  );
});

test("serializeFilterState writes both parameters when both are set", () => {
  assert.equal(
    urlState.serializeFilterState({ query: "url", category: "dev-tools" }),
    "?q=url&category=dev-tools"
  );
});

test("serializeFilterState encodes special characters", () => {
  const serialized = urlState.serializeFilterState({
    query: "a&b=c d",
    category: "all",
  });

  assert.ok(!serialized.includes(" "), "spaces must be encoded");
  assert.equal(urlState.parseFilterState(serialized).query, "a&b=c d");
});

test("serialize and parse round-trip cleanly", () => {
  const cases = [
    { query: "", category: "all" },
    { query: "json", category: "all" },
    { query: "", category: "dev-tools" },
    { query: "url parser", category: "dev-tools" },
    { query: "100% ünïcode", category: "misc" },
  ];

  cases.forEach(state => {
    const parsed = urlState.parseFilterState(
      urlState.serializeFilterState(state),
      CATEGORIES
    );

    assert.deepEqual(parsed, state);
  });
});

test("serializeFilterState trims the query", () => {
  assert.equal(
    urlState.serializeFilterState({ query: "  json  ", category: "all" }),
    "?q=json"
  );
});

/* ── hasActiveFilters / isSameState ──────────────────────────────────── */

test("hasActiveFilters reflects whether the view is filtered", () => {
  assert.equal(
    urlState.hasActiveFilters({ query: "", category: "all" }),
    false
  );
  assert.equal(
    urlState.hasActiveFilters({ query: "a", category: "all" }),
    true
  );
  assert.equal(
    urlState.hasActiveFilters({ query: "", category: "games" }),
    true
  );
});

test("isSameState ignores irrelevant differences", () => {
  assert.equal(
    urlState.isSameState(
      { query: "json", category: "all" },
      { query: " json ", category: "all" }
    ),
    true
  );
  assert.equal(
    urlState.isSameState(
      { query: "json", category: "all" },
      { query: "json", category: "games" }
    ),
    false
  );
});

/* ── buildUrl ────────────────────────────────────────────────────────── */

test("buildUrl preserves the path", () => {
  assert.equal(
    urlState.buildUrl({ query: "json", category: "all" }, makeLocation()),
    "/cradle/?q=json"
  );
});

test("buildUrl preserves the hash", () => {
  assert.equal(
    urlState.buildUrl(
      { query: "json", category: "all" },
      makeLocation("", "#projects")
    ),
    "/cradle/?q=json#projects"
  );
});

test("buildUrl drops the query string for the default view", () => {
  assert.equal(
    urlState.buildUrl({ query: "", category: "all" }, makeLocation("?q=old")),
    "/cradle/"
  );
});

/* ── syncToUrl ───────────────────────────────────────────────────────── */

test("syncToUrl replaces by default", () => {
  const historyRef = makeHistory();

  const changed = urlState.syncToUrl(
    { query: "json", category: "all" },
    { historyRef, locationRef: makeLocation() }
  );

  assert.equal(changed, true);
  assert.equal(historyRef.calls.length, 1);
  assert.equal(historyRef.calls[0].type, "replace");
  assert.equal(historyRef.calls[0].url, "/cradle/?q=json");
});

test("syncToUrl pushes when asked", () => {
  const historyRef = makeHistory();

  urlState.syncToUrl(
    { query: "", category: "games" },
    { historyRef, locationRef: makeLocation(), push: true }
  );

  assert.equal(historyRef.calls[0].type, "push");
  assert.equal(historyRef.calls[0].url, "/cradle/?category=games");
});

test("syncToUrl skips a no-op update", () => {
  /*
   * Typing does not always change the serialised state (trailing spaces, for
   * example), and a duplicate history entry there would be noise.
   */
  const historyRef = makeHistory();

  const changed = urlState.syncToUrl(
    { query: "json", category: "all" },
    { historyRef, locationRef: makeLocation("?q=json"), push: true }
  );

  assert.equal(changed, false);
  assert.equal(historyRef.calls.length, 0);
});

test("syncToUrl reports failure instead of throwing when history is blocked", () => {
  /* file:// pages throw a SecurityError on any history mutation. */
  const historyRef = {
    replaceState() {
      throw new Error("SecurityError");
    },
  };

  let changed;

  assert.doesNotThrow(() => {
    changed = urlState.syncToUrl(
      { query: "json", category: "all" },
      { historyRef, locationRef: makeLocation() }
    );
  });

  assert.equal(changed, false);
});

test("syncToUrl returns false when there is no history at all", () => {
  assert.equal(
    urlState.syncToUrl(
      { query: "json", category: "all" },
      { historyRef: null, locationRef: makeLocation() }
    ),
    false
  );
});

/* ── Wiring guards ───────────────────────────────────────────────────── */

test("script.js restores the filters encoded in the URL", () => {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");

  assert.match(source, /CradleUrlState/);
  assert.match(source, /function restoreFiltersFromUrl/);
});

test("script.js listens for popstate so Back undoes a filter", () => {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");

  assert.match(
    source,
    /addEventListener\("popstate", restoreFiltersFromUrl\)/,
    "without this Back leaves the page instead of undoing the last filter"
  );
});

test("script.js replaces while typing and pushes on deliberate changes", () => {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");

  assert.match(
    source,
    /syncFiltersToUrl\(false\)/,
    "typing must replace, not push, or Back gets one entry per keystroke"
  );
  assert.match(
    source,
    /syncFiltersToUrl\(true\)/,
    "category and clear actions must push so Back can undo them"
  );
});

test("script.js does not write to the URL while reading from it", () => {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");

  assert.match(
    source,
    /isRestoringFromUrl/,
    "restoring must not immediately overwrite the URL it just read"
  );
});

test("index.html loads urlState.js before script.js", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf-8");

  const stateIndex = html.indexOf("scripts/urlState.js");
  const scriptIndex = html.indexOf('src="script.js"');

  assert.ok(stateIndex !== -1, "index.html must load scripts/urlState.js");
  assert.ok(stateIndex < scriptIndex, "it must load before script.js");
});
