/**
 * Periodic Table Storage Handler - Manages bookmarks and filter preferences
 * Compatible with Node.js (in-memory fallback) and Browser environments
 */

(function (exports) {
  const storage =
    typeof window !== "undefined" && window.CradleStorage
      ? window.CradleStorage
      : require("../../../src/components/ui/storage.js");

  const STORAGE_KEY_BOOKMARKS = "cradle_periodic_bookmarks";
  const STORAGE_KEY_SETTINGS = "cradle_periodic_settings";

  const DEFAULT_SETTINGS = {
    tempK: 298,
    tempUnit: "C",
    themeMode: "standard",
  };

  /**
   * Retrieves bookmarked atomic numbers.
   * @returns {number[]} Array of atomic numbers
   */
  function getBookmarkedElements() {
    const list = storage.get(STORAGE_KEY_BOOKMARKS, []);
    return Array.isArray(list) ? list : [];
  }

  /**
   * Toggles bookmark state for an element by its atomic number.
   * @param {number} atomicNumber
   * @returns {boolean} True if now bookmarked, false if removed
   */
  function toggleBookmark(atomicNumber) {
    const list = getBookmarkedElements();
    const index = list.indexOf(atomicNumber);
    let isBookmarked = false;

    if (index >= 0) {
      list.splice(index, 1);
    } else {
      list.push(atomicNumber);
      isBookmarked = true;
    }

    storage.set(STORAGE_KEY_BOOKMARKS, list);

    return isBookmarked;
  }

  /**
   * Checks if an element is bookmarked.
   * @param {number} atomicNumber
   * @returns {boolean}
   */
  function isBookmarked(atomicNumber) {
    const list = getBookmarkedElements();
    return list.includes(atomicNumber);
  }

  /**
   * Retrieves user preferences.
   * @returns {Object} Settings object
   */
  function getSettings() {
    const saved = storage.get(STORAGE_KEY_SETTINGS, {});
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? { ...DEFAULT_SETTINGS, ...saved }
      : DEFAULT_SETTINGS;
  }

  /**
   * Saves user preferences.
   * @param {Object} newSettings
   */
  function saveSettings(newSettings) {
    const updated = { ...getSettings(), ...newSettings };
    storage.set(STORAGE_KEY_SETTINGS, updated);
    return updated;
  }

  exports.getBookmarkedElements = getBookmarkedElements;
  exports.toggleBookmark = toggleBookmark;
  exports.isBookmarked = isBookmarked;
  exports.getSettings = getSettings;
  exports.saveSettings = saveSettings;
})(typeof exports === "undefined" ? (window.PeriodicStorage = {}) : exports);
