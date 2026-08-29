import {
  formatCategoryLabel,
  getSearchableCategory,
} from "./src/components/ui/utils/categoryFilter.js";
import { filterProjects } from "./src/utils/projectSearch.js";
import { createFilterWorker } from "./src/utils/filterWorker.js";

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
const copyStatus = document.getElementById("copy-status");
const RECENT_PROJECTS_KEY = "cradle:recent-projects";
const RECENT_PROJECTS_COLLAPSED_KEY = "cradle:recent-projects-collapsed";
const RECENT_PROJECTS_LIMIT = 5;
const sortProjects = document.getElementById("sort-projects");
const shortcutHint = document.querySelector('.keyboard-hint');

if (shortcutHint) {
  shortcutHint.textContent = '/ or Ctrl + K';
}

const FILTER_DEBOUNCE_DELAY = 250;
let filterDebounceTimer;

if (sortProjects) {
  sortProjects.addEventListener("change", applyFilters);
}

let filterWorker = null;
let filterWorkerFailed = false;

function debouncedApplyFilters() {
  window.clearTimeout(filterDebounceTimer);

  filterDebounceTimer = window.setTimeout(() => {
    applyFilters();
  }, FILTER_DEBOUNCE_DELAY);
}

if (window.Worker) {
  filterWorker = new Worker("./scripts/worker.js");
}

function handleFilterWorkerFailure(error, reason = "Worker error") {
  console.warn(`${reason}, falling back to main thread:`, error);
  filterWorkerFailed = true;
  filterWorker = null;
  applyFilters();
}

function initializeFilterWorker() {
  if (!window.Worker || filterWorkerFailed) return;

  filterWorker = createFilterWorker({
    WorkerCtor: window.Worker,
    onResult: projects => {
      renderProjects(sortProjectList(projects));
    },
    onFailure: error => {
      handleFilterWorkerFailure(error, "Worker execution failed");
    },
  });
}

initializeFilterWorker();

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("CradleDB", 1);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("projectsStore")) {
        db.createObjectStore("projectsStore", {
          keyPath: "id",
        });
      }
    };
  });
}

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
function getCachedProjects(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["projectsStore"], "readonly");
    const store = transaction.objectStore("projectsStore");
    const request = store.get("projects");

    request.onerror = () => reject(request.error);

    request.onsuccess = () =>
      resolve(request.result ? request.result.data : null);
  });
}

async function fetchAndCacheProjects(db) {
  const response = await fetch("./data/projects.json");

  if (!response.ok) {
    throw new Error("Failed to load projects");
  }

  const data = await response.json();
  allProjects = data;

  if (db) {
    const transaction = db.transaction(["projectsStore"], "readwrite");
    const store = transaction.objectStore("projectsStore");

    store.put({
      id: "projects",
      data: data,
    });
  }

  return data;
}

