/**
 * Utilities for synchronizing gallery filter state with URL parameters and document title.
 */

export const SEARCH_QUERY_PARAM = "q";
export const CATEGORY_QUERY_PARAM = "category";
export const DEFAULT_PAGE_TITLE = "Cradle";

const KNOWN_CATEGORY_TITLES = {
  aiml: "AI / ML",
  "dev-tools": "Dev Tools",
  "file-tools": "File Tools",
  math: "Math",
  games: "Games",
  instruments: "Instruments",
  editor: "Editor",
  misc: "Misc",
  productivity: "Productivity",
};

/**
 * Formats a category slug into a user-friendly display title.
 * @param {string} category - Category slug (e.g. "dev-tools", "games")
 * @returns {string} - Formatted title (e.g. "Dev Tools", "Games")
 */
export function formatCategoryTitle(category) {
  if (!category || typeof category !== "string") return "";
  const lower = category.toLowerCase().trim();
  if (KNOWN_CATEGORY_TITLES[lower]) {
    return KNOWN_CATEGORY_TITLES[lower];
  }
  return lower
    .split(/[-_]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Computes the page title based on the active search query and selected category.
 * @param {Object} options
 * @param {string} [options.query=""] - Active search query
 * @param {string} [options.selectedCategory="all"] - Selected category slug
 * @param {string} [options.baseTitle=DEFAULT_PAGE_TITLE] - Base site title
 * @returns {string} - Document title to set
 */
export function computePageTitle({
  query = "",
  selectedCategory = "all",
  category = "",
  baseTitle = DEFAULT_PAGE_TITLE,
} = {}) {
  const trimmedQuery = typeof query === "string" ? query.trim() : "";
  const hasQuery = trimmedQuery.length > 0;
  const rawCat = (category && category !== "all" ? category : selectedCategory) || "all";
  const isAllCategory =
    !rawCat ||
    typeof rawCat !== "string" ||
    rawCat.toLowerCase().trim() === "all" ||
    rawCat.trim() === "";
  const hasCategory = !isAllCategory;

  const categoryLabel = hasCategory
    ? formatCategoryTitle(rawCat)
    : "";

  if (hasQuery && hasCategory) {
    return `Search: "${trimmedQuery}" in ${categoryLabel} | ${baseTitle}`;
  }
  if (hasQuery) {
    return `Search: "${trimmedQuery}" | ${baseTitle}`;
  }
  if (hasCategory) {
    return `${categoryLabel} | ${baseTitle}`;
  }
  return baseTitle;
}

/**
 * Parses filter state (search query and category) from a URL search string.
 * @param {string} searchString - e.g. "?q=chess&category=games"
 * @returns {{ query: string, category: string }}
 */
export function parseFilterStateFromUrl(searchString = "") {
  try {
    const params = new URLSearchParams(searchString);
    const rawQuery = params.get(SEARCH_QUERY_PARAM);
    const rawCategory = params.get(CATEGORY_QUERY_PARAM);

    const query = rawQuery && typeof rawQuery === "string" ? rawQuery.trim() : "";
    const category =
      rawCategory &&
      typeof rawCategory === "string" &&
      rawCategory.trim().length > 0
        ? rawCategory.toLowerCase().trim()
        : "all";

    return { query, category };
  } catch {
    return { query: "", category: "all" };
  }
}

/**
 * Constructs the target URL preserving existing path, hash, and non-filter search params.
 * @param {string} pathname - window.location.pathname
 * @param {string} searchString - window.location.search
 * @param {string} hash - window.location.hash
 * @param {Object} filterState - { query, selectedCategory }
 * @returns {string} - Full next URL
 */
export function buildFilterUrl(
  pathname = "/",
  searchString = "",
  hash = "",
  { query = "", selectedCategory = "all", category = "" } = {}
) {
  try {
    const params = new URLSearchParams(searchString);
    const trimmedQuery = typeof query === "string" ? query.trim() : "";

    if (trimmedQuery) {
      params.set(SEARCH_QUERY_PARAM, trimmedQuery);
    } else {
      params.delete(SEARCH_QUERY_PARAM);
    }

    const rawCategory = (category && category !== "all" ? category : selectedCategory) || "all";
    const cleanCategory =
      typeof rawCategory === "string"
        ? rawCategory.toLowerCase().trim()
        : "all";

    if (cleanCategory && cleanCategory !== "all") {
      params.set(CATEGORY_QUERY_PARAM, cleanCategory);
    } else {
      params.delete(CATEGORY_QUERY_PARAM);
    }

    const qs = params.toString();
    return `${pathname}${qs ? `?${qs}` : ""}${hash || ""}`;
  } catch {
    return pathname;
  }
}
