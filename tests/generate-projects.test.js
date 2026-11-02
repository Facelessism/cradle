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

  const multiLine = wrapText(
    "This is a rather long title for a project showcase",
    20
  );
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

  fs.mkdirSync(path.join(projectsDir, "games", "alpha-game"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(projectsDir, "games", "beta-game"), {
    recursive: true,
  });
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

  fs.mkdirSync(path.join(projectsDir, "games", "alpha-game"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(projectsDir, "productivity", "beta-tool"), {
    recursive: true,
  });
  fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(
    path.join(projectsDir, "games", "alpha-game", "index.html"),
    "<!doctype html><title>Alpha Game</title>",
    "utf-8"
  );
  fs.writeFileSync(
    path.join(projectsDir, "productivity", "beta-tool", "index.html"),
    "<!doctype html><title>Beta Tool</title>",
    "utf-8"
  );
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
  fs.mkdirSync(path.join(projectsDir, "productivity", "tool-b"), {
    recursive: true,
  });

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


const {
  SUPPORTED_CATEGORIES,
  PROJECT_ENTRY_SCHEMA,
  PROJECTS_REGISTRY_SCHEMA,
  validateProjectEntry,
  validateProjectsRegistry,
} = require("../scripts/generate-projects");

test("PROJECT_ENTRY_SCHEMA and PROJECTS_REGISTRY_SCHEMA define standard JSON Schema properties", () => {
  assert.equal(PROJECT_ENTRY_SCHEMA.type, "object");
  assert.deepEqual(PROJECT_ENTRY_SCHEMA.required, ["title", "category", "path"]);
  assert.deepEqual(PROJECT_ENTRY_SCHEMA.properties.category.enum, SUPPORTED_CATEGORIES);
  assert.equal(PROJECT_ENTRY_SCHEMA.additionalProperties, false);

  assert.equal(PROJECTS_REGISTRY_SCHEMA.type, "array");
  assert.equal(PROJECTS_REGISTRY_SCHEMA.items, PROJECT_ENTRY_SCHEMA);
});

test("validateProjectEntry accepts a valid project entry", () => {
  const validEntry = {
    title: "2048 Game",
    category: "games",
    path: "projects/games/2048-game/",
    dateAdded: "2026-07-17T19:22:24+05:30",
    thumbnailHash: "e6aec8e6",
  };

  const result = validateProjectEntry(validEntry, { checkDisk: false });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validateProjectEntry rejects non-object inputs gracefully without throwing", () => {
  const nonObjects = [null, undefined, "not an object", 123, true, []];

  for (const input of nonObjects) {
    const result = validateProjectEntry(input, { checkDisk: false });
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors[0].includes("Project entry must be a valid non-null object"));
  }
});

test("validateProjectEntry rejects missing required fields with actionable errors", () => {
  // Missing title
  const missingTitle = {
    category: "games",
    path: "projects/games/sample-game/",
  };
  const resTitle = validateProjectEntry(missingTitle, { checkDisk: false });
  assert.equal(resTitle.valid, false);
  assert.ok(resTitle.errors.some(e => e.includes('Missing required field "title"')));

  // Missing category
  const missingCategory = {
    title: "Sample Game",
    path: "projects/games/sample-game/",
  };
  const resCat = validateProjectEntry(missingCategory, { checkDisk: false });
  assert.equal(resCat.valid, false);
  assert.ok(resCat.errors.some(e => e.includes('Missing required field "category"')));

  // Missing path
  const missingPath = {
    title: "Sample Game",
    category: "games",
  };
  const resPath = validateProjectEntry(missingPath, { checkDisk: false });
  assert.equal(resPath.valid, false);
  assert.ok(resPath.errors.some(e => e.includes('Missing required field "path"')));
});

test("validateProjectEntry rejects empty or whitespace-only required fields", () => {
  const emptyFields = {
    title: "   ",
    category: "",
    path: "\t",
  };
  const result = validateProjectEntry(emptyFields, { checkDisk: false });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('field "title" cannot be empty')));
  assert.ok(result.errors.some(e => e.includes('field "category" cannot be empty')));
  assert.ok(result.errors.some(e => e.includes('field "path" cannot be empty')));
});

test("validateProjectEntry rejects unsupported categories with actionable list of allowed categories", () => {
  const entry = {
    title: "Custom Project",
    category: "unsupported-category",
    path: "projects/unsupported-category/custom-project/",
  };

  const result = validateProjectEntry(entry, { checkDisk: false });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('Unsupported category "unsupported-category"')));
  assert.ok(result.errors.some(e => e.includes("Supported categories are:")));
});

