import { test } from "node:test";
import assert from "node:assert/strict";
import {
  placeNodes,
  getCenteredTransform,
  computeArrowhead,
} from "../projects/productivity/knowledge-graph/layout.js";
import { GraphEngine } from "../projects/productivity/knowledge-graph/graph-engine.js";
import {
  GraphParser,
  parseFrontmatter,
  formatFrontmatter,
  extractHashtags,
  detectCommunities,
  crc32,
  generateZipArchive,
  createVaultZip,
  exportNoteMarkdown,
  CLUSTER_COLORS,
} from "../projects/productivity/knowledge-graph/parser.js";

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

test("parseFrontmatter parses YAML frontmatter key-values, lists, and preserves raw metadata", () => {
  const doc = `---
title: Personal Knowledge Graph
tags: [pkm, graph, obsidian]
aliases:
  - Second Brain
  - PKM
published: true
version: 2
---
# Welcome
This is the body text with [[Notes]].`;

  const parsed = parseFrontmatter(doc);
  assert.equal(parsed.hasFrontmatter, true);
  assert.equal(parsed.frontmatter.title, "Personal Knowledge Graph");
  assert.deepEqual(parsed.frontmatter.tags, ["pkm", "graph", "obsidian"]);
  assert.deepEqual(parsed.frontmatter.aliases, ["Second Brain", "PKM"]);
  assert.equal(parsed.frontmatter.published, true);
  assert.equal(parsed.frontmatter.version, 2);
  assert.ok(parsed.body.includes("# Welcome"));
  assert.ok(parsed.rawFrontmatter.includes("title: Personal Knowledge Graph"));
});

test("parseFrontmatter handles documents without frontmatter gracefully", () => {
  const doc = "Just plain text note without YAML frontmatter.";
  const parsed = parseFrontmatter(doc);
  assert.equal(parsed.hasFrontmatter, false);
  assert.deepEqual(parsed.frontmatter, {});
  assert.equal(parsed.body, doc);
});

test("formatFrontmatter serializes metadata into valid YAML frontmatter block", () => {
  const fm = {
    title: "My Note",
    tags: ["research", "ai"],
    public: true,
  };
  const body = "Note content here.";
  const output = formatFrontmatter(fm, body);
  assert.ok(output.startsWith("---\n"));
  assert.ok(output.includes("title: My Note"));
  assert.ok(output.includes("  - research"));
  assert.ok(output.includes("  - ai"));
  assert.ok(output.includes("public: true"));
  assert.ok(output.endsWith("Note content here."));
});

test("extractHashtags extracts inline hashtags and nested tags while ignoring headings and numbers", () => {
  const markdown = `# Main Heading
This is a note about #pkm and #obsidian/plugins.
Also includes #machine-learning and #123 should be ignored.
Hex color #3b82f6 is not a hashtag.`;

  const tags = extractHashtags(markdown);
  assert.ok(tags.includes("pkm"));
  assert.ok(tags.includes("obsidian/plugins"));
  assert.ok(tags.includes("machine-learning"));
  assert.ok(!tags.includes("123"));
  assert.ok(!tags.includes("Main"));
});

test("GraphParser.parse extracts Obsidian wikilinks with aliases, headers, and indexes bidirectional links", () => {
  const notes = [
    {
      title: "Index",
      content:
        "Link to [[Graph Theory]] and [[Algorithms|Algorithmic Thinking]] and [[Note#Section|Specific Section]].",
    },
    {
      title: "Graph Theory",
      content: "References [[Index]] back.",
    },
    {
      title: "Algorithms",
      content: "Independent note.",
    },
  ];

  const graph = GraphParser.parse(notes);
  assert.equal(graph.nodes.length, 4); // Index, Graph Theory, Algorithms, Note (placeholder)

  const indexNode = graph.nodes.find(n => n.id === "Index");
  const graphTheoryNode = graph.nodes.find(n => n.id === "Graph Theory");
  const algosNode = graph.nodes.find(n => n.id === "Algorithms");
  const noteNode = graph.nodes.find(n => n.id === "Note");

  assert.ok(indexNode);
  assert.ok(graphTheoryNode);
  assert.ok(algosNode);
  assert.ok(noteNode);
  assert.equal(noteNode.isPlaceholder, true);

  // Check outlinks
  assert.deepEqual(
    indexNode.outlinks.sort(),
    ["Algorithms", "Graph Theory", "Note"].sort()
  );
  assert.deepEqual(graphTheoryNode.outlinks, ["Index"]);

  // Check backlinks (bidirectional indexing)
  assert.ok(indexNode.backlinks.includes("Graph Theory"));
  assert.ok(graphTheoryNode.backlinks.includes("Index"));
  assert.ok(algosNode.backlinks.includes("Index"));
  assert.ok(noteNode.backlinks.includes("Index"));

  // Check edges and alias preservation
  const edgeWithAlias = graph.edges.find(
    e => e.source === "Index" && e.target === "Algorithms"
  );
  assert.ok(edgeWithAlias);
  assert.equal(edgeWithAlias.alias, "Algorithmic Thinking");
});

