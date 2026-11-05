import { test } from "node:test";
import assert from "node:assert/strict";
import {
  placeNodes,
  getCenteredTransform,
  computeArrowhead,
} from "../projects/productivity/knowledge-graph/layout.js";
import { GraphEngine } from "../projects/productivity/knowledge-graph/graph-engine.js";

function createMockCanvas(width = 800, height = 600) {
  let rect = { width, height };
  const listeners = {};
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
    addEventListener: (event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    },
    removeEventListener: (event, handler) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler);
      }
    },
    dispatch(event, e) {
      if (listeners[event]) {
        for (const handler of listeners[event]) {
          handler(e);
        }
      }
    },
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

test("placeNodes preserves pinned state and fixed fx, fy coordinates across reloads", () => {
  const previousNodes = [
    {
      id: "pinned-node",
      label: "Pinned",
      x: 120,
      y: -40,
      vx: 0,
      vy: 0,
      pinned: true,
      fx: 120,
      fy: -40,
    },
    {
      id: "unpinned-node",
      label: "Free",
      x: -50,
      y: 60,
      vx: 1.5,
      vy: -0.5,
      pinned: false,
      fx: null,
      fy: null,
    },
  ];

  const incomingNodes = [
    { id: "pinned-node", label: "Pinned", x: 0, y: 0, vx: 0, vy: 0 },
    { id: "unpinned-node", label: "Free", x: 0, y: 0, vx: 0, vy: 0 },
  ];

  const placed = placeNodes(incomingNodes, previousNodes);

  const pinned = placed.find(n => n.id === "pinned-node");
  assert.ok(pinned);
  assert.equal(pinned.x, 120);
  assert.equal(pinned.y, -40);
  assert.equal(pinned.pinned, true);
  assert.equal(pinned.fx, 120);
  assert.equal(pinned.fy, -40);

  const unpinned = placed.find(n => n.id === "unpinned-node");
  assert.ok(unpinned);
  assert.equal(unpinned.pinned, false);
  assert.equal(unpinned.fx, null);
  assert.equal(unpinned.fy, null);
});

test("computeArrowhead calculates tip and wing coordinates along directed edge", () => {
  // Horizontal edge from (0, 0) to (100, 0)
  const source = { x: 0, y: 0 };
  const target = { x: 100, y: 0 };
  const arrow = computeArrowhead(source, target, 20, 10, Math.PI / 6);

  assert.ok(arrow);
  assert.equal(arrow.angle, 0);
  // Tip lands on perimeter of target circle (100 - 20 = 80, 0)
  assert.equal(Math.round(arrow.tip.x), 80);
  assert.equal(Math.round(arrow.tip.y), 0);

  // Wings flare backwards symmetrically
  const expectedWingX = 80 - 10 * Math.cos(Math.PI / 6);
  assert.ok(Math.abs(arrow.left.x - expectedWingX) < 1e-6);
  assert.ok(Math.abs(arrow.right.x - expectedWingX) < 1e-6);
  assert.ok(Math.abs(arrow.left.y - 5) < 1e-6);
  assert.ok(Math.abs(arrow.right.y - -5) < 1e-6);
});

