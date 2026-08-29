const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const NAVBAR_SOURCE = fs.readFileSync(
  path.join(__dirname, "../src/components/ui/Navbar/Navbar.js"),
  "utf8"
);

function createElementFactory() {
  const elements = [];
  
  function createElement(tagName = "div") {
    const attributes = new Map();
    const children = [];
    const elementListeners = new Map();

    const element = {
      tagName: String(tagName).toUpperCase(),
      nodeType: 1,
      id: "",
      className: "",
      innerHTML: "",
      textContent: "",
      type: "",
      href: "",
      src: "",
      alt: "",
      dataset: {},
      childNodes: children,
      children,
      style: {},
      classList: {
        add(...names) {
          const current = element.className.split(/\s+/).filter(Boolean);
          for (const name of names) {
            if (name && !current.includes(name)) current.push(name);
          }
          element.className = current.join(" ");
        },
        remove(...names) {
          const current = element.className.split(/\s+/).filter(Boolean);
          element.className = current.filter(n => !names.includes(n)).join(" ");
        },
        contains(name) {
          return element.className.split(/\s+/).includes(name);
        },
      },
      setAttribute(name, value) {
        attributes.set(name, String(value));
      },
      getAttribute(name) {
        return attributes.has(name) ? attributes.get(name) : null;
      },
      hasAttribute(name) {
        return attributes.has(name);
      },
      appendChild(child) {
        children.push(child);
        return child;
      },
      insertAdjacentElement(position, child) {
        // mock
      },
      replaceWith(child) {
        // mock
      },
      addEventListener(type, handler) {
        if (!elementListeners.has(type)) elementListeners.set(type, []);
        elementListeners.get(type).push(handler);
      },
      dispatchEvent(event) {
        for (const handler of elementListeners.get(event.type) || []) {
          handler.call(element, event);
        }
        return true;
      },
      querySelector(selector) {
        if (selector === ".cradle-navbar__drawer-link") {
          return children.find(c => c.className && c.className.includes("cradle-navbar__drawer-link"));
        }
        return null;
      },
      contains(node) {
        return children.includes(node) || element === node;
      },
      focus() {},
      _listeners: elementListeners,
    };

    elements.push(element);
    return element;
  }

  return { elements, createElement };
}

function loadNavbar(autoUpgradeElements = []) {
  const factory = createElementFactory();
  const head = factory.createElement("head");
  const document = {
    readyState: "loading",
    head,
    createElement: factory.createElement,
    getElementById(id) {
      return factory.elements.find(element => element.id === id) || null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-cradle-navbar]") return autoUpgradeElements;
      return [];
    },
    addEventListener(type, handler) {
      if (type === "DOMContentLoaded") this._domReady = handler;
      if (type === "keydown") this._keydown = handler;
      if (type === "click") this._click = handler;
    },
    _domReady: null,
  };

  const window = {
    document,
    location: { pathname: "/" }
  };
  
  const context = {
    window,
    document,
    console,
  };

  vm.runInNewContext(NAVBAR_SOURCE, context, {
    filename: "Navbar.js",
  });

  return { navbar: window.CradleNavbar, document, factory };
}

test("CradleNavbar.create creates navbar with logo and basic structure", () => {
  const { navbar } = loadNavbar();
  const element = navbar.create({
    logo: { text: "TestLogo", href: "/home" },
  });

  assert.equal(element.tagName, "NAV");
  assert.ok(element.classList.contains("cradle-navbar"));
  assert.equal(element.getAttribute("role"), "navigation");
  assert.equal(element.getAttribute("aria-label"), "Main navigation");

  const brand = element.children[0];
  assert.ok(brand.classList.contains("cradle-navbar__brand"));
  assert.equal(brand.href, "/home");
  assert.equal(brand.getAttribute("aria-label"), "TestLogo");
  
  const logoText = brand.children[0];
  assert.equal(logoText.textContent, "TestLogo");
});

test("CradleNavbar.create creates navigation links with active state", () => {
  const { navbar } = loadNavbar();
  const element = navbar.create({
    links: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
    ],
    currentRoute: "/about",
  });

  const ul = element.children[1];
  assert.ok(ul.classList.contains("cradle-navbar__links"));
  assert.equal(ul.getAttribute("role"), "list");
  
  const li1 = ul.children[0];
  const a1 = li1.children[0];
  assert.equal(a1.textContent, "Home");
  assert.equal(a1.href, "/");
  assert.equal(a1.classList.contains("cradle-navbar__link--active"), false);
  
  const li2 = ul.children[1];
  const a2 = li2.children[0];
  assert.equal(a2.textContent, "About");
  assert.equal(a2.href, "/about");
  assert.ok(a2.classList.contains("cradle-navbar__link--active"));
  assert.equal(a2.getAttribute("aria-current"), "page");
});

test("CradleNavbar.create includes hamburger menu for responsive behavior", () => {
  const { navbar } = loadNavbar();
  const element = navbar.create({});
  
  const actionsSlot = element.children[1];
  assert.ok(actionsSlot.classList.contains("cradle-navbar__actions"));
  
  const burger = actionsSlot.children[0];
  assert.equal(burger.tagName, "BUTTON");
  assert.ok(burger.classList.contains("cradle-navbar__hamburger"));
  assert.equal(burger.getAttribute("aria-expanded"), "false");
  assert.equal(burger.getAttribute("aria-controls"), "cradle-navbar-drawer");
});

test("CradleNavbar.create generates mobile drawer with accessible links", () => {
  const { navbar } = loadNavbar();
  const element = navbar.create({
    links: [{ label: "Contact", href: "/contact" }],
    currentRoute: "/contact"
  });
  
  const drawer = element._drawer;
  assert.ok(drawer.classList.contains("cradle-navbar__drawer"));
  assert.equal(drawer.getAttribute("role"), "menu");
  assert.equal(drawer.getAttribute("aria-hidden"), "true");
  
  const link = drawer.children[0];
  assert.equal(link.textContent, "Contact");
  assert.equal(link.getAttribute("role"), "menuitem");
  assert.equal(link.getAttribute("aria-current"), "page");
  assert.ok(link.classList.contains("cradle-navbar__drawer-link--active"));
});
