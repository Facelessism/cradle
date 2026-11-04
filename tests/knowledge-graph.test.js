import { test } from "node:test";
import assert from "node:assert/strict";
import {
  placeNodes,
  getCenteredTransform,
} from "../projects/productivity/knowledge-graph/layout.js";
import { GraphEngine } from "../projects/productivity/knowledge-graph/graph-engine.js";

function createMockCanvas(width = 800, height = 600) {
  let rect = { width, height };
  return {
    width,
    height,
    parentElement: {
      getBoundingClientRect: () => rect,
    },
    getContext: () => ({
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
      fillText: () => {},
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    setDimensions(w, h) {
      rect = { width: w, height: h };
    },
  };
}

function createMockStorage(initialNotes = []) {
  return {
    notes: [...initialNotes],
    async getAllNotes() {
      return this.notes;
    },
  };
}

test("placeNodes assigns random bounded positions to genuinely new nodes", () => {
  const newNodes = [
    { id: "note-1", label: "Note 1", x: 0, y: 0, vx: 0, vy: 0 },
    { id: "note-2", label: "Note 2", x: 0, y: 0, vx: 0, vy: 0 },
  ];

  const placed = placeNodes(newNodes, []);

  assert.equal(placed.length, 2);
  for (const node of placed) {
    assert.equal(typeof node.x, "number");
    assert.equal(typeof node.y, "number");
    assert.ok(node.x >= -100 && node.x <= 100);
    assert.ok(node.y >= -100 && node.y <= 100);
    assert.equal(node.vx, 0);
    assert.equal(node.vy, 0);
  }
});

test("placeNodes preserves positions and velocities including nodes at (0, 0) without treating it as sentinel", () => {
  const previousNodes = [
    { id: "origin-node", label: "Origin", x: 0, y: 0, vx: 3.5, vy: -1.2 },
    { id: "moved-node", label: "Moved", x: 42.5, y: -88.1, vx: 0.1, vy: 0.2 },
  ];

  const incomingNodes = [
    { id: "origin-node", label: "Origin", x: 0, y: 0, vx: 0, vy: 0 },
    { id: "moved-node", label: "Moved", x: 0, y: 0, vx: 0, vy: 0 },
    { id: "new-node", label: "New", x: 0, y: 0, vx: 0, vy: 0 },
  ];

  const placed = placeNodes(incomingNodes, previousNodes);

  const origin = placed.find(n => n.id === "origin-node");
  assert.ok(origin);
  assert.equal(origin.x, 0);
  assert.equal(origin.y, 0);
  assert.equal(origin.vx, 3.5);
  assert.equal(origin.vy, -1.2);

  const moved = placed.find(n => n.id === "moved-node");
  assert.ok(moved);
  assert.equal(moved.x, 42.5);
  assert.equal(moved.y, -88.1);
  assert.equal(moved.vx, 0.1);
  assert.equal(moved.vy, 0.2);

  const newNode = placed.find(n => n.id === "new-node");
  assert.ok(newNode);
  assert.equal(typeof newNode.x, "number");
  assert.equal(typeof newNode.y, "number");
  assert.ok(newNode.x >= -100 && newNode.x <= 100);
  assert.ok(newNode.y >= -100 && newNode.y <= 100);
});

test("getCenteredTransform returns a viewport transform centered on the canvas", () => {
  const t1 = getCenteredTransform(800, 600);
  assert.deepEqual(t1, { x: 400, y: 300, k: 1 });

  const t2 = getCenteredTransform(1920, 1080, 2.5);
  assert.deepEqual(t2, { x: 960, y: 540, k: 2.5 });

  const t3 = getCenteredTransform(0, 0);
  assert.deepEqual(t3, { x: 0, y: 0, k: 1 });
});

test("GraphEngine constructor initializes transform centered on the canvas", () => {
  const canvas = createMockCanvas(1200, 800);
  const storage = createMockStorage();
  const engine = new GraphEngine(canvas, storage);

  assert.deepEqual(engine.transform, { x: 600, y: 400, k: 1 });
});

test("GraphEngine reloadData preserves node positions and motion across reloads", async () => {
  const initialNotes = [
    { title: "Alpha", content: "Links to [[Beta]]" },
    { title: "Beta", content: "Links to [[Alpha]]" },
  ];

  const canvas = createMockCanvas(800, 600);
  const storage = createMockStorage(initialNotes);
  const engine = new GraphEngine(canvas, storage);

  await engine.loadData();
  assert.equal(engine.nodes.length, 2);

  const alpha = engine.nodes.find(n => n.id === "Alpha");
  const beta = engine.nodes.find(n => n.id === "Beta");
  assert.ok(alpha);
  assert.ok(beta);

  // Set specific positions and velocities, including (0, 0)
  alpha.x = 0;
  alpha.y = 0;
  alpha.vx = 1.25;
  alpha.vy = -2.5;

  beta.x = 150.5;
  beta.y = -75.25;
  beta.vx = -0.75;
  beta.vy = 0.5;

  // Reload data as if notes updated
  await engine.loadData();

  const reloadedAlpha = engine.nodes.find(n => n.id === "Alpha");
  const reloadedBeta = engine.nodes.find(n => n.id === "Beta");

  assert.equal(reloadedAlpha.x, 0);
  assert.equal(reloadedAlpha.y, 0);
  assert.equal(reloadedAlpha.vx, 1.25);
  assert.equal(reloadedAlpha.vy, -2.5);

  assert.equal(reloadedBeta.x, 150.5);
  assert.equal(reloadedBeta.y, -75.25);
  assert.equal(reloadedBeta.vx, -0.75);
  assert.equal(reloadedBeta.vy, 0.5);
});

test("resizeCanvas shifts transform by half the delta keeping world center and zoom intact", () => {
  const canvas = createMockCanvas(800, 600);
  const storage = createMockStorage();
  const engine = new GraphEngine(canvas, storage);

  assert.deepEqual(engine.transform, { x: 400, y: 300, k: 1 });

  // Pan and zoom to arbitrary viewport state
  engine.transform.x = 250;
  engine.transform.y = 180;
  engine.transform.k = 1.8;

  const worldCenterBefore = engine.screenToWorld(800 / 2, 600 / 2);

  // Resize canvas to 1200 x 900 (deltaW = +400, deltaH = +300)
  canvas.setDimensions(1200, 900);
  engine.resizeCanvas();

  assert.equal(canvas.width, 1200);
  assert.equal(canvas.height, 900);
  assert.equal(engine.transform.x, 250 + 400 / 2); // 450
  assert.equal(engine.transform.y, 180 + 300 / 2); // 330
  assert.equal(engine.transform.k, 1.8); // zoom preserved

  const worldCenterAfter = engine.screenToWorld(1200 / 2, 900 / 2);
  assert.ok(Math.abs(worldCenterAfter.x - worldCenterBefore.x) < 1e-9);
  assert.ok(Math.abs(worldCenterAfter.y - worldCenterBefore.y) < 1e-9);
});
