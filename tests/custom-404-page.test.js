const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const ERROR_PAGE_PATH = path.join(ROOT_DIR, "404.html");

test("404.html exists at the site root", () => {
  assert.ok(
    fs.existsSync(ERROR_PAGE_PATH),
    "404.html must exist at the site root"
  );
});

test("404.html contains a descriptive title and main landmark (Acceptance Criteria)", () => {
  const html = fs.readFileSync(ERROR_PAGE_PATH, "utf8");

  // Title check
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  assert.ok(titleMatch, "404.html must contain a <title> tag");
  const titleText = titleMatch[1].trim();
  assert.match(
    titleText,
    /404.*page not found.*cradle/i,
    `<title> "${titleText}" must be descriptive and mention 404 and Cradle`
  );

  // Main landmark check
  assert.match(
    html,
    /<main\b[^>]*>/i,
    "404.html must have a <main> landmark element"
  );
  assert.match(html, /<\/main>/i, "404.html must have a closing </main> tag");
});

test("404.html displays a 404 heading and helpful explanation message", () => {
  const html = fs.readFileSync(ERROR_PAGE_PATH, "utf8");

  // Heading check
  assert.match(
    html,
    /<h1\b[^>]*>[\s\S]*?404[\s\S]*?<\/h1>/i,
    "Must have an h1 element featuring 404"
  );
  assert.match(html, /Page Not Found/i, "Must contain Page Not Found text");

  // Short explanation message
  assert.match(
    html,
    /does not exist|doesn't exist|has been moved|not found/i,
    "Must explain that the page does not exist or has moved"
  );
});

test("404.html includes a 'Back to Home' navigation button targeting index.html", () => {
  const html = fs.readFileSync(ERROR_PAGE_PATH, "utf8");

  // Inline action button
  const homeLinkMatch = html.match(
    /<a\b[^>]*href=["']([^"']*)["'][^>]*>[\s\S]*?Back to Home[\s\S]*?<\/a>/i
  );
  assert.ok(homeLinkMatch, "Must contain a link with text 'Back to Home'");
  assert.match(
    homeLinkMatch[1],
    /^(index\.html|\/)$/,
    "Back to Home link must target index.html or root"
  );

  // Shared BackToHome component attribute
  assert.match(
    html,
    /data-cradle-back-to-home/i,
    "Must include shared data-cradle-back-to-home component element"
  );
});

test("404.html integrates shared Cradle UI, tokens, and components", () => {
  const html = fs.readFileSync(ERROR_PAGE_PATH, "utf8");

  // Tokens & Styles
  assert.match(
    html,
    /src\/components\/ui\/tokens\.css/i,
    "Must link to tokens.css"
  );
  assert.match(html, /style\.css/i, "Must link to style.css");

  // Scripts
  assert.match(
    html,
    /src\/components\/ui\/storage\.js/i,
    "Must load storage.js"
  );
  assert.match(
    html,
    /src\/components\/ui\/ThemeToggle\/ThemeToggle\.js/i,
    "Must load ThemeToggle.js"
  );
  assert.match(
    html,
    /src\/components\/ui\/Button\/Button\.js/i,
    "Must load Button.js"
  );
  assert.match(
    html,
    /src\/components\/ui\/BackToHome\/BackToHome\.js/i,
    "Must load BackToHome.js"
  );

  // Theme toggle element
  assert.match(
    html,
    /data-cradle-theme-toggle/i,
    "Must include theme toggle element"
  );

  // Anti-flash theme bootstrap
  assert.match(
    html,
    /CradleStorage/i,
    "Theme bootstrap should check CradleStorage"
  );
  assert.match(
    html,
    /light-theme/i,
    "Theme bootstrap should support light-theme"
  );
});

test("All local script, style, and icon resources linked in 404.html exist on disk", () => {
  const html = fs.readFileSync(ERROR_PAGE_PATH, "utf8");

  const hrefRegex = /<(?:link|a)\b[^>]*href=["']([^"':#]+)["']/gi;
  const srcRegex = /<script\b[^>]*src=["']([^"':]+)["']/gi;

  const localPaths = [];
  let m;
  while ((m = hrefRegex.exec(html)) !== null) {
    if (!m[1].startsWith("http") && !m[1].startsWith("//")) {
      localPaths.push(m[1]);
    }
  }
  while ((m = srcRegex.exec(html)) !== null) {
    if (!m[1].startsWith("http") && !m[1].startsWith("//")) {
      localPaths.push(m[1]);
    }
  }

  for (const rel of localPaths) {
    const abs = path.join(ROOT_DIR, rel);
    assert.ok(
      fs.existsSync(abs),
      `Resource linked in 404.html must exist on disk: ${rel}`
    );
  }
});
