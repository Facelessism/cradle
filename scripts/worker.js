import { filterProjects } from "../src/utils/projectSearch.js";
import { isFilterRequest } from "../src/utils/messageValidation.js";

self.onmessage = function (e) {
  const data = e.data || {};

  // Never feed a malformed request into the search pipeline.
  if (!isFilterRequest(data)) {
    self.postMessage([]);
    return;
  }

  const { allProjects, selectedCategory, query } = data;
  self.postMessage(filterProjects(allProjects, selectedCategory, query));
};
