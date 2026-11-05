import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterProjects,
  levenshteinDistance,
  computeRelevanceScore,
} from "../src/utils/projectSearch.js";

const sampleProjects = [
  {
    id: "chess",
    title: "Chess Game",
    category: "games",
    description: "Classic chess with AI",
  },
  {
    id: "regex",
    title: "Regex Visualizer",
    category: "dev-tools",
    description: "Visualize regular expressions",
  },
  {
    id: "planner",
    title: "Time Blocking Planner",
    category: "productivity",
    description: "Productivity schedule planner",
  },
];

test("filters by category and title using shared search rules", () => {
  assert.deepEqual(filterProjects(sampleProjects, "games", "chess"), [
    sampleProjects[0],
  ]);
});

test("filters by category and description using AND logic", () => {
  // Query "AI" matches chess description within games category
  assert.deepEqual(filterProjects(sampleProjects, "games", "ai"), [
    sampleProjects[0],
  ]);

  // Query "AI" does not match when non-matching category is selected
  assert.deepEqual(filterProjects(sampleProjects, "productivity", "ai"), []);
});

test("matches formatted category names on the main-thread fallback", () => {
  assert.deepEqual(filterProjects(sampleProjects, "all", "dev tools"), [
    sampleProjects[1],
  ]);
});

test("combines category filter and search query without resetting each other", () => {
  // Selecting games and searching for planner yields empty (different category)
  assert.deepEqual(filterProjects(sampleProjects, "games", "planner"), []);

  // Selecting productivity and searching for planner yields planner
  assert.deepEqual(filterProjects(sampleProjects, "productivity", "planner"), [
    sampleProjects[2],
  ]);
});

test("filtering with category 'games' and query 'snake' uses strict AND logic", () => {
  const projects = [
    {
      id: "snake-game",
      title: "Snake",
      category: "games",
      description: "Classic snake game",
    },
    {
      id: "snake-util",
      title: "Snake Case Converter",
      category: "dev-tools",
      description: "Convert text to snake_case",
    },
    {
      id: "chess",
      title: "Chess Game",
      category: "games",
      description: "Play chess",
    },
  ];

  // In category "games", only the game with snake in title/description is matched
  assert.deepEqual(filterProjects(projects, "games", "snake"), [projects[0]]);

  // Non-matching category with snake query does not return the snake game
  assert.deepEqual(filterProjects(projects, "productivity", "snake"), []);

  // Category "dev-tools" with snake query only returns dev-tools project
  assert.deepEqual(filterProjects(projects, "dev-tools", "snake"), [
    projects[1],
  ]);
});

test("returns all projects when no filters are active", () => {
  assert.deepEqual(filterProjects(sampleProjects, "all", ""), sampleProjects);
});

test("selecting category 'games' and then typing query 's' retains category and filters with AND logic", () => {
  const projects = [
    {
      id: "sudoku",
      title: "Sudoku Solver",
      category: "games",
      description: "Solve sudoku puzzles",
    },
    {
      id: "snake",
      title: "Snake",
      category: "games",
      description: "Classic retro arcade snake",
    },
    {
      id: "chess",
      title: "Chess",
      category: "games",
      description: "Play chess",
    },
    {
      id: "diff",
      title: "Text Diff Checker",
      category: "dev-tools",
      description: "Compare text strings",
    },
    {
      id: "stopwatch",
      title: "Stopwatch",
      category: "productivity",
      description: "Measure seconds",
    },
  ];

  // User selects Games category first
  const gamesOnly = filterProjects(projects, "games", "");
  assert.equal(gamesOnly.length, 3);
  assert.deepEqual(
    gamesOnly.map(p => p.id),
    ["sudoku", "snake", "chess"]
  );

  // User then types 's' into search bar while Games is selected
  const gamesWithS = filterProjects(projects, "games", "s");
  // All 3 games contain 's' in title or description; dev-tools and productivity projects with 's' are excluded
  assert.equal(gamesWithS.length, 3);
  assert.deepEqual(
    gamesWithS.map(p => p.id),
    ["sudoku", "snake", "chess"]
  );

  // User types 'snake' into search bar
  const snakeGame = filterProjects(projects, "games", "snake");
  assert.equal(snakeGame.length, 1);
  assert.equal(snakeGame[0].id, "snake");

  // Handles capitalized category 'Games' cleanly
  const capitalizedGames = filterProjects(projects, "Games", "snake");
  assert.equal(capitalizedGames.length, 1);
  assert.equal(capitalizedGames[0].id, "snake");
});

