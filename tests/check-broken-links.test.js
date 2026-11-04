const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  parseMarkdownLinks,
  parseHtmlLinks,
  isExternal,
  sanitizePath,
  validateLinks,
  validateGalleryProjects,
} = require("../scripts/check-broken-links.js");

test("isExternal correctly identifies external or special protocol links", () => {
  assert.equal(isExternal("http://example.com"), true);
  assert.equal(isExternal("https://example.com"), true);
  assert.equal(isExternal("mailto:user@example.com"), true);
  assert.equal(isExternal("javascript:void(0)"), true);
  assert.equal(isExternal("data:image/png;base64,123"), true);
  assert.equal(isExternal("#section-heading"), true);
  assert.equal(isExternal("./relative/file.md"), false);
  assert.equal(isExternal("projects/games/index.html"), false);
});

test("sanitizePath strips hash fragments and query strings and decodes URI", () => {
  assert.equal(sanitizePath("doc.md#section-1"), "doc.md");
  assert.equal(sanitizePath("script.js?v=1.2"), "script.js");
  assert.equal(
    sanitizePath("my%20folder/file.html#head"),
    "my folder/file.html"
  );
});

test("parseMarkdownLinks extracts internal and external markdown link targets", () => {
  const content = `
# Sample Doc
Check out [Contributing Guide](./CONTRIBUTING.md) and [Image](assets/logo.png).
Also see [External](https://github.com).
  `;

  const links = parseMarkdownLinks(content);
  assert.equal(links.length, 3);
  assert.equal(links[0].target, "./CONTRIBUTING.md");
  assert.equal(links[0].lineNumber, 3);
  assert.equal(links[1].target, "assets/logo.png");
  assert.equal(links[2].target, "https://github.com");
});

test("parseHtmlLinks extracts href and src attributes from HTML content", () => {
  const content = `
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="style.css">
    <script src="script.js"></script>
  </head>
  <body>
    <a href="index.html">Home</a>
    <img src="assets/image.png" alt="Test">
  </body>
</html>
  `;

  const links = parseHtmlLinks(content);
  assert.equal(links.length, 4);
  assert.equal(links[0].target, "style.css");
  assert.equal(links[1].target, "script.js");
  assert.equal(links[2].target, "index.html");
  assert.equal(links[3].target, "assets/image.png");
});

test("validateLinks scans workspace without finding broken internal links", () => {
  const broken = validateLinks();
  assert.equal(broken.length, 0);
});

test("validateGalleryProjects detects missing mini project directory and index.html", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-test-"));
  const dataDir = path.join(tmpDir, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const projects = [
    {
      title: "Missing Game",
      category: "games",
      path: "projects/games/missing-game/",
    },
  ];
  fs.writeFileSync(
    path.join(dataDir, "projects.json"),
    JSON.stringify(projects, null, 2)
  );

  const broken = validateGalleryProjects(tmpDir);
  assert.equal(broken.length, 2); // missing folder/index.html AND missing thumbnail
  assert.equal(broken[0].source, "data/projects.json");
  assert.equal(broken[0].target, "projects/games/missing-game/");
  assert.match(broken[0].detail, /missing mini entry point/i);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("validateLinks detects broken directory links lacking index.html and reports source file", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-test-doc-"));
  const htmlFile = path.join(tmpDir, "index.html");
  const emptySubdir = path.join(tmpDir, "empty-dir");
  fs.mkdirSync(emptySubdir, { recursive: true });

  fs.writeFileSync(
    htmlFile,
    `<!DOCTYPE html><html><body><a href="empty-dir/">Link</a></body></html>`
  );

  const broken = validateLinks({ rootDir: tmpDir });
  assert.equal(broken.length, 1);
  assert.equal(broken[0].source, "index.html");
  assert.equal(broken[0].target, "empty-dir/");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
