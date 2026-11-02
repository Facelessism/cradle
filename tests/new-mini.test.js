const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  isValidSlug,
  isValidCategory,
  checkProjectExists,
  buildArchitectureDoc,
  buildHtml,
  buildCss,
  buildJs,
  createMini,
  parseArgs,
} = require("../scripts/new-mini.js");

const { SUPPORTED_CATEGORIES } = require("../scripts/generate-projects.js");

const {
  validateArchitectureStructure,
} = require("../scripts/validate-architecture-docs.js");

const {
  validateStandardProjectFiles,
  validateProjectNavigation,
  validateProjectFavicons,
  validateProjectTitles,
} = require("../scripts/validate-mini-projects.js");

/* -------------------------------------------------------------------------- */
/* Slug Validation Unit Tests                                                 */
/* -------------------------------------------------------------------------- */

test("isValidSlug accepts valid lowercase alphanumeric hyphenated slugs", () => {
  const validSlugs = [
    "snake",
    "snake-game",
    "2048-game",
    "super-mario-bros",
    "ai-circuit-builder",
    "quick-math-123",
    "tool-v2",
    "a-b-c",
    "game1",
    "123-game",
  ];

  for (const slug of validSlugs) {
    assert.equal(isValidSlug(slug), true, `Expected "${slug}" to be valid`);
  }
});

test("isValidSlug rejects invalid slugs", () => {
  const invalidSlugs = [
    "",
    "   ",
    "Snake",
    "snakeGame",
    "SNAKE_GAME",
    "snake_game",
    "snake game",
    "-snake",
    "snake-",
    "-snake-",
    "snake--game",
    "snake---game",
    "snake/game",
    "snake\\game",
    "snake.game",
    "snake@game",
    "snake#game",
    "snake$game",
    "snake?game",
    " snake-game",
    "snake-game ",
    "snake\tgame",
    "snake\ngame",
    null,
    undefined,
    12345,
    {},
    [],
    true,
  ];

  for (const slug of invalidSlugs) {
    assert.equal(isValidSlug(slug), false, `Expected "${slug}" to be rejected`);
  }
});

/* -------------------------------------------------------------------------- */
/* Category Validation Unit Tests                                             */
/* -------------------------------------------------------------------------- */

test("isValidCategory accepts all approved Cradle categories", () => {
  for (const category of SUPPORTED_CATEGORIES) {
    assert.equal(
      isValidCategory(category),
      true,
      `Expected category "${category}" to be valid`
    );
  }
});

