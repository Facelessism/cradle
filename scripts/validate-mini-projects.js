const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const PROJECTS_DIR = path.join(REPO_ROOT, "projects");
const PROJECTS_JSON = path.join(REPO_ROOT, "data", "projects.json");
const REQUIRED_STANDARD_FILES = [
  "index.html",
  "script.js",
  "style.css",
  "thumbnail.svg",
];

const EXTERNAL_PREFIXES = [
  "http://",
  "https://",
  "//",
  "mailto:",
  "javascript:",
  "data:",
  "tel:",
  "#",
];

function isExternal(url) {
  if (!url) return true;
  const trimmed = url.trim().toLowerCase();
  return EXTERNAL_PREFIXES.some(prefix => trimmed.startsWith(prefix));
}

function sanitizePath(url) {
  let cleaned = url.split("#")[0].split("?")[0].trim();
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch (e) {
    // Keep un-decoded if URI decode fails
  }
  return cleaned;
}

/**
 * Scans projects directory to discover all mini project folders.
 */
function getDiskProjects() {
  const diskProjects = [];
  if (!fs.existsSync(PROJECTS_DIR)) return diskProjects;

  const categories = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const cat of categories) {
    const catPath = path.join(PROJECTS_DIR, cat.name);
    const projects = fs
      .readdirSync(catPath, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const proj of projects) {
      const relPath = `projects/${cat.name}/${proj.name}/`;
      diskProjects.push({
        category: cat.name,
        name: proj.name,
        relPath,
        absPath: path.join(catPath, proj.name),
      });
    }
  }

  return diskProjects;
}

/**
 * Parses internal file references (scripts, stylesheets, images, media, links) from HTML.
 */
function parseHtmlAssetLinks(htmlContent) {
  const links = [];
  const regex = /(?:src|href)=["']([^"']+)["']/gi;
  let match;

  while ((match = regex.exec(htmlContent)) !== null) {
    links.push(match[1]);
  }

  return links;
}

function validateStandardProjectFiles(diskProjects) {
  const issues = [];

  for (const project of diskProjects) {
    for (const fileName of REQUIRED_STANDARD_FILES) {
      const filePath = path.join(project.absPath, fileName);

      if (!fs.existsSync(filePath)) {
        issues.push({
          type: "MISSING_STANDARD_FILE",
          project: project.name,
          message: `Project folder "${project.relPath}" is missing required standard file "${fileName}".`,
        });
      }
    }
  }

  return issues;
}

function validateProjectIndexEntries(diskProjects, projectsJsonData) {
  const registeredPaths = new Set(
    projectsJsonData.map(project => project.path)
  );

  return diskProjects
    .filter(project => !registeredPaths.has(project.relPath))
    .map(project => ({
      type: "UNINDEXED_PROJECT",
      project: project.name,
      message: `Project folder "${project.relPath}" exists on disk but is missing from data/projects.json.`,
    }));
}

function validateProjectNavigation(diskProjects) {
  const issues = [];

  for (const project of diskProjects) {
    const htmlPath = path.join(project.absPath, "index.html");
    if (!fs.existsSync(htmlPath)) continue;

    const htmlContent = fs.readFileSync(htmlPath, "utf-8");
    const hasBackToHomeScript = /src=["'][^"']*BackToHome\.js["']/i.test(
      htmlContent
    );
    const hasUIBundle = /src=["'][^"']*components\/ui\/index\.js["']/i.test(
      htmlContent
    );
    const hasDataAttr = /data-cradle-back-to-home/i.test(htmlContent);

    if (!hasBackToHomeScript && !hasUIBundle && !hasDataAttr) {
      issues.push({
        type: "MISSING_NAVIGATION",
        project: project.name,
        message: `Project "${project.relPath}" does not include the shared BackToHome navigation component.`,
      });
    }
  }

  return issues;
}

function validateProjectFavicons(diskProjects) {
  const issues = [];

  for (const project of diskProjects) {
    const htmlPath = path.join(project.absPath, "index.html");
    if (!fs.existsSync(htmlPath)) continue;

    const htmlContent = fs.readFileSync(htmlPath, "utf-8");
    const iconMatch = htmlContent.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/i);

    if (!iconMatch) {
      issues.push({
        type: "MISSING_FAVICON",
        project: project.name,
        message: `Project "${project.relPath}" is missing a favicon <link rel="icon" ...> tag in index.html.`,
      });
      continue;
    }

    const hrefMatch = iconMatch[0].match(/href=["']([^"']+)["']/i);
    if (!hrefMatch || !hrefMatch[1].trim() || hrefMatch[1].trim() === "data:,") {
      issues.push({
        type: "INVALID_FAVICON",
        project: project.name,
        message: `Project "${project.relPath}" has an empty or invalid favicon href in index.html.`,
      });
      continue;
    }

    const rawHref = hrefMatch[1].trim();
    if (!isExternal(rawHref)) {
      const cleanHref = sanitizePath(rawHref);
      const resolvedPath = cleanHref.startsWith("/")
        ? path.join(REPO_ROOT, cleanHref)
        : path.resolve(project.absPath, cleanHref);

      if (!fs.existsSync(resolvedPath)) {
        issues.push({
          type: "BROKEN_FAVICON",
          project: project.name,
          message: `Project "${project.relPath}" references favicon "${rawHref}" which does not exist on disk (Resolved: "${path.relative(REPO_ROOT, resolvedPath)}").`,
        });
      }
    }
  }

  return issues;
}

