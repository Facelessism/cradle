"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const storagePath = path.resolve(__dirname, "../src/components/ui/storage.js");

function loadStorage({ localStorage } = {}) {
  delete require.cache[storagePath];
  const previous = global.localStorage;
  if (localStorage === undefined) delete global.localStorage;
  else global.localStorage = localStorage;
  const storage = require(storagePath);
  return {
    storage,
    restore() {
      delete require.cache[storagePath];
      if (previous === undefined) delete global.localStorage;
      else global.localStorage = previous;
    },
  };
}

class MockStorage {
  constructor({ failWrites = false } = {}) {
    this.data = new Map();
    this.failWrites = failWrites;
  }
  get length() {
    return this.data.size;
  }
  key(index) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  getItem(key) {
    return this.data.has(String(key)) ? this.data.get(String(key)) : null;
  }
  setItem(key, value) {
    if (this.failWrites) throw new Error("storage unavailable");
    this.data.set(String(key), String(value));
  }
  removeItem(key) {
    this.data.delete(String(key));
  }
  clear() {
    this.data.clear();
  }
}

test("getRaw returns raw values and fallback for missing keys", () => {
  const localStorage = new MockStorage();
  const { storage, restore } = loadStorage({ localStorage });
  try {
    localStorage.setItem("name", "Alice");
    assert.equal(storage.getRaw("name"), "Alice");
    assert.equal(storage.getRaw("missing", "fallback"), "fallback");
    assert.equal(storage.getRaw("missing"), null);
  } finally {
    restore();
  }
});

test("setRaw stores values as strings and reports success", () => {
  const localStorage = new MockStorage();
  const { storage, restore } = loadStorage({ localStorage });
  try {
    assert.equal(storage.setRaw("count", 42), true);
    assert.equal(localStorage.getItem("count"), "42");
    assert.equal(storage.setRaw("flag", false), true);
    assert.equal(storage.getRaw("flag"), "false");
  } finally {
    restore();
  }
});

test("set and get round-trip JSON values", () => {
  const localStorage = new MockStorage();
  const { storage, restore } = loadStorage({ localStorage });
  try {
    const value = { theme: "dark", enabled: true, items: [1, 2, 3] };
    assert.equal(storage.set("settings", value), true);
    assert.equal(localStorage.getItem("settings"), JSON.stringify(value));
    assert.deepEqual(storage.get("settings"), value);
    assert.equal(storage.set("empty", undefined), true);
    assert.equal(storage.get("empty"), null);
  } finally {
    restore();
  }
});

test("get returns the fallback for corrupted JSON", () => {
  const localStorage = new MockStorage();
  const { storage, restore } = loadStorage({ localStorage });
  try {
    localStorage.setItem("broken", "{not valid json");
    assert.deepEqual(storage.get("broken", { safe: true }), { safe: true });
  } finally {
    restore();
  }
});

test("remove deletes one key and reports success", () => {
  const localStorage = new MockStorage();
  const { storage, restore } = loadStorage({ localStorage });
  try {
    storage.setRaw("one", "1");
    storage.setRaw("two", "2");
    assert.equal(storage.remove("one"), true);
    assert.equal(storage.getRaw("one"), null);
    assert.equal(storage.getRaw("two"), "2");
  } finally {
    restore();
  }
});

test("keys lists all keys, filters by prefix, and sorts results", () => {
  const localStorage = new MockStorage();
  const { storage, restore } = loadStorage({ localStorage });
  try {
    storage.setRaw("zeta", "1");
    storage.setRaw("cradle_b", "2");
    storage.setRaw("cradle_a", "3");
    storage.setRaw("alpha", "4");
    assert.deepEqual(storage.keys(), ["alpha", "cradle_a", "cradle_b", "zeta"]);
    assert.deepEqual(storage.keys("cradle_"), ["cradle_a", "cradle_b"]);
  } finally {
    restore();
  }
});

test("clear removes matching keys and returns the number removed", () => {
  const localStorage = new MockStorage();
  const { storage, restore } = loadStorage({ localStorage });
  try {
    storage.setRaw("app_one", "1");
    storage.setRaw("app_two", "2");
    storage.setRaw("other", "3");
    assert.equal(storage.clear("app_"), 2);
    assert.deepEqual(storage.keys(), ["other"]);
    assert.equal(storage.clear(), 1);
    assert.deepEqual(storage.keys(), []);
  } finally {
    restore();
  }
});

test("namespace prefixes keys while exposing the storage API", () => {
  const localStorage = new MockStorage();
  const { storage, restore } = loadStorage({ localStorage });
  try {
    const store = storage.namespace("cradle_rps_");
    assert.equal(store.set("stats", { wins: 3 }), true);
    assert.deepEqual(store.get("stats"), { wins: 3 });
    assert.equal(localStorage.getItem("cradle_rps_stats"), '{"wins":3}');
    assert.equal(store.setRaw("name", "rock"), true);
    assert.equal(store.getRaw("name"), "rock");
    assert.deepEqual(store.keys(), ["cradle_rps_name", "cradle_rps_stats"]);
    assert.equal(store.remove("name"), true);
    assert.deepEqual(store.keys(), ["cradle_rps_stats"]);
    assert.equal(store.clear(), 1);
    assert.deepEqual(storage.keys(), []);
  } finally {
    restore();
  }
});

