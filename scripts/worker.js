/**
 * Filter worker.
 *
 * Runs the shared filtering logic off the main thread. The filter predicate
 * itself lives in filter-projects.js so this file and script.js cannot drift
 * apart.
 *
 * Every reply echoes back the `requestId` it was computed for. Worker replies
 * are not guaranteed to arrive in the order their messages were posted, so the
 * main thread uses that id to discard results for a query the user has already
 * typed past.
 */

importScripts("./filter-projects.js");

self.onmessage = function (e) {
  const { requestId, allProjects, selectedCategory, query } = e.data || {};

  const filtered = self.CradleFilters.filterProjects(allProjects, {
    category: selectedCategory,
    query,
  });

  self.postMessage({ requestId, projects: filtered });
};
