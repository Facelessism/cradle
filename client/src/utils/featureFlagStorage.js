/**
 * In-Memory Transient Fallback Store
 * Used if browser sandbox settings block access to localStorage or sessionStorage.
 */
class TransientMemoryStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

/**
 * Resolves the safest available storage provider.
 * Catches SecurityError configurations when cookies/local storage are blocked.
 */
export function getFeatureFlagStorage() {
  try {
    // Attempt dummy interaction to verify storage read/write accessibility
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (error) {
    console.warn(
      '[FEATURE FLAGS] Persistent storage API access is blocked or unavailable. ' +
      'Engaging safe-mode transient in-memory storage fallback.',
      error
    );
    return new TransientMemoryStorage();
  }
}

// Singleton storage provider allocation instance
const flagStorage = getFeatureFlagStorage();
export default flagStorage;