test("computeArrowhead returns null for overlapping nodes or invalid inputs", () => {
  assert.equal(computeArrowhead(null, { x: 10, y: 10 }), null);
  assert.equal(computeArrowhead({ x: 10, y: 10 }, null), null);
  // Nodes closer than target radius
  assert.equal(computeArrowhead({ x: 0, y: 0 }, { x: 10, y: 0 }, 20, 10), null);
  // Exactly concentric nodes
  assert.equal(
    computeArrowhead({ x: 50, y: 50 }, { x: 50, y: 50 }, 20, 10),
    null
  );
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

test("GraphEngine toggleNodePin sets and clears pinned state and fx/fy coordinates", () => {
  const canvas = createMockCanvas(800, 600);
  const storage = createMockStorage();
  const engine = new GraphEngine(canvas, storage);

  const node = { id: "test-node", label: "Test", x: 75, y: -25, vx: 2, vy: -3 };

  assert.equal(engine.isNodePinned(node), false);

  // Pin node
  const pinnedResult = engine.toggleNodePin(node);
  assert.equal(pinnedResult, true);
  assert.equal(node.pinned, true);
  assert.equal(node.fx, 75);
  assert.equal(node.fy, -25);
  assert.equal(node.vx, 0);
  assert.equal(node.vy, 0);
  assert.equal(engine.isNodePinned(node), true);

  // Unpin node
  const unpinnedResult = engine.toggleNodePin(node);
  assert.equal(unpinnedResult, false);
  assert.equal(node.pinned, false);
  assert.equal(node.fx, null);
  assert.equal(node.fy, null);
  assert.equal(engine.isNodePinned(node), false);
});

test("GraphEngine applyForces locks pinned nodes at fx/fy while unpinned nodes move", () => {
  const canvas = createMockCanvas(800, 600);
  const storage = createMockStorage();
  const engine = new GraphEngine(canvas, storage);

  const pinnedNode = {
    id: "pinned",
    label: "Pinned",
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    pinned: true,
    fx: 100,
    fy: 100,
  };

  const freeNode = {
    id: "free",
    label: "Free",
    x: 105,
    y: 100,
    vx: 0,
    vy: 0,
  };

  engine.nodes = [pinnedNode, freeNode];
  engine.edges = [{ source: "pinned", target: "free" }];

  engine.applyForces();

  // Pinned node position must remain unchanged at (100, 100) with 0 velocity
  assert.equal(pinnedNode.x, 100);
  assert.equal(pinnedNode.y, 100);
  assert.equal(pinnedNode.vx, 0);
  assert.equal(pinnedNode.vy, 0);

  // Free node should have experienced repulsive / spring motion
  assert.notEqual(freeNode.x, 105);
  assert.notEqual(freeNode.vx, 0);
});

test("GraphEngine dblclick and contextmenu interactions toggle node pin state", () => {
  const canvas = createMockCanvas(800, 600);
  const storage = createMockStorage();
  const engine = new GraphEngine(canvas, storage);

  const targetNode = {
    id: "interactive-node",
    label: "Interactive",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  };
  engine.nodes = [targetNode];
  // Transform centers (0, 0) at screen (400, 300) with zoom k = 1
  assert.equal(engine.transform.x, 400);
  assert.equal(engine.transform.y, 300);

  // Double-click at screen center (400, 300) which corresponds to world (0, 0)
  canvas.dispatch("dblclick", { offsetX: 400, offsetY: 300 });
  assert.equal(targetNode.pinned, true);
  assert.equal(targetNode.fx, 0);
  assert.equal(targetNode.fy, 0);

  // Right-click (contextmenu) on same node to unpin
  let prevented = false;
  canvas.dispatch("contextmenu", {
    offsetX: 400,
    offsetY: 300,
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(targetNode.pinned, false);
  assert.equal(targetNode.fx, null);
});

test("GraphEngine dragging a pinned node updates both node position and fixed fx, fy", () => {
  const canvas = createMockCanvas(800, 600);
  const storage = createMockStorage();
  const engine = new GraphEngine(canvas, storage);

  const pinnedNode = {
    id: "drag-pinned",
    label: "DragPinned",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    pinned: true,
    fx: 0,
    fy: 0,
  };
  engine.nodes = [pinnedNode];

  // Mouse down on node
  canvas.dispatch("mousedown", { offsetX: 400, offsetY: 300 });
  assert.equal(engine.draggedNode, pinnedNode);
  assert.equal(engine.isDragging, true);

  // Mouse move to new screen position (450, 350) => world (50, 50)
  canvas.dispatch("mousemove", { offsetX: 450, offsetY: 350 });
  assert.equal(pinnedNode.x, 50);
  assert.equal(pinnedNode.y, 50);
  assert.equal(pinnedNode.fx, 50);
  assert.equal(pinnedNode.fy, 50);

  // Mouse up
  canvas.dispatch("mouseup", {});
  assert.equal(engine.isDragging, false);
  assert.equal(engine.draggedNode, null);
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
