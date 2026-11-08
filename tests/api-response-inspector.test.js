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
    const res = await APIEngine.fetchWithTimeout(
      "https://example.com",
      {},
      1000
    );
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
        const err = new DOMException(
          "The operation was aborted.",
          "AbortError"
        );
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

test("parseCurlCommand parses simple GET cURL command with URL and flags", () => {
  const curl = 'curl "https://api.example.com/users" -H "Accept: application/json"';
  const parsed = APIEngine.parseCurlCommand(curl);

  assert.equal(parsed.method, "GET");
  assert.equal(parsed.url, "https://api.example.com/users");
  assert.equal(parsed.headers["Accept"], "application/json");
  assert.equal(parsed.body, "");
});

test("parseCurlCommand parses POST with headers and JSON body", () => {
  const curl =
    'curl -X POST https://api.example.com/posts -H "Content-Type: application/json" -d \'{"title":"Hello","userId":1}\'';
  const parsed = APIEngine.parseCurlCommand(curl);

  assert.equal(parsed.method, "POST");
  assert.equal(parsed.url, "https://api.example.com/posts");
  assert.equal(parsed.headers["Content-Type"], "application/json");
  assert.equal(parsed.body, '{"title":"Hello","userId":1}');
});

test("parseCurlCommand parses multi-line cURL with backslash continuations", () => {
  const curl = `curl --request PUT \\
    "https://api.example.com/items/42" \\
    -H "Authorization: Bearer my_token" \\
    -H "X-Custom-Header: True" \\
    --data '{"status":"active"}'`;

  const parsed = APIEngine.parseCurlCommand(curl);

  assert.equal(parsed.method, "PUT");
  assert.equal(parsed.url, "https://api.example.com/items/42");
  assert.equal(parsed.headers["Authorization"], "Bearer my_token");
  assert.equal(parsed.headers["X-Custom-Header"], "True");
  assert.equal(parsed.body, '{"status":"active"}');
});

test("parseCurlCommand parses Basic Auth credentials (-u user:pass)", () => {
  const curl = 'curl -u "admin:secret123" https://api.example.com/secure';
  const parsed = APIEngine.parseCurlCommand(curl);

  assert.equal(parsed.method, "GET");
  assert.equal(parsed.url, "https://api.example.com/secure");
  const expectedAuth = Buffer.from("admin:secret123").toString("base64");
  assert.equal(parsed.headers["Authorization"], `Basic ${expectedAuth}`);
});

test("parseCurlCommand handles Windows caret (^) line continuations", () => {
  const curl = `curl -X DELETE ^
    https://api.example.com/record/10 ^
    -H "Accept: application/json"`;

  const parsed = APIEngine.parseCurlCommand(curl);

  assert.equal(parsed.method, "DELETE");
  assert.equal(parsed.url, "https://api.example.com/record/10");
  assert.equal(parsed.headers["Accept"], "application/json");
});

test("generateCurlSnippet creates multi-line formatted cURL command", () => {
  const snippet = APIEngine.generateCurlSnippet({
    method: "POST",
    url: "https://api.example.com/items",
    headers: { "Content-Type": "application/json" },
    body: '{"foo":"bar"}',
  });

  assert.ok(snippet.startsWith("curl -X POST"));
  assert.ok(snippet.includes('"https://api.example.com/items"'));
  assert.ok(snippet.includes('-H "Content-Type: application/json"'));
  assert.ok(snippet.includes("-d '{\"foo\":\"bar\"}'"));
});

test("generateFetchSnippet creates idiomatic JavaScript fetch code", () => {
  const snippet = APIEngine.generateFetchSnippet({
    method: "POST",
    url: "https://api.example.com/data",
    headers: { Authorization: "Bearer 123" },
    body: '{"test":true}',
  });

  assert.ok(snippet.includes('fetch("https://api.example.com/data"'));
  assert.ok(snippet.includes('method: "POST"'));
  assert.ok(snippet.includes('Authorization: "Bearer 123"'));
  assert.ok(snippet.includes(".then(response =>"));
});

test("generatePythonSnippet creates idiomatic Python requests code", () => {
  const snippet = APIEngine.generatePythonSnippet({
    method: "POST",
    url: "https://api.example.com/data",
    headers: { "Content-Type": "application/json" },
    body: '{"test":true}',
  });

  assert.ok(snippet.includes("import requests"));
  assert.ok(snippet.includes('url = "https://api.example.com/data"'));
  assert.ok(snippet.includes('requests.post(url, headers='));
  assert.ok(snippet.includes("print(response.text)"));
});

test("computeTimingBreakdown extracts high-resolution metrics from PerformanceResourceTiming", () => {
  const mockResourceEntry = {
    domainLookupStart: 10,
    domainLookupEnd: 25, // 15ms DNS
    connectStart: 25,
    connectEnd: 60, // 35ms TCP
    secureConnectionStart: 35, // 25ms TLS
    requestStart: 60,
    responseStart: 180, // 120ms TTFB
    responseEnd: 210, // 30ms Download
  };

  const breakdown = APIEngine.computeTimingBreakdown(200, mockResourceEntry);

  assert.equal(breakdown.isResourceTiming, true);
  assert.equal(breakdown.dns, 15);
  assert.equal(breakdown.tcp, 35);
  assert.equal(breakdown.tls, 25);
  assert.equal(breakdown.ttfb, 120);
  assert.equal(breakdown.download, 30);
  assert.equal(breakdown.formatted.dns, "15 ms");
  assert.equal(breakdown.formatted.ttfb, "120 ms");
});

test("computeTimingBreakdown falls back gracefully when Resource Timing is masked", () => {
  const breakdown = APIEngine.computeTimingBreakdown(150, null);

  assert.equal(breakdown.isResourceTiming, false);
  assert.equal(breakdown.dns, 0);
  assert.equal(breakdown.tcp, 0);
  assert.equal(breakdown.ttfb, 105); // 70% of 150ms
  assert.equal(breakdown.download, 45); // 30% of 150ms
  assert.equal(breakdown.formatted.dns, "—");
  assert.equal(breakdown.formatted.ttfb, "105 ms");
});
