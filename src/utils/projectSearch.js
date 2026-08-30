import { getSearchableCategory } from "../components/ui/utils/categoryFilter.js";

/**
 * Filter the project registry using the same rules on either execution path.
 * Keeping this pure makes the main-thread fallback and worker behaviour identical.
 */
export function filterProjects(allProjects, selectedCategory, query) {
  return allProjects.filter(
    project =>
      (selectedCategory === "all" || project.category === selectedCategory) &&
      (project.title.toLowerCase().includes(query) ||
        getSearchableCategory(project.category).includes(query))
  );
}
