/**
 * Planner Engine - Time Block Overlap Detection & iCal Exporter
 */
(function (exports) {
  /**
   * Converts HH:MM string to total minutes from midnight.
   * @param {string} timeStr - e.g. "09:30"
   * @returns {number} Minutes from midnight
   */
  function timeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return 0;
    const parts = timeStr.split(":");
    if (parts.length < 2) return 0;
    const hours = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    return hours * 60 + mins;
  }

  /**
   * Converts minutes from midnight to HH:MM string.
   * @param {number} totalMinutes
   * @returns {string} e.g. "09:30"
   */
  function minutesToTime(totalMinutes) {
    const mins = Math.max(0, Math.min(1439, totalMinutes));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  /**
   * Checks if two time intervals overlap.
   * @param {number} startA
   * @param {number} endA
   * @param {number} startB
   * @param {number} endB
   * @returns {boolean}
   */
  function isOverlapping(startA, endA, startB, endB) {
    return Math.max(startA, startB) < Math.min(endA, endB);
  }

  /**
   * Detects all overlapping time block pairs in a schedule.
   * @param {Array} blocks - Array of block objects { id, title, startMinutes, endMinutes }
   * @returns {Array} List of overlapping block IDs
   */
  function findCollidingBlocks(blocks = []) {
    if (!Array.isArray(blocks) || blocks.length < 2) return [];

    const collidingIds = new Set();
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i];
        const b = blocks[j];

        const startA = a.startMinutes !== undefined ? a.startMinutes : timeToMinutes(a.start);
        const endA = a.endMinutes !== undefined ? a.endMinutes : timeToMinutes(a.end);
        const startB = b.startMinutes !== undefined ? b.startMinutes : timeToMinutes(b.start);
        const endB = b.endMinutes !== undefined ? b.endMinutes : timeToMinutes(b.end);

        if (isOverlapping(startA, endA, startB, endB)) {
          collidingIds.add(a.id);
          collidingIds.add(b.id);
        }
      }
    }

    return Array.from(collidingIds);
  }

  /**
   * Calculates category hours breakdown.
   * @param {Array} blocks
   * @returns {Object} Category total hours and percentages
   */
  function calculateCategoryBreakdown(blocks = []) {
    const totals = {};
    let grandTotalMinutes = 0;

    blocks.forEach(block => {
      const start = block.startMinutes !== undefined ? block.startMinutes : timeToMinutes(block.start);
      const end = block.endMinutes !== undefined ? block.endMinutes : timeToMinutes(block.end);
      const duration = Math.max(0, end - start);

      const cat = block.category || "other";
      totals[cat] = (totals[cat] || 0) + duration;
      grandTotalMinutes += duration;
    });

    const breakdown = {};
    Object.entries(totals).forEach(([cat, mins]) => {
      breakdown[cat] = {
        minutes: mins,
        hours: Math.round((mins / 60) * 10) / 10,
        percentage: grandTotalMinutes > 0 ? Math.round((mins / grandTotalMinutes) * 100) : 0
      };
    });

    return { totalHours: Math.round((grandTotalMinutes / 60) * 10) / 10, breakdown };
  }

  /**
   * Generates standard iCalendar (.ics) content string from blocks schedule.
   * @param {Array} blocks
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {string} iCal formatted text
   */
  function generateICalendar(blocks = [], dateStr = "2026-07-24") {
    const cleanDate = dateStr.replace(/-/g, "");
    let ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Cradle//Time Blocking Planner//EN",
      "CALSCALE:GREGORIAN"
    ];

    blocks.forEach(b => {
      const startMins = b.startMinutes !== undefined ? b.startMinutes : timeToMinutes(b.start);
      const endMins = b.endMinutes !== undefined ? b.endMinutes : timeToMinutes(b.end);

      const startH = String(Math.floor(startMins / 60)).padStart(2, "0");
      const startM = String(startMins % 60).padStart(2, "0");
      const endH = String(Math.floor(endMins / 60)).padStart(2, "0");
      const endM = String(endMins % 60).padStart(2, "0");

      const dtStart = `${cleanDate}T${startH}${startM}00`;
      const dtEnd = `${cleanDate}T${endH}${endM}00`;

      ics.push(
        "BEGIN:VEVENT",
        `SUMMARY:${b.title || "Time Block"}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `DESCRIPTION:Category: ${b.category || "General"}`,
        "END:VEVENT"
      );
    });

    ics.push("END:VCALENDAR");
    return ics.join("\r\n");
  }

  exports.timeToMinutes = timeToMinutes;
  exports.minutesToTime = minutesToTime;
  exports.isOverlapping = isOverlapping;
  exports.findCollidingBlocks = findCollidingBlocks;
  exports.calculateCategoryBreakdown = calculateCategoryBreakdown;
  exports.generateICalendar = generateICalendar;
})(typeof exports === "undefined" ? (window.PlannerEngine = {}) : exports);
