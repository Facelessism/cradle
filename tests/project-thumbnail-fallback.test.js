const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const BUTTON_SOURCE = fs.readFileSync(
  path.join(__dirname, "../src/components/ui/Button/Button.js"),
  "utf8"
);
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
    this.target = "";
    this.rel = "";
    this.type = "";
    this.disabled = false;
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

  setAttribute(name, value) {
    this._attributes.set(name, String(value));
  }

  getAttribute(name) {
    if (this._attributes.has(name)) return this._attributes.get(name);
    if (name === "src" && this.src) return this.src;
    if (name === "alt" && this.alt) return this.alt;
    if (name === "role") return this._attributes.get("role") || null;
    return null;
  }

  hasAttribute(name) {
    return this._attributes.has(name);
  }

  removeAttribute(name) {
    this._attributes.delete(name);
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
}

function createEnvironment() {
  const elements = [];
  const createElement = tagName => {
    const element = new MockElement(tagName);
    elements.push(element);
    return element;
  };

  const head = createElement("head");
  const document = {
    readyState: "loading",
    head,
    createElement,
    createTextNode: text => ({ nodeType: 3, textContent: String(text) }),
    getElementById: id => elements.find(el => el.id === id) || null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };

  const context = {
    window: { document },
    document,
    Element: MockElement,
    Node: { TEXT_NODE: 3 },
    console,
  };

  vm.runInNewContext(BUTTON_SOURCE, context, { filename: "Button.js" });
  vm.runInNewContext(CARD_SOURCE, context, { filename: "Card.js" });

  return {
    CradleButton: context.window.CradleButton,
    CradleCard: context.window.CradleCard,
  };
}

test("valid thumbnail URL renders <img> element normally", () => {
  const { CradleCard } = createEnvironment();

  const card = CradleCard.create({
    title: "Chess",
    image: "projects/games/chess/thumbnail.svg",
  });

  const img = card.childNodes.find(node => node.tagName === "IMG");
  assert.ok(img, "Card must render an <img> element for a valid image URL");
  assert.equal(img.src, "projects/games/chess/thumbnail.svg");
  assert.equal(img.alt, "Chess");
  assert.ok(img.classList.contains("cradle-card__image"));
});

test("null, empty, or whitespace thumbnail renders safe fallback element", () => {
  const { CradleCard } = createEnvironment();

  for (const emptyImage of [null, "", "   ", "undefined"]) {
    const card = CradleCard.create({
      title: "2048 Game",
      image: emptyImage,
    });

    const img = card.childNodes.find(node => node.tagName === "IMG");
    assert.equal(img, undefined, "Card must not render an <img> for empty/null thumbnail");

    const fallback = card.childNodes.find(node =>
      node.classList?.contains("cradle-card__image--fallback")
    );
    assert.ok(fallback, `Fallback <div> expected for image=${JSON.stringify(emptyImage)}`);
    assert.equal(fallback.tagName, "DIV");
    assert.ok(fallback.classList.contains("cradle-card__image"));
    assert.equal(fallback.getAttribute("role"), "img");
    assert.equal(fallback.getAttribute("aria-label"), "2048 Game");
    assert.equal(fallback.textContent, "2");
  }
});

test("malformed thumbnail URLs render safe fallback element", () => {
  const { CradleCard } = createEnvironment();

  for (const malformed of ["data:,", "javascript:void(0)", "http://"]) {
    const card = CradleCard.create({
      title: "Piano",
      image: malformed,
    });

    const img = card.childNodes.find(node => node.tagName === "IMG");
    assert.equal(img, undefined, `Malformed URL ${malformed} must not render an <img> element`);

    const fallback = card.childNodes.find(node =>
      node.classList?.contains("cradle-card__image--fallback")
    );
    assert.ok(fallback, `Fallback <div> expected for malformed image=${malformed}`);
    assert.equal(fallback.textContent, "P");
  }
});

test("runtime image load error triggers fallback replacement safely", () => {
  const { CradleCard } = createEnvironment();

  const card = CradleCard.create({
    title: "Meme Generator",
    image: "projects/misc/meme-generator/missing-thumbnail.svg",
  });

  const img = card.childNodes.find(node => node.tagName === "IMG");
  assert.ok(img, "Initial <img> element should exist");

  // Simulate image failing to load
  img.dispatchEvent({ type: "error" });

  const fallback = card.childNodes.find(node =>
    node.classList?.contains("cradle-card__image--fallback")
  );
  assert.ok(fallback, "Failed image must be replaced with fallback <div>");
  assert.equal(fallback.tagName, "DIV");
  assert.ok(fallback.classList.contains("cradle-card__image"));
  assert.equal(fallback.textContent, "M");

  // Verify second error event does not throw or loop
  assert.doesNotThrow(() => {
    img.dispatchEvent({ type: "error" });
  });
});

test("fallback element preserves gallery layout classes and dimensions", () => {
  const { CradleCard } = createEnvironment();

  const card = CradleCard.create({
    title: "Sudoku",
    image: null,
  });

  const fallback = card.childNodes.find(node =>
    node.classList?.contains("cradle-card__image--fallback")
  );
  assert.ok(fallback.classList.contains("cradle-card__image"));
  assert.ok(fallback.classList.contains("cradle-card__image--fallback"));
});

test("existing valid thumbnail card interactions remain completely unchanged", () => {
  const { CradleButton, CradleCard } = createEnvironment();

  let clicked = false;
  const openButton = CradleButton.create({
    variant: "outline",
    size: "sm",
    children: "Open Project",
    onClick: () => {
      clicked = true;
    },
  });

  const card = CradleCard.create({
    title: "Ludo",
    image: "projects/games/ludo-game/thumbnail.svg",
    footer: [openButton],
  });

  const footer = card.childNodes.find(node =>
    node.classList?.contains("cradle-card__footer")
  );
  assert.ok(footer);

  const [button] = footer.childNodes;
  button.dispatchEvent({ type: "click" });
  assert.equal(clicked, true);
});
