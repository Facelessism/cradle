const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const SCRIPT_PATH = path.join(REPO_ROOT, "script.js");
const INDEX_PATH = path.join(REPO_ROOT, "index.html");
const README_PATH = path.join(REPO_ROOT, "README.md");

const shortcuts = require(
  path.join(REPO_ROOT, "scripts", "keyboardShortcuts.js")
);

const { ACTIONS } = shortcuts;

/**
 * Build a keydown-like event object.
 *
 * @param {string} key The `key` value.
 * @param {object} [modifiers] ctrlKey / metaKey / altKey / shiftKey overrides.
 * @returns {object} A plain object shaped like a KeyboardEvent.
 */
function keyEvent(key, modifiers) {
  return Object.assign(
    {
      key,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target: null,
    },
    modifiers
  );
}

/** A stand-in for a focused text input. */
const TEXT_INPUT = { tagName: "INPUT", isContentEditable: false };
/** A stand-in for a focused non-input element. */
const BODY = { tagName: "BODY", isContentEditable: false };

/* ── The macOS regression ────────────────────────────────────────────── */

test("Cmd+K focuses the search bar on macOS", () => {
  /*
   * The core bug: README.md and the in-app shortcuts dialog both advertise
   * Cmd+K, but the handler only tested event.ctrlKey, so it did nothing on
   * every Mac.
   */
  assert.equal(
    shortcuts.matchShortcut(keyEvent("k", { metaKey: true }), {
      activeElement: BODY,
    }),
    ACTIONS.FOCUS_SEARCH
  );
});

test("Ctrl+K still focuses the search bar", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("k", { ctrlKey: true }), {
      activeElement: BODY,
    }),
    ACTIONS.FOCUS_SEARCH
  );
});

test("Cmd+K works even while the user is typing", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("k", { metaKey: true }), {
      activeElement: TEXT_INPUT,
    }),
    ACTIONS.FOCUS_SEARCH
  );
});

test("uppercase K is matched too", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("K", { metaKey: true }), {
      activeElement: BODY,
    }),
    ACTIONS.FOCUS_SEARCH
  );
});

test("Ctrl+Alt+K is left to the OS", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("k", { ctrlKey: true, altKey: true }), {
      activeElement: BODY,
    }),
    null
  );
});

test("Ctrl+Cmd+K is not a Cradle shortcut", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("k", { ctrlKey: true, metaKey: true }), {
      activeElement: BODY,
    }),
    null
  );
});

test("a bare K types normally", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("k"), { activeElement: BODY }),
    null
  );
});

/* ── Crash guard ─────────────────────────────────────────────────────── */

test("an event with no key returns null instead of throwing", () => {
  /*
   * Autofill, IME composition and some Android keyboards dispatch keydown
   * without a `key`. `e.key.toLowerCase()` threw a TypeError there, aborting
   * the handler and silently disabling every shortcut for that keystroke.
   */
  assert.doesNotThrow(() => shortcuts.matchShortcut(keyEvent(undefined), {}));
  assert.equal(shortcuts.matchShortcut(keyEvent(undefined), {}), null);
  assert.equal(shortcuts.matchShortcut(keyEvent(null), {}), null);
  assert.equal(shortcuts.matchShortcut(keyEvent(""), {}), null);
});

test("a null or non-object event returns null", () => {
  assert.equal(shortcuts.matchShortcut(null, {}), null);
  assert.equal(shortcuts.matchShortcut(undefined, {}), null);
  assert.equal(shortcuts.matchShortcut("keydown", {}), null);
});

test("matchShortcut works with no context argument", () => {
  assert.doesNotThrow(() => shortcuts.matchShortcut(keyEvent("Escape")));
  assert.equal(shortcuts.matchShortcut(keyEvent("Escape")), ACTIONS.DISMISS);
});

/* ── Theme toggle ────────────────────────────────────────────────────── */

test("T toggles the theme", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("t"), { activeElement: BODY }),
    ACTIONS.TOGGLE_THEME
  );
  assert.equal(
    shortcuts.matchShortcut(keyEvent("T"), { activeElement: BODY }),
    ACTIONS.TOGGLE_THEME
  );
});

test("Cmd+T does not toggle the theme", () => {
  /*
   * Cmd+T / Ctrl+T opens a browser tab. The old handler matched bare `t`
   * without checking modifiers, so the theme flipped behind the new tab.
   */
  assert.equal(
    shortcuts.matchShortcut(keyEvent("t", { metaKey: true }), {
      activeElement: BODY,
    }),
    null
  );
  assert.equal(
    shortcuts.matchShortcut(keyEvent("t", { ctrlKey: true }), {
      activeElement: BODY,
    }),
    null
  );
});

test("typing a t in the search box does not toggle the theme", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("t"), { activeElement: TEXT_INPUT }),
    null
  );
});

test("typing a t in a contenteditable does not toggle the theme", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("t"), {
      activeElement: { tagName: "DIV", isContentEditable: true },
    }),
    null
  );
});

test("T does nothing while the shortcuts dialog is open", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("t"), {
      activeElement: BODY,
      isModalOpen: true,
    }),
    null
  );
});

