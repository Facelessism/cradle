const test = require("node:test");
const assert = require("node:assert/strict");
const storage = require("../src/components/ui/storage.js");
const { setupLocalStorageMock } = require("./helpers/localstorage-mock");

setupLocalStorageMock();

test("isAvailable is true with a working localStorage", () => {
  assert.equal(storage.isAvailable(), true);
});

test("set/get round-trips JSON values", () => {
  localStorage.clear();
  assert.equal(storage.get("missing"), null);
  assert.equal(storage.get("missing", { fallback: true }).fallback, true);

  const obj = { wins: 3, tags: ["a", "b"] };
  storage.set("cradle_test_obj", obj);
  assert.deepEqual(storage.get("cradle_test_obj"), obj);

  storage.set("cradle_test_num", 42);
  assert.equal(storage.get("cradle_test_num"), 42);

  storage.set("cradle_test_bool", false);
  assert.equal(storage.get("cradle_test_bool"), false);
});

test("get returns fallback for corrupt JSON", () => {
  localStorage.clear();
  storage.setRaw("cradle_test_broken", "{not valid json");
  assert.equal(storage.get("cradle_test_broken", "default"), "default");
});

test("getRaw/setRaw store verbatim strings", () => {
  localStorage.clear();
  storage.setRaw("cradle_test_theme", "dark");
  assert.equal(storage.getRaw("cradle_test_theme"), "dark");
  assert.equal(storage.getRaw("cradle_test_missing", "light"), "light");
});

test("remove deletes a single key", () => {
  localStorage.clear();
  storage.set("cradle_test_tmp", { a: 1 });
  assert.equal(storage.remove("cradle_test_tmp"), true);
  assert.equal(storage.get("cradle_test_tmp"), null);
});

test("keys filters by prefix and returns sorted results", () => {
  localStorage.clear();
  storage.set("cradle_k_alpha", 1);
  storage.set("cradle_k_beta", 2);
  storage.set("other_key", 3);
  assert.deepEqual(storage.keys("cradle_k_"), [
    "cradle_k_alpha",
    "cradle_k_beta",
  ]);
  assert.deepEqual(storage.keys("nope"), []);
  assert.deepEqual(storage.keys(), [
    "cradle_k_alpha",
    "cradle_k_beta",
    "other_key",
  ]);
});

test("clear removes only matching keys and reports count", () => {
  localStorage.clear();
  storage.set("cradle_c_a", 1);
  storage.set("cradle_c_b", 2);
  storage.set("keep_me", 3);
  const removed = storage.clear("cradle_c_");
  assert.equal(removed, 2);
  assert.equal(storage.get("cradle_c_a"), null);
  assert.equal(storage.get("cradle_c_b"), null);
  assert.equal(storage.get("keep_me"), 3);
});

test("namespace prefixes all operations and scopes clear/keys", () => {
  localStorage.clear();
  const store = storage.namespace("cradle_ns_");
  const other = storage.namespace("cradle_other_");

  store.set("stats", { wins: 1 });
  other.set("stats", { wins: 2 });

  assert.deepEqual(store.get("stats"), { wins: 1 });
  assert.deepEqual(other.get("stats"), { wins: 2 });

  assert.deepEqual(store.keys(), ["cradle_ns_stats"]);
  assert.deepEqual(other.keys(), ["cradle_other_stats"]);

  assert.equal(store.clear(), 1);
  assert.equal(store.get("stats"), null);
  assert.deepEqual(other.get("stats"), { wins: 2 });
});

test("namespace raw helpers round-trip strings", () => {
  localStorage.clear();
  const store = storage.namespace("cradle_nsraw_");
  store.setRaw("theme", "light");
  assert.equal(store.getRaw("theme"), "light");
  assert.equal(store.getRaw("nope", "dark"), "dark");
});
