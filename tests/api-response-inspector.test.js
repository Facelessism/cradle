const test = require("node:test");
const assert = require("node:assert/strict");
const APIEngine = require("../projects/dev-tools/api-response-inspector/apiEngine.js");

const originalFetch = global.fetch;

test("buildRequestOptions builds options structure correctly", () => {
  const { options, errors } = APIEngine.buildRequestOptions(
    "POST",
    "Content-Type: application/json\n Authorization: Bearer token123",
    '{"test": true}'
  );

  assert.equal(options.method, "POST");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.equal(options.headers["Authorization"], "Bearer token123");
  assert.equal(options.body, '{"test": true}');
  assert.equal(errors.length, 0);
});

test("fetchWithTimeout succeeds on successful request", async () => {
  global.fetch = async (url, options) => {
    return { ok: true, text: async () => "success" };
  };

  try {
    const res = await APIEngine.fetchWithTimeout("https://example.com", {}, 1000);
    assert.equal(res.ok, true);
    const text = await res.text();
    assert.equal(text, "success");
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithTimeout propagates normal network errors", async () => {
  global.fetch = async (url, options) => {
    throw new Error("Network error");
  };

  try {
    await assert.rejects(
      APIEngine.fetchWithTimeout("https://example.com", {}, 1000),
      /Network error/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithTimeout throws timeout error when request exceeds timeout", async () => {
  global.fetch = async (url, options) => {
    return new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const err = new DOMException("The operation was aborted.", "AbortError");
        reject(err);
      });
    });
  };

  try {
    await assert.rejects(
      APIEngine.fetchWithTimeout("https://example.com", {}, 50),
      /Request timed out/
    );
  } finally {
    global.fetch = originalFetch;
  }
});
