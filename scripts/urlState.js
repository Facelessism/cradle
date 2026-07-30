/**
 * Cradle — Filter state in the URL
 * ────────────────────────────────
 * Serialises the active search query and category filter into the query
 * string, and reads them back out again.
 *
 * Without this the filter state lives only in memory: a filtered view cannot
 * be linked to or bookmarked, a refresh silently throws the filters away, and
 * the browser Back button skips straight off the page instead of undoing the
 * last filter change.
 *
 * Parsing and serialising are pure functions over strings, so they are
 * unit-testable without a browser. The `syncToUrl` helper is the only part
 * that touches `history`.
 *
 * Loads as a CommonJS module in Node and as a `window.CradleUrlState` global
 * in the browser.
 */

(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  } else {
    root.CradleUrlState = api;
  }
})(
  typeof self !== "undefined"
    ? self
    : typeof globalThis !== "undefined"
      ? globalThis
      : this,
  function () {
    "use strict";

    const QUERY_PARAM = "q";
    const CATEGORY_PARAM = "category";
    const ALL_CATEGORIES = "all";

    /** Upper bound on a restored query, so a hostile link cannot bloat the DOM. */
    const MAX_QUERY_LENGTH = 100;

    /**
     * Read the filter state out of a query string.
     *
     * @param {string} search A `location.search` value, with or without `?`.
     * @param {Array<string>} [knownCategories] Categories that actually exist.
     * @returns {{query: string, category: string}} Normalised filter state.
     */
    function parseFilterState(search, knownCategories) {
      const fallback = { query: "", category: ALL_CATEGORIES };

      if (typeof search !== "string" || !search) return fallback;

      let params;

      try {
        params = new URLSearchParams(
          search.charAt(0) === "?" ? search.slice(1) : search
        );
      } catch (error) {
        return fallback;
      }

      const rawQuery = params.get(QUERY_PARAM) || "";
      const rawCategory = params.get(CATEGORY_PARAM) || ALL_CATEGORIES;

      /*
       * The query is echoed straight back into the search input, so it is
       * clamped here rather than trusting whatever a shared link contains.
       */
      const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);

      /*
       * An unknown category would filter the grid down to nothing with no way
       * for the user to tell why, so fall back to showing everything. The
       * check is skipped when the caller does not yet know the category list.
       */
      const category =
        Array.isArray(knownCategories) &&
        knownCategories.length &&
        rawCategory !== ALL_CATEGORIES &&
        !knownCategories.includes(rawCategory)
          ? ALL_CATEGORIES
          : rawCategory || ALL_CATEGORIES;

      return { query, category };
    }

    /**
     * Build the query string for a filter state.
     *
     * Default values are omitted so the common case stays a clean URL with no
     * query string at all.
     *
     * @param {object} state
     * @param {string} [state.query=""] Active search text.
     * @param {string} [state.category="all"] Active category slug.
     * @returns {string} `"?q=…&category=…"`, or `""` when nothing is filtered.
     */
    function serializeFilterState(state) {
      const settings = state || {};
      const query =
        typeof settings.query === "string" ? settings.query.trim() : "";
      const category = settings.category || ALL_CATEGORIES;

      const params = new URLSearchParams();

      if (query) params.set(QUERY_PARAM, query);
      if (category && category !== ALL_CATEGORIES) {
        params.set(CATEGORY_PARAM, category);
      }

      const serialized = params.toString();

      return serialized ? `?${serialized}` : "";
    }

    /**
     * Is any filter active?
     *
     * @param {object} state Filter state.
     * @returns {boolean} True when the view is not the default one.
     */
    function hasActiveFilters(state) {
      return serializeFilterState(state) !== "";
    }

    /**
     * Are two filter states equivalent?
     *
     * Used to avoid pushing a duplicate history entry when nothing changed.
     *
     * @param {object} a First state.
     * @param {object} b Second state.
     * @returns {boolean} True when both serialise identically.
     */
    function isSameState(a, b) {
      return serializeFilterState(a) === serializeFilterState(b);
    }

    /**
     * Build the URL that represents a filter state, preserving path and hash.
     *
     * @param {object} state Filter state.
     * @param {object} location A `window.location`-like object.
     * @returns {string} A path-relative URL.
     */
    function buildUrl(state, location) {
      const loc = location || {};
      const pathname = loc.pathname || "";
      const hash = loc.hash || "";

      return `${pathname}${serializeFilterState(state)}${hash}`;
    }

    /**
     * Write the filter state into the address bar.
     *
     * Uses `replaceState` while the user is typing so the Back button is not
     * buried under one entry per keystroke, and `pushState` for deliberate
     * changes such as picking a category, so Back undoes them.
     *
     * @param {object} state Filter state.
     * @param {object} [options]
     * @param {boolean} [options.push=false] Add a history entry instead of replacing.
     * @param {object} [options.historyRef=history] Injectable for tests.
     * @param {object} [options.locationRef=location] Injectable for tests.
     * @returns {boolean} True when the URL was updated.
     */
    function syncToUrl(state, options) {
      const settings = options || {};
      const historyRef =
        settings.historyRef ||
        (typeof history !== "undefined" ? history : null);
      const locationRef =
        settings.locationRef ||
        (typeof location !== "undefined" ? location : null);

      if (!historyRef || !locationRef) return false;

      const nextUrl = buildUrl(state, locationRef);
      const currentUrl = `${locationRef.pathname || ""}${locationRef.search || ""}${locationRef.hash || ""}`;

      if (nextUrl === currentUrl) return false;

      try {
        if (settings.push && typeof historyRef.pushState === "function") {
          historyRef.pushState(state, "", nextUrl);
        } else if (typeof historyRef.replaceState === "function") {
          historyRef.replaceState(state, "", nextUrl);
        } else {
          return false;
        }
      } catch (error) {
        /*
         * `file://` pages throw a SecurityError on any history mutation.
         * The filters still work, they just are not shareable there.
         */
        return false;
      }

      return true;
    }

    return {
      QUERY_PARAM,
      CATEGORY_PARAM,
      ALL_CATEGORIES,
      MAX_QUERY_LENGTH,
      parseFilterState,
      serializeFilterState,
      hasActiveFilters,
      isSameState,
      buildUrl,
      syncToUrl,
    };
  }
);
