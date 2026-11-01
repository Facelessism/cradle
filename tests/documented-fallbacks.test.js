import { test } from "node:test";
import assert from "node:assert/strict";

import { filterProjects } from "../src/utils/projectSearch.js";
import { createFilterWorker } from "../src/utils/filterWorker.js";
import { isFilterRequest } from "../src/utils/messageValidation.js";
import {
  openDB,
  getCachedProjects,
  fetchAndCacheProjects,
  loadProjects,
  CradleDB,
} from "../src/utils/cradleDb.js";

/**
 * Realistic project registry for asserting search filter parity across both paths.
 */
const sampleProjects = [
  {
    id: "snake-game",
    title: "Snake Game",
    category: "games",
    description:
      "Classic retro arcade snake game where you eat food and grow longer",
  },
  {
    id: "chess",
    title: "Chess",
    category: "games",
    description:
      "Play chess against an AI opponent with customizable difficulty",
  },
  {
    id: "snake-case-converter",
    title: "Snake Case Converter",
    category: "dev-tools",
    description:
      "Convert camelCase or PascalCase strings into snake_case format",
  },
  {
    id: "regex-visualizer",
    title: "Regex Visualizer",
    category: "dev-tools",
    description:
      "Interactive visualization tool for regular expression patterns",
  },
  {
    id: "time-blocking-planner",
    title: "Time Blocking Planner",
    category: "productivity",
    description:
      "Productivity schedule planner using time blocking methodology",
  },
  {
    id: "ai-circuit-builder",
    title: "AI Circuit Builder",
    category: "aiml",
    description: "Simulate and design neural network circuits visually",
  },
  {
    id: "special-char-visualizer",
    title: "C++ & C# [Code] Visualizer (v2.0)",
    category: "dev-tools",
    description:
      "Visualizer for C++ and C# code structures with [brackets] and (parentheses)",
  },
];

/**
 * Mock Worker mirroring scripts/worker.js message protocol.
 */
