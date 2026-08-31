const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function findProjectPages(dir) {
  const files = [];

  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);

    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...findProjectPages(fullPath));
    } else if (item === "index.html") {
      files.push(fullPath);
    }
  }

  return files;
}

test("all mini projects have SEO metadata", () => {
  const files = findProjectPages(
    path.join(__dirname, "..", "projects"),
  );

  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");

    assert.match(html, /<title>/i, file);
    assert.match(html, /name=["']description["']/i, file);
    assert.match(html, /rel=["']canonical["']/i, file);
    assert.match(html, /property=["']og:title["']/i, file);
    assert.match(html, /property=["']og:description["']/i, file);
    assert.match(html, /property=["']og:url["']/i, file);
  }
});