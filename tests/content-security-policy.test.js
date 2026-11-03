const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const INDEX_PATH = path.join(REPO_ROOT, "index.html");
const MINI_CONTRACT_PATH = path.join(REPO_ROOT, "docs", "MINI_CONTRACT.md");
const THIRD_PARTY_POLICY_PATH = path.join(REPO_ROOT, "THIRD_PARTY_POLICY.md");

function extractCspMeta(html) {
  const match =
    html.match(
      /<meta\b[^>]*\bhttp-equiv=["']Content-Security-Policy["'][^>]*\bcontent="([^"]+)"[^>]*>/i
    ) ||
    html.match(
      /<meta\b[^>]*\bhttp-equiv=["']Content-Security-Policy["'][^>]*\bcontent='([^']+)'[^>]*>/i
    ) ||
    html.match(
      /<meta\b[^>]*\bcontent="([^"]+)"[^>]*\bhttp-equiv=["']Content-Security-Policy["'][^>]*>/i
    ) ||
    html.match(
      /<meta\b[^>]*\bcontent='([^']+)'[^>]*\bhttp-equiv=["']Content-Security-Policy["'][^>]*>/i
    );
  return match ? match[1] : null;
}

function parseCspContent(contentStr) {
  const directives = {};
  contentStr
    .split(";")
    .map(d => d.trim())
    .filter(Boolean)
    .forEach(directive => {
      const parts = directive.split(/\s+/);
      const name = parts[0].toLowerCase();
      const sources = parts.slice(1);
      directives[name] = sources;
    });
  return directives;
}