/**
 * Validates that every mini project opens successfully without missing pages or load failures.
 */
function validateMiniProjects() {
  const issues = [];

  // 1. Validate data/projects.json presence & content
  if (!fs.existsSync(PROJECTS_JSON)) {
    return [{ type: "CONFIG", message: "data/projects.json does not exist." }];
  }

  let projectsJsonData = [];
  try {
    projectsJsonData = JSON.parse(fs.readFileSync(PROJECTS_JSON, "utf-8"));
  } catch (e) {
    return [
      {
        type: "CONFIG",
        message: `data/projects.json contains invalid JSON: ${e.message}`,
      },
    ];
  }

  // 2. Check disk projects against projects.json registry
  const diskProjects = getDiskProjects();
  issues.push(...validateStandardProjectFiles(diskProjects));
  issues.push(...validateProjectIndexEntries(diskProjects, projectsJsonData));
  issues.push(...validateProjectNavigation(diskProjects));
  issues.push(...validateProjectFavicons(diskProjects));

  // 3. Validate each registered project entry in projects.json
  for (const project of projectsJsonData) {
    const projRelPath = project.path;
    const projAbsPath = path.join(REPO_ROOT, projRelPath);

    // Check directory existence
    if (
      !fs.existsSync(projAbsPath) ||
      !fs.statSync(projAbsPath).isDirectory()
    ) {
      issues.push({
        type: "MISSING_DIR",
        project: project.title,
        message: `Project directory "${projRelPath}" listed in projects.json does not exist.`,
      });
      continue;
    }

    // Check entry point index.html
    const htmlPath = path.join(projAbsPath, "index.html");
    if (!fs.existsSync(htmlPath)) {
      issues.push({
        type: "MISSING_INDEX",
        project: project.title,
        message: `Entry point "${projRelPath}index.html" is missing.`,
      });
      continue;
    }

    const htmlStat = fs.statSync(htmlPath);
    if (htmlStat.size === 0) {
      issues.push({
        type: "EMPTY_INDEX",
        project: project.title,
        message: `Entry point "${projRelPath}index.html" is an empty 0-byte file.`,
      });
      continue;
    }

    const htmlContent = fs.readFileSync(htmlPath, "utf-8");
    if (!/<(?:html|body|head|doctype)/i.test(htmlContent)) {
      issues.push({
        type: "INVALID_HTML",
        project: project.title,
        message: `Entry point "${projRelPath}index.html" does not contain valid HTML structure.`,
      });
    }

    // 4. Validate internal asset/resource references in index.html
    const assetLinks = parseHtmlAssetLinks(htmlContent);
    for (const rawLink of assetLinks) {
      if (isExternal(rawLink)) continue;

      const cleanLink = sanitizePath(rawLink);
      if (!cleanLink) continue;

      let resolvedPath;
      if (cleanLink.startsWith("/")) {
        resolvedPath = path.join(REPO_ROOT, cleanLink);
      } else {
        resolvedPath = path.resolve(projAbsPath, cleanLink);
      }

      if (!fs.existsSync(resolvedPath)) {
        issues.push({
          type: "BROKEN_ASSET",
          project: project.title,
          message: `In "${projRelPath}index.html": Referenced resource "${rawLink}" could not be found on disk (Resolved: "${path.relative(
            REPO_ROOT,
            resolvedPath
          )}").`,
        });
      }
    }
  }

  return issues;
}

function main() {
  console.log(
    "Validating all mini projects for load accessibility, entry points, and asset integrity..."
  );
  const issues = validateMiniProjects();

  if (issues.length > 0) {
    console.error(
      `\n❌ Found ${issues.length} mini project accessibility or load issue(s):\n`
    );
    issues.forEach(issue => {
      console.error(`  - [${issue.type}] ${issue.message}`);
    });
    console.error(
      "\nPlease resolve all missing pages, broken resource links, or unindexed project issues."
    );
    process.exit(1);
  } else {
    console.log(
      "\n✅ All mini projects opened and validated successfully without page or load failures!"
    );
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  isExternal,
  sanitizePath,
  getDiskProjects,
  parseHtmlAssetLinks,
  validateStandardProjectFiles,
  validateProjectIndexEntries,
  validateProjectNavigation,
  validateProjectFavicons,
  validateMiniProjects,
};
