/**
 * Cradle — Project catalog ordering
 * ─────────────────────────────────
 * The catalog is sorted once at build time by scripts/generate-projects.js and
 * rendered in file order, so the landing page has exactly one ordering and no
 * way to change it. This module supplies the orderings the sort control offers.
 *
 * Loaded two ways:
 *
 *   browser  <script src="scripts/sort-projects.js"></script>  → window.CradleSort
 *   tests    require("../scripts/sort-projects.js")            → module.exports
 *
 * Every comparator is total and deterministic: ties always fall through to a
 * locale-aware title comparison and then to `path`, so the same input always
 * produces the same order regardless of the engine's sort stability.
 */

(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.CradleSort = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SORT_MODES = [
    { value: "title-asc", label: "A → Z" },
    { value: "title-desc", label: "Z → A" },
    { value: "category", label: "Category" },
    { value: "newest", label: "Newest first" },
  ];

  const DEFAULT_SORT_MODE = "title-asc";

  function isSortMode(mode) {
    return SORT_MODES.some(option => option.value === mode);
  }

  /** Unknown or missing modes fall back to the current behaviour, A → Z. */
  function normalizeSortMode(mode) {
    return isSortMode(mode) ? mode : DEFAULT_SORT_MODE;
  }

  function labelForSortMode(mode) {
    const match = SORT_MODES.find(
      option => option.value === normalizeSortMode(mode)
    );
    return match.label;
  }

  function text(value) {
    return typeof value === "string" ? value : "";
  }

  function compareTitle(a, b) {
    return text(a.title).localeCompare(text(b.title), undefined, {
      sensitivity: "base",
      numeric: true,
    });
  }

  /** Final tiebreaker — `path` is unique per project. */
  function comparePath(a, b) {
    return text(a.path).localeCompare(text(b.path));
  }

  /**
   * Milliseconds for a dateAdded, or null when absent/unparseable. Projects
   * without a date are sorted last rather than dropped or floated to the top —
   * dateAdded is not populated for every project yet.
   */
  function timestampOf(project) {
    if (!project || !project.dateAdded) return null;

    const parsed = new Date(project.dateAdded).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  const COMPARATORS = {
    "title-asc": (a, b) => compareTitle(a, b) || comparePath(a, b),

    "title-desc": (a, b) => -compareTitle(a, b) || comparePath(a, b),

    category: (a, b) =>
      text(a.category).localeCompare(text(b.category)) ||
      compareTitle(a, b) ||
      comparePath(a, b),

    newest: (a, b) => {
      const left = timestampOf(a);
      const right = timestampOf(b);

      if (left === null && right === null)
        return compareTitle(a, b) || comparePath(a, b);
      if (left === null) return 1;
      if (right === null) return -1;

      return right - left || compareTitle(a, b) || comparePath(a, b);
    },
  };

  /**
   * @param {Array<Object>} projects
   * @param {string} mode one of SORT_MODES; anything else falls back to A → Z
   * @returns {Array<Object>} a new array; `projects` is never mutated
   */
  function sortProjects(projects, mode = DEFAULT_SORT_MODE) {
    if (!Array.isArray(projects)) return [];

    const comparator = COMPARATORS[normalizeSortMode(mode)];

    return projects.filter(Boolean).slice().sort(comparator);
  }

  return {
    SORT_MODES,
    DEFAULT_SORT_MODE,
    isSortMode,
    normalizeSortMode,
    labelForSortMode,
    sortProjects,
  };
});
