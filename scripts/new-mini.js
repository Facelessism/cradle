const fs = require("fs");
const path = require("path");
const {
  SUPPORTED_CATEGORIES,
  titleCase,
  generateProjects,
  REPO_ROOT,
  PROJECTS_DIR,
  OUTPUT_FILE,
} = require("./generate-projects");
const { generateReadmeTable } = require("./generate-readme-table");

const TEMPLATE_FILE = path.join(REPO_ROOT, "ARCHITECTURE_TEMPLATE.md");
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validates a mini-project folder slug.
 * Slugs must consist of lowercase alphanumeric words separated by single hyphens.
 *
 * @param {string} slug
 * @returns {boolean}
 */
function isValidSlug(slug) {
  if (typeof slug !== "string") {
    return false;
  }
  const trimmed = slug.trim();
  if (!trimmed || trimmed !== slug) {
    return false;
  }
  return SLUG_REGEX.test(slug);
}

/**
 * Validates whether the given category is in the approved Cradle category list.
 *
 * @param {string} category
 * @returns {boolean}
 */
function isValidCategory(category) {
  return (
    typeof category === "string" && SUPPORTED_CATEGORIES.includes(category)
  );
}

/**
 * Checks if a project already exists with the given name either in the target
 * category or anywhere in the projects/ tree.
 *
 * @param {string} name
 * @param {string} [category]
 * @param {string} [projectsDir]
 * @returns {{ exists: boolean, category?: string, path?: string }}
 */
function checkProjectExists(name, category, projectsDir = PROJECTS_DIR) {
  if (category) {
    const targetPath = path.join(projectsDir, category, name);
    if (fs.existsSync(targetPath)) {
      return {
        exists: true,
        category,
        path: targetPath,
      };
    }
  }

  if (fs.existsSync(projectsDir)) {
    const categories = fs
      .readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const cat of categories) {
      const candidatePath = path.join(projectsDir, cat.name, name);
      if (fs.existsSync(candidatePath)) {
        return {
          exists: true,
          category: cat.name,
          path: candidatePath,
        };
      }
    }
  }

  return { exists: false };
}

/**
 * Builds the ARCHITECTURE.md content by adapting ARCHITECTURE_TEMPLATE.md:
 * - Strips the template notice blockquote
 * - Sets the project title
 * - Updates the folder tree with the project slug
 *
 * @param {string} templatePath
 * @param {string} title
 * @param {string} name
 * @returns {string}
 */
function buildArchitectureDoc(templatePath, title, name) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Architecture template not found at ${templatePath}`);
  }

  let content = fs.readFileSync(templatePath, "utf8");

  // Remove the notice blockquote at the top of ARCHITECTURE_TEMPLATE.md
  content = content.replace(
    /> \*\*This is the standardized ARCHITECTURE[\s\S]*?---\r?\n\r?\n/,
    ""
  );

  // Set project title heading
  content = content.replace(
    "# Project Architecture",
    `# ${title} Architecture`
  );

  // Replace default 'project-name/' with actual project folder slug
  content = content.replace(/project-name\//g, `${name}/`);

  return content;
}

/**
 * Builds the starter index.html for a new mini-project, containing:
 * - Proper descriptive title and favicon tag
 * - Accessible Back to Home navigation
 * - Shared ThemeToggle component with storage integration
 *
 * @param {string} title
 * @returns {string}
 */
function buildHtml(title) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${title} — A Cradle mini-project." />
    <link rel="icon" type="image/svg+xml" href="../../../assets/favicon.svg" />
    <link rel="stylesheet" href="../../../src/components/ui/tokens.css" />
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <header class="mini-header">
      <div class="mini-header__container">
        <a href="../../../index.html" class="back-link" aria-label="Back to Home">
          &larr; Back to Home
        </a>
        <h1>${title}</h1>
        <button
          id="themeToggle"
          class="theme-toggle"
          data-cradle-theme-toggle
          data-size="md"
          aria-label="Toggle theme"
        ></button>
      </div>
    </header>

    <main id="app" class="mini-main">
      <section class="mini-card">
        <p>Welcome to <strong>${title}</strong>.</p>
      </section>
    </main>

    <script src="../../../src/components/ui/storage.js"></script>
    <script src="../../../src/components/ui/ThemeToggle/ThemeToggle.js" defer></script>
    <script src="../../../src/components/ui/BackToHome/BackToHome.js" defer></script>
    <script src="script.js" defer></script>
  </body>
</html>
`;
}

/**
 * Builds the starter style.css for a new mini-project using Cradle tokens.
 *
 * @param {string} title
 * @returns {string}
 */
function buildCss(title) {
  return `/* Styling for ${title} */
:root {
  --mini-max-width: 800px;
}