test("typing query first and then selecting category retains query and applies category filter", () => {
  const projects = [
    {
      id: "sudoku",
      title: "Sudoku Solver",
      category: "games",
      description: "Solve sudoku puzzles",
    },
    {
      id: "code",
      title: "Code Formatter",
      category: "dev-tools",
      description: "Format source code",
    },
    {
      id: "notes",
      title: "Quick Notes",
      category: "productivity",
      description: "Take quick notes",
    },
  ];

  // User types 'code' first across all categories
  const allWithCode = filterProjects(projects, "all", "code");
  assert.equal(allWithCode.length, 1);
  assert.equal(allWithCode[0].id, "code");

  // User then clicks 'games' category: query 'code' is preserved, no games match 'code'
  const gamesWithCode = filterProjects(projects, "games", "code");
  assert.equal(gamesWithCode.length, 0);

  // User clicks 'dev-tools' category: query 'code' is preserved and matches Code Formatter
  const devToolsWithCode = filterProjects(projects, "dev-tools", "code");
  assert.equal(devToolsWithCode.length, 1);
  assert.equal(devToolsWithCode[0].id, "code");
});

test("levenshteinDistance computes string editing distance accurately", () => {
  assert.equal(levenshteinDistance("snake", "snake"), 0);
  assert.equal(levenshteinDistance("snak", "snake"), 1); // insertion
  assert.equal(levenshteinDistance("snakes", "snake"), 1); // deletion
  assert.equal(levenshteinDistance("snakk", "snake"), 1); // substitution
  assert.equal(levenshteinDistance("snk", "snake"), 2);
  assert.equal(levenshteinDistance("", "test"), 4);
});

test("ranks exact title match > prefix match > tag match > description fuzzy match", () => {
  const rankingProjects = [
    {
      id: "fuzzy-desc",
      title: "Audio Workstation",
      category: "productivity",
      description: "Music composer with virtual guitarr synthesizer",
    },
    {
      id: "desc-match",
      title: "Sound Studio",
      category: "productivity",
      description: "Acoustic guitar recording workspace",
    },
    {
      id: "tag-match",
      title: "String Instrument Player",
      category: "productivity",
      description: "Virtual strings synthesizer",
      tags: ["guitar"],
    },
    {
      id: "prefix-match",
      title: "Guitar Tuner Pro",
      category: "productivity",
      description: "Precision tuning tool",
    },
    {
      id: "exact-match",
      title: "Guitar",
      category: "productivity",
      description: "Interactive instrument simulator",
    },
  ];

  const results = filterProjects(rankingProjects, "productivity", "guitar");
  assert.equal(results.length, 5);
  assert.deepEqual(
    results.map(p => p.id),
    [
      "exact-match",
      "prefix-match",
      "tag-match",
      "desc-match",
      "fuzzy-desc",
    ]
  );
});

test("tolerates single-character typos for query terms over 4 letters", () => {
  const projects = [
    {
      id: "snake-game",
      title: "Snake Game",
      category: "games",
      description: "Retro arcade classic",
    },
    {
      id: "chess",
      title: "Chess",
      category: "games",
      description: "Board strategy against AI",
    },
    {
      id: "planner",
      title: "Time Blocking Planner",
      category: "productivity",
      description: "Schedule your hours",
      tags: ["calendar", "organizer"],
    },
  ];

  // "snakk" (length 5 > 4) distance 1 to "snake"
  const snakeMatch = filterProjects(projects, "all", "snakk");
  assert.equal(snakeMatch.length, 1);
  assert.equal(snakeMatch[0].id, "snake-game");

  // "plannr" (length 6 > 4) distance 1 to "planner"
  const plannerMatch = filterProjects(projects, "all", "plannr");
  assert.equal(plannerMatch.length, 1);
  assert.equal(plannerMatch[0].id, "planner");

  // "organizr" (length 8 > 4) distance 1 to tag "organizer"
  const tagFuzzyMatch = filterProjects(projects, "all", "organizr");
  assert.equal(tagFuzzyMatch.length, 1);
  assert.equal(tagFuzzyMatch[0].id, "planner");

  // "chezz" distance 2 to "chess" does NOT match
  const noMatchDistance2 = filterProjects(projects, "all", "chezz");
  assert.equal(noMatchDistance2.length, 0);
});

test("does not trigger fuzzy matching for short terms of 4 or fewer letters", () => {
  const projects = [
    {
      id: "game",
      title: "2048 Game",
      category: "games",
      description: "Slide tiles",
    },
    {
      id: "snake",
      title: "Snake",
      category: "games",
      description: "Eat apples",
    },
  ];

  // "gme" (length 3 <= 4) does NOT match "game" via typo tolerance
  const gmeMatch = filterProjects(projects, "all", "gme");
  assert.equal(gmeMatch.length, 0);

  // "snk" (length 3 <= 4) does NOT match "snake" via typo tolerance
  const snkMatch = filterProjects(projects, "all", "snk");
  assert.equal(snkMatch.length, 0);

  // Exact substring for short query still works
  const gamMatch = filterProjects(projects, "all", "gam");
  assert.equal(gamMatch.length, 1);
  assert.equal(gamMatch[0].id, "game");
});