test("namespace converts non-string prefixes and keys consistently", () => {
  const localStorage = new MockStorage();
  const { storage, restore } = loadStorage({ localStorage });
  try {
    const store = storage.namespace(123);
    assert.equal(store.set(456, "value"), true);
    assert.equal(localStorage.getItem("123456"), '"value"');
    assert.equal(store.get(456), "value");
  } finally {
    restore();
  }
});

test("falls back to memory storage when localStorage is unavailable", () => {
  const { storage, restore } = loadStorage();
  try {
    assert.equal(storage.isAvailable(), false);
    assert.equal(storage.setRaw("offline", "works"), true);
    assert.equal(storage.getRaw("offline"), "works");
    assert.equal(storage.set("json", { ok: true }), true);
    assert.deepEqual(storage.get("json"), { ok: true });
    assert.deepEqual(storage.keys(), ["json", "offline"]);
    assert.equal(storage.remove("offline"), true);
    assert.equal(storage.getRaw("offline"), null);
  } finally {
    restore();
  }
});

test("uses memory fallback when localStorage exists but rejects writes", () => {
  const localStorage = new MockStorage({ failWrites: true });
  const { storage, restore } = loadStorage({ localStorage });
  try {
    assert.equal(storage.isAvailable(), false);
    assert.equal(storage.setRaw("private", "fallback"), true);
    assert.equal(storage.getRaw("private"), "fallback");
    assert.deepEqual(storage.keys(), ["private"]);
  } finally {
    restore();
  }
});

test("isAvailable caches successful availability without probing repeatedly", () => {
  let probes = 0;
  const localStorage = new MockStorage();
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key, value) => {
    probes += 1;
    originalSetItem(key, value);
  };
  const { storage, restore } = loadStorage({ localStorage });
  try {
    assert.equal(storage.isAvailable(), true);
    assert.equal(storage.isAvailable(), true);
    assert.equal(probes, 1);
  } finally {
    restore();
  }
});

test("get with validator function accepts valid parsed schema and falls back on invalid", () => {
  const localStorage = new MockStorage();
  const { storage, restore } = loadStorage({ localStorage });
  try {
    const isUserSettings = s =>
      s &&
      typeof s === "object" &&
      typeof s.theme === "string" &&
      typeof s.volume === "number";

    localStorage.setItem(
      "settings",
      JSON.stringify({ theme: "dark", volume: 80 })
    );
    assert.deepEqual(
      storage.get("settings", { theme: "light", volume: 50 }, isUserSettings),
      {
        theme: "dark",
        volume: 80,
      }
    );

    // Incompatible / malformed schema
    localStorage.setItem(
      "settings",
      JSON.stringify({ theme: 123, volume: "loud" })
    );
    assert.deepEqual(
      storage.get("settings", { theme: "light", volume: 50 }, isUserSettings),
      {
        theme: "light",
        volume: 50,
      }
    );

    // Corrupted non-object value (e.g. integer stored instead of object)
    localStorage.setItem("settings", "12345");
    assert.deepEqual(
      storage.get("settings", { theme: "light", volume: 50 }, isUserSettings),
      {
        theme: "light",
        volume: 50,
      }
    );

    // Validator that throws an error safely falls back
    const throwingValidator = () => {
      throw new Error("schema validation crash");
    };
    assert.deepEqual(
      storage.get("settings", { fallback: true }, throwingValidator),
      {
        fallback: true,
      }
    );
  } finally {
    restore();
  }
});

test("getRaw with validator function validates raw string values", () => {
  const localStorage = new MockStorage();
  const { storage, restore } = loadStorage({ localStorage });
  try {
    const isSupportedTheme = val =>
      ["dark", "light", "high-contrast"].includes(val);

    localStorage.setItem("theme", "dark");
    assert.equal(storage.getRaw("theme", "light", isSupportedTheme), "dark");

    localStorage.setItem("theme", "malicious-injected-theme");
    assert.equal(storage.getRaw("theme", "light", isSupportedTheme), "light");
  } finally {
    restore();
  }
});

test("namespace forwards validator parameter on get and getRaw", () => {
  const localStorage = new MockStorage();
  const { storage, restore } = loadStorage({ localStorage });
  try {
    const store = storage.namespace("cradle_game_");
    const isScore = s => typeof s === "number" && s >= 0;

    store.set("high_score", 1500);
    assert.equal(store.get("high_score", 0, isScore), 1500);

    // Corrupted state (negative or string)
    store.set("high_score", -100);
    assert.equal(store.get("high_score", 0, isScore), 0);

    store.setRaw("player_name", "Player1");
    assert.equal(
      store.getRaw("player_name", "Anonymous", name => name.length <= 10),
      "Player1"
    );

    store.setRaw("player_name", "VeryLongDisallowedNameThatExceedsLimit");
    assert.equal(
      store.getRaw("player_name", "Anonymous", name => name.length <= 10),
      "Anonymous"
    );
  } finally {
    restore();
  }
});
