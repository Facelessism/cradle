const test = require("node:test");
const assert = require("node:assert/strict");
const JsonPathEngine = require("../projects/dev-tools/json-tree-viewer/jsonPathEngine.js");

const SAMPLE_PAYLOAD = {
  store: {
    book: [
      {
        category: "reference",
        author: "Nigel Rees",
        title: "Sayings of the Century",
        price: 8.95,
      },
      {
        category: "fiction",
        author: "Evelyn Waugh",
        title: "Sword of Honour",
        price: 12.99,
      },
      {
        category: "fiction",
        author: "Herman Melville",
        title: "Moby Dick",
        isbn: "0-553-21311-3",
        price: 8.99,
      },
    ],
    bicycle: {
      color: "red",
      price: 19.95,
    },
  },
  users: [
    {
      id: 1,
      name: "Alice",
      address: {
        city: "Wonderland",
        zip: "12345",
      },
    },
  ],
  features: [
    { name: "JSON Tree Viewer", category: "dev-tools", status: "active" },
    { name: "Typing Speed Racer", category: "games", status: "active" },
    { name: "Deprecated Mini", category: "misc", status: "inactive" },
  ],
};

test("evaluateJsonPath matches $.store.book[*].author correctly", () => {
  const result = JsonPathEngine.evaluateJsonPath(
    SAMPLE_PAYLOAD,
    "$.store.book[*].author"
  );
  assert.equal(result.isValid, true);
  assert.equal(result.error, null);
  assert.equal(result.count, 3);
  assert.deepEqual(
    result.matches.map(m => m.value),
    ["Nigel Rees", "Evelyn Waugh", "Herman Melville"]
  );
  assert.deepEqual(
    result.matches.map(m => m.path),
    [
      "$.store.book[0].author",
      "$.store.book[1].author",
      "$.store.book[2].author",
    ]
  );
});

test("evaluateJsonPath matches recursive descent $..price across objects and arrays", () => {
  const result = JsonPathEngine.evaluateJsonPath(SAMPLE_PAYLOAD, "$..price");
  assert.equal(result.isValid, true);
  assert.equal(result.count, 4);
  assert.deepEqual(
    result.matches.map(m => m.value),
    [8.95, 12.99, 8.99, 19.95]
  );
  assert.deepEqual(
    result.matches.map(m => m.path),
    [
      "$.store.book[0].price",
      "$.store.book[1].price",
      "$.store.book[2].price",
      "$.store.bicycle.price",
    ]
  );
});

test("evaluateJsonPath supports filter expressions like [?(@.category == 'dev-tools')]", () => {
  const result = JsonPathEngine.evaluateJsonPath(
    SAMPLE_PAYLOAD,
    "$.features[?(@.category == 'dev-tools')].name"
  );
  assert.equal(result.isValid, true);
  assert.equal(result.count, 1);
  assert.equal(result.matches[0].value, "JSON Tree Viewer");
  assert.equal(result.matches[0].path, "$.features[0].name");
});

test("evaluateJsonPath supports numeric comparison filter [?(@.price < 10)]", () => {
  const result = JsonPathEngine.evaluateJsonPath(
    SAMPLE_PAYLOAD,
    "$.store.book[?(@.price < 10)].title"
  );
  assert.equal(result.isValid, true);
  assert.equal(result.count, 2);
  assert.deepEqual(
    result.matches.map(m => m.value),
    ["Sayings of the Century", "Moby Dick"]
  );
});

test("evaluateJsonPath supports array index access and negative index", () => {
  const first = JsonPathEngine.evaluateJsonPath(SAMPLE_PAYLOAD, "$.features[0]");
  assert.equal(first.count, 1);
  assert.equal(first.matches[0].value.name, "JSON Tree Viewer");

  const last = JsonPathEngine.evaluateJsonPath(
    SAMPLE_PAYLOAD,
    "$.features[-1].name"
  );
  assert.equal(last.count, 1);
  assert.equal(last.matches[0].value, "Deprecated Mini");
});

test("evaluateJsonPath catches and reports syntax errors gracefully", () => {
  const unclosed = JsonPathEngine.evaluateJsonPath(
    SAMPLE_PAYLOAD,
    "$.store.book[*.author"
  );
  assert.equal(unclosed.isValid, false);
  assert.match(unclosed.error, /Unclosed bracket/i);

  const trailingDot = JsonPathEngine.evaluateJsonPath(
    SAMPLE_PAYLOAD,
    "$.store.book."
  );
  assert.equal(trailingDot.isValid, false);
  assert.match(trailingDot.error, /trailing '\.'/i);

  const emptyBracket = JsonPathEngine.evaluateJsonPath(
    SAMPLE_PAYLOAD,
    "$.store.book[]"
  );
  assert.equal(emptyBracket.isValid, false);
  assert.match(emptyBracket.error, /Empty bracket/i);

  const invalidFilter = JsonPathEngine.evaluateJsonPath(
    SAMPLE_PAYLOAD,
    "$.features[?(@.price <)]"
  );
  assert.equal(invalidFilter.isValid, false);
  assert.match(invalidFilter.error, /Incomplete filter/i);
});

