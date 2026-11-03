const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const IGNORED_DIRS = new Set(["node_modules", ".git", ".vscode"]);
const TARGET_EXTS = new Set([".md", ".html"]);
const EXTERNAL_PREFIXES = [
  "http://",
  "https://",
  "mailto:",
  "javascript:",
  "data:",
  "tel:",
  "#",
];

function getFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of list) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (
      entry.isFile() &&
      TARGET_EXTS.has(path.extname(entry.name).toLowerCase())
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

function parseMarkdownLinks(content) {
  const links = [];
  const lines = content.split("\n");
  // Matches [text](target) and ![alt](target)
  const mdLinkRegex = /!?\[.*?\]\(([^)\s]+)(?:\s+".*?")?\)/g;

  lines.forEach((line, index) => {
    let match;
    while ((match = mdLinkRegex.exec(line)) !== null) {
      links.push({ target: match[1], lineNumber: index + 1 });
    }
  });

  return links;
}

function parseHtmlLinks(content) {
  const links = [];
  const lines = content.split("\n");
  // Matches href="target" and src="target"
  const htmlLinkRegex = /(?:href|src)=["']([^"']+)["']/gi;

  lines.forEach((line, index) => {
    let match;
    while ((match = htmlLinkRegex.exec(line)) !== null) {
      links.push({ target: match[1], lineNumber: index + 1 });
    }
  });

  return links;
}

function isExternal(link) {
  if (typeof link !== "string") return false;
  const trimmed = link.trim().toLowerCase();
  return EXTERNAL_PREFIXES.some(prefix => trimmed.startsWith(prefix));
}

function sanitizePath(link) {
  if (typeof link !== "string") return "";
  let cleaned = link.split("#")[0].split("?")[0];
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch (e) {
    // Keep un-decoded if URI decode fails
  }
  return cleaned.trim();
}

function validateDocumentLinks(rootDir = REPO_ROOT) {
  const files = getFiles(rootDir);
  const brokenLinks = [];

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, "utf-8");
    const rawLinks =
      ext === ".md" ? parseMarkdownLinks(content) : parseHtmlLinks(content);

    for (const { target, lineNumber } of rawLinks) {
      if (!target || isExternal(target)) continue;

      const cleanLink = sanitizePath(target);
      if (!cleanLink) continue; // Pure fragment link e.g. #heading

      let resolvedPath;
      if (cleanLink.startsWith("/")) {
        resolvedPath = path.join(rootDir, cleanLink);
      } else {
        resolvedPath = path.join(path.dirname(filePath), cleanLink);
      }

      let exists = fs.existsSync(resolvedPath);
      if (exists) {
        try {
          const stat = fs.statSync(resolvedPath);
          if (stat.isDirectory()) {
            exists = fs.existsSync(path.join(resolvedPath, "index.html"));
          }
        } catch {
          exists = false;
        }
      }

      if (!exists) {
        const relSource = path.relative(rootDir, filePath);
        brokenLinks.push({
          source: relSource.replace(/\\/g, "/"),
          line: lineNumber,
          target,
          resolvedPath: path
            .relative(rootDir, resolvedPath)
            .replace(/\\/g, "/"),
        });
      }
    }
  }

  return brokenLinks;
}

function validateGalleryProjects(rootDir = REPO_ROOT) {
  const projectsJsonPath = path.join(rootDir, "data", "projects.json");
  const brokenLinks = [];
  if (!fs.existsSync(projectsJsonPath)) return brokenLinks;

  try {
    const raw = fs.readFileSync(projectsJsonPath, "utf8");
    const projects = JSON.parse(raw);
    if (!Array.isArray(projects)) return brokenLinks;

    projects.forEach((project, idx) => {
      if (!project || typeof project !== "object") return;
      const projectPath = project.path;
      if (projectPath && !isExternal(projectPath)) {
        const cleanPath = sanitizePath(projectPath);
        const resolvedProjectDir = path.join(rootDir, cleanPath);
        const indexFile = path.join(resolvedProjectDir, "index.html");

        if (!fs.existsSync(resolvedProjectDir) || !fs.existsSync(indexFile)) {
          brokenLinks.push({
            source: "data/projects.json",
            line: idx + 1,
            target: projectPath,
            resolvedPath: path.relative(rootDir, indexFile).replace(/\\/g, "/"),
            detail: `Gallery card for "${project.title || "Unknown"}" points to missing mini entry point`,
          });
        }
      }

      if (project.path) {
        const thumbPath = path.join(rootDir, project.path, "thumbnail.svg");
        if (!fs.existsSync(thumbPath)) {
          brokenLinks.push({
            source: "data/projects.json",
            line: idx + 1,
            target: `${project.path}thumbnail.svg`,
            resolvedPath: path.relative(rootDir, thumbPath).replace(/\\/g, "/"),
            detail: `Gallery thumbnail for "${project.title || "Unknown"}" is missing`,
          });
        }
      }
    });
  } catch (err) {
    brokenLinks.push({
      source: "data/projects.json",
      line: 1,
      target: "data/projects.json",
      resolvedPath: "data/projects.json",
      detail: `Malformed JSON in projects.json: ${err.message}`,
    });
  }

  return brokenLinks;
}

function validateLinks(options = {}) {
  const rootDir = options.rootDir || REPO_ROOT;
  const docBroken = validateDocumentLinks(rootDir);
  const galleryBroken = validateGalleryProjects(rootDir);
  return [...docBroken, ...galleryBroken];
}

function main() {
  console.log(
    "Scanning repository and home gallery for broken internal links..."
  );
  const broken = validateLinks();

  if (broken.length > 0) {
    console.error(`\n❌ Found ${broken.length} broken internal link(s):\n`);
    broken.forEach(({ source, line, target, resolvedPath, detail }) => {
      console.error(
        `  - ${source}:${line} -> "${target}" (Resolved: ${resolvedPath})${detail ? ` [${detail}]` : ""}`
      );
      if (process.env.GITHUB_ACTIONS) {
        console.error(
          `::error file=${source},line=${line}::Broken link "${target}" -> "${resolvedPath}"${detail ? ` (${detail})` : ""}`
        );
      }
    });
    console.error("\nPlease fix all broken internal links.");
    process.exit(1);
  } else {
    console.log(
      "\n✅ All internal links across the home gallery, documentation, and project pages are valid!"
    );
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getFiles,
  parseMarkdownLinks,
  parseHtmlLinks,
  isExternal,
  sanitizePath,
  validateDocumentLinks,
  validateGalleryProjects,
  validateLinks,
};
