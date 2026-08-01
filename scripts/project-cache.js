/**
 * Cradle — Project catalog cache policy
 * ─────────────────────────────────────
 * The landing page keeps a copy of data/projects.json in IndexedDB and paints
 * from it on repeat visits. The stored record used to be `{ id, data }` with
 * no version and no timestamp, and the only check applied to it was
 * `length > 0` — so a snapshot could be served indefinitely when the network
 * refresh failed, entries written under an older shape were rendered as-is,
 * and any object in that store went straight into a link href and an <img>
 * src.
 *
 * This module owns the pure part of that policy: what a cache record looks
 * like, when it may be trusted, and what a usable project entry is. It is
 * loaded two ways:
 *
 *   browser  <script src="scripts/project-cache.js"></script>  → window.CradleProjectCache
 *   tests    require("../scripts/project-cache.js")            → module.exports
 */

(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.CradleProjectCache = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /**
   * Shape of a cached project entry. Bump this whenever data/projects.json
   * gains or renames a field the page depends on, so returning visitors fall
   * through to the network instead of rendering an entry that predates it.
   */
  const CACHE_VERSION = 1;

  /** A cached catalog older than this is refetched rather than painted. */
  const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

  const CACHE_KEY = "projects";

  /** The fields the page actually reads off a project. */
  function isUsableProject(project) {
    return Boolean(
      project &&
        typeof project.title === "string" &&
        project.title !== "" &&
        typeof project.category === "string" &&
        project.category !== "" &&
        typeof project.path === "string" &&
        project.path !== ""
    );
  }

  /**
   * Keep only entries the renderer can safely consume.
   *
   * createProjectCard() puts `path` straight into a link href and into
   * `${path}thumbnail.svg`, and getProjectUrl() feeds it to `new URL()` —
   * a missing path renders "undefined/thumbnail.svg" and a non-string one
   * throws and takes the whole render down with it.
   */
  function sanitizeProjects(projects) {
    if (!Array.isArray(projects)) return [];

    return projects.filter(isUsableProject).map(project => ({
      ...project,
      title: project.title,
      category: project.category,
      path: project.path,
    }));
  }

  /**
   * Build the record to store. `now` is injected so callers (and tests) stay
   * in control of the clock.
   */
  function createCacheEntry(projects, now = Date.now()) {
    return {
      id: CACHE_KEY,
      version: CACHE_VERSION,
      cachedAt: now,
      data: projects,
    };
  }

  /**
   * Decide whether a record read back from IndexedDB may be painted.
   *
   * @returns {{valid: boolean, reason: string}} `reason` is one of
   *   "ok" | "missing" | "version-mismatch" | "expired" | "empty"
   */
  function inspectCacheEntry(entry, options = {}) {
    const {
      version = CACHE_VERSION,
      maxAgeMs = CACHE_MAX_AGE_MS,
      now = Date.now(),
    } = options;

    if (!entry || typeof entry !== "object") {
      return { valid: false, reason: "missing" };
    }

    if (entry.version !== version) {
      return { valid: false, reason: "version-mismatch" };
    }

    if (typeof entry.cachedAt !== "number" || Number.isNaN(entry.cachedAt)) {
      return { valid: false, reason: "expired" };
    }

    // A cachedAt in the future means a clock change; treat it as untrustworthy
    // rather than as an entry that never expires.
    const age = now - entry.cachedAt;
    if (age < 0 || age > maxAgeMs) {
      return { valid: false, reason: "expired" };
    }

    if (sanitizeProjects(entry.data).length === 0) {
      return { valid: false, reason: "empty" };
    }

    return { valid: true, reason: "ok" };
  }

  function isCacheEntryValid(entry, options = {}) {
    return inspectCacheEntry(entry, options).valid;
  }

  /**
   * Usable projects from a cache record, or null when the record must not be
   * trusted — the single call the page needs.
   */
  function readCachedProjects(entry, options = {}) {
    return isCacheEntryValid(entry, options)
      ? sanitizeProjects(entry.data)
      : null;
  }

  return {
    CACHE_VERSION,
    CACHE_MAX_AGE_MS,
    CACHE_KEY,
    isUsableProject,
    sanitizeProjects,
    createCacheEntry,
    inspectCacheEntry,
    isCacheEntryValid,
    readCachedProjects,
  };
});
