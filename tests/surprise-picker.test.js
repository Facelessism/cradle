import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {
  pickSurpriseProject,
  getEligibleProjects,
  LAST_SURPRISE_PICK_KEY,
} from "../src/utils/surprisePicker.js";
import CradleStorage from "../src/components/ui/storage.js";

const sampleProjects = [
  {
    title: "Chess Game",
    category: "games",
    path: "projects/games/chess/",
    description: "Classic chess with AI",
  },
  {
    title: "Snake Game",
    category: "games",
    path: "projects/games/snake-game/",
    description: "Retro arcade snake",
  },
  {
    title: "Regex Visualizer",
    category: "dev-tools",
    path: "projects/dev-tools/regex-visualizer/",
    description: "Visualize regex match groups",
  },
  {
    title: "Pomodoro Timer",
    category: "productivity",
    path: "projects/productivity/pomodoro-timer/",
    description: "Focus timer technique",
  },
  {
    title: "Guitar Tuner",
    category: "instruments",
    path: "projects/instruments/guitar/",
    description: "Playable digital guitar",
  },
];

test("pickSurpriseProject: returns null and does nothing harmful when project list is empty", () => {
  assert.equal(pickSurpriseProject([]), null);
  assert.equal(pickSurpriseProject(null), null);
  assert.equal(pickSurpriseProject(undefined), null);
  assert.equal(pickSurpriseProject([{ invalid: true }]), null);
  assert.equal(pickSurpriseProject([{ path: "" }]), null);
});

test("pickSurpriseProject: works with the full project list", () => {
  const mockStorage = {
    data: {},
    get(k, fb) {
      return this.data[k] ?? fb;
    },
    set(k, v) {
      this.data[k] = v;
    },
  };

  const picked = pickSurpriseProject(sampleProjects, mockStorage);
  assert.ok(picked, "Should pick a project from the full list");
  assert.ok(
    sampleProjects.some(p => p.path === picked.path),
    "Picked project must exist in the candidate list"
  );
  assert.equal(mockStorage.data[LAST_SURPRISE_PICK_KEY], picked.path);
});

test("pickSurpriseProject: works with a filtered list", () => {
  const gamesOnly = getEligibleProjects(sampleProjects, "games");
  assert.equal(gamesOnly.length, 2);

  const mockStorage = {
    data: {},
    get(k, fb) {
      return this.data[k] ?? fb;
    },
    set(k, v) {
      this.data[k] = v;
    },
  };

  const picked = pickSurpriseProject(gamesOnly, mockStorage);
  assert.ok(picked);
  assert.equal(picked.category, "games");
  assert.ok(
    ["projects/games/chess/", "projects/games/snake-game/"].includes(
      picked.path
    )
  );
});

test("pickSurpriseProject: avoids repeating the last pick using storage", () => {
  const mockStorage = {
    data: {},
    get(k, fb) {
      return this.data[k] ?? fb;
    },
    set(k, v) {
      this.data[k] = v;
    },
  };

  const twoProjects = [sampleProjects[0], sampleProjects[1]]; // Chess and Snake

  // First pick with fixed randomFn pointing to 0 -> picks Chess
  const first = pickSurpriseProject(twoProjects, mockStorage, () => 0.0);
  assert.equal(first.path, "projects/games/chess/");
  assert.equal(
    mockStorage.data[LAST_SURPRISE_PICK_KEY],
    "projects/games/chess/"
  );

  // Second pick with fixed randomFn pointing to 0 -> unpicked pool is only Snake -> MUST pick Snake
  const second = pickSurpriseProject(twoProjects, mockStorage, () => 0.0);
  assert.equal(second.path, "projects/games/snake-game/");
  assert.equal(
    mockStorage.data[LAST_SURPRISE_PICK_KEY],
    "projects/games/snake-game/"
  );

  // Third pick with fixed randomFn pointing to 0 -> unpicked pool is only Chess -> MUST pick Chess
  const third = pickSurpriseProject(twoProjects, mockStorage, () => 0.0);
  assert.equal(third.path, "projects/games/chess/");
  assert.equal(
    mockStorage.data[LAST_SURPRISE_PICK_KEY],
    "projects/games/chess/"
  );
});

test("pickSurpriseProject: handles single-item candidate list gracefully", () => {
  const single = [sampleProjects[2]]; // Regex Visualizer
  const mockStorage = {
    data: {},
    get(k, fb) {
      return this.data[k] ?? fb;
    },
    set(k, v) {
      this.data[k] = v;
    },
  };

  const picked = pickSurpriseProject(single, mockStorage);
  assert.equal(picked.path, "projects/dev-tools/regex-visualizer/");
  assert.equal(
    mockStorage.data[LAST_SURPRISE_PICK_KEY],
    "projects/dev-tools/regex-visualizer/"
  );

  // Calling again with the same 1-item candidate returns it without error
  const pickedAgain = pickSurpriseProject(single, mockStorage);
  assert.equal(pickedAgain.path, "projects/dev-tools/regex-visualizer/");
});

