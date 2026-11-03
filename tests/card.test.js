const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CARD_SOURCE = fs.readFileSync(
  path.join(__dirname, "../src/components/ui/Card/Card.js"),
  "utf8"
);

class MockElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName).toUpperCase();
    this.nodeType = 1;
    this.id = "";
    this.className = "";
    this.innerHTML = "";
    this.textContent = "";
    this.src = "";
    this.alt = "";
    this.loading = "";
    this.href = "";
    this.dataset = {};
    this.childNodes = [];
    this.children = this.childNodes;
    this._attributes = new Map();
    this._listeners = new Map();
    this.classList = {
      add: (...names) => {
        const current = this.className.split(/\s+/).filter(Boolean);
        for (const name of names) {
          if (name && !current.includes(name)) current.push(name);
        }
        this.className = current.join(" ");
      },
      contains: name => this.className.split(/\s+/).includes(name),
    };
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  setAttribute(name, value) {
    this._attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this._attributes.has(name) ? this._attributes.get(name) : null;
  }

  appendChild(child) {
    if (child && child._parent) {
      const oldIndex = child._parent.childNodes.indexOf(child);
      if (oldIndex !== -1) child._parent.childNodes.splice(oldIndex, 1);
    }
    child._parent = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore(child, before) {
    if (child && child._parent) {
      const oldIndex = child._parent.childNodes.indexOf(child);
      if (oldIndex !== -1) child._parent.childNodes.splice(oldIndex, 1);
    }
    child._parent = this;
    const index = this.childNodes.indexOf(before);
    if (index === -1) this.childNodes.unshift(child);
    else this.childNodes.splice(index, 0, child);
    return child;
  }

  replaceWith(next) {
    if (!this._parent) return;
    const index = this._parent.childNodes.indexOf(this);
    if (index !== -1) this._parent.childNodes[index] = next;
    next._parent = this._parent;
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(handler);
  }

  dispatchEvent(event) {
    for (const handler of this._listeners.get(event.type) || []) {
      handler.call(this, event);
    }
    return true;
  }

  querySelector(selector) {
    const classNames = selector
      .split(",")
      .map(part => part.trim())
      .filter(part => part.startsWith("."))
      .map(part => part.slice(1));
    return (
      this.childNodes.find(
        child =>
          child instanceof MockElement &&
          classNames.some(className => child.classList.contains(className))
      ) || null
    );
  }
}

