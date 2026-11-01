const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CHESS_DIR = path.resolve(__dirname, "../projects/games/chess");
const chessLogicCode = fs.readFileSync(path.join(CHESS_DIR, "chessLogic.js"), "utf8");
const chessScriptCode = fs.readFileSync(path.join(CHESS_DIR, "script.js"), "utf8");
const chessHtml = fs.readFileSync(path.join(CHESS_DIR, "index.html"), "utf8");

function createMockElement(id = "", tagName = "div") {
  const classes = new Set();
  const listeners = {};
  const attrs = {};
  return {
    id,
    tagName: tagName.toUpperCase(),
    value: id === "gameMode" ? "local" : id === "aiDifficulty" ? "3" : "",
    textContent: "",
    innerHTML: "",
    dataset: {},
    classList: {
      add(cls) { classes.add(cls); },
      remove(cls) { classes.delete(cls); },
      contains(cls) { return classes.has(cls); },
      toggle(cls, force) {
        if (force === undefined) {
          if (classes.has(cls)) classes.delete(cls);
          else classes.add(cls);
        } else if (force) {
          classes.add(cls);
        } else {
          classes.delete(cls);
        }
      },
    },
    addEventListener(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    dispatchEvent(event) {
      if (listeners[event.type]) {
        listeners[event.type].forEach(fn => fn(event));
      }
    },
    setAttribute(name, val) { attrs[name] = String(val); },
    getAttribute(name) { return attrs[name] !== undefined ? attrs[name] : null; },
    appendChild() {},
  };
}

function createChessEnvironment(options = {}) {
  const elements = {};
  [
    "board", "status", "turnLabel", "moveList", "moveCount",
    "whiteCaptures", "blackCaptures", "newGame", "undoMove", "redoMove",
    "copyPGN", "flipBoard", "gameMode", "aiDifficulty", "fenInput",
    "loadFEN", "copyFEN", "promotionModal", "promotionOptions"
  ].forEach(id => {
    elements[id] = createMockElement(id);
  });
  elements["status"].textContent = "White to move.";

  const contextObj = {
    console: {
      log() {},
      error() {},
      warn() {},
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    document: {
      getElementById: id => elements[id] || null,
      createElement: tagName => createMockElement("", tagName),
      querySelectorAll: () => [],
      addEventListener: () => {},
    },
    navigator: {
      clipboard: { writeText: () => Promise.resolve() },
    },
  };

  if (options.Worker !== undefined) {
    contextObj.Worker = options.Worker;
  }

  contextObj.window = contextObj;
  const context = vm.createContext(contextObj);
  vm.runInContext(chessLogicCode, context);
  vm.runInContext(chessScriptCode, context);

  return { context, elements };
}

test("Accessibility: #status has role='status' and aria-live='polite' in index.html", () => {
  assert.match(
    chessHtml,
    /<p[^>]*id=["']status["'][^>]*role=["']status["'][^>]*aria-live=["']polite["']/,
    "Status paragraph must have role='status' and aria-live='polite' for screen reader announcements"
  );
});

test("isWorkerSupported returns false when Web Workers are undefined", () => {
  const { context } = createChessEnvironment();
  assert.equal(context.window.ChessGame.isWorkerSupported(), false);
});

test("isWorkerSupported returns true when Worker constructor is defined", () => {
  const MockWorker = function () {};
  const { context } = createChessEnvironment({ Worker: MockWorker });
  assert.equal(context.window.ChessGame.isWorkerSupported(), true);
});

test("Changing gameMode to 'computer' when Worker is unsupported falls back to local mode with accessible message", () => {
  const { elements } = createChessEnvironment();
  const gmEl = elements["gameMode"];

  gmEl.value = "computer";
  gmEl.dispatchEvent({ type: "change", target: gmEl });

  assert.equal(gmEl.value, "local", "Game mode must revert to local");
  assert.equal(
    elements["status"].textContent,
    "AI unavailable in this browser, switched to 2-player mode.",
    "Accessible status message must inform player of fallback"
  );
  assert.equal(
    elements["aiDifficulty"].classList.contains("hidden"),
    true,
    "AI difficulty dropdown must remain hidden in local mode"
  );
});

test("Changing gameMode to 'computer' when Worker throws on instantiation falls back to local mode", () => {
  const BlockedWorker = function () {
    throw new Error("SecurityError: Worker is blocked by browser policy");
  };
  const { elements } = createChessEnvironment({ Worker: BlockedWorker });
  const gmEl = elements["gameMode"];

  gmEl.value = "computer";
  gmEl.dispatchEvent({ type: "change", target: gmEl });

  assert.equal(gmEl.value, "local");
  assert.equal(
    elements["status"].textContent,
    "AI unavailable in this browser, switched to 2-player mode."
  );
  assert.equal(elements["aiDifficulty"].classList.contains("hidden"), true);
});

test("triggerAI with blocked Worker falls back to local mode and unblocks user interaction", () => {
  const BlockedWorker = function () {
    throw new Error("SecurityError: Worker is blocked");
  };
  const { context, elements } = createChessEnvironment({ Worker: BlockedWorker });

  context.window.ChessGame.triggerAI();

  assert.equal(elements["gameMode"].value, "local");
  assert.equal(
    elements["status"].textContent,
    "AI unavailable in this browser, switched to 2-player mode."
  );
  assert.equal(
    context.window.ChessGame.isComputerThinking(),
    false,
    "isComputerThinking must be false so player can make local moves"
  );
});

test("Worker emitting runtime error falls back to local mode after retries are exhausted", () => {
  const workerInstances = [];
  class MockWorker {
    constructor() {
      workerInstances.push(this);
      this.terminated = false;
    }
    postMessage() {}
    terminate() {
      this.terminated = true;
    }
  }

  const { context, elements } = createChessEnvironment({ Worker: MockWorker });
  elements["gameMode"].value = "computer";

  context.window.ChessGame.initAIWorker();
  assert.equal(workerInstances.length, 1);

  // Attempt 1:
  workerInstances[0].onerror(new Error("Worker failure 1"));
  assert.match(elements["status"].textContent, /Retrying in \d+ms \(attempt 1\/3\)/);

  // Attempt 2:
  context.window.ChessGame.initAIWorker();
  assert.equal(workerInstances.length, 2);
  workerInstances[1].onerror(new Error("Worker failure 2"));
  assert.match(elements["status"].textContent, /Retrying in \d+ms \(attempt 2\/3\)/);

  // Attempt 3:
  context.window.ChessGame.initAIWorker();
  assert.equal(workerInstances.length, 3);
  workerInstances[2].onerror(new Error("Worker failure 3"));
  assert.match(elements["status"].textContent, /Retrying in \d+ms \(attempt 3\/3\)/);

  // Attempt 4 (retries exhausted):
  context.window.ChessGame.initAIWorker();
  assert.equal(workerInstances.length, 4);
  workerInstances[3].onerror(new Error("Worker failure 4"));

  assert.equal(elements["gameMode"].value, "local");
  assert.equal(
    elements["status"].textContent,
    "AI unavailable in this browser, switched to 2-player mode."
  );
  assert.equal(context.window.ChessGame.isComputerThinking(), false);
});

test("Worker emitting error message (type: 'error') triggers fallback to local 2-player mode", () => {
  let workerInstance = null;
  class MockWorker {
    constructor() {
      workerInstance = this;
    }
    postMessage() {}
    terminate() {}
  }

  const { context, elements } = createChessEnvironment({ Worker: MockWorker });
  elements["gameMode"].value = "computer";

  context.window.ChessGame.initAIWorker();
  assert.ok(workerInstance);

  workerInstance.onmessage({ data: { type: "error", message: "Out of memory" } });

  assert.equal(elements["gameMode"].value, "local");
  assert.equal(
    elements["status"].textContent,
    "AI unavailable in this browser, switched to 2-player mode."
  );
  assert.equal(context.window.ChessGame.isComputerThinking(), false);
});

test("Worker emitting invalid report shape triggers fallback to local 2-player mode", () => {
  let workerInstance = null;
  class MockWorker {
    constructor() {
      workerInstance = this;
    }
    postMessage() {}
    terminate() {}
  }

  const { context, elements } = createChessEnvironment({ Worker: MockWorker });
  elements["gameMode"].value = "computer";

  context.window.ChessGame.initAIWorker();
  assert.ok(workerInstance);

  workerInstance.onmessage({ data: { type: "unknownType123" } });

  assert.equal(elements["gameMode"].value, "local");
  assert.equal(
    elements["status"].textContent,
    "AI unavailable in this browser, switched to 2-player mode."
  );
  assert.equal(context.window.ChessGame.isComputerThinking(), false);
});

test("triggerAI catches postMessage failure and falls back to local 2-player mode", () => {
  class MockWorker {
    postMessage() {
      throw new Error("DataCloneError");
    }
    terminate() {}
  }

  const { context, elements } = createChessEnvironment({ Worker: MockWorker });
  elements["gameMode"].value = "computer";

  context.window.ChessGame.triggerAI();

  assert.equal(elements["gameMode"].value, "local");
  assert.equal(
    elements["status"].textContent,
    "AI unavailable in this browser, switched to 2-player mode."
  );
  assert.equal(context.window.ChessGame.isComputerThinking(), false);
});
