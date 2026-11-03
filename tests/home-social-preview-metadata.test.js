const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const INDEX_PATH = path.join(ROOT_DIR, "index.html");

function extractMetaTags(html) {
  const metaRegex = /<meta\s+([^>]+?)\/?>/gi;
  const metas = [];
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const rawAttrs = match[1];
    const attrs = {};
    const attrRegex = /([a-z0-9_:-]+)=["']([^"']*)["']/gi;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      attrs[attrMatch[1].toLowerCase()] = attrMatch[2];
    }
    metas.push(attrs);
  }
  return metas;
}

function extractCanonical(html) {
  const match = html.match(
    /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*\/?>|<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["'][^>]*\/?>/i
  );
  return match ? match[1] || match[2] : null;
}

test("Home page HTML exists and contains required standard head elements", () => {
  assert.ok(fs.existsSync(INDEX_PATH), "index.html must exist at repo root");
  const html = fs.readFileSync(INDEX_PATH, "utf8");
  assert.match(html, /<!doctype html>/i, "index.html must have HTML5 doctype");
  assert.match(
    html,
    /<title>Cradle<\/title>/i,
    "index.html title must be Cradle"
  );
  assert.match(
    html,
    /<meta\s+name=["']description["']/i,
    "index.html must have meta description"
  );
});

test("Home page canonical URL is configured to production domain", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf8");
  const canonical = extractCanonical(html);
  assert.equal(
    canonical,
    "https://cradle-zeta.vercel.app/",
    "Canonical URL must match production domain"
  );
});

test("Home page contains complete Open Graph metadata tags for rich link previews", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf8");
  const metas = extractMetaTags(html);

  const getOg = property =>
    metas
      .filter(
        m => m.property && m.property.toLowerCase() === property.toLowerCase()
      )
      .map(m => m.content);

  // og:type and og:site_name
  assert.deepEqual(getOg("og:type"), ["website"], "og:type must be website");
  assert.deepEqual(
    getOg("og:site_name"),
    ["Cradle"],
    "og:site_name must be Cradle"
  );

  // og:url
  const ogUrls = getOg("og:url");
  assert.equal(ogUrls.length, 1, "There must be exactly one og:url");
  assert.equal(
    ogUrls[0],
    "https://cradle-zeta.vercel.app/",
    "og:url must point to production domain"
  );
  assert.ok(
    !ogUrls[0].includes("example.com"),
    "og:url must not use dummy example.com domain"
  );

  // og:title
  const ogTitles = getOg("og:title");
  assert.equal(ogTitles.length, 1, "There must be exactly one og:title");
  assert.match(ogTitles[0], /^Cradle/i, "og:title must start with Cradle");
  assert.ok(ogTitles[0].length >= 10, "og:title must be descriptive");

  // og:description
  const ogDescs = getOg("og:description");
  assert.equal(ogDescs.length, 1, "There must be exactly one og:description");
  assert.ok(
    ogDescs[0].length >= 20,
    "og:description must provide descriptive content"
  );

  // og:image tags
  const ogImages = getOg("og:image");
  assert.ok(ogImages.length >= 1, "Must have at least one og:image");
  assert.ok(
    ogImages[0].endsWith(".png") || ogImages[0].endsWith(".jpg"),
    "Primary og:image must be PNG or JPEG for universal debugger and crawler compatibility"
  );
  assert.ok(
    ogImages.every(img => img.startsWith("https://cradle-zeta.vercel.app/")),
    "All og:images must use production absolute HTTPS URLs"
  );
  assert.ok(
    ogImages.every(img => !img.includes("example.com")),
    "og:image must not contain placeholder example.com"
  );

  // og:image:width and og:image:height
  const ogWidths = getOg("og:image:width");
  const ogHeights = getOg("og:image:height");
  assert.ok(ogWidths.includes("1200"), "og:image:width must be 1200");
  assert.ok(ogHeights.includes("630"), "og:image:height must be 630");

  // og:image:alt
  const ogAlts = getOg("og:image:alt");
  assert.ok(
    ogAlts.length >= 1,
    "og:image:alt must be provided for accessibility"
  );
  assert.ok(ogAlts[0].trim().length > 0, "og:image:alt must not be empty");
});

