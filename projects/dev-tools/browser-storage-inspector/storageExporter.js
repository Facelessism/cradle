/**
 * Browser Storage Exporter & Backup Manager
 * Provides JSON/CSV snapshot export, unified multi-store backup generation
 * across LocalStorage, SessionStorage, and IndexedDB, coupled with import
 * validation and atomic restoration.
 */
(function (exports) {
  "use strict";

  /**
   * Export items array into structured JSON snapshot string with metadata.
   */
  function exportToJSON(items, storeType = "localStorage") {
    try {
      if (!Array.isArray(items)) {
        throw new TypeError("Export data must be an array.");
      }

      const payload = {
        version: "1.0",
        storeType,
        exportedAt: new Date().toISOString(),
        itemCount: items.length,
        data: items.reduce((acc, item) => {
          if (item && typeof item.key !== "undefined") {
            acc[String(item.key)] = item.value;
          }
          return acc;
        }, {}),
      };

      return JSON.stringify(payload, null, 2);
    } catch (e) {
      throw new Error(`JSON export failed: ${e.message}`);
    }
  }

  /**
   * Export items array into CSV payload string.
   */
  function exportToCSV(items) {
    try {
      if (!Array.isArray(items)) {
        throw new TypeError("Export data must be an array.");
      }

      if (!items.length) return "Key,Type,Bytes,Value\n";

      const rows = items.map(item => {
        const escapedKey = `"${String(item.key ?? "").replace(/"/g, '""')}"`;
        const valStr =
          typeof item.value === "object" && item.value !== null
            ? JSON.stringify(item.value)
            : String(item.value ?? "");
        const escapedVal = `"${valStr.replace(/"/g, '""')}"`;
        return `${escapedKey},${item.type || "string"},${item.bytes || 0},${escapedVal}`;
      });

      return "Key,Type,Bytes,Value\n" + rows.join("\n");
    } catch (e) {
      throw new Error(`CSV export failed: ${e.message}`);
    }
  }

  /**
   * Export unified snapshot across localStorage, sessionStorage, and IndexedDB.
   */
  function exportUnifiedJSON(storesData = {}, options = {}) {
    try {
      const localItems = Array.isArray(storesData.localStorage)
        ? storesData.localStorage
        : [];
      const sessionItems = Array.isArray(storesData.sessionStorage)
        ? storesData.sessionStorage
        : [];
      const cookieItems = Array.isArray(storesData.cookies)
        ? storesData.cookies
        : [];
      const indexedItems = storesData.indexedDB || [];

      // Convert items to key-value maps
      const localMap =
        storesData.localMap ||
        localItems.reduce((acc, item) => {
          if (item && typeof item.key !== "undefined")
            acc[String(item.key)] = item.value;
          return acc;
        }, {});

      const sessionMap =
        storesData.sessionMap ||
        sessionItems.reduce((acc, item) => {
          if (item && typeof item.key !== "undefined")
            acc[String(item.key)] = item.value;
          return acc;
        }, {});

      const cookieMap =
        storesData.cookieMap ||
        cookieItems.reduce((acc, item) => {
          if (item && typeof item.key !== "undefined")
            acc[String(item.key)] = item.value;
          return acc;
        }, {});

      // IndexedDB structured map: { [dbName]: { [storeName]: [ { key, value } ] } }
      let indexedMap = {};
      let indexedRecordCount = 0;

      if (
        storesData.indexedDatabases &&
        Array.isArray(storesData.indexedDatabases)
      ) {
        storesData.indexedDatabases.forEach(db => {
          if (!db || !db.name) return;
          indexedMap[db.name] = {};
          if (db.stores) {
            Object.keys(db.stores).forEach(sName => {
              indexedMap[db.name][sName] = db.stores[sName];
              indexedRecordCount += Array.isArray(db.stores[sName])
                ? db.stores[sName].length
                : 0;
            });
          }
        });
      } else if (Array.isArray(indexedItems)) {
        indexedItems.forEach(item => {
          if (!item) return;
          const dbName = item.db || "DefaultDB";
          const storeName = item.store || "DefaultStore";
          if (!indexedMap[dbName]) indexedMap[dbName] = {};
          if (!indexedMap[dbName][storeName]) indexedMap[dbName][storeName] = [];
          indexedMap[dbName][storeName].push({
            key: item.key,
            value: item.value,
          });
          indexedRecordCount++;
        });
      } else if (typeof indexedItems === "object" && indexedItems !== null) {
        indexedMap = indexedItems;
        Object.values(indexedMap).forEach(stores => {
          if (stores && typeof stores === "object") {
            Object.values(stores).forEach(recs => {
              if (Array.isArray(recs)) indexedRecordCount += recs.length;
            });
          }
        });
      }

      const totalItems =
        Object.keys(localMap).length +
        Object.keys(sessionMap).length +
        Object.keys(cookieMap).length +
        indexedRecordCount;

      const payload = {
        version: "2.0",
        format: "cradle-unified-storage-snapshot",
        exportedAt: new Date().toISOString(),
        origin:
          typeof window !== "undefined" && window.location
            ? window.location.origin
            : "unknown",
        stats: {
          localStorageCount: Object.keys(localMap).length,
          sessionStorageCount: Object.keys(sessionMap).length,
          cookieCount: Object.keys(cookieMap).length,
          indexedDBRecordCount: indexedRecordCount,
          totalItems,
        },
        stores: {
          localStorage: localMap,
          sessionStorage: sessionMap,
          cookies: cookieMap,
          indexedDB: indexedMap,
        },
      };

      return JSON.stringify(
        payload,
        null,
        options.pretty !== false ? 2 : undefined
      );
    } catch (e) {
      throw new Error(`Unified JSON export failed: ${e.message}`);
    }
  }

  /**
   * Export unified CSV snapshot containing all storage stores.
   */
  function exportUnifiedCSV(storesData = {}) {
    try {
      const rows = [];
      rows.push("Store,Database,ObjectStore,Key,Type,Bytes,Value");

      function addRow(store, db, objectStore, key, type, bytes, value) {
        const valStr =
          typeof value === "object" && value !== null
            ? JSON.stringify(value)
            : String(value ?? "");
        const escapedKey = `"${String(key ?? "").replace(/"/g, '""')}"`;
        const escapedVal = `"${valStr.replace(/"/g, '""')}"`;
        const escapedDb = `"${String(db ?? "").replace(/"/g, '""')}"`;
        const escapedStore = `"${String(objectStore ?? "").replace(/"/g, '""')}"`;
        rows.push(
          `${store},${escapedDb},${escapedStore},${escapedKey},${type || "string"},${bytes || 0},${escapedVal}`
        );
      }

      // LocalStorage
      if (Array.isArray(storesData.localStorage)) {
        storesData.localStorage.forEach(item => {
          addRow(
            "localStorage",
            "",
            "",
            item.key,
            item.type,
            item.bytes,
            item.value
          );
        });
      }

      // SessionStorage
      if (Array.isArray(storesData.sessionStorage)) {
        storesData.sessionStorage.forEach(item => {
          addRow(
            "sessionStorage",
            "",
            "",
            item.key,
            item.type,
            item.bytes,
            item.value
          );
        });
      }

      // Cookies
      if (Array.isArray(storesData.cookies)) {
        storesData.cookies.forEach(item => {
          addRow(
            "cookies",
            "",
            "",
            item.key,
            item.type,
            item.bytes,
            item.value
          );
        });
      }

      // IndexedDB
      if (Array.isArray(storesData.indexedDB)) {
        storesData.indexedDB.forEach(item => {
          addRow(
            "indexedDB",
            item.db || "",
            item.store || "",
            item.key,
            item.type,
            item.bytes,
            item.value
          );
        });
      }

      return rows.join("\n");
    } catch (e) {
      throw new Error(`Unified CSV export failed: ${e.message}`);
    }
  }

  /**
   * RFC-4180 compliant CSV text parser.
   */
  function parseCSV(text) {
    if (!text || typeof text !== "string") return [];
    const rows = [];
    let currentRow = [];
    let currentCell = "";
    let insideQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i += 2;
          continue;
        }
        insideQuotes = !insideQuotes;
        i++;
        continue;
      }

      if (char === "," && !insideQuotes) {
        currentRow.push(currentCell);
        currentCell = "";
        i++;
        continue;
      }

      if ((char === "\r" || char === "\n") && !insideQuotes) {
        currentRow.push(currentCell);
        currentCell = "";
        if (
          currentRow.length > 1 ||
          (currentRow.length === 1 && currentRow[0] !== "")
        ) {
          rows.push(currentRow);
        }
        currentRow = [];
        if (char === "\r" && nextChar === "\n") {
          i += 2;
        } else {
          i++;
        }
        continue;
      }

      currentCell += char;
      i++;
    }

    if (currentCell !== "" || currentRow.length > 0) {
      currentRow.push(currentCell);
      if (
        currentRow.length > 1 ||
        (currentRow.length === 1 && currentRow[0] !== "")
      ) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * Validate import JSON payload string structure (backward-compatible).
   */
  function validateImportJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== "object") {
        return { valid: false, error: "Invalid JSON object payload." };
      }
      const data = parsed.data || (Array.isArray(parsed) ? null : parsed);
      if (!data || typeof data !== "object") {
        return {
          valid: false,
          error: "JSON snapshot missing 'data' key-value mapping.",
        };
      }
      return { valid: true, data };
    } catch (e) {
      return { valid: false, error: `JSON Parse Error: ${e.message}` };
    }
  }

  /**
   * Comprehensive validation for both Unified & Single-store JSON/CSV snapshots.
   */
  function validateUnifiedImport(payloadString) {
    if (!payloadString || typeof payloadString !== "string") {
      return { valid: false, error: "Empty or invalid backup payload." };
    }

    const trimmed = payloadString.trim();

    // 1. Try parsing as JSON first
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== "object") {
          return { valid: false, error: "Invalid JSON object." };
        }

        // Case A: Unified format v2.0
        if (parsed.stores && typeof parsed.stores === "object") {
          const local = parsed.stores.localStorage || {};
          const session = parsed.stores.sessionStorage || {};
          const cookies = parsed.stores.cookies || {};
          const idb = parsed.stores.indexedDB || {};

          let idbCount = 0;
          Object.values(idb).forEach(stores => {
            if (stores && typeof stores === "object") {
              Object.values(stores).forEach(records => {
                if (Array.isArray(records)) idbCount += records.length;
              });
            }
          });

          return {
            valid: true,
            format: "unified-json",
            version: parsed.version || "2.0",
            stats: {
              localStorageCount: Object.keys(local).length,
              sessionStorageCount: Object.keys(session).length,
              cookieCount: Object.keys(cookies).length,
              indexedDBRecordCount: idbCount,
              totalItems:
                Object.keys(local).length +
                Object.keys(session).length +
                Object.keys(cookies).length +
                idbCount,
            },
            data: {
              localStorage: local,
              sessionStorage: session,
              cookies,
              indexedDB: idb,
            },
          };
        }

        // Case B: Single store format v1.0
        if (parsed.storeType && parsed.data) {
          const storeType = parsed.storeType;
          const count = Object.keys(parsed.data).length;
          return {
            valid: true,
            format: "single-json",
            storeType,
            version: parsed.version || "1.0",
            stats: {
              localStorageCount: storeType === "localStorage" ? count : 0,
              sessionStorageCount: storeType === "sessionStorage" ? count : 0,
              cookieCount: storeType === "cookies" ? count : 0,
              indexedDBRecordCount: 0,
              totalItems: count,
            },
            data: {
              [storeType]: parsed.data,
            },
          };
        }

        // Case C: Raw key-value dictionary
        const count = Object.keys(parsed).length;
        return {
          valid: true,
          format: "single-json",
          storeType: "localStorage",
          version: "raw",
          stats: {
            localStorageCount: count,
            sessionStorageCount: 0,
            cookieCount: 0,
            indexedDBRecordCount: 0,
            totalItems: count,
          },
          data: {
            localStorage: parsed,
          },
        };
      } catch (err) {
        return { valid: false, error: `JSON Parse Error: ${err.message}` };
      }
    }

    // 2. Try parsing as CSV
    const rows = parseCSV(trimmed);
    if (!rows.length) {
      return { valid: false, error: "Empty CSV data." };
    }

    const header = rows[0].map(c => c.trim().toLowerCase());

    // Check if unified CSV (has "store" and "key" columns)
    if (header.includes("store") && header.includes("key")) {
      const storeIdx = header.indexOf("store");
      const dbIdx = header.indexOf("database");
      const objStoreIdx = header.indexOf("objectstore");
      const keyIdx = header.indexOf("key");
      const valIdx = header.indexOf("value");

      const local = {};
      const session = {};
      const cookies = {};
      const idb = {};

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const storeType = (row[storeIdx] || "").trim().toLowerCase();
        const key = row[keyIdx] || "";
        const val = valIdx !== -1 ? row[valIdx] : "";
        const dbName = dbIdx !== -1 ? row[dbIdx] || "DefaultDB" : "DefaultDB";
        const objStore =
          objStoreIdx !== -1
            ? row[objStoreIdx] || "DefaultStore"
            : "DefaultStore";

        if (storeType === "localstorage" || storeType === "local") {
          local[key] = val;
        } else if (storeType === "sessionstorage" || storeType === "session") {
          session[key] = val;
        } else if (storeType === "cookies" || storeType === "cookie") {
          cookies[key] = val;
        } else if (storeType === "indexeddb" || storeType === "indexed") {
          if (!idb[dbName]) idb[dbName] = {};
          if (!idb[dbName][objStore]) idb[dbName][objStore] = [];
          let parsedVal = val;
          try {
            if (val.startsWith("{") || val.startsWith("["))
              parsedVal = JSON.parse(val);
          } catch {}
          idb[dbName][objStore].push({ key, value: parsedVal });
        }
      }

      let idbCount = 0;
      Object.values(idb).forEach(stores => {
        Object.values(stores).forEach(recs => {
          if (Array.isArray(recs)) idbCount += recs.length;
        });
      });

      return {
        valid: true,
        format: "unified-csv",
        stats: {
          localStorageCount: Object.keys(local).length,
          sessionStorageCount: Object.keys(session).length,
          cookieCount: Object.keys(cookies).length,
          indexedDBRecordCount: idbCount,
          totalItems:
            Object.keys(local).length +
            Object.keys(session).length +
            Object.keys(cookies).length +
            idbCount,
        },
        data: {
          localStorage: local,
          sessionStorage: session,
          cookies,
          indexedDB: idb,
        },
      };
    }

    // Check if standard single-store CSV (Key,Type,Bytes,Value)
    if (header.includes("key") && header.includes("value")) {
      const keyIdx = header.indexOf("key");
      const valIdx = header.indexOf("value");
      const local = {};

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const key = row[keyIdx] || "";
        const val = valIdx !== -1 ? row[valIdx] : "";
        if (key) local[key] = val;
      }

      return {
        valid: true,
        format: "single-csv",
        storeType: "localStorage",
        stats: {
          localStorageCount: Object.keys(local).length,
          sessionStorageCount: 0,
          cookieCount: 0,
          indexedDBRecordCount: 0,
          totalItems: Object.keys(local).length,
        },
        data: {
          localStorage: local,
        },
      };
    }

    return {
      valid: false,
      error:
        "Unrecognized backup file format. Expected JSON snapshot or CSV table.",
    };
  }

  /**
   * Restore key-value map into target storage (backward-compatible).
   */
  function restoreStorage(
    dataMap,
    targetStore = "localStorage",
    overwrite = true
  ) {
    let store;

    try {
      store =
        targetStore === "sessionStorage"
          ? typeof window !== "undefined" && window.sessionStorage
          : typeof window !== "undefined" && window.localStorage;
    } catch (e) {
      return {
        restoredCount: 0,
        success: false,
        error: `${targetStore} is unavailable. Check your browser storage permissions.`,
      };
    }

    if (!store) {
      return {
        restoredCount: 0,
        success: false,
        error: `${targetStore} is not available in this browser.`,
      };
    }

    let count = 0;

    try {
      Object.keys(dataMap).forEach(key => {
        if (overwrite || store.getItem(key) === null) {
          const val = dataMap[key];
          const valStr =
            typeof val === "object" ? JSON.stringify(val) : String(val);
          store.setItem(key, valStr);
          count++;
        }
      });

      return {
        restoredCount: count,
        success: true,
        error: null,
      };
    } catch (e) {
      return {
        restoredCount: count,
        success: false,
        error: `Unable to restore data to ${targetStore}. Check available storage space and browser permissions.`,
      };
    }
  }

  /**
   * Asynchronous Unified Restoration across localStorage, sessionStorage, and IndexedDB.
   */
  async function restoreUnifiedStorage(dataStores = {}, options = {}) {
    const overwrite = options.overwrite !== false;
    const restored = {
      localStorage: 0,
      sessionStorage: 0,
      cookies: 0,
      indexedDB: 0,
      total: 0,
    };
    const errors = [];

    // 1. Restore LocalStorage
    if (dataStores.localStorage && typeof dataStores.localStorage === "object") {
      try {
        const store =
          typeof window !== "undefined" ? window.localStorage : null;
        if (store) {
          Object.keys(dataStores.localStorage).forEach(key => {
            if (overwrite || store.getItem(key) === null) {
              const val = dataStores.localStorage[key];
              const valStr =
                typeof val === "object" ? JSON.stringify(val) : String(val);
              store.setItem(key, valStr);
              restored.localStorage++;
            }
          });
        }
      } catch (err) {
        errors.push(`LocalStorage restore error: ${err.message}`);
      }
    }

    // 2. Restore SessionStorage
    if (
      dataStores.sessionStorage &&
      typeof dataStores.sessionStorage === "object"
    ) {
      try {
        const store =
          typeof window !== "undefined" ? window.sessionStorage : null;
        if (store) {
          Object.keys(dataStores.sessionStorage).forEach(key => {
            if (overwrite || store.getItem(key) === null) {
              const val = dataStores.sessionStorage[key];
              const valStr =
                typeof val === "object" ? JSON.stringify(val) : String(val);
              store.setItem(key, valStr);
              restored.sessionStorage++;
            }
          });
        }
      } catch (err) {
        errors.push(`SessionStorage restore error: ${err.message}`);
      }
    }

    // 3. Restore Cookies
    if (dataStores.cookies && typeof dataStores.cookies === "object") {
      try {
        if (typeof document !== "undefined") {
          Object.keys(dataStores.cookies).forEach(key => {
            const val = dataStores.cookies[key];
            document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(String(val))}; path=/; max-age=86400`;
            restored.cookies++;
          });
        }
      } catch (err) {
        errors.push(`Cookies restore error: ${err.message}`);
      }
    }

    // 4. Restore IndexedDB
    if (dataStores.indexedDB && typeof dataStores.indexedDB === "object") {
      const idb =
        typeof indexedDB !== "undefined"
          ? indexedDB
          : typeof window !== "undefined"
            ? window.indexedDB
            : typeof global !== "undefined"
              ? global.indexedDB
              : null;

      if (idb) {
        for (const dbName of Object.keys(dataStores.indexedDB)) {
          const storesMap = dataStores.indexedDB[dbName];
          if (!storesMap || typeof storesMap !== "object") continue;

          try {
            await restoreIndexedDBDatabase(idb, dbName, storesMap, overwrite);
            Object.values(storesMap).forEach(records => {
              if (Array.isArray(records)) restored.indexedDB += records.length;
            });
          } catch (err) {
            errors.push(`IndexedDB '${dbName}' restore error: ${err.message}`);
          }
        }
      }
    }

    restored.total =
      restored.localStorage +
      restored.sessionStorage +
      restored.cookies +
      restored.indexedDB;

    return {
      success: errors.length === 0,
      restored,
      errors,
    };
  }

  /**
   * Helper to write object stores and records into an IndexedDB database.
   */
  function restoreIndexedDBDatabase(idb, dbName, storesMap, overwrite) {
    return new Promise((resolve, reject) => {
      try {
        const checkReq = idb.open(dbName);
        checkReq.onerror = () =>
          reject(checkReq.error || new Error("Failed to open DB"));
        checkReq.onsuccess = () => {
          const db = checkReq.result;
          const existingStores = new Set(Array.from(db.objectStoreNames || []));
          const neededStores = Object.keys(storesMap);
          const missingStores = neededStores.filter(
            s => !existingStores.has(s)
          );
          const currentVersion = db.version || 1;
          db.close();

          if (missingStores.length > 0) {
            const upgradeReq = idb.open(dbName, currentVersion + 1);
            upgradeReq.onupgradeneeded = e => {
              const upgradedDb = e.target.result;
              missingStores.forEach(s => {
                if (!upgradedDb.objectStoreNames.contains(s)) {
                  upgradedDb.createObjectStore(s);
                }
              });
            };
            upgradeReq.onsuccess = () => {
              const upgradedDb = upgradeReq.result;
              writeStoresData(upgradedDb, storesMap, overwrite)
                .then(() => {
                  upgradedDb.close();
                  resolve();
                })
                .catch(reject);
            };
            upgradeReq.onerror = () => reject(upgradeReq.error);
          } else {
            const writeReq = idb.open(dbName, currentVersion);
            writeReq.onsuccess = () => {
              const readyDb = writeReq.result;
              writeStoresData(readyDb, storesMap, overwrite)
                .then(() => {
                  readyDb.close();
                  resolve();
                })
                .catch(reject);
            };
            writeReq.onerror = () => reject(writeReq.error);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  function writeStoresData(db, storesMap, overwrite) {
    return new Promise((resolve, reject) => {
      const storeNames = Object.keys(storesMap).filter(s =>
        db.objectStoreNames.contains(s)
      );
      if (!storeNames.length) return resolve();

      try {
        const tx = db.transaction(storeNames, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);

        storeNames.forEach(sName => {
          const store = tx.objectStore(sName);
          const records = storesMap[sName];
          if (Array.isArray(records)) {
            records.forEach(rec => {
              if (
                rec &&
                typeof rec === "object" &&
                "key" in rec &&
                "value" in rec
              ) {
                if (store.keyPath) {
                  store.put(rec.value);
                } else {
                  store.put(rec.value, rec.key);
                }
              } else {
                store.put(rec);
              }
            });
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  exports.exportToJSON = exportToJSON;
  exports.exportToCSV = exportToCSV;
  exports.exportUnifiedJSON = exportUnifiedJSON;
  exports.exportUnifiedCSV = exportUnifiedCSV;
  exports.parseCSV = parseCSV;
  exports.validateImportJSON = validateImportJSON;
  exports.validateUnifiedImport = validateUnifiedImport;
  exports.restoreStorage = restoreStorage;
  exports.restoreUnifiedStorage = restoreUnifiedStorage;
})(
  typeof module !== "undefined" && module.exports
    ? module.exports
    : (window.StorageExporter = {})
);