function createDom() {
  const elements = [];
  const createElement = tagName => {
    const element = new MockElement(tagName);
    elements.push(element);
    return element;
  };

  const createTextNode = text => ({
    nodeType: 3,
    textContent: String(text),
    _parent: null,
  });

  const head = createElement("head");
  const document = {
    readyState: "loading",
    head,
    createElement,
    createTextNode,
    getElementById(id) {
      return elements.find(element => element.id === id) || null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(type, handler) {
      if (type === "DOMContentLoaded") this._domReady = handler;
    },
    _domReady: null,
  };

  return { document, elements, createElement, createTextNode };
}

function attach(parent, child) {
  child._parent = parent;
  parent.appendChild(child);
  return child;
}

function loadCard(autoUpgradeElements = []) {
  const dom = createDom();
  dom.document.querySelectorAll = selector =>
    selector === "[data-cradle-card]" ? autoUpgradeElements : [];

  const context = {
    window: { document: dom.document },
    document: dom.document,
    Element: MockElement,
    console,
  };

  vm.runInNewContext(CARD_SOURCE, context, { filename: "Card.js" });
  return { card: context.window.CradleCard, ...dom };
}

test("create builds a base card with title, subtitle, badge and icon", () => {
  const { card } = loadCard();
  const element = card.create({
    title: "Chess",
    subtitle: "Strategy game",
    badge: "New",
    icon: "♟️",
  });

  assert.equal(element.tagName, "ARTICLE");
  assert.ok(element.classList.contains("cradle-card"));
  assert.equal(element.childNodes.length, 1);

  const header = element.childNodes[0];
  assert.ok(header.classList.contains("cradle-card__header"));
  assert.equal(header.childNodes[0].innerHTML, "♟️");
  assert.equal(header.childNodes[0].getAttribute("aria-hidden"), "true");
  assert.equal(
    header.childNodes[1].childNodes[0].childNodes[0].textContent,
    "Chess"
  );
  assert.equal(
    header.childNodes[1].childNodes[0].childNodes[1].textContent,
    "New"
  );
  assert.equal(header.childNodes[1].childNodes[1].textContent, "Strategy game");
});

test("create renders children content and footer with the requested alignment", () => {
  const { card } = loadCard();
  const element = card.create({
    title: "Project",
    children: "<p>Hello</p>",
    footer: "<button>Open</button>",
    footerAlign: "between",
  });

  assert.equal(element.childNodes.length, 3);
  assert.ok(element.childNodes[1].classList.contains("cradle-card__content"));
  assert.equal(element.childNodes[1].innerHTML, "<p>Hello</p>");
  assert.ok(
    element.childNodes[2].classList.contains("cradle-card__footer--between")
  );
  assert.equal(element.childNodes[2].innerHTML, "<button>Open</button>");
});

test("create supports an Element child in content and an array of footer elements", () => {
  const { card, createElement } = loadCard();
  const contentChild = createElement("p");
  contentChild.textContent = "Body";
  const firstAction = createElement("button");
  const secondAction = createElement("a");

  const element = card.create({
    children: contentChild,
    footer: [firstAction, secondAction],
  });

  assert.equal(element.childNodes[0].childNodes[0], contentChild);
  assert.equal(element.childNodes[1].childNodes.length, 2);
  assert.equal(element.childNodes[1].childNodes[0], firstAction);
  assert.equal(element.childNodes[1].childNodes[1], secondAction);
});

test("create supports hero images with title-based alt text, lazy loading, and explicit dimensions", () => {
  const { card } = loadCard();
  const element = card.create({
    title: "Solar System",
    image: "/images/solar-system.jpg",
  });

  const image = element.childNodes[0];
  assert.equal(image.tagName, "IMG");
  assert.equal(image.src, "/images/solar-system.jpg");
  assert.equal(image.alt, "Solar System");
  assert.equal(image.loading, "lazy");
  assert.equal(image.getAttribute("loading"), "lazy");
  assert.equal(image.getAttribute("width"), "1200");
  assert.equal(image.getAttribute("height"), "675");
  assert.equal(image.width, 1200);
  assert.equal(image.height, 675);
  assert.ok(image.classList.contains("cradle-card__image"));
});

test("create allows customizing explicit dimensions and loading mode", () => {
  const { card } = loadCard();
  const element = card.create({
    title: "Constellations",
    image: "/images/constellations.svg",
    imageWidth: 800,
    imageHeight: 450,
    imageLoading: "eager",
  });

  const image = element.childNodes[0];
  assert.equal(image.getAttribute("width"), "800");
  assert.equal(image.getAttribute("height"), "450");
  assert.equal(image.getAttribute("loading"), "eager");
  assert.equal(image.width, 800);
  assert.equal(image.height, 450);
  assert.equal(image.loading, "eager");
});

test("image load failure replaces the broken image with an accessible fallback", () => {
  const { card } = loadCard();
  const element = card.create({ title: "Camera", image: "/missing.jpg" });
  const image = element.childNodes[0];

  image.dispatchEvent({ type: "error" });

  const fallback = element.childNodes[0];
  assert.equal(fallback.tagName, "DIV");
  assert.ok(fallback.classList.contains("cradle-card__image--fallback"));
  assert.equal(fallback.getAttribute("role"), "img");
  assert.equal(fallback.getAttribute("aria-label"), "Camera");
  assert.equal(fallback.textContent, "C");
});

test("clickable cards expose button semantics, keyboard activation and custom classes", () => {
  const { card } = loadCard();
  let clicks = 0;
  const element = card.create({
    title: "Open project",
    clickable: true,
    className: "featured-card",
    ariaLabel: "Open project details",
    onClick: () => clicks++,
  });

  assert.ok(element.classList.contains("cradle-card--clickable"));
  assert.ok(element.classList.contains("featured-card"));
  assert.equal(element.getAttribute("role"), "button");
  assert.equal(element.getAttribute("tabindex"), "0");
  assert.equal(element.getAttribute("aria-label"), "Open project details");

  element.dispatchEvent({ type: "click" });
  element.dispatchEvent({
    type: "keydown",
    key: "Enter",
    preventDefault() {
      this.prevented = true;
    },
  });
  element.dispatchEvent({
    type: "keydown",
    key: " ",
    preventDefault() {
      this.prevented = true;
    },
  });

  assert.equal(clicks, 3);
});

test("clickable cards without a handler still expose keyboard semantics safely", () => {
  const { card } = loadCard();
  const element = card.create({ clickable: true });

  assert.equal(element.getAttribute("role"), "button");
  assert.equal(element.getAttribute("tabindex"), "0");
  assert.doesNotThrow(() => {
    element.dispatchEvent({
      type: "keydown",
      key: "Enter",
      preventDefault() {},
    });
  });
});

test("isNew adds the New ribbon without affecting the card structure", () => {
  const { card } = loadCard();
  const element = card.create({ title: "Fresh", isNew: true });

  assert.equal(element.childNodes[0].textContent, "New");
  assert.ok(
    element.childNodes[0].classList.contains("cradle-card__new-ribbon")
  );
  assert.ok(element.childNodes[1].classList.contains("cradle-card__header"));
});

test("subtitle falls back into content when there is no title", () => {
  const { card } = loadCard();
  const element = card.create({
    subtitle: "A useful description",
    children: "Body",
  });
  const content = element.childNodes[0];

  assert.ok(content.classList.contains("cradle-card__content"));
  assert.equal(content.childNodes[0].textContent, "A useful description");
  assert.ok(content.childNodes[0].classList.contains("cradle-card__subtitle"));
});

test("Header, Content and Footer sub-builders create composable primitives", () => {
  const { card, createElement } = loadCard();
  const header = card.Header({ title: "Reusable", badge: "UI" });
  const contentChild = createElement("span");
  const footerChild = createElement("button");
  const content = card.Content({ children: contentChild });
  const footer = card.Footer({ children: [footerChild], align: "right" });

  assert.ok(header.classList.contains("cradle-card__header"));
  assert.ok(content.classList.contains("cradle-card__content"));
  assert.equal(content.childNodes[0], contentChild);
  assert.ok(footer.classList.contains("cradle-card__footer--right"));
  assert.equal(footer.childNodes[0], footerChild);
});

test("HTML auto-upgrade adds card styling and wraps unstructured content", () => {
  const dom = createDom();
  const element = dom.createElement("section");
  element.dataset.clickable = "true";
  element.innerHTML = "<p>Existing content</p>";
  dom.createTextNode("Existing content");
  element.appendChild(dom.createTextNode("Existing content"));
  element._attributes.set("data-cradle-card", "");

  const { card } = loadCard([element]);
  card.upgradeAll();

  assert.ok(element.classList.contains("cradle-card"));
  assert.ok(element.classList.contains("cradle-card--clickable"));
  assert.equal(element.getAttribute("tabindex"), "0");
  assert.ok(element.childNodes[0].classList.contains("cradle-card__content"));
  assert.equal(
    element.childNodes[0].childNodes[0].textContent,
    "Existing content"
  );
});

test("HTML auto-upgrade injects header metadata and preserves existing content", () => {
  const dom = createDom();
  const element = dom.createElement("div");
  element.dataset.title = "Dashboard";
  element.dataset.subtitle = "Overview";
  element.dataset.icon = "📊";
  element.dataset.badge = "Beta";
  element.innerHTML = "<p>Stats</p>";
  element.appendChild(dom.createTextNode("Stats"));

  const { card } = loadCard([element]);
  card.upgradeAll();

  assert.ok(element.classList.contains("cradle-card"));
  assert.equal(element.childNodes.length, 2);
  const header = element.childNodes[0];
  assert.equal(header.childNodes[0].innerHTML, "📊");
  assert.equal(
    header.childNodes[1].childNodes[0].childNodes[0].textContent,
    "Dashboard"
  );
  assert.equal(
    header.childNodes[1].childNodes[0].childNodes[1].textContent,
    "Beta"
  );
  assert.equal(header.childNodes[1].childNodes[1].textContent, "Overview");
  assert.equal(element.childNodes[1].childNodes[0].textContent, "Stats");
});

test("HTML auto-upgrade is idempotent for classes and structured content", () => {
  const dom = createDom();
  const element = dom.createElement("div");
  element.dataset.title = "Stable";
  element.dataset.badge = "One";
  element.innerHTML = "<p>Body</p>";
  element.appendChild(dom.createTextNode("Body"));

  const { card } = loadCard([element]);
  card.upgradeAll();
  card.upgradeAll();

  const classes = element.className.split(/\s+/).filter(Boolean);
  assert.equal(classes.filter(name => name === "cradle-card").length, 1);
  assert.equal(element.childNodes.length, 3);
  assert.equal(
    element.childNodes.filter(
      child =>
        child instanceof MockElement &&
        child.classList.contains("cradle-card__header")
    ).length,
    2
  );
});

test("styles are injected only once across multiple card operations", () => {
  const { card, document } = loadCard();
  card.create({ title: "One" });
  card.create({ title: "Two" });
  card.upgradeAll();

  const styleNodes = document.head.childNodes.filter(
    node => node.id === "cradle-card-styles"
  );
  assert.equal(styleNodes.length, 1);
});
