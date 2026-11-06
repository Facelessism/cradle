const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(
  "src/components/ui/BackToHome/BackToHome.js",
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
    this._innerHTML = "";
    this.textContent = "";
    this.type = "";
    this.id = "";
    this.href = "";
    this.title = "";
    this.isContentEditable = false;
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

  insertBefore(newNode, referenceNode) {
    newNode.parentNode = this;
    const index = this.children.indexOf(referenceNode);
    if (index === -1) {
      this.children.push(newNode);
    } else {
      this.children.splice(index, 0, newNode);
    }
    return newNode;
  }

  replaceWith(node) {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index !== -1) {
      node.parentNode = this.parentNode;
      this.parentNode.children[index] = node;
      this.parentNode = null;
    }
  }

  walk() {
    return [this, ...this.children.flatMap(child => child.walk())];
  }

  querySelector(selector) {
    if (selector.startsWith(".")) {
      const className = selector.slice(1);
      return (
        this.walk().find(node => node.classList.contains(className)) || null
      );
    }
    const lower = selector.toLowerCase();
    if (["a", "nav", "ol", "li", "span", "kbd"].includes(lower)) {
      return (
        this.walk().find(node => node.tagName.toLowerCase() === lower) || null
      );
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector.startsWith(".")) {
      const className = selector.slice(1);
      return this.walk().filter(node => node.classList.contains(className));
    }
    const lower = selector.toLowerCase();
    if (["a", "nav", "ol", "li", "span", "kbd"].includes(lower)) {
      return this.walk().filter(node => node.tagName.toLowerCase() === lower);
    }
    if (selector === ".cradle-back-home") {
      return this.walk().filter(node =>
        node.classList.contains("cradle-back-home")
      );
    }
    if (selector === "[data-cradle-back-to-home]") {
      return this.walk().filter(node =>
        Object.prototype.hasOwnProperty.call(node.dataset, "cradleBackToHome")
      );
    }
    if (selector === "[data-cradle-breadcrumb]") {
      return this.walk().filter(node =>
        Object.prototype.hasOwnProperty.call(node.dataset, "cradleBreadcrumb")
      );
    }
    return [];
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
}

class MockDocument extends MockElement {
  constructor({
    pathname = "/cradle/projects/demo/index.html",
    search = "",
    title = "",
    referrer = "",
    scriptSrc,
  } = {}) {
    super("document", null);
    this.ownerDocument = this;
    this.head = new MockElement("head", this);
    this.documentElement = new MockElement("html", this);
    this.body = new MockElement("body", this);
    this.readyState = "loading";
    this.currentScript = scriptSrc ? { src: scriptSrc } : null;
    this.location = { pathname, search };
    this.title = title;
    this.referrer = referrer;
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

  querySelectorAll(selector) {
    if (selector === "[data-cradle-back-to-home]") {
      return this.walk().filter(node =>
        Object.prototype.hasOwnProperty.call(node.dataset, "cradleBackToHome")
      );
    }
    if (selector === "[data-cradle-breadcrumb]") {
      return this.walk().filter(node =>
        Object.prototype.hasOwnProperty.call(node.dataset, "cradleBreadcrumb")
      );
    }
    return super.querySelectorAll(selector);
  }
}

function loadBackToHome(options = {}) {
  const document = new MockDocument(options);
  const listeners = new Map();
  const window = {
    document,
    location: document.location,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    removeEventListener(type, handler) {
      if (!listeners.has(type)) return;
      listeners.set(type, listeners.get(type).filter(h => h !== handler));
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) {
        handler(event);
      }
      return true;
    },
  };

  const context = vm.createContext({
    window,
    document,
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
  });

  vm.runInContext(source, context, { filename: "BackToHome.js" });

  return { api: window.CradleBackToHome, document, window };
}

test("create() computes a base-path-safe home URL from the component script", () => {
  const { api } = loadBackToHome({
    scriptSrc:
      "https://example.com/cradle/src/components/ui/BackToHome/BackToHome.js",
  });

  const link = api.create();

  assert.equal(link.href, "https://example.com/cradle/index.html");
  assert.equal(link.title, "Back to Home");
  assert.equal(link.getAttribute("aria-label"), "Back to Home");
});

test("create() uses the fallback path calculation when script URL is unavailable", () => {
  const { api } = loadBackToHome({
    pathname: "/cradle/projects/tools/example/index.html",
  });

  const link = api.create();

  assert.equal(link.href, "../../../../index.html");
});

