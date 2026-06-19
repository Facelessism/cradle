const projectsGrid = document.getElementById("projects-grid");
const searchInput = document.getElementById("search");
const categoriesContainer = document.getElementById("categories");
const projectCount = document.getElementById("project-count");

let allProjects = [];
let selectedCategory = "all";

function initTheme() {
  const savedTheme =
    localStorage.getItem("theme") || "dark";

  setTheme(savedTheme);
}

function setTheme(theme) {
  const html = document.documentElement;
  const themeBtn = document.getElementById("themeToggle");

  if (theme === "light") {
    html.classList.add("light-theme");

    if (themeBtn) {
      themeBtn.innerHTML = "☀️";
      themeBtn.setAttribute(
        "aria-label",
        "Switch to dark theme"
      );
    }

    localStorage.setItem("theme", "light");
  } else {
    html.classList.remove("light-theme");

    if (themeBtn) {
      themeBtn.innerHTML = "🌙";
      themeBtn.setAttribute(
        "aria-label",
        "Switch to light theme"
      );
    }

    localStorage.setItem("theme", "dark");
  }
}

function toggleTheme() {
  const isLight =
    document.documentElement.classList.contains(
      "light-theme"
    );

  setTheme(isLight ? "dark" : "light");
}

async function loadProjects() {
  try {
    const response = await fetch("./data/projects.json");

    if (!response.ok) {
      throw new Error("Failed to load projects");
    }

    allProjects = await response.json();

    renderCategories();
    renderProjects(allProjects);
  } catch (error) {
    console.error(error);

    projectsGrid.innerHTML =
      "<p>Failed to load projects.</p>";
  }
}

function renderCategories() {
  const categories = [
    "all",
    ...new Set(
      allProjects.map(project => project.category)
    )
  ];

  categoriesContainer.innerHTML = "";

  categories.forEach(category => {
    const btn = document.createElement("button");

    btn.className =
      category === selectedCategory
        ? "category-btn active"
        : "category-btn";

    btn.textContent = category;

    btn.onclick = () => {
      selectedCategory = category;

      applyFilters();
      renderCategories();
    };

    categoriesContainer.appendChild(btn);
  });
}

function renderProjects(projects) {
  projectCount.textContent =
    `${projects.length} projects`;

  if (!projects.length) {
    projectsGrid.innerHTML =
      "<p>No projects found.</p>";

    return;
  }

  projectsGrid.innerHTML = projects
    .map(
      project => `
      <article class="project-card">
        <div class="project-category">
          ${project.category}
        </div>

        <h3 class="project-title">
          ${project.title}
        </h3>

        <p class="project-path">
          ${project.path}
        </p>

        <a
          class="project-link"
          href="${project.path}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Project →
        </a>
      </article>
    `
    )
    .join("");
}

function applyFilters() {
  const query =
    searchInput.value
      .toLowerCase()
      .trim();

  const filtered = allProjects.filter(
    project =>
      (selectedCategory === "all" ||
        project.category === selectedCategory) &&
      project.title
        .toLowerCase()
        .includes(query)
  );

  renderProjects(filtered);
}

searchInput.addEventListener(
  "input",
  applyFilters
);

document.addEventListener(
  "DOMContentLoaded",
  () => {
    initTheme();
    loadProjects();
  }
);

window.toggleTheme = toggleTheme;