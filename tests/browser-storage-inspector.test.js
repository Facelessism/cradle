const test = require("node:test");
const assert = require("node:assert");

// Mock global window and storage if running in pure Node environment
if (typeof window === "undefined") {
  global.window = {};
}
const engine = require("../projects/dev-tools/browser-storage-inspector/storageEngine.js");
const exporter = require("../projects/dev-tools/browser-storage-inspector/storageExporter.js");

test("StorageEngine detects data types accurately", () => {
  assert.strictEqual(engine.detectDataType("true"), "boolean");
  assert.strictEqual(engine.detectDataType("123.45"), "number");
  assert.strictEqual(engine.detectDataType('{"key":"value"}'), "json");
  assert.strictEqual(engine.detectDataType("[1, 2, 3]"), "json");
  assert.strictEqual(engine.detectDataType("header.payload.signature"), "jwt");
  assert.strictEqual(engine.detectDataType("hello world"), "string");
});

test("StorageEngine calculates byte footprint and formats bytes", () => {
  const bytes = engine.calculateByteSize("user", "john_doe");
  assert.strictEqual(bytes, (4 + 8) * 2); // 24 bytes UTF-16
  assert.strictEqual(engine.formatBytes(500), "500 B");
  assert.strictEqual(engine.formatBytes(2048), "2.00 KB");
});

test("StorageEngine filters items by query and type", () => {
  const items = [
    { key: "auth_token", value: "a.b.c", type: "jwt" },
    { key: "theme", value: '{"mode":"dark"}', type: "json" },
    { key: "username", value: "alice", type: "string" }
  ];
  const filteredType = engine.filterItems(items, "", "jwt");
  assert.strictEqual(filteredType.length, 1);
  assert.strictEqual(filteredType[0].key, "auth_token");
  const filteredQuery = engine.filterItems(items, "alice", "all");
  assert.strictEqual(filteredQuery.length, 1);
  assert.strictEqual(filteredQuery[0].key, "username");
});

test("StorageExporter formats JSON and CSV exports", () => {
  const items = [
    { key: "theme", value: "dark", bytes: 18, type: "string" },
    { key: "count", value: "42", bytes: 14, type: "number" }
  ];
  const jsonStr = exporter.exportToJSON(items, "localStorage");
  const parsed = JSON.parse(jsonStr);
  assert.strictEqual(parsed.storeType, "localStorage");
  assert.strictEqual(parsed.data.theme, "dark");
  const csvStr = exporter.exportToCSV(items);
  assert.ok(csvStr.includes("Key,Type,Bytes,Value"));
  assert.ok(csvStr.includes('"theme",string,18,"dark"'));
});

test("StorageExporter validates JSON payload during import", () => {
  const validPayload = JSON.stringify({
    version: "1.0",
    data: { key1: "val1" }
  });
  const resValid = exporter.validateImportJSON(validPayload);
  assert.strictEqual(resValid.valid, true);
  assert.strictEqual(resValid.data.key1, "val1");
  const resInvalid = exporter.validateImportJSON("{ bad json ");
  assert.strictEqual(resInvalid.valid, false);
});