import assert from "node:assert/strict";
import { test } from "node:test";
import URLEngine from "../projects/dev-tools/url-parser/urlEngine.js";

test("parseURLComponents extracts scheme, host, path, and query params accurately", () => {
  const { components, error } = URLEngine.parseURLComponents(
    "https://cradle.dev:8080/projects/math?q=matrix&sort=asc#overview"
  );

  assert.equal(error, null);
  assert.equal(components.protocol, "https");
  assert.equal(components.hostname, "cradle.dev");
  assert.equal(components.port, "8080");
  assert.equal(components.pathname, "/projects/math");
  assert.equal(components.hash, "#overview");
  assert.equal(components.queryParams.length, 2);
  assert.equal(components.queryParams[0].key, "q");
  assert.equal(components.queryParams[0].value, "matrix");
});

test("parseURLComponents automatically prepends HTTPS scheme if missing", () => {
  const { components, error } =
    URLEngine.parseURLComponents("github.com/cradle");

  assert.equal(error, null);
  assert.equal(components.protocol, "https");
  assert.equal(components.hostname, "github.com");
});

test("parseURLComponents trims surrounding whitespace", () => {
  const { components, error } = URLEngine.parseURLComponents(
    "   https://example.com/path   "
  );

  assert.equal(error, null);
  assert.equal(components.hostname, "example.com");
  assert.equal(components.pathname, "/path");
});

test("parseURLComponents handles supported URI schemes", () => {
  const { components, error } = URLEngine.parseURLComponents(
    "ftp://files.example.com/file.txt"
  );

  assert.equal(error, null);
  assert.equal(components.protocol, "ftp");
  assert.equal(components.hostname, "files.example.com");
  assert.equal(components.pathname, "/file.txt");
});

test("parseURLComponents handles mailto URLs", () => {
  const { components, error } = URLEngine.parseURLComponents(
    "mailto:user@example.com"
  );

  assert.equal(error, null);
  assert.equal(components.protocol, "mailto");
  assert.equal(components.pathname, "user@example.com");
});

test("parseURLComponents handles internationalized domain names", () => {
  const { components, error } = URLEngine.parseURLComponents(
    "https://例え.テスト"
  );

  assert.equal(error, null);
  assert.ok(components.hostname);
  assert.ok(components.href);
});

test("parseURLComponents handles Unicode URL paths", () => {
  const { components, error } = URLEngine.parseURLComponents(
    "https://example.com/प्रोजेक्ट"
  );

  assert.equal(error, null);
  assert.ok(components.pathname);
  assert.ok(components.href);
});

test("parseURLComponents handles Unicode query parameters", () => {
  const { components, error } = URLEngine.parseURLComponents(
    "https://example.com/search?q=नमस्ते"
  );

  assert.equal(error, null);
  assert.equal(components.queryParams.length, 1);
  assert.equal(components.queryParams[0].key, "q");
  assert.equal(components.queryParams[0].value, "नमस्ते");
});

test("parseURLComponents handles Unicode fragments", () => {
  const { components, error } = URLEngine.parseURLComponents(
    "https://example.com/page#अध्याय"
  );

  assert.equal(error, null);
  assert.ok(components.hash);
});

test("parseURLComponents accepts valid IPv4 addresses", () => {
  const { components, error } = URLEngine.parseURLComponents(
    "https://192.168.1.1:8080"
  );

  assert.equal(error, null);
  assert.equal(components.hostname, "192.168.1.1");
  assert.equal(components.port, "8080");
});

test("parseURLComponents accepts valid IPv6 addresses", () => {
  const { components, error } = URLEngine.parseURLComponents(
    "https://[::1]:8080"
  );

  assert.equal(error, null);
  assert.ok(components.hostname);
  assert.equal(components.port, "8080");
});

test("parseURLComponents rejects malformed URLs", () => {
  const malformedURLs = [
    "https://[invalid",
    "https:///",
    "https://./",
    "https://..",
    "https://example..com",
    "https://.example.com",
    "https://-example.com",
    "https://example-.com",
    "https://exa mple.com",
    "https://example.com:abc",
    "https://example.com:99999",
    "https://",
    "://example.com",
  ];

  for (const input of malformedURLs) {
    const { components, error } =
      URLEngine.parseURLComponents(input);

    assert.equal(
      components,
      null,
      `Expected "${input}" to be rejected`
    );

    assert.equal(
      error,
      "Please enter a valid URL.",
      `Expected a user-friendly error for "${input}"`
    );
  }
});

