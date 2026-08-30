const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const INTEGRITY_JSON = path.join(REPO_ROOT, "data", "worker-integrity.json");

const EXTERNAL_PREFIXES = [
  "http://",
  "https://",
  "//",
  "data:",
  "blob:",
  "chrome-extension:",
];

const WORKER_CALL_PATTERN = /new\s+(?:Shared)?Worker\s*\(([^)]*)\)/g;
const IMPORT_SCRIPTS_CALL_PATTERN = /importScripts\s*\(([^)]*)\)/g;
const WORKER_REFERENCE_PATTERNS = [
  // Worker constructors take the script URL as their first argument followed
  // by an optional options object, which is deliberately not a URL. Note that
  // the string "new Worker" is intentionally not written verbatim in this
  // file, because the scan would otherwise match its own documentation.
  { pattern: WORKER_CALL_PATTERN, label: "new Worker", firstArgOnly: true },
  { pattern: IMPORT_SCRIPTS_CALL_PATTERN, label: "importScripts" },
];

// Files that only document or validate the worker API and must not be scanned
// as application code.
const IGNORED_SOURCE_FILES = new Set(["scripts/validate-worker-integrity.js"]);

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".github",
  "data",
  "tests",
]);

const STRING_LITERAL_PATTERN = /^(["'`])(.*)(\1)$/s;

/**
 * LF-normalizes a file (CRLF -> LF) before hashing. Git checkouts on Windows
 * write CRLF while CI checks out LF, so hashing raw bytes would make the
 * registry appear stale on one platform. Two files that differ only in line
 * endings are treated as identical, which is what we want: the meaningful
 * content is the same.
 */
function normalizedSha256(filePath) {
  const content = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

function parseArgumentList(argsText) {
  const tokens = [];
  let current = "";
  let quoteChar = "";
  let inQuote = false;

  for (const ch of argsText) {
    if (inQuote) {
      current += ch;
      if (ch === quoteChar) inQuote = false;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (ch === ",") {
      tokens.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim() !== "") tokens.push(current.trim());

  const parsed = [];
  for (const token of tokens) {
    const literalMatch = token.match(STRING_LITERAL_PATTERN);
    if (literalMatch) {
      parsed.push({ url: literalMatch[2], literal: true });
    } else {
      parsed.push({ url: token, literal: false, dynamic: true });
    }
  }
  return parsed;
}

function isExternal(url) {
  const lower = url.toLowerCase();
  return EXTERNAL_PREFIXES.some(prefix => lower.startsWith(prefix));
}

function toRepoRelative(rawUrl, sourceFileAbs) {
  let resolvedAbs;
  if (isExternal(rawUrl)) return null;
  if (rawUrl.startsWith("/")) {
    resolvedAbs = path.join(REPO_ROOT, rawUrl);
  } else {
    resolvedAbs = path.resolve(path.dirname(sourceFileAbs), rawUrl);
  }
  const rel = path.relative(REPO_ROOT, resolvedAbs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

/**
 * Scans a single source file for worker references (a Worker constructor call
 * or an importScripts call) and returns resolved repository-relative URLs plus
 * any integrity issues found.
 */
function findWorkerUsages(content, sourceRel) {
  const urls = new Set();
  const issues = [];

  for (const { pattern, label, firstArgOnly } of WORKER_REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const args = parseArgumentList(match[1]);
      const urlArgs = firstArgOnly ? args.slice(0, 1) : args;
      for (const arg of urlArgs) {
        if (!arg.literal) {
          issues.push({
            type: "DYNAMIC_WORKER_URL",
            source: sourceRel,
            message: `${label} in "${sourceRel}" uses a non-literal URL (${arg.url}); worker integrity cannot be verified. Use a string literal URL.`,
          });
          continue;
        }
        if (isExternal(arg.url)) {
          issues.push({
            type: "REMOTE_WORKER",
            source: sourceRel,
            message: `${label} in "${sourceRel}" references remote URL "${arg.url}". Remote worker scripts are not allowed; commit the script to this repository instead.`,
          });
          continue;
        }
        const rel = toRepoRelative(arg.url, path.join(REPO_ROOT, sourceRel));
        if (rel === null) {
          issues.push({
            type: "OUTSIDE_REPO_WORKER",
            source: sourceRel,
            message: `${label} in "${sourceRel}" references "${arg.url}" which resolves outside the repository.`,
          });
          continue;
        }
        urls.add(rel);
      }
    }
  }

  return { urls: [...urls], issues };
}

/**
 * Walks the repository for JavaScript source files, skipping vendored and
 * generated directories and files that only document the worker API.
 */
function walkSourceFiles(repoRoot) {
  const files = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) visit(path.join(dir, entry.name));
      } else if (entry.name.endsWith(".js")) {
        const rel = path.relative(repoRoot, path.join(dir, entry.name));
        if (!IGNORED_SOURCE_FILES.has(rel.split(path.sep).join("/"))) {
          files.push(path.join(dir, entry.name));
        }
      }
    }
  }
  visit(repoRoot);
  return files;
}

function readIntegrityData() {
  const raw = fs.readFileSync(INTEGRITY_JSON, "utf-8");
  return JSON.parse(raw);
}

/**
 * Validates that every worker/imported script referenced by the repository
 * resolves to a same-origin file whose sha256 is recorded in
 * data/worker-integrity.json, and that the registry has no stale or malformed
 * entries.
 */
function validateIntegrity(repoRoot) {
  const issues = [];
  if (!fs.existsSync(INTEGRITY_JSON)) {
    issues.push({
      type: "CONFIG",
      message: "data/worker-integrity.json does not exist.",
    });
    return issues;
  }

  let data;
  try {
    data = readIntegrityData();
  } catch (e) {
    issues.push({
      type: "CONFIG",
      message: `data/worker-integrity.json contains invalid JSON: ${e.message}`,
    });
    return issues;
  }

  if (Array.isArray(data.remoteAllowed) && data.remoteAllowed.length > 0) {
    issues.push({
      type: "REMOTE_WORKER",
      message: `Remote worker URLs are not allowed, but data/worker-integrity.json lists ${data.remoteAllowed.length}.`,
    });
  }

  const entries = Array.isArray(data.workers) ? data.workers : [];
  const seenUrls = new Set();
  const entryByUrl = new Map();
  for (const entry of entries) {
    if (
      entry === null ||
      typeof entry !== "object" ||
      typeof entry.url !== "string" ||
      typeof entry.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(entry.sha256)
    ) {
      issues.push({
        type: "MALFORMED_ENTRY",
        message: `Malformed entry in data/worker-integrity.json: ${JSON.stringify(entry)}`,
      });
      continue;
    }
    if (
      entry.url.split("\\").join("") !== entry.url ||
      entry.url.startsWith("/")
    ) {
      issues.push({
        type: "MALFORMED_ENTRY",
        message: `Entry url "${entry.url}" must be a repository-relative path (no leading slash or backslashes).`,
      });
      continue;
    }
    if (seenUrls.has(entry.url)) {
      issues.push({
        type: "MALFORMED_ENTRY",
        message: `Duplicate entry for "${entry.url}" in data/worker-integrity.json.`,
      });
      continue;
    }
    seenUrls.add(entry.url);
    entryByUrl.set(entry.url, entry);
  }

  const discovered = new Set();
  const seenSources = new Set();
  for (const absPath of walkSourceFiles(repoRoot)) {
    const sourceRel = path
      .relative(repoRoot, absPath)
      .split(path.sep)
      .join("/");
    const content = fs.readFileSync(absPath, "utf-8");
    const { urls, issues: sourceIssues } = findWorkerUsages(content, sourceRel);
    for (const url of urls) discovered.add(url);
    for (const issue of sourceIssues) {
      if (seenSources.has(`${issue.type}:${sourceRel}:${issue.message}`)) {
        continue;
      }
      seenSources.add(`${issue.type}:${sourceRel}:${issue.message}`);
      issues.push(issue);
    }
  }

  for (const url of [...discovered].sort()) {
    const absPath = path.join(repoRoot, url);
    if (!fs.existsSync(absPath)) {
      issues.push({
        type: "BROKEN_WORKER_REF",
        message: `Worker reference "${url}" does not exist on disk.`,
      });
      continue;
    }
    const entry = entryByUrl.get(url);
    if (!entry) {
      issues.push({
        type: "MISSING_ENTRY",
        message: `Worker "${url}" is referenced but missing from data/worker-integrity.json. Run "npm run validate:worker-integrity -- --update".`,
      });
      continue;
    }
    const hash = normalizedSha256(absPath);
    if (hash !== entry.sha256) {
      issues.push({
        type: "HASH_MISMATCH",
        message: `Worker "${url}" changed since it was registered. Run "npm run validate:worker-integrity -- --update" to refresh the hash.`,
      });
    }
  }

  for (const entry of entries) {
    if (entry && typeof entry.url === "string") {
      const absPath = path.join(repoRoot, entry.url);
      if (!fs.existsSync(absPath)) {
        issues.push({
          type: "STALE_ENTRY",
          message: `Registered worker "${entry.url}" does not exist on disk; remove the entry from data/worker-integrity.json.`,
        });
      }
    }
  }

  return issues;
}

function updateIntegrity(repoRoot) {
  if (!fs.existsSync(INTEGRITY_JSON)) {
    fs.writeFileSync(
      INTEGRITY_JSON,
      JSON.stringify({ policy: "", remoteAllowed: [], workers: [] }, null, 2) +
        "\n"
    );
  }
  let data;
  try {
    data = readIntegrityData();
  } catch (e) {
    data = { policy: "", remoteAllowed: [], workers: [] };
  }

  const discovered = new Set();
  for (const absPath of walkSourceFiles(repoRoot)) {
    const sourceRel = path
      .relative(repoRoot, absPath)
      .split(path.sep)
      .join("/");
    const { urls } = findWorkerUsages(
      fs.readFileSync(absPath, "utf-8"),
      sourceRel
    );
    for (const url of urls) {
      if (fs.existsSync(path.join(repoRoot, url))) discovered.add(url);
    }
  }

  const workers = [...discovered]
    .sort()
    .map(url => ({ url, sha256: normalizedSha256(path.join(repoRoot, url)) }));

  const updated = {
    policy: data.policy,
    remoteAllowed: data.remoteAllowed,
    workers,
  };
  fs.writeFileSync(INTEGRITY_JSON, JSON.stringify(updated, null, 2) + "\n");
  return {
    count: workers.length,
    existed: data.workers ? data.workers.length : 0,
  };
}

function main() {
  const isUpdate = process.argv.includes("--update");
  if (isUpdate) {
    const result = updateIntegrity(REPO_ROOT);
    console.log(
      `\n✅ Registered ${result.count} worker(s) in data/worker-integrity.json.`
    );
  } else {
    console.log("Validating worker script integrity...");
    const issues = validateIntegrity(REPO_ROOT);
    if (issues.length > 0) {
      console.error(`\n❌ Found ${issues.length} worker integrity issue(s):\n`);
      for (const issue of issues) {
        console.error(`  - [${issue.type}] ${issue.message}`);
      }
      console.error(
        "\nAll worker scripts must be committed to this repository and registered\nin data/worker-integrity.json. See SECURITY.md for the worker policy."
      );
      process.exit(1);
    } else {
      console.log(
        "\n✅ All worker scripts are same-origin and match their registered integrity hashes!"
      );
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  WORKER_REFERENCE_PATTERNS,
  findWorkerUsages,
  isExternal,
  normalizedSha256,
  readIntegrityData,
  toRepoRelative,
  updateIntegrity,
  validateIntegrity,
  walkSourceFiles,
};
