function setupLocalStorageMock() {
  const store = new Map();

  global.localStorage = {
    get length() {
      return store.size;
    },
    key(index) {
      return index >= 0 && index < store.size ? [...store.keys()][index] : null;
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

module.exports = { setupLocalStorageMock };