test("validateProjectEntry rejects invalid path formats", () => {
  // Missing projects/ prefix
  const noPrefix = {
    title: "Test",
    category: "games",
    path: "games/test/",
  };
  assert.ok(
    validateProjectEntry(noPrefix, { checkDisk: false }).errors.some(e =>
      e.includes('must begin with "projects/"')
    )
  );

  // Missing trailing slash
  const noTrailingSlash = {
    title: "Test",
    category: "games",
    path: "projects/games/test",
  };
  assert.ok(
    validateProjectEntry(noTrailingSlash, { checkDisk: false }).errors.some(e =>
      e.includes('must end with a trailing slash "/"')
    )
  );

  // Backslashes
  const backslashes = {
    title: "Test",
    category: "games",
    path: "projects\\games\\test\\",
  };
  assert.ok(
    validateProjectEntry(backslashes, { checkDisk: false }).errors.some(e =>
      e.includes("must use forward slashes")
    )
  );

  // Path traversal attempt
  const traversal = {
    title: "Test",
    category: "games",
    path: "projects/games/../secret/",
  };
  assert.ok(
    validateProjectEntry(traversal, { checkDisk: false }).errors.some(e =>
      e.includes("path traversal")
    )
  );

  // Category mismatch between path segment and category property
  const catMismatch = {
    title: "Test",
    category: "productivity",
    path: "projects/games/test/",
  };
  assert.ok(
    validateProjectEntry(catMismatch, { checkDisk: false }).errors.some(e =>
      e.includes("Path category mismatch")
    )
  );
});

test("validateProjectEntry rejects non-existent paths on disk when checkDisk is true", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-disk-check-"));
  const nonExistent = {
    title: "Ghost Project",
    category: "games",
    path: "projects/games/ghost-project/",
  };

  const result = validateProjectEntry(nonExistent, {
    repoRoot: root,
    checkDisk: true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes("Project path does not exist on disk")));
});

test("validateProjectEntry rejects unexpected additional properties (strict schema)", () => {
  const entry = {
    title: "Sample Game",
    category: "games",
    path: "projects/games/sample-game/",
    extraProp: "illegal value",
  };

  const result = validateProjectEntry(entry, { checkDisk: false });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('Unexpected additional property "extraProp"')));
});

test("validateProjectEntry validates dateAdded and thumbnailHash formats", () => {
  // Invalid dateAdded
  const badDate = {
    title: "Sample Game",
    category: "games",
    path: "projects/games/sample-game/",
    dateAdded: "not-a-valid-date-stamp",
  };
  assert.ok(
    validateProjectEntry(badDate, { checkDisk: false }).errors.some(e =>
      e.includes('Invalid "dateAdded" timestamp')
    )
  );

  // Invalid thumbnailHash (not 8 hex characters)
  const badHash = {
    title: "Sample Game",
    category: "games",
    path: "projects/games/sample-game/",
    thumbnailHash: "not-hex-or-length!",
  };
  assert.ok(
    validateProjectEntry(badHash, { checkDisk: false }).errors.some(e =>
      e.includes('Invalid "thumbnailHash"')
    )
  );
});

test("validateProjectsRegistry detects duplicate project paths and titles", () => {
  const registry = [
    {
      title: "Same Title",
      category: "games",
      path: "projects/games/game-1/",
    },
    {
      title: "Same Title",
      category: "games",
      path: "projects/games/game-2/",
    },
    {
      title: "Unique Title",
      category: "games",
      path: "projects/games/game-1/",
    },
  ];

  const result = validateProjectsRegistry(registry, { checkDisk: false });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('Duplicate project title detected: "Same Title"')));
  assert.ok(
    result.errors.some(e => e.includes('Duplicate project path detected: "projects/games/game-1/"'))
  );
});

test("generateProjects rejects output generation on schema or validation errors", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-reject-test-"));
  const projectsDir = path.join(root, "projects");
  const dataDir = path.join(root, "data");
  const outputFile = path.join(dataDir, "projects.json");

  // Create project under unsupported category
  fs.mkdirSync(path.join(projectsDir, "unsupported-cat", "bad-project"), {
    recursive: true,
  });
  fs.mkdirSync(dataDir, { recursive: true });

  assert.throws(
    () => {
      generateProjects({
        projectsDir,
        repoRoot: root,
        outputFile,
        throwOnError: true,
      });
    },
    err => {
      assert.ok(err.message.includes("Project Metadata Validation Failed"));
      assert.ok(err.message.includes("Unsupported category"));
      return true;
    }
  );

  // Ensure output file was NOT created or updated
  assert.equal(fs.existsSync(outputFile), false);
});
