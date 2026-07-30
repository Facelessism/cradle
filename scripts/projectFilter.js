/**
 * Cradle — Shared project filtering logic
 * ───────────────────────────────────────
 * Single source of truth for how a project list is narrowed down by the
 * selected category and the search query.
 *
 * The same predicate is needed in three very different places:
 *
 *   1. `scripts/worker.js`  — the Web Worker that filters off the main thread.
 *   2. `script.js`          — the main thread, used whenever the worker is
 *                             unavailable (older browsers, `file://` pages,
 *                             a restrictive CSP, or a worker that crashed).
 *   3. `tests/*.test.js`    — Node, so the behaviour can be asserted directly.
 *
 * Keeping the logic in one file means the worker path and the main-thread
 * fallback can never silently drift apart and return different results for
 * the same input.
 *
 * The UMD-style wrapper below is what lets a single file serve all three:
 * `module.exports` for Node, and a global (`self`/`window`) for the browser
 * and for `importScripts()` inside the worker.
 */

(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  } else {
    root.CradleProjectFilter = api;
  }
})(
  typeof self !== "undefined"
    ? self
    : typeof globalThis !== "undefined"
      ? globalThis
      : this,
  function () {
    "use strict";

    const ALL_CATEGORIES = "all";

    /**
     * Turn a raw category slug into the label shown in the UI.
     * `dev-tools` becomes `DEV TOOLS`.
     *
     * Every hyphen is replaced, not just the first one, so a future
     * multi-word slug such as `ai-ml-tools` still reads correctly.
     *
     * @param {string} category Raw category slug from `projects.json`.
     * @returns {string} Uppercased, space-separated label.
     */
    function formatCategoryLabel(category) {
      if (typeof category !== "string") return "";
      return category.toUpperCase().replace(/-/g, " ");
    }

    /**
     * Build the haystack a category is matched against, so that a search for
     * either the slug (`dev-tools`) or the label (`dev tools`) hits.
     *
     * @param {string} category Raw category slug.
     * @returns {string} Lowercased searchable text for that category.
     */
    function getSearchableCategory(category) {
      if (typeof category !== "string") return "";
      return `${category} ${formatCategoryLabel(category)}`.toLowerCase();
    }

    /**
     * Normalise a raw search box value into the form the matcher expects.
     * Accepts anything so callers do not have to guard against `null`.
     *
     * @param {unknown} query Raw user input.
     * @returns {string} Lowercased, trimmed query.
     */
    function normalizeQuery(query) {
      if (typeof query !== "string") return "";
      return query.toLowerCase().trim();
    }

    /**
     * Does a single project belong in the currently visible grid?
     *
     * @param {object} project Project record from `projects.json`.
     * @param {string} selectedCategory Active category slug, or `"all"`.
     * @param {string} normalizedQuery Output of {@link normalizeQuery}.
     * @returns {boolean} True when the project should be rendered.
     */
    function matchesProject(project, selectedCategory, normalizedQuery) {
      if (!project || typeof project !== "object") return false;

      const category =
        typeof project.category === "string" ? project.category : "";
      const title = typeof project.title === "string" ? project.title : "";

      const matchesCategory =
        selectedCategory === ALL_CATEGORIES || category === selectedCategory;

      if (!matchesCategory) return false;
      if (!normalizedQuery) return true;

      return (
        title.toLowerCase().includes(normalizedQuery) ||
        getSearchableCategory(category).includes(normalizedQuery)
      );
    }

    /**
     * Filter a project list by category and search query.
     *
     * Defensive about its inputs on purpose: it runs inside a Worker where a
     * thrown error is easy to miss, and it also runs against IndexedDB-cached
     * data that may predate a schema change.
     *
     * @param {Array<object>} projects Projects to filter.
     * @param {object} [options]
     * @param {string} [options.selectedCategory="all"] Active category slug.
     * @param {string} [options.query=""] Raw search box value.
     * @returns {Array<object>} A new array with the matching projects.
     */
    function filterProjects(projects, options) {
      if (!Array.isArray(projects)) return [];

      const settings = options || {};
      const selectedCategory = settings.selectedCategory || ALL_CATEGORIES;
      const normalizedQuery = normalizeQuery(settings.query);

      return projects.filter(project =>
        matchesProject(project, selectedCategory, normalizedQuery)
      );
    }

    return {
      ALL_CATEGORIES,
      formatCategoryLabel,
      getSearchableCategory,
      normalizeQuery,
      matchesProject,
      filterProjects,
    };
  }
);