test("parseURLComponents rejects unsupported protocols", () => {
  const unsupportedURLs = [
    "javascript:alert(1)",
    "data:text/plain,hello",
    "file:///etc/passwd",
    "custom://example.com",
  ];

  for (const input of unsupportedURLs) {
    const { components, error } =
      URLEngine.parseURLComponents(input);

    assert.equal(
      components,
      null,
      `Expected unsupported protocol "${input}" to be rejected`
    );

    assert.equal(
      error,
      "Please enter a valid URL."
    );
  }
});

test("parseURLComponents rejects empty and whitespace-only input", () => {
  for (const input of ["", "   ", "\t", "\n"]) {
    const { components, error } =
      URLEngine.parseURLComponents(input);

    assert.equal(components, null);
    assert.equal(error, "Please enter a valid URL.");
  }
});

test("parseURLComponents rejects non-string input", () => {
  const inputs = [null, undefined, 123, {}, [], true];

  for (const input of inputs) {
    const { components, error } =
      URLEngine.parseURLComponents(input);

    assert.equal(components, null);
    assert.equal(error, "Please enter a valid URL.");
  }
});

test("buildQueryString formats key-value pairs into a valid query string", () => {
  const params = [
    { key: "page", value: "1" },
    { key: "limit", value: "20" },
  ];

  assert.equal(
    URLEngine.buildQueryString(params),
    "?page=1&limit=20"
  );
});

test("buildQueryString handles empty values", () => {
  const params = [
    { key: "search", value: "" },
    { key: "page", value: "1" },
  ];

  assert.equal(
    URLEngine.buildQueryString(params),
    "?search=&page=1"
  );
});

test("encodeURLComponentSafe and decodeURLComponentSafe round-trip reserved symbols", () => {
  const original = "hello world & key=value";

  const encoded =
    URLEngine.encodeURLComponentSafe(original);

  const decoded =
    URLEngine.decodeURLComponentSafe(encoded);

  assert.equal(decoded, original);
});

test("detectFileType classifies extensions", () => {
  assert.equal(
    URLEngine.detectFileType("png").trim(),
    "Image"
  );

  assert.equal(
    URLEngine.detectFileType(".PNG").trim(),
    "Image"
  );

  assert.equal(
    URLEngine.detectFileType("mp4").trim(),
    "Video"
  );

  assert.equal(
    URLEngine.detectFileType("pdf").trim(),
    "Document"
  );

  assert.equal(
    URLEngine.detectFileType("xyz"),
    "Unknown"
  );
});

test("detectURLType classifies representative URLs", () => {
  assert.equal(
    URLEngine.detectURLType(
      new URL("https://example.com/photo.png"),
      "png"
    ),
    "Image URL"
  );

  assert.equal(
    URLEngine.detectURLType(
      new URL("https://api.example.com/v1/users"),
      "None"
    ),
    "API Endpoint"
  );

  assert.equal(
    URLEngine.detectURLType(
      new URL("https://github.com/vedant7007/cradle"),
      "None"
    ),
    "GitHub URL"
  );

  assert.equal(
    URLEngine.detectURLType(
      new URL("https://youtu.be/dQw4w9WgXcQ"),
      "None"
    ),
    "YouTube URL"
  );

  assert.equal(
    URLEngine.detectURLType(
      new URL("ftp://files.example.com/a.txt"),
      "txt"
    ),
    "FTP URL"
  );

  assert.equal(
    URLEngine.detectURLType(
      new URL("https://example.com/about"),
      "None"
    ),
    "Website URL"
  );
});

test("escapeHTML neutralises markup", () => {
  assert.equal(
    URLEngine.escapeHTML(
      "<img src=x onerror=alert(1)>"
    ),
    "&lt;img src=x onerror=alert(1)&gt;"
  );

  assert.equal(
    URLEngine.escapeHTML(`"&'`),
    "&quot;&amp;&#039;"
  );
});

test("escapeHTML protects both URL component labels and values", () => {
  const key = "<script>alert(1)</script>";
  const value = "<b onmouseover=steal()>hi</b>";

  assert.ok(
    !URLEngine.escapeHTML(key).includes("<")
  );

  assert.ok(
    !URLEngine.escapeHTML(value).includes("<")
  );
});