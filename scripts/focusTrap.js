/**
 * Cradle — Focus trap
 * ───────────────────
 * Keeps keyboard focus inside an open dialog and hands it back to whatever
 * opened it on close.
 *
 * Without this, a `role="dialog"` is only a visual overlay: Tab walks straight
 * out of it into the page behind, and a screen reader user never lands inside
 * the dialog at all.
 *
 * The index arithmetic and the focusability test are exported separately so
 * they can be unit-tested without a real browser.
 *
 * Loads as a CommonJS module in Node and as a `window.CradleFocusTrap` global
 * in the browser.
 */

(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  } else {
    root.CradleFocusTrap = api;
  }
})(
  typeof self !== "undefined"
    ? self
    : typeof globalThis !== "undefined"
      ? globalThis
      : this,
  function () {
    "use strict";

    /**
     * Everything that can hold keyboard focus by default, plus anything given
     * an explicit non-negative tabindex.
     */
    const FOCUSABLE_SELECTOR = [
      "a[href]",
      "button",
      "input",
      "select",
      "textarea",
      "summary",
      "audio[controls]",
      "video[controls]",
      "[contenteditable]",
      '[tabindex]:not([tabindex^="-"])',
    ].join(", ");

    /**
     * Can this element actually receive focus right now?
     *
     * Being matched by the selector is not enough — a disabled button, a
     * `hidden` element, or one with `tabindex="-1"` is skipped by the browser
     * and must be skipped here too, otherwise Tab appears to do nothing.
     *
     * @param {object} element Candidate element.
     * @returns {boolean} True when the element is focusable.
     */
    function isFocusable(element) {
      if (!element || typeof element !== "object") return false;
      if (element.disabled) return false;
      if (element.hidden) return false;

      const tabIndexAttr =
        typeof element.getAttribute === "function"
          ? element.getAttribute("tabindex")
          : null;

      if (tabIndexAttr !== null && Number(tabIndexAttr) < 0) return false;

      if (
        typeof element.getAttribute === "function" &&
        element.getAttribute("aria-hidden") === "true"
      ) {
        return false;
      }

      /*
       * `offsetParent` is null for anything with `display: none`, including
       * ancestors. Only consulted when present, so plain objects still work
       * in tests.
       */
      if ("offsetParent" in element && element.offsetParent === null) {
        /*
         * `position: fixed` elements legitimately report a null offsetParent,
         * so treat a measured size as proof of visibility.
         */
        const width = element.offsetWidth || 0;
        const height = element.offsetHeight || 0;

        if (!width && !height) return false;
      }

      return true;
    }

    /**
     * Collect the focusable elements inside a container, in tab order.
     *
     * @param {object} container Element to search.
     * @returns {Array<object>} Focusable descendants.
     */
    function getFocusableElements(container) {
      if (!container || typeof container.querySelectorAll !== "function") {
        return [];
      }

      return Array.prototype.slice
        .call(container.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter(isFocusable);
    }

    /**
     * Where should focus go after a Tab press?
     *
     * Wraps at both ends, which is what makes the trap a trap.
     *
     * @param {number} currentIndex Index of the focused element, or -1.
     * @param {number} total How many focusable elements there are.
     * @param {boolean} backwards True for Shift+Tab.
     * @returns {number} Index to focus next, or -1 when there is nothing to focus.
     */
    function getNextFocusIndex(currentIndex, total, backwards) {
      if (!total || total < 1) return -1;

      /*
       * Focus currently sits outside the trap (index -1) — for example right
       * after the dialog opened. Tab enters at the top, Shift+Tab at the end.
       */
      if (currentIndex < 0) return backwards ? total - 1 : 0;

      if (backwards) {
        return currentIndex === 0 ? total - 1 : currentIndex - 1;
      }

      return currentIndex === total - 1 ? 0 : currentIndex + 1;
    }

    /**
     * Build a focus trap for a container.
     *
     * @param {object} container The dialog element.
     * @param {object} [options]
     * @param {object} [options.initialFocus] Element to focus on activate.
     * @param {object} [options.documentRef=document] Injectable for tests.
     * @returns {{activate: Function, deactivate: Function, handleKeydown: Function}}
     */
    function createFocusTrap(container, options) {
      const settings = options || {};
      const doc =
        settings.documentRef ||
        (typeof document !== "undefined" ? document : null);

      let previouslyFocused = null;
      let isActive = false;

      /**
       * Handle a keydown while the trap is active.
       *
       * @param {object} event Keyboard event.
       * @returns {boolean} True when the event was handled.
       */
      function handleKeydown(event) {
        if (!isActive || !event || event.key !== "Tab") return false;

        const focusable = getFocusableElements(container);

        if (!focusable.length) {
          /*
           * Nothing focusable inside: keep focus on the dialog itself rather
           * than letting Tab escape to the page behind the overlay.
           */
          if (event.preventDefault) event.preventDefault();
          if (container && typeof container.focus === "function") {
            container.focus();
          }
          return true;
        }

        const active = doc ? doc.activeElement : null;
        const currentIndex = focusable.indexOf(active);
        const nextIndex = getNextFocusIndex(
          currentIndex,
          focusable.length,
          Boolean(event.shiftKey)
        );

        if (nextIndex < 0) return false;

        if (event.preventDefault) event.preventDefault();
        focusable[nextIndex].focus();

        return true;
      }

      return {
        /** Remember the trigger, then move focus into the dialog. */
        activate() {
          if (isActive) return;

          previouslyFocused = doc ? doc.activeElement : null;
          isActive = true;

          const focusable = getFocusableElements(container);
          const target =
            settings.initialFocus && isFocusable(settings.initialFocus)
              ? settings.initialFocus
              : focusable[0] || container;

          if (target && typeof target.focus === "function") {
            target.focus();
          }
        },

        /** Release the trap and return focus to whatever opened the dialog. */
        deactivate() {
          if (!isActive) return;

          isActive = false;

          /*
           * Returning focus matters as much as trapping it. Without this the
           * user is dumped at the top of the document and has to tab all the
           * way back to where they were.
           */
          if (
            previouslyFocused &&
            typeof previouslyFocused.focus === "function"
          ) {
            previouslyFocused.focus();
          }

          previouslyFocused = null;
        },

        handleKeydown,

        /** @returns {boolean} Whether the trap is currently active. */
        get active() {
          return isActive;
        },
      };
    }

    return {
      FOCUSABLE_SELECTOR,
      isFocusable,
      getFocusableElements,
      getNextFocusIndex,
      createFocusTrap,
    };
  }
);