test("create() renders the default pill variant and arrow icon", () => {
  const { api } = loadBackToHome();
  const link = api.create();

  assert.equal(link.tagName, "A");
  assert.ok(link.classList.contains("cradle-back-home"));
  assert.ok(!link.classList.contains("cradle-back-home--minimal"));
  assert.equal(link.children.length, 2);
  assert.equal(link.children[0].className, "cradle-back-home__icon");
  assert.match(link.children[0].innerHTML, /<svg/);
  assert.equal(link.children[1].textContent, "Back to Home");
});

test("create() supports the minimal variant", () => {
  const { api } = loadBackToHome();
  const link = api.create({ variant: "minimal", label: "Return" });

  assert.ok(link.classList.contains("cradle-back-home"));
  assert.ok(link.classList.contains("cradle-back-home--minimal"));
  assert.equal(link.getAttribute("aria-label"), "Return");
  assert.equal(link.title, "Return");
  assert.equal(link.children[1].textContent, "Return");
});

test("create() honors a custom destination, label, icon, and class", () => {
  const { api } = loadBackToHome();
  const link = api.create({
    to: "/dashboard",
    label: "Dashboard",
    icon: "<span>←</span>",
    className: "custom-back-link",
  });

  assert.equal(link.href, "/dashboard");
  assert.equal(link.getAttribute("aria-label"), "Dashboard");
  assert.ok(link.classList.contains("custom-back-link"));
  assert.equal(link.children[0].innerHTML, "<span>←</span>");
  assert.equal(link.children[1].textContent, "Dashboard");
});

test("create() injects component styles only once", () => {
  const { api, document } = loadBackToHome();

  api.create();
  api.create();

  const styles = document
    .walk()
    .filter(
      node =>
        node.tagName === "STYLE" &&
        node.getAttribute("id") === "cradle-back-home-styles"
    );
  assert.equal(styles.length, 1);
});

test("upgradeAll() replaces data-attribute anchors with rendered buttons", () => {
  const { api, document } = loadBackToHome();
  const placeholder = document.createElement("a");
  placeholder.dataset.cradleBackToHome = "";
  placeholder.dataset.to = "/home";
  placeholder.dataset.label = "Go home";
  placeholder.dataset.variant = "minimal";
  document.body.appendChild(placeholder);

  api.upgradeAll();

  const upgraded = document.body.children[0];
  assert.equal(upgraded.tagName, "A");
  assert.equal(upgraded.href, "/home");
  assert.equal(upgraded.getAttribute("aria-label"), "Go home");
  assert.ok(upgraded.classList.contains("cradle-back-home--minimal"));
});

test("upgradeAll() is idempotent", () => {
  const { api, document } = loadBackToHome();
  const first = document.createElement("a");
  first.dataset.cradleBackToHome = "";
  document.body.appendChild(first);

  api.upgradeAll();
  const upgraded = document.body.children[0];
  api.upgradeAll();

  assert.equal(document.body.children.length, 1);
  assert.equal(document.body.children[0], upgraded);
});

test("autoInject() skips the homepage", () => {
  const { api, document } = loadBackToHome({
    pathname: "/cradle/index.html",
  });

  api.autoInject();

  assert.equal(document.body.children.length, 0);
});

test("autoInject() mounts a pill link on non-home pages", () => {
  const { api, document } = loadBackToHome({
    pathname: "/cradle/projects/tools/example/index.html",
    scriptSrc:
      "https://example.com/cradle/src/components/ui/BackToHome/BackToHome.js",
  });

  api.autoInject({ label: "Home" });

  assert.equal(document.body.children.length, 1);
  assert.equal(document.body.children[0].getAttribute("aria-label"), "Home");
  assert.ok(document.body.children[0].classList.contains("cradle-back-home"));
});

test("rendered links are keyboard-navigable with button role", () => {
  const { api } = loadBackToHome();
  const link = api.create({ to: "/" });

  assert.equal(link.tagName, "A");
  assert.equal(link.href, "/");
  assert.equal(link.getAttribute("aria-label"), "Back to Home");
  assert.equal(link.getAttribute("role"), "button");
});

test("create() assigns aria-keyshortcuts='Alt+H' to the button", () => {
  const { api } = loadBackToHome();
  const link = api.create();

  assert.equal(link.getAttribute("aria-keyshortcuts"), "Alt+H");
});

test("create() renders shortcut badge when showShortcutBadge is true", () => {
  const { api } = loadBackToHome();
  const link = api.create({ showShortcutBadge: true });

  assert.equal(link.children.length, 3);
  const badge = link.children[2];
  assert.equal(badge.tagName, "KBD");
  assert.equal(badge.className, "cradle-back-home__kbd");
  assert.equal(badge.textContent, "Alt+H");
  assert.equal(badge.getAttribute("aria-hidden"), "true");
});

