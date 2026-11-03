const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CARD_SOURCE = fs.readFileSync(
  path.join(__dirname, "../src/components/ui/Card/Card.js"),
  "utf8"
);
const SCRIPT_SOURCE = fs.readFileSync(
  path.join(__dirname, "../script.js"),
  "utf8"
);
const STYLE_SOURCE = fs.readFileSync(
  path.join(__dirname, "../style.css"),
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
    this.decoding = "";
    this.referrerPolicy = "";
    this.width = 0;
    this.height = 0;
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
    if (name === "width") this.width = Number(value);
    if (name === "height") this.height = Number(value);
    if (name === "loading") this.loading = String(value);
    if (name === "decoding") this.decoding = String(value);
  }

  getAttribute(name) {
    if (this._attributes.has(name)) return this._attributes.get(name);
    if (name === "src" && this.src) return this.src;
    if (name === "alt" && this.alt) return this.alt;
    if (name === "loading" && this.loading) return this.loading;
    if (name === "width" && this.width) return String(this.width);
    if (name === "height" && this.height) return String(this.height);
    return null;
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

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(handler);
  }

  querySelector(selector) {
    if (selector.includes("img") || selector.includes(".cradle-card__image")) {
      return (
        this.childNodes.find(
          c =>
            c instanceof MockElement &&
            (c.tagName === "IMG" || c.classList.contains("cradle-card__image"))
        ) || null
      );
    }
    return null;
  }

  querySelectorAll(selector) {
    const matched = [];
    for (const c of this.childNodes) {
      if (
        c instanceof MockElement &&
        (c.tagName === "IMG" || c.classList.contains("cradle-card__image"))
      ) {
        matched.push(c);
      }
    }
    return matched;
  }
}

function loadCardEnv(autoUpgradeElements = []) {
  const elements = [];
  const createElement = tagName => {
    const el = new MockElement(tagName);
    elements.push(el);
    return el;
  };
  const head = createElement("head");
  const document = {
    readyState: "loading",
    head,
    createElement,
    getElementById(id) {
      return elements.find(el => el.id === id) || null;
    },
    querySelectorAll(sel) {
      if (sel === "[data-cradle-card]") return autoUpgradeElements;
      return [];
    },
    addEventListener() {},
  };
  const context = {
    window: { document },
    document,
    Element: MockElement,
    console,
  };
  vm.runInNewContext(CARD_SOURCE, context, { filename: "Card.js" });
  return { card: context.window.CradleCard, elements, document };
}

test("CradleCard.create applies loading=lazy, width=1200, and height=675 to images by default", () => {
  const { card } = loadCardEnv();
  const el = card.create({
    title: "Snake Game",
    subtitle: "Classic arcade game",
    image: "projects/games/snake-game/thumbnail.svg",
  });

  const img = el.childNodes.find(c => c.tagName === "IMG");
  assert.ok(img, "Card must include an <img> element");
  assert.equal(img.getAttribute("loading"), "lazy");
  assert.equal(img.loading, "lazy");
  assert.equal(img.getAttribute("width"), "1200");
  assert.equal(img.getAttribute("height"), "675");
  assert.equal(img.width, 1200);
  assert.equal(img.height, 675);
  assert.equal(img.getAttribute("decoding"), "async");
  assert.equal(img.getAttribute("referrerpolicy"), "no-referrer");
});

test("script.js configures createProjectCard with explicit dimensions and lazy loading", () => {
  assert.match(
    SCRIPT_SOURCE,
    /imageWidth:\s*1200/,
    "script.js must pass imageWidth: 1200 to CradleCard.create"
  );
  assert.match(
    SCRIPT_SOURCE,
    /imageHeight:\s*675/,
    "script.js must pass imageHeight: 675 to CradleCard.create"
  );
  assert.match(
    SCRIPT_SOURCE,
    /imageLoading:\s*["']lazy["']/,
    "script.js must pass imageLoading: 'lazy' to CradleCard.create"
  );
});

test("CSS rules enforce 16:9 aspect ratio and responsive layout to eliminate layout shift", () => {
  // Check Card.js injected styles
  assert.match(
    CARD_SOURCE,
    /\.cradle-card__image\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9[^}]*\}/s,
    "Card.js must define aspect-ratio: 16 / 9 for .cradle-card__image"
  );
  assert.match(
    CARD_SOURCE,
    /\.cradle-card__image\s*\{[^}]*width:\s*100%[^}]*\}/s,
    "Card.js must define width: 100% for .cradle-card__image"
  );
  assert.match(
    CARD_SOURCE,
    /\.cradle-card__image\s*\{[^}]*height:\s*auto[^}]*\}/s,
    "Card.js must define height: auto for .cradle-card__image"
  );

  // Check style.css
  assert.match(
    STYLE_SOURCE,
    /\.cradle-card__image\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9[^}]*\}/s,
    "style.css must define aspect-ratio: 16 / 9 for .cradle-card__image"
  );
  assert.match(
    STYLE_SOURCE,
    /\.cradle-card__image\s*\{[^}]*height:\s*auto[^}]*\}/s,
    "style.css must define height: auto for .cradle-card__image"
  );
});

test("CradleCard.upgradeAll enhances existing card images with lazy loading and dimensions", () => {
  const cardElement = new MockElement("div");
  cardElement.dataset.cradleCard = "true";
  cardElement.className = "cradle-card";

  const rawImg = new MockElement("img");
  rawImg.className = "cradle-card__image";
  rawImg.src = "projects/tools/calc/thumbnail.svg";
  cardElement.appendChild(rawImg);

  const { card } = loadCardEnv([cardElement]);

  // Run upgrade
  card.upgradeAll();

  // Verify rawImg attributes upgraded
  assert.equal(rawImg.getAttribute("loading"), "lazy");
  assert.equal(rawImg.getAttribute("width"), "1200");
  assert.equal(rawImg.getAttribute("height"), "675");
});
