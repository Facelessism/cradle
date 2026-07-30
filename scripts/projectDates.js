/**
 * Cradle — Project date helpers
 * ─────────────────────────────
 * Shared between the build step (`scripts/generate-projects.js`, which writes
 * `dateAdded` into `data/projects.json`) and the landing page (`script.js`,
 * which decides whether a card gets the "New" ribbon).
 *
 * Both sides must agree on the format and on the freshness window, otherwise
 * the ribbon either never appears or never goes away.
 *
 * Loads as a CommonJS module in Node and as a `window.CradleProjectDates`
 * global in the browser.
 */

(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  } else {
    root.CradleProjectDates = api;
  }
})(
  typeof self !== "undefined"
    ? self
    : typeof globalThis !== "undefined"
      ? globalThis
      : this,
  function () {
    "use strict";

    /** How long a project keeps its "New" ribbon, in days. */
    const NEW_PROJECT_WINDOW_DAYS = 7;

    const MS_PER_DAY = 86400000;
    const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

    /**
     * Render a Date as a `YYYY-MM-DD` string in UTC.
     *
     * Date-only on purpose: `projects.json` is committed, and storing a full
     * timestamp would make every regeneration produce a diff that depends on
     * the contributor's timezone.
     *
     * @param {Date} date Date to format.
     * @returns {string|null} `YYYY-MM-DD`, or `null` if the date is invalid.
     */
    function toIsoDate(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
      return date.toISOString().slice(0, 10);
    }

    /**
     * Parse a stored `dateAdded` value into a Date.
     *
     * Rejects anything that is not a real, finite date so a typo in
     * `projects.json` degrades to "not new" rather than producing `NaN`
     * comparisons that quietly evaluate to `false` in one place and `true`
     * in another.
     *
     * @param {unknown} value Raw `dateAdded` value.
     * @returns {Date|null} A valid Date, or `null`.
     */
    function parseDateAdded(value) {
      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
      }

      if (typeof value !== "string" || !value.trim()) return null;

      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    /**
     * Is this value already a normalised `YYYY-MM-DD` date string?
     *
     * @param {unknown} value Value to check.
     * @returns {boolean} True when the value is a valid ISO date string.
     */
    function isValidIsoDate(value) {
      if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) {
        return false;
      }
      return parseDateAdded(value) !== null;
    }

    /**
     * Should this project show the "New" ribbon?
     *
     * @param {unknown} dateAdded Value from the project record.
     * @param {number} [now=Date.now()] Reference time, injectable for tests.
     * @returns {boolean} True when the project was added within the window.
     */
    function isNewProject(dateAdded, now) {
      const parsed = parseDateAdded(dateAdded);
      if (!parsed) return false;

      const reference = typeof now === "number" ? now : Date.now();
      const ageInDays = (reference - parsed.getTime()) / MS_PER_DAY;

      /*
       * The upper bound is the freshness window. The lower bound guards
       * against a clock skew or a bad entry dated in the future, which would
       * otherwise pin the ribbon on permanently.
       */
      return ageInDays >= -1 && ageInDays <= NEW_PROJECT_WINDOW_DAYS;
    }

    return {
      NEW_PROJECT_WINDOW_DAYS,
      MS_PER_DAY,
      toIsoDate,
      parseDateAdded,
      isValidIsoDate,
      isNewProject,
    };
  }
);
