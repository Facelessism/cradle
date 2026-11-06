import {
  formatCategoryLabel,
  getSearchableCategory,
} from "./src/components/ui/utils/categoryFilter.js";
import { filterProjects } from "./src/utils/projectSearch.js";
import { getThumbnailUrl } from "./src/utils/assetUrl.js";
import {
  openDB,
  getCachedProjects,
  fetchAndCacheProjects as fetchAndCacheProjectsDB,
  subscribeToSync,
} from "./src/utils/cradleDb.js";
import {
  createFilterWorker,
  DEFAULT_WORKER_RETRY_CONFIG,
  calculateBackoffDelay,
} from "./src/utils/filterWorker.js";
import {
  sanitizeProject,
  sanitizeProjectList,
} from "./src/utils/projectSanitizer.js";
import { registerServiceWorker } from "./src/utils/serviceWorkerRegistration.js";

const projectsGrid = document.getElementById("projects-grid");
const searchInput = document.getElementById("search");
const categoriesContainer = document.getElementById("categories");
const projectCount = document.getElementById("project-count");
const clearFiltersBtn = document.getElementById("clear-filters");
const searchSuggestions = document.getElementById("search-suggestions");
const recentProjectsSection = document.getElementById(
  "recent-projects-section"
);
const recentProjectsGrid = document.getElementById("recent-projects-grid");
const clearRecentProjectsBtn = document.getElementById("clear-recent-projects");
const toggleRecentProjectsBtn = document.getElementById(
  "toggle-recent-projects"
);

const clearSearch = document.querySelector("#clearSearch");

function updateClearSearchButton() {
  clearSearch.hidden = searchInput.value.trim() === "";
}

searchInput.addEventListener("input", () => {
  updateClearSearchButton();
});

clearSearch.addEventListener("click", () => {
  searchInput.value = "";

  // Trigger the existing search/filter logic
  searchInput.dispatchEvent(new Event("input", { bubbles: true }));

  searchInput.focus();

  updateClearSearchButton();
});

updateClearSearchButton();

let allProjects = [];
let selectedCategory = "all";
let activeSuggestionIndex = -1;
let currentSuggestions = [];
let activeCardIndex = -1;

function clearActiveCard() {
  activeCardIndex = -1;
  if (projectsGrid) {
    const cards = projectsGrid.querySelectorAll(".cradle-card");
    cards.forEach(card => {
      card.classList.remove("keyboard-active");
      card.setAttribute("aria-selected", "false");
    });
  }
  if (searchInput) {
    searchInput.removeAttribute("aria-activedescendant");
  }
}

