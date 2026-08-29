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

  get firstChild() {
    return this.childNodes[0] || null;
  }

  setAttribute(name, value) {
    this._attributes.set(name, String(value));
  }

  getAttribute(name) {
    if (this._attributes.has(name)) return this._attributes.get(name);
    if (name === "href" && this.href) return this.href;
    if (name === "target" && this.target) return this.target;
    if (name === "rel" && this.rel) return this.rel;
    if (name === "src" && this.src) return this.src;
    if (name === "alt" && this.alt) return this.alt;
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

function createEnvironment() {
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
    addEventListener() {},
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

  const CradleButton = context.window.CradleButton;
  const CradleCard = context.window.CradleCard;

  function isNewProject(dateAdded) {
    if (!dateAdded) return false;
    const projectDate = new Date(dateAdded);
    const now = new Date();
    const diffTime = Math.abs(now - projectDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  }

  function createProjectCard(project, options = {}) {
    const { onOpen = null, recent = false } = options;

    const openButton = CradleButton.create({
      variant: "outline",
      size: "sm",
      children: "Open Project",
      rightIcon: "→",
      href: project.path,
      target: "_self",
      rel: "noopener noreferrer",
      ariaLabel: `Open ${project.title}`,
    });

    openButton.addEventListener("click", () => {
      if (onOpen) onOpen(project);
    });

    const copyButton = CradleButton.create({
      variant: "ghost",
      size: "sm",
      children: "Copy Link",
      ariaLabel: `Copy direct link to ${project.title}`,
      onClick: () => {},
    });

    const card = CradleCard.create({
      title: project.title,
      subtitle: project.path,
      badge: project.category,
      isNew: isNewProject(project.dateAdded),
      image: `${project.path}thumbnail.svg`,
      footer: [openButton, copyButton],
      footerAlign: "left",
      className: recent ? "recent-project-card" : "",
    });

    return card;
  }

  return { CradleButton, CradleCard, createProjectCard, document };
}

test("project cards remain semantic containers without container link/button roles", () => {
  const { createProjectCard } = createEnvironment();
  const project = {
    title: "Chess",
    path: "projects/games/chess/",
    category: "games",
    dateAdded: "2026-08-01",
  };

  const card = createProjectCard(project);

  assert.equal(card.tagName, "ARTICLE");
  assert.ok(card.classList.contains("cradle-card"));
  assert.equal(
    card.hasAttribute("role"),
    false,
    "Card container should not have an explicit interactive role such as role='link'"
  );
  assert.equal(
    card.hasAttribute("tabindex"),
    false,
    "Card container should not have tabindex set"
  );
  assert.equal(
    card.hasAttribute("aria-label"),
    false,
    "Card container should not have an overriding aria-label"
  );
});

test("nested controls retain their own independent accessible semantics", () => {
  const { createProjectCard } = createEnvironment();
  const project = {
    title: "2048 Game",
    path: "projects/games/2048/",
    category: "games",
  };

  const card = createProjectCard(project);
  const footer = card.childNodes.find(node =>
    node.classList?.contains("cradle-card__footer")
  );
  assert.ok(footer, "Card must have a footer containing controls");

  const [openLink, copyButton] = footer.childNodes;

  assert.equal(openLink.tagName, "A");
  assert.equal(openLink.getAttribute("href"), "projects/games/2048/");
  assert.equal(openLink.getAttribute("target"), "_self");
  assert.equal(openLink.getAttribute("rel"), "noopener noreferrer");
  assert.equal(openLink.getAttribute("aria-label"), "Open 2048 Game");

  assert.equal(copyButton.tagName, "BUTTON");
  assert.equal(copyButton.type, "button");
  assert.equal(
    copyButton.getAttribute("aria-label"),
    "Copy direct link to 2048 Game"
  );
});

test("project card open callback triggers on open button activation", () => {
  const { createProjectCard } = createEnvironment();
  const project = {
    title: "Piano",
    path: "projects/instruments/piano/",
    category: "instruments",
  };

  let openedProject = null;
  const card = createProjectCard(project, {
    onOpen: p => {
      openedProject = p;
    },
  });

  const footer = card.childNodes.find(node =>
    node.classList?.contains("cradle-card__footer")
  );
  const [openLink] = footer.childNodes;

  openLink.dispatchEvent({ type: "click" });
  assert.deepEqual(openedProject, project);
});

test("recent project cards retain semantic container structure and distinct styling", () => {
  const { createProjectCard } = createEnvironment();
  const project = {
    title: "Markdown Resume",
    path: "projects/productivity/markdown-resume/",
    category: "productivity",
  };

  const card = createProjectCard(project, { recent: true });

  assert.equal(card.tagName, "ARTICLE");
  assert.ok(card.classList.contains("cradle-card"));
  assert.ok(card.classList.contains("recent-project-card"));
  assert.equal(card.hasAttribute("role"), false);
  assert.equal(card.hasAttribute("tabindex"), false);
});
