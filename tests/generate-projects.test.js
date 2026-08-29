const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  titleCase,
  wrapText,
  escapeXml,
  getDateAdded,
  buildProjectsRegistry,
  validateProjectsSync,
  generateProjects,
} = require("../scripts/generate-projects");

test("titleCase formats words and handles technical acronyms properly", () => {
  assert.equal(titleCase("ai-circuit-builder"), "AI Circuit Builder");
  assert.equal(titleCase("ascii-camera"), "ASCII Camera");
  assert.equal(titleCase("cpu-emulator"), "CPU Emulator");
  assert.equal(titleCase("qr-code-generator"), "QR Code Generator");
  assert.equal(titleCase("css-shape-designer"), "CSS Shape Designer");
  assert.equal(titleCase("json-converter"), "JSON Converter");
  assert.equal(titleCase("url-parser"), "URL Parser");
  assert.equal(titleCase("html-viewer"), "HTML Viewer");
  assert.equal(titleCase("csv-cleaner"), "CSV Cleaner");
  assert.equal(titleCase("2048-game"), "2048 Game");
});

test("wrapText breaks long titles into lines of appropriate width", () => {
  const singleLine = wrapText("Short Title", 20);
  assert.deepEqual(singleLine, ["Short Title"]);

  const multiLine = wrapText("This is a rather long title for a project showcase", 20);
  assert.ok(multiLine.length > 1);
  for (const line of multiLine) {
    assert.ok(line.length <= 20);
  }
});

test("escapeXml properly escapes XML special characters", () => {
  assert.equal(
    escapeXml(`A & B <tag> "quote" 'single'`),
    "A &amp; B &lt;tag&gt; &quot;quote&quot; &apos;single&apos;"
  );
});

test("buildProjectsRegistry discovers categories and projects from mock directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-registry-test-"));
  const projectsDir = path.join(root, "projects");
  const gamesDir = path.join(projectsDir, "games", "sample-game");
  const aiDir = path.join(projectsDir, "aiml", "ai-bot");

  fs.mkdirSync(gamesDir, { recursive: true });
  fs.mkdirSync(aiDir, { recursive: true });

  const { projects, errors } = buildProjectsRegistry({
    projectsDir,
    repoRoot: root,
    generateThumbnails: false,
  });

  assert.equal(errors.length, 0);
  assert.equal(projects.length, 2);

  // Alphabetically sorted by title: "AI Bot" before "Sample Game"
  assert.equal(projects[0].title, "AI Bot");
  assert.equal(projects[0].category, "aiml");
  assert.equal(projects[0].path, "projects/aiml/ai-bot/");

  assert.equal(projects[1].title, "Sample Game");
  assert.equal(projects[1].category, "games");
  assert.equal(projects[1].path, "projects/games/sample-game/");
});

test("validateProjectsSync detects missing registry file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-sync-missing-"));
  const projectsDir = path.join(root, "projects");
  const outputFile = path.join(root, "data", "projects.json");

  fs.mkdirSync(projectsDir, { recursive: true });

  const result = validateProjectsSync({
    projectsDir,
    repoRoot: root,
    outputFile,
  });

  assert.equal(result.inSync, false);
  assert.ok(result.issues.some(i => i.includes("does not exist")));
});

test("validateProjectsSync detects invalid JSON in registry file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-sync-corrupt-"));
  const projectsDir = path.join(root, "projects");
  const dataDir = path.join(root, "data");
  const outputFile = path.join(dataDir, "projects.json");

  fs.mkdirSync(projectsDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(outputFile, "{ invalid json", "utf-8");

  const result = validateProjectsSync({
    projectsDir,
    repoRoot: root,
    outputFile,
  });

  assert.equal(result.inSync, false);
  assert.ok(result.issues.some(i => i.includes("contains invalid JSON")));
});

test("validateProjectsSync detects missing project from registry (stale registry)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-sync-stale-"));
  const projectsDir = path.join(root, "projects");
  const dataDir = path.join(root, "data");
  const outputFile = path.join(dataDir, "projects.json");

  fs.mkdirSync(path.join(projectsDir, "games", "game-a"), { recursive: true });
  fs.mkdirSync(path.join(projectsDir, "games", "game-b"), { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  // Registry only contains game-a, missing game-b
  const registryData = [
    {
      title: "Game A",
      category: "games",
      path: "projects/games/game-a/",
      dateAdded: null,
    },
  ];
  fs.writeFileSync(outputFile, JSON.stringify(registryData, null, 2), "utf-8");

  const result = validateProjectsSync({
    projectsDir,
    repoRoot: root,
    outputFile,
  });

  assert.equal(result.inSync, false);
  assert.ok(result.issues.some(i => i.includes("missing from")));
});