function updateActiveCard(index) {
  if (!projectsGrid) return;
  const cards = Array.from(projectsGrid.querySelectorAll(".cradle-card"));
  if (!cards.length) {
    clearActiveCard();
    return;
  }

  if (index < 0) {
    activeCardIndex = cards.length - 1;
  } else if (index >= cards.length) {
    activeCardIndex = 0;
  } else {
    activeCardIndex = index;
  }

  cards.forEach((card, idx) => {
    const isActive = idx === activeCardIndex;
    card.classList.toggle("keyboard-active", isActive);
    card.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const activeCard = cards[activeCardIndex];
  if (activeCard && searchInput) {
    searchInput.setAttribute("aria-activedescendant", activeCard.id);
    if (typeof activeCard.scrollIntoView === "function") {
      activeCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
}

function openHighlightedProject(card) {
  if (!card) return;
  const openLink = card.querySelector(
    "a[href], button[data-variant='outline'], .cradle-btn"
  );
  if (openLink && typeof openLink.click === "function") {
    openLink.click();
  } else if (openLink && openLink.href) {
    window.location.href = openLink.href;
  }
}

const SEARCH_QUERY_PARAM = "q";
const CATEGORY_QUERY_PARAM = "category";

function restoreFiltersFromUrl() {
  if (typeof window === "undefined" || !window.location) return;
  const params = new URLSearchParams(window.location.search);
  const query = params.get(SEARCH_QUERY_PARAM);
  const category = params.get(CATEGORY_QUERY_PARAM);

  if (query && searchInput) {
    searchInput.value = query;
    updateClearSearchButton();
  }

  if (category) {
    selectedCategory = category.toLowerCase().trim();
  }
}

function updateUrlFilterState() {
  if (typeof window === "undefined" || !window.location || !window.history)
    return;
  const params = new URLSearchParams(window.location.search);
  const query = searchInput ? searchInput.value.trim() : "";

  if (query) {
    params.set(SEARCH_QUERY_PARAM, query);
  } else {
    params.delete(SEARCH_QUERY_PARAM);
  }

  if (selectedCategory && selectedCategory !== "all") {
    params.set(CATEGORY_QUERY_PARAM, selectedCategory);
  } else {
    params.delete(CATEGORY_QUERY_PARAM);
  }

  const queryString = params.toString();
  const nextUrl = `${window.location.pathname}${
    queryString ? `?${queryString}` : ""
  }${window.location.hash || ""}`;

  const currentUrl = `${window.location.pathname}${window.location.search}${
    window.location.hash || ""
  }`;

  if (
    nextUrl !== currentUrl &&
    typeof window.history.replaceState === "function"
  ) {
    window.history.replaceState(null, "", nextUrl);
  }
}

function validateSelectedCategory() {
  const categories = new Set(
    allProjects
      .map(project =>
        project && typeof project.category === "string"
          ? project.category.toLowerCase().trim()
          : ""
      )
      .filter(Boolean)
  );

  if (
    selectedCategory !== "all" &&
    !categories.has(selectedCategory.toLowerCase().trim())
  ) {
    selectedCategory = "all";
  }
}
const copyStatus = document.getElementById("copy-status");
const RECENT_PROJECTS_KEY = "cradle:recent-projects";
const RECENT_PROJECTS_COLLAPSED_KEY = "cradle:recent-projects-collapsed";
const RECENT_PROJECTS_LIMIT = 5;
const sortProjects = document.getElementById("sort-projects");
const shortcutHint = document.querySelector(".keyboard-hint");
const loadStatus = document.getElementById("load-status");

if (shortcutHint) {
  shortcutHint.textContent = "/ or Ctrl + K";
}

const FILTER_DEBOUNCE_DELAY = 250;
let filterDebounceTimer;

if (sortProjects) {
  sortProjects.addEventListener("change", applyFilters);
}

let filterWorker = null;
let filterWorkerFailed = false;
let workerRetryCount = 0;
let workerRetryTimer = null;

function debouncedApplyFilters() {
  window.clearTimeout(filterDebounceTimer);

  filterDebounceTimer = window.setTimeout(() => {
    applyFilters();
  }, FILTER_DEBOUNCE_DELAY);
}

// Worker creation is centralized in initializeFilterWorker() below, which
// hardens the channel (payload validation + fallback) and creates a module
// worker.

function handleFilterWorkerFailure(error, reason = "Worker error") {
  console.warn(`${reason}, falling back to main thread:`, error);
  filterWorker = null;

  // Immediate fallback to main thread to satisfy current search query
  applyFilters();

  if (workerRetryCount < DEFAULT_WORKER_RETRY_CONFIG.maxRetries) {
    const delay = calculateBackoffDelay(
      workerRetryCount,
      DEFAULT_WORKER_RETRY_CONFIG
    );
    console.warn(
      `Scheduling FilterWorker restart attempt ${workerRetryCount + 1}/${DEFAULT_WORKER_RETRY_CONFIG.maxRetries} in ${delay}ms`
    );
    workerRetryCount++;

    if (workerRetryTimer) {
      window.clearTimeout(workerRetryTimer);
    }
    workerRetryTimer = window.setTimeout(() => {
      workerRetryTimer = null;
      initializeFilterWorker();
    }, delay);
  } else {
    console.warn(
      `FilterWorker exceeded maximum retry limit (${DEFAULT_WORKER_RETRY_CONFIG.maxRetries}). Permanently falling back to main thread.`
    );
    filterWorkerFailed = true;
  }
}

/*
  console.warn(`${reason}, falling back to main thread:`, error);
  filterWorkerFailed = true;
  filterWorker = null;
  applyFilters();
}

*/
function initializeFilterWorker() {
  if (!window.Worker || filterWorkerFailed) return;

  filterWorker = createFilterWorker({
    // No workerFactory: the default builds `new Worker("./scripts/worker.js")`.
    onResult: projects => {
      workerRetryCount = 0;
      renderProjects(sortProjectList(sanitizeProjectList(projects)));
    },
    onFailure: error => {
      handleFilterWorkerFailure(error, "Worker execution failed");
    },
  });
}

initializeFilterWorker();

function sortProjectList(projects) {
  const sorted = [...projects];

  switch (sortProjects?.value) {
    case "name-asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));

    case "name-desc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title));

    case "category":
      return sorted.sort(
        (a, b) =>
          a.category.localeCompare(b.category) || a.title.localeCompare(b.title)
      );

    case "newest":
      return sorted.sort((a, b) => {
        const dateA = a.dateAdded ? new Date(a.dateAdded).getTime() : NaN;
        const dateB = b.dateAdded ? new Date(b.dateAdded).getTime() : NaN;

        if (Number.isNaN(dateA) && Number.isNaN(dateB)) {
          return a.title.localeCompare(b.title);
        }

        if (Number.isNaN(dateA)) return 1;
        if (Number.isNaN(dateB)) return -1;

        return dateB - dateA || a.title.localeCompare(b.title);
      });

    case "oldest":
      return sorted.sort((a, b) => {
        const dateA = a.dateAdded ? new Date(a.dateAdded).getTime() : NaN;
        const dateB = b.dateAdded ? new Date(b.dateAdded).getTime() : NaN;

        if (Number.isNaN(dateA) && Number.isNaN(dateB)) {
          return a.title.localeCompare(b.title);
        }

        if (Number.isNaN(dateA)) return 1;
        if (Number.isNaN(dateB)) return -1;

        return dateA - dateB || a.title.localeCompare(b.title);
      });

    default:
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
  }
}

async function fetchAndCacheProjects(db) {
  const data = await fetchAndCacheProjectsDB(db);
  allProjects = data;
  return data;
}

async function loadProjects() {
  try {
    if (loadStatus) loadStatus.textContent = "Loading projects\u2026";
    let db;

    try {
      db = await openDB();

      const cachedProjects = await getCachedProjects(db);

      if (cachedProjects && cachedProjects.length > 0) {
        allProjects = sanitizeProjectList(cachedProjects);

        validateSelectedCategory();
        renderCategories();
        applyFilters();
        if (loadStatus)
          loadStatus.textContent = `${allProjects.length} projects loaded.`;

        fetchAndCacheProjects(db)
          .then(() => {
            validateSelectedCategory();
            renderCategories();
            applyFilters();
          })
          .catch(console.error);

        return;
      }
    } catch (e) {
      console.warn("IndexedDB error:", e);
    }

    await fetchAndCacheProjects(db);

    validateSelectedCategory();
    renderCategories();
    applyFilters();
    if (loadStatus)
      loadStatus.textContent = `${allProjects.length} projects loaded.`;
  } catch (error) {
    console.error(error);
    projectsGrid.innerHTML = "<p>Failed to load projects.</p>";
    if (loadStatus) loadStatus.textContent = "Failed to load projects.";
  }
}

function renderCategories() {
  const categories = [
    "all",
    ...new Set(allProjects.map(project => project.category).filter(Boolean)),
  ];

  categoriesContainer.innerHTML = "";

  categories.forEach(category => {
    const isActive = category === selectedCategory;
    const label = formatCategoryLabel(category);
    const btn = CradleButton.create({
      variant: isActive ? "primary" : "ghost",
      size: "sm",
      children: label,
      ariaLabel: `${label} projects`,
      onClick: () => {
        selectedCategory = category;
        applyFilters();
        renderCategories();
        searchInput.focus();
      },
    });

    btn.setAttribute("aria-pressed", isActive ? "true" : "false");

    categoriesContainer.appendChild(btn);
  });
}

function isNewProject(dateAdded) {
  if (!dateAdded) return false;
  const diffDays = (Date.now() - new Date(dateAdded)) / 86400000;
  return diffDays <= 7;
}

function getRecentProjects() {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return sanitizeProjectList(parsed).slice(0, RECENT_PROJECTS_LIMIT);
  } catch (error) {
    console.warn("Failed to load recently opened projects:", error);
    return [];
  }
}

function saveRecentProjects(projects) {
  try {
    const safe = sanitizeProjectList(projects);
    localStorage.setItem(
      RECENT_PROJECTS_KEY,
      JSON.stringify(safe.slice(0, RECENT_PROJECTS_LIMIT))
    );
  } catch (error) {
    console.warn("Failed to save recently opened projects:", error);
  }
}

function getRecentProjectsCollapsed() {
  try {
    return localStorage.getItem(RECENT_PROJECTS_COLLAPSED_KEY) === "true";
  } catch (error) {
    console.warn("Failed to load recently opened collapse state:", error);
    return false;
  }
}

function saveRecentProjectsCollapsed(isCollapsed) {
  try {
    localStorage.setItem(RECENT_PROJECTS_COLLAPSED_KEY, String(isCollapsed));
  } catch (error) {
    console.warn("Failed to save recently opened collapse state:", error);
  }
}

function setRecentProjectsCollapsed(isCollapsed) {
  if (!recentProjectsSection || !recentProjectsGrid) return;

  recentProjectsSection.classList.toggle("is-collapsed", isCollapsed);
  recentProjectsGrid.hidden = isCollapsed;

  if (toggleRecentProjectsBtn) {
    toggleRecentProjectsBtn.textContent = isCollapsed ? "Expand" : "Collapse";
    toggleRecentProjectsBtn.setAttribute(
      "aria-expanded",
      isCollapsed ? "false" : "true"
    );
    toggleRecentProjectsBtn.setAttribute(
      "aria-label",
      `${isCollapsed ? "Expand" : "Collapse"} recently opened projects`
    );
  }
}

function recordRecentlyOpenedProject(project) {
  const clean = sanitizeProject(project);
  if (!clean) return;

  const recentProject = {
    title: clean.title,
    category: clean.category,
    path: clean.path,
    dateAdded: clean.dateAdded || null,
  };

  const existingProjects = getRecentProjects().filter(
    item => item.path !== recentProject.path
  );

  saveRecentProjects([recentProject, ...existingProjects]);
  renderRecentProjects();
}

function clearRecentProjects() {
  try {
    localStorage.removeItem(RECENT_PROJECTS_KEY);
  } catch (error) {
    console.warn("Failed to clear recently opened projects:", error);
  }

  renderRecentProjects();
}

function createProjectCard(rawProject, options = {}) {
  const project = sanitizeProject(rawProject);
  if (!project) {
    console.warn("Skipping invalid project metadata:", rawProject);
    return document.createComment("invalid project");
  }

  const { onOpen = null, recent = false } = options;

  const openButton = CradleButton.create({
    variant: "outline",
    size: "sm",
    children: "Open Project",
    rightIcon: "→",
    href: project.path,
    target: "_self",
    rel: "noopener noreferrer",
    ariaLabel: `Open ${project.title}`,
  });

  openButton.addEventListener("click", () => {
    if (onOpen) onOpen(project);
  });

  const copyButton = CradleButton.create({
    variant: "ghost",
    size: "sm",
    children: "Copy Link",
    ariaLabel: `Copy direct link to ${project.title}`,
    onClick: () => copyProjectUrl(project, copyButton),
  });

  const card = CradleCard.create({
    title: project.title,
    subtitle: project.path,
    badge: project.category,
    isNew: isNewProject(project.dateAdded),
    image: getThumbnailUrl(project),
    imageWidth: 1200,
    imageHeight: 675,
    imageLoading: "lazy",
    footer: [openButton, copyButton],
    footerAlign: "left",
    className: recent ? "recent-project-card" : "",
  });

  return card;
}

function renderRecentProjects() {
  if (!recentProjectsSection || !recentProjectsGrid) return;

  const recentProjects = getRecentProjects();

  recentProjectsSection.hidden = recentProjects.length === 0;
  setRecentProjectsCollapsed(getRecentProjectsCollapsed());
  recentProjectsGrid.innerHTML = "";

  recentProjects.forEach(project => {
    recentProjectsGrid.appendChild(
      createProjectCard(project, {
        onOpen: recordRecentlyOpenedProject,
        recent: true,
      })
    );
  });
}

function toggleRecentProjects() {
  const isCollapsed = !getRecentProjectsCollapsed();

  saveRecentProjectsCollapsed(isCollapsed);
  setRecentProjectsCollapsed(isCollapsed);
}

function renderProjects(projects) {
  projectCount.textContent = `${projects.length} projects`;

  if (!projects.length) {
    projectsGrid.innerHTML = "<p>No projects found.</p>";
    if (searchInput) {
      searchInput.setAttribute("aria-expanded", "false");
      searchInput.removeAttribute("aria-activedescendant");
    }
    clearActiveCard();
    return;
  }

  projectsGrid.innerHTML = "";
  clearActiveCard();

  projects.forEach((project, index) => {
    const card = createProjectCard(project, {
      onOpen: recordRecentlyOpenedProject,
    });
    if (card && card.setAttribute) {
      card.id = `project-card-${index}`;
      card.setAttribute("role", "option");
      card.setAttribute("aria-selected", "false");
      card.setAttribute("tabindex", "-1");
    }
    projectsGrid.appendChild(card);
  });

  if (searchInput) {
    searchInput.setAttribute("aria-expanded", "true");
    searchInput.setAttribute("aria-controls", "projects-grid");
  }
}

function getSearchSuggestions(query) {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  const availableCategories =
    selectedCategory === "all"
      ? [...new Set(allProjects.map(project => project.category))]
      : [selectedCategory];

  const categorySuggestions = (
    selectedCategory === "all" ? availableCategories : []
  )
    .filter(category =>
      getSearchableCategory(category).includes(normalizedQuery)
    )
    .slice(0, 3)
    .map(category => ({
      type: "category",
      label: formatCategoryLabel(category),
      detail: "Category",
      category,
    }));

  const availableProjects =
    selectedCategory === "all"
      ? allProjects
      : allProjects.filter(project => project.category === selectedCategory);

  const projectSuggestions = availableProjects
    .filter(
      project =>
        project.title.toLowerCase().includes(normalizedQuery) ||
        (project.description &&
          project.description.toLowerCase().includes(normalizedQuery))
    )
    .slice(0, 6)
    .map(project => ({
      type: "project",
      label: project.title,
      detail: formatCategoryLabel(project.category),
      project,
    }));

  return [...categorySuggestions, ...projectSuggestions].slice(0, 7);
}

function hideSearchSuggestions() {
  currentSuggestions = [];
  activeSuggestionIndex = -1;

  if (searchSuggestions) {
    searchSuggestions.hidden = true;
    searchSuggestions.innerHTML = "";
  }

  if (searchInput) {
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
  }
}

function updateSuggestionActiveState() {
  if (!searchSuggestions) return;

  const options = Array.from(
    searchSuggestions.querySelectorAll(".search-suggestion")
  );

  options.forEach((option, index) => {
    const isActive = index === activeSuggestionIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  if (activeSuggestionIndex >= 0 && options[activeSuggestionIndex]) {
    searchInput.setAttribute(
      "aria-activedescendant",
      options[activeSuggestionIndex].id
    );
  } else {
    searchInput.removeAttribute("aria-activedescendant");
  }
}

function renderSearchSuggestions() {
  if (!searchSuggestions) return;

  const query = searchInput.value.trim();
  currentSuggestions = getSearchSuggestions(query);
  activeSuggestionIndex = -1;

  if (!query || !currentSuggestions.length) {
    hideSearchSuggestions();
    return;
  }

  searchSuggestions.innerHTML = "";

  currentSuggestions.forEach((suggestion, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.id = `search-suggestion-${index}`;
    option.className = "search-suggestion";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");

    const label = document.createElement("span");
    label.className = "search-suggestion-label";
    label.textContent = suggestion.label;

    const detail = document.createElement("span");
    detail.className = "search-suggestion-detail";
    detail.textContent = suggestion.detail;

    option.append(label, detail);
    option.addEventListener("mousedown", event => event.preventDefault());
    option.addEventListener("click", () => selectSearchSuggestion(index));

    searchSuggestions.appendChild(option);
  });

  searchSuggestions.hidden = false;
  searchInput.setAttribute("aria-expanded", "true");
}

function selectSearchSuggestion(index) {
  const suggestion = currentSuggestions[index];
  if (!suggestion) return;

  if (suggestion.type === "category") {
    selectedCategory = suggestion.category;
  } else {
    if (suggestion.project && suggestion.project.category) {
      if (selectedCategory === "all") {
        selectedCategory = suggestion.project.category;
      }
    }
    searchInput.value = suggestion.label;
  }

  renderCategories();
  applyFilters();
  hideSearchSuggestions();
  updateClearSearchButton();
  searchInput.focus();
}

function getProjectUrl(projectPath) {
  return new URL(projectPath, window.location.href).href;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-999px";
  textarea.style.left = "-999px";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Copy command failed");
  }
}

function setCopyStatus(message) {
  if (copyStatus) {
    copyStatus.textContent = message;
  }
}

function resetCopyButton(button) {
  window.setTimeout(() => {
    button.textContent = "Copy Link";
    button.disabled = false;
  }, 1800);
}

async function copyProjectUrl(rawProject, button) {
  const project = sanitizeProject(rawProject);
  if (!project) return;

  const projectUrl = getProjectUrl(project.path);

  button.disabled = true;
  button.textContent = "Copying...";

  try {
    await copyTextToClipboard(projectUrl);
    button.textContent = "Copied";
    setCopyStatus(`Copied direct link to ${project.title}.`);
  } catch (error) {
    button.textContent = "Copy Failed";
    setCopyStatus(`Could not copy direct link to ${project.title}.`);
  } finally {
    resetCopyButton(button);
  }
}

function applyFilters() {
  const query = searchInput.value.toLowerCase().trim();

  if (filterWorker) {
    if (filterWorker.postMessage({ allProjects, selectedCategory, query })) {
      updateClearButtonVisibility(query);
      updateUrlFilterState();
      return;
    }
  }

  const filtered = filterProjects(allProjects, selectedCategory, query);

  renderProjects(sortProjectList(filtered));
  updateClearButtonVisibility(query);
  updateUrlFilterState();
}

function updateClearButtonVisibility(query) {
  const hasActiveFilters = query !== "" || selectedCategory !== "all";

  if (clearFiltersBtn) {
    clearFiltersBtn.hidden = !hasActiveFilters;
  }
}

function clearFilters() {
  searchInput.value = "";
  selectedCategory = "all";

  clearActiveCard();
  applyFilters();
  renderCategories();
  hideSearchSuggestions();
  updateClearSearchButton();
  searchInput.focus();
}

searchInput.addEventListener("input", () => {
  clearActiveCard();
  debouncedApplyFilters();
  renderSearchSuggestions();
});

searchInput.addEventListener("focus", renderSearchSuggestions);

searchInput.addEventListener("blur", () => {
  window.setTimeout(() => {
    hideSearchSuggestions();
    clearActiveCard();
  }, 150);
});

searchInput.addEventListener("keydown", event => {
  const cards = Array.from(
    projectsGrid ? projectsGrid.querySelectorAll(".cradle-card") : []
  );

  if (event.key === "ArrowDown") {
    if (cards.length > 0) {
      event.preventDefault();
      hideSearchSuggestions();
      const nextIndex =
        activeCardIndex + 1 >= cards.length ? 0 : activeCardIndex + 1;
      updateActiveCard(nextIndex);
      return;
    }
  }

  if (event.key === "ArrowUp") {
    if (cards.length > 0) {
      event.preventDefault();
      hideSearchSuggestions();
      const prevIndex =
        activeCardIndex <= 0 ? cards.length - 1 : activeCardIndex - 1;
      updateActiveCard(prevIndex);
      return;
    }
  }

  if (event.key === "Enter") {
    if (activeCardIndex >= 0 && cards[activeCardIndex]) {
      event.preventDefault();
      openHighlightedProject(cards[activeCardIndex]);
      return;
    }

    if (!searchSuggestions?.hidden && activeSuggestionIndex >= 0) {
      event.preventDefault();
      selectSearchSuggestion(activeSuggestionIndex);
      return;
    }
  }

  if (event.key === "Escape") {
    if (activeCardIndex >= 0) {
      event.preventDefault();
      event.stopPropagation();
      clearActiveCard();
      return;
    }

    if (!searchSuggestions?.hidden) {
      event.stopPropagation();
      hideSearchSuggestions();
      return;
    }
  }
});

if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener("click", clearFilters);
}

if (clearRecentProjectsBtn) {
  clearRecentProjectsBtn.addEventListener("click", clearRecentProjects);
}

if (toggleRecentProjectsBtn) {
  toggleRecentProjectsBtn.addEventListener("click", toggleRecentProjects);
}

// Floating Back to Top Button Logic
const backToTopBtn = document.getElementById("back-to-top");

if (backToTopBtn) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      backToTopBtn.hidden = false;
      backToTopBtn.classList.add("visible");
    } else {
      backToTopBtn.classList.remove("visible");
    }
  });

  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
}

