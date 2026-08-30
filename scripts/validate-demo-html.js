const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO_ROOT = path.resolve(__dirname, "..");

/**
 * Scans repository to discover target demo HTML pages.
 */
function getDemoHtmlFiles(repoRoot = REPO_ROOT) {
  const files = [];

  // 1. UI showcase demo
  const uiDemo = path.join(repoRoot, "src", "components", "ui", "demo.html");
  if (fs.existsSync(uiDemo)) {
    files.push(uiDemo);
  }

  // 2. Root index
  const rootIndex = path.join(repoRoot, "index.html");
  if (fs.existsSync(rootIndex)) {
    files.push(rootIndex);
  }

  // 3. Mini-project index files in projects/*/*/index.html
  const projectsDir = path.join(repoRoot, "projects");
  if (fs.existsSync(projectsDir)) {
    const categories = fs
      .readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const cat of categories) {
      const catPath = path.join(projectsDir, cat.name);
      const projects = fs
        .readdirSync(catPath, { withFileTypes: true })
        .filter(d => d.isDirectory());

      for (const proj of projects) {
        const indexPath = path.join(catPath, proj.name, "index.html");
        if (fs.existsSync(indexPath)) {
          files.push(indexPath);
        }
      }
    }
  }

  return files;
}

/**
 * Parses script tags sequentially without treating inner JS string literals as HTML.
 */
function parseScriptBlocks(htmlContent) {
  const blocks = [];
  const scriptTagOpen = /<script\b([^>]*)>/gi;
  let match;

  while ((match = scriptTagOpen.exec(htmlContent)) !== null) {
    const attrs = match[1];
    const openTagEndIndex = scriptTagOpen.lastIndex;

    const closeTagRegex = /<\/script\s*>/gi;
    closeTagRegex.lastIndex = openTagEndIndex;
    const closeMatch = closeTagRegex.exec(htmlContent);

    if (!closeMatch) {
      blocks.push({
        attrs,
        code: "",
        openIndex: match.index,
        closeIndex: -1,
        unclosed: true,
      });
      break;
    }

    const code = htmlContent.slice(openTagEndIndex, closeMatch.index);
    blocks.push({
      attrs,
      code,
      openIndex: match.index,
      codeStartIndex: openTagEndIndex,
      closeIndex: closeTagRegex.lastIndex,
      unclosed: false,
    });

    scriptTagOpen.lastIndex = closeTagRegex.lastIndex;
  }

  return blocks;
}

/**
 * Validates inline JavaScript inside script tags for syntax errors.
 */
function validateInlineJs(content, filename) {
  const issues = [];
  const scriptBlocks = parseScriptBlocks(content);

  for (const block of scriptBlocks) {
    if (block.unclosed) {
      // Unclosed script tag reported by validateHtmlStructure
      continue;
    }

    const attrs = block.attrs;
    const code = block.code;
    if (/src\s*=/i.test(attrs) && !code.trim()) continue;
    if (!code.trim()) continue;

    const scriptStartLine =
      content.slice(0, block.codeStartIndex).split("\n").length;

    try {
      if (
        /type\s*=\s*["']module["']/i.test(attrs) ||
        /^\s*import\b/m.test(code) ||
        /^\s*export\b/m.test(code)
      ) {
        if (vm.SourceTextModule) {
          new vm.SourceTextModule(code, { identifier: filename });
        }
      } else {
        new vm.Script(code, { filename });
      }
    } catch (e) {
      let errLine = 1;
      if (e.stack) {
        const escapedFilename = filename.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        const matchLine = e.stack.match(
          new RegExp(escapedFilename + ":(\\d+)")
        );
        if (matchLine) errLine = parseInt(matchLine[1], 10);
      }
      const actualLine = scriptStartLine + errLine - 1;
      issues.push({
        type: "INVALID_INLINE_JS",
        file: filename,
        line: actualLine,
        message: `Syntax error in inline JavaScript at ${filename}:${actualLine}: ${e.message}`,
      });
    }
  }

  return issues;
}

/**
 * Validates HTML document structure and tag balance.
 */
function validateHtmlStructure(content, filename) {
  const issues = [];

  // 1. Basic document structure
  if (!/<(?:html|body|head|doctype)/i.test(content)) {
    issues.push({
      type: "INVALID_HTML_STRUCTURE",
      file: filename,
      line: 1,
      message: `File "${filename}" does not contain valid HTML document structure.`,
    });
  }

  // 2. Unclosed script tag check
  const scriptBlocks = parseScriptBlocks(content);
  for (const block of scriptBlocks) {
    if (block.unclosed) {
      const line = content.slice(0, block.openIndex).split("\n").length;
      issues.push({
        type: "UNCLOSED_SCRIPT_TAG",
        file: filename,
        line,
        message: `Unclosed <script> tag in "${filename}" at line ${line} (missing </script>).`,
      });
    }
  }

  // 3. Unclosed critical tags balance check (ignoring inline script content)
  const contentNoScript = content.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    ""
  );
  const criticalTags = ["style", "template", "svg"];
  for (const tag of criticalTags) {
    const openRegex = new RegExp(`<${tag}\\b[^>]*>`, "gi");
    const closeRegex = new RegExp(`</${tag}\\s*>`, "gi");
    const openMatches = (contentNoScript.match(openRegex) || []).length;
    const closeMatches = (contentNoScript.match(closeRegex) || []).length;
    if (openMatches !== closeMatches) {
      issues.push({
        type: "UNCLOSED_TAG",
        file: filename,
        line: 1,
        message: `Mismatched <${tag}> tag count in "${filename}": ${openMatches} opening tag(s) and ${closeMatches} closing tag(s).`,
      });
    }
  }

  // 4. Mismatched HTML comments check
  const openComments = (content.match(/<!--/g) || []).length;
  const closeComments = (content.match(/-->/g) || []).length;
  if (openComments !== closeComments) {
    issues.push({
      type: "UNCLOSED_COMMENT",
      file: filename,
      line: 1,
      message: `Mismatched HTML comment delimiters in "${filename}": ${openComments} opening '<!--' and ${closeComments} closing '-->'.`,
    });
  }

  return issues;
}

/**
 * Validates all demo HTML files across the repository.
 */
function validateDemoHtmlFiles(repoRoot = REPO_ROOT) {
  const files = getDemoHtmlFiles(repoRoot);
  const issues = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf-8");
    const relPath = path
      .relative(repoRoot, filePath)
      .replace(/\\/g, "/");

    const jsIssues = validateInlineJs(content, relPath);
    const htmlIssues = validateHtmlStructure(content, relPath);

    issues.push(...jsIssues, ...htmlIssues);
  }

  return issues;
}

function main() {
  console.log("Validating demo HTML files and inline scripts...");
  const issues = validateDemoHtmlFiles();

  if (issues.length > 0) {
    console.error(`\n❌ Found ${issues.length} demo HTML / inline JS issue(s):\n`);
    issues.forEach(issue => {
      console.error(`  - [${issue.type}] ${issue.message}`);
    });
    process.exit(1);
  } else {
    console.log(
      "\n✅ All demo HTML files and inline scripts passed validation successfully!"
    );
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getDemoHtmlFiles,
  parseScriptBlocks,
  validateInlineJs,
  validateHtmlStructure,
  validateDemoHtmlFiles,
};
