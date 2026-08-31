const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const REPO_ROOT = path.resolve(__dirname, "..");

/**
 * Creates a browser sandbox where DOM queries return null when elements are missing.
 */
function createMockSandbox(missingSelectorPattern = null) {
  const localStorageStore = new Map();
  const mockLocalStorage = {
    getItem: key => localStorageStore.get(String(key)) || null,
    setItem: (key, val) => localStorageStore.set(String(key), String(val)),
    removeItem: key => localStorageStore.delete(String(key)),
    clear: () => localStorageStore.clear(),
  };

  const createDummyElement = (tagName = "div") => {
    const styleObj = {
      setProperty: () => {},
      getPropertyValue: () => "",
      removeProperty: () => {},
    };

    return {
      tagName: String(tagName).toUpperCase(),
      id: "",
      className: "",
      innerHTML: "",
      textContent: "",
      innerText: "",
      value: "0",
      src: "",
      href: "",
      type: "",
      disabled: false,
      width: 800,
      height: 600,
      style: styleObj,
      dataset: {},
      children: [],
      childNodes: [],

      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => true,
        contains: () => false,
      },

      setAttribute: () => {},
      getAttribute: () => null,
      removeAttribute: () => {},
      hasAttribute: () => false,
      appendChild: c => c,
      removeChild: c => c,
      replaceChild: (n, o) => o,
      remove: () => {},
      insertBefore: n => n,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      getBoundingClientRect: () => ({ top: 0, left: 0, right: 800, bottom: 600, width: 800, height: 600 }),

      querySelector: sel => {
        if (missingSelectorPattern && missingSelectorPattern.test(sel)) return null;
        return createDummyElement("div");
      },
      querySelectorAll: sel => {
        if (missingSelectorPattern && missingSelectorPattern.test(sel)) return [];
        return [createDummyElement("div")];
      },
      closest: sel => {
        if (missingSelectorPattern && missingSelectorPattern.test(sel)) return null;
        return createDummyElement("div");
      },
      parentElement: null,
      parentNode: null,
      getContext: () => ({
        fillRect: () => {},
        clearRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        measureText: () => ({ width: 50 }),
        drawImage: () => {},
        setTransform: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        save: () => {},
        restore: () => {},
        scale: () => {},
        translate: () => {},
        setLineDash: () => {},
        fillText: () => {},
        strokeText: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
      }),
      click: () => {},
      focus: () => {},
      blur: () => {},
    };
  };

  const documentMock = {
    body: createDummyElement("body"),
    head: createDummyElement("head"),
    documentElement: createDummyElement("html"),
    title: "Test",
    createElement: tag => createDummyElement(tag),
    getElementById: id => {
      if (missingSelectorPattern && missingSelectorPattern.test(id)) return null;
      return createDummyElement("div");
    },
    querySelector: sel => {
      if (missingSelectorPattern && missingSelectorPattern.test(sel)) return null;
      return createDummyElement("div");
    },
    querySelectorAll: sel => {
      if (missingSelectorPattern && missingSelectorPattern.test(sel)) return [];
      return [createDummyElement("div")];
    },
    getElementsByClassName: () => [createDummyElement("div")],
    getElementsByTagName: () => [createDummyElement("div")],
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const dummyFunc = () => ({});
  const dummyObj = new Proxy(
    {},
    {
      get: (target, prop) => (prop === "prototype" ? {} : dummyFunc),
    }
  );

  const jqueryMock = sel => {
    if (typeof sel === "function") {
      try { sel(); } catch (e) {}
    }
    const el = createDummyElement("div");
    el.ready = cb => { try { cb(); } catch (e) {} };
    el.on = () => el;
    el.off = () => el;
    el.css = () => el;
    el.val = () => "0";
    el.html = () => el;
    el.text = () => el;
    return el;
  };
  jqueryMock.ready = cb => cb();
  jqueryMock.fn = {};
  jqueryMock.ajax = async () => ({});

  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    require: () => ({}),
    module: { exports: {} },
    exports: {},
    localStorage: mockLocalStorage,
    sessionStorage: mockLocalStorage,
    location: { href: "http://localhost/", pathname: "/" },
    navigator: { userAgent: "NodeTest", clipboard: { writeText: async () => {} } },
    document: documentMock,
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    getComputedStyle: () => ({ getPropertyValue: () => "", width: "800px", height: "600px" }),
    matchMedia: () => ({ matches: false, addListener: () => {} }),
    AudioContext: class { createGain() { return { gain: {} }; } createOscillator() { return { frequency: {} }; } },
    Audio: class { play() { return Promise.resolve(); } pause() {} },
    Image: class {},
    Blob: class {},
    URL: { createObjectURL: () => "", revokeObjectURL: () => {} },
    Worker: class { postMessage() {} terminate() {} },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    Chart: dummyObj,
    QRCodeStyling: dummyObj,
    WaveformEngine: { generateSineWave: () => [0], generateSquareWave: () => [0], generateSawtoothWave: () => [0], generateTriangleWave: () => [0], generateNoiseWave: () => [0], applyEnvelope: () => [0] },
    NOTES: [{ note: "C4", freq: 261.63 }],
    ShapeEngine: dummyObj,
    PortfolioEngine: dummyObj,
    Themes: {
      getThemeIds: () => ["matrix"],
      getTheme: () => ({ font: "monospace", bg: "#000", fg: "#fff" }),
      themeToCssVars: () => ({}),
      applyTheme: () => {},
      matrix: { font: "monospace", bg: "#000", fg: "#fff" },
    },
    LudoEngine: dummyObj,
    getHighScore: () => 0,
    updateHighScore: () => {},
    calculateStats: () => ({ total: 0, present: 0, absent: 0, percentage: 0 }),
    computeWaveform: () => ({ wave: [0], samples: [0], harmonics: [{ n: 1, amp: 1, freq: 1, phase: 0, samples: [0] }], terms: [{ n: 1, amp: 1, freq: 1, phase: 0 }] }),
    fourierCoeff: () => ({ a: 0, b: 1 }),
    sampleAt: () => 0,
    normalise: v => v,
    ClassifierEngine: { loadModels: async () => {}, initializeKNN: () => {} },
    FlagEngine: { getFlags: () => [], evaluate: () => ({ on: true, bucket: 0 }) },
    CannonEngine: { calculateBallMileage: () => 10, validateHit: () => true, calculateScore: () => ({ scoreAwarded: 10, newStreak: 1 }) },
    CannonStorage: { loadStats: () => ({ score: 0, highScore: 0, currentStreak: 0, bestStreak: 0, totalShots: 0, totalHits: 0 }), recordShot: s => s },
    escapeHTML: str => String(str || ""),
    escapeHtml: str => String(str || ""),
    WHITE: "w",
    BLACK: "b",
    startPosition: () => [
      ["r","n","b","q","k","b","n","r"],
      ["p","p","p","p","p","p","p","p"],
      [null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null],
      [null,null,null,null,null,null,null,null],
      ["P","P","P","P","P","P","P","P"],
      ["R","N","B","Q","K","B","N","R"],
    ],
    findKing: () => null,
    cloneBoard: b => (b ? b.map(r => r.slice()) : []),
    SYMBOLS: { w: { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" }, b: { p: "♟", r: "♜", n: "➞", b: "♝", q: "♛", k: "♚" } },
    getReportError: () => null,
    generatePGN: () => "",
    loadFEN: () => {},
    boardToFEN: () => "",
    createCPUState: () => ({ RAM: new Uint8Array(256), registers: { A: 0, B: 0, C: 0, D: 0 }, flags: { Z: 0, C: 0 }, PC: 0, halted: false }),
    jQuery: jqueryMock,
    $: jqueryMock,
  };

  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  return vm.createContext(sandbox);
}

const targetMinis = [
  "projects/aiml/ai-circuit-builder/script.js",
  "projects/aiml/image-classifier/script.js",
  "projects/aiml/neural-network-playground/script.js",
  "projects/dev-tools/cpu-emulator/script.js",
  "projects/dev-tools/feature-flag-playground/script.js",
  "projects/dev-tools/json-tree-viewer/script.js",
  "projects/editor/css-shape-designer/script.js",
  "projects/games/cannon-shooting/script.js",
  "projects/games/chess/script.js",
  "projects/games/ludo-game/script.js",
  "projects/games/memory-flip-game/script.js",
  "projects/games/monopoly/script.js",
  "projects/games/typing-speed-racer/script.js",
  "projects/math/fourier-series-visualizer/script.js",
  "projects/math/graph-theory-explorer/script.js",
  "projects/math/unit-circle-explorer/script.js",
  "projects/misc/audio-waveform-generator/script.js",
  "projects/misc/cyberpunk-pixel-art-generator/script.js",
  "projects/misc/sound-wave-visualizer/script.js",
  "projects/productivity/attendance-tracker/script.js",
  "projects/productivity/brain-dump-collector/script.js",
  "projects/productivity/invoice-generator/script.js",
  "projects/productivity/pomodoro-infinity-timer/script.js",
  "projects/productivity/terminal-portfolio-generator/script.js",
  "projects/productivity/time-blocking-planner/script.js",
];

test("Defensive DOM queries: scripts load cleanly when parentElement is null", () => {
  for (const relPath of targetMinis) {
    const fullPath = path.join(REPO_ROOT, relPath);
    assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);

    const code = fs.readFileSync(fullPath, "utf-8");
    let executableCode = code
      .replace(/\bexport\s+default\s+/g, "")
      .replace(/\bexport\s+/g, "");
    executableCode = executableCode.replace(/^(const|let)\s+/gm, "var ");

    const context = createMockSandbox();
    try {
      const script = new vm.Script(executableCode, { filename: relPath });
      script.runInContext(context);
    } catch (err) {
      assert.fail(`Uncaught exception in ${relPath} when parentElement is null:\n  ${err.name}: ${err.message}`);
    }
  }
});

test("Defensive DOM queries: scripts load cleanly when queried elements return null", () => {
  for (const relPath of targetMinis) {
    const fullPath = path.join(REPO_ROOT, relPath);
    assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);

    const code = fs.readFileSync(fullPath, "utf-8");
    let executableCode = code
      .replace(/\bexport\s+default\s+/g, "")
      .replace(/\bexport\s+/g, "");
    executableCode = executableCode.replace(/^(const|let)\s+/gm, "var ");

    // Simulate missing elements matching any selector
    const context = createMockSandbox(/.*/);
    try {
      const script = new vm.Script(executableCode, { filename: relPath });
      script.runInContext(context);
    } catch (err) {
      assert.fail(`Uncaught exception in ${relPath} when DOM lookups return null:\n  ${err.name}: ${err.message}`);
    }
  }
});
