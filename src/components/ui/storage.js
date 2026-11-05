/**
 * Cradle UI — localStorage Utility
 * ────────────────────────────────
 * Shared helper for safe reads, writes, JSON parsing, and consistent key
 * handling. Replaces the per-project storage implementations that each
 * reinvented availability checks, try/catch blocks, and key prefixes.
 *
 * UMD shape (same as escapeHtml.js):
 *
 *   Browser:  window.CradleStorage.get("key", fallback)
 *   Node:     require("src/components/ui/storage.js").get("key", fallback)
 *
 * Highlights:
 *   - Safe availability detection (private mode / disabled storage).
 *   - In-memory fallback so reads/writes never throw when storage is
 *     unavailable (e.g. SSR or tests without a DOM).
 *   - JSON helpers (`get` / `set`) that parse/serialize automatically.
 *   - State validation (`get(key, fallback, validator)`) ensuring persisted
 *     state meets expected schemas and safely falls back on corrupted or
 *     malformed data.
 *   - Raw string helpers (`getRaw` / `setRaw`) for plain values such as
 *     theme names or high scores.
 *   - Namespaced handles (`namespace`) plus `keys` / `clear` for consistent
 *     prefix-based key handling.
 *
 * Usage (HTML):
 *   <script src="../../../src/components/ui/storage.js"></script>
 *   ...
 *   const settings = CradleStorage.get("cradle_settings", { theme: "dark" }, s => typeof s?.theme === "string");
 *   CradleStorage.set("cradle_settings", { theme: "dark" });
 *
 * Usage (namespace):
 *   const store = CradleStorage.namespace("cradle_rps_");
 *   store.set("stats", { wins: 1 });   // writes "cradle_rps_stats"
 *   store.get("stats", { wins: 0 }, s => Number.isInteger(s?.wins)); // reads with schema validation
 *   store.clear();                     // removes every "cradle_rps_*" key
 */
