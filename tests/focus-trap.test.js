const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const SCRIPT_PATH = path.join(REPO_ROOT, "script.js");
const INDEX_PATH = path.join(REPO_ROOT, "index.html");
const STYLE_PATH = path.join(REPO_ROOT, "style.css");

const focusTrap = require(path.join(REPO_ROOT, "scripts", "focusTrap.js"));

/* ── Minimal fake DOM ────────────────────────────────────────────────── */

/**
 * A stand-in for a focusable element that records when it is focused.
 *
 * @param {string} name Identifier used in assertions.
 * @param {object} [attributes] Attribute map, plus `disabled` / `hidden`.
 * @returns {object} Fake element.
 */
function makeElement(name, attributes) {
  const attrs = attributes || {};

  return {
    name,
    disabled: Boolean(attrs.disabled),
    hidden: Boolean(attrs.hidden),
    focusCount: 0,
    getAttribute(key) {
      return Object.prototype.hasOwnProperty.call(attrs, key)
        ? attrs[key]
        : null;
    },
    focus() {
      this.focusCount += 1;
      if (this.ownerDocument) this.ownerDocument.activeElement = this;
    },
  };
}

/**
 * A fake document whose `activeElement` the trap reads and writes.
 *
 * @param {Array<object>} elements Elements the container should report.
 * @returns {object} `{ documentRef, container, elements }`.
 */
function makeScene(elements) {
  const documentRef = { activeElement: null };

  elements.forEach(element => {
    element.ownerDocument = documentRef;
  });

  const container = {
    name: "container",
    focusCount: 0,
    ownerDocument: documentRef,
    querySelectorAll() {
      return elements;
    },
    focus() {
      this.focusCount += 1;
      documentRef.activeElement = this;
    },
  };

  return { documentRef, container, elements };
}

