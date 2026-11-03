const fs = require("fs");
const path = require("path");
const { discoverProjects } = require("./project-discovery");

const REPO_ROOT = path.resolve(__dirname, "..");
const PROJECTS_DIR = path.join(REPO_ROOT, "projects");
const SITEMAP_FILE = path.join(REPO_ROOT, "sitemap.xml");
const DEFAULT_BASE_URL = "https://cradle-zeta.vercel.app";

/**
 * Builds standard XML sitemap string from a list of project objects or folders.
 *
 * @param {Array<{relPath?: string, path?: string}>} [projects] - Projects array. If omitted, discovered from projectsDir.
 * @param {string} [baseUrl=DEFAULT_BASE_URL] - Base URL of the deployed site.
 * @param {string} [projectsDir=PROJECTS_DIR] - Absolute path to projects directory.
 * @param {string} [repoRoot=REPO_ROOT] - Absolute path to repo root.
 * @returns {string} XML sitemap string.
 */
function buildSitemapXml(
  projects,
  baseUrl = DEFAULT_BASE_URL,
  projectsDir = PROJECTS_DIR,
  repoRoot = REPO_ROOT
) {
  const projectList =
    Array.isArray(projects) && projects.length > 0
      ? projects
      : discoverProjects(projectsDir, repoRoot);

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    `  <url>`,
    `    <loc>${normalizedBase}/</loc>`,
    `  </url>`,
  ];

  for (const project of projectList) {
    if (!project) continue;
    const rawPath = project.relPath || project.path;
    if (typeof rawPath !== "string" || !rawPath.trim()) continue;

    const cleanPath = rawPath.replace(/^\/+/, "");
    lines.push(`  <url>`);
    lines.push(`    <loc>${normalizedBase}/${cleanPath}</loc>`);
    lines.push(`  </url>`);
  }

  lines.push(`</urlset>`);
  return lines.join("\n") + "\n";
}

/**
 * Generates and writes sitemap.xml to disk.
 *
 * @param {object} [options]
 * @param {Array} [options.projects] - Array of project objects.
 * @param {string} [options.repoRoot] - Repository root path.
 * @param {string} [options.projectsDir] - Projects directory path.
 * @param {string} [options.sitemapFile] - Destination sitemap.xml path.
 * @param {string} [options.baseUrl] - Base URL of the deployed site.
 * @returns {{ content: string, sitemapFile: string, count: number }}
 */
function generateSitemap(options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  const projectsDir = options.projectsDir || path.join(repoRoot, "projects");
  const sitemapFile = options.sitemapFile || path.join(repoRoot, "sitemap.xml");
  const baseUrl = options.baseUrl || DEFAULT_BASE_URL;

  const projects =
    Array.isArray(options.projects) && options.projects.length > 0
      ? options.projects
      : discoverProjects(projectsDir, repoRoot);

  const content = buildSitemapXml(projects, baseUrl, projectsDir, repoRoot);
  fs.writeFileSync(sitemapFile, content, "utf8");

  const totalUrls = projects.length + 1;
  console.log(
    `✅ Generated sitemap.xml with ${totalUrls} URLs (${projects.length} minis + home) → ${path.relative(repoRoot, sitemapFile)}`
  );

  return { content, sitemapFile, count: totalUrls };
}

/**
 * Validates that sitemap.xml exists and is synchronized with the mini projects.
 *
 * @param {object} [options]
 * @returns {{ inSync: boolean, issues: string[] }}
 */
function validateSitemapSync(options = {}) {
  const repoRoot = options.repoRoot || REPO_ROOT;
  const projectsDir = options.projectsDir || path.join(repoRoot, "projects");
  const sitemapFile = options.sitemapFile || path.join(repoRoot, "sitemap.xml");
  const baseUrl = options.baseUrl || DEFAULT_BASE_URL;

  const issues = [];

  if (!fs.existsSync(sitemapFile)) {
    issues.push("sitemap.xml does not exist at repo root");
    return { inSync: false, issues };
  }

  const projects =
    Array.isArray(options.projects) && options.projects.length > 0
      ? options.projects
      : discoverProjects(projectsDir, repoRoot);

  const expected = buildSitemapXml(projects, baseUrl, projectsDir, repoRoot)
    .replace(/\r\n/g, "\n")
    .trim();

  const actual = fs
    .readFileSync(sitemapFile, "utf8")
    .replace(/\r\n/g, "\n")
    .trim();

  if (actual !== expected) {
    issues.push(
      "sitemap.xml is out of sync with current mini project folders or baseUrl"
    );
  }

  return {
    inSync: issues.length === 0,
    issues,
  };
}

function main() {
  const isCheckMode = process.argv.includes("--check");

  if (isCheckMode) {
    console.log("Checking that sitemap.xml is up to date with mini folders...");
    const result = validateSitemapSync();
    if (!result.inSync) {
      console.error(
        `\n❌ Sitemap synchronization check failed with ${result.issues.length} issue(s):`
      );
      result.issues.forEach(issue => console.error(`  - ${issue}`));
      console.error(
        `\n💡 To regenerate the sitemap, run:\n  npm run generate:sitemap\n`
      );
      process.exit(1);
    }
    console.log("✅ sitemap.xml is fully up to date.");
    process.exit(0);
  } else {
    generateSitemap();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_BASE_URL,
  REPO_ROOT,
  PROJECTS_DIR,
  SITEMAP_FILE,
  buildSitemapXml,
  generateSitemap,
  validateSitemapSync,
};
