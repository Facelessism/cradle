import { getSearchableCategory } from "../components/ui/utils/categoryFilter.js";

/**
 * Computes the Levenshtein distance between two strings.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b ? b.length : 0;
  if (!b) return a ? a.length : 0;

  const aLen = a.length;
  const bLen = b.length;

  let prevRow = new Array(bLen + 1);
  let currRow = new Array(bLen + 1);

  for (let j = 0; j <= bLen; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= aLen; i++) {
    currRow[0] = i;
    const aChar = a.charCodeAt(i - 1);
    for (let j = 1; j <= bLen; j++) {
      const cost = aChar === b.charCodeAt(j - 1) ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost // substitution
      );
    }
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[bLen];
}

/**
 * Extracts searchable word tokens from a string.
 *
 * @param {string} str
 * @returns {string[]}
 */
function extractWords(str) {
  if (typeof str !== "string") return [];
  return str
    .toLowerCase()
    .replace(/[^\w\s+#.-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Normalizes tags from a project object (supports array of strings, comma-separated string, or keywords).
 *
 * @param {Object} project
 * @returns {string[]}
 */
function getProjectTags(project) {
  if (!project) return [];
  if (Array.isArray(project.tags)) {
    return project.tags.filter(t => typeof t === "string");
  }
  if (typeof project.tags === "string") {
    return project.tags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
  }
  if (Array.isArray(project.keywords)) {
    return project.keywords.filter(k => typeof k === "string");
  }
  return [];
}

/**
 * Checks whether any word in the list matches the term within a Levenshtein distance <= 1.
 * Only applied for terms over 4 letters (length > 4).
 *
 * @param {string[]} words
 * @param {string} term
 * @returns {boolean}
 */
function matchesFuzzy(words, term) {
  if (typeof term !== "string" || term.length <= 4) return false;
  const termLower = term.toLowerCase();
  for (const word of words) {
    if (Math.abs(word.length - termLower.length) <= 1) {
      if (levenshteinDistance(word, termLower) <= 1) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calculates a weighted relevance score for a project against a search query.
 *
 * Scoring Hierarchy:
 * Exact title match (1000)
 * > Title prefix match (800 / 600)
 * > Title substring match (500)
 * > Title fuzzy match (400)
 * > Tag exact/prefix match (300 / 200)
 * > Tag fuzzy match (150)
 * > Category match (120 / 100)
 * > Description substring match (50 / 40)
 * > Description fuzzy match (20)
 *
 * @param {Object} project
 * @param {string} query
 * @returns {number} Score > 0 if matched, 0 if no match.
 */
export function computeRelevanceScore(project, query) {
  if (!project || typeof query !== "string") return 0;
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  const title =
    typeof project.title === "string" ? project.title.toLowerCase().trim() : "";
  const description =
    typeof project.description === "string"
      ? project.description.toLowerCase().trim()
      : "";
  const category =
    typeof project.category === "string"
      ? project.category.toLowerCase().trim()
      : "";
  const searchableCat =
    typeof project.category === "string"
      ? getSearchableCategory(project.category)
      : "";

  const tags = getProjectTags(project);

  let titleScore = 0;
  let tagScore = 0;
  let catScore = 0;
  let descScore = 0;

  // 1. Title matching
  if (title) {
    if (title === q) {
      titleScore = 1000;
    } else if (title.startsWith(q)) {
      titleScore = 800;
    } else {
      const titleWords = extractWords(title);
      if (titleWords.some(w => w.startsWith(q))) {
        titleScore = 600;
      } else if (title.includes(q)) {
        titleScore = 500;
      } else if (q.length > 4 && matchesFuzzy(titleWords, q)) {
        titleScore = 400;
      }
    }
  }

  // 2. Tag matching
  if (tags.length > 0) {
    for (const tag of tags) {
      const t = tag.toLowerCase().trim();
      if (t === q) {
        tagScore = Math.max(tagScore, 300);
      } else if (t.startsWith(q) || t.includes(q)) {
        tagScore = Math.max(tagScore, 200);
      } else if (
        q.length > 4 &&
        Math.abs(t.length - q.length) <= 1 &&
        levenshteinDistance(t, q) <= 1
      ) {
        tagScore = Math.max(tagScore, 150);
      }
    }
  }

  // 3. Category matching
  if (category) {
    if (category === q || searchableCat === q) {
      catScore = 120;
    } else if (category.includes(q) || searchableCat.includes(q)) {
      catScore = 100;
    }
  }

  // 4. Description matching
  if (description) {
    if (description.includes(q)) {
      descScore = 50;
    } else {
      const descWords = extractWords(description);
      if (descWords.some(w => w.startsWith(q))) {
        descScore = 40;
      } else if (q.length > 4 && matchesFuzzy(descWords, q)) {
        descScore = 20;
      }
    }
  }

  // If multi-term query and no direct overall match, check each term
  const terms = q.split(/\s+/).filter(Boolean);
  if (
    terms.length > 1 &&
    titleScore + tagScore + catScore + descScore === 0
  ) {
    let allTermsMatch = true;
    let combinedScore = 0;
    const titleWords = extractWords(title);
    const descWords = extractWords(description);

    for (const term of terms) {
      let termMatched = false;
      if (
        title &&
        (title.includes(term) ||
          (term.length > 4 && matchesFuzzy(titleWords, term)))
      ) {
        combinedScore += 50;
        termMatched = true;
      } else if (
        tags.some(
          t =>
            t.toLowerCase().includes(term) ||
            (term.length > 4 &&
              Math.abs(t.length - term.length) <= 1 &&
              levenshteinDistance(t.toLowerCase(), term) <= 1)
        )
      ) {
        combinedScore += 30;
        termMatched = true;
      } else if (
        category &&
        (category.includes(term) || searchableCat.includes(term))
      ) {
        combinedScore += 20;
        termMatched = true;
      } else if (
        description &&
        (description.includes(term) ||
          (term.length > 4 && matchesFuzzy(descWords, term)))
      ) {
        combinedScore += 10;
        termMatched = true;
      }

      if (!termMatched) {
        allTermsMatch = false;
        break;
      }
    }

    if (allTermsMatch) {
      return combinedScore;
    }
    return 0;
  }

  const primaryScore = Math.max(titleScore, tagScore, catScore, descScore);
  if (primaryScore === 0) return 0;

  // Add small composite bonus for multi-field hits
  let bonus = 0;
  if (titleScore > 0 && descScore > 0) bonus += 5;
  if (titleScore > 0 && tagScore > 0) bonus += 5;

  return primaryScore + bonus;
}

/**
 * Filter and rank the project registry using relevance scoring and single-character typo tolerance.
 * Keeping this pure makes the main-thread fallback and worker behaviour identical.
 *
 * @param {Array<Object>} allProjects
 * @param {string} selectedCategory
 * @param {string} query
 * @returns {Array<Object>}
 */
export function filterProjects(allProjects, selectedCategory, query) {
  if (!Array.isArray(allProjects)) return [];
  const q = typeof query === "string" ? query.toLowerCase().trim() : "";
  const cat =
    typeof selectedCategory === "string"
      ? selectedCategory.toLowerCase().trim()
      : "all";

  // Filter by category first
  const categoryMatched = [];
  for (let i = 0; i < allProjects.length; i++) {
    const project = allProjects[i];
    if (!project) continue;
    const projectCategory =
      typeof project.category === "string"
        ? project.category.toLowerCase().trim()
        : "";
    const matchesCategory = cat === "all" || projectCategory === cat;
    if (matchesCategory) {
      categoryMatched.push({ project, originalIndex: i });
    }
  }

  // If no query, return projects in original order
  if (!q) {
    return categoryMatched.map(item => item.project);
  }

  // Score matching projects
  const scored = [];
  for (const item of categoryMatched) {
    const score = computeRelevanceScore(item.project, q);
    if (score > 0) {
      scored.push({
        project: item.project,
        score,
        originalIndex: item.originalIndex,
      });
    }
  }

  // Sort by score descending; break ties by originalIndex ascending (stable sort)
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.originalIndex - b.originalIndex;
  });

  return scored.map(item => item.project);
}
