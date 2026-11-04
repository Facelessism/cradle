#!/usr/bin/env node

/**
 * Cradle — README Projects Table Generator & Validator
 * ─────────────────────────────────────────────────────
 * Generates and synchronizes the table of available mini-projects
 * in README.md from data/projects.json.
 *
 * CLI Usage:
 *   Update README table:
 *     node scripts/generate-readme-table.js
 *
 *   Verify README table is synchronized (used in CI):
 *     node scripts/generate-readme-table.js --check
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.env.CRADLE_ROOT
  ? path.resolve(process.env.CRADLE_ROOT)
  : path.resolve(__dirname, "..");
const PROJECTS_FILE = path.join(REPO_ROOT, "data", "projects.json");
const README_FILE = path.join(REPO_ROOT, "README.md");

const START_MARKER = "<!-- projects-table-start -->";
const END_MARKER = "<!-- projects-table-end -->";
const START_MARKER_REGEX = /<!--\s*projects(?:-table)?[:\s-_]start\s*-->/i;
const END_MARKER_REGEX = /<!--\s*projects(?:-table)?[:\s-_]end\s*-->/i;

/**
 * Escapes characters that could break markdown table cells.
 *
 * @param {*} value
 * @returns {string}
 */
function escapeTableCell(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\|/g, "\\|").trim();
}

/**
 * Renders a Markdown table containing Name, Category, and Link columns
 * for the provided projects list. Column widths are padded so the output
 * matches Prettier's markdown table formatting conventions.
 *
 * @param {Array<{ title: string, category: string, path: string }>} projects
 * @returns {string} Markdown table
 */
function renderProjectsTable(projects) {
  if (!Array.isArray(projects) || projects.length === 0) {
    return "";
  }

  const headers = ["Name", "Category", "Link"];
  const rows = projects.map(p => [
    escapeTableCell(p.title),
    escapeTableCell(p.category),
    `[${escapeTableCell(p.path)}](${escapeTableCell(p.path)})`,
  ]);

  const colWidths = headers.map(h => h.length);
  for (const row of rows) {
    for (let i = 0; i < 3; i++) {
      if (row[i].length > colWidths[i]) {
        colWidths[i] = row[i].length;
      }
    }
  }

  const pad = (str, len) => str + " ".repeat(Math.max(0, len - str.length));
  const headerLine = `| ${headers.map((h, i) => pad(h, colWidths[i])).join(" | ")} |`;
  const separatorLine = `| ${colWidths.map(w => "-".repeat(w)).join(" | ")} |`;
  const rowLines = rows.map(
    r => `| ${r.map((c, i) => pad(c, colWidths[i])).join(" | ")} |`
  );

  return [headerLine, separatorLine, ...rowLines].join("\n");
}

/**
 * Replaces or inserts the generated projects table into README markdown content.
 *
 * @param {string} readmeContent
 * @param {string} tableMarkdown
 * @returns {string}
 */
function updateReadmeContent(readmeContent, tableMarkdown) {
  const startMatch = START_MARKER_REGEX.exec(readmeContent);
  const endMatch = END_MARKER_REGEX.exec(readmeContent);

  if (startMatch && endMatch) {
    if (startMatch.index >= endMatch.index) {
      throw new Error("Start marker appears after end marker in README.md");
    }
    const before = readmeContent.slice(0, startMatch.index + startMatch[0].length);
    const after = readmeContent.slice(endMatch.index);
    return `${before}\n\n${tableMarkdown}\n\n${after}`;
  }

  // If markers not present, insert before "## Getting started"
  const gettingStartedRegex = /^##\s+Getting started/m;
  const gsMatch = gettingStartedRegex.exec(readmeContent);

  const sectionToInsert = `## Available Projects\n\n${START_MARKER}\n\n${tableMarkdown}\n\n${END_MARKER}\n\n`;

  if (gsMatch) {
    return (
      readmeContent.slice(0, gsMatch.index) +
      sectionToInsert +
      readmeContent.slice(gsMatch.index)
    );
  }

  return `${readmeContent.trimEnd()}\n\n${sectionToInsert}`;
}

/**
 * Validates that the README.md projects table is synchronized with data/projects.json.
 *
 * @param {Object} [options]
 * @param {string} [options.readmePath]
 * @param {string} [options.projectsPath]
 * @returns {{ inSync: boolean, issues: string[], expectedCount?: number }}
 */