test("Home page contains Twitter Card tags for rich summary preview", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf8");
  const metas = extractMetaTags(html);

  const getTwitter = name =>
    metas
      .filter(m => m.name && m.name.toLowerCase() === name.toLowerCase())
      .map(m => m.content);

  // twitter:card
  assert.deepEqual(
    getTwitter("twitter:card"),
    ["summary_large_image"],
    "twitter:card must be summary_large_image"
  );

  // twitter:url
  assert.deepEqual(
    getTwitter("twitter:url"),
    ["https://cradle-zeta.vercel.app/"],
    "twitter:url must match production domain"
  );

  // twitter:title and description
  const twTitle = getTwitter("twitter:title");
  assert.equal(twTitle.length, 1);
  assert.match(twTitle[0], /^Cradle/i);

  const twDesc = getTwitter("twitter:description");
  assert.equal(twDesc.length, 1);
  assert.ok(twDesc[0].length >= 20);

  // twitter:image
  const twImage = getTwitter("twitter:image");
  assert.equal(twImage.length, 1);
  assert.equal(
    twImage[0],
    "https://cradle-zeta.vercel.app/assets/social-preview.png",
    "twitter:image must point to the social-preview asset on production domain"
  );
  assert.ok(
    !twImage[0].includes("example.com"),
    "twitter:image must not use placeholder domain"
  );

  // twitter:image:alt
  const twAlt = getTwitter("twitter:image:alt");
  assert.equal(twAlt.length, 1);
  assert.ok(
    twAlt[0].length > 0,
    "twitter:image:alt must be present and non-empty"
  );
});

test("Physical social preview image assets exist on disk with valid 1200x630 dimensions", () => {
  const pngPath = path.join(ROOT_DIR, "assets", "social-preview.png");
  const jpgPath = path.join(ROOT_DIR, "assets", "social-preview.jpg");
  const webpPath = path.join(ROOT_DIR, "assets", "social-preview.webp");

  assert.ok(fs.existsSync(pngPath), "assets/social-preview.png must exist");
  assert.ok(fs.existsSync(jpgPath), "assets/social-preview.jpg must exist");
  assert.ok(fs.existsSync(webpPath), "assets/social-preview.webp must exist");

  const pngStats = fs.statSync(pngPath);
  assert.ok(
    pngStats.size > 1000,
    "PNG preview image must be substantial in size"
  );

  const pngBuf = fs.readFileSync(pngPath);
  const pngWidth = pngBuf.readUInt32BE(16);
  const pngHeight = pngBuf.readUInt32BE(20);
  assert.equal(pngWidth, 1200, "PNG image width must match meta tag (1200)");
  assert.equal(pngHeight, 630, "PNG image height must match meta tag (630)");

  // Inspect JPEG dimensions
  const jpgBuf = fs.readFileSync(jpgPath);
  let jpgWidth = 0;
  let jpgHeight = 0;
  for (let i = 0; i < jpgBuf.length - 8; i++) {
    if (
      jpgBuf[i] === 0xff &&
      (jpgBuf[i + 1] === 0xc0 || jpgBuf[i + 1] === 0xc2)
    ) {
      jpgHeight = jpgBuf.readUInt16BE(i + 5);
      jpgWidth = jpgBuf.readUInt16BE(i + 7);
      break;
    }
  }
  assert.equal(jpgWidth, 1200, "JPEG image width must match meta tag (1200)");
  assert.equal(jpgHeight, 630, "JPEG image height must match meta tag (630)");
});

test("Link-preview debugger scraper simulation parses valid card metadata", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf8");
  const metas = extractMetaTags(html);
  const canonical = extractCanonical(html);

  // Simulate scraper parsing dictionary
  const previewData = {
    canonicalUrl: canonical,
    openGraph: {},
    twitterCard: {},
  };

  for (const meta of metas) {
    if (meta.property && meta.property.startsWith("og:")) {
      const key = meta.property.substring(3);
      if (!previewData.openGraph[key]) {
        previewData.openGraph[key] = meta.content;
      }
    }
    if (meta.name && meta.name.startsWith("twitter:")) {
      const key = meta.name.substring(8);
      previewData.twitterCard[key] = meta.content;
    }
  }

  // Open Graph preview debugger assertions
  assert.ok(previewData.openGraph.title, "Debugger must find og:title");
  assert.ok(
    previewData.openGraph.description,
    "Debugger must find og:description"
  );
  assert.ok(previewData.openGraph.url, "Debugger must find og:url");
  assert.ok(previewData.openGraph.image, "Debugger must find og:image");
  assert.equal(
    previewData.openGraph.url,
    previewData.canonicalUrl,
    "og:url must align with canonical URL"
  );

  // Twitter Card validator debugger assertions
  assert.equal(previewData.twitterCard.card, "summary_large_image");
  assert.ok(
    previewData.twitterCard.title,
    "Twitter validator must find twitter:title"
  );
  assert.ok(
    previewData.twitterCard.description,
    "Twitter validator must find twitter:description"
  );
  assert.ok(
    previewData.twitterCard.image,
    "Twitter validator must find twitter:image"
  );

  // Verify that all URLs are absolute and fetchable (valid URL constructor)
  assert.doesNotThrow(() => new URL(previewData.openGraph.url));
  assert.doesNotThrow(() => new URL(previewData.openGraph.image));
  assert.doesNotThrow(() => new URL(previewData.twitterCard.image));
});
