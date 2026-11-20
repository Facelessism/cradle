const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAdjacency,
  bfs,
  dfs,
  primMST,
  kruskalMST,
  dijkstra,
  kahnTopologicalSort,
  tarjanSCC,
  exportAdjacencyMatrix,
  importAdjacencyMatrix,
  exportEdgeList,
  importEdgeList,
  exportJSON,
  importJSON,
} = require("../projects/math/graph-theory-explorer/graphLogic");

// Small fixed graph used across tests:
//
//     A --1-- B
//     |       |
//     4       2
//     |       |
//     C --1-- D
//
const nodes = [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }];
const edges = [
  { from: "A", to: "B", weight: 1 },
  { from: "A", to: "C", weight: 4 },
  { from: "B", to: "D", weight: 2 },
  { from: "C", to: "D", weight: 1 },
];

test("buildAdjacency creates an undirected adjacency list", () => {
  const adj = buildAdjacency(nodes, edges);
  assert.equal(adj.get("A").length, 2);
  assert.ok(adj.get("B").some(e => e.to === "A"));
  assert.ok(adj.get("A").some(e => e.to === "B"));
});

test("bfs visits every reachable node starting from A", () => {
  const steps = bfs(nodes, edges, "A");
  const visitedOrder = steps.filter(s => s.type === "visit").map(s => s.node);
  assert.deepStrictEqual(visitedOrder, ["A", "B", "C", "D"]);
});

test("dfs visits every reachable node starting from A", () => {
  const steps = dfs(nodes, edges, "A");
  const visitedOrder = steps.filter(s => s.type === "visit").map(s => s.node);
  assert.deepStrictEqual(visitedOrder, ["A", "B", "D", "C"]);
});

test("primMST finds a minimum spanning tree with correct total weight", () => {
  const { mstEdges, totalWeight } = primMST(nodes, edges, "A");
  assert.equal(mstEdges.length, 3);
  assert.equal(totalWeight, 4);
});

test("dijkstra finds the shortest path and distance from A to D", () => {
  const { distances, path } = dijkstra(nodes, edges, "A", "D");
  assert.equal(distances.D, 3);
  assert.deepStrictEqual(path, ["A", "B", "D"]);
});

test("dijkstra reports Infinity for unreachable nodes", () => {
  const isolatedNodes = [{ id: "X" }, { id: "Y" }];
  const isolatedEdges = [];
  const { distances, path } = dijkstra(isolatedNodes, isolatedEdges, "X", "Y");
  assert.equal(distances.Y, Infinity);
  assert.deepStrictEqual(path, []);
});

test("kruskalMST finds minimum spanning tree and identifies cycle-forming edges", () => {
  const { mstEdges, totalWeight, isSpanning, rejectedEdgesCount } = kruskalMST(
    nodes,
    edges
  );
  assert.equal(mstEdges.length, 3);
  assert.equal(totalWeight, 4);
  assert.equal(isSpanning, true);
  assert.equal(rejectedEdgesCount, 1);
});

test("kahnTopologicalSort produces valid ordering for DAG and detects cycles", () => {
  const dagNodes = [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }];
  const dagEdges = [
    { from: "A", to: "B", weight: 1 },
    { from: "A", to: "C", weight: 1 },
    { from: "B", to: "D", weight: 1 },
    { from: "C", to: "D", weight: 1 },
  ];

  const dagResult = kahnTopologicalSort(dagNodes, dagEdges);
  assert.equal(dagResult.isDAG, true);
  assert.equal(dagResult.order.length, 4);
  assert.ok(dagResult.order.indexOf("A") < dagResult.order.indexOf("B"));
  assert.ok(dagResult.order.indexOf("A") < dagResult.order.indexOf("C"));
  assert.ok(dagResult.order.indexOf("B") < dagResult.order.indexOf("D"));
  assert.ok(dagResult.order.indexOf("C") < dagResult.order.indexOf("D"));

  // Cyclic graph test
  const cyclicNodes = [{ id: "X" }, { id: "Y" }, { id: "Z" }];
  const cyclicEdges = [
    { from: "X", to: "Y", weight: 1 },
    { from: "Y", to: "Z", weight: 1 },
    { from: "Z", to: "X", weight: 1 },
  ];
  const cyclicResult = kahnTopologicalSort(cyclicNodes, cyclicEdges);
  assert.equal(cyclicResult.isDAG, false);
});