// Keyboard Shortcuts Modal Toggle
const shortcutsBtn = document.getElementById("shortcuts-btn");
const shortcutsModal = document.getElementById("shortcuts-modal");
const closeShortcutsBtn = document.getElementById("close-shortcuts");
const shortcutsOverlay = document.getElementById("shortcuts-overlay");

function openShortcutsModal() {
  if (shortcutsModal) {
    shortcutsModal.classList.add("visible");
    shortcutsModal.setAttribute("aria-hidden", "false");
  }
}

function closeShortcutsModal() {
  if (shortcutsModal) {
    shortcutsModal.classList.remove("visible");
    shortcutsModal.setAttribute("aria-hidden", "true");
  }
}

if (shortcutsBtn) {
  shortcutsBtn.addEventListener("click", openShortcutsModal);
}
if (closeShortcutsBtn) {
  closeShortcutsBtn.addEventListener("click", closeShortcutsModal);
}
if (shortcutsOverlay) {
  shortcutsOverlay.addEventListener("click", closeShortcutsModal);
}

// Your Data Modal Toggle & Renderer
const yourDataBtn = document.getElementById("your-data-btn");
const yourDataModal = document.getElementById("your-data-modal");
const closeYourDataBtn = document.getElementById("close-your-data");
const yourDataOverlay = document.getElementById("your-data-overlay");
const yourDataBody = document.getElementById("your-data-body");