test("isValidCategory rejects invalid or non-string categories", () => {
  const invalidCategories = [
    "",
    "game",
    "games2",
    "random",
    "GAMES",
    "tools",
    null,
    undefined,
    123,
    {},
  ];

  for (const cat of invalidCategories) {
    assert.equal(
      isValidCategory(cat),
      false,
      `Expected category "${cat}" to be rejected`
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Existing Name Checking Unit Tests                                          */
/* -------------------------------------------------------------------------- */

test("checkProjectExists detects existing projects across categories", () => {
  const result = checkProjectExists("snake-game");
  assert.equal(result.exists, true);
  assert.equal(result.category, "games");

  const notFound = checkProjectExists("definitely-non-existent-mini-slug-9999");
  assert.equal(notFound.exists, false);
});

/* -------------------------------------------------------------------------- */
/* CLI Argument Parsing Unit Tests                                            */
/* -------------------------------------------------------------------------- */

test("parseArgs parses positional arguments correctly", () => {
  assert.deepEqual(parseArgs(["games", "space-invaders"]), {
    category: "games",
    name: "space-invaders",
  });
});

test("parseArgs parses flag arguments correctly", () => {
  assert.deepEqual(
    parseArgs(["--category", "productivity", "--name", "task-timer"]),
    {
      category: "productivity",
      name: "task-timer",
    }
  );

  assert.deepEqual(parseArgs(["-c", "math", "-n", "matrix-calc"]), {
    category: "math",
    name: "matrix-calc",
  });
});

/* -------------------------------------------------------------------------- */
/* File Content Generators Unit Tests                                         */
/* -------------------------------------------------------------------------- */

test("buildHtml generates accessible markup with theme toggle and back to home", () => {
  const html = buildHtml("Space Invaders");

  assert.ok(html.includes("<title>Space Invaders</title>"));
  assert.ok(html.includes('href="../../../assets/favicon.svg"'));
  assert.ok(html.includes("data-cradle-theme-toggle"));
  assert.ok(html.includes('aria-label="Toggle theme"'));
  assert.ok(html.includes('aria-label="Back to Home"'));
  assert.ok(html.includes("BackToHome.js"));
  assert.ok(html.includes("ThemeToggle.js"));
  assert.ok(html.includes("storage.js"));
  assert.ok(html.includes("tokens.css"));
});

test("buildCss generates clean stylesheet referencing tokens", () => {
  const css = buildCss("Space Invaders");

  assert.ok(css.includes("Space Invaders"));
  assert.ok(css.includes("var(--cradle-bg"));
  assert.ok(css.includes("var(--cradle-text"));
  assert.ok(css.includes(".mini-header"));
  assert.ok(css.includes(".back-link"));
});

test("buildJs generates clean starter script", () => {
  const js = buildJs("Space Invaders");

  assert.ok(js.includes("Space Invaders"));
  assert.ok(js.includes("DOMContentLoaded"));
});

/* -------------------------------------------------------------------------- */
/* End-to-End Scaffolding and Healthcheck Compatibility Unit Tests             */
/* -------------------------------------------------------------------------- */

test("createMini rejects invalid category and slug with clear error messages", async () => {
  await assert.rejects(
    () => createMini({ category: "invalid-cat", name: "good-slug" }),
    /Invalid category "invalid-cat"/
  );

  await assert.rejects(
    () => createMini({ category: "games", name: "Bad_Slug" }),
    /Invalid project slug "Bad_Slug"/
  );
});

test("createMini rejects already existing project names", async () => {
  await assert.rejects(
    () => createMini({ category: "games", name: "snake-game" }),
    /A project named "snake-game" already exists/
  );
});

test("createMini scaffolds a complete, valid mini compliant with healthcheck", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-mini-test-"));
  const tmpProjectsDir = path.join(tmpRoot, "projects");
  const templatePath = path.resolve(__dirname, "../ARCHITECTURE_TEMPLATE.md");

  try {
    fs.mkdirSync(path.join(tmpProjectsDir, "games"), { recursive: true });

    const result = await createMini({
      category: "games",
      name: "retro-racer",
      repoRoot: tmpRoot,
      projectsDir: tmpProjectsDir,
      templateFile: templatePath,
      skipGenerate: true,
    });

    assert.equal(result.title, "Retro Racer");
    assert.equal(result.relPath, "projects/games/retro-racer/");

    // Verify all 4 required files exist
    const indexPath = path.join(result.projectDir, "index.html");
    const cssPath = path.join(result.projectDir, "style.css");
    const jsPath = path.join(result.projectDir, "script.js");
    const archPath = path.join(result.projectDir, "ARCHITECTURE.md");

    assert.ok(fs.existsSync(indexPath), "index.html should exist");
    assert.ok(fs.existsSync(cssPath), "style.css should exist");
    assert.ok(fs.existsSync(jsPath), "script.js should exist");
    assert.ok(fs.existsSync(archPath), "ARCHITECTURE.md should exist");

    // Add a dummy thumbnail.svg in the test directory to test file validators
    fs.writeFileSync(
      path.join(result.projectDir, "thumbnail.svg"),
      "<svg></svg>"
    );

    // 1. Architecture structure validation
    const archIssues = validateArchitectureStructure([result.projectDir]);
    assert.deepEqual(
      archIssues,
      [],
      "ARCHITECTURE.md must pass architecture validation with 0 issues"
    );

    // 2. Mini project file and entry point validations
    const diskProject = {
      name: "retro-racer",
      category: "games",
      title: "Retro Racer",
      relPath: "projects/games/retro-racer/",
      absPath: result.projectDir,
    };

    const fileIssues = validateStandardProjectFiles([diskProject]);
    assert.deepEqual(
      fileIssues,
      [],
      "All standard project files must be present"
    );

    const navIssues = validateProjectNavigation([diskProject]);
    assert.deepEqual(navIssues, [], "Project navigation must be recognized");

    const titleIssues = validateProjectTitles([diskProject]);
    assert.deepEqual(titleIssues, [], "Project title must be recognized");
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
