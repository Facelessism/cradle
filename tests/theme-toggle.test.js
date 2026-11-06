const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(
  "src/components/ui/ThemeToggle/ThemeToggle.js",
  "utf8"
);

class MockClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.filter(Boolean).forEach(name => this.values.add(name));
  }

  remove(...names) {
    names.forEach(name => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }
}

class MockElement {
  constructor(tagName, document) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = document;
    this.classList = new MockClassList();
    this.attributes = new Map();
    this.dataset = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.style = {};
    this._innerHTML = "";
    this.textContent = "";
    this.type = "";
    this.id = "";
  }

  get className() {
    return [...this.classList.values].join(" ");
  }

  set className(value) {
    this.classList = new MockClassList();
    String(value)
      .split(/\s+/)
      .filter(Boolean)
      .forEach(name => this.classList.add(name));
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children = [];
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  querySelector(selector) {
    if (selector.startsWith(".")) {
      const className = selector.slice(1);
      return (
        this.walk().find(node => node.classList.contains(className)) || null
      );
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector === ".cradle-theme-toggle") {
      return this.walk().filter(node =>
        node.classList.contains("cradle-theme-toggle")
      );
    }
    if (selector === "[data-cradle-theme-toggle]") {
      return this.walk().filter(node =>
        Object.prototype.hasOwnProperty.call(node.dataset, "cradleThemeToggle")
      );
    }
    return [];
  }

  walk() {
    return [this, ...this.children.flatMap(child => child.walk())];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    if (name === "id" && this.id) return this.id;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  dispatchEvent(event) {
    event.target = this;
    for (const handler of this.listeners.get(event.type) || []) handler(event);
    return true;
  }

  removeChildren() {
    this.children = [];
  }
}

class MockDocument extends MockElement {
  constructor() {
    super("document", null);
    this.ownerDocument = this;
    this.head = new MockElement("head", this);
    this.documentElement = new MockElement("html", this);
    this.body = new MockElement("body", this);
    this.readyState = "complete";
    this.listeners = new Map();
    this.appendChild(this.head);
    this.appendChild(this.documentElement);
    this.appendChild(this.body);
  }

  createElement(tagName) {
    return new MockElement(tagName, this);
  }

  getElementById(id) {
    return this.walk().find(node => node.getAttribute("id") === id) || null;
  }

  querySelector(selector) {
    if (selector === "[data-cradle-theme-toggle]") {
      return this.querySelectorAll(selector)[0] || null;
    }
    return super.querySelector(selector);
  }

  querySelectorAll(selector) {
    if (selector === "[data-cradle-theme-toggle]") {
      return this.walk().filter(node =>
        Object.prototype.hasOwnProperty.call(node.dataset, "cradleThemeToggle")
      );
    }
    return super.querySelectorAll(selector);
  }
}

class MockStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

function loadThemeToggle({
  storedTheme = null,
  systemLight = false,
  storageApi = null,
  includeStorageApi = true,
  contrastMore = false,
  forcedColors = false,
} = {}) {
  const document = new MockDocument();
  const storage = new MockStorage(storedTheme ? { theme: storedTheme } : {});
  let systemMatches = systemLight;
  let contrastMatches = contrastMore;
  let forcedColorsMatches = forcedColors;
  const mediaListeners = new Map();

  const matchMedia = query => ({
    get matches() {
      if (query.includes("prefers-color-scheme: light")) return systemMatches;
      if (query.includes("prefers-color-scheme: dark")) return !systemMatches;
      if (query.includes("prefers-contrast: more")) return contrastMatches;
      if (query.includes("forced-colors: active")) return forcedColorsMatches;
      return false;
    },
    addEventListener(type, handler) {
      if (!mediaListeners.has(query)) mediaListeners.set(query, []);
      mediaListeners.get(query).push(handler);
    },
    addListener(handler) {
      if (!mediaListeners.has(query)) mediaListeners.set(query, []);
      mediaListeners.get(query).push(handler);
    },
  });

  class MockCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
      this.bubbles = Boolean(init.bubbles);
    }
  }

  const window = {
    document,
    localStorage: storage,
    ...(includeStorageApi
      ? {
          CradleStorage: storageApi || {
            getRaw: key => storage.getItem(key),
            setRaw: (key, value) => {
              storage.setItem(key, value);
              return true;
            },
          },
        }
      : {}),
    matchMedia,
    CustomEvent: MockCustomEvent,
    setTimeout,
    clearTimeout,
  };

  const context = vm.createContext({
    window,
    document,
    localStorage: storage,
    CustomEvent: MockCustomEvent,
    setTimeout,
    clearTimeout,
  });

  vm.runInContext(source, context, { filename: "ThemeToggle.js" });

  return {
    api: window.CradleThemeToggle,
    document,
    storage,
    changeSystemTheme(light) {
      systemMatches = light;
      const handlers = [
        ...(mediaListeners.get("(prefers-color-scheme: light)") || []),
        ...(mediaListeners.get("(prefers-color-scheme: dark)") || []),
      ];
      for (const handler of handlers) handler({ matches: light });
    },
    changeContrast(more) {
      contrastMatches = more;
      const handlers = mediaListeners.get("(prefers-contrast: more)") || [];
      for (const handler of handlers) handler({ matches: more });
    },
    changeForcedColors(active) {
      forcedColorsMatches = active;
      const handlers = mediaListeners.get("(forced-colors: active)") || [];
      for (const handler of handlers) handler({ matches: active });
    },
  };
}

