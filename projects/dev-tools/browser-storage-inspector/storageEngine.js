/**
 * Browser Storage Inspector Engine
 * Unified wrapper for inspecting, parsing, and estimating byte storage footprints
 * across LocalStorage, SessionStorage, Cookie, and IndexedDB stores, plus
 * storage quota estimation via navigator.storage.estimate().
 */
(function (exports) {
  "use strict";

  /**
   * Determine data type of raw storage string value.
   */
  function detectDataType(value) {
    if (typeof value !== "string") {
      if (typeof value === "object" && value !== null) return "json";
      return typeof value;
    }
    const val = value.trim();

    if (val === "true" || val === "false") return "boolean";
    if (!isNaN(val) && val !== "") return "number";

    if (
      (val.startsWith("{") && val.endsWith("}")) ||
      (val.startsWith("[") && val.endsWith("]"))
    ) {
      try {
        JSON.parse(val);
        return "json";
      } catch (e) {
        // Not valid JSON
      }
    }

    if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(val)) {
      return "jwt";
    }

    if (
      /^data:image\/[a-z]+;base64,/.test(val) ||
      (val.length % 4 === 0 &&
        /^[A-Za-z0-9+/=]+$/.test(val) &&
        val.length > 30)
    ) {
      return "base64";
    }

    return "string";
  }

  /**
   * Estimate byte footprint of a string key/value pair in UTF-16 bytes.
   */
  function calculateByteSize(key, value) {
    const kLen = key ? String(key).length * 2 : 0;
    const vLen = value ? String(value).length * 2 : 0;
    return kLen + vLen;
  }

  /**
   * Format bytes into human-readable unit (Bytes, KB, MB, GB).
   */
  function formatBytes(bytes) {
    if (typeof bytes !== "number" || isNaN(bytes) || bytes < 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /**
   * Filter key-value list based on query search string & dataType filter.
   */
  function filterItems(items, query = "", typeFilter = "all") {
    if (!Array.isArray(items)) return [];

    const q = query.toLowerCase().trim();

    return items.filter(item => {
      const matchType = typeFilter === "all" || item.type === typeFilter;
      const matchQuery =
        !q ||
        (item.key && String(item.key).toLowerCase().includes(q)) ||
        (item.value && String(item.value).toLowerCase().includes(q)) ||
        (item.db && String(item.db).toLowerCase().includes(q)) ||
        (item.store && String(item.store).toLowerCase().includes(q));

      return matchType && matchQuery;
    });
  }

  /**
   * Read all key-value entries from LocalStorage or SessionStorage store.
   * Gracefully handles unavailable storage and storage access errors.
   */
  function readWebStorage(storeType = "localStorage") {
    const items = [];
    let totalBytes = 0;
    let store;

    try {
      store =
        storeType === "sessionStorage"
          ? typeof window !== "undefined" && window.sessionStorage
          : typeof window !== "undefined" && window.localStorage;
    } catch (error) {
      return {
        items,
        totalBytes,
        formattedTotal: "0 B",
      };
    }

    if (!store) {
      return {
        items,
        totalBytes,
        formattedTotal: "0 B",
      };
    }

    try {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key === null) continue;

        const value = store.getItem(key);
        const bytes = calculateByteSize(key, value);
        const type = detectDataType(value);

        totalBytes += bytes;

        items.push({
          key,
          value,
          bytes,
          formattedBytes: formatBytes(bytes),
          type,
        });
      }
    } catch (error) {
      // Storage may become unavailable while being read.
    }

    return {
      items,
      totalBytes,
      formattedTotal: formatBytes(totalBytes),
    };
  }

  /**
   * Read document cookies as structured key-value array.
   */
  function readCookies() {
    const items = [];
    let totalBytes = 0;
    const raw = (typeof document !== "undefined" && document.cookie) || "";

    if (!raw.trim()) {
      return {
        items,
        totalBytes,
        formattedTotal: "0 B",
      };
    }

    const pairs = raw.split(";");

    pairs.forEach(pair => {
      const parts = pair.split("=");
      const key = parts[0].trim();
      const value = parts.slice(1).join("=").trim();
      const bytes = calculateByteSize(key, value);
      const type = detectDataType(value);

      totalBytes += bytes;

      items.push({
        key,
        value,
        bytes,
        formattedBytes: formatBytes(bytes),
        type,
      });
    });

    return {
      items,
      totalBytes,
      formattedTotal: formatBytes(totalBytes),
    };
  }

  /**
   * Storage Quota Estimate via navigator.storage.estimate().
   * Calculates usage, quota, percent used, and human-readable units.
   */
  async function getStorageQuotaEstimate() {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (nav && nav.storage && typeof nav.storage.estimate === "function") {
      try {
        const estimate = await nav.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percentUsed =
          quota > 0 ? Math.min(100, (usage / quota) * 100) : 0;
        const remaining = Math.max(0, quota - usage);

        return {
          supported: true,
          usage,
          quota,
          percentUsed: Number(percentUsed.toFixed(1)),
          formattedUsage: formatBytes(usage),
          formattedQuota: formatBytes(quota),
          formattedRemaining: formatBytes(remaining),
          details: estimate.usageDetails || {},
          error: null,
        };
      } catch (err) {
        return {
          supported: false,
          usage: 0,
          quota: 0,
          percentUsed: 0,
          formattedUsage: "0 B",
          formattedQuota: "0 B",
          formattedRemaining: "0 B",
          details: {},
          error: err.message || "Failed to estimate storage quota",
        };
      }
    }

    return {
      supported: false,
      usage: 0,
      quota: 0,
      percentUsed: 0,
      formattedUsage: "0 B",
      formattedQuota: "0 B",
      formattedRemaining: "0 B",
      details: {},
      error: "navigator.storage.estimate() is not supported in this browser",
    };
  }

  /**
   * Helper to retrieve the IndexedDB API instance.
   */
  function getIndexedDBInstance() {
    if (typeof indexedDB !== "undefined") return indexedDB;
    if (typeof window !== "undefined" && window.indexedDB)
      return window.indexedDB;
    if (typeof global !== "undefined" && global.indexedDB)
      return global.indexedDB;
    return null;
  }

  /**
   * List available IndexedDB databases.
   */
  async function listIndexedDatabases() {
    const idb = getIndexedDBInstance();
    if (!idb) return [];

    if (typeof idb.databases === "function") {
      try {
        const dbs = await idb.databases();
        return Array.isArray(dbs) ? dbs.filter(d => d && d.name) : [];
      } catch {
        // Fallback below
      }
    }

    // Default known fallback database for Cradle
    return [{ name: "CradleDB", version: 1 }];
  }

  /**
   * Read all IndexedDB databases, stores, and records.
   */
  async function readAllIndexedDB() {
    const idb = getIndexedDBInstance();
    if (!idb) {
      return {
        items: [],
        databases: [],
        totalBytes: 0,
        formattedTotal: "0 B",
        supported: false,
      };
    }

    const dbs = await listIndexedDatabases();
    const items = [];
    let totalBytes = 0;
    const dbDetails = [];

    for (const dbInfo of dbs) {
      if (!dbInfo || !dbInfo.name) continue;
      try {
        const dbData = await readDatabase(dbInfo.name);
        dbDetails.push(dbData);
        for (const item of dbData.items) {
          items.push(item);
          totalBytes += item.bytes;
        }
      } catch {
        // Ignore single database open errors
      }
    }

    return {
      items,
      databases: dbDetails,
      totalBytes,
      formattedTotal: formatBytes(totalBytes),
      supported: true,
    };
  }

  /**
   * Read all object stores and records for a single IndexedDB database.
   */
  function readDatabase(dbName) {
    const idb = getIndexedDBInstance();
    return new Promise(resolve => {
      if (!idb) return resolve({ name: dbName, stores: {}, items: [] });

      try {
        const req = idb.open(dbName);
        req.onerror = () => resolve({ name: dbName, stores: {}, items: [] });
        req.onblocked = () => resolve({ name: dbName, stores: {}, items: [] });
        req.onsuccess = async () => {
          const db = req.result;
          const storeNames = Array.from(db.objectStoreNames || []);
          const stores = {};
          const items = [];

          for (const storeName of storeNames) {
            try {
              const records = await readObjectStore(db, storeName);
              stores[storeName] = records;
              for (const rec of records) {
                const valStr =
                  typeof rec.value === "string"
                    ? rec.value
                    : JSON.stringify(rec.value);
                const bytes = calculateByteSize(String(rec.key), valStr);
                const type =
                  typeof rec.value === "object" && rec.value !== null
                    ? "json"
                    : detectDataType(valStr);

                items.push({
                  db: dbName,
                  store: storeName,
                  key: rec.key,
                  value: rec.value,
                  valueString: valStr,
                  bytes,
                  formattedBytes: formatBytes(bytes),
                  type,
                });
              }
            } catch {
              stores[storeName] = [];
            }
          }

          db.close();
          resolve({ name: dbName, stores, items });
        };
      } catch {
        resolve({ name: dbName, stores: {}, items: [] });
      }
    });
  }

  /**
   * Read all records from a specific object store.
   */
  function readObjectStore(db, storeName) {
    return new Promise(resolve => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const records = [];

        if (typeof store.openCursor === "function") {
          const req = store.openCursor();
          req.onsuccess = e => {
            const cursor = e.target.result;
            if (cursor) {
              records.push({ key: cursor.key, value: cursor.value });
              cursor.continue();
            } else {
              resolve(records);
            }
          };
          req.onerror = () => resolve([]);
        } else if (typeof store.getAll === "function") {
          const reqVal = store.getAll();
          const reqKey =
            typeof store.getAllKeys === "function" ? store.getAllKeys() : null;

          tx.oncomplete = () => {
            const vals = reqVal.result || [];
            const keys = (reqKey && reqKey.result) || vals.map((_, i) => i);
            const combined = vals.map((v, i) => ({
              key: keys[i] ?? i,
              value: v,
            }));
            resolve(combined);
          };
          tx.onerror = () => resolve([]);
        } else {
          resolve([]);
        }
      } catch {
        resolve([]);
      }
    });
  }

  exports.detectDataType = detectDataType;
  exports.calculateByteSize = calculateByteSize;
  exports.formatBytes = formatBytes;
  exports.filterItems = filterItems;
  exports.readWebStorage = readWebStorage;
  exports.readCookies = readCookies;
  exports.getStorageQuotaEstimate = getStorageQuotaEstimate;
  exports.listIndexedDatabases = listIndexedDatabases;
  exports.readAllIndexedDB = readAllIndexedDB;
  exports.readDatabase = readDatabase;
})(
  typeof module !== "undefined" && module.exports
    ? module.exports
    : (window.StorageEngine = {})
);