async function loadProjects() {
  try {
    let db;

    try {
      db = await openDB();

      const cachedProjects = await getCachedProjects(db);

      if (cachedProjects && cachedProjects.length > 0) {
        allProjects = cachedProjects;

        renderCategories();
        renderProjects(allProjects);

        fetchAndCacheProjects(db)
          .then(() => {
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

    renderCategories();
    renderProjects(allProjects);
  } catch (error) {
    console.error(error);
    projectsGrid.innerHTML = "<p>Failed to load projects.</p>";
  }
}

function renderCategories() {
  const categories = [
    "all",
    ...new Set(allProjects.map(project => project.category)),
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
        debouncedApplyFilters();
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

    return parsed
      .filter(
        project =>
          project &&
          typeof project.title === "string" &&
          typeof project.category === "string" &&
          typeof project.path === "string"
      )
      .slice(0, RECENT_PROJECTS_LIMIT);
  } catch (error) {
    console.warn("Failed to load recently opened projects:", error);
    return [];
  }
}

function saveRecentProjects(projects) {
  try {
    localStorage.setItem(
      RECENT_PROJECTS_KEY,
      JSON.stringify(projects.slice(0, RECENT_PROJECTS_LIMIT))
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
  if (!project) return;

  const recentProject = {
    title: project.title,
    category: project.category,
    path: project.path,
    dateAdded: project.dateAdded || null,
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

function createProjectCard(project, options = {}) {
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
    image: `${project.path}thumbnail.svg`,
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
    return;
  }

  projectsGrid.innerHTML = "";

  projects.forEach(project => {
    projectsGrid.appendChild(
      createProjectCard(project, {
        onOpen: recordRecentlyOpenedProject,
      })
    );
  });
}

function getSearchSuggestions(query) {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  const categories = [...new Set(allProjects.map(project => project.category))];
  const categorySuggestions = categories
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

  const projectSuggestions = allProjects
    .filter(project => project.title.toLowerCase().includes(normalizedQuery))
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
    searchInput.value = "";
  } else {
    selectedCategory = "all";
    searchInput.value = suggestion.label;
  }

  renderCategories();
  applyFilters();
  hideSearchSuggestions();
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

async function copyProjectUrl(project, button) {
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
      return;
    }
  }

  const filtered = filterProjects(allProjects, selectedCategory, query);

  renderProjects(sortProjectList(filtered));
  updateClearButtonVisibility(query);
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

  applyFilters();
  renderCategories();
  hideSearchSuggestions();
  searchInput.focus();
}

searchInput.addEventListener("input", () => {
  debouncedApplyFilters();
  renderSearchSuggestions();
});

searchInput.addEventListener("focus", renderSearchSuggestions);

searchInput.addEventListener("blur", () => {
  window.setTimeout(hideSearchSuggestions, 120);
});

searchInput.addEventListener("keydown", event => {
  if (searchSuggestions?.hidden || !currentSuggestions.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeSuggestionIndex =
      (activeSuggestionIndex + 1) % currentSuggestions.length;
    updateSuggestionActiveState();
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    activeSuggestionIndex =
      (activeSuggestionIndex - 1 + currentSuggestions.length) %
      currentSuggestions.length;
    updateSuggestionActiveState();
  }

  if (event.key === "Enter" && activeSuggestionIndex >= 0) {
    event.preventDefault();
    selectSearchSuggestion(activeSuggestionIndex);
  }

  if (event.key === "Escape") {
    event.stopPropagation();
    hideSearchSuggestions();
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

// Keyboard Shortcuts Listeners
document.addEventListener("keydown", e => {
  const activeEl = document.activeElement;
  const isInputActive =
    activeEl &&
    (activeEl.tagName === "INPUT" ||
      activeEl.tagName === "TEXTAREA" ||
      activeEl.isContentEditable);

  // Focus Search Bar
  if (
    (e.ctrlKey && e.key.toLowerCase() === "k") ||
    (e.key === "/" && !isInputActive)
  ) {
    e.preventDefault();
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  // Close Modal or Clear search
  if (e.key === "Escape") {
    if (
      shortcutsModal &&
      (shortcutsModal.classList.contains("visible") ||
        shortcutsModal.getAttribute("aria-hidden") === "false")
    ) {
      closeShortcutsModal();
    } else {
      clearFilters();
    }
  }

  // Toggle Theme
  if (e.key.toLowerCase() === "t" && !isInputActive) {
    e.preventDefault();
    const themeToggleEl = document.getElementById("themeToggle");
    if (themeToggleEl) {
      themeToggleEl.click();
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
  }

  // Toggle Shortcuts Panel
  if (e.key === "?" && !isInputActive) {
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
  renderRecentProjects();
  loadProjects();
});

document.addEventListener('keydown', (event) => {
  // "/" shortcut
  if (
    event.key === '/' &&
    !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)
  ) {
    event.preventDefault();
    // Open/focus search
  }

  // Ctrl + K
  if (event.ctrlKey && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    // Open/focus search
  }
});