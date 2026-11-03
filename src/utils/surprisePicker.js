import { filterProjects } from "./projectSearch.js";

export const LAST_SURPRISE_PICK_KEY = "cradle:surprise-last-pick";

/**
 * Retrieves the eligible candidate projects for surprise picking based on the
 * active category filter and optional search query.
 *
 * @param {Array<object>} allProjects - Full list of loaded projects
 * @param {string} [selectedCategory="all"] - Active category filter
 * @param {string} [query=""] - Active search query
 * @returns {Array<object>} Filtered list of candidate projects
 */
export function getEligibleProjects(
  allProjects,
  selectedCategory = "all",
  query = ""
) {
  return filterProjects(allProjects, selectedCategory, query);
}

/**
 * Selects a random project from a candidate list, avoiding repeating the
 * immediately previous pick whenever more than one candidate is available.
 * Persists the picked project's path via CradleStorage or a compatible Storage adapter.
 *
 * @param {Array<object>} projects - List of candidate project objects
 * @param {object} [storage] - CradleStorage or compatible Storage interface
 * @param {Function} [randomFn] - RNG function returning a float in [0, 1) (defaults to Math.random)
 * @returns {object|null} The picked project or null if candidate list is empty
 */
export function pickSurpriseProject(
  projects,
  storage = typeof window !== "undefined" && window.CradleStorage
    ? window.CradleStorage
    : null,
  randomFn = Math.random
) {
  if (!Array.isArray(projects) || projects.length === 0) {
    return null;
  }

  // Filter to valid project items with a non-empty string path
  const validProjects = projects.filter(
    p => p && typeof p.path === "string" && p.path.trim().length > 0
  );

  if (validProjects.length === 0) {
    return null;
  }

  // If only 1 project is available, return it directly and record it
  if (validProjects.length === 1) {
    const only = validProjects[0];
    saveLastPick(storage, only.path);
    return only;
  }

  const lastPickedPath = getLastPick(storage);

  // Filter out the last picked project to avoid repeating the last pick
  const unpicked = validProjects.filter(p => p.path !== lastPickedPath);
  const pool = unpicked.length > 0 ? unpicked : validProjects;

  const rawRandom = typeof randomFn === "function" ? randomFn() : Math.random();
  const safeRandom =
    typeof rawRandom === "number" && !Number.isNaN(rawRandom) ? rawRandom : 0;
  const index = Math.min(
    Math.floor(Math.abs(safeRandom) * pool.length),
    pool.length - 1
  );

  const picked = pool[index] || pool[0];
  if (picked) {
    saveLastPick(storage, picked.path);
  }

  return picked;
}

function getLastPick(storage) {
  if (!storage) return null;
  try {
    if (typeof storage.get === "function") {
      return storage.get(LAST_SURPRISE_PICK_KEY, null);
    }
    if (typeof storage.getItem === "function") {
      return storage.getItem(LAST_SURPRISE_PICK_KEY);
    }
  } catch {
    return null;
  }
  return null;
}

function saveLastPick(storage, path) {
  if (!storage || !path) return;
  try {
    if (typeof storage.set === "function") {
      storage.set(LAST_SURPRISE_PICK_KEY, path);
    } else if (typeof storage.setItem === "function") {
      storage.setItem(LAST_SURPRISE_PICK_KEY, path);
    }
  } catch {
    // Graceful degradation when storage is quota-exhausted or disabled
  }
}
