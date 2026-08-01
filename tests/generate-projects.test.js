const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  titleCase,
  wrapText,
  escapeXml,
  buildSvgThumbnail,
  writeSvgThumbnail,
  CATEGORY_STYLES,
} = require("../scripts/generate-projects.js");

function makeTempProjectDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cradle-thumb-"));
}

test("escapeXml escapes every XML-significant character", () => {
  assert.strictEqual(
    escapeXml(`<a href="x" & 'y'>`),
    "&lt;a href=&quot;x&quot; &amp; &apos;y&apos;&gt;"
  );
});

test("escapeXml is defensive about non-string input", () => {
  assert.strictEqual(escapeXml(null), "");
  assert.strictEqual(escapeXml(undefined), "");
  assert.strictEqual(escapeXml(42), "42");
});

test("titleCase converts folder names into display titles", () => {
  assert.strictEqual(titleCase("memory-flip-game"), "Memory Flip Game");
  assert.strictEqual(titleCase("brain_dump_collector"), "Brain Dump Collector");
});

test("wrapText never exceeds the requested width when words allow it", () => {
  const lines = wrapText("Terminal Portfolio Generator", 20);

  assert.ok(lines.length > 1);
  lines.forEach(line => assert.ok(line.length <= 20, `too long: "${line}"`));
  assert.strictEqual(lines.join(" "), "Terminal Portfolio Generator");
});

test("wrapText keeps an over-long single word on its own line", () => {
  assert.deepStrictEqual(wrapText("Supercalifragilistic", 10), [
    "Supercalifragilistic",
  ]);
});

test("buildSvgThumbnail is pure — same inputs give byte-identical output", () => {
  const a = buildSvgThumbnail("Chess", "games");
  const b = buildSvgThumbnail("Chess", "games");

  assert.strictEqual(a, b);
});

test("buildSvgThumbnail applies the category palette", () => {
  const svg = buildSvgThumbnail("Chess", "games");

  assert.ok(svg.includes(CATEGORY_STYLES.games.accent));
  assert.ok(svg.includes(CATEGORY_STYLES.games.bgStart));
});

test("buildSvgThumbnail falls back to the default palette for unknown categories", () => {
  const svg = buildSvgThumbnail("Something", "not-a-real-category");

  assert.ok(!svg.includes(CATEGORY_STYLES.games.accent));
  assert.ok(svg.includes("NOT-A-REAL-CATEGORY"));
});

test("buildSvgThumbnail escapes the project title", () => {
  const svg = buildSvgThumbnail("Tom & <Jerry>", "games");

  assert.ok(svg.includes("&amp;"));
  assert.ok(!svg.includes("<Jerry>"));
});

test("buildSvgThumbnail escapes the category badge label", () => {
  const svg = buildSvgThumbnail("Demo", "a&b");

  assert.ok(svg.includes("A&amp;B"));
  assert.ok(
    !/>A&B</.test(svg),
    "raw ampersand in the badge would produce malformed XML"
  );
});

test("writeSvgThumbnail creates a missing thumbnail", () => {
  const dir = makeTempProjectDir();

  try {
    const result = writeSvgThumbnail("Chess", "games", dir);
    const written = fs.readFileSync(path.join(dir, "thumbnail.svg"), "utf-8");

    assert.strictEqual(result, "created");
    assert.strictEqual(written, buildSvgThumbnail("Chess", "games"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("writeSvgThumbnail is idempotent — a second run reports unchanged", () => {
  const dir = makeTempProjectDir();

  try {
    writeSvgThumbnail("Chess", "games", dir);
    assert.strictEqual(writeSvgThumbnail("Chess", "games", dir), "unchanged");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("writeSvgThumbnail refreshes a stale thumbnail even when its mtime is newer", () => {
  const dir = makeTempProjectDir();
  const thumbnailPath = path.join(dir, "thumbnail.svg");

  try {
    // A thumbnail produced by an older generator: correct filename, wrong
    // contents. Its mtime is deliberately far in the future so the previous
    // mtime-based heuristic would have skipped it.
    fs.writeFileSync(thumbnailPath, "<svg><!-- generated last year --></svg>");
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    fs.utimesSync(thumbnailPath, future, future);

    const result = writeSvgThumbnail("Chess", "games", dir);

    assert.strictEqual(result, "updated");
    assert.strictEqual(
      fs.readFileSync(thumbnailPath, "utf-8"),
      buildSvgThumbnail("Chess", "games")
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("writeSvgThumbnail regenerates when the title changes", () => {
  const dir = makeTempProjectDir();

  try {
    writeSvgThumbnail("Old Title", "games", dir);
    assert.strictEqual(writeSvgThumbnail("New Title", "games", dir), "updated");
    assert.ok(
      fs.readFileSync(path.join(dir, "thumbnail.svg"), "utf-8").includes("New")
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("writeSvgThumbnail regenerates when the category palette changes", () => {
  const dir = makeTempProjectDir();

  try {
    writeSvgThumbnail("Demo", "games", dir);
    assert.strictEqual(
      writeSvgThumbnail("Demo", "productivity", dir),
      "updated"
    );
    assert.ok(
      fs
        .readFileSync(path.join(dir, "thumbnail.svg"), "utf-8")
        .includes(CATEGORY_STYLES.productivity.accent)
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("writeSvgThumbnail rewrites unchanged content when force is set", () => {
  const dir = makeTempProjectDir();

  try {
    writeSvgThumbnail("Chess", "games", dir);
    assert.strictEqual(
      writeSvgThumbnail("Chess", "games", dir, { force: true }),
      "updated"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("every checked-in thumbnail matches what the generator produces", () => {
  const projectsJson = require("../data/projects.json");
  const repoRoot = path.resolve(__dirname, "..");
  const stale = [];

  for (const project of projectsJson) {
    const thumbnailPath = path.join(repoRoot, project.path, "thumbnail.svg");
    if (!fs.existsSync(thumbnailPath)) {
      stale.push(`${project.path}thumbnail.svg (missing)`);
      continue;
    }

    const expected = buildSvgThumbnail(project.title, project.category);
    if (fs.readFileSync(thumbnailPath, "utf-8") !== expected) {
      stale.push(`${project.path}thumbnail.svg (stale)`);
    }
  }

  assert.deepStrictEqual(
    stale,
    [],
    `Run "npm run generate" to refresh:\n  ${stale.join("\n  ")}`
  );
});
