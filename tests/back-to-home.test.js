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
    return null;
  }

  querySelectorAll(selector) {
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
  constructor({ pathname = "/cradle/projects/demo/index.html", scriptSrc } = {}) {
    super("document", null);
    this.ownerDocument = this;
    this.head = new MockElement("head", this);
    this.documentElement = new MockElement("html", this);
    this.body = new MockElement("body", this);
    this.readyState = "loading";
    this.currentScript = scriptSrc ? { src: scriptSrc } : null;
    this.location = { pathname };
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
    return super.querySelectorAll(selector);
  }
}

function loadBackToHome(options = {}) {
  const document = new MockDocument(options);
  const window = {
    document,
    location: document.location,
  };

  const context = vm.createContext({
    window,
    document,
    setTimeout,
    clearTimeout,
  });

  vm.runInContext(source, context, { filename: "BackToHome.js" });

  return { api: window.CradleBackToHome, document };
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

  const styles = document.walk().filter(node =>
    node.tagName === "STYLE" && node.getAttribute("id") === "cradle-back-home-styles"
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
