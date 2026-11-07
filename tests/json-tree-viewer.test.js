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

