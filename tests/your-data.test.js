"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const storagePath = path.resolve(__dirname, "../src/components/ui/storage.js");

class MockStorage {
  constructor({ failWrites = false } = {}) {
    this.data = new Map();
    this.failWrites = failWrites;
  }
  get length() {
    return this.data.size;
  }
  key(index) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  getItem(key) {
    return this.data.has(String(key)) ? this.data.get(String(key)) : null;
  }
  setItem(key, value) {
    if (this.failWrites) throw new Error("storage unavailable");
    this.data.set(String(key), String(value));
  }
  removeItem(key) {
    this.data.delete(String(key));
  }
  clear() {
    this.data.clear();
  }
}

function loadFreshStorage({ localStorage } = {}) {
  delete require.cache[storagePath];
  const previous = global.localStorage;
  if (localStorage === undefined) delete global.localStorage;
  else global.localStorage = localStorage;
  const storage = require(storagePath);
  return {
    storage,
    restore() {
      delete require.cache[storagePath];
      if (previous === undefined) delete global.localStorage;
      else global.localStorage = previous;
    },
  };
}

test("calculateByteSize and formatBytes estimate storage footprint accurately", () => {
  const { storage, restore } = loadFreshStorage({
    localStorage: new MockStorage(),
  });
  try {
    // 4 chars + 8 chars = 12 chars * 2 = 24 bytes UTF-16
    assert.equal(storage.calculateByteSize("user", "john_doe"), 24);
    assert.equal(storage.formatBytes(0), "0 B");
    assert.equal(storage.formatBytes(500), "500 B");
    assert.equal(storage.formatBytes(2048), "2.00 KB");
    assert.equal(storage.formatBytes(2 * 1024 * 1024), "2.00 MB");
  } finally {
    restore();
  }
});

test("identifyMini correctly maps keys to minis and ignores non-mini / unrelated keys", () => {
  const { storage, restore } = loadFreshStorage({
    localStorage: new MockStorage(),
  });
  try {
    // Known minis
    assert.deepEqual(storage.identifyMini("cradle_2048_best_score_4x4"), {
      id: "2048-game",
      title: "2048 Game",
    });
    assert.deepEqual(storage.identifyMini("cradle_rps_stats"), {
      id: "stone-paper-scissors-game",
      title: "Stone Paper Scissors Game",
    });
    assert.deepEqual(storage.identifyMini("cradle_tb_planner_2026-11-03"), {
      id: "time-blocking-planner",
      title: "Time Blocking Planner",
    });
    assert.deepEqual(storage.identifyMini("cradle_snake_high_score"), {
      id: "snake-game",
      title: "Snake Game",
    });
    assert.deepEqual(storage.identifyMini("cradle:typing-racer-best-wpm"), {
      id: "typing-speed-racer",
      title: "Typing Speed Racer",
    });

    // Custom mini written with cradle_ prefix
    assert.deepEqual(storage.identifyMini("cradle_testmini_high_score"), {
      id: "testmini",
      title: "Testmini",
    });

    // Landing page & system internal keys MUST be ignored
    assert.equal(storage.identifyMini("theme"), null);
    assert.equal(storage.identifyMini("cradle_theme"), null);
    assert.equal(storage.identifyMini("cradle:recent-projects"), null);
    assert.equal(
      storage.identifyMini("cradle:recent-projects-collapsed"),
      null
    );
    assert.equal(storage.identifyMini("__cradle_storage_probe__"), null);

    // Unrelated localStorage keys MUST be ignored
    assert.equal(storage.identifyMini("session_token"), null);
    assert.equal(storage.identifyMini("user_preferences"), null);
    assert.equal(storage.identifyMini("analytics_id"), null);
    assert.equal(storage.identifyMini(""), null);
    assert.equal(storage.identifyMini(null), null);
  } finally {
    restore();
  }
});

