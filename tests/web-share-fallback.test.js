const test = require("node:test");
const assert = require("node:assert/strict");

test("Web Share API feature detection: navigator.share is called when supported", async () => {
  let sharedData = null;
  const mockNavigator = {
    share: async (data) => {
      sharedData = data;
    },
    clipboard: {
      writeText: async () => {}
    }
  };

  if (typeof mockNavigator !== "undefined" && typeof mockNavigator.share === "function") {
    await mockNavigator.share({ title: "Test", text: "Sample content" });
  }

  assert.deepEqual(sharedData, { title: "Test", text: "Sample content" });
});

test("Web Share API fallback: falls back to clipboard/download when navigator.share is undefined", async () => {
  let fallbackExecuted = false;
  const mockNavigator = {
    // navigator.share is undefined
    clipboard: {
      writeText: async () => {
        fallbackExecuted = true;
      }
    }
  };

  if (typeof mockNavigator !== "undefined" && typeof mockNavigator.share === "function") {
    await mockNavigator.share({ title: "Test", text: "Sample content" });
  } else if (mockNavigator.clipboard) {
    await mockNavigator.clipboard.writeText("Sample content");
  }

  assert.equal(fallbackExecuted, true);
});

test("Web Share API error handling: catches AbortError gracefully when user cancels share", async () => {
  let fallbackExecuted = false;
  const mockNavigator = {
    share: async () => {
      const err = new Error("Share cancelled");
      err.name = "AbortError";
      throw err;
    }
  };

  try {
    if (typeof mockNavigator !== "undefined" && typeof mockNavigator.share === "function") {
      await mockNavigator.share({ title: "Test", text: "Sample content" });
    }
  } catch (err) {
    if (err.name === "AbortError") {
      // Gracefully handled cancellation
      fallbackExecuted = false;
    } else {
      fallbackExecuted = true;
    }
  }

  assert.equal(fallbackExecuted, false);
});

test("Web Share API safety: does not throw when navigator object is completely undefined", async () => {
  const customGlobal = {}; // no navigator

  let didThrow = false;
  try {
    if (typeof customGlobal.navigator !== "undefined" && typeof customGlobal.navigator.share === "function") {
      await customGlobal.navigator.share({ title: "Test" });
    }
  } catch (e) {
    didThrow = true;
  }

  assert.equal(didThrow, false);
});
