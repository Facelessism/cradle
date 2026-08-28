const test = require('node:test');
const assert = require('node:assert/strict');

// ── localStorage mock ──────────────────────────────────────────
let store;
let quotaError = false;

function setupMock() {
  store = new Map();
  quotaError = false;

  global.localStorage = {
    get length() { return store.size; },
    key(index) {
      return index >= 0 && index < store.size ? [...store.keys()][index] : null;
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      if (quotaError) {
        const err = new Error('quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
      store.set(key, String(value));
    },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
  };
}

function teardownMock() {
  delete global.localStorage;
}

// ── Import the module ──────────────────────────────────────────
const storageHelper = require('../lib/storageHelper');

// ── Tests ──────────────────────────────────────────────────────

test('isStorageAvailable returns true when localStorage works', () => {
  setupMock();
  assert.equal(storageHelper.isStorageAvailable(), true);
  teardownMock();
});

test('isStorageAvailable returns false when localStorage throws', () => {
  global.localStorage = {
    get length() { return 0; },
    key() { return null; },
    getItem() { return null; },
    setItem() { throw new Error('access denied'); },
    removeItem() {},
    clear() {},
  };
  assert.equal(storageHelper.isStorageAvailable(), false);
  teardownMock();
});

test('isStorageAvailable returns false when localStorage is undefined', () => {
  delete global.localStorage;
  assert.equal(storageHelper.isStorageAvailable(), false);
});

// ── safeGetItem ────────────────────────────────────────────────

test('safeGetItem returns stored value', () => {
  setupMock();
  localStorage.setItem('theme', 'dark');
  assert.equal(storageHelper.safeGetItem('theme'), 'dark');
  teardownMock();
});

test('safeGetItem returns fallback for missing key', () => {
  setupMock();
  assert.equal(storageHelper.safeGetItem('missing', 'default'), 'default');
  teardownMock();
});

test('safeGetItem returns null for missing key without fallback', () => {
  setupMock();
  assert.equal(storageHelper.safeGetItem('missing'), null);
  teardownMock();
});

test('safeGetItem returns fallback when storage throws', () => {
  global.localStorage = {
    get length() { return 0; },
    key() { return null; },
    getItem() { throw new Error('not available'); },
    setItem() {},
    removeItem() {},
    clear() {},
  };
  assert.equal(storageHelper.safeGetItem('key', 'fallback'), 'fallback');
  teardownMock();
});

test('safeGetItem returns fallback when storage is unavailable', () => {
  delete global.localStorage;
  assert.equal(storageHelper.safeGetItem('key', 'fallback'), 'fallback');
});

// ── safeGetJSON ────────────────────────────────────────────────

test('safeGetJSON parses and returns stored JSON', () => {
  setupMock();
  localStorage.setItem('config', JSON.stringify({ mode: 'dark' }));
  const result = storageHelper.safeGetJSON('config');
  assert.deepEqual(result, { mode: 'dark' });
  teardownMock();
});

test('safeGetJSON returns fallback for invalid JSON', () => {
  setupMock();
  localStorage.setItem('config', '{invalid json');
  assert.deepEqual(storageHelper.safeGetJSON('config', {}), {});
  teardownMock();
});

test('safeGetJSON returns fallback for missing key', () => {
  setupMock();
  assert.deepEqual(storageHelper.safeGetJSON('missing', []), []);
  teardownMock();
});

test('safeGetJSON returns fallback when storage is unavailable', () => {
  delete global.localStorage;
  assert.deepEqual(storageHelper.safeGetJSON('key', 'fb'), 'fb');
});

// ── safeSetItem ────────────────────────────────────────────────

test('safeSetItem writes value and returns true', () => {
  setupMock();
  assert.equal(storageHelper.safeSetItem('theme', 'light'), true);
  assert.equal(localStorage.getItem('theme'), 'light');
  teardownMock();
});

test('safeSetItem returns false when storage is unavailable', () => {
  delete global.localStorage;
  assert.equal(storageHelper.safeSetItem('key', 'val'), false);
});

test('safeSetItem returns false on quota exceeded', () => {
  setupMock();
  quotaError = true;
  assert.equal(storageHelper.safeSetItem('key', 'val'), false);
  teardownMock();
});

test('safeSetItem returns false when storage throws', () => {
  global.localStorage = {
    get length() { return 0; },
    key() { return null; },
    getItem() { return null; },
    setItem() { throw new Error('some error'); },
    removeItem() {},
    clear() {},
  };
  assert.equal(storageHelper.safeSetItem('key', 'val'), false);
  teardownMock();
});

// ── safeSetJSON ────────────────────────────────────────────────

test('safeSetJSON serializes and stores object', () => {
  setupMock();
  assert.equal(storageHelper.safeSetJSON('data', { a: 1 }), true);
  assert.deepEqual(JSON.parse(localStorage.getItem('data')), { a: 1 });
  teardownMock();
});

test('safeSetJSON returns false when storage is unavailable', () => {
  delete global.localStorage;
  assert.equal(storageHelper.safeSetJSON('key', {}), false);
});

// ── safeRemoveItem ─────────────────────────────────────────────

test('safeRemoveItem removes key and returns true', () => {
  setupMock();
  localStorage.setItem('temp', 'data');
  assert.equal(storageHelper.safeRemoveItem('temp'), true);
  assert.equal(localStorage.getItem('temp'), null);
  teardownMock();
});

test('safeRemoveItem returns false when storage is unavailable', () => {
  delete global.localStorage;
  assert.equal(storageHelper.safeRemoveItem('key'), false);
});

test('safeRemoveItem returns true when key does not exist', () => {
  setupMock();
  assert.equal(storageHelper.safeRemoveItem('nonexistent'), true);
  teardownMock();
});

// ── safeClear ──────────────────────────────────────────────────

test('safeClear removes all keys and returns true', () => {
  setupMock();
  localStorage.setItem('a', '1');
  localStorage.setItem('b', '2');
  assert.equal(storageHelper.safeClear(), true);
  assert.equal(localStorage.length, 0);
  teardownMock();
});

test('safeClear returns false when storage is unavailable', () => {
  delete global.localStorage;
  assert.equal(storageHelper.safeClear(), false);
});

// ── getStorageUsage ────────────────────────────────────────────

test('getStorageUsage reports 0 when storage is unavailable', () => {
  delete global.localStorage;
  const usage = storageHelper.getStorageUsage();
  assert.equal(usage.used, 0);
  assert.equal(usage.available, 0);
  assert.equal(usage.formattedUsed, '0 B');
});

test('getStorageUsage reports bytes for stored data', () => {
  setupMock();
  localStorage.setItem('key', 'value');
  const usage = storageHelper.getStorageUsage();
  assert.ok(usage.used > 0);
  assert.ok(usage.available > 0);
  assert.ok(usage.formattedUsed.includes('B'));
  teardownMock();
});

test('getStorageUsage formats KB for larger data', () => {
  setupMock();
  // Store ~2KB of data
  const bigValue = 'x'.repeat(1000);
  localStorage.setItem('big', bigValue);
  const usage = storageHelper.getStorageUsage();
  assert.ok(usage.used > 1024);
  assert.ok(usage.formattedUsed.includes('KB'));
  teardownMock();
});

// ── Module export ──────────────────────────────────────────────

test('exports all expected functions', () => {
  assert.equal(typeof storageHelper.isStorageAvailable, 'function');
  assert.equal(typeof storageHelper.safeGetItem, 'function');
  assert.equal(typeof storageHelper.safeGetJSON, 'function');
  assert.equal(typeof storageHelper.safeSetItem, 'function');
  assert.equal(typeof storageHelper.safeSetJSON, 'function');
  assert.equal(typeof storageHelper.safeRemoveItem, 'function');
  assert.equal(typeof storageHelper.safeClear, 'function');
  assert.equal(typeof storageHelper.getStorageUsage, 'function');
});