class MockFilterWorker {
  constructor() {
    this.terminated = false;
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage(message) {
    if (this.terminated) return;
    if (!isFilterRequest(message)) {
      if (typeof this.onmessage === "function") this.onmessage({ data: [] });
      return;
    }
    const { allProjects, selectedCategory, query } = message;
    const result = filterProjects(allProjects, selectedCategory, query);
    if (typeof this.onmessage === "function") {
      this.onmessage({ data: result });
    }
  }

  terminate() {
    this.terminated = true;
  }
}

/**
 * Helper to dispatch search query through the Web Worker pipeline.
 */
function searchWithWorker(allProjects, selectedCategory, query) {
  return new Promise((resolve, reject) => {
    let delivered = false;
    const worker = createFilterWorker({
      workerFactory: () => new MockFilterWorker(),
      onResult: results => {
        delivered = true;
        resolve(results);
      },
      onFailure: err => {
        if (!delivered) reject(err);
      },
      logger: { error: () => {} },
    });

    const success = worker.postMessage({
      allProjects,
      selectedCategory,
      query,
    });
    if (!success) reject(new Error("Worker postMessage rejected request"));
  });
}

/**
 * Creates a mock fetch function tracking invocation counts and URLs.
 */
function createMockFetch(data = [], { ok = true, status = 200 } = {}) {
  let callCount = 0;
  const calls = [];
  const mock = async (url, options) => {
    callCount++;
    calls.push({ url, options });
    return {
      ok,
      status,
      statusText: ok ? "OK" : "Error",
      json: async () => data,
    };
  };
  mock.getCallCount = () => callCount;
  mock.getCalls = () => calls;
  return mock;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Search Filtering Fallback: Worker vs Main-Thread Parity
// ─────────────────────────────────────────────────────────────────────────────

test("Search fallback: with Worker unavailable, exact title filters match the worker path", async () => {
  const exactScenarios = [
    { category: "all", query: "Chess" },
    { category: "all", query: "Snake Game" },
    { category: "all", query: "Time Blocking Planner" },
    { category: "all", query: "Regex Visualizer" },
    { category: "all", query: "chess" }, // case-insensitive
    { category: "all", query: "SNAKE GAME" },
  ];

  for (const { category, query } of exactScenarios) {
    const workerResult = await searchWithWorker(sampleProjects, category, query);
    const fallbackResult = filterProjects(sampleProjects, category, query);

    assert.ok(Array.isArray(fallbackResult));
    assert.deepEqual(
      fallbackResult,
      workerResult,
      `Exact filter results mismatch for category="${category}", query="${query}"`
    );
  }
});

test("Search fallback: with Worker unavailable, partial title & description filters match the worker path", async () => {
  const partialScenarios = [
    { category: "all", query: "snak" },
    { category: "all", query: "ches" },
    { category: "all", query: "visua" },
    { category: "all", query: "block" },
    { category: "all", query: "retro" }, // description match
    { category: "all", query: "neural network" }, // description match
    { category: "all", query: "circuit" },
  ];

  for (const { category, query } of partialScenarios) {
    const workerResult = await searchWithWorker(sampleProjects, category, query);
    const fallbackResult = filterProjects(sampleProjects, category, query);

    assert.ok(Array.isArray(fallbackResult));
    assert.deepEqual(
      fallbackResult,
      workerResult,
      `Partial filter results mismatch for category="${category}", query="${query}"`
    );
  }
});

test("Search fallback: with Worker unavailable, category filters match the worker path", async () => {
  const categoryScenarios = [
    { category: "games", query: "" },
    { category: "dev-tools", query: "" },
    { category: "productivity", query: "" },
    { category: "aiml", query: "" },
    { category: "all", query: "" },
    { category: "nonexistent-category", query: "" },
  ];

  for (const { category, query } of categoryScenarios) {
    const workerResult = await searchWithWorker(sampleProjects, category, query);
    const fallbackResult = filterProjects(sampleProjects, category, query);

    assert.ok(Array.isArray(fallbackResult));
    assert.deepEqual(
      fallbackResult,
      workerResult,
      `Category filter results mismatch for category="${category}"`
    );
  }
});

test("Search fallback: with Worker unavailable, combined category + search filters match the worker path", async () => {
  const combinedScenarios = [
    { category: "games", query: "snake" }, // matches snake game in games
    { category: "dev-tools", query: "snake" }, // matches snake case converter in dev-tools
    { category: "productivity", query: "snake" }, // empty intersection
    { category: "games", query: "ai" }, // matches chess description in games
    { category: "dev-tools", query: "c++" }, // special characters
    { category: "dev-tools", query: "[code]" },
    { category: "all", query: ".*" },
    { category: "aiml", query: "planner" }, // empty intersection
  ];

  for (const { category, query } of combinedScenarios) {
    const workerResult = await searchWithWorker(sampleProjects, category, query);
    const fallbackResult = filterProjects(sampleProjects, category, query);

    assert.ok(Array.isArray(fallbackResult));
    assert.deepEqual(
      fallbackResult,
      workerResult,
      `Combined filter results mismatch for category="${category}", query="${query}"`
    );
  }
});

test("Search fallback: createFilterWorker handles Worker unavailability and falls back cleanly", () => {
  let failureInvoked = false;
  let failureError = null;

  class BlockedWorker {
    constructor() {
      const err = new Error("SecurityError: Worker is blocked by security policy");
      err.name = "SecurityError";
      throw err;
    }
  }

  const worker = createFilterWorker({
    workerFactory: () => new BlockedWorker(),
    onResult: () => {},
    onFailure: error => {
      failureInvoked = true;
      failureError = error;
    },
    logger: { error: () => {} },
  });

  assert.equal(worker, null, "FilterWorker must be null when worker construction fails");
  assert.equal(failureInvoked, true, "onFailure must be called on constructor failure");
  assert.equal(failureError.name, "SecurityError");

  // Main-thread synchronous filter must continue to work seamlessly
  const results = filterProjects(sampleProjects, "games", "chess");
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "chess");
});

test("Search fallback: application search pipeline seamlessly executes main-thread filtering when worker fails", () => {
  let renderedProjects = null;

  // Simulate script.js applyFilters logic:
  // When filterWorker is null (Worker unavailable), it falls back directly to filterProjects()
  let filterWorker = null;

  function runSearch(projects, category, query) {
    if (filterWorker) {
      if (filterWorker.postMessage({ allProjects: projects, selectedCategory: category, query })) {
        return;
      }
    }
    renderedProjects = filterProjects(projects, category, query);
  }

  runSearch(sampleProjects, "games", "snake");
  assert.equal(renderedProjects.length, 1);
  assert.equal(renderedProjects[0].id, "snake-game");

  runSearch(sampleProjects, "all", "C++");
  assert.equal(renderedProjects.length, 1);
  assert.equal(renderedProjects[0].id, "special-char-visualizer");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Registry Cache Fallback: IndexedDB Blocked -> Direct fetch() Fallback
// ─────────────────────────────────────────────────────────────────────────────

test("Registry cache fallback: when IndexedDB open() throws SecurityError, project list still loads via fetch()", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    const mockProjects = [
      { id: "snake-game", title: "Snake Game", category: "games" },
      { id: "chess", title: "Chess", category: "games" },
    ];
    const fetchMock = createMockFetch(mockProjects);

    const blockedIndexedDB = {
      open() {
        const err = new Error("The operation is insecure.");
        err.name = "SecurityError";
        throw err;
      },
    };

    const result = await loadProjects({
      indexedDBInstance: blockedIndexedDB,
      fetchFn: fetchMock,
      url: "./data/projects.json",
    });

    assert.equal(result.fromCache, false, "fromCache must be false when IndexedDB is blocked");
    assert.deepEqual(result.projects, mockProjects, "Projects must be loaded via network fetch fallback");
    assert.equal(result.db, null, "db must be null when IndexedDB is blocked");
    assert.equal(fetchMock.getCallCount(), 1, "fetch() must be called directly to load data/projects.json");
    assert.equal(fetchMock.getCalls()[0].url, "./data/projects.json");
  } finally {
    console.warn = originalWarn;
  }
});

test("Registry cache fallback: when IndexedDB open() throws InvalidStateError or runtime error, loads via fetch()", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    const mockProjects = [{ id: "proj-fallback", title: "Fallback Project" }];
    const fetchMock = createMockFetch(mockProjects);

    const throwingIndexedDB = {
      open() {
        throw new Error("InvalidStateError: Database is corrupted or locked");
      },
    };

    const result = await loadProjects({
      indexedDBInstance: throwingIndexedDB,
      fetchFn: fetchMock,
      url: "./data/projects.json",
    });

    assert.equal(result.fromCache, false);
    assert.deepEqual(result.projects, mockProjects);
    assert.equal(fetchMock.getCallCount(), 1);
  } finally {
    console.warn = originalWarn;
  }
});

