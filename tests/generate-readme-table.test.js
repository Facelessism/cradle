const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const {
  START_MARKER,
  END_MARKER,
  escapeTableCell,
  renderProjectsTable,
  updateReadmeContent,
  validateReadmeTable,
  generateReadmeTable,
} = require("../scripts/generate-readme-table");

test("escapeTableCell escapes pipe characters and handles null/undefined", () => {
  assert.equal(escapeTableCell("Regular text"), "Regular text");
  assert.equal(escapeTableCell("With | pipe | chars"), "With \\| pipe \\| chars");
  assert.equal(escapeTableCell(null), "");
  assert.equal(escapeTableCell(undefined), "");
  assert.equal(escapeTableCell(123), "123");
});

test("renderProjectsTable generates proper markdown table structure", () => {
  const sampleProjects = [
    {
      title: "2048 Game",
      category: "games",
      path: "projects/games/2048-game/",
    },
    {
      title: "ASCII Camera",
      category: "misc",
      path: "projects/misc/ascii-camera/",
    },
  ];

  const table = renderProjectsTable(sampleProjects);
  const lines = table.split("\n");

  assert.equal(lines.length, 4); // Header, separator, and 2 data rows
  assert.match(lines[0], /^\|\s*Name\s*\|\s*Category\s*\|\s*Link\s*\|$/);
  assert.match(lines[1], /^\|\s*[-]+\s*\|\s*[-]+\s*\|\s*[-]+\s*\|$/);
  assert.match(lines[2], /2048 Game/);
  assert.match(lines[2], /\[projects\/games\/2048-game\/\]\(projects\/games\/2048-game\/\)/);
  assert.match(lines[3], /ASCII Camera/);
});

test("renderProjectsTable returns empty string for empty project list", () => {
  assert.equal(renderProjectsTable([]), "");
  assert.equal(renderProjectsTable(null), "");
});

test("updateReadmeContent replaces content between existing markers", () => {
  const initial = [
    "# Cradle",
    "",
    "## Available Projects",
    "",
    START_MARKER,
    "",
    "Old table content that should be replaced",
    "",
    END_MARKER,
    "",
    "## Getting started",
  ].join("\n");

  const newTable = "| Name | Category | Link |\n| --- | --- | --- |\n| Test | misc | [link](link) |";
  const updated = updateReadmeContent(initial, newTable);

  assert.ok(updated.includes(START_MARKER));
  assert.ok(updated.includes(END_MARKER));
  assert.ok(updated.includes(newTable));
  assert.ok(!updated.includes("Old table content that should be replaced"));
  assert.ok(updated.includes("## Getting started"));
});

test("updateReadmeContent inserts marked section if markers are not present", () => {
  const initial = [
    "# Cradle",
    "",
    "## Getting started",
    "",
    "Steps here...",
  ].join("\n");

  const table = "| Name | Category | Link |\n| --- | --- | --- |\n| Test | misc | [link](link) |";
  const updated = updateReadmeContent(initial, table);

  assert.ok(updated.includes("## Available Projects"));
  assert.ok(updated.includes(START_MARKER));
  assert.ok(updated.includes(END_MARKER));
  assert.ok(updated.includes(table));
  assert.ok(updated.indexOf("## Available Projects") < updated.indexOf("## Getting started"));
});

test("updateReadmeContent throws if start marker appears after end marker", () => {
  const malformed = `${END_MARKER}\ncontent\n${START_MARKER}`;
  assert.throws(
    () => updateReadmeContent(malformed, "table"),
    /Start marker appears after end marker/
  );
});

test("validateReadmeTable verifies synchronization correctly with mock files", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-readme-test-"));
  const projectsPath = path.join(tempDir, "projects.json");
  const readmePath = path.join(tempDir, "README.md");

  const sampleProjects = [
    {
      title: "Sample App",
      category: "productivity",
      path: "projects/productivity/sample-app/",
    },
  ];

  fs.writeFileSync(projectsPath, JSON.stringify(sampleProjects, null, 2), "utf-8");
  fs.writeFileSync(readmePath, "# Cradle\n\n## Getting started\n", "utf-8");

  // Missing markers -> fails
  const res1 = validateReadmeTable({ readmePath, projectsPath });
  assert.equal(res1.inSync, false);
  assert.ok(res1.issues.some(i => i.includes("missing marked section comments")));

  // Generate table
  generateReadmeTable({ readmePath, projectsPath });

  // Now in sync -> passes
  const res2 = validateReadmeTable({ readmePath, projectsPath });
  assert.equal(res2.inSync, true);
  assert.equal(res2.issues.length, 0);

  // Tamper with README -> fails
  const tampered = fs.readFileSync(readmePath, "utf-8").replace("Sample App", "Tampered App");
  fs.writeFileSync(readmePath, tampered, "utf-8");

  const res3 = validateReadmeTable({ readmePath, projectsPath });
  assert.equal(res3.inSync, false);
  assert.ok(res3.issues.some(i => i.includes("does not match")));
});

test("validateReadmeTable reports error when files do not exist", () => {
  const res = validateReadmeTable({
    readmePath: "/nonexistent/README.md",
    projectsPath: "/nonexistent/projects.json",
  });
  assert.equal(res.inSync, false);
  assert.ok(res.issues.some(i => i.includes("not found")));
});

test("live repository README.md is synchronized with data/projects.json", () => {
  const res = validateReadmeTable();
  assert.equal(
    res.inSync,
    true,
    `Live README.md projects table is out of sync:\n${res.issues.join("\n")}`
  );
  assert.ok(res.expectedCount > 0);
});

test("CLI --check exits 0 on valid README and 1 on stale README", () => {
  const scriptPath = path.resolve(__dirname, "../scripts/generate-readme-table.js");

  // Valid run on current repo
  const goodRun = spawnSync(process.execPath, [scriptPath, "--check"], {
    encoding: "utf-8",
  });
  assert.equal(goodRun.status, 0);
  assert.ok(goodRun.stdout.includes("fully synchronized"));

  // Run against temporary directory with tampered README
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cradle-cli-test-"));
  const dataDir = path.join(tempDir, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const tempProjects = path.join(dataDir, "projects.json");
  const tempReadme = path.join(tempDir, "README.md");

  fs.writeFileSync(tempProjects, JSON.stringify([{ title: "A", category: "misc", path: "projects/misc/a/" }]), "utf-8");
  fs.writeFileSync(tempReadme, `# Title\n\n${START_MARKER}\nwrong table\n${END_MARKER}\n`, "utf-8");

  // Run script with CRADLE_ROOT set to tempDir
  const badRun = spawnSync(process.execPath, [scriptPath, "--check"], {
    cwd: tempDir,
    env: { ...process.env, CRADLE_ROOT: tempDir },
    encoding: "utf-8",
  });
  assert.equal(badRun.status, 1);
  assert.ok(badRun.stderr.includes("check failed"));
});