test("getStoredMinisData groups stored keys by mini with approximate sizes", () => {
  const mock = new MockStorage();
  const { storage, restore } = loadFreshStorage({ localStorage: mock });
  try {
    // Populate keys for 2048 Game
    storage.set("cradle_2048_best_score_4x4", 2048);
    storage.set("cradle_2048_game_state_4x4", { score: 100, over: false });

    // Populate key for Stone Paper Scissors
    storage.set("cradle_rps_stats", { wins: 5, losses: 2 });

    // Populate an unrelated key in localStorage
    mock.setItem("unrelated_auth_token", "secret123");
    mock.setItem("theme", "dark");

    const data = storage.getStoredMinisData();
    assert.equal(data.length, 2);

    // Sorted alphabetically: "2048 Game" before "Stone Paper Scissors Game"
    const game2048 = data[0];
    assert.equal(game2048.id, "2048-game");
    assert.equal(game2048.title, "2048 Game");
    assert.equal(game2048.keys.length, 2);
    assert.ok(game2048.totalBytes > 0);
    assert.ok(
      game2048.formattedTotalSize.includes("B") ||
        game2048.formattedTotalSize.includes("KB")
    );

    const rps = data[1];
    assert.equal(rps.id, "stone-paper-scissors-game");
    assert.equal(rps.title, "Stone Paper Scissors Game");
    assert.equal(rps.keys.length, 1);
    assert.equal(rps.keys[0].key, "cradle_rps_stats");

    // Unrelated keys and theme are NOT included in the mini groups
    const allGroupedKeys = data.flatMap(m => m.keys.map(k => k.key));
    assert.ok(!allGroupedKeys.includes("unrelated_auth_token"));
    assert.ok(!allGroupedKeys.includes("theme"));
  } finally {
    restore();
  }
});

test("clearMini removes only keys for the specified mini without affecting others", () => {
  const mock = new MockStorage();
  const { storage, restore } = loadFreshStorage({ localStorage: mock });
  try {
    // Set data for mini A (2048) and mini B (RPS)
    storage.set("cradle_2048_best_score_4x4", 1024);
    storage.set("cradle_2048_game_state_4x4", { score: 50 });
    storage.set("cradle_rps_stats", { wins: 3 });

    // Set unrelated key
    mock.setItem("foreign_key", "must_preserve");

    // Clear only 2048
    const removedCount = storage.clearMini("2048-game");
    assert.equal(removedCount, 2);

    // 2048 keys are removed
    assert.equal(storage.get("cradle_2048_best_score_4x4"), null);
    assert.equal(storage.get("cradle_2048_game_state_4x4"), null);

    // RPS keys remain intact!
    assert.deepEqual(storage.get("cradle_rps_stats"), { wins: 3 });

    // Foreign key remains intact!
    assert.equal(mock.getItem("foreign_key"), "must_preserve");

    const dataAfter = storage.getStoredMinisData();
    assert.equal(dataAfter.length, 1);
    assert.equal(dataAfter[0].id, "stone-paper-scissors-game");
  } finally {
    restore();
  }
});

test("clearMini accepts mini title as well as mini id", () => {
  const mock = new MockStorage();
  const { storage, restore } = loadFreshStorage({ localStorage: mock });
  try {
    storage.set("cradle_snake_high_score", 99);
    assert.equal(storage.clearMini("Snake Game"), 1);
    assert.equal(storage.get("cradle_snake_high_score"), null);
  } finally {
    restore();
  }
});

test("clearAllMinis removes all mini data but never removes unrelated localStorage keys", () => {
  const mock = new MockStorage();
  const { storage, restore } = loadFreshStorage({ localStorage: mock });
  try {
    // Multiple minis
    storage.set("cradle_2048_best_score", 500);
    storage.set("cradle_rps_stats", { wins: 1 });
    storage.set("cradle_cannon_stats", { score: 10 });

    // Unrelated localStorage keys and landing page settings
    mock.setItem("analytics_uuid", "123-abc");
    mock.setItem("session_cookie", "active");
    mock.setItem("theme", "light");
    mock.setItem("cradle:recent-projects", JSON.stringify([{ title: "2048" }]));

    const removed = storage.clearAllMinis();
    assert.equal(removed, 3);

    // All mini data removed
    assert.equal(storage.get("cradle_2048_best_score"), null);
    assert.equal(storage.get("cradle_rps_stats"), null);
    assert.equal(storage.get("cradle_cannon_stats"), null);
    assert.equal(storage.getStoredMinisData().length, 0);

    // UNRELATED KEYS AND THEME ARE COMPLETELY INTACT!
    assert.equal(mock.getItem("analytics_uuid"), "123-abc");
    assert.equal(mock.getItem("session_cookie"), "active");
    assert.equal(mock.getItem("theme"), "light");
    assert.equal(
      mock.getItem("cradle:recent-projects"),
      JSON.stringify([{ title: "2048" }])
    );
  } finally {
    restore();
  }
});