test("create() preserves category in URL when retainCategory is true", () => {
  const { api } = loadBackToHome({
    pathname: "/projects/dev-tools/regex-visualizer/index.html",
  });
  const link = api.create({ retainCategory: true });

  assert.equal(link.href, "../../../index.html?category=dev-tools");
});

test("parsePathContext() extracts category and project slug from standard project paths", () => {
  const { api } = loadBackToHome();

  const ctx1 = api.parsePathContext(
    "/cradle/projects/dev-tools/regex-visualizer/index.html"
  );
  assert.equal(ctx1.category, "dev-tools");
  assert.equal(ctx1.projectSlug, "regex-visualizer");

  const ctx2 = api.parsePathContext("/projects/aiml/ai-circuit-builder/");
  assert.equal(ctx2.category, "aiml");
  assert.equal(ctx2.projectSlug, "ai-circuit-builder");

  const ctx3 = api.parsePathContext("/projects/games/chess/index.html");
  assert.equal(ctx3.category, "games");
  assert.equal(ctx3.projectSlug, "chess");
});

test("parsePathContext() handles root and non-project paths gracefully", () => {
  const { api } = loadBackToHome();

  const rootCtx = api.parsePathContext("/index.html");
  assert.equal(rootCtx.category, "");
  assert.equal(rootCtx.projectSlug, "");

  const emptyCtx = api.parsePathContext("");
  assert.equal(emptyCtx.category, "");
  assert.equal(emptyCtx.projectSlug, "");
});

test("formatCategoryLabel() transforms category slugs into user-friendly titles", () => {
  const { api } = loadBackToHome();

  assert.equal(api.formatCategoryLabel("aiml"), "AI / ML");
  assert.equal(api.formatCategoryLabel("dev-tools"), "Dev Tools");
  assert.equal(api.formatCategoryLabel("file-tools"), "File Tools");
  assert.equal(api.formatCategoryLabel("math"), "Math");
  assert.equal(api.formatCategoryLabel("games"), "Games");
  assert.equal(api.formatCategoryLabel("audio-analysis"), "Audio Analysis");
  assert.equal(api.formatCategoryLabel(""), "");
});

test("getActiveCategory() resolves category from options, query parameters, referrer, or pathname", () => {
  const { api } = loadBackToHome({
    pathname: "/projects/games/2048-game/index.html",
    search: "?category=math",
    referrer: "https://example.com/cradle/index.html?category=dev-tools",
  });

  // Explicit option takes precedence
  assert.equal(api.getActiveCategory({ category: "aiml" }), "aiml");

  // Query parameter takes precedence over referrer and path
  assert.equal(api.getActiveCategory(), "math");

  // Path resolution when search is empty
  const { api: apiPathOnly } = loadBackToHome({
    pathname: "/projects/games/2048-game/index.html",
  });
  assert.equal(apiPathOnly.getActiveCategory(), "games");
});

test("getProjectTitle() resolves title from options, document.title, or pathname", () => {
  const { api } = loadBackToHome({
    pathname: "/projects/dev-tools/regex-visualizer/index.html",
    title: "Regex Visualizer | Cradle",
  });

  // Explicit option
  assert.equal(
    api.getProjectTitle({ projectTitle: "Custom Title" }),
    "Custom Title"
  );

  // Cleaned document.title
  assert.equal(api.getProjectTitle(), "Regex Visualizer");

  // Fallback to path slug when title is empty
  const { api: apiFallback } = loadBackToHome({
    pathname: "/projects/dev-tools/regex-visualizer/index.html",
    title: "",
  });
  assert.equal(apiFallback.getProjectTitle(), "Regex Visualizer");
});

