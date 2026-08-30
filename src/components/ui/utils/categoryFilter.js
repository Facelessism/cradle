/**
 * Shared utility functions for category labeling and search filtering.
 */

export function formatCategoryLabel(category) {
  if (!category || typeof category !== "string") return "";
  return category.toUpperCase().replace(/-/g, " ");
}

export function getSearchableCategory(category) {
  if (!category || typeof category !== "string") return "";
  return `${category} ${formatCategoryLabel(category)}`.toLowerCase();
}
