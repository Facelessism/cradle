const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  REPO_ROOT,
  SITEMAP_FILE,
  SITE_BASE_URL,
  buildSitemapXml,
  generateSitemap,
  validateSitemapSync,
  generateProjects,
} = require("../scripts/generate-projects");

test("robots.txt exists, allows crawling, and points to the sitemap", () => {
  const robotsPath = path.join(REPO_ROOT, "robots.txt");
  assert.ok(
    fs.existsSync(robotsPath),
    "robots.txt must exist at repository root"
  );

  const content = fs.readFileSync(robotsPath, "utf8");
  assert.match(
    content,
    /User-agent:\s*\*/i,
    "robots.txt must specify User-agent: *"
  );
  assert.match(content, /Allow:\s*\//i, "robots.txt must specify Allow: /");
  assert.match(
    content,
    /Sitemap:\s*https:\/\/cradle-zeta\.vercel\.app\/sitemap\.xml/i,
    "robots.txt must point to https://cradle-zeta.vercel.app/sitemap.xml"
  );
});

test("sitemap.xml exists and conforms to Sitemap Protocol 0.9", () => {
  assert.ok(
    fs.existsSync(SITEMAP_FILE),
    "sitemap.xml must exist at repository root"
  );

  const content = fs.readFileSync(SITEMAP_FILE, "utf8");
  assert.match(
    content,
    /^<\?xml\s+version=["']1\.0["']\s+encoding=["']UTF-8["']\?>/i,
    "sitemap.xml must start with XML declaration"
  );
  assert.match(
    content,
    /<urlset\s+xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']>/,
    "sitemap.xml must declare the standard sitemap namespace"
  );
  assert.match(
    content,
    /<\/urlset>\s*$/,
    "sitemap.xml must terminate with </urlset>"
  );
});

test("sitemap.xml lists the landing page and every mini project", () => {
  const content = fs.readFileSync(SITEMAP_FILE, "utf8");
  const locMatches = [...content.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);

  // Landing page URL must be present
  assert.ok(
    locMatches.includes("https://cradle-zeta.vercel.app/"),
    "Landing page https://cradle-zeta.vercel.app/ must be in sitemap.xml"
  );

  // Load all projects from data/projects.json
  const projects = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "data", "projects.json"), "utf8")
  );

  assert.ok(projects.length > 0, "Expected projects in data/projects.json");

  // Every project must be present
  for (const project of projects) {
    const expectedUrl = `https://cradle-zeta.vercel.app/${project.path}`;
    assert.ok(
      locMatches.includes(expectedUrl),
      `Project URL "${expectedUrl}" is missing from sitemap.xml`
    );
  }

  // Exact count check (landing page + all projects)
  assert.equal(
    locMatches.length,
    projects.length + 1,
    `sitemap.xml must contain exactly ${projects.length + 1} URLs`
  );

  // No duplicate URLs
  const uniqueUrls = new Set(locMatches);
  assert.equal(
    uniqueUrls.size,
    locMatches.length,
    "sitemap.xml must not contain duplicate URLs"
  );
});

test("buildSitemapXml generates valid XML with custom base URL", () => {
  const sampleProjects = [
    { title: "Alpha", path: "projects/games/alpha/" },
    { title: "Beta", path: "projects/productivity/beta/" },
  ];

  const xml = buildSitemapXml(sampleProjects, "https://example.com");
  assert.match(xml, /<loc>https:\/\/example\.com\/<\/loc>/);
  assert.match(
    xml,
    /<loc>https:\/\/example\.com\/projects\/games\/alpha\/<\/loc>/
  );
  assert.match(
    xml,
    /<loc>https:\/\/example\.com\/projects\/productivity\/beta\/<\/loc>/
  );
});

