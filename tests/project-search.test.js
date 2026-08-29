import { test } from "node:test";
import assert from "node:assert/strict";
import { filterProjects } from "../src/utils/projectSearch.js";

const sampleProjects = [
  { id: "chess", title: "Chess Game", category: "games" },
  { id: "regex", title: "Regex Visualizer", category: "dev-tools" },
  { id: "planner", title: "Time Blocking Planner", category: "productivity" },
];

test("filters by category and title using shared search rules", () => {
  assert.deepEqual(
    filterProjects(sampleProjects, "games", "chess"),
    [sampleProjects[0]]
  );
});

test("matches formatted category names on the main-thread fallback", () => {
  assert.deepEqual(
    filterProjects(sampleProjects, "all", "dev tools"),
    [sampleProjects[1]]
  );
});

test("returns all projects when no filters are active", () => {
  assert.deepEqual(filterProjects(sampleProjects, "all", ""), sampleProjects);
});
