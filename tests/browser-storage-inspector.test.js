const test = require("node:test");
const assert = require("node:assert/strict");

// Mock global window, storage, and navigator if running in pure Node environment
if (typeof window === "undefined") {
  global.window = {};
}

const engine = require("../projects/dev-tools/browser-storage-inspector/storageEngine.js");
const exporter = require("../projects/dev-tools/browser-storage-inspector/storageExporter.js");

test("StorageEngine detects data types accurately", () => {
  assert.equal(engine.detectDataType("true"), "boolean");
  assert.equal(engine.detectDataType("123.45"), "number");
  assert.equal(engine.detectDataType('{"key":"value"}'), "json");
  assert.equal(engine.detectDataType("[1, 2, 3]"), "json");
  assert.equal(engine.detectDataType("header.payload.signature"), "jwt");
  assert.equal(engine.detectDataType("hello world"), "string");
  assert.equal(engine.detectDataType({ a: 1 }), "json");
});

test("StorageEngine calculates byte footprint and formats bytes", () => {
  const bytes = engine.calculateByteSize("user", "john_doe");
  assert.equal(bytes, (4 + 8) * 2); // 24 bytes UTF-16
  assert.equal(engine.formatBytes(500), "500 B");
  assert.equal(engine.formatBytes(2048), "2.00 KB");
  assert.equal(engine.formatBytes(5 * 1024 * 1024), "5.00 MB");
  assert.equal(engine.formatBytes(12.5 * 1024 * 1024 * 1024), "12.50 GB");
});

test("StorageEngine filters items by query and type", () => {
  const items = [
    { key: "auth_token", value: "a.b.c", type: "jwt" },
    { key: "theme", value: '{"mode":"dark"}', type: "json" },
    { key: "username", value: "alice", type: "string" },
    {
      db: "CradleDB",
      store: "projects",
      key: "proj_1",
      value: "Demo",
      type: "string",
    },
  ];
  const filteredType = engine.filterItems(items, "", "jwt");
  assert.equal(filteredType.length, 1);
  assert.equal(filteredType[0].key, "auth_token");

  const filteredQuery = engine.filterItems(items, "alice", "all");
  assert.equal(filteredQuery.length, 1);
  assert.equal(filteredQuery[0].key, "username");

  const filteredDb = engine.filterItems(items, "CradleDB", "all");
  assert.equal(filteredDb.length, 1);
  assert.equal(filteredDb[0].key, "proj_1");
});

test("StorageEngine calculates storage quota estimate from navigator.storage.estimate()", async () => {
  // Mock navigator.storage
  const originalNavigator = global.navigator;
  global.navigator = {
    storage: {
      estimate: async () => ({
        usage: 25 * 1024 * 1024, // 25 MB
        quota: 100 * 1024 * 1024, // 100 MB
        usageDetails: {
          indexedDB: 20 * 1024 * 1024,
          caches: 5 * 1024 * 1024,
        },
      }),
    },
  };

  const estimate = await engine.getStorageQuotaEstimate();

  assert.equal(estimate.supported, true);
  assert.equal(estimate.usage, 26214400);
  assert.equal(estimate.quota, 104857600);
  assert.equal(estimate.percentUsed, 25);
  assert.equal(estimate.formattedUsage, "25.00 MB");
  assert.equal(estimate.formattedQuota, "100.00 MB");
  assert.equal(estimate.formattedRemaining, "75.00 MB");
  assert.equal(estimate.details.indexedDB, 20971520);

  // Restore navigator
  global.navigator = originalNavigator;
});

test("StorageEngine handles unsupported navigator.storage.estimate() gracefully", async () => {
  const originalNavigator = global.navigator;
  global.navigator = {};

  const estimate = await engine.getStorageQuotaEstimate();
  assert.equal(estimate.supported, false);
  assert.equal(estimate.percentUsed, 0);
  assert.equal(estimate.formattedUsage, "0 B");

  global.navigator = originalNavigator;
});

test("StorageExporter formats JSON and CSV exports", () => {
  const items = [
    { key: "theme", value: "dark", bytes: 18, type: "string" },
    { key: "count", value: "42", bytes: 14, type: "number" },
  ];
  const jsonStr = exporter.exportToJSON(items, "localStorage");
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.storeType, "localStorage");
  assert.equal(parsed.data.theme, "dark");
  const csvStr = exporter.exportToCSV(items);
  assert.ok(csvStr.includes("Key,Type,Bytes,Value"));
  assert.ok(csvStr.includes('"theme",string,18,"dark"'));
});

test("StorageExporter creates comprehensive unified JSON exports", () => {
  const storesData = {
    localStorage: [
      { key: "theme", value: "dark", type: "string", bytes: 18 },
      { key: "user_id", value: "101", type: "number", bytes: 12 },
    ],
    sessionStorage: [
      { key: "tab_session", value: "active", type: "string", bytes: 20 },
    ],
    cookies: [{ key: "locale", value: "en-US", type: "string", bytes: 16 }],
    indexedDB: [
      {
        db: "CradleDB",
        store: "projects",
        key: "p1",
        value: { title: "Demo" },
        type: "json",
        bytes: 40,
      },
    ],
  };

  const jsonStr = exporter.exportUnifiedJSON(storesData);
  const parsed = JSON.parse(jsonStr);

  assert.equal(parsed.version, "2.0");
  assert.equal(parsed.format, "cradle-unified-storage-snapshot");
  assert.equal(parsed.stats.localStorageCount, 2);
  assert.equal(parsed.stats.sessionStorageCount, 1);
  assert.equal(parsed.stats.cookieCount, 1);
  assert.equal(parsed.stats.indexedDBRecordCount, 1);
  assert.equal(parsed.stats.totalItems, 5);

  assert.equal(parsed.stores.localStorage.theme, "dark");
  assert.equal(parsed.stores.sessionStorage.tab_session, "active");
  assert.equal(parsed.stores.cookies.locale, "en-US");
  assert.equal(parsed.stores.indexedDB.CradleDB.projects[0].key, "p1");
});