function renderYourDataModal() {
  if (!yourDataBody) return;
  yourDataBody.innerHTML = "";

  const storageApi =
    typeof window !== "undefined" && window.CradleStorage
      ? window.CradleStorage
      : null;

  if (!storageApi || typeof storageApi.getStoredMinisData !== "function") {
    const errorP = document.createElement("p");
    errorP.className = "your-data-empty-desc";
    errorP.textContent = "Storage API is unavailable.";
    yourDataBody.appendChild(errorP);
    return;
  }

  const minis = storageApi.getStoredMinisData();

  if (!minis || minis.length === 0) {
    const emptyContainer = document.createElement("div");
    emptyContainer.className = "your-data-empty";

    const titleEl = document.createElement("p");
    titleEl.className = "your-data-empty-title";
    titleEl.textContent = "No stored mini data found";

    const descEl = document.createElement("p");
    descEl.className = "your-data-empty-desc";
    descEl.textContent =
      "Scores, decks, notes, and settings saved by minis will appear here.";

    emptyContainer.appendChild(titleEl);
    emptyContainer.appendChild(descEl);
    yourDataBody.appendChild(emptyContainer);
    return;
  }

  const totalKeys = minis.reduce((acc, m) => acc + m.keys.length, 0);
  const totalBytes = minis.reduce((acc, m) => acc + m.totalBytes, 0);
  const formattedTotal = storageApi.formatBytes(totalBytes);

  // Summary bar
  const summaryBar = document.createElement("div");
  summaryBar.className = "your-data-summary-bar";

  const summaryText = document.createElement("div");
  summaryText.className = "your-data-summary-text";

  const strongKeys = document.createElement("strong");
  strongKeys.textContent = `${totalKeys} ${totalKeys === 1 ? "key" : "keys"}`;

  const strongMinis = document.createElement("strong");
  strongMinis.textContent = `${minis.length} ${minis.length === 1 ? "mini" : "minis"}`;

  summaryText.appendChild(strongKeys);
  summaryText.appendChild(document.createTextNode(" across "));
  summaryText.appendChild(strongMinis);
  summaryText.appendChild(document.createTextNode(` (~${formattedTotal})`));

  const clearAllBtn = document.createElement("button");
  clearAllBtn.type = "button";
  clearAllBtn.id = "your-data-clear-all";
  clearAllBtn.className = "your-data-clear-all-btn";
  clearAllBtn.textContent = "Clear all";
  clearAllBtn.setAttribute("aria-label", "Clear all stored mini data");

  clearAllBtn.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Are you sure you want to clear all stored data across all minis? This cannot be undone."
    );
    if (confirmed) {
      storageApi.clearAllMinis();
      renderYourDataModal();
    }
  });

  summaryBar.appendChild(summaryText);
  summaryBar.appendChild(clearAllBtn);
  yourDataBody.appendChild(summaryBar);

  // Minis list
  const minisList = document.createElement("div");
  minisList.className = "your-data-minis-list";

  minis.forEach(mini => {
    const card = document.createElement("div");
    card.className = "your-data-mini-card";
    card.setAttribute("data-mini-id", mini.id);

    const header = document.createElement("div");
    header.className = "your-data-mini-card-header";

    const meta = document.createElement("div");
    meta.className = "your-data-mini-meta";

    const titleH4 = document.createElement("h4");
    titleH4.className = "your-data-mini-name";
    titleH4.textContent = mini.title;

    const badgeSpan = document.createElement("span");
    badgeSpan.className = "your-data-mini-badge";
    badgeSpan.textContent = `${mini.keys.length} ${mini.keys.length === 1 ? "key" : "keys"} · ~${mini.formattedTotalSize}`;

    meta.appendChild(titleH4);
    meta.appendChild(badgeSpan);

    const clearMiniBtn = document.createElement("button");
    clearMiniBtn.type = "button";
    clearMiniBtn.className = "your-data-clear-mini-btn";
    clearMiniBtn.textContent = "Clear";
    clearMiniBtn.setAttribute(
      "aria-label",
      `Clear stored data for ${mini.title}`
    );

    clearMiniBtn.addEventListener("click", () => {
      const confirmed = window.confirm(
        `Are you sure you want to clear stored data for ${mini.title}? This cannot be undone.`
      );
      if (confirmed) {
        storageApi.clearMini(mini.id);
        renderYourDataModal();
      }
    });

    header.appendChild(meta);
    header.appendChild(clearMiniBtn);
    card.appendChild(header);

    const keysUl = document.createElement("ul");
    keysUl.className = "your-data-keys-list";

    mini.keys.forEach(k => {
      const rowLi = document.createElement("li");
      rowLi.className = "your-data-key-row";

      const keyName = document.createElement("code");
      keyName.className = "your-data-key-name";
      keyName.textContent = k.key;

      const keySize = document.createElement("span");
      keySize.className = "your-data-key-size";
      keySize.textContent = `~${k.formattedSize}`;

      rowLi.appendChild(keyName);
      rowLi.appendChild(keySize);
      keysUl.appendChild(rowLi);
    });

    card.appendChild(keysUl);
    minisList.appendChild(card);
  });

  yourDataBody.appendChild(minisList);
}

