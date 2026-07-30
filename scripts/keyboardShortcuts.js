/**
 * Cradle — Keyboard shortcut matching
 * ───────────────────────────────────
 * Turns a raw `keydown` event into a named action, or `null` when the event
 * is not a Cradle shortcut.
 *
 * Kept separate from `script.js` for two reasons: matching is pure, so it can
 * be unit-tested without a browser, and every rule about modifiers and text
 * fields lives in one place instead of being spread across a long `if` chain.
 *
 * Loads as a CommonJS module in Node and as a `window.CradleShortcuts` global
 * in the browser.
 */

(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  } else {
    root.CradleShortcuts = api;
  }
})(
  typeof self !== "undefined"
    ? self
    : typeof globalThis !== "undefined"
      ? globalThis
      : this,
  function () {
    "use strict";

    /** Actions a shortcut can resolve to. */
    const ACTIONS = {
      FOCUS_SEARCH: "focus-search",
      DISMISS: "dismiss",
      TOGGLE_THEME: "toggle-theme",
      TOGGLE_SHORTCUTS: "toggle-shortcuts",
    };

    const TEXT_ENTRY_TAGS = ["INPUT", "TEXTAREA", "SELECT"];

    /**
     * Is the user currently typing into something?
     *
     * Single-key shortcuts such as `/` and `T` must never steal a keystroke
     * from a field the user is typing in.
     *
     * @param {object} element The event target / active element.
     * @returns {boolean} True when the element accepts text input.
     */
    function isTextEntryTarget(element) {
      if (!element || typeof element !== "object") return false;
      if (element.isContentEditable) return true;

      const tagName =
        typeof element.tagName === "string"
          ? element.tagName.toUpperCase()
          : "";

      return TEXT_ENTRY_TAGS.includes(tagName);
    }

    /**
     * Is any modifier key held down?
     *
     * @param {object} event Keyboard event.
     * @returns {boolean} True when ctrl, meta, alt or shift is pressed.
     */
    function hasAnyModifier(event) {
      return Boolean(
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
      );
    }

    /**
     * Is this the platform "command" chord — Ctrl on Windows/Linux, Cmd on macOS?
     *
     * The previous implementation only checked `event.ctrlKey`, so Cmd+K did
     * nothing on macOS even though the README and the in-app shortcuts dialog
     * both advertise it.
     *
     * @param {object} event Keyboard event.
     * @returns {boolean} True for a plain Ctrl/Cmd chord.
     */
    function isCommandChord(event) {
      /*
       * Exactly one of ctrl/meta, and no alt. Alt+Ctrl+K and Ctrl+Cmd+K are
       * OS- or extension-level chords that the page should not intercept.
       */
      const ctrl = Boolean(event.ctrlKey);
      const meta = Boolean(event.metaKey);

      return ctrl !== meta && !event.altKey;
    }

    /**
     * Resolve a keydown event to a Cradle action.
     *
     * @param {object} event Keyboard event (or a plain object in tests).
     * @param {object} [context]
     * @param {boolean} [context.isModalOpen=false] Is the shortcuts dialog open?
     * @param {object} [context.activeElement] Element that currently has focus.
     * @returns {string|null} One of {@link ACTIONS}, or `null` for no match.
     */
    function matchShortcut(event, context) {
      if (!event || typeof event !== "object") return null;

      /*
       * `event.key` is not always a string. Autofill, IME composition and some
       * Android soft keyboards dispatch keydown events without it, and the old
       * `e.key.toLowerCase()` calls threw a TypeError that aborted the whole
       * handler — taking every other shortcut down with it.
       */
      if (typeof event.key !== "string" || !event.key) return null;

      const settings = context || {};
      const isModalOpen = Boolean(settings.isModalOpen);
      const target =
        settings.activeElement !== undefined
          ? settings.activeElement
          : event.target;
      const typing = isTextEntryTarget(target);
      const key = event.key;
      const lowerKey = key.toLowerCase();

      /* Escape always works, including while typing and while the modal is open. */
      if (key === "Escape") return ACTIONS.DISMISS;

      /* Ctrl+K / Cmd+K works even while typing — it is a global "go to search". */
      if (lowerKey === "k" && isCommandChord(event)) {
        return ACTIONS.FOCUS_SEARCH;
      }

      /*
       * Everything below is a bare key press. While the shortcuts dialog is
       * open, focus belongs to the dialog, so only its own toggle applies.
       */
      if (isModalOpen) {
        return key === "?" ? ACTIONS.TOGGLE_SHORTCUTS : null;
      }

      if (typing) return null;

      if (key === "/" && !hasAnyModifier(event)) {
        return ACTIONS.FOCUS_SEARCH;
      }

      /*
       * `?` is Shift+/ on most layouts, so shift is expected here. Any other
       * modifier means it is not our shortcut.
       */
      if (key === "?" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        return ACTIONS.TOGGLE_SHORTCUTS;
      }

      /*
       * Modifiers must be excluded here. The old code matched bare `t` without
       * checking them, so Cmd+T / Ctrl+T flipped the theme behind the user's
       * back while the browser opened a new tab.
       */
      if (lowerKey === "t" && !hasAnyModifier(event)) {
        return ACTIONS.TOGGLE_THEME;
      }

      return null;
    }

    /**
     * Does this platform use Cmd rather than Ctrl for the command chord?
     *
     * Used to label the shortcut hints correctly instead of always saying Ctrl.
     *
     * @param {object} [navigatorRef=navigator] Injectable for tests.
     * @returns {boolean} True on Apple platforms.
     */
    function isApplePlatform(navigatorRef) {
      const nav =
        navigatorRef ||
        (typeof navigator !== "undefined" ? navigator : undefined);

      if (!nav) return false;

      const platform = String(
        (nav.userAgentData && nav.userAgentData.platform) ||
          nav.platform ||
          nav.userAgent ||
          ""
      );

      return /mac|iphone|ipad|ipod/i.test(platform);
    }

    /**
     * Label for the command modifier on this platform.
     *
     * @param {object} [navigatorRef] Injectable for tests.
     * @returns {string} `"⌘"` on Apple platforms, otherwise `"Ctrl"`.
     */
    function commandKeyLabel(navigatorRef) {
      return isApplePlatform(navigatorRef) ? "⌘" : "Ctrl";
    }

    return {
      ACTIONS,
      isTextEntryTarget,
      hasAnyModifier,
      isCommandChord,
      matchShortcut,
      isApplePlatform,
      commandKeyLabel,
    };
  }
);