test("index.html defines a Content-Security-Policy meta tag early in head", () => {
  assert.ok(fs.existsSync(INDEX_PATH), "index.html must exist");
  const html = fs.readFileSync(INDEX_PATH, "utf8");

  const cspContent = extractCspMeta(html);
  assert.ok(
    cspContent,
    "index.html must contain a Content-Security-Policy meta tag"
  );

  // Verify it is placed in <head> before stylesheets and scripts
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
  assert.ok(headMatch, "index.html must have a <head> section");

  const headContent = headMatch[1];
  const cspIndex = headContent.search(
    /http-equiv=["']Content-Security-Policy["']/i
  );
  const styleIndex = headContent.search(/<link\s+[^>]*rel=["']stylesheet["']/i);
  const scriptIndex = headContent.search(/<script\b/i);

  assert.ok(cspIndex !== -1, "CSP meta tag must be within <head>");
  if (styleIndex !== -1) {
    assert.ok(
      cspIndex < styleIndex,
      "CSP meta tag should precede stylesheet links"
    );
  }
  if (scriptIndex !== -1) {
    assert.ok(
      cspIndex < scriptIndex,
      "CSP meta tag should precede script execution"
    );
  }
});

test("Home page CSP defines least-privilege directives matching all site sources", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf8");
  const cspContent = extractCspMeta(html);
  assert.ok(cspContent, "CSP content must be found");

  const csp = parseCspContent(cspContent);

  // default-src
  assert.ok(csp["default-src"], "default-src directive must be defined");
  assert.ok(
    csp["default-src"].includes("'self'"),
    "default-src must include 'self'"
  );

  // script-src
  assert.ok(csp["script-src"], "script-src directive must be defined");
  assert.ok(
    csp["script-src"].includes("'self'"),
    "script-src must include 'self'"
  );
  assert.ok(
    csp["script-src"].includes("'unsafe-inline'"),
    "script-src must permit inline theme script"
  );
  assert.ok(
    !csp["script-src"].includes("*"),
    "script-src must not allow wildcards"
  );

  // style-src
  assert.ok(csp["style-src"], "style-src directive must be defined");
  assert.ok(
    csp["style-src"].includes("'self'"),
    "style-src must include 'self'"
  );
  assert.ok(
    csp["style-src"].includes("'unsafe-inline'"),
    "style-src must permit inline styles for components"
  );
  assert.ok(
    csp["style-src"].includes("https://fonts.googleapis.com"),
    "style-src must permit Google Fonts stylesheets"
  );

  // font-src
  assert.ok(csp["font-src"], "font-src directive must be defined");
  assert.ok(csp["font-src"].includes("'self'"), "font-src must include 'self'");
  assert.ok(
    csp["font-src"].includes("https://fonts.gstatic.com"),
    "font-src must permit Google Fonts font binaries"
  );
  assert.ok(
    csp["font-src"].includes("data:"),
    "font-src must allow data: fonts"
  );

  // img-src
  assert.ok(csp["img-src"], "img-src directive must be defined");
  assert.ok(csp["img-src"].includes("'self'"), "img-src must include 'self'");
  assert.ok(csp["img-src"].includes("data:"), "img-src must include data:");
  assert.ok(
    csp["img-src"].includes("https:"),
    "img-src must include https: for previews"
  );

  // connect-src
  assert.ok(csp["connect-src"], "connect-src directive must be defined");
  assert.ok(
    csp["connect-src"].includes("'self'"),
    "connect-src must include 'self'"
  );

  // worker-src
  assert.ok(csp["worker-src"], "worker-src directive must be defined");
  assert.ok(
    csp["worker-src"].includes("'self'"),
    "worker-src must include 'self'"
  );
  assert.ok(csp["worker-src"].includes("blob:"), "worker-src must allow blob:");

  // manifest-src
  assert.ok(csp["manifest-src"], "manifest-src directive must be defined");
  assert.ok(
    csp["manifest-src"].includes("'self'"),
    "manifest-src must include 'self'"
  );

  // object-src
  assert.ok(csp["object-src"], "object-src directive must be defined");
  assert.ok(csp["object-src"].includes("'none'"), "object-src must be 'none'");

  // base-uri
  assert.ok(csp["base-uri"], "base-uri directive must be defined");
  assert.ok(csp["base-uri"].includes("'self'"), "base-uri must be 'self'");

  // form-action
  assert.ok(csp["form-action"], "form-action directive must be defined");
  assert.ok(
    csp["form-action"].includes("'self'"),
    "form-action must be 'self'"
  );

  // frame-ancestors must NOT be in meta tag (browsers log warnings if present in meta)
  assert.equal(
    csp["frame-ancestors"],
    undefined,
    "frame-ancestors must not be delivered via <meta> (reserved for HTTP headers)"
  );
});

test("Documentation guides mini authors on extending Content-Security-Policy", () => {
  assert.ok(
    fs.existsSync(MINI_CONTRACT_PATH),
    "docs/MINI_CONTRACT.md must exist"
  );
  assert.ok(
    fs.existsSync(THIRD_PARTY_POLICY_PATH),
    "THIRD_PARTY_POLICY.md must exist"
  );

  const contractDoc = fs.readFileSync(MINI_CONTRACT_PATH, "utf8");
  const thirdPartyDoc = fs.readFileSync(THIRD_PARTY_POLICY_PATH, "utf8");

  // MINI_CONTRACT.md must document Content Security Policy
  assert.ok(
    contractDoc.includes("Content Security Policy") ||
      contractDoc.includes("CSP"),
    "docs/MINI_CONTRACT.md must document CSP"
  );
  assert.ok(
    contractDoc.includes('meta http-equiv="Content-Security-Policy"'),
    "docs/MINI_CONTRACT.md must provide CSP meta tag example"
  );

  // THIRD_PARTY_POLICY.md must guide minis on extending CSP
  assert.ok(
    thirdPartyDoc.includes("Content Security Policy") ||
      thirdPartyDoc.includes("CSP"),
    "THIRD_PARTY_POLICY.md must document CSP extension rules"
  );
  assert.ok(
    thirdPartyDoc.includes("cdnjs.cloudflare.com") ||
      thirdPartyDoc.includes("jsdelivr.net"),
    "THIRD_PARTY_POLICY.md must provide approved CDN extension example"
  );
});