/** Build a Tab keydown event that records preventDefault calls. */
function tabEvent(shiftKey) {
  return {
    key: "Tab",
    shiftKey: Boolean(shiftKey),
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

/* ── isFocusable ─────────────────────────────────────────────────────── */

test("isFocusable accepts an ordinary element", () => {
  assert.equal(focusTrap.isFocusable(makeElement("button")), true);
});

test("isFocusable rejects a disabled element", () => {
  assert.equal(
    focusTrap.isFocusable(makeElement("button", { disabled: true })),
    false
  );
});

test("isFocusable rejects a hidden element", () => {
  assert.equal(
    focusTrap.isFocusable(makeElement("button", { hidden: true })),
    false
  );
});

test("isFocusable rejects a negative tabindex", () => {
  assert.equal(
    focusTrap.isFocusable(makeElement("div", { tabindex: "-1" })),
    false
  );
});

test("isFocusable accepts a zero or positive tabindex", () => {
  assert.equal(
    focusTrap.isFocusable(makeElement("div", { tabindex: "0" })),
    true
  );
  assert.equal(
    focusTrap.isFocusable(makeElement("div", { tabindex: "2" })),
    true
  );
});

test("isFocusable rejects aria-hidden elements", () => {
  assert.equal(
    focusTrap.isFocusable(makeElement("button", { "aria-hidden": "true" })),
    false
  );
});

test("isFocusable rejects null and non-objects", () => {
  assert.equal(focusTrap.isFocusable(null), false);
  assert.equal(focusTrap.isFocusable(undefined), false);
  assert.equal(focusTrap.isFocusable("button"), false);
});

/* ── getFocusableElements ────────────────────────────────────────────── */

test("getFocusableElements filters out unfocusable candidates", () => {
  const { container } = makeScene([
    makeElement("a"),
    makeElement("b", { disabled: true }),
    makeElement("c", { tabindex: "-1" }),
    makeElement("d"),
  ]);

  const focusable = focusTrap.getFocusableElements(container);

  assert.deepEqual(
    focusable.map(element => element.name),
    ["a", "d"]
  );
});

test("getFocusableElements returns an empty array for a bad container", () => {
  assert.deepEqual(focusTrap.getFocusableElements(null), []);
  assert.deepEqual(focusTrap.getFocusableElements({}), []);
});

test("the focusable selector covers the usual interactive elements", () => {
  const selector = focusTrap.FOCUSABLE_SELECTOR;

  ["a[href]", "button", "input", "select", "textarea"].forEach(part => {
    assert.ok(selector.includes(part), `selector should include ${part}`);
  });
});

/* ── getNextFocusIndex ───────────────────────────────────────────────── */

test("Tab moves forward through the trap", () => {
  assert.equal(focusTrap.getNextFocusIndex(0, 3, false), 1);
  assert.equal(focusTrap.getNextFocusIndex(1, 3, false), 2);
});

test("Tab wraps from the last element back to the first", () => {
  /* This wrap is what stops Tab escaping into the page behind the overlay. */
  assert.equal(focusTrap.getNextFocusIndex(2, 3, false), 0);
});

test("Shift+Tab moves backward through the trap", () => {
  assert.equal(focusTrap.getNextFocusIndex(2, 3, true), 1);
  assert.equal(focusTrap.getNextFocusIndex(1, 3, true), 0);
});

test("Shift+Tab wraps from the first element to the last", () => {
  assert.equal(focusTrap.getNextFocusIndex(0, 3, true), 2);
});

test("focus outside the trap is pulled to the correct end", () => {
  assert.equal(focusTrap.getNextFocusIndex(-1, 3, false), 0);
  assert.equal(focusTrap.getNextFocusIndex(-1, 3, true), 2);
});

test("a single focusable element always stays focused", () => {
  assert.equal(focusTrap.getNextFocusIndex(0, 1, false), 0);
  assert.equal(focusTrap.getNextFocusIndex(0, 1, true), 0);
});

test("an empty trap reports no target", () => {
  assert.equal(focusTrap.getNextFocusIndex(0, 0, false), -1);
  assert.equal(focusTrap.getNextFocusIndex(-1, 0, true), -1);
});

/* ── createFocusTrap ─────────────────────────────────────────────────── */

test("activate moves focus into the dialog", () => {
  const first = makeElement("close");
  const second = makeElement("link");
  const { container, documentRef } = makeScene([first, second]);

  const trap = focusTrap.createFocusTrap(container, { documentRef });
  trap.activate();

  assert.equal(first.focusCount, 1);
  assert.equal(documentRef.activeElement, first);
});

test("activate honours an explicit initialFocus", () => {
  const first = makeElement("first");
  const preferred = makeElement("preferred");
  const { container, documentRef } = makeScene([first, preferred]);

  const trap = focusTrap.createFocusTrap(container, {
    documentRef,
    initialFocus: preferred,
  });
  trap.activate();

  assert.equal(preferred.focusCount, 1);
  assert.equal(first.focusCount, 0);
});

test("deactivate restores focus to whatever opened the dialog", () => {
  const trigger = makeElement("shortcuts-btn");
  const inside = makeElement("close");
  const { container, documentRef } = makeScene([inside]);

  trigger.ownerDocument = documentRef;
  documentRef.activeElement = trigger;

  const trap = focusTrap.createFocusTrap(container, { documentRef });

  trap.activate();
  assert.equal(documentRef.activeElement, inside);

  trap.deactivate();

  /*
   * Without this the user is dumped at the top of the document and has to
   * tab all the way back to the button they pressed.
   */
  assert.equal(documentRef.activeElement, trigger);
  assert.equal(trigger.focusCount, 1);
});

test("Tab is ignored while the trap is inactive", () => {
  const { container, documentRef } = makeScene([makeElement("close")]);
  const trap = focusTrap.createFocusTrap(container, { documentRef });

  const event = tabEvent(false);

  assert.equal(trap.handleKeydown(event), false);
  assert.equal(event.defaultPrevented, false);
});

test("Tab cycles focus while the trap is active", () => {
  const first = makeElement("first");
  const second = makeElement("second");
  const { container, documentRef } = makeScene([first, second]);

  const trap = focusTrap.createFocusTrap(container, { documentRef });
  trap.activate();

  const forward = tabEvent(false);
  assert.equal(trap.handleKeydown(forward), true);
  assert.equal(forward.defaultPrevented, true);
  assert.equal(documentRef.activeElement, second);

  /* Tab from the last element wraps rather than leaving the dialog. */
  const wrap = tabEvent(false);
  trap.handleKeydown(wrap);
  assert.equal(documentRef.activeElement, first);
});

test("Shift+Tab cycles backwards while the trap is active", () => {
  const first = makeElement("first");
  const second = makeElement("second");
  const { container, documentRef } = makeScene([first, second]);

  const trap = focusTrap.createFocusTrap(container, { documentRef });
  trap.activate();

  const back = tabEvent(true);
  trap.handleKeydown(back);

  assert.equal(documentRef.activeElement, second);
});

test("non-Tab keys pass straight through the trap", () => {
  const { container, documentRef } = makeScene([makeElement("close")]);
  const trap = focusTrap.createFocusTrap(container, { documentRef });
  trap.activate();

  const escape = { key: "Escape", preventDefault() {} };

  assert.equal(trap.handleKeydown(escape), false);
});

test("Tab keeps focus on the dialog when nothing inside is focusable", () => {
  const { container, documentRef } = makeScene([]);
  const trap = focusTrap.createFocusTrap(container, { documentRef });
  trap.activate();

  const event = tabEvent(false);

  assert.equal(trap.handleKeydown(event), true);
  assert.equal(event.defaultPrevented, true);
  assert.equal(documentRef.activeElement, container);
});

test("activate is idempotent and does not lose the original trigger", () => {
  const trigger = makeElement("trigger");
  const inside = makeElement("inside");
  const { container, documentRef } = makeScene([inside]);

  trigger.ownerDocument = documentRef;
  documentRef.activeElement = trigger;

  const trap = focusTrap.createFocusTrap(container, { documentRef });

  trap.activate();
  trap.activate();
  trap.deactivate();

  assert.equal(documentRef.activeElement, trigger);
});

test("deactivate on an inactive trap does nothing", () => {
  const trigger = makeElement("trigger");
  const { container, documentRef } = makeScene([makeElement("inside")]);

  documentRef.activeElement = trigger;

  const trap = focusTrap.createFocusTrap(container, { documentRef });
  trap.deactivate();

  assert.equal(trigger.focusCount, 0);
});

/* ── Wiring guards ───────────────────────────────────────────────────── */

test("script.js activates and deactivates the trap with the dialog", () => {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");

  assert.match(source, /CradleFocusTrap/);
  assert.match(source, /shortcutsFocusTrap\.activate\(\)/);
  assert.match(source, /shortcutsFocusTrap\.deactivate\(\)/);
});

test("script.js toggles aria-modal with the dialog", () => {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");

  assert.match(source, /setAttribute\("aria-modal", "true"\)/);
  assert.match(source, /setAttribute\("aria-modal", "false"\)/);
});

test("script.js locks background scrolling while the dialog is open", () => {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");

  assert.match(source, /classList\.add\(MODAL_OPEN_CLASS\)/);
  assert.match(source, /classList\.remove\(MODAL_OPEN_CLASS\)/);
});

test("script.js handles Tab in the capture phase", () => {
  const source = fs.readFileSync(SCRIPT_PATH, "utf-8");

  assert.match(
    source,
    /shortcutsFocusTrap\.handleKeydown\(event\)/,
    "the trap must see Tab before other listeners"
  );
});

test("index.html loads focusTrap.js before script.js", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf-8");

  const trapIndex = html.indexOf("scripts/focusTrap.js");
  const scriptIndex = html.indexOf('src="script.js"');

  assert.ok(trapIndex !== -1, "index.html must load scripts/focusTrap.js");
  assert.ok(trapIndex < scriptIndex, "it must load before script.js");
});

test("the dialog content is programmatically focusable", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf-8");

  assert.match(
    html,
    /class="shortcuts-modal-content" tabindex="-1"/,
    "focus cannot be moved into the dialog without a tabindex"
  );
});

test("the dialog declares aria-modal in its markup", () => {
  const html = fs.readFileSync(INDEX_PATH, "utf-8");

  assert.match(html, /aria-modal="false"/);
});

test("style.css defines the background scroll lock", () => {
  const css = fs.readFileSync(STYLE_PATH, "utf-8");

  assert.match(css, /body\.modal-open\s*\{[^}]*overflow:\s*hidden/);
});

test("style.css keeps a visible focus ring inside the dialog", () => {
  const css = fs.readFileSync(STYLE_PATH, "utf-8");

  assert.match(css, /\.shortcuts-modal-content:focus-visible/);
});