/* ── Search focus via slash ──────────────────────────────────────────── */

test("/ focuses the search bar", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("/"), { activeElement: BODY }),
    ACTIONS.FOCUS_SEARCH
  );
});

test("/ typed inside an input is left alone", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("/"), { activeElement: TEXT_INPUT }),
    null
  );
});

test("/ does nothing while the shortcuts dialog is open", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("/"), {
      activeElement: BODY,
      isModalOpen: true,
    }),
    null
  );
});

/* ── Escape ──────────────────────────────────────────────────────────── */

test("Escape always resolves to dismiss", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("Escape"), { activeElement: BODY }),
    ACTIONS.DISMISS
  );
  assert.equal(
    shortcuts.matchShortcut(keyEvent("Escape"), { activeElement: TEXT_INPUT }),
    ACTIONS.DISMISS
  );
  assert.equal(
    shortcuts.matchShortcut(keyEvent("Escape"), {
      activeElement: BODY,
      isModalOpen: true,
    }),
    ACTIONS.DISMISS
  );
});

/* ── Shortcuts dialog ────────────────────────────────────────────────── */

test("? toggles the shortcuts dialog", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("?", { shiftKey: true }), {
      activeElement: BODY,
    }),
    ACTIONS.TOGGLE_SHORTCUTS
  );
});

test("? still closes the dialog while it is open", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("?", { shiftKey: true }), {
      activeElement: BODY,
      isModalOpen: true,
    }),
    ACTIONS.TOGGLE_SHORTCUTS
  );
});

test("? typed into an input is left alone", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("?", { shiftKey: true }), {
      activeElement: TEXT_INPUT,
    }),
    null
  );
});

test("Cmd+? is not a Cradle shortcut", () => {
  assert.equal(
    shortcuts.matchShortcut(keyEvent("?", { metaKey: true }), {
      activeElement: BODY,
    }),
    null
  );
});

/* ── Helpers ─────────────────────────────────────────────────────────── */

test("isTextEntryTarget recognises the text-entry elements", () => {
  assert.equal(shortcuts.isTextEntryTarget({ tagName: "INPUT" }), true);
  assert.equal(shortcuts.isTextEntryTarget({ tagName: "TEXTAREA" }), true);
  assert.equal(shortcuts.isTextEntryTarget({ tagName: "SELECT" }), true);
  assert.equal(
    shortcuts.isTextEntryTarget({ tagName: "DIV", isContentEditable: true }),
    true
  );
  assert.equal(shortcuts.isTextEntryTarget({ tagName: "DIV" }), false);
  assert.equal(shortcuts.isTextEntryTarget(null), false);
  assert.equal(shortcuts.isTextEntryTarget(undefined), false);
});

test("isApplePlatform detects Apple platforms", () => {
  assert.equal(shortcuts.isApplePlatform({ platform: "MacIntel" }), true);
  assert.equal(shortcuts.isApplePlatform({ platform: "iPhone" }), true);
  assert.equal(
    shortcuts.isApplePlatform({ userAgentData: { platform: "macOS" } }),
    true
  );
  assert.equal(shortcuts.isApplePlatform({ platform: "Win32" }), false);
  assert.equal(shortcuts.isApplePlatform({ platform: "Linux x86_64" }), false);
  assert.equal(shortcuts.isApplePlatform({}), false);
});

test("commandKeyLabel matches the platform", () => {
  assert.equal(shortcuts.commandKeyLabel({ platform: "MacIntel" }), "⌘");
  assert.equal(shortcuts.commandKeyLabel({ platform: "Win32" }), "Ctrl");
});

/* ── Wiring guards ───────────────────────────────────────────────────── */

test("script.js no longer tests ctrlKey on its own", () => {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");

  assert.ok(
    !/e\.ctrlKey && e\.key\.toLowerCase\(\) === "k"/.test(source),
    "the ctrl-only Cmd+K bug should be gone"
  );
  assert.match(source, /CradleShortcuts/);
});

test("script.js no longer calls e.key.toLowerCase() unguarded", () => {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");

  assert.ok(
    !/if \(e\.key\.toLowerCase\(\)/.test(source),
    "unguarded e.key.toLowerCase() throws when key is undefined"
  );
});

test("index.html loads keyboardShortcuts.js before script.js", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf-8");

  const moduleIndex = html.indexOf("scripts/keyboardShortcuts.js");
  const scriptIndex = html.indexOf('src="script.js"');

  assert.ok(moduleIndex !== -1, "index.html must load keyboardShortcuts.js");
  assert.ok(moduleIndex < scriptIndex, "it must load before script.js");
});

test("the shortcuts dialog marks its modifier key for localisation", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf-8");

  assert.match(
    html,
    /<kbd data-command-key>Ctrl<\/kbd>/,
    "the Ctrl hint must be tagged so macOS can be shown ⌘ instead"
  );
});

test("README still documents both Ctrl+K and Cmd+K", () => {
  const readme = fs.readFileSync(README_PATH, "utf-8");

  assert.match(readme, /Ctrl<\/kbd>\+<kbd>K/);
  assert.match(readme, /Cmd<\/kbd>\+<kbd>K/);
});
