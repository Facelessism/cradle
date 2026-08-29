const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  isExternal,
  sanitizePath,
  getDiskProjects,
  parseHtmlAssetLinks,
  validateStandardProjectFiles,
  validateProjectIndexEntries,
  validateProjectNavigation,
  validateProjectFavicons,
  validateMiniProjects,
} = require("../scripts/validate-mini-projects");

test("isExternal correctly identifies external URLs and protocols", () => {
  assert.equal(isExternal("https://cdn.jsdelivr.net/script.js"), true);
  assert.equal(isExternal("http://example.com/style.css"), true);
  assert.equal(isExternal("//unpkg.com/library.js"), true);
  assert.equal(isExternal("mailto:user@example.com"), true);
  assert.equal(isExternal("javascript:void(0)"), true);
  assert.equal(isExternal("data:image/png;base64,123"), true);
  assert.equal(isExternal("#section"), true);
  assert.equal(isExternal("script.js"), false);
  assert.equal(isExternal("../style.css"), false);
  assert.equal(isExternal("/src/components/ui/Button.js"), false);
});

test("sanitizePath strips hash fragments and query strings", () => {
  assert.equal(sanitizePath("style.css?v=1.2.3#main"), "style.css");
  assert.equal(sanitizePath("images/photo.png?raw=true"), "images/photo.png");
  assert.equal(sanitizePath("script.js#L10-L20"), "script.js");
  assert.equal(sanitizePath("hello%20world.js"), "hello world.js");
});