(function (exports) {
  "use strict";

  /* In-memory fallback used when real localStorage is unavailable.
     Implements the same Storage interface so every operation above it
     can go through a single code path. */
  const memoryStore = (function () {
    const data = {};
    return {
      get length() {
        return Object.keys(data).length;
      },
      key(index) {
        const list = Object.keys(data);
        return index >= 0 && index < list.length ? list[index] : null;
      },
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(data, key)
          ? data[key]
          : null;
      },
      setItem(key, value) {
        data[key] = String(value);
      },
      removeItem(key) {
        delete data[key];
      },
      clear() {
        for (const key of Object.keys(data)) delete data[key];
      },
    };
  })();

  /* Cache the positive availability result only — a later mock or a storage
     being enabled between calls is still detected on the next check. */
  let availabilityCached = false;

  /* Track keys explicitly written through CradleStorage during the session */
  const writtenThroughCradle = new Set();

  /* Dynamically registered namespaces from CradleStorage.namespace(...) */
  const registeredNamespaces = new Map();

  const KNOWN_PROJECTS = {
    "2048-game": "2048 Game",
    "advanced-qr-code-generator": "Advanced QR Code Generator",
    "ai-circuit-builder": "AI Circuit Builder",
    "api-response-inspector": "API Response Inspector",
    "ascii-camera": "ASCII Camera",
    "attendance-tracker": "Attendance Tracker",
    "audio-spectrogram-analyzer": "Audio Spectrogram Analyzer",
    "audio-waveform-generator": "Audio Waveform Generator",
    "avatar-creator": "Avatar Creator",
    "brain-dump-collector": "Brain Dump Collector",
    "browser-storage-inspector": "Browser Storage Inspector",
    "cannon-shooting": "Cannon Shooting",
    chess: "Chess",
    "collaborative-whiteboard": "Collaborative Whiteboard",
    "color-contrast-checker": "Color Contrast Checker",
    "color-palette-generator": "Color Palette Generator",
    "cpu-emulator": "CPU Emulator",
    "css-clamp-calculator": "CSS Clamp Calculator",
    "css-gradient-generator": "CSS Gradient Generator",
    "css-grid-generator": "CSS Grid Generator",
    "css-shape-designer": "CSS Shape Designer",
    "csv-data-cleaner": "CSV Data Cleaner",
    "cyberpunk-pixel-art-generator": "Cyberpunk Pixel Art Generator",
    "dot-game": "Dot Game",
    "encoding-toolkit": "Encoding Toolkit",
    "feature-flag-playground": "Feature Flag Playground",
    "file-difference-visualizer": "File Difference Visualizer",
    "flashcard-study": "Flashcard Study",
    "fourier-series-visualizer": "Fourier Series Visualizer",
    "graph-theory-explorer": "Graph Theory Explorer",
    guitar: "Guitar",
    guzheng: "Guzheng",
    "image-classifier": "Image Classifier",
    "image-metadata-explorer": "Image Metadata Explorer",
    "invoice-generator": "Invoice Generator",
    "json-converter": "JSON Converter",
    "json-tree-viewer": "JSON Tree Viewer",
    "knowledge-graph": "Knowledge Graph",
    "ludo-game": "Ludo Game",
    "markdown-editor": "Markdown Editor",
    "markdown-resume-generator": "Markdown Resume Generator",
    "matrix-playground": "Matrix Playground",
    "meme-generator": "Meme Generator",
    "memory-flip-game": "Memory Flip Game",
    monopoly: "Monopoly",
    "morse-code-studio": "Morse Code Studio",
    "neural-network-playground": "Neural Network Playground",
    "pathfinding-visualizer": "Pathfinding Visualizer",
    percussion: "Percussion",
    "periodic-table": "Periodic Table",
    piano: "Piano",
    "pomodoro-infinity-timer": "Pomodoro Infinity Timer",
    "pomodoro-timer": "Pomodoro Timer",
    "procedural-dungeon-generator": "Procedural Dungeon Generator",
    "reading-progress-tracker": "Reading Progress Tracker",
    "regex-visualizer": "Regex Visualizer",
    "snake-game": "Snake Game",
    "sound-wave-visualizer": "Sound Wave Visualizer",
    "stone-paper-scissors-game": "Stone Paper Scissors Game",
    "sudoku-solver": "Sudoku Solver",
    "terminal-portfolio-generator": "Terminal Portfolio Generator",
    "text-diff-checker": "Text Diff Checker",
    "time-blocking-planner": "Time Blocking Planner",
    "typing-speed-racer": "Typing Speed Racer",
    "typing-speed-test": "Typing Speed Test",
    "unit-circle-explorer": "Unit Circle Explorer",
    "unit-converter": "Unit Converter",
    "url-parser": "URL Parser",
    violin: "Violin",
    weather: "Weather",
    "wordle-clone": "Wordle Clone",
  };

  const KNOWN_ALIASES = {
    2048: "2048-game",
    rps: "stone-paper-scissors-game",
    tb_planner: "time-blocking-planner",
    periodic: "periodic-table",
    meme: "meme-generator",
    memory_flip: "memory-flip-game",
    cannon: "cannon-shooting",
    matrix_playground: "matrix-playground",
    snake: "snake-game",
    reading_tracker: "reading-progress-tracker",
    dot_game: "dot-game",
    ludo: "ludo-game",
    typing_racer: "typing-speed-racer",
    "typing-racer": "typing-speed-racer",
    markdown_resume: "markdown-resume-generator",
    "markdown-resume": "markdown-resume-generator",
    resume: "markdown-resume-generator",
    wordle: "wordle-clone",
    flashcard: "flashcard-study",
    flashcards: "flashcard-study",
    fc: "flashcard-study",
    chess: "chess",
  };

  function titleCase(str) {
    return String(str || "")
      .replace(/[-_]+/g, " ")
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Whether a working localStorage is available right now.
   * Performs a harmless probe write/remove so private-mode or quota-limited
   * environments that expose `localStorage` but reject writes report false.
   * @returns {boolean}
   */
  function isAvailable() {
    if (availabilityCached) return true;
    try {
      if (typeof localStorage === "undefined") return false;
      const probe = "__cradle_storage_probe__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      availabilityCached = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Resolve the store that should back the next operation. */
  function resolveStore() {
    return isAvailable() ? localStorage : memoryStore;
  }

  /** Enumerate every key currently present in the active store. */
  function storageKeys() {
    const out = [];
    try {
      const store = resolveStore();
      if (typeof store.length === "number") {
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key != null) out.push(String(key));
        }
      } else {
        for (const key in store) {
          if (typeof store[key] !== "function") out.push(key);
        }
      }
    } catch (e) {
      /* ignore — return what we have */
    }
    return out;
  }

  /**
   * Evaluates a value against an optional validator function or schema.
   * If validator returns false or throws, returns false.
   * @param {*} value
   * @param {Function} [validator]
   * @returns {boolean}
   */
  function isValid(value, validator) {
    if (typeof validator !== "function") return true;
    try {
      return Boolean(validator(value));
    } catch (e) {
      return false;
    }
  }

  /**
   * Read a raw (unparsed) string value.
   * @param {string} key
   * @param {*} [fallback=null] Returned when the key is missing, invalid, or storage
   *                            is unavailable.
   * @param {Function} [validator] Optional validator function receiving the string.
   *                               If it returns false or throws, fallback is returned.
   * @returns {string|null}
   */
  function getRaw(key, fallback = null, validator = null) {
    try {
      const raw = resolveStore().getItem(String(key));
      if (raw === null) return fallback;
      if (!isValid(raw, validator)) return fallback;
      return raw;
    } catch (e) {
      return fallback;
    }
  }

  /**
   * Read a JSON-serialized value.
   * @param {string} key
   * @param {*} [fallback=null] Returned when the key is missing, corrupt,
   *                            invalid, or storage is unavailable.
   * @param {Function} [validator] Optional validator function receiving the parsed object.
   *                               If it returns false or throws, fallback is returned.
   * @returns {*}
   */
  function get(key, fallback = null, validator = null) {
    const raw = getRaw(key, null);
    if (raw === null) return fallback;
    try {
      const parsed = JSON.parse(raw);
      if (!isValid(parsed, validator)) return fallback;
      return parsed;
    } catch (e) {
      return fallback;
    }
  }

  /**
   * Write a plain string value verbatim.
   * @param {string} key
   * @param {*} value Coerced to string before storing.
   * @returns {boolean} True when the write succeeded.
   */
  function setRaw(key, value) {
    try {
      resolveStore().setItem(String(key), String(value));
      writtenThroughCradle.add(String(key));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Write a value as JSON. Objects, arrays, numbers, booleans and strings
   * are all serialized so they round-trip through `get`.
   * @param {string} key
   * @param {*} value `undefined` is stored as JSON `null`.
   * @returns {boolean} True when the write succeeded.
   */
  function set(key, value) {
    return setRaw(key, JSON.stringify(value ?? null));
  }

  /**
   * Remove a single key.
   * @param {string} key
   * @returns {boolean} True when the removal succeeded.
   */
  function remove(key) {
    try {
      resolveStore().removeItem(String(key));
      writtenThroughCradle.delete(String(key));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * List stored keys, optionally filtered by prefix.
   * @param {string} [prefix=""] When given, only keys starting with the
   *                            prefix are returned.
   * @returns {string[]}
   */
  function keys(prefix = "") {
    const p = String(prefix);
    return storageKeys()
      .filter(k => k.startsWith(p))
      .sort();
  }

  /**
   * Remove every key that starts with the given prefix (or all keys when no
   * prefix is given).
   * @param {string} [prefix=""]
   * @returns {number} Number of keys removed.
   */
  function clear(prefix = "") {
    let removed = 0;
    for (const key of keys(prefix)) {
      if (remove(key)) removed++;
    }
    return removed;
  }

  /**
   * Sanitizes and clamps a numeric value into safe bounds [min, max].
   * If value is not a finite number or cannot be parsed, fallback is returned.
   * @param {*} value
   * @param {number} [min=0]
   * @param {number} [max=Number.MAX_SAFE_INTEGER]
   * @param {number} [fallback=min]
   * @returns {number}
   */
  function clampNumber(
    value,
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    fallback = min
  ) {
    if (
      value === null ||
      value === undefined ||
      typeof value === "boolean" ||
      typeof value === "object" ||
      typeof value === "symbol"
    ) {
      return fallback;
    }
    if (typeof value === "string" && value.trim() === "") {
      return fallback;
    }
    const num = Number(value);
    if (!Number.isFinite(num) || Number.isNaN(num)) {
      return fallback;
    }
    const safeMin = Number.isFinite(Number(min)) ? Number(min) : 0;
    const safeMax = Number.isFinite(Number(max))
      ? Number(max)
      : Number.MAX_SAFE_INTEGER;
    const lower = Math.min(safeMin, safeMax);
    const upper = Math.max(safeMin, safeMax);
    return Math.min(Math.max(num, lower), upper);
  }

  /**
   * Evaluates if a value is a valid finite number within safe bounds [min, max].
   * @param {*} value
   * @param {Object} [options]
   * @param {number} [options.min=0]
   * @param {number} [options.max=Number.MAX_SAFE_INTEGER]
   * @param {boolean} [options.integer=false]
   * @returns {boolean}
   */
  function validateBoundedNumber(value, options = {}) {
    if (
      value === null ||
      value === undefined ||
      typeof value === "boolean" ||
      typeof value === "object" ||
      typeof value === "symbol"
    ) {
      return false;
    }
    if (typeof value === "string" && value.trim() === "") {
      return false;
    }
    const num = Number(value);
    if (!Number.isFinite(num) || Number.isNaN(num)) {
      return false;
    }
    const min =
      options.min !== undefined && Number.isFinite(Number(options.min))
        ? Number(options.min)
        : 0;
    const max =
      options.max !== undefined && Number.isFinite(Number(options.max))
        ? Number(options.max)
        : Number.MAX_SAFE_INTEGER;
    const lower = Math.min(min, max);
    const upper = Math.max(min, max);

    if (num < lower || num > upper) {
      return false;
    }
    if (options.integer && !Number.isInteger(num)) {
      return false;
    }
    return true;
  }

  /**
   * Read a persisted numeric value with validation and safe bounds checking.
   * Rejects corrupted, negative (if min >= 0), NaN, Infinity, or overflow values.
   * @param {string} key
   * @param {number} [fallback=0] Returned when key is missing or invalid.
   * @param {Object|Function} [options={}] Options object { min, max, integer, clamp } or custom validator function.
   * @returns {number}
   */
  function getNumber(key, fallback = 0, options = {}) {
    const raw = getRaw(key, null);
    if (raw === null) return fallback;

    if (typeof options === "function") {
      const num = Number(raw);
      if (!Number.isFinite(num) || Number.isNaN(num)) return fallback;
      return isValid(num, options) ? num : fallback;
    }

    const opts = typeof options === "object" && options !== null ? options : {};
    const min =
      opts.min !== undefined && Number.isFinite(Number(opts.min))
        ? Number(opts.min)
        : 0;
    const max =
      opts.max !== undefined && Number.isFinite(Number(opts.max))
        ? Number(opts.max)
        : Number.MAX_SAFE_INTEGER;
    const integer = opts.integer !== undefined ? Boolean(opts.integer) : false;
    const clamp = Boolean(opts.clamp);

    if (clamp) {
      const clamped = clampNumber(raw, min, max, fallback);
      return integer ? Math.round(clamped) : clamped;
    }

    if (!validateBoundedNumber(raw, { min, max, integer })) {
      return fallback;
    }

    const num = Number(raw);
    return integer ? Math.round(num) : num;
  }

  /**
   * Write a numeric value within safe bounds. Rejects invalid or out-of-bound numbers unless clamped.
   * @param {string} key
   * @param {number} value
   * @param {Object} [options={}] Options { min, max, integer, clamp }
   * @returns {boolean} True when the write succeeded, false if rejected or failed.
   */
  function setNumber(key, value, options = {}) {
    const opts = typeof options === "object" && options !== null ? options : {};
    const min =
      opts.min !== undefined && Number.isFinite(Number(opts.min))
        ? Number(opts.min)
        : 0;
    const max =
      opts.max !== undefined && Number.isFinite(Number(opts.max))
        ? Number(opts.max)
        : Number.MAX_SAFE_INTEGER;
    const integer = opts.integer !== undefined ? Boolean(opts.integer) : false;
    const clamp = Boolean(opts.clamp);

    let num;
    if (clamp) {
      num = clampNumber(value, min, max, null);
      if (num === null) return false;
      if (integer) num = Math.round(num);
    } else {
      if (!validateBoundedNumber(value, { min, max, integer })) {
        return false;
      }
      num = Number(value);
      if (integer) num = Math.round(num);
    }

    return setRaw(key, String(num));
  }

  /**
   * Write a value with an expiration timestamp (Time-To-Live in milliseconds).
   * Used for sensitive drafts, temporary caches, or bounded data retention.
   * @param {string} key
   * @param {*} value
   * @param {number} ttlMs Time to live in milliseconds (must be positive finite number).
   * @returns {boolean} True when write succeeded.
   */
  function setWithExpiry(key, value, ttlMs) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      return false;
    }
    const envelope = {
      __cradle_expiry: true,
      data: value ?? null,
      expiresAt: Date.now() + ttlMs,
    };
    return set(key, envelope);
  }

  /**
   * Read a value stored with an expiration timestamp. If the TTL has expired,
   * automatically purges the item from storage and returns fallback.
   * Also validates the unpacked value against validator if provided.
   * @param {string} key
   * @param {*} [fallback=null]
   * @param {Function} [validator]
   * @returns {*}
   */
  function getWithExpiry(key, fallback = null, validator = null) {
    const envelope = get(key, null);
    if (
      !envelope ||
      typeof envelope !== "object" ||
      !envelope.__cradle_expiry
    ) {
      return fallback;
    }
    if (
      typeof envelope.expiresAt !== "number" ||
      Date.now() > envelope.expiresAt
    ) {
      remove(key);
      return fallback;
    }
    if (!isValid(envelope.data, validator)) {
      remove(key);
      return fallback;
    }
    return envelope.data;
  }

  /**
   * Checks if an item with an expiration envelope is expired.
   * @param {string} key
   * @returns {boolean} True if expired or malformed envelope, false if valid and unexpired.
   */
  function isExpired(key) {
    const envelope = get(key, null);
    if (
      !envelope ||
      typeof envelope !== "object" ||
      !envelope.__cradle_expiry
    ) {
      return false;
    }
    return (
      typeof envelope.expiresAt !== "number" || Date.now() > envelope.expiresAt
    );
  }

  /**
   * Scans keys matching prefix and purges all expired entries.
   * @param {string} [prefix=""]
   * @returns {number} Count of expired keys pruned.
   */
  function pruneExpired(prefix = "") {
    let pruned = 0;
    const matching = keys(prefix);
    for (const key of matching) {
      const envelope = get(key, null);
      if (
        envelope &&
        typeof envelope &&
        envelope.__cradle_expiry &&
        typeof envelope.expiresAt === "number" &&
        Date.now() > envelope.expiresAt
      ) {
        if (remove(key)) pruned++;
      }
    }
    return pruned;
  }

  /* ── Session Storage Adapter for Sensitive / Ephemeral Data ── */
  const sessionMemoryStore = (function () {
    const data = {};
    return {
      get length() {
        return Object.keys(data).length;
      },
      key(i) {
        const k = Object.keys(data);
        return i >= 0 && i < k.length ? k[i] : null;
      },
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
      },
      setItem(k, v) {
        data[k] = String(v);
      },
      removeItem(k) {
        delete data[k];
      },
      clear() {
        for (const k of Object.keys(data)) delete data[k];
      },
    };
  })();

  function isSessionAvailable() {
    try {
      if (typeof sessionStorage === "undefined") return false;
      const probe = "__cradle_session_probe__";
      sessionStorage.setItem(probe, "1");
      sessionStorage.removeItem(probe);
      return true;
    } catch (e) {
      return false;
    }
  }

  function resolveSessionStore() {
    return isSessionAvailable() ? sessionStorage : sessionMemoryStore;
  }

  const session = {
    isAvailable: isSessionAvailable,
    getRaw(key, fallback = null, validator = null) {
      try {
        const raw = resolveSessionStore().getItem(String(key));
        if (raw === null) return fallback;
        if (!isValid(raw, validator)) return fallback;
        return raw;
      } catch (e) {
        return fallback;
      }
    },
    get(key, fallback = null, validator = null) {
      const raw = this.getRaw(key, null);
      if (raw === null) return fallback;
      try {
        const parsed = JSON.parse(raw);
        if (!isValid(parsed, validator)) return fallback;
        return parsed;
      } catch (e) {
        return fallback;
      }
    },
    setRaw(key, value) {
      try {
        resolveSessionStore().setItem(String(key), String(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    set(key, value) {
      return this.setRaw(key, JSON.stringify(value ?? null));
    },
    remove(key) {
      try {
        resolveSessionStore().removeItem(String(key));
        return true;
      } catch (e) {
        return false;
      }
    },
    keys(prefix = "") {
      const p = String(prefix);
      const out = [];
      try {
        const store = resolveSessionStore();
        if (typeof store.length === "number") {
          for (let i = 0; i < store.length; i++) {
            const k = store.key(i);
            if (k != null && String(k).startsWith(p)) out.push(String(k));
          }
        }
      } catch (e) {}
      return out.sort();
    },
    clear(prefix = "") {
      let removed = 0;
      for (const k of this.keys(prefix)) {
        if (this.remove(k)) removed++;
      }
      return removed;
    },
    namespace(prefix) {
      const p = String(prefix);
      return {
        get: (key, fallback, validator) =>
          session.get(p + key, fallback, validator),
        getRaw: (key, fallback, validator) =>
          session.getRaw(p + key, fallback, validator),
        set: (key, value) => session.set(p + key, value),
        setRaw: (key, value) => session.setRaw(p + key, value),
        remove: key => session.remove(p + key),
        keys: () => session.keys(p),
        clear: () => session.clear(p),
      };
    },
  };

  /**
   * Create a namespaced handle so callers never repeat a key prefix.
   * All keys are stored as `prefix + key`.
   * @param {string} prefix e.g. "cradle_rps_"
   * @returns {{
   *   get: Function, getRaw: Function, getNumber: Function,
   *   set: Function, setRaw: Function, setNumber: Function,
   *   remove: Function, keys: Function, clear: Function
   * }}
   */
  /**
   * Register a custom mini namespace.
   * @param {string} prefix
   * @param {Object} [metadata]
   */
  function registerNamespace(prefix, metadata = {}) {
    if (!prefix) return;
    const p = String(prefix);
    registeredNamespaces.set(p, metadata || {});
  }

  function namespace(prefix, metadata = {}) {
    const p = String(prefix);
    registerNamespace(p, metadata);
    return {
      get: (key, fallback, validator) => get(p + key, fallback, validator),
      getRaw: (key, fallback, validator) =>
        getRaw(p + key, fallback, validator),
      getNumber: (key, fallback, options) =>
        getNumber(p + key, fallback, options),
      set: (key, value) => set(p + key, value),
      setRaw: (key, value) => setRaw(p + key, value),
      setNumber: (key, value, options) => setNumber(p + key, value, options),
      remove: key => remove(p + key),
      keys: () => keys(p),
      clear: () => clear(p),
      setWithExpiry: (key, value, ttlMs) =>
        setWithExpiry(p + key, value, ttlMs),
      getWithExpiry: (key, fallback, validator) =>
        getWithExpiry(p + key, fallback, validator),
      isExpired: key => isExpired(p + key),
      pruneExpired: () => pruneExpired(p),
    };
  }

  /**
   * Estimate byte footprint of a string key/value pair in UTF-16 bytes.
   * @param {string} key
   * @param {*} value
   * @returns {number}
   */
  function calculateByteSize(key, value) {
    const kLen = key ? String(key).length * 2 : 0;
    const vLen = value != null ? String(value).length * 2 : 0;
    return kLen + vLen;
  }

  /**
   * Format bytes into human-readable unit (B, KB, MB).
   * @param {number} bytes
   * @returns {string}
   */
  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Determine whether a key belongs to a Cradle mini and return its metadata.
   * Internal landing-page keys and unrelated keys return null.
   * @param {string} key
   * @returns {{ id: string, title: string }|null}
   */
  function identifyMini(key) {
    if (!key || typeof key !== "string") return null;
    const k = key.trim();

    // Landing page & system internal keys are not minis
    if (
      k === "theme" ||
      k === "cradle_theme" ||
      k === "cradle:recent-projects" ||
      k === "cradle:recent-projects-collapsed" ||
      k === "__cradle_storage_probe__" ||
      k.startsWith("__cradle_")
    ) {
      return null;
    }

    // Check dynamically registered namespaces
    for (const [ns, meta] of registeredNamespaces.entries()) {
      if (k.startsWith(ns)) {
        if (meta && meta.id && meta.title) {
          return { id: meta.id, title: meta.title };
        }
        const cleanNs = ns.replace(/^cradle[_:-]?/i, "").replace(/[_:-]+$/, "");
        const slug = KNOWN_ALIASES[cleanNs] || cleanNs.replace(/_/g, "-");
        const title =
          (meta && meta.title) || KNOWN_PROJECTS[slug] || titleCase(cleanNs);
        return { id: slug, title };
      }
    }

    // Must have a cradle prefix or have been written through CradleStorage
    const match = k.match(/^cradle[_:-](.+)$/i);
    let remainder = match ? match[1] : null;

    if (!remainder) {
      // If written through CradleStorage and contains a namespace separator
      if (writtenThroughCradle.has(k)) {
        const parts = k.split(/[_:-]/);
        if (parts.length > 1) {
          const first = parts[0].toLowerCase();
          const slug = KNOWN_ALIASES[first] || first.replace(/_/g, "-");
          const title = KNOWN_PROJECTS[slug] || titleCase(first);
          return { id: slug, title };
        }
      }
      return null;
    }

    const candidate = remainder.toLowerCase();

    // Match known aliases by length descending
    const aliases = Object.keys(KNOWN_ALIASES).sort(
      (a, b) => b.length - a.length
    );
    for (const alias of aliases) {
      if (
        candidate === alias ||
        candidate.startsWith(alias + "_") ||
        candidate.startsWith(alias + "-")
      ) {
        const slug = KNOWN_ALIASES[alias];
        const title = KNOWN_PROJECTS[slug] || titleCase(slug);
        return { id: slug, title };
      }
    }

    // Match known project slugs by length descending
    const slugs = Object.keys(KNOWN_PROJECTS).sort(
      (a, b) => b.length - a.length
    );
    for (const slug of slugs) {
      const slugUnderscore = slug.replace(/-/g, "_");
      if (
        candidate === slug ||
        candidate === slugUnderscore ||
        candidate.startsWith(slug + "_") ||
        candidate.startsWith(slug + "-") ||
        candidate.startsWith(slugUnderscore + "_") ||
        candidate.startsWith(slugUnderscore + "-")
      ) {
        return { id: slug, title: KNOWN_PROJECTS[slug] };
      }
    }

    // Fallback: derive mini from the first segment
    const token = candidate.split(/[_:-]/)[0];
    if (token) {
      const slug = token.replace(/_/g, "-");
      return { id: slug, title: titleCase(token) };
    }

    return null;
  }

  /**
   * List stored keys grouped by mini with approximate sizes.
   * Only includes keys written through CradleStorage for minis.
   * @returns {Array<{
   *   id: string,
   *   title: string,
   *   keys: Array<{ key: string, value: string|null, bytes: number, formattedSize: string }>,
   *   totalBytes: number,
   *   formattedTotalSize: string
   * }>}
   */
  function getStoredMinisData() {
    const store = resolveStore();
    const allKeys = storageKeys();
    const miniMap = new Map();

    for (const key of allKeys) {
      const mini = identifyMini(key);
      if (!mini) continue;

      let rawValue = null;
      try {
        rawValue = store.getItem(key);
      } catch (e) {
        rawValue = null;
      }

      const bytes = calculateByteSize(key, rawValue);
      const keyInfo = {
        key,
        value: rawValue,
        bytes,
        formattedSize: formatBytes(bytes),
      };

      if (!miniMap.has(mini.id)) {
        miniMap.set(mini.id, {
          id: mini.id,
          title: mini.title,
          keys: [],
          totalBytes: 0,
          formattedTotalSize: "0 B",
        });
      }

      const group = miniMap.get(mini.id);
      group.keys.push(keyInfo);
      group.totalBytes += bytes;
      group.formattedTotalSize = formatBytes(group.totalBytes);
    }

    // Sort keys within each group alphabetically
    for (const group of miniMap.values()) {
      group.keys.sort((a, b) => a.key.localeCompare(b.key));
    }

    // Sort minis alphabetically by title
    return Array.from(miniMap.values()).sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }

  /**
   * Clear all stored data for a single mini without affecting others.
   * Only touches keys written through CradleStorage for this mini.
   * @param {string} miniId Mini id or title
   * @returns {number} Number of keys removed
   */
  function clearMini(miniId) {
    if (!miniId) return 0;
    const targetId = String(miniId).toLowerCase().trim();
    const allKeys = storageKeys();
    let removedCount = 0;

    for (const key of allKeys) {
      const mini = identifyMini(key);
      if (
        mini &&
        (mini.id.toLowerCase() === targetId ||
          mini.title.toLowerCase() === targetId)
      ) {
        if (remove(key)) {
          removedCount++;
        }
      }
    }

    return removedCount;
  }

  /**
   * Clear stored data across all minis without touching unrelated localStorage keys.
   * @returns {number} Total number of mini keys removed
   */
  function clearAllMinis() {
    const allKeys = storageKeys();
    let removedCount = 0;

    for (const key of allKeys) {
      const mini = identifyMini(key);
      if (mini) {
        if (remove(key)) {
          removedCount++;
        }
      }
    }

    return removedCount;
  }

  exports.isAvailable = isAvailable;
  exports.isValid = isValid;
  exports.getRaw = getRaw;
  exports.get = get;
  exports.getNumber = getNumber;
  exports.setRaw = setRaw;
  exports.set = set;
  exports.setNumber = setNumber;
  exports.clampNumber = clampNumber;
  exports.validateBoundedNumber = validateBoundedNumber;
  exports.remove = remove;
  exports.keys = keys;
  exports.clear = clear;
  exports.namespace = namespace;
  exports.setWithExpiry = setWithExpiry;
  exports.getWithExpiry = getWithExpiry;
  exports.isExpired = isExpired;
  exports.pruneExpired = pruneExpired;
  exports.session = session;
  exports.registerNamespace = registerNamespace;
  exports.calculateByteSize = calculateByteSize;
  exports.formatBytes = formatBytes;
  exports.identifyMini = identifyMini;
  exports.getStoredMinisData = getStoredMinisData;
  exports.clearMini = clearMini;
  exports.clearAllMinis = clearAllMinis;
})(typeof exports === "undefined" ? (window.CradleStorage = {}) : exports);