test("formatPathForCode formats dot/bracket code reference correctly", () => {
  assert.equal(
    JsonPathEngine.formatPathForCode("$.users[0].address.city", "data"),
    "data.users[0].address.city"
  );
  assert.equal(
    JsonPathEngine.formatPathForCode("$.features[0].name", "data"),
    "data.features[0].name"
  );
  assert.equal(JsonPathEngine.formatPathForCode("$", "data"), "data");
  assert.equal(
    JsonPathEngine.formatPathForCode("$.users[0].address.city", "$"),
    "$.users[0].address.city"
  );
});

test("getValueByPath retrieves exact values and subtrees", () => {
  assert.equal(
    JsonPathEngine.getValueByPath(SAMPLE_PAYLOAD, "$.users[0].address.city"),
    "Wonderland"
  );
  assert.equal(
    JsonPathEngine.getValueByPath(SAMPLE_PAYLOAD, "data.users[0].address.zip"),
    "12345"
  );
  assert.deepEqual(
    JsonPathEngine.getValueByPath(SAMPLE_PAYLOAD, "$.store.bicycle"),
    { color: "red", price: 19.95 }
  );
  assert.deepEqual(JsonPathEngine.getValueByPath(SAMPLE_PAYLOAD, "$"), SAMPLE_PAYLOAD);
  assert.equal(
    JsonPathEngine.getValueByPath(SAMPLE_PAYLOAD, "$.non.existent.path"),
    undefined
  );
});

test("getAncestorPaths extracts parent hierarchy for automatic expansion", () => {
  const ancestors = JsonPathEngine.getAncestorPaths("$.users[0].address.city");
  assert.deepEqual(ancestors, [
    "$",
    "$.users",
    "$.users[0]",
    "$.users[0].address",
  ]);
});

test("validateJsonPath accepts valid expressions in real-time", () => {
  const validQueries = [
    "$",
    "$.store.book",
    "$.store.book[*].author",
    "$..price",
    "$.features[0]",
    "$.features[-1].name",
    "$.features[0:2]",
    "$.features[0,1]",
    "$.features[?(@.status == 'active')]",
    "$.store.book[?(@.price < 10)]",
    "$.store.book[?(@.category)]",
    "$['store']['bicycle']",
    "$.config.*",
    "$..*",
  ];

  for (const q of validQueries) {
    const res = JsonPathEngine.validateJsonPath(q);
    assert.equal(res.isValid, true, `Expected "${q}" to be valid`);
    assert.equal(res.error, null);
    assert.equal(res.isBlank, false);
    assert.ok(Array.isArray(res.segments));
  }
});

test("validateJsonPath handles blank and whitespace queries cleanly", () => {
  for (const blank of ["", "   ", "\t\n"]) {
    const res = JsonPathEngine.validateJsonPath(blank);
    assert.equal(res.isValid, true);
    assert.equal(res.isBlank, true);
    assert.equal(res.error, null);
    assert.deepEqual(res.segments, []);
  }
});

test("validateJsonPath catches malformed expressions with descriptive errors", () => {
  const malformedCases = [
    { query: "$.store.book[", pattern: /Unclosed bracket/i },
    { query: "$.store.book[*.author", pattern: /Unclosed bracket/i },
    { query: "$.store.book.", pattern: /trailing '\.'/i },
    { query: "$.store.book..", pattern: /Unexpected end of expression after '\.\.'/i },
    { query: "$.store.book[]", pattern: /Empty bracket/i },
    { query: "$.store.book[?()]", pattern: /Empty filter expression/i },
    { query: "$.features[?(@.price <)]", pattern: /Incomplete filter expression/i },
    { query: "$.features[?(@.status ==)]", pattern: /Incomplete filter expression/i },
    { query: "$.features@", pattern: /Unexpected token/i },
    { query: "$.store...book", pattern: /Invalid recursive target/i },
  ];

  for (const { query, pattern } of malformedCases) {
    const res = JsonPathEngine.validateJsonPath(query);
    assert.equal(res.isValid, false, `Expected "${query}" to be invalid`);
    assert.equal(res.isBlank, false);
    assert.match(res.error, pattern);
  }
});

test("evaluateJsonPath prevents invalid queries from executing against data or null", () => {
  const invalidQuery = "$.store.book[?(@.price <)]";

  // When data is null
  const nullResult = JsonPathEngine.evaluateJsonPath(null, invalidQuery);
  assert.equal(nullResult.isValid, false);
  assert.match(nullResult.error, /Incomplete filter/i);
  assert.equal(nullResult.count, 0);

  // When data is populated
  const dataResult = JsonPathEngine.evaluateJsonPath(SAMPLE_PAYLOAD, invalidQuery);
  assert.equal(dataResult.isValid, false);
  assert.match(dataResult.error, /Incomplete filter/i);
  assert.equal(dataResult.count, 0);
  assert.deepEqual(dataResult.matches, []);
});

test("findMatchingBracket handles brackets nested in quotes accurately", () => {
  const queryWithBracketInQuote = "$['book[0]'].title";
  const validation = JsonPathEngine.validateJsonPath(queryWithBracketInQuote);
  assert.equal(validation.isValid, true);
  assert.equal(validation.segments.length, 2);
  assert.equal(validation.segments[0].type, "property");
  assert.equal(validation.segments[0].name, "book[0]");
});

