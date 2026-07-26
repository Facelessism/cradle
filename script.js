const projectsGrid = document.getElementById("projects-grid");
const searchInput = document.getElementById("search");
const categoriesContainer = document.getElementById("categories");
const tagsContainer = document.getElementById("tags-container");
const projectCount = document.getElementById("project-count");
const clearFiltersBtn = document.getElementById("clear-filters");
const sortSelect = document.getElementById("sort-select");

let allProjects = [];
let selectedCategory = "all";
let selectedTags = new Set();
let currentSort = "newest";
let activeProjectIndex = 0;

let filterWorker;
if (window.Worker) {
  filterWorker = new Worker("./scripts/worker.js");
  filterWorker.onmessage = function (e) {
    renderProjects(e.data);
  };
}

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

function renderSkeleton(count = 6) {
  projectsGrid.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton-card";
    skeleton.setAttribute("aria-hidden", "true");
    skeleton.innerHTML = `
      <div class="skeleton-card-image"></div>
      <div class="skeleton-card-body">
        <div class="skeleton-line skeleton-line-title"></div>
        <div class="skeleton-line skeleton-line-subtitle"></div>
        <div class="skeleton-badge"></div>
        <div class="skeleton-line skeleton-line-button"></div>
      </div>
    `;
    projectsGrid.appendChild(skeleton);
  }
}

