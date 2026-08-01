/**
 * Cradle — Shared project filtering logic
 * ────────────────────────────────────────
 * Single source of truth for how a search query and a selected category turn
 * into a list of projects.
 *
 * This logic previously existed twice — inline in `script.js` (the no-Worker
 * fallback) and again in `scripts/worker.js` — which meant the two copies were
 * free to drift and neither could be unit-tested. It now lives here and is
 * consumed three ways:
 *
 *   browser  <script src="scripts/filter-projects.js"></script>  → window.CradleFilters
 *   worker   importScripts("./filter-projects.js")               → self.CradleFilters
 *   tests    require("../scripts/filter-projects.js")            → module.exports
 *
 * Everything below is pure: no DOM, no globals, no mutation of the input array.
 */

(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.CradleFilters = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const ALL_CATEGORIES = "all";

  /**
   * Human-readable label for a category slug: "dev-tools" → "DEV TOOLS".
   *
   * Note: the previous copies used `.replace("-", " ")`, which only replaces
   * the first hyphen. A slug with two hyphens rendered as "FILE TOOLS-EXTRA".
   * The global regex here fixes that; no current category is affected.
   */
  function formatCategoryLabel(category) {
    return String(category == null ? "" : category)
      .toUpperCase()
      .replace(/-/g, " ");
  }

  /**
   * The haystack a query is matched against for a category — both the raw slug
   * ("dev-tools") and its display label ("dev tools"), so either spelling hits.
   */
  function getSearchableCategory(category) {
    return `${category} ${formatCategoryLabel(category)}`.toLowerCase();
  }

  function normalizeQuery(query) {
    return String(query == null ? "" : query)
      .toLowerCase()
      .trim();
  }

  /** Does a single project match the given category + normalized query? */
  function matchesProject(project, category, normalizedQuery) {
    if (!project) return false;

    const inCategory =
      category === ALL_CATEGORIES || project.category === category;

    if (!inCategory) return false;
    if (!normalizedQuery) return true;

    const title = String(project.title == null ? "" : project.title);

    return (
      title.toLowerCase().includes(normalizedQuery) ||
      getSearchableCategory(project.category).includes(normalizedQuery)
    );
  }

  /**
   * Filter a project list by category and free-text query.
   *
   * @param {Array<Object>} projects
   * @param {{category?: string, query?: string}} [criteria]
   * @returns {Array<Object>} a new array; `projects` is never mutated
   */
  function filterProjects(projects, criteria = {}) {
    if (!Array.isArray(projects)) return [];

    const category = criteria.category || ALL_CATEGORIES;
    const normalizedQuery = normalizeQuery(criteria.query);

    return projects.filter(project =>
      matchesProject(project, category, normalizedQuery)
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
});
