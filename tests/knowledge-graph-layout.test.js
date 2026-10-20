const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const PROJECT_DIR = path.resolve(
  __dirname,
  "..",
  "projects",
  "productivity",
  "knowledge-graph"
);

function importModule(name) {
  return import(pathToFileURL(path.join(PROJECT_DIR, name)).href);
}

test("new nodes receive finite initial positions and zero velocity", async () => {
  const { placeNodes } = await importModule("layout.js");
  const nodes = [{ id: "alpha" }, { id: "beta" }];

  placeNodes(nodes);

  for (const node of nodes) {
    assert.equal(Number.isFinite(node.x), true);
    assert.equal(Number.isFinite(node.y), true);
    assert.equal(node.x >= -100 && node.x <= 100, true);
    assert.equal(node.y >= -100 && node.y <= 100, true);
    assert.equal(node.vx, 0);
    assert.equal(node.vy, 0);
  }
});

test("existing nodes keep positions and velocities, including one at the origin", async () => {
  const { placeNodes } = await importModule("layout.js");
  const previousNodes = [
    { id: "stable", x: 42, y: -17, vx: 1.5, vy: -2.5 },
    { id: "origin", x: 0, y: 0, vx: 0, vy: 0 },
    { id: "removed", x: 80, y: 90, vx: 0, vy: 0 },
  ];
  const nodes = [
    { id: "stable", x: 0, y: 0, vx: 0, vy: 0 },
    { id: "origin", x: 0, y: 0, vx: 0, vy: 0 },
    { id: "new", x: 0, y: 0, vx: 0, vy: 0 },
  ];

  placeNodes(nodes, previousNodes);

  assert.deepEqual(
    {
      x: nodes[0].x,
      y: nodes[0].y,
      vx: nodes[0].vx,
      vy: nodes[0].vy,
    },
    { x: 42, y: -17, vx: 1.5, vy: -2.5 }
  );
  assert.deepEqual({ x: nodes[1].x, y: nodes[1].y }, { x: 0, y: 0 });
  assert.equal(Number.isFinite(nodes[2].x), true);
  assert.equal(Number.isFinite(nodes[2].y), true);
});

test("centered transform uses the canvas midpoint and keeps zoom", async () => {
  const { getCenteredTransform } = await importModule("layout.js");

  assert.deepEqual(getCenteredTransform(800, 600), {
    x: 400,
    y: 300,
    k: 1,
  });
  assert.deepEqual(getCenteredTransform(1000, 500, 2), {
    x: 500,
    y: 250,
    k: 2,
  });
});

test("GraphEngine centers the first view and keeps positions across reloads", async () => {
  const resizeRect = { width: 800, height: 600 };
  const canvasListeners = new Map();
  const context = {
    clearRect() {},
    save() {},
    translate() {},
    scale() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    arc() {},
    fill() {},
    fillText() {},
    restore() {},
  };
  const canvas = {
    width: 0,
    height: 0,
    parentElement: {
      getBoundingClientRect: () => resizeRect,
    },
    getContext: () => context,
    addEventListener(type, handler) {
      canvasListeners.set(type, handler);
    },
  };
  const resetButton = { addEventListener() {} };
  const noteList = {
    innerHTML: "",
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
  };
  const titleInput = { value: "" };
  const contentInput = { value: "" };

  globalThis.document = {
    addEventListener() {},
    getElementById(id) {
      if (id === "graph-canvas") return canvas;
      if (id === "btn-reset-zoom") return resetButton;
      if (id === "note-list") return noteList;
      if (id === "note-title") return titleInput;
      if (id === "note-content") return contentInput;
      return null;
    },
    createElement() {
      return {
        className: "",
        textContent: "",
        classList: { add() {}, remove() {} },
        addEventListener() {},
      };
    },
    querySelectorAll() {
      return [];
    },
  };
  globalThis.window = { addEventListener() {} };
  globalThis.requestAnimationFrame = () => 0;

  try {
    const { GraphEngine } = await importModule("graph-engine.js");
    const notes = [
      { title: "Alpha", content: "Links to [[Beta]]" },
      { title: "Beta", content: "" },
    ];
    const storage = { getAllNotes: async () => notes };
    const engine = new GraphEngine("graph-canvas", storage);

    assert.deepEqual(engine.transform, { x: 400, y: 300, k: 1 });

    await engine.loadData();

    const alpha = engine.nodes.find(node => node.id === "Alpha");
    const beta = engine.nodes.find(node => node.id === "Beta");

    assert.ok(alpha);
    assert.ok(beta);

    alpha.x = 12;
    alpha.y = -34;
    alpha.vx = 1.5;
    alpha.vy = -2.5;
    beta.x = 56;
    beta.y = 78;
    beta.vx = 0;
    beta.vy = 0;

    await engine.loadData();

    const reloadedAlpha = engine.nodes.find(node => node.id === "Alpha");
    const reloadedBeta = engine.nodes.find(node => node.id === "Beta");

    assert.equal(reloadedAlpha.x, 12);
    assert.equal(reloadedAlpha.y, -34);
    assert.equal(reloadedAlpha.vx, 1.5);
    assert.equal(reloadedAlpha.vy, -2.5);
    assert.equal(reloadedBeta.x, 56);
    assert.equal(reloadedBeta.y, 78);

    resizeRect.width = 1000;
    resizeRect.height = 700;
    engine.resizeCanvas();

    assert.deepEqual(engine.transform, { x: 500, y: 350, k: 1 });
  } finally {
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.requestAnimationFrame;
  }
});
