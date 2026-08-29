import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Setup global mock for Web Worker global scope `self` before importing worker module
let lastPostedMessage = null;
globalThis.self = {
  onmessage: null,
  postMessage: data => {
    lastPostedMessage = data;
  },
};

// Import worker module which registers self.onmessage
await import("../scripts/worker.js");

const sampleProjects = [
  {
    id: "chess",
    title: "Chess Game",
    category: "games",
    description: "Classic chess with AI",
  },
  {
    id: "sudoku-solver",
    title: "Sudoku Solver",
    category: "games",
    description: "Interactive sudoku solver",
  },
  {
    id: "regex-visualizer",
    title: "Regex Visualizer",
    category: "dev-tools",
    description: "Visualize regular expressions",
  },
  {
    id: "time-blocking-planner",
    title: "Time Blocking Planner",
    category: "productivity",
    description: "Productivity schedule planner",
  },
  {
    id: "neural-network",
    title: "Neural Network Demo",
    category: "aiml",
    description: "Machine learning visualization",
  },
];

function runWorkerFilter({ allProjects, selectedCategory, query }) {
  lastPostedMessage = null;
  self.onmessage({
    data: {
      allProjects,
      selectedCategory,
      query,
    },
  });
  return lastPostedMessage;
}

test("worker attaches onmessage handler to self", () => {
  assert.equal(typeof self.onmessage, "function");
});

test("returns all projects when selectedCategory is 'all' and query is empty", () => {
  const result = runWorkerFilter({
    allProjects: sampleProjects,
    selectedCategory: "all",
    query: "",
  });

  assert.equal(result.length, 5);
  assert.deepEqual(result, sampleProjects);
});

test("filters projects by specific category with empty query", () => {
  const result = runWorkerFilter({
    allProjects: sampleProjects,
    selectedCategory: "games",
    query: "",
  });

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map(p => p.id),
    ["chess", "sudoku-solver"]
  );
});

test("filters projects matching title with case-insensitivity when selectedCategory is 'all'", () => {
  const result = runWorkerFilter({
    allProjects: sampleProjects,
    selectedCategory: "all",
    query: "visualizer",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "regex-visualizer");
});

test("filters projects matching slug category name via query", () => {
  const result = runWorkerFilter({
    allProjects: sampleProjects,
    selectedCategory: "all",
    query: "dev-tools",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "regex-visualizer");
});

test("filters projects matching formatted category label via query", () => {
  const result = runWorkerFilter({
    allProjects: sampleProjects,
    selectedCategory: "all",
    query: "dev tools",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "regex-visualizer");
});

test("filters projects matching category substring keyword via query", () => {
  const result = runWorkerFilter({
    allProjects: sampleProjects,
    selectedCategory: "all",
    query: "productivity",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "time-blocking-planner");
});

test("filters projects matching both category and query", () => {
  const result = runWorkerFilter({
    allProjects: sampleProjects,
    selectedCategory: "games",
    query: "chess",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "chess");
});

test("excludes project if query matches title but project belongs to different category", () => {
  const result = runWorkerFilter({
    allProjects: sampleProjects,
    selectedCategory: "productivity",
    query: "chess",
  });

  assert.equal(result.length, 0);
  assert.deepEqual(result, []);
});

test("returns empty array when query matches no project title or category", () => {
  const result = runWorkerFilter({
    allProjects: sampleProjects,
    selectedCategory: "all",
    query: "nonexistent query term 12345",
  });

  assert.equal(result.length, 0);
  assert.deepEqual(result, []);
});

test("handles empty allProjects list gracefully", () => {
  const result = runWorkerFilter({
    allProjects: [],
    selectedCategory: "all",
    query: "test",
  });

  assert.equal(result.length, 0);
  assert.deepEqual(result, []);
});

test("handles hyphens in category names correctly for multi-word categories", () => {
  const customProjects = [
    { id: "p1", title: "Tool A", category: "developer-tools" },
    { id: "p2", title: "Tool B", category: "audio-video" },
  ];

  const resultBySlug = runWorkerFilter({
    allProjects: customProjects,
    selectedCategory: "all",
    query: "developer-tools",
  });
  assert.equal(resultBySlug.length, 1);
  assert.equal(resultBySlug[0].id, "p1");

  const resultBySpace = runWorkerFilter({
    allProjects: customProjects,
    selectedCategory: "all",
    query: "developer tools",
  });
  assert.equal(resultBySpace.length, 1);
  assert.equal(resultBySpace[0].id, "p1");

  const resultByPart = runWorkerFilter({
    allProjects: customProjects,
    selectedCategory: "all",
    query: "audio",
  });
  assert.equal(resultByPart.length, 1);
  assert.equal(resultByPart[0].id, "p2");
});
