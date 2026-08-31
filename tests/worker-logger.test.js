import fs from "fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import path from "path";

function findProjectHtmlFiles() {
  const files = [];
  
  function traverse(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory() && !item.startsWith('.')) {
        traverse(fullPath);
      } else if (item === 'index.html') {
        files.push(fullPath);
      }
    }
  }
  
  traverse('projects');
  return files;
}

const htmlFiles = findProjectHtmlFiles();

test("SEO Metadata - all project files found", () => {
  assert.ok(htmlFiles.length > 0, `Expected at least 1 project file, found ${htmlFiles.length}`);
  console.log(`\nValidating ${htmlFiles.length} project files for SEO metadata...`);
});

test("SEO Metadata - all files have required meta tags", () => {
  const missingTags = [];

  htmlFiles.forEach((file) => {
    const content = fs.readFileSync(file, "utf8");
    const issues = [];

    if (!/<title>[^<]+<\/title>/.test(content)) issues.push("missing <title>");
    if (!/<meta name="description"/.test(content)) issues.push("missing meta[name=description]");
    if (!/<meta property="og:title"/.test(content)) issues.push("missing og:title");
    if (!/<meta property="og:description"/.test(content)) issues.push("missing og:description");
    if (!/<link rel="canonical"/.test(content)) issues.push("missing canonical");

    if (issues.length > 0) {
      missingTags.push(`${file}: ${issues.join(", ")}`);
    }
  });

  assert.equal(missingTags.length, 0, `Files with missing tags:\n${missingTags.join("\n")}`);
});

test("SEO Metadata - meta tag values have valid length", () => {
  const invalidTags = [];

  htmlFiles.forEach((file) => {
    const content = fs.readFileSync(file, "utf8");

    const titleMatch = content.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      const title = titleMatch[1];
      if (title.length < 5 || title.length > 100) {
        invalidTags.push(`${file}: title too short/long (${title.length} chars)`);
      }
    }

    const descMatch = content.match(/<meta name="description" content="([^"]+)"/);
    if (descMatch) {
      const desc = descMatch[1];
      if (desc.length < 20 || desc.length > 200) {
        invalidTags.push(`${file}: description invalid length (${desc.length} chars)`);
      }
    }
  });

  assert.equal(invalidTags.length, 0, `Files with invalid tag values:\n${invalidTags.join("\n")}`);
});

test("SEO Metadata - canonical URLs are valid", () => {
  const invalidUrls = [];

  htmlFiles.forEach((file) => {
    const content = fs.readFileSync(file, "utf8");
    const canonicalMatch = content.match(/<link rel="canonical" href="([^"]+)"/);

    if (canonicalMatch) {
      const url = canonicalMatch[1];
      if (!url.startsWith("https://facelessism.github.io/cradle/projects/")) {
        invalidUrls.push(`${file}: invalid canonical URL (${url})`);
      }
      if (!url.endsWith("/")) {
        invalidUrls.push(`${file}: canonical URL should end with / (${url})`);
      }
    }
  });

  assert.equal(invalidUrls.length, 0, `Files with invalid canonical URLs:\n${invalidUrls.join("\n")}`);
});

test("SEO Metadata - charset is UTF-8", () => {
  const invalidCharsets = [];

  htmlFiles.forEach((file) => {
    const content = fs.readFileSync(file, "utf8");
    if (!/<meta charset="UTF-8"/i.test(content)) {
      invalidCharsets.push(file);
    }
  });

  assert.equal(invalidCharsets.length, 0, `Files without UTF-8 charset:\n${invalidCharsets.join("\n")}`);
});