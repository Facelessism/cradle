const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  getDemoHtmlFiles,
  parseScriptBlocks,
  validateInlineJs,
  validateHtmlStructure,
  validateDemoHtmlFiles,
} = require("../scripts/validate-demo-html");

test("valid demo HTML file passes validation cleanly", () => {
  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Valid Demo</title>
        <script>
          (function() {
            const greeting = "Hello, World!";
            console.log(greeting);
          })();
        </script>
      </head>
      <body>
        <h1>Demo Page</h1>
      </body>
    </html>
  `;

  const jsIssues = validateInlineJs(html, "valid-demo.html");
  const htmlIssues = validateHtmlStructure(html, "valid-demo.html");

  assert.deepEqual(jsIssues, []);
  assert.deepEqual(htmlIssues, []);
});

test("invalid inline JavaScript is detected with clear error message and line number", () => {
  const html = [
    "<!doctype html>",
    "<html>",
    "  <head>",
    "    <title>Invalid JS Demo</title>",
    "  </head>",
    "  <body>",
    "    <script>",
    "      const a = 10;",
    "      const b = ; // Syntax error",
    "    </script>",
    "  </body>",
    "</html>",
  ].join("\n");

  const issues = validateInlineJs(html, "invalid-js.html");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, "INVALID_INLINE_JS");
  assert.equal(issues[0].file, "invalid-js.html");
  assert.equal(issues[0].line, 9);
  assert.match(issues[0].message, /Syntax error/i);
});

test("HTML structural and syntax problems are detected", () => {
  // Test 1: Unclosed script tag
  const unclosedScriptHtml = `
    <!doctype html>
    <html>
      <head><title>Unclosed Script</title></head>
      <body>
        <script>
          console.log("no closing tag");
      </body>
    </html>
  `;
  const unclosedScriptIssues = validateHtmlStructure(
    unclosedScriptHtml,
    "unclosed-script.html"
  );
  assert.equal(unclosedScriptIssues.length, 1);
  assert.equal(unclosedScriptIssues[0].type, "UNCLOSED_SCRIPT_TAG");
  assert.match(unclosedScriptIssues[0].message, /Unclosed <script>/i);

  // Test 2: Missing HTML document structure
  const invalidStructureHtml = "<div>Just a fragment without document structure</div>";
  const structureIssues = validateHtmlStructure(
    invalidStructureHtml,
    "fragment.html"
  );
  assert.equal(structureIssues.length, 1);
  assert.equal(structureIssues[0].type, "INVALID_HTML_STRUCTURE");

  // Test 3: Mismatched comment tags
  const unclosedCommentHtml = `
    <!doctype html>
    <html>
      <!-- Open comment without close
      <body><h1>Title</h1></body>
    </html>
  `;
  const commentIssues = validateHtmlStructure(
    unclosedCommentHtml,
    "unclosed-comment.html"
  );
  assert.equal(commentIssues.length, 1);
  assert.equal(commentIssues[0].type, "UNCLOSED_COMMENT");
});

test("unrelated/non-demo files are not accidentally included by getDemoHtmlFiles", () => {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "cradle-demo-html-test-")
  );

  // Set up mock directory layout
  const uiDir = path.join(tmpDir, "src", "components", "ui");
  const projectDir = path.join(tmpDir, "projects", "games", "sample-game");
  const randomDir = path.join(tmpDir, "random-folder");

  fs.mkdirSync(uiDir, { recursive: true });
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(randomDir, { recursive: true });

  // Target demo HTML files
  fs.writeFileSync(path.join(uiDir, "demo.html"), "<!doctype html><html></html>");
  fs.writeFileSync(path.join(tmpDir, "index.html"), "<!doctype html><html></html>");
  fs.writeFileSync(path.join(projectDir, "index.html"), "<!doctype html><html></html>");

  // Non-demo / unrelated files that should NOT be included
  fs.writeFileSync(path.join(randomDir, "other.html"), "<!doctype html><html></html>");
  fs.writeFileSync(path.join(projectDir, "notes.txt"), "Some notes");
  fs.writeFileSync(path.join(tmpDir, "README.md"), "# Readme");

  const discoveredFiles = getDemoHtmlFiles(tmpDir).map(p =>
    path.relative(tmpDir, p).replace(/\\/g, "/")
  );

  assert.deepEqual(discoveredFiles.sort(), [
    "index.html",
    "projects/games/sample-game/index.html",
    "src/components/ui/demo.html",
  ]);
  assert.equal(discoveredFiles.includes("random-folder/other.html"), false);
  assert.equal(discoveredFiles.includes("README.md"), false);
});

test("validateDemoHtmlFiles passes cleanly on all repository demo files", () => {
  const issues = validateDemoHtmlFiles();
  assert.deepEqual(
    issues,
    [],
    `Expected 0 demo HTML validation issues across repo, but found ${issues.length}:\n` +
      issues.map(i => `  [${i.type}] ${i.message}`).join("\n")
  );
});
