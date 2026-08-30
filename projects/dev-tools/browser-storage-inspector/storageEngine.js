/**
 * Browser Storage Inspector Engine
 * Unified wrapper for inspecting, parsing, and estimating byte storage footprints
 * across LocalStorage, SessionStorage, and Cookie stores.
 */
(function (exports) {
  "use strict";

  /**
   * Determine data type of raw storage string value.
   */
  function detectDataType(value) {
    if (typeof value !== "string") return "unknown";
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
    const kLen = key ? key.length * 2 : 0;
    const vLen = value ? value.length * 2 : 0;
    return kLen + vLen;
  }

  /**
   * Format bytes into human-readable unit (Bytes, KB, MB).
   */
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
        item.key.toLowerCase().includes(q) ||
        String(item.value).toLowerCase().includes(q);

      return matchType && matchQuery;
    });
  }

  /**
 * Read all key-value entries from LocalStorage or SessionStorage store.
 *
 * Gracefully handles unavailable storage and storage access errors.
 */
function readWebStorage(storeType = "localStorage") {
  const items = [];
  let totalBytes = 0;

  let store;

  try {
    store =
      storeType === "sessionStorage"
        ? window.sessionStorage
        : window.localStorage;
  } catch (error) {
    return {
      items,
      totalBytes,
      formattedTotal: "0 B"
    };
  }

  if (!store) {
    return {
      items,
      totalBytes,
      formattedTotal: "0 B"
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
        type
      });
    }
  } catch (error) {
    // Storage may become unavailable while being read.
    // Return entries collected before the failure.
  }

  return {
    items,
    totalBytes,
    formattedTotal: formatBytes(totalBytes)
  };
}

  /**
   * Read document cookies as structured key-value array.
   */
  function readCookies() {
    const items = [];
    let totalBytes = 0;
    const raw = document.cookie || "";

    if (!raw.trim()) {
      return {
        items,
        totalBytes,
        formattedTotal: "0 B"
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
        type
      });
    });

    return {
      items,
      totalBytes,
      formattedTotal: formatBytes(totalBytes)
    };
  }

  exports.detectDataType = detectDataType;
  exports.calculateByteSize = calculateByteSize;
  exports.formatBytes = formatBytes;
  exports.filterItems = filterItems;
  exports.readWebStorage = readWebStorage;
  exports.readCookies = readCookies;

})(typeof module !== "undefined" && module.exports
  ? module.exports
  : (window.StorageEngine = {}));