test("parseHtmlAssetLinks extracts src and href attributes from HTML content", () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <link rel="stylesheet" href="style.css" />
        <script src="script.js"></script>
      </head>
      <body>
        <img src="icon.png" alt="Icon" />
        <a href="https://example.com">External</a>
      </body>
    </html>
  `;
  const links = parseHtmlAssetLinks(html);
  assert.deepEqual(links, [
    "style.css",
    "script.js",
    "icon.png",
    "https://example.com",
  ]);
});

test("getDiskProjects discovers all category subdirectories under projects/", () => {
  const diskProjects = getDiskProjects();
  assert.ok(Array.isArray(diskProjects) && diskProjects.length > 0);
  assert.ok(
    diskProjects.some(p => p.name === "2048-game" && p.category === "games")
  );
});

test("validateStandardProjectFiles reports missing standard mini files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-mini-files-"));
  const miniPath = path.join(root, "sample-mini");

  fs.mkdirSync(miniPath, { recursive: true });
  fs.writeFileSync(path.join(miniPath, "index.html"), "<!doctype html>");
  fs.writeFileSync(path.join(miniPath, "style.css"), "");
  fs.writeFileSync(path.join(miniPath, "thumbnail.svg"), "<svg></svg>");

  const issues = validateStandardProjectFiles([
    {
      name: "sample-mini",
      relPath: "projects/test/sample-mini/",
      absPath: miniPath,
    },
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, "MISSING_STANDARD_FILE");
  assert.match(issues[0].message, /script\.js/);
});

test("validateStandardProjectFiles reports missing thumbnail.svg", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-mini-files-"));
  const miniPath = path.join(root, "sample-mini");

  fs.mkdirSync(miniPath, { recursive: true });
  fs.writeFileSync(path.join(miniPath, "index.html"), "<!doctype html>");
  fs.writeFileSync(path.join(miniPath, "script.js"), "");
  fs.writeFileSync(path.join(miniPath, "style.css"), "");

  const issues = validateStandardProjectFiles([
    {
      name: "sample-mini",
      relPath: "projects/test/sample-mini/",
      absPath: miniPath,
    },
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, "MISSING_STANDARD_FILE");
  assert.match(issues[0].message, /thumbnail\.svg/);
});

test("validateProjectIndexEntries reports mini folders missing from projects.json", () => {
  const diskProjects = [
    {
      category: "games",
      name: "indexed-game",
      relPath: "projects/games/indexed-game/",
      absPath: "/repo/projects/games/indexed-game",
    },
    {
      category: "math",
      name: "missing-tool",
      relPath: "projects/math/missing-tool/",
      absPath: "/repo/projects/math/missing-tool",
    },
  ];

  const projectsJsonData = [
    {
      title: "Indexed Game",
      category: "games",
      path: "projects/games/indexed-game/",
    },
  ];

  const issues = validateProjectIndexEntries(diskProjects, projectsJsonData);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, "UNINDEXED_PROJECT");
  assert.equal(issues[0].project, "missing-tool");
  assert.match(issues[0].message, /projects\/math\/missing-tool\//);
});

test("validateProjectIndexEntries passes when every mini folder is indexed", () => {
  const diskProjects = [
    {
      category: "productivity",
      name: "task-tool",
      relPath: "projects/productivity/task-tool/",
      absPath: "/repo/projects/productivity/task-tool",
    },
  ];

  const projectsJsonData = [
    {
      title: "Task Tool",
      category: "productivity",
      path: "projects/productivity/task-tool/",
    },
  ];

  assert.deepEqual(
    validateProjectIndexEntries(diskProjects, projectsJsonData),
    []
  );
});

test("validateProjectNavigation reports mini projects missing shared navigation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-mini-nav-"));
  const miniWithNav = path.join(root, "with-nav");
  const miniWithoutNav = path.join(root, "without-nav");

  fs.mkdirSync(miniWithNav, { recursive: true });
  fs.mkdirSync(miniWithoutNav, { recursive: true });

  fs.writeFileSync(
    path.join(miniWithNav, "index.html"),
    '<!doctype html><html><body><script src="../../../src/components/ui/BackToHome/BackToHome.js" defer></script></body></html>'
  );
  fs.writeFileSync(
    path.join(miniWithoutNav, "index.html"),
    "<!doctype html><html><body><h1>No Nav</h1></body></html>"
  );

  const diskProjects = [
    {
      name: "with-nav",
      relPath: "projects/test/with-nav/",
      absPath: miniWithNav,
    },
    {
      name: "without-nav",
      relPath: "projects/test/without-nav/",
      absPath: miniWithoutNav,
    },
  ];

  const issues = validateProjectNavigation(diskProjects);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, "MISSING_NAVIGATION");
  assert.equal(issues[0].project, "without-nav");
});

test("validateProjectFavicons reports missing or broken favicon references in mini projects", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-mini-fav-"));
  const miniMissing = path.join(root, "missing-fav");
  const miniBroken = path.join(root, "broken-fav");
  const miniEmpty = path.join(root, "empty-fav");
  const miniValid = path.join(root, "valid-fav");

  fs.mkdirSync(miniMissing, { recursive: true });
  fs.mkdirSync(miniBroken, { recursive: true });
  fs.mkdirSync(miniEmpty, { recursive: true });
  fs.mkdirSync(miniValid, { recursive: true });

  fs.writeFileSync(path.join(miniMissing, "index.html"), "<!doctype html><html><head></head></html>");
  fs.writeFileSync(
    path.join(miniBroken, "index.html"),
    '<!doctype html><html><head><link rel="icon" href="nonexistent.svg" /></head></html>'
  );
  fs.writeFileSync(
    path.join(miniEmpty, "index.html"),
    '<!doctype html><html><head><link rel="icon" href="data:," /></head></html>'
  );

  const sharedIcon = path.join(root, "favicon.svg");
  fs.writeFileSync(sharedIcon, "<svg></svg>");
  fs.writeFileSync(
    path.join(miniValid, "index.html"),
    '<!doctype html><html><head><link rel="icon" type="image/svg+xml" href="../favicon.svg" /></head></html>'
  );

  const diskProjects = [
    { name: "missing-fav", relPath: "projects/test/missing-fav/", absPath: miniMissing },
    { name: "broken-fav", relPath: "projects/test/broken-fav/", absPath: miniBroken },
    { name: "empty-fav", relPath: "projects/test/empty-fav/", absPath: miniEmpty },
    { name: "valid-fav", relPath: "projects/test/valid-fav/", absPath: miniValid },
  ];

  const issues = validateProjectFavicons(diskProjects);
  assert.equal(issues.length, 3);
  assert.equal(issues.some(i => i.type === "MISSING_FAVICON" && i.project === "missing-fav"), true);
  assert.equal(issues.some(i => i.type === "BROKEN_FAVICON" && i.project === "broken-fav"), true);
  assert.equal(issues.some(i => i.type === "INVALID_FAVICON" && i.project === "empty-fav"), true);
});

test("validateMiniProjects verifies all mini projects open without load failures or missing pages", () => {
  const issues = validateMiniProjects();
  assert.deepEqual(
    issues,
    [],
    `Expected 0 mini project load issues, but found ${issues.length}:\n` +
      issues.map(i => `  [${i.type}] ${i.message}`).join("\n")
  );
});

// ---------------------------------------------------------------------------
// Broken script, icon, and asset reference fixtures
// ---------------------------------------------------------------------------

test("parseHtmlAssetLinks extracts broken script src references from index.html", () => {
  const html = [
    "<!doctype html>",
    "<html>",
    "  <head>",
    "    <link rel=\"stylesheet\" href=\"style.css\" />",
    "  </head>",
    "  <body>",
    "    <script src=\"script.js\"></script>",
    "    <script src=\"missing-lib.js\"></script>",
    "  </body>",
    "</html>",
  ].join("\n");

  const links = parseHtmlAssetLinks(html);

  assert.ok(links.includes("style.css"), "should include stylesheet href");
  assert.ok(links.includes("script.js"), "should include primary script src");
  assert.ok(links.includes("missing-lib.js"), "should include broken script src");
});

test("parseHtmlAssetLinks extracts broken img src and link icon references", () => {
  const html = [
    "<!doctype html>",
    "<html>",
    "  <head>",
    "    <link rel=\"icon\" type=\"image/svg+xml\" href=\"nonexistent-icon.svg\" />",
    "  </head>",
    "  <body>",
    "    <img src=\"assets/ghost-image.png\" alt=\"missing\" />",
    "  </body>",
    "</html>",
  ].join("\n");

  const links = parseHtmlAssetLinks(html);

  assert.ok(links.includes("nonexistent-icon.svg"),
    "should extract broken favicon icon href");
  assert.ok(links.includes("assets/ghost-image.png"),
    "should extract broken img src");
});

test("isExternal returns false for local script and asset paths that should be disk-checked", () => {
  // These paths would come from parseHtmlAssetLinks and must reach the fs.existsSync check.
  assert.equal(isExternal("script.js"), false);
  assert.equal(isExternal("missing-lib.js"), false);
  assert.equal(isExternal("assets/icon.svg"), false);
  assert.equal(isExternal("../../../src/components/ui/Button.js"), false);
  assert.equal(isExternal("/src/components/ui/index.js"), false);

  // These must be skipped (treated as external / non-local).
  assert.equal(isExternal("https://cdn.jsdelivr.net/npm/chart.js"), true);
  assert.equal(isExternal("//unpkg.com/react"), true);
  assert.equal(isExternal("data:image/svg+xml;base64,PHN2"), true);
  assert.equal(isExternal("#section-id"), true);
});

test("validateProjectFavicons raises BROKEN_FAVICON when favicon file is referenced but absent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-broken-icon-"));
  const miniDir = path.join(root, "icon-missing");
  fs.mkdirSync(miniDir, { recursive: true });

  // index.html points to a favicon that was never created.
  fs.writeFileSync(
    path.join(miniDir, "index.html"),
    '<!doctype html><html><head><link rel="icon" href="favicon.svg" /></head></html>'
  );

  const diskProjects = [
    { name: "icon-missing", relPath: "projects/test/icon-missing/", absPath: miniDir },
  ];

  const issues = validateProjectFavicons(diskProjects);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, "BROKEN_FAVICON");
  assert.equal(issues[0].project, "icon-missing");
  assert.match(issues[0].message, /favicon\.svg/);
});

test("validateProjectFavicons raises BROKEN_FAVICON for a missing script-adjacent icon asset", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-broken-icon2-"));
  const miniDir = path.join(root, "icon-missing2");
  fs.mkdirSync(miniDir, { recursive: true });

  // The favicon resolves via a relative path that goes up to a shared assets folder,
  // but that folder / file does not exist in the temp fixture.
  fs.writeFileSync(
    path.join(miniDir, "index.html"),
    '<!doctype html><html><head><link rel="icon" type="image/svg+xml" href="../../../assets/favicon.svg" /></head></html>'
  );

  const diskProjects = [
    { name: "icon-missing2", relPath: "projects/test/icon-missing2/", absPath: miniDir },
  ];

  const issues = validateProjectFavicons(diskProjects);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, "BROKEN_FAVICON");
  assert.match(issues[0].message, /favicon\.svg/);
});

test("broken local asset reference is detected by the isExternal + sanitizePath + fs.existsSync chain", () => {
  // Validates the logical pipeline used inside validateMiniProjects for BROKEN_ASSET detection.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-asset-chain-"));
  const miniDir = path.join(root, "asset-check");
  fs.mkdirSync(miniDir, { recursive: true });

  const html = [
    "<!doctype html><html><head>",
    '  <link rel="stylesheet" href="style.css" />',        // exists
    '  <script src="script.js"></script>',                 // exists
    '  <script src="helpers/missing-helper.js"></script>', // missing
    "</head><body></body></html>",
  ].join("\n");

  fs.writeFileSync(path.join(miniDir, "index.html"), html);
  fs.writeFileSync(path.join(miniDir, "style.css"), "body {}");
  fs.writeFileSync(path.join(miniDir, "script.js"), "");
  // helpers/missing-helper.js is deliberately absent.

  const links = parseHtmlAssetLinks(html);
  const brokenAssets = links.filter(rawLink => {
    if (isExternal(rawLink)) return false;
    const cleanLink = sanitizePath(rawLink);
    if (!cleanLink) return false;
    const resolvedPath = path.resolve(miniDir, cleanLink);
    return !fs.existsSync(resolvedPath);
  });

  assert.deepEqual(brokenAssets, ["helpers/missing-helper.js"]);
});