test("createBreadcrumb() builds a complete WAI-ARIA breadcrumb hierarchy", () => {
  const { api } = loadBackToHome({
    pathname: "/projects/dev-tools/regex-visualizer/index.html",
    title: "Regex Visualizer — Cradle",
  });

  const breadcrumb = api.createBreadcrumb();

  assert.equal(breadcrumb.tagName, "NAV");
  assert.equal(breadcrumb.getAttribute("aria-label"), "Breadcrumb");
  assert.ok(breadcrumb.classList.contains("cradle-breadcrumb"));

  const list = breadcrumb.querySelector(".cradle-breadcrumb__list");
  assert.ok(list);
  assert.equal(list.tagName, "OL");

  const items = list.children;
  // Item 1: Home link (index 0)
  assert.equal(items[0].className, "cradle-breadcrumb__item");
  const homeLink = items[0].children[0];
  assert.equal(homeLink.tagName, "A");
  assert.equal(homeLink.textContent, "Home");
  assert.equal(homeLink.getAttribute("aria-keyshortcuts"), "Alt+H");
  assert.equal(homeLink.href, "../../../index.html");

  // Separator 1 (index 1)
  assert.equal(items[1].className, "cradle-breadcrumb__separator");
  assert.equal(items[1].getAttribute("aria-hidden"), "true");

  // Item 2: Category link (index 2)
  assert.equal(items[2].className, "cradle-breadcrumb__item");
  const catLink = items[2].children[0];
  assert.equal(catLink.tagName, "A");
  assert.equal(catLink.textContent, "Dev Tools");
  assert.equal(catLink.href, "../../../index.html?category=dev-tools");

  // Separator 2 (index 3)
  assert.equal(items[3].className, "cradle-breadcrumb__separator");
  assert.equal(items[3].getAttribute("aria-hidden"), "true");

  // Item 3: Current project (index 4)
  assert.ok(items[4].classList.contains("cradle-breadcrumb__item--current"));
  assert.equal(items[4].getAttribute("aria-current"), "page");
  const currentSpan = items[4].children[0];
  assert.equal(currentSpan.className, "cradle-breadcrumb__current");
  assert.equal(currentSpan.textContent, "Regex Visualizer");
});

test("create() returns breadcrumb component when variant is 'breadcrumb'", () => {
  const { api } = loadBackToHome({
    pathname: "/projects/games/chess/index.html",
    title: "Chess — Cradle",
  });

  const el = api.create({ variant: "breadcrumb" });

  assert.equal(el.tagName, "NAV");
  assert.equal(el.getAttribute("aria-label"), "Breadcrumb");
  assert.ok(el.classList.contains("cradle-breadcrumb"));
});

test("upgradeAll() upgrades [data-cradle-breadcrumb] elements", () => {
  const { api, document } = loadBackToHome({
    pathname: "/projects/math/graphing-calculator/index.html",
    title: "Graphing Calculator",
  });

  const placeholder = document.createElement("nav");
  placeholder.dataset.cradleBreadcrumb = "";
  placeholder.dataset.category = "math";
  placeholder.dataset.projectTitle = "Graphing Calculator";
  document.body.appendChild(placeholder);

  api.upgradeAll();

  const upgraded = document.body.children[0];
  assert.equal(upgraded.tagName, "NAV");
  assert.equal(upgraded.getAttribute("aria-label"), "Breadcrumb");
  assert.ok(upgraded.classList.contains("cradle-breadcrumb"));
  assert.ok(upgraded.querySelector(".cradle-breadcrumb__list"));
});

test("global Alt+H shortcut triggers navigation callback", () => {
  let navigatedTo = null;
  const { api, window } = loadBackToHome({
    pathname: "/projects/dev-tools/regex-visualizer/index.html",
  });

  api.registerGlobalShortcut("/target-home.html", {
    onNavigate: target => {
      navigatedTo = target;
    },
  });

  // Dispatch Alt+H event on window
  const event = {
    type: "keydown",
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    key: "h",
    code: "KeyH",
    target: window.document.body,
    preventDefault() {},
  };
  window.dispatchEvent(event);

  assert.equal(navigatedTo, "/target-home.html");
});

test("global Alt+H shortcut is ignored when target is an editable input", () => {
  let navigatedTo = null;
  const { api, window, document } = loadBackToHome({
    pathname: "/projects/dev-tools/regex-visualizer/index.html",
  });

  api.registerGlobalShortcut("/target-home.html", {
    onNavigate: target => {
      navigatedTo = target;
    },
  });

  const input = document.createElement("input");
  const event = {
    type: "keydown",
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    key: "h",
    code: "KeyH",
    target: input,
    preventDefault() {},
  };
  window.dispatchEvent(event);

  assert.equal(navigatedTo, null);
});

test("unregisterGlobalShortcut() cleanly removes keyboard listener", () => {
  let count = 0;
  const { api, window } = loadBackToHome({
    pathname: "/projects/dev-tools/regex-visualizer/index.html",
  });

  api.registerGlobalShortcut("/target-home.html", {
    onNavigate: () => {
      count++;
    },
  });

  api.unregisterGlobalShortcut();

  const event = {
    type: "keydown",
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    key: "h",
    code: "KeyH",
    target: window.document.body,
    preventDefault() {},
  };
  window.dispatchEvent(event);

  assert.equal(count, 0);
});
