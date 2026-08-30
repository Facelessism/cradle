import { filterProjects } from "../src/utils/projectSearch.js";

self.onmessage = function (e) {
  const { allProjects, selectedCategory, query } = e.data;
  self.postMessage(filterProjects(allProjects, selectedCategory, query));
};
