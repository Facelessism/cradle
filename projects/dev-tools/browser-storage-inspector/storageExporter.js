/**

* Browser Storage Exporter & Backup Manager
* Provides JSON/CSV snapshot export, encrypted string backup payload generation,
* and import schema validation.
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
  if (item && typeof item.key === "string") {
  acc[item.key] = item.value;
  }
  return acc;
  }, {})
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
  const escapedKey = `"${String(item.key).replace(/"/g, '""')}"`;
  const escapedVal = `"${String(item.value).replace(/"/g, '""')}"`;
  return `${escapedKey},${item.type},${item.bytes},${escapedVal}`;
  });

  return "Key,Type,Bytes,Value\n" + rows.join("\n");
  } catch (e) {
  throw new Error(`CSV export failed: ${e.message}`);
  }
  }

/**

* Validate import JSON payload string structure.
  */
  function validateImportJSON(jsonString) {
  try {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== "object") {
  return { valid: false, error: "Invalid JSON object payload." };
  }
  const data = parsed.data || (Array.isArray(parsed) ? null : parsed);
  if (!data || typeof data !== "object") {
  return { valid: false, error: "JSON snapshot missing 'data' key-value mapping." };
  }
  return { valid: true, data };
  } catch (e) {
  return { valid: false, error: `JSON Parse Error: ${e.message}` };
  }
  }

/**

* Restore key-value map into target storage.
  */
  function restoreStorage(dataMap, targetStore = "localStorage", overwrite = true) {
  let store;

try {
  store = targetStore === "sessionStorage" ? window.sessionStorage : window.localStorage;
} catch (e) {
  return {
    restoredCount: 0,
    success: false,
    error: `${targetStore} is unavailable. Check your browser storage permissions.`
  };
}

if (!store) {
  return {
    restoredCount: 0,
    success: false,
    error: `${targetStore} is not available in this browser.`
  };
}

let count = 0;

try {
  Object.keys(dataMap).forEach(key => {
    if (overwrite || store.getItem(key) === null) {
      store.setItem(key, String(dataMap[key]));
      count++;
    }
  });

  return {
    restoredCount: count,
    success: true,
    error: null
  };
} catch (e) {
  return {
    restoredCount: count,
    success: false,
    error: `Unable to restore data to ${targetStore}. Check available storage space and browser permissions.`
  };
}

}

exports.exportToJSON = exportToJSON;
exports.exportToCSV = exportToCSV;
exports.validateImportJSON = validateImportJSON;
exports.restoreStorage = restoreStorage;
})(typeof module !== "undefined" && module.exports
? module.exports
: (window.StorageExporter = {}));