test("pickSurpriseProject: integrates seamlessly with CradleStorage", () => {
  CradleStorage.clear();

  const picked1 = pickSurpriseProject(sampleProjects, CradleStorage);
  assert.ok(picked1);
  const storedPath1 = CradleStorage.get(LAST_SURPRISE_PICK_KEY);
  assert.equal(storedPath1, picked1.path);

  // Subsequent pick must avoid repeating storedPath1
  const picked2 = pickSurpriseProject(sampleProjects, CradleStorage);
  assert.ok(picked2);
  assert.notEqual(
    picked2.path,
    storedPath1,
    "Should not repeat the immediate last pick"
  );
});

test("getEligibleProjects: respects active category filter and query", () => {
  const all = getEligibleProjects(sampleProjects, "all", "");
  assert.equal(all.length, sampleProjects.length);

  const games = getEligibleProjects(sampleProjects, "games", "");
  assert.equal(games.length, 2);
  assert.ok(games.every(g => g.category === "games"));

  const queried = getEligibleProjects(sampleProjects, "all", "regex");
  assert.equal(queried.length, 1);
  assert.equal(queried[0].title, "Regex Visualizer");

  const combined = getEligibleProjects(sampleProjects, "games", "snake");
  assert.equal(combined.length, 1);
  assert.equal(combined[0].title, "Snake Game");

  const empty = getEligibleProjects(
    sampleProjects,
    "games",
    "nonexistentquery"
  );
  assert.equal(empty.length, 0);
});

test("pickSurpriseProject: survives storage failure / throws without crashing", () => {
  const brokenStorage = {
    get() {
      throw new Error("QuotaExceeded / SecurityError");
    },
    set() {
      throw new Error("QuotaExceeded / SecurityError");
    },
  };

  const picked = pickSurpriseProject(sampleProjects, brokenStorage);
  assert.ok(picked, "Should pick a project despite broken storage");
});

test("HTML verification: Surprise me button exists near search bar with accessible name", () => {
  const html = fs.readFileSync("index.html", "utf-8");
  assert.ok(
    html.includes('id="surprise-btn"'),
    "index.html must contain surprise-btn"
  );
  assert.ok(
    html.includes('aria-label="Surprise me: open a random mini"'),
    "surprise-btn must have descriptive aria-label"
  );
  assert.ok(
    html.includes("data-cradle-btn"),
    "surprise-btn must use data-cradle-btn"
  );

  const containerStart = html.indexOf('class="search-container"');
  const containerEnd = html.indexOf("</header>", containerStart);
  assert.ok(containerStart !== -1 && containerEnd !== -1);
  const containerHtml = html.slice(containerStart, containerEnd);
  assert.ok(
    containerHtml.includes('id="surprise-btn"'),
    "surprise-btn must be inside search-container"
  );
});

test("Keyboard shortcut: R key triggers surprise me and ignores input fields", () => {
  const scriptContent = fs.readFileSync("script.js", "utf8");
  const shortcutCodeMatch = scriptContent.match(
    /\/\/ Keyboard Shortcuts Listeners[\s\S]*?(?=document\.addEventListener\("DOMContentLoaded")/
  );
  assert.ok(shortcutCodeMatch, "Must find keyboard shortcut listener block");

  let surpriseTriggered = false;
  let defaultPrevented = false;

  const searchInput = { id: "search", tagName: "INPUT" };

  const sandbox = {
    triggerSurpriseMe() {
      surpriseTriggered = true;
    },
    document: {
      activeElement: null,
      addEventListener(type, handler) {
        if (type === "keydown") this.keydownHandler = handler;
      },
    },
    shortcutsModal: null,
    searchInput,
    themeToggleEl: null,
    window: {},
    localStorage: { setItem() {} },
    Boolean,
  };

  vm.createContext(sandbox);
  vm.runInContext(shortcutCodeMatch[0], sandbox);

  // 1. Pressing 'r' outside input triggers surprise me
  sandbox.document.activeElement = null;
  surpriseTriggered = false;
  defaultPrevented = false;
  sandbox.document.keydownHandler({
    key: "r",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: null,
    preventDefault() {
      defaultPrevented = true;
    },
  });
  assert.equal(
    surpriseTriggered,
    true,
    "Pressing 'r' should trigger surprise me"
  );
  assert.equal(defaultPrevented, true, "Pressing 'r' should prevent default");

  // 2. Pressing 'r' inside input element is ignored
  sandbox.document.activeElement = { tagName: "INPUT" };
  surpriseTriggered = false;
  defaultPrevented = false;
  sandbox.document.keydownHandler({
    key: "r",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target: sandbox.document.activeElement,
    preventDefault() {
      defaultPrevented = true;
    },
  });
  assert.equal(
    surpriseTriggered,
    false,
    "Typing 'r' in input must not trigger surprise me"
  );

  // 3. Ctrl+R or Alt+R is ignored (does not hijack browser refresh)
  sandbox.document.activeElement = null;
  surpriseTriggered = false;
  sandbox.document.keydownHandler({
    key: "r",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    target: null,
    preventDefault() {},
  });
  assert.equal(surpriseTriggered, false, "Ctrl+R must not trigger surprise me");
});