function openYourDataModal() {
  if (yourDataModal) {
    yourDataModal.classList.add("visible");
    yourDataModal.setAttribute("aria-hidden", "false");
    renderYourDataModal();
    closeYourDataBtn?.focus();
  }
}

function closeYourDataModal() {
  if (yourDataModal) {
    yourDataModal.classList.remove("visible");
    yourDataModal.setAttribute("aria-hidden", "true");
    yourDataBtn?.focus();
  }
}

if (yourDataBtn) {
  yourDataBtn.addEventListener("click", openYourDataModal);
}
if (closeYourDataBtn) {
  closeYourDataBtn.addEventListener("click", closeYourDataModal);
}
if (yourDataOverlay) {
  yourDataOverlay.addEventListener("click", closeYourDataModal);
}

// Keyboard Shortcuts Listeners
function isInteractiveElement(element) {
  if (!element) return false;
  const tagName = element.tagName ? element.tagName.toUpperCase() : "";
  const contentEditableAttr = element.getAttribute?.("contenteditable");
  const isContentEditable =
    Boolean(element.isContentEditable) ||
    (contentEditableAttr !== null &&
      contentEditableAttr !== undefined &&
      contentEditableAttr !== "false");
  const role = element.getAttribute?.("role");
  const isAriaInput = role === "textbox" || role === "searchbox";

  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    isContentEditable ||
    isAriaInput ||
    Boolean(
      element.closest?.(
        "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='searchbox']"
      )
    )
  );
}