test("ThemeToggle falls back safely when the shared storage helper is unavailable", () => {
  const { api, document } = loadThemeToggle({
    storedTheme: null,
    systemLight: true,
    storageApi: null,
    includeStorageApi: false,
  });

  // The component must remain usable even when persistence is unavailable.
  assert.equal(api.currentTheme(), "light");
  assert.equal(api.currentMode(), "system");
  assert.equal(
    document.documentElement.classList.contains("light-theme"),
    true
  );
  assert.doesNotThrow(() => api.toggleTheme());
  assert.equal(api.currentTheme(), "dark");
});

test("ThemeToggle initializes from a stored theme and applies the html class", () => {
  const { api, document } = loadThemeToggle({
    storedTheme: "light",
    systemLight: false,
  });

  assert.equal(api.currentTheme(), "light");
  assert.equal(api.currentMode(), "light");
  assert.equal(
    document.documentElement.classList.contains("light-theme"),
    true
  );
});

test("ThemeToggle falls back to the system preference when no theme is stored", () => {
  const { api, document, storage } = loadThemeToggle({ systemLight: true });

  assert.equal(api.currentTheme(), "light");
  assert.equal(api.currentMode(), "system");
  assert.equal(
    document.documentElement.classList.contains("light-theme"),
    true
  );
  assert.equal(storage.getItem("theme"), null);
});

test("ThemeToggle defaults to dark when the system prefers dark", () => {
  const { api, document } = loadThemeToggle({ systemLight: false });

  assert.equal(api.currentTheme(), "dark");
  assert.equal(api.currentMode(), "system");
  assert.equal(
    document.documentElement.classList.contains("light-theme"),
    false
  );
});

test("toggleTheme cycles through 3-way modes (dark -> light -> system -> dark) and persists them", () => {
  const { api, document, storage } = loadThemeToggle({ storedTheme: "dark" });

  // 1. dark -> light
  api.toggleTheme();
  assert.equal(api.currentTheme(), "light");
  assert.equal(api.currentMode(), "light");
  assert.equal(
    document.documentElement.classList.contains("light-theme"),
    true
  );
  assert.equal(storage.getItem("theme"), "light");

  // 2. light -> system
  api.toggleTheme();
  assert.equal(api.currentMode(), "system");
  assert.equal(storage.getItem("theme"), "system");

  // 3. system -> dark
  api.toggleTheme();
  assert.equal(api.currentTheme(), "dark");
  assert.equal(api.currentMode(), "dark");
  assert.equal(storage.getItem("theme"), "dark");
});

test("create returns an accessible switch with the requested size and icon", () => {
  const { api } = loadThemeToggle({ storedTheme: "dark" });
  const button = api.create({ size: "lg", className: "custom-toggle" });

  assert.equal(button.tagName, "BUTTON");
  assert.equal(button.type, "button");
  assert.equal(button.classList.contains("cradle-theme-toggle"), true);
  assert.equal(button.classList.contains("cradle-theme-toggle--lg"), true);
  assert.equal(button.classList.contains("custom-toggle"), true);
  assert.equal(button.getAttribute("role"), "switch");
  assert.equal(button.getAttribute("aria-checked"), "false");
  assert.equal(button.getAttribute("aria-label"), "Switch to light theme");
  assert.equal(button.getAttribute("data-theme-mode"), "dark");

  const icon = button.querySelector(".cradle-theme-toggle__icon");
  assert.equal(icon.textContent, "🌙");
  assert.equal(icon.getAttribute("aria-hidden"), "true");
});

test("clicking a created toggle changes theme and updates all instances", () => {
  const { api, document, storage } = loadThemeToggle({ storedTheme: "dark" });
  const first = api.create({ size: "sm" });
  const second = api.create({ size: "md" });
  document.body.appendChild(first);
  document.body.appendChild(second);

  first.dispatchEvent({ type: "click" });

  assert.equal(storage.getItem("theme"), "light");
  assert.equal(
    document.documentElement.classList.contains("light-theme"),
    true
  );
  assert.equal(first.getAttribute("aria-checked"), "true");
  assert.equal(second.getAttribute("aria-checked"), "true");
  assert.equal(first.getAttribute("aria-label"), "Switch to system theme");
  assert.equal(
    second.querySelector(".cradle-theme-toggle__icon").textContent,
    "☀️"
  );
});

test("themechange is dispatched with the new theme and mode in event.detail", () => {
  const { api, document } = loadThemeToggle({ storedTheme: "dark" });
  const events = [];
  document.documentElement.addEventListener("cradle:themechange", event =>
    events.push(event)
  );

  api.applyTheme("light");

  assert.equal(events.length, 1);
  assert.equal(events[0].detail.theme, "light");
  assert.equal(events[0].detail.mode, "light");
  assert.equal(events[0].bubbles, false);

  api.applyTheme("system");
  assert.equal(events.length, 2);
  assert.equal(events[1].detail.mode, "system");
});

