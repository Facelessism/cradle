const test = require("node:test");
const assert = require("node:assert/strict");
const {
  setupLocalStorageMock,
  resetLocalStorageMock,
} = require("./helpers/localstorage-mock");

setupLocalStorageMock();

test("test 1: stores a value under a shared key", () => {
  assert.equal(localStorage.getItem("sharedKey"), null);
  assert.equal(localStorage.length, 0);

  localStorage.setItem("sharedKey", "test1_value");
  assert.equal(localStorage.getItem("sharedKey"), "test1_value");
  assert.equal(localStorage.length, 1);
});

test("test 2: shared key is isolated and reset to null at start of next test", () => {
  // Value set in test 1 must NOT leak into test 2
  assert.equal(localStorage.getItem("sharedKey"), null);
  assert.equal(localStorage.length, 0);

  localStorage.setItem("sharedKey", "test2_value");
  assert.equal(localStorage.getItem("sharedKey"), "test2_value");
  assert.equal(localStorage.length, 1);
});

test("test 3: clear() removes all stored keys and resets length", () => {
  localStorage.setItem("k1", "v1");
  localStorage.setItem("k2", "v2");
  assert.equal(localStorage.length, 2);

  localStorage.clear();
  assert.equal(localStorage.length, 0);
  assert.equal(localStorage.getItem("k1"), null);
  assert.equal(localStorage.getItem("k2"), null);
});

test("test 4: removeItem() removes only the requested key", () => {
  localStorage.setItem("keep", "1");
  localStorage.setItem("remove", "2");
  assert.equal(localStorage.length, 2);

  localStorage.removeItem("remove");
  assert.equal(localStorage.length, 1);
  assert.equal(localStorage.getItem("keep"), "1");
  assert.equal(localStorage.getItem("remove"), null);
});

test("test 5: length and key() behavior accurately reflect contents", () => {
  localStorage.setItem("alpha", "10");
  localStorage.setItem("beta", "20");

  assert.equal(localStorage.length, 2);
  assert.equal(localStorage.key(0), "alpha");
  assert.equal(localStorage.key(1), "beta");
  assert.equal(localStorage.key(2), null);
  assert.equal(localStorage.key(-1), null);
});

test("test 6: non-string keys and values are coerced to strings", () => {
  localStorage.setItem(123, 456);
  assert.equal(localStorage.getItem("123"), "456");
  assert.equal(localStorage.getItem(123), "456");

  localStorage.removeItem(123);
  assert.equal(localStorage.getItem("123"), null);
});

test("test 7: resetLocalStorageMock explicitly clears state when invoked", () => {
  localStorage.setItem("tmp", "val");
  assert.equal(localStorage.getItem("tmp"), "val");

  resetLocalStorageMock();
  assert.equal(localStorage.getItem("tmp"), null);
  assert.equal(localStorage.length, 0);
});
