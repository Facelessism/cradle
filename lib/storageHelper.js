/**
 * @fileoverview Defensive localStorage helpers.
 *
 * Provides safe wrappers around localStorage that handle:
 * - Storage unavailable (private browsing, disabled storage, non-browser envs)
 * - Quota exhaustion (QuotaExceededError on write)
 * - Corrupt or missing JSON (parse errors on read)
 *
 * Usage:
 *   const { safeGetItem, safeSetItem, safeRemoveItem, safeClear } = require('./lib/storageHelper');
 *   safeSetItem('theme', 'dark');         // returns true on success, false on failure
 *   const theme = safeGetItem('theme');    // returns value or null
 *   safeRemoveItem('theme');              // returns true on success
 *   safeClear();                          // returns true on success
 */

const STORAGE_KEY_PREFIX = '';

/**
 * Detect whether localStorage is available and usable.
 *
 * Tries a write/read/delete round-trip because some browsers expose
 * the localStorage object but throw on actual access (e.g. some
 * private-browsing modes).
 *
 * @returns {boolean}
 */
function isStorageAvailable() {
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) {
      return false;
    }
    // Round-trip test
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Safely read a value from localStorage.
 *
 * @param {string} key - The storage key.
 * @param {*} [fallback=null] - Value returned if the key doesn't exist or storage is unavailable.
 * @returns {*} The stored value (string) or fallback.
 */
function safeGetItem(key, fallback = null) {
  try {
    if (!isStorageAvailable()) return fallback;
    const value = localStorage.getItem(key);
    return value !== null ? value : fallback;
  } catch (e) {
    console.warn(`[storageHelper] Failed to read "${key}":`, e.message);
    return fallback;
  }
}

/**
 * Safely read and parse a JSON value from localStorage.
 *
 * @param {string} key - The storage key.
 * @param {*} [fallback=null] - Value returned if key doesn't exist, parse fails, or storage is unavailable.
 * @returns {*} The parsed value or fallback.
 */
function safeGetJSON(key, fallback = null) {
  try {
    const raw = safeGetItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[storageHelper] Failed to parse JSON for "${key}":`, e.message);
    return fallback;
  }
}

/**
 * Safely write a value to localStorage.
 *
 * @param {string} key - The storage key.
 * @param {*} value - The value to store (will be coerced to string).
 * @returns {boolean} true on success, false on failure.
 */
function safeSetItem(key, value) {
  try {
    if (!isStorageAvailable()) return false;
    localStorage.setItem(key, String(value));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
      console.warn(
        `[storageHelper] Storage quota exceeded while writing "${key}". ` +
        'Consider clearing old data or using a smaller payload.'
      );
    } else {
      console.warn(`[storageHelper] Failed to write "${key}":`, e.message);
    }
    return false;
  }
}

/**
 * Safely write a JSON-serializable value to localStorage.
 *
 * @param {string} key - The storage key.
 * @param {*} value - The value to serialize and store.
 * @returns {boolean} true on success, false on failure.
 */
function safeSetJSON(key, value) {
  try {
    return safeSetItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[storageHelper] Failed to serialize JSON for "${key}":`, e.message);
    return false;
  }
}

/**
 * Safely remove a key from localStorage.
 *
 * @param {string} key - The storage key.
 * @returns {boolean} true on success, false on failure.
 */
function safeRemoveItem(key) {
  try {
    if (!isStorageAvailable()) return false;
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn(`[storageHelper] Failed to remove "${key}":`, e.message);
    return false;
  }
}

/**
 * Safely clear all keys from localStorage.
 *
 * @returns {boolean} true on success, false on failure.
 */
function safeClear() {
  try {
    if (!isStorageAvailable()) return false;
    localStorage.clear();
    return true;
  } catch (e) {
    console.warn('[storageHelper] Failed to clear storage:', e.message);
    return false;
  }
}

/**
 * Get the total byte usage of localStorage (UTF-16).
 *
 * @returns {{ used: number, available: number, formattedUsed: string }} Storage usage info.
 */
function getStorageUsage() {
  let used = 0;
  try {
    if (!isStorageAvailable()) {
      return { used: 0, available: 0, formattedUsed: '0 B' };
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key) || '';
      used += (key.length + value.length) * 2; // UTF-16
    }
  } catch (e) {
    // Ignore errors
  }

  // Typical limit is 5MB (5 * 1024 * 1024 = 5,242,880 bytes)
  const available = 5 * 1024 * 1024 - used;
  const formattedUsed = used < 1024
    ? `${used} B`
    : used < 1024 * 1024
      ? `${(used / 1024).toFixed(2)} KB`
      : `${(used / (1024 * 1024)).toFixed(2)} MB`;

  return { used, available, formattedUsed };
}

// ── Module export ──────────────────────────────────────────────
(function (root) {
  const api = {
    isStorageAvailable,
    safeGetItem,
    safeGetJSON,
    safeSetItem,
    safeSetJSON,
    safeRemoveItem,
    safeClear,
    getStorageUsage,
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.StorageHelper = api;
})(typeof self !== 'undefined' ? self : this);
