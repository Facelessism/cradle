/**
 * Cradle — Project filtering Web Worker
 * ─────────────────────────────────────
 * Runs the project filter off the main thread so typing in the search box
 * never blocks rendering.
 *
 * The filtering itself lives in `projectFilter.js` and is shared with the
 * main-thread fallback in `script.js`, so both paths always agree.
 */

importScripts("./projectFilter.js");

self.onmessage = function (event) {
  const payload = event.data || {};

  try {
    const filtered = self.CradleProjectFilter.filterProjects(
      payload.allProjects,
      {
        selectedCategory: payload.selectedCategory,
        query: payload.query,
      }
    );

    self.postMessage({
      ok: true,
      requestId: payload.requestId,
      projects: filtered,
    });
  } catch (error) {
    /*
     * Report the failure instead of letting it bubble up as an uncaught
     * worker error. The main thread can then fall back to filtering locally
     * rather than leaving the grid stuck on stale results.
     */
    self.postMessage({
      ok: false,
      requestId: payload.requestId,
      error: String((error && error.message) || error),
    });
  }
};
