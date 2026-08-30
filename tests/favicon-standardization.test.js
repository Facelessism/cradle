const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const PROJECTS_JSON = path.join(REPO_ROOT, "data", "projects.json");
const FAVICON_PATH = path.join(REPO_ROOT, "assets", "favicon.svg");

function getAllHtmlFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") {
        results = results.concat(getAllHtmlFiles(fullPath));
      }
    } else if (entry.name.endsWith(".html")) {
      results.push(fullPath);
    }
  }
  return results;
}

test("assets/favicon.svg exists and is a valid SVG icon", () => {
  assert.ok(fs.existsSync(FAVICON_PATH), "assets/favicon.svg must exist");
  const content = fs.readFileSync(FAVICON_PATH, "utf-8");
  assert.ok(content.length > 0, "assets/favicon.svg must not be empty");
  assert.match(content, /<svg[^>]*>/i, "assets/favicon.svg must contain an <svg> element");
  assert.match(content, /<\/svg>/i, "assets/favicon.svg must have a closing </svg> element");
});

test("root index.html defines the standard favicon link", () => {
  const rootIndex = path.join(REPO_ROOT, "index.html");
  assert.ok(fs.existsSync(rootIndex), "root index.html must exist");
  const content = fs.readFileSync(rootIndex, "utf-8");
  const match = content.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/i);
  assert.ok(match, "root index.html must have a favicon link tag");
  assert.match(match[0], /href=["']assets\/favicon\.svg["']/i);
});

test("src/components/ui/demo.html defines the standard favicon link", () => {
  const demoHtml = path.join(REPO_ROOT, "src", "components", "ui", "demo.html");
  assert.ok(fs.existsSync(demoHtml), "src/components/ui/demo.html must exist");
  const content = fs.readFileSync(demoHtml, "utf-8");
  const match = content.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/i);
  assert.ok(match, "demo.html must have a favicon link tag");
  assert.match(match[0], /href=["']\.\.\/\.\.\/\.\.\/assets\/favicon\.svg["']/i);
});

test("every registered mini project has a valid standard favicon link", () => {
  const projects = JSON.parse(fs.readFileSync(PROJECTS_JSON, "utf-8"));
  assert.ok(Array.isArray(projects) && projects.length > 0);

  for (const project of projects) {
    const htmlPath = path.join(REPO_ROOT, project.path, "index.html");
    assert.ok(fs.existsSync(htmlPath), `Entry point for ${project.title} must exist`);

    const content = fs.readFileSync(htmlPath, "utf-8");
    const match = content.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/i);
    assert.ok(
      match,
      `Project "${project.title}" (${project.path}) is missing a favicon link tag in index.html`
    );

    const hrefMatch = match[0].match(/href=["']([^"']+)["']/i);
    assert.ok(
      hrefMatch && hrefMatch[1].trim(),
      `Project "${project.title}" (${project.path}) has an invalid favicon href`
    );

    const target = hrefMatch[1].trim();
    assert.notEqual(
      target,
      "data:,",
      `Project "${project.title}" (${project.path}) must not use placeholder data:, favicon`
    );

    const resolved = path.resolve(path.dirname(htmlPath), target);
    assert.ok(
      fs.existsSync(resolved),
      `Project "${project.title}" (${project.path}) favicon "${target}" does not exist on disk`
    );
  }
});

test("no HTML files in the repository contain broken or missing favicon references", () => {
  const htmlFiles = getAllHtmlFiles(REPO_ROOT);
  assert.ok(htmlFiles.length > 0);

  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const relFile = path.relative(REPO_ROOT, file).replace(/\\/g, "/");
    const match = content.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/i);

    assert.ok(
      match,
      `File "${relFile}" is missing a favicon link tag in <head>`
    );

    const hrefMatch = match[0].match(/href=["']([^"']+)["']/i);
    assert.ok(
      hrefMatch && hrefMatch[1].trim(),
      `File "${relFile}" has an empty favicon href`
    );

    const target = hrefMatch[1].trim();
    assert.notEqual(
      target,
      "data:,",
      `File "${relFile}" must not use dummy data:, favicon`
    );

    const resolved = path.resolve(path.dirname(file), target);
    assert.ok(
      fs.existsSync(resolved),
      `File "${relFile}" references favicon "${target}" which does not exist on disk`
    );
  }
});