test("validateProjectsSync detects manually modified project fields", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-sync-modified-"));
  const projectsDir = path.join(root, "projects");
  const dataDir = path.join(root, "data");
  const outputFile = path.join(dataDir, "projects.json");

  fs.mkdirSync(path.join(projectsDir, "games", "my-game"), { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  // Registry has manually altered title "Custom Altered Title" instead of "My Game"
  const registryData = [
    {
      title: "Custom Altered Title",
      category: "games",
      path: "projects/games/my-game/",
      dateAdded: null,
    },
  ];
  fs.writeFileSync(outputFile, JSON.stringify(registryData, null, 2), "utf-8");

  const result = validateProjectsSync({
    projectsDir,
    repoRoot: root,
    outputFile,
  });

  assert.equal(result.inSync, false);
  assert.ok(result.issues.some(i => i.includes("Title mismatch")));
});

test("validateProjectsSync detects out-of-order projects in registry", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-sync-order-"));
  const projectsDir = path.join(root, "projects");
  const dataDir = path.join(root, "data");
  const outputFile = path.join(dataDir, "projects.json");

  fs.mkdirSync(path.join(projectsDir, "games", "alpha-game"), { recursive: true });
  fs.mkdirSync(path.join(projectsDir, "games", "beta-game"), { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  // Out of order: Beta before Alpha
  const registryData = [
    {
      title: "Beta Game",
      category: "games",
      path: "projects/games/beta-game/",
      dateAdded: null,
    },
    {
      title: "Alpha Game",
      category: "games",
      path: "projects/games/alpha-game/",
      dateAdded: null,
    },
  ];
  fs.writeFileSync(outputFile, JSON.stringify(registryData, null, 2), "utf-8");

  const result = validateProjectsSync({
    projectsDir,
    repoRoot: root,
    outputFile,
  });

  assert.equal(result.inSync, false);
  assert.ok(result.issues.some(i => i.includes("Ordering/path mismatch")));
});

test("validateProjectsSync succeeds when registry is generated and synchronized", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-sync-success-"));
  const projectsDir = path.join(root, "projects");
  const dataDir = path.join(root, "data");
  const outputFile = path.join(dataDir, "projects.json");

  fs.mkdirSync(path.join(projectsDir, "games", "alpha-game"), { recursive: true });
  fs.mkdirSync(path.join(projectsDir, "productivity", "beta-tool"), { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  generateProjects({
    projectsDir,
    repoRoot: root,
    outputFile,
  });

  const result = validateProjectsSync({
    projectsDir,
    repoRoot: root,
    outputFile,
  });

  assert.equal(result.inSync, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.expected.length, 2);
});

test("validateProjectsSync verifies the live repository data/projects.json is synchronized", () => {
  const result = validateProjectsSync();
  assert.equal(
    result.inSync,
    true,
    `Live repository metadata is out of sync:\n` + result.issues.join("\n")
  );
});

test("buildProjectsRegistry produces identical output on repeated runs (reproducibility)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-repro-test-"));
  const projectsDir = path.join(root, "projects");
  fs.mkdirSync(path.join(projectsDir, "games", "game-a"), { recursive: true });
  fs.mkdirSync(path.join(projectsDir, "productivity", "tool-b"), { recursive: true });

  const run1 = buildProjectsRegistry({
    projectsDir,
    repoRoot: root,
    generateThumbnails: false,
  });

  const run2 = buildProjectsRegistry({
    projectsDir,
    repoRoot: root,
    generateThumbnails: false,
  });

  assert.deepEqual(run1, run2);
});

test("buildProjectsRegistry is independent of filesystem traversal order", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-order-test-"));
  const projectsDir = path.join(root, "projects");
  
  const dirsToCreate = [
    path.join(projectsDir, "games", "zebra-game"),
    path.join(projectsDir, "games", "alpha-game"),
    path.join(projectsDir, "productivity", "omega-tool"),
    path.join(projectsDir, "productivity", "beta-tool"),
  ];
  for (const dir of dirsToCreate) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const originalReaddirSync = fs.readdirSync;
  
  try {
    // Mock readdirSync returning reversed directory order to simulate different traversal
    fs.readdirSync = (dirPath, options) => {
      const result = originalReaddirSync(dirPath, options);
      return result.reverse();
    };
    
    const { projects: projects1 } = buildProjectsRegistry({
      projectsDir,
      repoRoot: root,
      generateThumbnails: false,
    });

    // Reset readdirSync to normal behavior
    fs.readdirSync = originalReaddirSync;
    
    const { projects: projects2 } = buildProjectsRegistry({
      projectsDir,
      repoRoot: root,
      generateThumbnails: false,
    });

    // Result must be identical and correctly sorted alphabetically by title
    assert.deepEqual(projects1, projects2);
    assert.equal(projects1[0].title, "Alpha Game");
    assert.equal(projects1[1].title, "Beta Tool");
    assert.equal(projects1[2].title, "Omega Tool");
    assert.equal(projects1[3].title, "Zebra Game");
  } finally {
    fs.readdirSync = originalReaddirSync;
  }
});