test("detectCommunities clusters interconnected nodes using Louvain modularity", () => {
  // Cluster A: A1, A2, A3 densely interconnected
  // Cluster B: B1, B2, B3 densely interconnected
  const nodes = [
    { id: "A1" },
    { id: "A2" },
    { id: "A3" },
    { id: "B1" },
    { id: "B2" },
    { id: "B3" },
  ];
  const edges = [
    { source: "A1", target: "A2" },
    { source: "A2", target: "A3" },
    { source: "A3", target: "A1" },
    { source: "B1", target: "B2" },
    { source: "B2", target: "B3" },
    { source: "B3", target: "B1" },
  ];

  const { clusters } = detectCommunities(nodes, edges);

  // A1, A2, A3 should share the same clusterId
  const a1 = nodes.find(n => n.id === "A1");
  const a2 = nodes.find(n => n.id === "A2");
  const a3 = nodes.find(n => n.id === "A3");
  assert.equal(a1.clusterId, a2.clusterId);
  assert.equal(a2.clusterId, a3.clusterId);

  // B1, B2, B3 should share the same clusterId
  const b1 = nodes.find(n => n.id === "B1");
  const b2 = nodes.find(n => n.id === "B2");
  const b3 = nodes.find(n => n.id === "B3");
  assert.equal(b1.clusterId, b2.clusterId);
  assert.equal(b2.clusterId, b3.clusterId);

  // Clusters A and B must have different clusterIds
  assert.notEqual(a1.clusterId, b1.clusterId);
  assert.notEqual(a1.clusterColor, b1.clusterColor);
});

test("generateZipArchive produces valid PKZIP format with local headers and central directory", () => {
  const files = [
    { name: "Note1.md", content: "# Note 1\nContent" },
    { name: "Note2.md", content: "# Note 2\n[[Note1]]" },
  ];

  const zipBytes = generateZipArchive(files);
  assert.ok(zipBytes instanceof Uint8Array);
  assert.ok(zipBytes.length > 50);

  // Check PK\x03\x04 signature at offset 0
  const view = new DataView(zipBytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);

  // Check CRC32 calculation
  const crc = crc32("test-data");
  assert.equal(typeof crc, "number");
  assert.ok(crc > 0);
});

test("exportNoteMarkdown preserves frontmatter or synthesizes clean frontmatter", () => {
  const note1 = {
    title: "Existing FM",
    content: "---\ntitle: Existing FM\ntags: [a, b]\n---\nBody text.",
  };
  const out1 = exportNoteMarkdown(note1);
  assert.equal(out1, note1.content);

  const note2 = {
    title: "No FM",
    content: "Simple content.",
    tags: ["tag1"],
  };
  const out2 = exportNoteMarkdown(note2);
  assert.ok(out2.startsWith("---\n"));
  assert.ok(out2.includes("title: No FM"));
  assert.ok(out2.includes("  - tag1"));
  assert.ok(out2.includes("Simple content."));
});

test("GraphEngine searchNotes filters by text, title, and hashtag query", async () => {
  const canvas = createMockCanvas(800, 600);
  const initialNotes = [
    {
      title: "Zettelkasten",
      content:
        "---\ntags: [pkm, methodology]\n---\nSlip box note taking.",
    },
    {
      title: "Obsidian",
      content: "Markdown knowledge graph #pkm #tools.",
    },
    { title: "Cooking", content: "Recipe for pasta." },
  ];
  const storage = createMockStorage(initialNotes);
  const engine = new GraphEngine(canvas, storage);
  await engine.loadData();

  assert.equal(engine.nodes.length, 3);

  // Text search "pasta"
  const pastaMatches = engine.searchNotes("pasta");
  assert.deepEqual(pastaMatches, ["Cooking"]);
  assert.ok(engine.searchResults.has("Cooking"));
  assert.equal(engine.searchResults.size, 1);

  // Hashtag search "#pkm"
  const pkmMatches = engine.searchNotes("#pkm");
  assert.equal(pkmMatches.length, 2);
  assert.ok(pkmMatches.includes("Zettelkasten"));
  assert.ok(pkmMatches.includes("Obsidian"));

  // Clear search
  const emptyMatches = engine.searchNotes("");
  assert.equal(emptyMatches.length, 0);
  assert.equal(engine.searchResults.size, 0);
});

test("GraphEngine toggleClusterColors toggles community coloring state", () => {
  const canvas = createMockCanvas(800, 600);
  const storage = createMockStorage();
  const engine = new GraphEngine(canvas, storage);

  assert.equal(engine.useClusterColors, true);
  const switchedOff = engine.toggleClusterColors();
  assert.equal(switchedOff, false);
  assert.equal(engine.useClusterColors, false);

  const switchedOn = engine.toggleClusterColors();
  assert.equal(switchedOn, true);
  assert.equal(engine.useClusterColors, true);
});

test("GraphEngine focusNode centers viewport transform on target node coordinates", () => {
  const canvas = createMockCanvas(800, 600);
  const storage = createMockStorage();
  const engine = new GraphEngine(canvas, storage);

  const target = {
    id: "TargetNode",
    label: "TargetNode",
    x: 100,
    y: -50,
    vx: 0,
    vy: 0,
  };
  engine.nodes = [target];

  // In Node environment without requestAnimationFrame, focusNode sets transform directly
  engine.focusNode("TargetNode", 2.0);

  // Expected transform: canvas center (400, 300) minus target * zoom (100 * 2, -50 * 2) = (400 - 200, 300 - (-100)) = (200, 400), k = 2.0
  assert.equal(engine.transform.x, 200);
  assert.equal(engine.transform.y, 400);
  assert.equal(engine.transform.k, 2.0);
  assert.equal(engine.focusedNodeId, "TargetNode");
});