test("tarjanSCC detects strongly connected components in directed graphs", () => {
  // Graph: Cycle A -> B -> C -> A, with C -> D (D is its own SCC)
  const sccNodes = [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }];
  const sccEdges = [
    { from: "A", to: "B", weight: 1 },
    { from: "B", to: "C", weight: 1 },
    { from: "C", to: "A", weight: 1 },
    { from: "C", to: "D", weight: 1 },
  ];

  const result = tarjanSCC(sccNodes, sccEdges);
  assert.equal(result.sccCount, 2);
  const cycleSCC = result.components.find(c => c.length === 3);
  const singleSCC = result.components.find(c => c.length === 1);
  assert.ok(cycleSCC);
  assert.ok(cycleSCC.includes("A") && cycleSCC.includes("B") && cycleSCC.includes("C"));
  assert.deepStrictEqual(singleSCC, ["D"]);
});

test("exportAdjacencyMatrix and importAdjacencyMatrix round-trip correctly", () => {
  const csv = exportAdjacencyMatrix(nodes, edges, false);
  assert.match(csv, /A,B,C,D/);

  const imported = importAdjacencyMatrix(csv);
  assert.equal(imported.nodes.length, 4);
  assert.ok(imported.edges.length >= 4);
  const hasAB = imported.edges.some(
    e => (e.from === "A" && e.to === "B" && e.weight === 1) ||
         (e.from === "B" && e.to === "A" && e.weight === 1)
  );
  assert.ok(hasAB);
});

test("exportEdgeList and importEdgeList round-trip correctly", () => {
  const edgeListText = exportEdgeList(nodes, edges, false);
  assert.match(edgeListText, /A B 1/);
  assert.match(edgeListText, /C D 1/);

  const imported = importEdgeList(edgeListText);
  assert.equal(imported.nodes.length, 4);
  assert.equal(imported.edges.length, 4);
});

test("exportJSON and importJSON serialize and parse graph schema", () => {
  const jsonStr = exportJSON(nodes, edges, { directed: true });
  assert.match(jsonStr, /"version": "2.0"/);

  const imported = importJSON(jsonStr);
  assert.equal(imported.directed, true);
  assert.equal(imported.nodes.length, 4);
  assert.equal(imported.edges.length, 4);
});

/* ------------------------------------------------------------------ */
/* Algorithm Playback Steps & Intermediate Telemetry                  */
/* ------------------------------------------------------------------ */

test("algorithm step sequences contain valid step metadata for animated playback", () => {
  const bfsSteps = bfs(nodes, edges, "A");
  assert.ok(bfsSteps.length > 0);
  for (const step of bfsSteps) {
    assert.ok(step.type);
    assert.ok(step.description);
    assert.ok(Array.isArray(step.openSet));
    assert.ok(Array.isArray(step.closedSet));
  }

  const dijkstraRes = dijkstra(nodes, edges, "A", "D");
  assert.ok(dijkstraRes.steps.length > 0);
  const relaxSteps = dijkstraRes.steps.filter(s => s.type === "relax");
  assert.ok(relaxSteps.length > 0);
  for (const step of relaxSteps) {
    assert.ok(step.edge);
    assert.ok(step.stateTable);
  }

  const kruskalRes = kruskalMST(nodes, edges);
  assert.ok(kruskalRes.steps.length > 0);
  const treeSteps = kruskalRes.steps.filter(s => s.type === "tree-edge");
  const rejectSteps = kruskalRes.steps.filter(s => s.type === "reject-edge");
  assert.equal(treeSteps.length, 3);
  assert.equal(rejectSteps.length, 1);

  const topoRes = kahnTopologicalSort(nodes, edges);
  assert.ok(topoRes.steps.length > 0);
  for (const step of topoRes.steps) {
    assert.ok(step.stateTable);
  }

  const sccRes = tarjanSCC(nodes, edges);
  assert.ok(sccRes.steps.length > 0);
  const visitSteps = sccRes.steps.filter(s => s.type === "visit");
  assert.ok(visitSteps.length > 0);
  for (const step of visitSteps) {
    assert.ok(step.stateTable.disc);
    assert.ok(step.stateTable.low);
  }
});
