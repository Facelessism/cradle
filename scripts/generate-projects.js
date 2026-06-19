const fs = require("fs");
const path = require("path");

const PROJECTS_DIR = path.join(__dirname, "..", "projects");
const OUTPUT_FILE = path.join(
  __dirname,
  "..",
  "data",
  "projects.json"
);

function titleCase(str) {
  return str
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function generateProjects() {
  const projects = [];

  const categories = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory());

  for (const category of categories) {
    const categoryName = category.name;

    const categoryPath = path.join(
      PROJECTS_DIR,
      categoryName
    );

    const projectFolders = fs
      .readdirSync(categoryPath, {
        withFileTypes: true
      })
      .filter(dirent => dirent.isDirectory());

    for (const project of projectFolders) {
      projects.push({
        title: titleCase(project.name),
        category: categoryName,
        path: `projects/${categoryName}/${project.name}/`
      });
    }
  }

  projects.sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(projects, null, 2)
  );

  console.log(
    `Generated ${projects.length} projects → data/projects.json`
  );
}

generateProjects();
