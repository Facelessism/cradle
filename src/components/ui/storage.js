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
 *   - Raw string helpers (`getRaw` / `setRaw`) for plain values such as
 *     theme names or high scores.
 *   - Namespaced handles (`namespace`) plus `keys` / `clear` for consistent
 *     prefix-based key handling.
 *
 * Usage (HTML):
 *   <script src="../../../src/components/ui/storage.js"></script>
 *   ...
 *   const settings = CradleStorage.get("cradle_settings", {});
 *   CradleStorage.set("cradle_settings", { theme: "dark" });
 *
 * Usage (namespace):
 *   const store = CradleStorage.namespace("cradle_rps_");
 *   store.set("stats", { wins: 1 });   // writes "cradle_rps_stats"
 *   store.get("stats", {});            // reads "cradle_rps_stats"
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
   * Read a raw (unparsed) string value.
   * @param {string} key
   * @param {*} [fallback=null] Returned when the key is missing or storage
   *                            is unavailable.
   * @returns {string|null}
   */
  function getRaw(key, fallback = null) {
    try {
      const raw = resolveStore().getItem(String(key));
      return raw === null ? fallback : raw;
    } catch (e) {
      return fallback;
    }
  }

  /**
   * Read a JSON-serialized value.
   * @param {string} key
   * @param {*} [fallback=null] Returned when the key is missing, corrupt,
   *                            or storage is unavailable.
   * @returns {*}
   */
  function get(key, fallback = null) {
    const raw = getRaw(key, null);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
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
   * Create a namespaced handle so callers never repeat a key prefix.
   * All keys are stored as `prefix + key`.
   * @param {string} prefix e.g. "cradle_rps_"
   * @returns {{
   *   get: Function, getRaw: Function,
   *   set: Function, setRaw: Function,
   *   remove: Function, keys: Function, clear: Function
   * }}
   */
  function namespace(prefix) {
    const p = String(prefix);
    return {
      get: (key, fallback) => get(p + key, fallback),
      getRaw: (key, fallback) => getRaw(p + key, fallback),
      set: (key, value) => set(p + key, value),
      setRaw: (key, value) => setRaw(p + key, value),
      remove: key => remove(p + key),
      keys: () => keys(p),
      clear: () => clear(p),
    };
  }

  exports.isAvailable = isAvailable;
  exports.getRaw = getRaw;
  exports.get = get;
  exports.setRaw = setRaw;
  exports.set = set;
  exports.remove = remove;
  exports.keys = keys;
  exports.clear = clear;
  exports.namespace = namespace;
})(typeof exports === "undefined" ? (window.CradleStorage = {}) : exports);