test("generateProjects adds new mini projects to sitemap.xml", () => {
  const tmpRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-sitemap-test-")
  );
  try {
    const projectsDir = path.join(tmpRoot, "projects");
    const dataDir = path.join(tmpRoot, "data");
    const outputFile = path.join(dataDir, "projects.json");
    const sitemapFile = path.join(tmpRoot, "sitemap.xml");

    fs.mkdirSync(dataDir, { recursive: true });

    // Step 1: Create initial project
    const proj1Dir = path.join(projectsDir, "games", "first-game");
    fs.mkdirSync(proj1Dir, { recursive: true });
    fs.writeFileSync(path.join(proj1Dir, "index.html"), "<!doctype html>");

    generateProjects({
      projectsDir,
      repoRoot: tmpRoot,
      outputFile,
      sitemapFile,
      baseUrl: "https://cradle-zeta.vercel.app",
    });

    let sitemapContent = fs.readFileSync(sitemapFile, "utf8");
    assert.match(sitemapContent, /projects\/games\/first-game\//);
    assert.doesNotMatch(
      sitemapContent,
      /projects\/productivity\/second-tool\//
    );

    // Step 2: Add a new mini project
    const proj2Dir = path.join(projectsDir, "productivity", "second-tool");
    fs.mkdirSync(proj2Dir, { recursive: true });
    fs.writeFileSync(path.join(proj2Dir, "index.html"), "<!doctype html>");

    // Run generate again
    generateProjects({
      projectsDir,
      repoRoot: tmpRoot,
      outputFile,
      sitemapFile,
      baseUrl: "https://cradle-zeta.vercel.app",
    });

    // Step 3: Verify the new mini appears in sitemap.xml
    sitemapContent = fs.readFileSync(sitemapFile, "utf8");
    assert.match(
      sitemapContent,
      /projects\/games\/first-game\//,
      "First project must remain in sitemap"
    );
    assert.match(
      sitemapContent,
      /projects\/productivity\/second-tool\//,
      "New mini project must appear in sitemap after generate script runs"
    );

    // Verify validateSitemapSync passes
    const syncResult = validateSitemapSync({
      repoRoot: tmpRoot,
      sitemapFile,
      baseUrl: "https://cradle-zeta.vercel.app",
    });
    assert.equal(syncResult.inSync, true);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("validateSitemapSync detects missing and outdated sitemap files", () => {
  const tmpRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-sitemap-sync-")
  );
  try {
    const sitemapFile = path.join(tmpRoot, "sitemap.xml");
    const sampleProjects = [{ title: "Alpha", path: "projects/games/alpha/" }];

    // Missing sitemap
    const missingRes = validateSitemapSync({
      projects: sampleProjects,
      repoRoot: tmpRoot,
      sitemapFile,
    });
    assert.equal(missingRes.inSync, false);
    assert.ok(missingRes.issues.some(i => i.includes("does not exist")));

    // Write outdated sitemap
    fs.writeFileSync(sitemapFile, "<urlset></urlset>");
    const outdatedRes = validateSitemapSync({
      projects: sampleProjects,
      repoRoot: tmpRoot,
      sitemapFile,
    });
    assert.equal(outdatedRes.inSync, false);
    assert.ok(outdatedRes.issues.some(i => i.includes("out of sync")));

    // Write synchronized sitemap
    generateSitemap({
      projects: sampleProjects,
      repoRoot: tmpRoot,
      sitemapFile,
    });
    const validRes = validateSitemapSync({
      projects: sampleProjects,
      repoRoot: tmpRoot,
      sitemapFile,
    });
    assert.equal(validRes.inSync, true);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test("Landing page index.html SEO, canonical, and social preview metadata", () => {
  const indexPath = path.join(REPO_ROOT, "index.html");
  assert.ok(fs.existsSync(indexPath), "root index.html must exist");

  const html = fs.readFileSync(indexPath, "utf8");

  // Title tag
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  assert.ok(titleMatch, "Missing <title> tag in index.html");
  assert.ok(titleMatch[1].includes("Cradle"), "Title must mention Cradle");

  // Meta description
  const metaDescMatch = html.match(
    /<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  assert.ok(metaDescMatch, "Missing <meta name='description'> in index.html");
  assert.ok(
    metaDescMatch[1].trim().length > 10,
    "Meta description must be descriptive"
  );

  // Canonical link
  const canonicalMatch = html.match(
    /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i
  );
  assert.ok(canonicalMatch, "Missing <link rel='canonical'> in index.html");
  assert.equal(
    canonicalMatch[1],
    "https://cradle-zeta.vercel.app/",
    "Canonical URL must be https://cradle-zeta.vercel.app/"
  );

  // Open Graph URL
  const ogUrlMatch = html.match(
    /<meta\s+[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  assert.ok(ogUrlMatch, "Missing og:url meta tag");
  assert.equal(
    ogUrlMatch[1],
    "https://cradle-zeta.vercel.app/",
    "og:url must be https://cradle-zeta.vercel.app/"
  );

  // Open Graph Title
  const ogTitleMatch = html.match(
    /<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  assert.ok(ogTitleMatch, "Missing og:title meta tag");
  assert.ok(ogTitleMatch[1].trim().length > 0, "og:title must not be empty");

  // Open Graph Description
  const ogDescMatch = html.match(
    /<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  assert.ok(ogDescMatch, "Missing og:description meta tag");
  assert.ok(
    ogDescMatch[1].trim().length > 0,
    "og:description must not be empty"
  );

  // Open Graph Image
  const ogImageMatches = [
    ...html.matchAll(
      /<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/gi
    ),
  ].map(m => m[1]);

  assert.ok(
    ogImageMatches.length > 0,
    "index.html must have at least one og:image"
  );

  for (const imgUrl of ogImageMatches) {
    assert.match(
      imgUrl,
      /^https:\/\/cradle-zeta\.vercel\.app\//,
      `og:image "${imgUrl}" must use absolute URL on cradle-zeta.vercel.app`
    );

    // Verify image file actually exists in repo
    const relAssetPath = imgUrl.replace("https://cradle-zeta.vercel.app/", "");
    const absAssetPath = path.join(REPO_ROOT, relAssetPath);
    assert.ok(
      fs.existsSync(absAssetPath),
      `og:image target asset does not exist on disk: ${absAssetPath}`
    );
  }

  // Twitter Card
  const twitterCardMatch = html.match(
    /<meta\s+[^>]*name=["']twitter:card["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  assert.ok(twitterCardMatch, "Missing twitter:card meta tag");
  assert.equal(twitterCardMatch[1], "summary_large_image");

  const twitterUrlMatch = html.match(
    /<meta\s+[^>]*name=["']twitter:url["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  assert.ok(twitterUrlMatch, "Missing twitter:url meta tag");
  assert.equal(twitterUrlMatch[1], "https://cradle-zeta.vercel.app/");

  const twitterTitleMatch = html.match(
    /<meta\s+[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  assert.ok(twitterTitleMatch, "Missing twitter:title meta tag");

  const twitterDescMatch = html.match(
    /<meta\s+[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  assert.ok(twitterDescMatch, "Missing twitter:description meta tag");

  const twitterImageMatch = html.match(
    /<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  assert.ok(twitterImageMatch, "Missing twitter:image meta tag");
  assert.match(
    twitterImageMatch[1],
    /^https:\/\/cradle-zeta\.vercel\.app\//,
    "twitter:image must be an absolute URL on cradle-zeta.vercel.app"
  );

  const twitterRelAsset = twitterImageMatch[1].replace(
    "https://cradle-zeta.vercel.app/",
    ""
  );
  assert.ok(
    fs.existsSync(path.join(REPO_ROOT, twitterRelAsset)),
    `twitter:image target asset does not exist: ${twitterRelAsset}`
  );

  // No stale cradle.example.com URLs remaining
  assert.doesNotMatch(
    html,
    /cradle\.example\.com/,
    "index.html must not contain placeholder cradle.example.com URLs"
  );
});