async function loadProjects() {
  renderSkeleton();
  try {
    let db;

    try {
      db = await openDB();

      const cachedProjects = await getCachedProjects(db);

      if (cachedProjects && cachedProjects.length > 0) {
        allProjects = cachedProjects;

        renderCategories();
        renderTags();
        renderProjects(allProjects);

        fetchAndCacheProjects(db)
          .then(() => {
            renderCategories();
            renderTags();
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
    renderTags();
    renderProjects(allProjects);
  } catch (error) {
    console.error(error);
    renderError(error);
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
    const btn = CradleButton.create({
      variant: isActive ? "primary" : "ghost",
      size: "sm",
      children: category.toUpperCase().replace("-", " "),
      ariaLabel: `${category.toUpperCase().replace("-", " ")} projects`,
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

function sortProjects(projects) {
  const sorted = [...projects];
  switch (currentSort) {
    case "az":
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "za":
      sorted.sort((a, b) => b.title.localeCompare(a.title));
      break;
    default:
      sorted.sort((a, b) => {
        if (a.dateAdded && b.dateAdded) {
          return new Date(b.dateAdded) - new Date(a.dateAdded);
        }
        if (a.dateAdded) return -1;
        if (b.dateAdded) return 1;
        return a.title.localeCompare(b.title);
      });
  }
  return sorted;
}

function renderTags() {
  if (!tagsContainer) return;
  const tagSet = new Set();
  allProjects.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
  const tags = [...tagSet].sort();
  if (!tags.length) {
    tagsContainer.hidden = true;
    return;
  }
  tagsContainer.hidden = false;
  tagsContainer.innerHTML = "";
  tags.forEach(tag => {
    const isActive = selectedTags.has(tag);
    const btn = document.createElement("button");
    btn.className = "tag-chip";
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    btn.textContent = tag;
    btn.addEventListener("click", () => {
      if (selectedTags.has(tag)) {
        selectedTags.delete(tag);
      } else {
        selectedTags.add(tag);
      }
      applyFilters();
      renderTags();
    });
    tagsContainer.appendChild(btn);
  });
}

function readFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  if (q) searchInput.value = q;
  const cat = params.get("category");
  if (cat) selectedCategory = cat;
  const sort = params.get("sort");
  if (sort) currentSort = sort;
  const tags = params.get("tags");
  if (tags) {
    tags.split(",").forEach(t => {
      if (t) selectedTags.add(t);
    });
  }
  if (sortSelect) sortSelect.value = currentSort;
}

function writeFiltersToURL() {
  const params = new URLSearchParams();
  const q = searchInput.value.trim();
  if (q) params.set("q", q);
  if (selectedCategory !== "all") params.set("category", selectedCategory);
  if (currentSort !== "newest") params.set("sort", currentSort);
  if (selectedTags.size > 0) params.set("tags", [...selectedTags].join(","));
  const str = params.toString();
  const url = str ? "?" + str : window.location.pathname;
  window.history.replaceState(null, "", url);
}

function isNewProject(dateAdded) {
  if (!dateAdded) return false;
  const diffDays = (Date.now() - new Date(dateAdded)) / 86400000;
  return diffDays <= 7;
}

function renderProjects(projects) {
  projectCount.textContent = `${projects.length} projects`;

  if (!projects.length) {
    projectsGrid.innerHTML = "<p>No projects found.</p>";
    activeProjectIndex = 0;
    return;
  }

  projectsGrid.innerHTML = "";
  activeProjectIndex = Math.min(activeProjectIndex, projects.length - 1);

  projects.forEach((project, index) => {
    const card = CradleCard.create({
      title: project.title,
      subtitle: project.path,
      badge: project.category,
      isNew: isNewProject(project.dateAdded),
      image: `${project.path}thumbnail.svg`,
      footer: CradleButton.create({
        variant: "outline",
        size: "sm",
        children: "Open Project",
        rightIcon: "→",
        href: project.path,
        target: "_self",
        rel: "noopener noreferrer",
      }),
      footerAlign: "left",
    });

    prepareProjectCard(card, project, index);
    projectsGrid.appendChild(card);
  });

  updateProjectCardFocusState();
}

function prepareProjectCard(card, project, index) {
  const label = `${project.title}, ${project.category} project`;

  card.classList.add("project-grid-card");
  card.dataset.projectIndex = String(index);
  card.dataset.projectPath = project.path;
  card.setAttribute("role", "link");
  card.setAttribute("tabindex", index === activeProjectIndex ? "0" : "-1");
  card.setAttribute("aria-label", `${label}. Press Enter to open.`);

  const footerLink = card.querySelector("a[href]");
  if (footerLink) {
    footerLink.setAttribute("tabindex", "-1");
  }

  card.addEventListener("focus", () => {
    activeProjectIndex = index;
    updateProjectCardFocusState();
  });

  card.addEventListener("keydown", handleProjectCardKeydown);
}

function getProjectCards() {
  return Array.from(projectsGrid.querySelectorAll(".project-grid-card"));
}

function updateProjectCardFocusState() {
  const cards = getProjectCards();

  cards.forEach((card, index) => {
    const isActive = index === activeProjectIndex;
    card.setAttribute("tabindex", isActive ? "0" : "-1");
    card.classList.toggle("project-grid-card--active", isActive);
  });
}

function focusProjectCard(index) {
  const cards = getProjectCards();
  if (!cards.length) return;

  activeProjectIndex = Math.max(0, Math.min(index, cards.length - 1));
  updateProjectCardFocusState();
  cards[activeProjectIndex].focus();
}

function getProjectGridColumnCount(cards) {
  if (cards.length <= 1) return 1;

  const firstRowTop = cards[0].offsetTop;
  const firstRowCards = cards.filter(
    card => Math.abs(card.offsetTop - firstRowTop) < 4
  );

  return Math.max(1, firstRowCards.length);
}

function openFocusedProject(card) {
  const link = card.querySelector("a[href]");
  const destination = link?.getAttribute("href") || card.dataset.projectPath;

  if (destination) {
    window.location.href = destination;
  }
}

function handleProjectCardKeydown(event) {
  const cards = getProjectCards();
  if (!cards.length) return;

  const columnCount = getProjectGridColumnCount(cards);
  const currentIndex = cards.indexOf(event.currentTarget);
  let nextIndex = currentIndex;

  switch (event.key) {
    case "ArrowRight":
      nextIndex = currentIndex + 1;
      break;
    case "ArrowLeft":
      nextIndex = currentIndex - 1;
      break;
    case "ArrowDown":
      nextIndex = currentIndex + columnCount;
      break;
    case "ArrowUp":
      nextIndex = currentIndex - columnCount;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = cards.length - 1;
      break;
    case "Enter":
    case " ":
      event.preventDefault();
      openFocusedProject(event.currentTarget);
      return;
    default:
      return;
  }

  event.preventDefault();
  focusProjectCard(nextIndex);
}

function applyFilters() {
  const query = searchInput.value.toLowerCase().trim();

  const filtered = allProjects.filter(project => {
    if (selectedCategory !== "all" && project.category !== selectedCategory) {
      return false;
    }
    if (selectedTags.size > 0) {
      const projectTags = project.tags || [];
      if (![...selectedTags].some(t => projectTags.includes(t))) {
        return false;
      }
    }
    if (!query) return true;
    const inTitle = project.title.toLowerCase().includes(query);
    const inDesc = (project.description || "").toLowerCase().includes(query);
    const inTags = (project.tags || []).some(t => t.toLowerCase().includes(query));
    return inTitle || inDesc || inTags;
  });

  const sorted = sortProjects(filtered);

  if (filterWorker) {
    filterWorker.postMessage({
      allProjects: sorted,
      selectedCategory,
      query,
    });
  } else {
    renderProjects(sorted);
  }

  writeFiltersToURL();
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

  selectedTags.clear();
  currentSort = "newest";
  if (sortSelect) sortSelect.value = currentSort;
  applyFilters();
  renderCategories();
  renderTags();
  searchInput.focus();
}

searchInput.addEventListener("input", applyFilters);

if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener("click", clearFilters);
}

if (sortSelect) {
  sortSelect.addEventListener("change", () => {
    currentSort = sortSelect.value;
    applyFilters();
  });
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
  readFiltersFromURL();
  loadProjects();
});