test("StorageExporter creates unified multi-store CSV exports", () => {
  const storesData = {
    localStorage: [{ key: "theme", value: "dark", type: "string", bytes: 18 }],
    sessionStorage: [
      { key: "session_id", value: "99", type: "number", bytes: 12 },
    ],
    indexedDB: [
      {
        db: "TestDB",
        store: "meta",
        key: "user",
        value: "Ada",
        type: "string",
        bytes: 14,
      },
    ],
  };

  const csvStr = exporter.exportUnifiedCSV(storesData);
  assert.ok(csvStr.includes("Store,Database,ObjectStore,Key,Type,Bytes,Value"));
  assert.ok(csvStr.includes('localStorage,"","","theme",string,18,"dark"'));
  assert.ok(
    csvStr.includes('sessionStorage,"","","session_id",number,12,"99"')
  );
  assert.ok(csvStr.includes('indexedDB,"TestDB","meta","user",string,14,"Ada"'));
});

test("StorageExporter parses RFC-4180 CSV with escaped quotes and commas", () => {
  const csvText = `Key,Type,Bytes,Value\n"user,name",string,20,"John ""The Chief"" Doe"\n"note",string,12,"Line 1\nLine 2"`;
  const parsed = exporter.parseCSV(csvText);

  assert.equal(parsed.length, 3);
  assert.equal(parsed[1][0], "user,name");
  assert.equal(parsed[1][3], 'John "The Chief" Doe');
  assert.equal(parsed[2][3], "Line 1\nLine 2");
});

test("StorageExporter validates unified and legacy JSON snapshots", () => {
  // Legacy single-store JSON
  const legacyPayload = JSON.stringify({
    version: "1.0",
    data: { key1: "val1" },
  });
  const resLegacy = exporter.validateImportJSON(legacyPayload);
  assert.equal(resLegacy.valid, true);
  assert.equal(resLegacy.data.key1, "val1");

  // Unified v2.0 JSON
  const unifiedPayload = JSON.stringify({
    version: "2.0",
    stores: {
      localStorage: { user: "alice" },
      sessionStorage: { active: "true" },
      indexedDB: {
        MainDB: {
          items: [{ key: "k1", value: "v1" }],
        },
      },
    },
  });
  const resUnified = exporter.validateUnifiedImport(unifiedPayload);
  assert.equal(resUnified.valid, true);
  assert.equal(resUnified.format, "unified-json");
  assert.equal(resUnified.stats.localStorageCount, 1);
  assert.equal(resUnified.stats.sessionStorageCount, 1);
  assert.equal(resUnified.stats.indexedDBRecordCount, 1);
  assert.equal(resUnified.stats.totalItems, 3);

  // Invalid JSON
  const resInvalid = exporter.validateUnifiedImport("{ bad json ");
  assert.equal(resInvalid.valid, false);
});

test("StorageExporter validates Unified CSV and Single-store CSV payloads", () => {
  // Unified CSV
  const unifiedCsv = `Store,Database,ObjectStore,Key,Type,Bytes,Value\nlocalStorage,,,theme,string,10,dark\nsessionStorage,,,tab,string,6,123`;
  const resCsv = exporter.validateUnifiedImport(unifiedCsv);
  assert.equal(resCsv.valid, true);
  assert.equal(resCsv.format, "unified-csv");
  assert.equal(resCsv.data.localStorage.theme, "dark");
  assert.equal(resCsv.data.sessionStorage.tab, "123");

  // Single-store CSV
  const singleCsv = `Key,Type,Bytes,Value\n"user",string,8,"Ada"`;
  const resSingle = exporter.validateUnifiedImport(singleCsv);
  assert.equal(resSingle.valid, true);
  assert.equal(resSingle.format, "single-csv");
  assert.equal(resSingle.data.localStorage.user, "Ada");
});

test("StorageExporter restores storage across localStorage and sessionStorage", async () => {
  const mockStorage = () => {
    const store = new Map();
    return {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
    };
  };

  const origLocal = global.window.localStorage;
  const origSession = global.window.sessionStorage;

  global.window.localStorage = mockStorage();
  global.window.sessionStorage = mockStorage();

  const dataStores = {
    localStorage: { k1: "v1", k2: "v2" },
    sessionStorage: { s1: "sess1" },
  };

  const result = await exporter.restoreUnifiedStorage(dataStores, {
    overwrite: true,
  });

  assert.equal(result.success, true);
  assert.equal(result.restored.localStorage, 2);
  assert.equal(result.restored.sessionStorage, 1);
  assert.equal(result.restored.total, 3);

  assert.equal(global.window.localStorage.getItem("k1"), "v1");
  assert.equal(global.window.sessionStorage.getItem("s1"), "sess1");

  global.window.localStorage = origLocal;
  global.window.sessionStorage = origSession;
});
