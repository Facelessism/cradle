const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const PROJECTS_ROOT = path.resolve(__dirname, "..", "projects");

function hasAriaLive(html) {
  return /aria-live="[^"]+"|role="(status|alert|progressbar|log)"/.test(html);
}

function hasAsyncOperations(js) {
  return /async function|setTimeout|setInterval|fetch\(|\.Worker|postMessage/.test(js);
}

// Find all projects
function getProjectDirs(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      results.push(path.join(dir, entry.name));
      results = results.concat(getProjectDirs(path.join(dir, entry.name)));
    }
  }
  return results;
}

const allProjects = getProjectDirs(PROJECTS_ROOT);

test("projects with async operations have aria-live regions", async t => {
  for (const proj of allProjects) {
    const htmlPath = path.join(proj, "index.html");
    const jsPath = path.join(proj, "script.js");

    if (!fs.existsSync(htmlPath) || !fs.existsSync(jsPath)) {
      continue;
    }

    const js = fs.readFileSync(jsPath, "utf-8");
    if (hasAsyncOperations(js)) {
      const html = fs.readFileSync(htmlPath, "utf-8");
      
      await t.test(`${path.relative(PROJECTS_ROOT, proj)} should have aria-live`, () => {
        assert.ok(
          hasAriaLive(html),
          `Project uses async operations but is missing ARIA live regions in index.html.`
        );
      });
    }
  }
});