function validateReadmeTable({
  readmePath = README_FILE,
  projectsPath = PROJECTS_FILE,
} = {}) {
  const issues = [];

  if (!fs.existsSync(projectsPath)) {
    issues.push(`Projects data file not found: ${projectsPath}`);
    return { inSync: false, issues };
  }

  if (!fs.existsSync(readmePath)) {
    issues.push(`README file not found: ${readmePath}`);
    return { inSync: false, issues };
  }

  let projects;
  try {
    projects = JSON.parse(fs.readFileSync(projectsPath, "utf-8"));
  } catch (err) {
    issues.push(`Failed to parse ${projectsPath}: ${err.message}`);
    return { inSync: false, issues };
  }

  if (!Array.isArray(projects)) {
    issues.push(`Expected array of projects in ${projectsPath}`);
    return { inSync: false, issues };
  }

  const readmeContent = fs.readFileSync(readmePath, "utf-8");
  const startMatch = START_MARKER_REGEX.exec(readmeContent);
  const endMatch = END_MARKER_REGEX.exec(readmeContent);

  if (!startMatch || !endMatch) {
    issues.push(
      `README.md is missing marked section comments (${START_MARKER} and ${END_MARKER}).`
    );
    return { inSync: false, issues, expectedCount: projects.length };
  }

  if (startMatch.index >= endMatch.index) {
    issues.push("Start marker appears after end marker in README.md");
    return { inSync: false, issues, expectedCount: projects.length };
  }

  const expectedTable = renderProjectsTable(projects);
  const actualSection = readmeContent
    .slice(startMatch.index + startMatch[0].length, endMatch.index)
    .replace(/\r\n/g, "\n")
    .trim();

  const normalizedExpected = expectedTable.replace(/\r\n/g, "\n").trim();

  if (actualSection !== normalizedExpected) {
    issues.push(
      "The projects table in README.md does not match data/projects.json."
    );
  }

  return {
    inSync: issues.length === 0,
    issues,
    expectedCount: projects.length,
  };
}

/**
 * Generates and writes the projects table to README.md.
 *
 * @param {Object} [options]
 * @param {string} [options.readmePath]
 * @param {string} [options.projectsPath]
 * @returns {{ success: boolean, count: number }}
 */
function generateReadmeTable({
  readmePath = README_FILE,
  projectsPath = PROJECTS_FILE,
} = {}) {
  if (!fs.existsSync(projectsPath)) {
    throw new Error(`Projects data file not found: ${projectsPath}`);
  }

  if (!fs.existsSync(readmePath)) {
    throw new Error(`README file not found: ${readmePath}`);
  }

  const projects = JSON.parse(fs.readFileSync(projectsPath, "utf-8"));
  const expectedTable = renderProjectsTable(projects);
  const currentReadme = fs.readFileSync(readmePath, "utf-8");

  // Determine line ending convention of target file
  const isCrlf = currentReadme.includes("\r\n");

  let updatedReadme = updateReadmeContent(currentReadme, expectedTable);

  if (isCrlf) {
    updatedReadme = updatedReadme.replace(/\r?\n/g, "\r\n");
  } else {
    updatedReadme = updatedReadme.replace(/\r\n/g, "\n");
  }

  fs.writeFileSync(readmePath, updatedReadme, "utf-8");
  return { success: true, count: projects.length };
}

function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes("--check") || args.includes("-c");

  let readmePath = README_FILE;
  let projectsPath = PROJECTS_FILE;

  const readmeIdx = args.indexOf("--readme");
  if (readmeIdx !== -1 && args[readmeIdx + 1]) {
    readmePath = path.resolve(args[readmeIdx + 1]);
  }
  const projectsIdx = args.indexOf("--projects");
  if (projectsIdx !== -1 && args[projectsIdx + 1]) {
    projectsPath = path.resolve(args[projectsIdx + 1]);
  }

  if (isCheck) {
    console.log(
      "Checking that README.md projects table is synchronized with data/projects.json..."
    );
    const result = validateReadmeTable({ readmePath, projectsPath });
    if (!result.inSync) {
      console.error(
        `\n❌ README.md projects table check failed with ${result.issues.length} issue(s):\n`
      );
      result.issues.forEach(issue => {
        console.error(`  - ${issue}`);
      });
      console.error(
        `\n💡 To synchronize the table, run:\n  npm run generate:readme\n`
      );
      process.exit(1);
    }
    console.log(
      `✅ README.md projects table is fully synchronized (${result.expectedCount} projects).`
    );
    process.exit(0);
  }

  try {
    const result = generateReadmeTable({ readmePath, projectsPath });
    console.log(
      `✅ Successfully updated README.md projects table (${result.count} projects).`
    );
    process.exit(0);
  } catch (err) {
    console.error(`❌ Failed to update README.md: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  START_MARKER,
  END_MARKER,
  START_MARKER_REGEX,
  END_MARKER_REGEX,
  escapeTableCell,
  renderProjectsTable,
  updateReadmeContent,
  validateReadmeTable,
  generateReadmeTable,
  main,
};
