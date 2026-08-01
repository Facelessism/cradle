/**
 * Cradle — "Recently Opened" reconciliation
 * ─────────────────────────────────────────
 * The recently-opened list is a snapshot written to localStorage at the moment
 * a project card is clicked. Nothing keeps that snapshot in step with the
 * catalog, so once a project is renamed, re-categorised or removed the stored
 * copy silently rots: its "Open Project" link 404s, its thumbnail request
 * fails, and it shows a title the main grid no longer uses.
 *
 * This module holds the pure part of the fix. It is loaded three ways:
 *
 *   browser  <script src="scripts/recent-projects.js"></script>  → window.CradleRecentProjects
 *   tests    require("../scripts/recent-projects.js")            → module.exports
 *
 * `path` is the identity of a project — it is what the card links to and what
 * de-duplication already keys on in script.js.
 */

(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.CradleRecentProjects = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const RECENT_PROJECTS_LIMIT = 5;

  function isUsableEntry(entry) {
    return Boolean(
      entry &&
        typeof entry.title === "string" &&
        typeof entry.category === "string" &&
        typeof entry.path === "string" &&
        entry.path !== ""
    );
  }

  /**
   * Keep only well-formed entries, drop duplicate paths (first wins, because
   * the list is most-recent-first) and cap the length.
   */
  function sanitizeRecentProjects(entries, limit = RECENT_PROJECTS_LIMIT) {
    if (!Array.isArray(entries)) return [];

    const seenPaths = new Set();
    const cleaned = [];

    for (const entry of entries) {
      if (!isUsableEntry(entry)) continue;
      if (seenPaths.has(entry.path)) continue;

      seenPaths.add(entry.path);
      cleaned.push({
        title: entry.title,
        category: entry.category,
        path: entry.path,
        dateAdded: entry.dateAdded || null,
      });

      if (cleaned.length >= limit) break;
    }

    return cleaned;
  }

  /**
   * Reconcile stored recent entries against the live catalog.
   *
   * - Entries whose `path` is no longer in the catalog are dropped.
   * - Surviving entries take their title, category and dateAdded from the
   *   catalog, so a renamed or re-categorised project cannot show up twice
   *   under two different names on the same page.
   * - Recency order is preserved.
   *
   * An empty or missing catalog is treated as "not loaded yet" and returns the
   * sanitized list unchanged — the catalog arrives asynchronously and must
   * never be able to wipe the user's history just because it has not landed.
   *
   * @param {Array<Object>} storedEntries
   * @param {Array<Object>} catalog
   * @param {{limit?: number}} [options]
   * @returns {{entries: Array<Object>, changed: boolean, removed: Array<Object>}}
   */
  function reconcileRecentProjects(storedEntries, catalog, options = {}) {
    const { limit = RECENT_PROJECTS_LIMIT } = options;
    const sanitized = sanitizeRecentProjects(storedEntries, limit);

    if (!Array.isArray(catalog) || catalog.length === 0) {
      return {
        entries: sanitized,
        changed: !sameEntries(storedEntries, sanitized),
        removed: [],
      };
    }

    const byPath = new Map();
    for (const project of catalog) {
      if (project && typeof project.path === "string") {
        byPath.set(project.path, project);
      }
    }

    const entries = [];
    const removed = [];

    for (const entry of sanitized) {
      const current = byPath.get(entry.path);

      if (!current) {
        removed.push(entry);
        continue;
      }

      entries.push({
        title: current.title,
        category: current.category,
        path: current.path,
        dateAdded: current.dateAdded || null,
      });
    }

    return {
      entries,
      changed: !sameEntries(storedEntries, entries),
      removed,
    };
  }

  /** Shallow structural comparison, used to avoid pointless localStorage writes. */
  function sameEntries(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;

    return a.every((entry, index) => {
      const other = b[index];
      return (
        Boolean(entry) &&
        Boolean(other) &&
        entry.title === other.title &&
        entry.category === other.category &&
        entry.path === other.path &&
        (entry.dateAdded || null) === (other.dateAdded || null)
      );
    });
  }

  return {
    RECENT_PROJECTS_LIMIT,
    isUsableEntry,
    sanitizeRecentProjects,
    reconcileRecentProjects,
    sameEntries,
  };
});
