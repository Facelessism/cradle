const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const PROJECTS_DIR = path.join(__dirname, "..", "projects");
const TEMPLATE_PATH = path.join(__dirname, "..", "ARCHITECTURE_TEMPLATE.md");
const REQUIRED_FILE = "ARCHITECTURE.md";

function getRequiredSections(templatePath = TEMPLATE_PATH) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Architecture template not found: ${templatePath}`);
  }
  return fs.readFileSync(templatePath, "utf8")
    .split(/\r?\n/)
    .filter(line => /^## /.test(line))
    .map(line => line.trim());
}

function getProjectDirectories(projectsDir = PROJECTS_DIR) {
  if (!fs.existsSync(projectsDir)) throw new Error(`Projects directory not found: ${projectsDir}`);
  const result = [];
  for (const category of fs.readdirSync(projectsDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
    const categoryPath = path.join(projectsDir, category.name);
    for (const mini of fs.readdirSync(categoryPath, { withFileTypes: true }).filter(d => d.isDirectory())) {
      result.push(path.join(categoryPath, mini.name));
    }
  }
  return result.sort();
}

function findMissingArchitectureDocs(projectDirectories) {
  return projectDirectories.filter(projectDir => {
    const file = path.join(projectDir, REQUIRED_FILE);
    return !fs.existsSync(file) || fs.readFileSync(file, "utf8").trim().length === 0;
  });
}

function formatRelativePaths(paths) {
  return paths.map(filePath => path.relative(path.join(__dirname, ".."), filePath).replace(/\\/g, "/"));
}

function hasTemplateNoticeBlock(content) {
  return content.includes("This is the standardized ARCHITECTURE.md template for the Cradle repository.");
}

function validateArchitectureStructure(projectDirectories, requiredSections = getRequiredSections()) {
  const issues = [];
  for (const projectDir of projectDirectories) {
    const file = path.join(projectDir, REQUIRED_FILE);
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    if (!content.trim()) continue;
    const present = new Set(content.split(/\r?\n/).filter(line => /^## /.test(line)).map(line => line.trim()));
    const missingSections = requiredSections.filter(section => !present.has(section));
    const hasNoticeBlock = hasTemplateNoticeBlock(content);
    if (missingSections.length || hasNoticeBlock) issues.push({ projectDir, missingSections, hasNoticeBlock });
  }
  return issues;
}

function getValidationDirectories(projectDirectories) {
  if (process.env.GITHUB_EVENT_NAME !== "pull_request") return projectDirectories;

  try {
    const baseRef = process.env.GITHUB_BASE_REF;
    if (!baseRef) throw new Error("GITHUB_BASE_REF is not available");

    // Pull-request jobs use a shallow merge checkout, so HEAD^1 may not exist.
    // Fetch the base branch and compare it directly with the checked-out merge.
    execFileSync("git", ["fetch", "--no-tags", "--depth=1", "origin", baseRef], {
      stdio: "ignore",
    });

    const changedFiles = execFileSync(
      "git",
      ["diff", "--name-only", `origin/${baseRef}`, "HEAD"],
      { encoding: "utf8" }
    )
      .split(/\r?\n/)
      .map(file => file.trim())
      .filter(Boolean);

    const changedProjects = new Set();
    for (const file of changedFiles) {
      const match = file.match(/^(projects\/[^/]+\/[^/]+)(?:\/|$)/);
      if (match) changedProjects.add(match[1]);
    }

    return projectDirectories.filter(projectDir =>
      changedProjects.has(
        path.relative(path.join(__dirname, ".."), projectDir).replace(/\\/g, "/")
      )
    );
  } catch (error) {
    console.warn("Could not determine PR-changed projects; validating all architecture documents.");
    return projectDirectories;
  }
}

function validateArchitectureDocs() {
  const projectDirectories = getProjectDirectories();
  const validationDirectories = getValidationDirectories(projectDirectories);
  const missingDocs = findMissingArchitectureDocs(validationDirectories);

  if (missingDocs.length) {
    console.error(`Missing or empty ${REQUIRED_FILE} files found in ${missingDocs.length} changed mini project(s):`);
    for (const projectDir of formatRelativePaths(missingDocs)) console.error(`- ${projectDir}/${REQUIRED_FILE}`);
    process.exitCode = 1;
  }

  const presentDocs = validationDirectories.filter(d => !missingDocs.includes(d));
  const structureIssues = validateArchitectureStructure(presentDocs);
  if (structureIssues.length) {
    console.error(`\nStructure issues found in ${structureIssues.length} changed ${REQUIRED_FILE} file(s):`);
    for (const { projectDir, missingSections, hasNoticeBlock } of structureIssues) {
      console.error(`\n  ${formatRelativePaths([projectDir])[0]}/${REQUIRED_FILE}`);
      if (hasNoticeBlock) console.error("    ✗ Template notice block was not removed — delete the blockquote at the top of the file before submitting.");
      for (const section of missingSections) console.error(`    ✗ Missing required section: ${section}`);
    }
    process.exitCode = 1;
    return;
  }

  if (!process.exitCode) console.log(`Validated ${validationDirectories.length} changed mini project architecture document(s).`);
}

if (require.main === module) validateArchitectureDocs();

module.exports = {
  findMissingArchitectureDocs,
  formatRelativePaths,
  getProjectDirectories,
  getRequiredSections,
  getValidationDirectories,
  hasTemplateNoticeBlock,
  validateArchitectureDocs,
  validateArchitectureStructure,
};
