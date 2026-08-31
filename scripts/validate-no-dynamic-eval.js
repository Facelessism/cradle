const fs = require("fs");
const path = require("path");

// Guards shipped code against dynamic code-execution patterns (eval, Function
// constructor, string-based timers, inline handlers, javascript: URLs,
// non-literal importScripts, and unsafe/unrestricted iframes). Follows the
// project's validate-* script conventions: pure functions exported for tests +
// a CLI entry guarded by require.main.
//
// Scan scope is the deployable surface: projects/, src/, and root-level files.
// tests/ (fixtures intentionally contain malicious strings) and scripts/
// (Node tooling that legitimately uses child_process/vm) are excluded.
//
// NOTE: This is a heuristic guard rail, not a substitute for review. It masks
// comments (block and line) so prose mentioning these APIs doesn't false-positive,
// then scans one line at a time to keep reported line numbers accurate.

const REPO_ROOT = path.resolve(__dirname, "..");
const SCAN_EXTENSIONS = new Set([".html", ".js", ".mjs", ".cjs"]);
const EXCLUDED_DIRS = new Set(["node_modules", ".git", "tests", "scripts"]);
const SELF_FILENAME = "validate-no-dynamic-eval.js";
const TEST_FILENAME = "no-dynamic-eval.test.js";

const PATTERNS = [
  { name: "eval()", regex: /\beval\s*\(/ },
  { name: "new Function()", regex: /\bnew\s+Function\s*\(/ },
  { name: "Function() call", regex: /\bFunction\s*\(/ },
  { name: "document.write()", regex: /document\.write(?:ln)?\s*\(/ },
  { name: "setTimeout string arg", regex: /\bsetTimeout\s*\(\s*["']/ },
  { name: "setInterval string arg", regex: /\bsetInterval\s*\(\s*["']/ },
  {
    name: "javascript: URL",
    regex: /(?:href|action|src|xlink:href)\s*=\s*["']\s*javascript:/i,
  },
  { name: "data:text/html source", regex: /src\s*=\s*["']data:text\/html/i },
  {
    name: "inline event handler",
    regex:
      /\son(?:abort|change|click|dblclick|error|input|keydown|keypress|keyup|load|mouseover|submit)\s*=\s*["']/i,
  },
  {
    name: "unsafe iframe target",
    regex:
      /<iframe\b[^>]*(?:src|srcdoc)\s*=\s*["']\s*(?:javascript:|data:text\/html)/i,
  },
];

function collectFiles(dir, root) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const dirName = entry.name;
      if (EXCLUDED_DIRS.has(dirName) || dirName.startsWith(".")) continue;
      results = results.concat(collectFiles(path.join(dir, entry.name), root));
    } else if (entry.isFile()) {
      if (!SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        continue;
      if (entry.name === SELF_FILENAME || entry.name === TEST_FILENAME)
        continue;
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

// Masks block comments and line comments with spaces so they can't trigger
// findings while preserving line/column structure. The `[^:]` guard keeps
// `//` in URLs (e.g. `https://`) intact.
function maskComments(source) {
  const masked = source
    .replace(/<!--[\s\S]*?-->/g, match => match.replace(/[^\r\n]/g, " "))
    .replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\r\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\r\n]*/gm, "$1");
  return masked;
}

// Scans a single source string and returns [{ line, name, code }] findings.
function scanSource(source) {
  const findings = [];
  const masked = maskComments(source);
  const lines = masked.split(/\r?\n/);
  const originalLines = source.split(/\r?\n/);

  lines.forEach((line, idx) => {
    PATTERNS.forEach(pattern => {
      if (pattern.regex.test(line)) {
        findings.push({
          line: idx + 1,
          name: pattern.name,
          code: (originalLines[idx] || "").trim(),
        });
      }
    });

    const importMatch = /\bimportScripts\s*\(\s*([^)]+)/.exec(line);
    if (importMatch) {
      const arg = importMatch[1].trim();
      const isLiteralString = /^(["'])[^"']*\1$/.test(arg);
      if (!isLiteralString) {
        findings.push({
          line: idx + 1,
          name: "dynamic importScripts()",
          code: (originalLines[idx] || "").trim(),
        });
      }
    }
  });

  return findings;
}

function scanRepo(root = REPO_ROOT) {
  const files = collectFiles(root, root);
  const findings = [];

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf-8");
    const relPath = path.relative(root, filePath);
    const fileFindings = scanSource(source);
    fileFindings.forEach(f => {
      findings.push({
        file: relPath,
        line: f.line,
        name: f.name,
        code: f.code,
      });
    });
  }

  findings.sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)
  );
  return findings;
}

function main() {
  console.log("Scanning for dynamic code-execution patterns...");
  const findings = scanRepo(REPO_ROOT);

  if (findings.length > 0) {
    console.log(
      `\n❌ Found ${findings.length} dynamic code-execution pattern(s):\n`
    );
    findings.forEach(f =>
      console.log(
        `  ${f.file}:${f.line}  [${f.name}]  ${f.code.length > 100 ? f.code.slice(0, 97) + "..." : f.code}`
      )
    );
    console.log(
      "\nDynamic code execution from string input (eval, Function constructor,\nstring-based timers, inline handlers, javascript: URLs, non-literal\nimportScripts) is not allowed without an explicit review. Prefer\nfunction-argument timers and literal-URL workers."
    );
    process.exit(1);
  }

  console.log("\n✅ No dynamic code-execution patterns found.");
}

if (require.main === module) {
  main();
}

module.exports = {
  collectFiles,
  maskComments,
  scanSource,
  scanRepo,
  main,
  SELF_FILENAME,
  TEST_FILENAME,
};
