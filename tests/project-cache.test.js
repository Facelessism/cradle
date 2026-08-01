const test = require("node:test");
const assert = require("node:assert");

const {
  CACHE_VERSION,
  CACHE_MAX_AGE_MS,
  CACHE_KEY,
  isUsableProject,
  sanitizeProjects,
  createCacheEntry,
  inspectCacheEntry,
  isCacheEntryValid,
  readCachedProjects,
} = require("../scripts/project-cache.js");

const NOW = 1_800_000_000_000;

const CHESS = {
  title: "Chess",
  category: "games",
  path: "projects/games/chess/",
};
const URL_PARSER = {
  title: "Url Parser",
  category: "dev-tools",
  path: "projects/dev-tools/url-parser/",
};

const freshEntry = (data = [CHESS, URL_PARSER]) => createCacheEntry(data, NOW);

test("isUsableProject requires non-empty title, category and path", () => {
  assert.ok(isUsableProject(CHESS));
  assert.ok(!isUsableProject(null));
  assert.ok(!isUsableProject({ title: "Chess", category: "games" }));
  assert.ok(!isUsableProject({ ...CHESS, path: "" }));
  assert.ok(!isUsableProject({ ...CHESS, path: 7 }));
  assert.ok(!isUsableProject({ ...CHESS, title: "" }));
});

test("sanitizeProjects drops entries the renderer cannot use", () => {
  const result = sanitizeProjects([
    CHESS,
    { title: "No path", category: "games" },
    null,
    URL_PARSER,
  ]);

  assert.deepStrictEqual(
    result.map(project => project.path),
    [CHESS.path, URL_PARSER.path]
  );
});

test("sanitizeProjects keeps additional fields such as dateAdded", () => {
  const [project] = sanitizeProjects([{ ...CHESS, dateAdded: "2026-07-30" }]);

  assert.strictEqual(project.dateAdded, "2026-07-30");
});

test("sanitizeProjects is defensive about non-array input", () => {
  assert.deepStrictEqual(sanitizeProjects(null), []);
  assert.deepStrictEqual(sanitizeProjects({}), []);
  assert.deepStrictEqual(sanitizeProjects("nope"), []);
});

test("createCacheEntry stamps the key, version and time", () => {
  const entry = createCacheEntry([CHESS], NOW);

  assert.strictEqual(entry.id, CACHE_KEY);
  assert.strictEqual(entry.version, CACHE_VERSION);
  assert.strictEqual(entry.cachedAt, NOW);
  assert.deepStrictEqual(entry.data, [CHESS]);
});

test("a fresh entry written by this version is valid", () => {
  const { valid, reason } = inspectCacheEntry(freshEntry(), { now: NOW });

  assert.strictEqual(valid, true);
  assert.strictEqual(reason, "ok");
});

test("a missing or non-object entry is a cache miss", () => {
  for (const entry of [undefined, null, "nope", 5]) {
    assert.deepStrictEqual(inspectCacheEntry(entry, { now: NOW }), {
      valid: false,
      reason: "missing",
    });
  }
});

test("an entry written under an older shape is rejected", () => {
  // Exactly what the previous implementation stored: no version, no cachedAt.
  const legacy = { id: CACHE_KEY, data: [CHESS] };

  assert.deepStrictEqual(inspectCacheEntry(legacy, { now: NOW }), {
    valid: false,
    reason: "version-mismatch",
  });
});

test("a version bump invalidates entries written by the previous version", () => {
  const entry = freshEntry();

  assert.ok(isCacheEntryValid(entry, { now: NOW }));
  assert.ok(
    !isCacheEntryValid(entry, { now: NOW, version: CACHE_VERSION + 1 })
  );
});

test("an entry older than the max age is rejected", () => {
  const entry = createCacheEntry([CHESS], NOW - CACHE_MAX_AGE_MS - 1);

  assert.deepStrictEqual(inspectCacheEntry(entry, { now: NOW }), {
    valid: false,
    reason: "expired",
  });
});

test("an entry exactly at the max age is still accepted", () => {
  const entry = createCacheEntry([CHESS], NOW - CACHE_MAX_AGE_MS);

  assert.strictEqual(isCacheEntryValid(entry, { now: NOW }), true);
});

test("an entry stamped in the future is rejected rather than never expiring", () => {
  const entry = createCacheEntry([CHESS], NOW + 60_000);

  assert.deepStrictEqual(inspectCacheEntry(entry, { now: NOW }), {
    valid: false,
    reason: "expired",
  });
});

test("an entry with a non-numeric timestamp is rejected", () => {
  for (const cachedAt of ["yesterday", null, undefined, NaN]) {
    const entry = { ...freshEntry(), cachedAt };

    assert.strictEqual(inspectCacheEntry(entry, { now: NOW }).reason, "expired");
  }
});

test("an entry holding no usable projects is rejected", () => {
  for (const data of [[], null, [null, { title: "x" }], "nope"]) {
    const entry = { ...freshEntry(), data };

    assert.deepStrictEqual(inspectCacheEntry(entry, { now: NOW }), {
      valid: false,
      reason: "empty",
    });
  }
});

test("an entry that is partly corrupt is accepted but sanitised", () => {
  const entry = createCacheEntry(
    [CHESS, { title: "Tampered", category: "games" }, URL_PARSER],
    NOW
  );
  const projects = readCachedProjects(entry, { now: NOW });

  assert.deepStrictEqual(
    projects.map(project => project.path),
    [CHESS.path, URL_PARSER.path]
  );
});

test("readCachedProjects returns null for every rejected entry", () => {
  assert.strictEqual(readCachedProjects(undefined, { now: NOW }), null);
  assert.strictEqual(
    readCachedProjects({ id: CACHE_KEY, data: [CHESS] }, { now: NOW }),
    null
  );
  assert.strictEqual(
    readCachedProjects(createCacheEntry([CHESS], 0), { now: NOW }),
    null
  );
});

test("readCachedProjects returns a copy, not the stored array", () => {
  const entry = freshEntry();
  const projects = readCachedProjects(entry, { now: NOW });

  projects.push({ title: "Injected", category: "x", path: "y/" });
  projects[0].title = "Mutated";

  assert.strictEqual(entry.data.length, 2);
  assert.strictEqual(entry.data[0].title, "Chess");
});

test("the max age is short enough to matter and long enough to be useful", () => {
  assert.ok(CACHE_MAX_AGE_MS > 60 * 60 * 1000);
  assert.ok(CACHE_MAX_AGE_MS <= 7 * 24 * 60 * 60 * 1000);
});