document.addEventListener("keydown", e => {
  const isInputActive =
    isInteractiveElement(document.activeElement) ||
    isInteractiveElement(e.target);

  // Focus Search Bar
  if (
    (e.ctrlKey && e.key.toLowerCase() === "k") ||
    (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isInputActive)
  ) {
    e.preventDefault();
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
    return;
  }

  // Close Modal or Clear search
  if (e.key === "Escape") {
    const activeYourDataModal =
      typeof yourDataModal !== "undefined"
        ? yourDataModal
        : typeof document !== "undefined" && document.getElementById
          ? document.getElementById("your-data-modal")
          : null;
    if (
      activeYourDataModal &&
      (activeYourDataModal.classList.contains("visible") ||
        activeYourDataModal.getAttribute("aria-hidden") === "false")
    ) {
      e.preventDefault();
      if (typeof closeYourDataModal === "function") {
        closeYourDataModal();
      } else {
        activeYourDataModal.classList.remove("visible");
        activeYourDataModal.setAttribute("aria-hidden", "true");
      }
      return;
    }
    if (
      shortcutsModal &&
      (shortcutsModal.classList.contains("visible") ||
        shortcutsModal.getAttribute("aria-hidden") === "false")
    ) {
      e.preventDefault();
      closeShortcutsModal();
    } else if (!isInputActive) {
      clearFilters();
    }
    return;
  }

  // Toggle Theme
  const activeTagName = document.activeElement?.tagName
    ? document.activeElement.tagName.toUpperCase()
    : "";
  const isInteractiveTagActive =
    activeTagName === "INPUT" ||
    activeTagName === "TEXTAREA" ||
    activeTagName === "SELECT";

  if (
    e.key.toLowerCase() === "t" &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !isInputActive &&
    !isInteractiveTagActive &&
    document.activeElement !== searchInput
  ) {
    e.preventDefault();
    const themeToggleEl = document.getElementById("themeToggle");
    if (themeToggleEl) {
      themeToggleEl.click();
    } else if (
      window.CradleThemeToggle &&
      typeof window.CradleThemeToggle.toggleTheme === "function"
    ) {
      window.CradleThemeToggle.toggleTheme();
    } else if (typeof window.toggleTheme === "function") {
      window.toggleTheme();
    } else {
      const isLight =
        document.documentElement.classList.contains("light-theme");
      if (isLight) {
        document.documentElement.classList.remove("light-theme");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.add("light-theme");
        localStorage.setItem("theme", "light");
      }
    }
    return;
  }

  // Toggle Shortcuts Panel
  if (
    e.key === "?" &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !isInputActive
  ) {
    e.preventDefault();
    if (shortcutsModal) {
      const isVisible =
        shortcutsModal.classList.contains("visible") ||
        shortcutsModal.getAttribute("aria-hidden") === "false";
      if (isVisible) {
        closeShortcutsModal();
      } else {
        openShortcutsModal();
      }
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  restoreFiltersFromUrl();
  renderRecentProjects();
  loadProjects();
  registerServiceWorker();

  // Cross-tab synchronization via BroadcastChannel
  subscribeToSync(async syncEvent => {
    try {
      if (!syncEvent || !syncEvent.type) return;
      let db = null;
      try {
        db = await openDB();
      } catch (e) {
        console.warn("IndexedDB error during cross-tab sync:", e);
      }

      if (syncEvent.type === "update" && Array.isArray(syncEvent.data)) {
        allProjects = sanitizeProjectList(syncEvent.data);
      } else {
        const cached = await getCachedProjects(db);
        if (cached && cached.length > 0) {
          allProjects = sanitizeProjectList(cached);
        } else {
          allProjects = await fetchAndCacheProjects(db);
        }
      }

      validateSelectedCategory();
      renderCategories();
      applyFilters();
      if (loadStatus) {
        loadStatus.textContent = `${allProjects.length} projects loaded.`;
      }
    } catch (err) {
      console.warn("Failed to synchronize state from cross-tab event:", err);
    }
  });

  if (document.documentElement?.addEventListener) {
    document.documentElement.addEventListener("cradle:themechange", e => {
      const theme = e.detail?.theme;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && theme) {
        meta.setAttribute("content", theme === "light" ? "#f5f7fb" : "#05070d");
      }
    });
  }
});