body {
  margin: 0;
  padding: 0;
  font-family: "Space Grotesk", system-ui, -apple-system, sans-serif;
  background-color: var(--cradle-bg, #05070d);
  color: var(--cradle-text, #f3f4f6);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.mini-header {
  border-bottom: 1px solid var(--cradle-border, rgba(255, 255, 255, 0.1));
  padding: 1rem 1.5rem;
}

.mini-header__container {
  max-width: var(--mini-max-width);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.mini-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.back-link {
  color: var(--cradle-accent, #60a5fa);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.back-link:hover {
  text-decoration: underline;
}

.mini-main {
  flex: 1;
  max-width: var(--mini-max-width);
  width: 100%;
  margin: 2rem auto;
  padding: 0 1.5rem;
  box-sizing: border-box;
}

.mini-card {
  background: var(--cradle-surface, #111827);
  border: 1px solid var(--cradle-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--cradle-radius-md, 8px);
  padding: 2rem;
  text-align: center;
}
`;
}

/**
 * Builds the starter script.js for a new mini-project.
 *
 * @param {string} title
 * @returns {string}
 */
function buildJs(title) {
  return `/**
 * ${title}
 * Entry script for the mini-project.
 */
document.addEventListener("DOMContentLoaded", () => {
  // Mini initialization logic
});
`;
}

/**
 * Formats file contents using Prettier if available.
 *
 * @param {string} content
 * @param {string} filepath
 * @returns {Promise<string>}
 */
async function formatWithPrettier(content, filepath) {
  try {
    const prettier = require("prettier");
    return await prettier.format(content, { filepath });
  } catch {
    return content;
  }
}

/**
 * Creates a new mini project under projects/<category>/<name>/.
 *
 * @param {Object} options
 * @param {string} options.category
 * @param {string} options.name
 * @param {string} [options.repoRoot]
 * @param {string} [options.projectsDir]
 * @param {string} [options.outputFile]
 * @param {string} [options.templateFile]
 * @param {boolean} [options.skipGenerate=false]
 * @returns {Promise<{ projectDir: string, relPath: string, title: string, files: string[] }>}
 */
async function createMini({
  category,
  name,
  repoRoot = REPO_ROOT,
  projectsDir = PROJECTS_DIR,
  outputFile = OUTPUT_FILE,
  templateFile = TEMPLATE_FILE,
  skipGenerate = false,
} = {}) {
  if (!category) {
    throw new Error("Category is required.");
  }
  if (!isValidCategory(category)) {
    throw new Error(
      `Invalid category "${category}". Supported categories are: ${SUPPORTED_CATEGORIES.join(", ")}`
    );
  }

  if (!name) {
    throw new Error("Project name slug is required.");
  }
  if (!isValidSlug(name)) {
    throw new Error(
      `Invalid project slug "${name}". Slug must be lowercase alphanumeric words separated by single hyphens (e.g. "my-mini-project").`
    );
  }

  const existing = checkProjectExists(name, category, projectsDir);
  if (existing.exists) {
    throw new Error(
      `A project named "${name}" already exists in category "${existing.category}".`
    );
  }

  const projectDir = path.join(projectsDir, category, name);
  const relPath = `projects/${category}/${name}/`;
  const title = titleCase(name);

  fs.mkdirSync(projectDir, { recursive: true });

  const rawHtml = buildHtml(title);
  const rawCss = buildCss(title);
  const rawJs = buildJs(title);
  const rawArch = buildArchitectureDoc(templateFile, title, name);

  const htmlContent = await formatWithPrettier(rawHtml, "index.html");
  const cssContent = await formatWithPrettier(rawCss, "style.css");
  const jsContent = await formatWithPrettier(rawJs, "script.js");
  const archContent = await formatWithPrettier(rawArch, "ARCHITECTURE.md");

  fs.writeFileSync(path.join(projectDir, "index.html"), htmlContent, "utf8");
  fs.writeFileSync(path.join(projectDir, "style.css"), cssContent, "utf8");
  fs.writeFileSync(path.join(projectDir, "script.js"), jsContent, "utf8");
  fs.writeFileSync(
    path.join(projectDir, "ARCHITECTURE.md"),
    archContent,
    "utf8"
  );

  const files = [
    path.join(projectDir, "index.html"),
    path.join(projectDir, "style.css"),
    path.join(projectDir, "script.js"),
    path.join(projectDir, "ARCHITECTURE.md"),
  ];

  if (!skipGenerate) {
    // Generate thumbnail.svg and update data/projects.json
    generateProjects({
      projectsDir,
      repoRoot,
      outputFile,
      throwOnError: true,
    });

    // Update README.md projects table
    try {
      generateReadmeTable({
        readmePath: path.join(repoRoot, "README.md"),
        projectsPath: outputFile,
      });
    } catch {
      // Non-fatal if README update fails in specialized environments
    }
  }

  return {
    projectDir,
    relPath,
    title,
    files,
  };
}

/**
 * Parses CLI arguments into category and name.
 *
 * @param {string[]} argv
 * @returns {{ category?: string, name?: string }}
 */
function parseArgs(argv = process.argv.slice(2)) {
  let category;
  let name;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--category" || arg === "-c") {
      category = argv[++i];
    } else if (arg === "--name" || arg === "-n") {
      name = argv[++i];
    } else if (!arg.startsWith("-")) {
      if (!category) {
        category = arg;
      } else if (!name) {
        name = arg;
      }
    }
  }

  return { category, name };
}

function printUsage() {
  console.log(`Usage:
  npm run new-mini <category> <name>
  node scripts/new-mini.js <category> <name>

Supported categories:
  ${SUPPORTED_CATEGORIES.join(", ")}

Example:
  npm run new-mini games space-invaders
`);
}

async function main() {
  const { category, name } = parseArgs();

  if (!category || !name) {
    console.error("❌ Error: Both category and name are required.\n");
    printUsage();
    process.exit(1);
  }

  try {
    const result = await createMini({ category, name });
    console.log(`\n🎉 Successfully created mini-project "${result.title}"!`);
    console.log(`   Location: ${result.relPath}`);
    console.log("   Files generated:");
    console.log(`     - ${result.relPath}index.html`);
    console.log(`     - ${result.relPath}style.css`);
    console.log(`     - ${result.relPath}script.js`);
    console.log(`     - ${result.relPath}ARCHITECTURE.md`);
    console.log(`     - ${result.relPath}thumbnail.svg`);
    console.log(
      `\n✅ Registered in data/projects.json and synchronized README.md.`
    );
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  SLUG_REGEX,
  isValidSlug,
  isValidCategory,
  checkProjectExists,
  buildArchitectureDoc,
  buildHtml,
  buildCss,
  buildJs,
  formatWithPrettier,
  createMini,
  parseArgs,
  main,
};
