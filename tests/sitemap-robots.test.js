const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const {
  DEFAULT_BASE_URL,
  REPO_ROOT,
  PROJECTS_DIR,
  buildSitemapXml,
  generateSitemap,
  validateSitemapSync,
} = require("../scripts/generate-sitemap");
const { discoverProjects } = require("../scripts/project-discovery");

const ROBOTS_PATH = path.join(REPO_ROOT, "robots.txt");
const SITEMAP_PATH = path.join(REPO_ROOT, "sitemap.xml");

test("robots.txt exists at root and allows crawling with sitemap directive", () => {
  assert.ok(
    fs.existsSync(ROBOTS_PATH),
    "robots.txt must exist at repository root"
  );

  const content = fs.readFileSync(ROBOTS_PATH, "utf8");
  assert.match(
    content,
    /User-agent:\s*\*/i,
    "robots.txt must specify User-agent: *"
  );
  assert.match(content, /Allow:\s*\//i, "robots.txt must allow root crawling");
  assert.match(
    content,
    /Sitemap:\s*https:\/\/cradle-zeta\.vercel\.app\/sitemap\.xml/i,
    "robots.txt must link to sitemap.xml on production domain"
  );
});

test("sitemap.xml exists at root and adheres to standard XML sitemap protocol", () => {
  assert.ok(
    fs.existsSync(SITEMAP_PATH),
    "sitemap.xml must exist at repository root"
  );

  const xml = fs.readFileSync(SITEMAP_PATH, "utf8");
  assert.match(
    xml,
    /^<\?xml\s+version=["']1\.0["']\s+encoding=["']UTF-8["']\?>/i
  );
  assert.match(
    xml,
    /<urlset\s+xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']>/i
  );
  assert.match(xml, /<\/urlset>\s*$/i);
});

test("sitemap.xml includes home page and every discovered mini project", () => {
  const xml = fs.readFileSync(SITEMAP_PATH, "utf8");
  const minis = discoverProjects(PROJECTS_DIR, REPO_ROOT);

  // Home page check
  assert.match(
    xml,
    /<loc>https:\/\/cradle-zeta\.vercel\.app\/<\/loc>/,
    "sitemap must include the home page URL"
  );

  // Every mini project check
  for (const mini of minis) {
    const expectedLoc = `<loc>https://cradle-zeta.vercel.app/${mini.relPath}</loc>`;
    assert.ok(
      xml.includes(expectedLoc),
      `sitemap.xml must include mini: ${expectedLoc}`
    );
  }

  // Count check
  const locMatches = xml.match(/<loc>[^<]+<\/loc>/g) || [];
  assert.equal(
    locMatches.length,
    minis.length + 1,
    `sitemap.xml must have exactly ${minis.length + 1} URLs (1 home + ${minis.length} minis)`
  );
});

test("sitemap.xml contains only valid absolute HTTPS URLs without placeholders", () => {
  const xml = fs.readFileSync(SITEMAP_PATH, "utf8");
  const locMatches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];

  for (const match of locMatches) {
    const url = match.replace(/<\/?loc>/g, "");
    assert.ok(
      url.startsWith("https://cradle-zeta.vercel.app/"),
      `URL ${url} must start with production base URL`
    );
    assert.ok(
      !url.includes("example.com"),
      `URL ${url} must not use example.com`
    );
    assert.ok(!url.includes("localhost"), `URL ${url} must not use localhost`);
    assert.doesNotThrow(
      () => new URL(url),
      `URL ${url} must be syntactically valid`
    );
  }
});

test("generateSitemap writes valid sitemap into a target directory", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-sitemap-test-"));
  const tmpSitemapFile = path.join(tmpDir, "sitemap.xml");

  const sampleProjects = [
    { title: "Game One", relPath: "projects/games/game-one/" },
    { title: "Tool Two", relPath: "projects/dev-tools/tool-two/" },
  ];

  const result = generateSitemap({
    projects: sampleProjects,
    sitemapFile: tmpSitemapFile,
    baseUrl: "https://cradle-zeta.vercel.app",
    repoRoot: tmpDir,
  });

  assert.equal(result.count, 3);
  assert.ok(fs.existsSync(tmpSitemapFile));

  const content = fs.readFileSync(tmpSitemapFile, "utf8");
  assert.ok(content.includes("<loc>https://cradle-zeta.vercel.app/</loc>"));
  assert.ok(
    content.includes(
      "<loc>https://cradle-zeta.vercel.app/projects/games/game-one/</loc>"
    )
  );
  assert.ok(
    content.includes(
      "<loc>https://cradle-zeta.vercel.app/projects/dev-tools/tool-two/</loc>"
    )
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("validateSitemapSync detects out-of-sync or missing sitemap", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-sync-test-"));
  const tmpSitemapFile = path.join(tmpDir, "sitemap.xml");

  // Missing file
  const missingCheck = validateSitemapSync({
    sitemapFile: tmpSitemapFile,
    projects: [],
  });
  assert.equal(missingCheck.inSync, false);
  assert.match(missingCheck.issues[0], /does not exist/i);

  // Stale content
  fs.writeFileSync(tmpSitemapFile, "stale content");
  const staleCheck = validateSitemapSync({
    sitemapFile: tmpSitemapFile,
    projects: [{ title: "Mini", relPath: "projects/games/mini/" }],
  });
  assert.equal(staleCheck.inSync, false);
  assert.match(staleCheck.issues[0], /out of sync/i);

  // Valid content in sync
  generateSitemap({
    sitemapFile: tmpSitemapFile,
    projects: [{ title: "Mini", relPath: "projects/games/mini/" }],
    repoRoot: tmpDir,
  });

  const syncedCheck = validateSitemapSync({
    sitemapFile: tmpSitemapFile,
    projects: [{ title: "Mini", relPath: "projects/games/mini/" }],
  });
  assert.equal(syncedCheck.inSync, true);
  assert.equal(syncedCheck.issues.length, 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("dynamic discovery: new mini folder is automatically included in generated sitemap", () => {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-discovery-test-")
  );
  const projectsDir = path.join(tmpDir, "projects");
  const gamesDir = path.join(projectsDir, "games");
  const newGameDir = path.join(gamesDir, "new-awesome-game");

  fs.mkdirSync(newGameDir, { recursive: true });
  fs.writeFileSync(
    path.join(newGameDir, "index.html"),
    "<!doctype html><html></html>"
  );

  const xml = buildSitemapXml(null, DEFAULT_BASE_URL, projectsDir, tmpDir);
  assert.ok(
    xml.includes(
      "<loc>https://cradle-zeta.vercel.app/projects/games/new-awesome-game/</loc>"
    ),
    "Newly added mini folder must be automatically picked up by buildSitemapXml"
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
