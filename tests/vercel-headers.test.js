import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const vercelConfigPath = path.join(repoRoot, "vercel.json");

test("vercel.json exists and is valid JSON", () => {
  assert.ok(
    fs.existsSync(vercelConfigPath),
    "vercel.json must exist in project root"
  );
  const content = fs.readFileSync(vercelConfigPath, "utf-8");
  assert.doesNotThrow(
    () => JSON.parse(content),
    "vercel.json must be valid JSON"
  );
});

test("vercel.json contains catch-all headers rule for all routes", () => {
  const config = JSON.parse(fs.readFileSync(vercelConfigPath, "utf-8"));
  assert.ok(Array.isArray(config.headers), "config.headers must be an array");
  assert.ok(
    config.headers.length > 0,
    "config.headers must have at least one route entry"
  );

  const globalRule = config.headers.find(
    entry => entry.source === "/(.*)" || entry.source === "/:path*"
  );
  assert.ok(
    globalRule,
    "vercel.json must include a catch-all route such as /(.*)"
  );
  assert.ok(
    Array.isArray(globalRule.headers),
    "route entry must specify an array of headers"
  );
});

test("headers section contains X-Content-Type-Options nosniff", () => {
  const config = JSON.parse(fs.readFileSync(vercelConfigPath, "utf-8"));
  const globalRule = config.headers.find(entry => entry.source === "/(.*)");
  const header = globalRule.headers.find(
    h => h.key.toLowerCase() === "x-content-type-options"
  );

  assert.ok(header, "X-Content-Type-Options header must be present");
  assert.equal(header.value, "nosniff");
});

test("headers section contains Referrer-Policy strict-origin-when-cross-origin", () => {
  const config = JSON.parse(fs.readFileSync(vercelConfigPath, "utf-8"));
  const globalRule = config.headers.find(entry => entry.source === "/(.*)");
  const header = globalRule.headers.find(
    h => h.key.toLowerCase() === "referrer-policy"
  );

  assert.ok(header, "Referrer-Policy header must be present");
  assert.equal(header.value, "strict-origin-when-cross-origin");
});

test("headers section contains X-Frame-Options SAMEORIGIN", () => {
  const config = JSON.parse(fs.readFileSync(vercelConfigPath, "utf-8"));
  const globalRule = config.headers.find(entry => entry.source === "/(.*)");
  const header = globalRule.headers.find(
    h => h.key.toLowerCase() === "x-frame-options"
  );

  assert.ok(header, "X-Frame-Options header must be present");
  assert.equal(header.value, "SAMEORIGIN");
});

test("headers section contains Permissions-Policy allowing camera and mic for self and denying unused features", () => {
  const config = JSON.parse(fs.readFileSync(vercelConfigPath, "utf-8"));
  const globalRule = config.headers.find(entry => entry.source === "/(.*)");
  const header = globalRule.headers.find(
    h => h.key.toLowerCase() === "permissions-policy"
  );

  assert.ok(header, "Permissions-Policy header must be present");
  const value = header.value;

  // Verify camera and microphone are allowed for self only (needed for ASCII Camera and audio visualizer minis)
  assert.ok(
    /camera=\(self\)/.test(value),
    "camera permission must be allowed for self: camera=(self)"
  );
  assert.ok(
    /microphone=\(self\)/.test(value),
    "microphone permission must be allowed for self: microphone=(self)"
  );

  // Verify unused hardware and sensitive browser features are denied
  assert.ok(
    /geolocation=\(\)/.test(value),
    "geolocation must be denied: geolocation=()"
  );
  assert.ok(/payment=\(\)/.test(value), "payment must be denied: payment=()");
  assert.ok(/usb=\(\)/.test(value), "usb must be denied: usb=()");
  assert.ok(
    /display-capture=\(\)/.test(value),
    "display-capture must be denied: display-capture=()"
  );
});

test("headers section contains Content-Security-Policy in Report-Only mode", () => {
  const config = JSON.parse(fs.readFileSync(vercelConfigPath, "utf-8"));
  const globalRule = config.headers.find(entry => entry.source === "/(.*)");
  const header = globalRule.headers.find(
    h => h.key.toLowerCase() === "content-security-policy-report-only"
  );

  assert.ok(
    header,
    "Content-Security-Policy-Report-Only header must be present"
  );
  const policy = header.value;

  // Core directives required for defense-in-depth and mini runtime compatibility
  assert.ok(
    policy.includes("default-src 'self'"),
    "CSP must define default-src 'self'"
  );
  assert.ok(policy.includes("script-src"), "CSP must define script-src");
  assert.ok(
    policy.includes("worker-src"),
    "CSP must define worker-src for Web Workers"
  );
  assert.ok(
    policy.includes("frame-ancestors 'self'"),
    "CSP must protect against frame embedding"
  );
  assert.ok(
    policy.includes("object-src 'none'"),
    "CSP must restrict plugin objects"
  );
});
