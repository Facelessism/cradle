/**
 * Planner Storage - Persistence layer & JSON Data Exporter/Importer
 */
(function (exports) {
  const storage =
    typeof window !== "undefined" && window.CradleStorage
      ? window.CradleStorage
      : require("../../../src/components/ui/storage.js");
  const store = storage.namespace("cradle_tb_planner_");

  function getSchedule(dateStr) {
    if (!dateStr) return [];
    const blocks = store.get(dateStr, []);
    return Array.isArray(blocks) ? blocks : [];
  }

  function saveSchedule(dateStr, blocks) {
    if (!dateStr) return false;
    return store.set(dateStr, blocks);
  }

  function sanitizeBlocks(blocks) {
    if (!Array.isArray(blocks)) return [];
    return blocks.map((b, idx) => ({
      id: b.id || `block_${Date.now()}_${idx}`,
      title: String(b.title || "Untitled Block"),
      category: String(b.category || "work"),
      start: String(b.start || "09:00"),
      end: String(b.end || "10:00"),
      color: String(b.color || "#3b82f6"),
      notes: String(b.notes || ""),
    }));
  }

  exports.getSchedule = getSchedule;
  exports.saveSchedule = saveSchedule;
  exports.sanitizeBlocks = sanitizeBlocks;
})(typeof exports === "undefined" ? (window.PlannerStorage = {}) : exports);
