const fs = require("fs");
const path = require("path");

function titleCase(str) {
  let title = str
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());

  const acronyms = {
    "Ai": "AI",
    "Api": "API",
    "Ascii": "ASCII",
    "Cpu": "CPU",
    "Qr": "QR",
    "Css": "CSS",
    "Json": "JSON",
    "Url": "URL",
    "Html": "HTML",
    "Csv": "CSV"
  };

  return title.replace(/\b(Ai|Api|Ascii|Cpu|Qr|Css|Json|Url|Html|Csv)\b/g, match => acronyms[match]);
}

/**
 * Discovers all projects in the given projects directory and returns a standardized representation.
 * @param {string} projectsDir - Absolute path to the projects directory.
 * @param {string} repoRoot - Absolute path to the repository root.
 * @returns {Array} Array of project objects.
 */
function discoverProjects(projectsDir, repoRoot) {
  const projects = [];

  if (!fs.existsSync(projectsDir)) {
    return projects;
  }

  const categories = fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  for (const cat of categories) {
    const categoryName = path.basename(cat.name);
    const catPath = path.join(projectsDir, categoryName);

    const projectFolders = fs
      .readdirSync(catPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

    for (const proj of projectFolders) {
      const projectName = path.basename(proj.name);
      const title = titleCase(projectName);
      const relPath = `projects/${categoryName}/${projectName}/`;
      const absPath = path.join(repoRoot, relPath);

      projects.push({
        name: projectName,
        category: categoryName,
        title: title,
        relPath: relPath,
        absPath: absPath
      });
    }
  }

  // Sort alphabetically by title, then fallback to path
  projects.sort((a, b) => {
    const comp = a.title.localeCompare(b.title, "en", { sensitivity: "base" });
    if (comp !== 0) return comp;
    return a.relPath.localeCompare(b.relPath, "en", { sensitivity: "base" });
  });

  return projects;
}

module.exports = {
  titleCase,
  discoverProjects
};