test("Registry cache fallback: repeated visits with IndexedDB blocked consistently call fetch() on every visit", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    const mockProjects = [{ id: "proj-multi", title: "Multi Visit Project" }];
    const fetchMock = createMockFetch(mockProjects);

    const blockedIndexedDB = {
      open() {
        const err = new Error("IndexedDB is disabled in private browsing");
        err.name = "SecurityError";
        throw err;
      },
    };

    // Visit 1: fetch directly
    const visit1 = await loadProjects({
      indexedDBInstance: blockedIndexedDB,
      fetchFn: fetchMock,
    });
    assert.equal(visit1.fromCache, false);
    assert.equal(fetchMock.getCallCount(), 1, "Visit 1 must fetch from network");

    // Visit 2: fetch directly again (no persistent blocked cache)
    const visit2 = await loadProjects({
      indexedDBInstance: blockedIndexedDB,
      fetchFn: fetchMock,
    });
    assert.equal(visit2.fromCache, false);
    assert.equal(fetchMock.getCallCount(), 2, "Visit 2 must fetch directly from network on every visit");

    // Visit 3: fetch directly again
    const visit3 = await loadProjects({
      indexedDBInstance: blockedIndexedDB,
      fetchFn: fetchMock,
    });
    assert.equal(visit3.fromCache, false);
    assert.equal(fetchMock.getCallCount(), 3, "Visit 3 must fetch directly from network on every visit");
  } finally {
    console.warn = originalWarn;
  }
});

test("Registry cache fallback: script.js landing page load flow recovers from throwing IndexedDB", async () => {
  const mockProjects = [
    { id: "weather", title: "Weather App", category: "productivity" },
    { id: "monopoly", title: "Monopoly Game", category: "games" },
  ];
  const fetchMock = createMockFetch(mockProjects);

  // Simulate script.js loadProjects flow:
  // try { db = await openDB(); ... } catch (e) { ... }
  // await fetchAndCacheProjects(db);
  let loadedProjects = [];
  let loadStatusText = "";

  async function simulatedLandingPageLoad() {
    let db;
    try {
      // Simulate openDB rejecting / throwing SecurityError
      throw new Error("SecurityError: Access to IndexedDB is denied in this document");
    } catch (e) {
      // Expected catch in script.js line 316
    }

    // Falls back to direct fetchAndCacheProjects with undefined db
    const data = await fetchAndCacheProjects(db, {
      fetchFn: fetchMock,
      url: "./data/projects.json",
    });
    loadedProjects = data;
    loadStatusText = `${data.length} projects loaded.`;
  }

  await simulatedLandingPageLoad();

  assert.equal(fetchMock.getCallCount(), 1, "fetch must be called when openDB throws");
  assert.deepEqual(loadedProjects, mockProjects, "Projects must be loaded via fetch");
  assert.equal(loadStatusText, "2 projects loaded.");
});
