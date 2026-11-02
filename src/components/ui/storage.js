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
    if (!envelope || typeof envelope !== "object" || !envelope.__cradle_expiry) {
      return fallback;
    }
    if (typeof envelope.expiresAt !== "number" || Date.now() > envelope.expiresAt) {
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
    if (!envelope || typeof envelope !== "object" || !envelope.__cradle_expiry) {
      return false;
    }
    return typeof envelope.expiresAt !== "number" || Date.now() > envelope.expiresAt;
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
      get length() { return Object.keys(data).length; },
      key(i) { const k = Object.keys(data); return i >= 0 && i < k.length ? k[i] : null; },
      getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem(k, v) { data[k] = String(v); },
      removeItem(k) { delete data[k]; },
      clear() { for (const k of Object.keys(data)) delete data[k]; },
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
        get: (key, fallback, validator) => session.get(p + key, fallback, validator),
        getRaw: (key, fallback, validator) => session.getRaw(p + key, fallback, validator),
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
  function namespace(prefix) {
    const p = String(prefix);
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
      setWithExpiry: (key, value, ttlMs) => setWithExpiry(p + key, value, ttlMs),
      getWithExpiry: (key, fallback, validator) => getWithExpiry(p + key, fallback, validator),
      isExpired: key => isExpired(p + key),
      pruneExpired: () => pruneExpired(p),
    };
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
})(typeof exports === "undefined" ? (window.CradleStorage = {}) : exports);