test("Your data features keep working when storage falls back to memoryStore", () => {
  // When localStorage is undefined (e.g. restrictive/private environment)
  const { storage, restore } = loadFreshStorage({ localStorage: undefined });
  try {
    assert.equal(storage.isAvailable(), false);

    // Store data in memoryStore
    storage.set("cradle_2048_best_score_4x4", 512);
    storage.set("cradle_tb_planner_today", { blocks: [] });

    const data = storage.getStoredMinisData();
    assert.equal(data.length, 2);
    assert.equal(data[0].id, "2048-game");
    assert.equal(data[1].id, "time-blocking-planner");

    // Clear one mini in memoryStore
    const cleared = storage.clearMini("2048-game");
    assert.equal(cleared, 1);
    assert.equal(storage.get("cradle_2048_best_score_4x4"), null);
    assert.deepEqual(storage.get("cradle_tb_planner_today"), { blocks: [] });

    // Clear all minis in memoryStore
    storage.clearAllMinis();
    assert.equal(storage.getStoredMinisData().length, 0);
  } finally {
    restore();
  }
});

test("Dynamic namespaces created through CradleStorage.namespace are tracked and clearable", () => {
  const mock = new MockStorage();
  const { storage, restore } = loadFreshStorage({ localStorage: mock });
  try {
    const customStore = storage.namespace("cradle_custompuzzle_", {
      id: "custom-puzzle",
      title: "Custom Puzzle",
    });
    const otherStore = storage.namespace("cradle_othergame_", {
      id: "other-game",
      title: "Other Game",
    });

    customStore.set("level", 5);
    otherStore.set("level", 10);

    const data = storage.getStoredMinisData();
    assert.equal(data.length, 2);
    const puzzle = data.find(m => m.id === "custom-puzzle");
    assert.ok(puzzle);
    assert.equal(puzzle.title, "Custom Puzzle");
    assert.equal(puzzle.keys[0].key, "cradle_custompuzzle_level");

    // Clear custom puzzle only
    storage.clearMini("custom-puzzle");
    assert.equal(customStore.get("level"), null);
    assert.equal(otherStore.get("level"), 10);
  } finally {
    restore();
  }
});

test("index.html includes Your data footer button and accessible modal structure", () => {
  const html = fs.readFileSync(
    path.resolve(__dirname, "../index.html"),
    "utf8"
  );
  assert.ok(
    html.includes('id="your-data-btn"'),
    "index.html must include #your-data-btn"
  );
  assert.ok(
    html.includes('id="your-data-modal"'),
    "index.html must include #your-data-modal"
  );
  assert.ok(
    html.includes('id="close-your-data"'),
    "index.html must include close button"
  );
  assert.ok(
    html.includes('id="your-data-body"'),
    "index.html must include modal body"
  );
  assert.ok(
    html.includes('aria-controls="your-data-modal"'),
    "footer button must declare aria-controls"
  );
  assert.ok(html.includes('role="dialog"'), "modal must declare role=dialog");
});

test("style.css includes styles for Your data modal and footer button", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../style.css"), "utf8");
  assert.ok(
    css.includes(".your-data-modal"),
    "style.css must style .your-data-modal"
  );
  assert.ok(
    css.includes(".your-data-modal-content"),
    "style.css must style modal content"
  );
  assert.ok(
    css.includes(".your-data-clear-mini-btn"),
    "style.css must style clear button"
  );
  assert.ok(
    css.includes(".your-data-clear-all-btn"),
    "style.css must style clear all button"
  );
});
