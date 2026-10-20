const test = require("node:test");
const assert = require("node:assert");
const engine = require("../projects/productivity/terminal-portfolio-generator/portfolioEngine.js");

test("createEmptyPortfolio returns the expected default shape", () => {
  const p = engine.createEmptyPortfolio();
  assert.strictEqual(p.name, "");
  assert.strictEqual(p.role, "");
  assert.deepStrictEqual(p.skills, []);
  assert.deepStrictEqual(p.projects, []);
  assert.deepStrictEqual(p.contact, {});
});

test("validatePortfolio requires name and role", () => {
  const result = engine.validatePortfolio({});
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.includes("Name is required."));
  assert.ok(result.errors.includes("Role/title is required."));
});

test("validatePortfolio passes with only name and role set", () => {
  const result = engine.validatePortfolio({ name: "Ada", role: "Engineer" });
  assert.strictEqual(result.valid, true);
  assert.deepStrictEqual(result.errors, []);
});

test("validatePortfolio rejects wrong types for array sections", () => {
  const result = engine.validatePortfolio({
    name: "Ada",
    role: "Engineer",
    skills: "not-an-array",
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.includes("skills must be an array."));
});

test("validatePortfolio rejects a non-object contact field", () => {
  const result = engine.validatePortfolio({
    name: "Ada",
    role: "Engineer",
    contact: ["oops"],
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.includes("Contact must be an object."));
});

test("parseCommandName lowercases and strips arguments", () => {
  assert.strictEqual(engine.parseCommandName("  SKILLS  "), "skills");
  assert.strictEqual(
    engine.parseCommandName("projects extra args"),
    "projects"
  );
  assert.strictEqual(engine.parseCommandName(""), "");
  assert.strictEqual(engine.parseCommandName(undefined), "");
});

test("buildCommandOutput only auto-runs sections that have content", () => {
  const portfolio = {
    name: "Ada Lovelace",
    role: "Mathematician",
    about: "",
    skills: ["Math"],
    projects: [],
    experience: [],
    education: [{ degree: "BSc", institution: "Somewhere" }],
    contact: {},
  };

  const { autoRunOrder } = engine.buildCommandOutput(portfolio);
  assert.deepStrictEqual(autoRunOrder, [
    "banner",
    "whoami",
    "skills",
    "education",
  ]);
});

test("buildCommandOutput includes a help command listing every command", () => {
  const { commands } = engine.buildCommandOutput(engine.createEmptyPortfolio());
  assert.ok(commands.help);
  assert.ok(commands.help.lines.some(line => line.includes("whoami")));
  assert.ok(commands.help.lines.some(line => line.includes("contact")));
});

test("runCommand resolves a known command from the registry", () => {
  const portfolio = { name: "Ada", role: "Engineer", skills: ["JS", "Rust"] };
  const output = engine.buildCommandOutput(portfolio);
  const result = engine.runCommand(output, "skills");
  assert.strictEqual(result.found, true);
  assert.strictEqual(result.command, "skills");
  assert.deepStrictEqual(result.lines, ["  - JS", "  - Rust"]);
});

test("runCommand returns a not-found result for unknown commands", () => {
  const output = engine.buildCommandOutput(engine.createEmptyPortfolio());
  const result = engine.runCommand(output, "sudo rm -rf /");
  assert.strictEqual(result.found, false);
  assert.strictEqual(result.command, "sudo");
  assert.ok(result.lines[0].includes("command not found: sudo"));
});

test("runCommand handles empty input without throwing", () => {
  const output = engine.buildCommandOutput(engine.createEmptyPortfolio());
  const result = engine.runCommand(output, "");
  assert.strictEqual(result.found, false);
  assert.strictEqual(result.command, "");
});

test("banner uses the portfolio name when present, and a fallback when absent", () => {
  const named = engine.buildCommandOutput({ name: "Ada", role: "Engineer" });
  assert.ok(
    named.commands.banner.lines[0].includes("Ada's terminal portfolio")
  );

  const anonymous = engine.buildCommandOutput(engine.createEmptyPortfolio());
  assert.ok(
    anonymous.commands.banner.lines[0].includes("my terminal portfolio")
  );
});

test("clear command is registered with a clientAction and empty lines", () => {
  const output = engine.buildCommandOutput(engine.createEmptyPortfolio());
  assert.ok(output.commands.clear);
  assert.strictEqual(output.commands.clear.clientAction, "clear");
  assert.deepStrictEqual(output.commands.clear.lines, []);
});

test("runCommand propagates clientAction for clear", () => {
  const output = engine.buildCommandOutput(engine.createEmptyPortfolio());
  const result = engine.runCommand(output, "clear");
  assert.strictEqual(result.found, true);
  assert.strictEqual(result.clientAction, "clear");
});

test("runCommand returns null clientAction for ordinary commands", () => {
  const output = engine.buildCommandOutput({ name: "Ada", role: "Engineer" });
  const result = engine.runCommand(output, "whoami");
  assert.strictEqual(result.clientAction, null);
});

test("runCommand suggests the closest command for a near-miss typo", () => {
  const output = engine.buildCommandOutput(engine.createEmptyPortfolio());
  const result = engine.runCommand(output, "skil");
  assert.strictEqual(result.found, false);
  assert.strictEqual(result.suggestion, "skills");
});

test("runCommand suggestion is null when nothing is close enough", () => {
  const output = engine.buildCommandOutput(engine.createEmptyPortfolio());
  const result = engine.runCommand(output, "xyzzyplugh");
  assert.strictEqual(result.suggestion, null);
});

test("levenshtein computes edit distance correctly", () => {
  assert.strictEqual(engine.levenshtein("skills", "skils"), 1);
  assert.strictEqual(engine.levenshtein("about", "about"), 0);
  assert.strictEqual(engine.levenshtein("", "abc"), 3);
});

test("findMatchingCommands powers tab-completion via prefix match", () => {
  const output = engine.buildCommandOutput(engine.createEmptyPortfolio());
  const matches = engine.findMatchingCommands(
    "e",
    Object.keys(output.commands)
  );
  assert.deepStrictEqual(matches, ["education", "experience"]);
});

/**
 * Issue #929: portfolioEngine.js reads window.ExportHtml.sanitizeUrl at
 * load time and exportHtml.js reads window.CradleEscape.escapeHtml. When
 * either global is missing in the browser the script falls through to its
 * Node-only require() branch and throws. Pin the document order so a future
 * reshuffle of the script tags cannot silently break the page again.
 */
test("Issue #929: index.html loads shared helpers before their consumers", () => {
  const fs = require("node:fs");
  const path = require("node:path");

  const htmlPath = path.join(
    __dirname,
    "..",
    "projects",
    "productivity",
    "terminal-portfolio-generator",
    "index.html"
  );
  const html = fs.readFileSync(htmlPath, "utf-8");

  const scriptSrcRegex = /<script\s+[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  const scriptSources = [];
  let match;
  while ((match = scriptSrcRegex.exec(html)) !== null) {
    scriptSources.push(match[1]);
  }

  const indexOf = suffix =>
    scriptSources.findIndex(src => src.endsWith(suffix));
  const escapeIdx = indexOf("escapeHtml.js");
  const exportIdx = indexOf("exportHtml.js");
  const engineIdx = indexOf("portfolioEngine.js");
  const scriptIdx = indexOf("script.js");

  assert.notEqual(
    escapeIdx,
    -1,
    "index.html must include the shared escapeHtml.js helper"
  );
  assert.notEqual(
    exportIdx,
    -1,
    'index.html must include <script src="exportHtml.js"></script>'
  );
  assert.notEqual(
    engineIdx,
    -1,
    'index.html must include <script src="portfolioEngine.js"></script>'
  );
  assert.notEqual(
    scriptIdx,
    -1,
    'index.html must include <script src="script.js"></script>'
  );

  assert.ok(
    escapeIdx < exportIdx,
    "escapeHtml.js must be loaded before exportHtml.js"
  );
  assert.ok(
    exportIdx < engineIdx,
    "exportHtml.js must be loaded before portfolioEngine.js"
  );
  assert.ok(
    engineIdx < scriptIdx,
    "portfolioEngine.js must be loaded before script.js"
  );
});