test("OS preference changes are followed only when in system mode", () => {
  const automatic = loadThemeToggle({ systemLight: false });
  automatic.changeSystemTheme(true);
  assert.equal(automatic.api.currentTheme(), "light");

  const manual = loadThemeToggle({ storedTheme: "dark", systemLight: false });
  manual.changeSystemTheme(true);
  assert.equal(manual.api.currentTheme(), "dark");
  assert.equal(manual.storage.getItem("theme"), "dark");
});

test("upgradeAll auto-upgrades marked elements and is idempotent", () => {
  const { api, document } = loadThemeToggle({ storedTheme: "light" });
  const element = document.createElement("button");
  element.dataset.cradleThemeToggle = "";
  element.dataset.size = "sm";
  document.body.appendChild(element);

  api.upgradeAll();
  api.upgradeAll();

  assert.equal(element.dataset.cradleUpgraded, "true");
  assert.equal(element.classList.contains("cradle-theme-toggle"), true);
  assert.equal(element.classList.contains("cradle-theme-toggle--sm"), true);
  assert.equal(element.getAttribute("role"), "switch");
  assert.equal(element.getAttribute("aria-checked"), "true");
  assert.equal(element.type, "button");
  assert.equal(element.children.length, 1);
  assert.equal(
    element.querySelector(".cradle-theme-toggle__icon").textContent,
    "☀️"
  );
  assert.equal(
    document.getElementById("cradle-theme-toggle-styles") !== null,
    true
  );

  element.dispatchEvent({ type: "click" });
  assert.equal(api.currentMode(), "system");
  assert.equal(api.currentTheme(), "dark");
});

test("init resolves the stored theme and emits the themechange event", () => {
  const { api, document } = loadThemeToggle({
    storedTheme: "dark",
    systemLight: true,
  });
  const events = [];
  document.documentElement.addEventListener("cradle:themechange", event =>
    events.push(event)
  );

  api.init();

  assert.equal(api.currentTheme(), "dark");
  assert.equal(api.currentMode(), "dark");
  assert.equal(events.length, 1);
  assert.equal(events[0].detail.theme, "dark");
  assert.equal(events[0].detail.mode, "dark");
});

test("3-way toggle displays system icon and mixed aria-checked in system mode", () => {
  const { api, document } = loadThemeToggle({ storedTheme: "system" });
  const button = api.create({ size: "md" });
  document.body.appendChild(button);

  assert.equal(api.currentMode(), "system");
  assert.equal(button.getAttribute("aria-checked"), "mixed");
  assert.equal(button.getAttribute("data-theme-mode"), "system");
  assert.equal(
    button.querySelector(".cradle-theme-toggle__icon").textContent,
    "💻"
  );
  assert.equal(button.getAttribute("aria-label"), "Switch to dark theme");
});

test("setMode explicitly sets light, dark, and system modes", () => {
  const { api, document, storage } = loadThemeToggle({ storedTheme: "dark" });

  api.setMode("light");
  assert.equal(api.currentMode(), "light");
  assert.equal(storage.getItem("theme"), "light");
  assert.equal(
    document.documentElement.classList.contains("light-theme"),
    true
  );

  api.setMode("system");
  assert.equal(api.currentMode(), "system");
  assert.equal(storage.getItem("theme"), "system");

  api.setMode("dark");
  assert.equal(api.currentMode(), "dark");
  assert.equal(storage.getItem("theme"), "dark");
  assert.equal(
    document.documentElement.classList.contains("light-theme"),
    false
  );
});

test("automatic adaptation for prefers-contrast: more adds high-contrast class and emits event", () => {
  const contrastEvents = [];
  const { api, document, changeContrast } = loadThemeToggle({
    contrastMore: true,
  });
  document.documentElement.addEventListener("cradle:contrastchange", e =>
    contrastEvents.push(e)
  );

  assert.equal(api.isHighContrast(), true);
  assert.equal(
    document.documentElement.classList.contains("high-contrast"),
    true
  );

  // Simulate OS disabling high contrast
  changeContrast(false);
  assert.equal(api.isHighContrast(), false);
  assert.equal(
    document.documentElement.classList.contains("high-contrast"),
    false
  );
  assert.ok(contrastEvents.length >= 1);
});

test("automatic adaptation for forced-colors: active adds forced-colors and high-contrast classes", () => {
  const { api, document, changeForcedColors } = loadThemeToggle({
    forcedColors: true,
  });

  assert.equal(api.isForcedColors(), true);
  assert.equal(api.isHighContrast(), true);
  assert.equal(
    document.documentElement.classList.contains("forced-colors"),
    true
  );
  assert.equal(
    document.documentElement.classList.contains("high-contrast"),
    true
  );

  changeForcedColors(false);
  assert.equal(api.isForcedColors(), false);
  assert.equal(
    document.documentElement.classList.contains("forced-colors"),
    false
  );
});
