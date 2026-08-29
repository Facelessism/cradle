function setupLocalStorageMock() {
  const store = new Map();

  global.localStorage = {
    get length() {
      return store.size;
    },
    key(index) {
      const idx = Number(index);
      return idx >= 0 && idx < store.size ? [...store.keys()][idx] : null;
    },
    getItem(key) {
      const k = String(key);
      return store.has(k) ? store.get(k) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  };

  try {
    const { beforeEach, afterEach } = require("node:test");
    if (typeof beforeEach === "function" && typeof afterEach === "function") {
      beforeEach(() => {
        if (global.localStorage && typeof global.localStorage.clear === "function") {
          global.localStorage.clear();
        }
      });
      afterEach(() => {
        if (global.localStorage && typeof global.localStorage.clear === "function") {
          global.localStorage.clear();
        }
      });
    }
  } catch (e) {
    // Ignore if hooks cannot be bound
  }

  store.clear();
  return global.localStorage;
}

function resetLocalStorageMock() {
  if (global.localStorage && typeof global.localStorage.clear === "function") {
    global.localStorage.clear();
  }
}

module.exports = { setupLocalStorageMock, resetLocalStorageMock };

