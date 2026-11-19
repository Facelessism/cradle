/**
 * graphLogic.js
 * Pure graph algorithms — no DOM access, works identically in the browser
 * and in Node.js test environments.
 *
 * Supported algorithms:
 *   - Breadth-First Search (BFS)
 *   - Depth-First Search (DFS)
 *   - Prim's Minimum Spanning Tree (MST)
 *   - Kruskal's Minimum Spanning Tree (MST) with Disjoint Set Union
 *   - Dijkstra's Shortest Path
 *   - Kahn's Algorithm (Topological Sorting)
 *   - Tarjan's Algorithm (Strongly Connected Components - SCC)
 *
 * Import / Export formats:
 *   - Adjacency Matrix
 *   - Edge List
 *   - JSON
 */

/**
 * Disjoint Set Union (Union-Find) with path compression and rank optimization.
 */
class DisjointSet {
  constructor(elements) {
    this.parent = new Map();
    this.rank = new Map();
    for (const el of elements) {
      this.parent.set(el, el);
      this.rank.set(el, 0);
    }
  }

  find(item) {
    if (!this.parent.has(item)) {
      this.parent.set(item, item);
      this.rank.set(item, 0);
      return item;
    }
    if (this.parent.get(item) !== item) {
      this.parent.set(item, this.find(this.parent.get(item)));
    }
    return this.parent.get(item);
  }

  union(a, b) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;

    const rankA = this.rank.get(rootA);
    const rankB = this.rank.get(rootB);
    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
    return true;
  }
}

/**
 * Builds an adjacency list from nodes and edges.
 *
 * @param {Array<{id: string}>} nodes
 * @param {Array<{from: string, to: string, weight?: number}>} edges
 * @param {boolean} [directed=false]
 * @returns {Map<string, Array<{to: string, weight: number}>>}
 */
function buildAdjacency(nodes, edges, directed = false) {
  const adj = new Map();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    const weight = edge.weight ?? 1;
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    if (!adj.has(edge.to)) adj.set(edge.to, []);
    adj.get(edge.from).push({ to: edge.to, weight });
    if (!directed) {
      adj.get(edge.to).push({ to: edge.from, weight });
    }
  }
  return adj;
}

/**
 * Breadth-First Search (BFS)
 */
function bfs(nodes, edges, startId, directed = false) {
  const adj = buildAdjacency(nodes, edges, directed);
  const steps = [];
  const visited = new Set([startId]);
  const queue = [startId];

  steps.push({
    type: "visit",
    node: startId,
    openSet: [...queue],
    closedSet: Array.from(visited),
    description: `Start BFS from node ${startId}.`,
  });

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = (adj.get(current) || [])
      .slice()
      .sort((a, b) => a.to.localeCompare(b.to));

    for (const { to } of neighbors) {
      if (!visited.has(to)) {
        visited.add(to);
        queue.push(to);
        steps.push({
          type: "frontier-edge",
          edge: { from: current, to },
          openSet: [...queue],
          closedSet: Array.from(visited),
          description: `Traverse edge ${current} → ${to} and discover node ${to}.`,
        });
        steps.push({
          type: "visit",
          node: to,
          openSet: [...queue],
          closedSet: Array.from(visited),
          description: `Enqueue and mark node ${to} as visited.`,
        });
      }
    }
  }
  return steps;
}

const MAX_DFS_DEPTH = 1000;

/**
 * Depth-First Search (DFS)
 */
function dfs(nodes, edges, startId, maxDepth = MAX_DFS_DEPTH, directed = false) {
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !startId) {
    return [];
  }
  const adj = buildAdjacency(nodes, edges, directed);
  const steps = [];
  const visited = new Set();
  const callStack = [];

  function visit(nodeId, parent, depth = 0) {
    if (depth >= maxDepth) return;
    visited.add(nodeId);
    callStack.push(nodeId);

    if (parent) {
      steps.push({
        type: "frontier-edge",
        edge: { from: parent, to: nodeId },
        openSet: [...callStack],
        closedSet: Array.from(visited),
        description: `Explore branch ${parent} → ${nodeId}.`,
      });
    }
    steps.push({
      type: "visit",
      node: nodeId,
      openSet: [...callStack],
      closedSet: Array.from(visited),
      description: `Visit node ${nodeId} at depth ${depth}.`,
    });

    const neighbors = (adj.get(nodeId) || [])
      .slice()
      .sort((a, b) => a.to.localeCompare(b.to));

    for (const { to } of neighbors) {
      if (!visited.has(to)) visit(to, nodeId, depth + 1);
    }
    callStack.pop();
  }

  visit(startId, null, 0);
  return steps;
}

/**
 * Prim's Minimum Spanning Tree (MST)
 */
function primMST(nodes, edges, startId) {
  const adj = buildAdjacency(nodes, edges, false);
  const start = startId || (nodes[0] && nodes[0].id);
  const steps = [];
  const inTree = new Set();
  const mstEdges = [];
  let totalWeight = 0;

  if (!start) return { steps, totalWeight, mstEdges };

  inTree.add(start);
  steps.push({
    type: "visit",
    node: start,
    openSet: [],
    closedSet: Array.from(inTree),
    description: `Initialize Prim's MST starting with node ${start}.`,
  });

  while (inTree.size < nodes.length) {
    let best = null;
    const frontierCandidates = [];

    for (const from of inTree) {
      for (const { to, weight } of adj.get(from) || []) {
        if (!inTree.has(to)) {
          frontierCandidates.push({ from, to, weight });
          if (
            !best ||
            weight < best.weight ||
            (weight === best.weight &&
              `${from}${to}` < `${best.from}${best.to}`)
          ) {
            best = { from, to, weight };
          }
        }
      }
    }

    if (!best) break;

    inTree.add(best.to);
    mstEdges.push(best);
    totalWeight += best.weight;

    steps.push({
      type: "tree-edge",
      edge: best,
      openSet: frontierCandidates.map(e => `${e.from}-${e.to}(${e.weight})`),
      closedSet: Array.from(inTree),
      description: `Select minimum cut edge ${best.from} — ${best.to} (weight ${best.weight}) for the MST.`,
    });
    steps.push({
      type: "visit",
      node: best.to,
      openSet: frontierCandidates.map(e => `${e.from}-${e.to}(${e.weight})`),
      closedSet: Array.from(inTree),
      description: `Add node ${best.to} to the MST tree.`,
    });
  }

  return { steps, totalWeight, mstEdges };
}

/**
 * Kruskal's Minimum Spanning Tree (MST)
 * Uses Disjoint Set Union (DSU) to greedily add minimum-weight non-cyclic edges.
 */
function kruskalMST(nodes, edges) {
  const nodeIds = nodes.map(n => n.id);
  const dsu = new DisjointSet(nodeIds);
  const steps = [];
  const mstEdges = [];
  let totalWeight = 0;
  let rejectedEdgesCount = 0;

  // Deduplicate undirected edges
  const uniqueEdgesMap = new Map();
  for (const e of edges) {
    const key = [e.from, e.to].sort().join("—");
    const weight = Number(e.weight) || 1;
    if (!uniqueEdgesMap.has(key) || weight < uniqueEdgesMap.get(key).weight) {
      uniqueEdgesMap.set(key, { from: e.from, to: e.to, weight });
    }
  }

  const sortedEdges = Array.from(uniqueEdgesMap.values()).sort((a, b) => {
    if (a.weight !== b.weight) return a.weight - b.weight;
    const keyA = `${a.from}-${a.to}`;
    const keyB = `${b.from}-${b.to}`;
    return keyA.localeCompare(keyB);
  });

  steps.push({
    type: "info",
    openSet: sortedEdges.map(e => `${e.from}-${e.to}(${e.weight})`),
    closedSet: [],
    description: `Sorted ${sortedEdges.length} candidate edges by weight. Initialized Disjoint Sets.`,
  });

  for (const edge of sortedEdges) {
    const rootU = dsu.find(edge.from);
    const rootV = dsu.find(edge.to);

    if (rootU !== rootV) {
      dsu.union(edge.from, edge.to);
      mstEdges.push(edge);
      totalWeight += edge.weight;

      steps.push({
        type: "tree-edge",
        edge,
        openSet: sortedEdges.slice(mstEdges.length).map(e => `${e.from}-${e.to}`),
        closedSet: mstEdges.map(e => `${e.from}-${e.to}(${e.weight})`),
        description: `Edge ${edge.from} — ${edge.to} (wt ${edge.weight}) connects distinct components [${rootU}] and [${rootV}]. Accepted into MST.`,
      });

      if (mstEdges.length === nodeIds.length - 1) {
        break;
      }
    } else {
      rejectedEdgesCount++;
      steps.push({
        type: "reject-edge",
        edge,
        openSet: sortedEdges.slice(mstEdges.length).map(e => `${e.from}-${e.to}`),
        closedSet: mstEdges.map(e => `${e.from}-${e.to}(${e.weight})`),
        description: `Edge ${edge.from} — ${edge.to} rejected: both endpoints are already in component [${rootU}] (cycle avoided).`,
      });
    }
  }

  const isSpanning = nodeIds.length === 0 || mstEdges.length === nodeIds.length - 1;
  return {
    steps,
    totalWeight,
    mstEdges,
    isSpanning,
    rejectedEdgesCount,
  };
}

/**
 * Dijkstra's Shortest Path Algorithm
 */
function dijkstra(nodes, edges, startId, endId, directed = false) {
  const adj = buildAdjacency(nodes, edges, directed);
  const dist = new Map(nodes.map(n => [n.id, Infinity]));
  const prev = new Map();
  const settled = new Set();
  const steps = [];

  if (!startId || !nodes.some(n => n.id === startId)) {
    return { steps: [], distances: {}, path: [] };
  }

  dist.set(startId, 0);

  steps.push({
    type: "info",
    node: startId,
    openSet: [startId],
    closedSet: [],
    stateTable: Object.fromEntries(dist),
    description: `Set distance of start node ${startId} to 0; all other nodes to ∞.`,
  });

  while (settled.size < nodes.length) {
    let current = null;
    let currentDist = Infinity;
    for (const [id, d] of dist) {
      if (!settled.has(id) && d < currentDist) {
        current = id;
        currentDist = d;
      }
    }
    if (current === null || currentDist === Infinity) break;

    settled.add(current);
    steps.push({
      type: "settle",
      node: current,
      openSet: Array.from(dist.entries())
        .filter(([id, d]) => !settled.has(id) && d !== Infinity)
        .map(([id, d]) => `${id}:${d}`),
      closedSet: Array.from(settled),
      stateTable: Object.fromEntries(dist),
      description: `Settled node ${current} with shortest distance ${currentDist}.`,
    });

    if (current === endId) break;

    for (const { to, weight } of adj.get(current) || []) {
      if (settled.has(to)) continue;
      const candidate = currentDist + weight;
      if (candidate < dist.get(to)) {
        dist.set(to, candidate);
        prev.set(to, current);
        steps.push({
          type: "relax",
          edge: { from: current, to, weight },
          node: to,
          openSet: Array.from(dist.entries())
            .filter(([id, d]) => !settled.has(id) && d !== Infinity)
            .map(([id, d]) => `${id}:${d}`),
          closedSet: Array.from(settled),
          stateTable: Object.fromEntries(dist),
          description: `Relaxed edge ${current} → ${to}: updated dist[${to}] = ${candidate} via ${current}.`,
        });
      }
    }
  }

  const path = [];
  if (endId !== undefined && dist.get(endId) !== Infinity) {
    let cur = endId;
    while (cur !== undefined) {
      path.unshift(cur);
      cur = prev.get(cur);
    }
  }

  const distances = {};
  for (const [id, d] of dist) distances[id] = d;

  return { steps, distances, path };
}

/**
 * Kahn's Algorithm for Topological Sorting (Directed Acyclic Graphs)
 */
function kahnTopologicalSort(nodes, edges) {
  const adj = new Map();
  const inDegree = new Map();
  const steps = [];

  for (const node of nodes) {
    adj.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    if (!inDegree.has(edge.to)) inDegree.set(edge.to, 0);
    adj.get(edge.from).push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  // Queue nodes with in-degree 0, sorted alphabetically
  const queue = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }
  queue.sort();

  steps.push({
    type: "info",
    openSet: [...queue],
    closedSet: [],
    stateTable: Object.fromEntries(inDegree),
    description: `Computed in-degrees for all nodes. Nodes with in-degree 0: [${queue.join(", ")}].`,
  });

  const order = [];

  while (queue.length > 0) {
    const current = queue.shift();
    order.push(current);

    steps.push({
      type: "visit",
      node: current,
      openSet: [...queue],
      closedSet: [...order],
      stateTable: Object.fromEntries(inDegree),
      description: `Extracted node ${current} with in-degree 0 and appended to topological order.`,
    });

    const neighbors = (adj.get(current) || []).slice().sort();
    for (const neighbor of neighbors) {
      const newDeg = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDeg);

      steps.push({
        type: "relax",
        edge: { from: current, to: neighbor },
        node: neighbor,
        openSet: [...queue],
        closedSet: [...order],
        stateTable: Object.fromEntries(inDegree),
        description: `Decremented in-degree of neighbor ${neighbor} to ${newDeg}.`,
      });

      if (newDeg === 0) {
        queue.push(neighbor);
        queue.sort();
        steps.push({
          type: "enqueue",
          node: neighbor,
          openSet: [...queue],
          closedSet: [...order],
          stateTable: Object.fromEntries(inDegree),
          description: `Node ${neighbor} reached in-degree 0. Added to candidate queue.`,
        });
      }
    }
  }

  const isDAG = order.length === nodes.length;
  return {
    steps,
    order,
    isDAG,
    inDegrees: Object.fromEntries(inDegree),
  };
}

/**
 * Tarjan's Strongly Connected Components (SCC) Algorithm
 */
function tarjanSCC(nodes, edges) {
  const adj = new Map();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from).push(edge.to);
  }

  let timer = 0;
  const disc = new Map();
  const low = new Map();
  const inStack = new Set();
  const stack = [];
  const sccList = [];
  const steps = [];

  function dfsTarjan(u) {
    timer++;
    disc.set(u, timer);
    low.set(u, timer);
    stack.push(u);
    inStack.add(u);

    steps.push({
      type: "visit",
      node: u,
      openSet: [...stack],
      closedSet: sccList.flat(),
      stateTable: {
        disc: Object.fromEntries(disc),
        low: Object.fromEntries(low),
      },
      description: `Discovered node ${u}: assigned disc=${timer}, low=${timer}. Pushed to active DFS stack.`,
    });

    const neighbors = (adj.get(u) || []).slice().sort();
    for (const v of neighbors) {
      if (!disc.has(v)) {
        steps.push({
          type: "frontier-edge",
          edge: { from: u, to: v },
          openSet: [...stack],
          closedSet: sccList.flat(),
          description: `Tree edge ${u} → ${v}: exploring unvisited node ${v}.`,
        });

        dfsTarjan(v);

        low.set(u, Math.min(low.get(u), low.get(v)));
        steps.push({
          type: "relax",
          node: u,
          edge: { from: u, to: v },
          openSet: [...stack],
          closedSet: sccList.flat(),
          stateTable: {
            disc: Object.fromEntries(disc),
            low: Object.fromEntries(low),
          },
          description: `Backtracked to ${u}: updated low[${u}] = min(low[${u}], low[${v}]) = ${low.get(u)}.`,
        });
      } else if (inStack.has(v)) {
        low.set(u, Math.min(low.get(u), disc.get(v)));
        steps.push({
          type: "back-edge",
          edge: { from: u, to: v },
          node: u,
          openSet: [...stack],
          closedSet: sccList.flat(),
          stateTable: {
            disc: Object.fromEntries(disc),
            low: Object.fromEntries(low),
          },
          description: `Back edge ${u} → ${v} to stack node: updated low[${u}] = min(low[${u}], disc[${v}]) = ${low.get(u)}.`,
        });
      }
    }

    // Root of SCC found
    if (low.get(u) === disc.get(u)) {
      const scc = [];
      let w = null;
      while (w !== u) {
        w = stack.pop();
        inStack.delete(w);
        scc.push(w);
      }
      sccList.push(scc);
      steps.push({
        type: "scc-found",
        node: u,
        component: scc,
        openSet: [...stack],
        closedSet: sccList.flat(),
        stateTable: {
          disc: Object.fromEntries(disc),
          low: Object.fromEntries(low),
        },
        description: `Root node ${u} (low==disc==${disc.get(u)}): popped Strongly Connected Component [${scc.join(", ")}].`,
      });
    }
  }

  // Iterate over all nodes sorted by ID
  const sortedNodes = nodes.slice().sort((a, b) => a.id.localeCompare(b.id));
  for (const node of sortedNodes) {
    if (!disc.has(node.id)) {
      dfsTarjan(node.id);
    }
  }

  return {
    steps,
    components: sccList,
    sccCount: sccList.length,
  };
}

// ===================== IMPORT / EXPORT UTILITIES =====================

/**
 * Exports graph as an Adjacency Matrix CSV.
 */
function exportAdjacencyMatrix(nodes, edges, directed = false) {
  const sorted = nodes.slice().sort((a, b) => a.id.localeCompare(b.id));
  const ids = sorted.map(n => n.id);
  const matrix = Array.from({ length: ids.length }, () =>
    Array(ids.length).fill(0)
  );

  const idToIndex = new Map(ids.map((id, i) => [id, i]));

  for (const e of edges) {
    const i = idToIndex.get(e.from);
    const j = idToIndex.get(e.to);
    if (i !== undefined && j !== undefined) {
      const w = Number(e.weight) || 1;
      matrix[i][j] = w;
      if (!directed) matrix[j][i] = w;
    }
  }

  const header = ["", ...ids].join(",");
  const rows = ids.map((id, i) => [id, ...matrix[i]].join(","));
  return [header, ...rows].join("\n");
}

/**
 * Imports an Adjacency Matrix CSV/space-separated string into nodes and edges.
 */
function importAdjacencyMatrix(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("#"));

  if (lines.length === 0) return { nodes: [], edges: [] };

  const firstTokens = lines[0].split(/[,\s]+/).filter(t => t.length > 0);
  let headers = [];
  let startRow = 0;

  // Determine if line 0 has node headers
  const isHeaderRow = Number.isNaN(Number(firstTokens[firstTokens.length - 1]));
  if (isHeaderRow) {
    headers = firstTokens;
    startRow = 1;
  } else {
    headers = lines.map((_, i) => String.fromCharCode(65 + i));
    startRow = 0;
  }

  const nodes = headers.map((id, idx) => {
    const angle = (2 * Math.PI * idx) / headers.length - Math.PI / 2;
    return {
      id,
      x: Math.round(450 + 200 * Math.cos(angle)),
      y: Math.round(280 + 200 * Math.sin(angle)),
    };
  });

  const edges = [];
  for (let r = startRow; r < lines.length; r++) {
    const tokens = lines[r].split(/[,\s]+/).filter(t => t.length > 0);
    const fromIdx = r - startRow;
    const fromId = headers[fromIdx] || String.fromCharCode(65 + fromIdx);

    const values = isHeaderRow ? tokens.slice(1) : tokens;
    for (let c = 0; c < values.length; c++) {
      const val = Number(values[c]);
      if (val > 0 && c < headers.length) {
        const toId = headers[c];
        edges.push({ from: fromId, to: toId, weight: val });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Exports graph as an Edge List string.
 */
function exportEdgeList(nodes, edges, directed = false) {
  const lines = [];
  lines.push(`# Edge List (${directed ? "Directed" : "Undirected"})`);
  lines.push(`# Format: from to [weight]`);
  for (const e of edges) {
    lines.push(`${e.from} ${e.to} ${e.weight ?? 1}`);
  }
  // List isolated nodes if any
  const connectedNodes = new Set();
  for (const e of edges) {
    connectedNodes.add(e.from);
    connectedNodes.add(e.to);
  }
  const isolated = nodes.filter(n => !connectedNodes.has(n.id));
  if (isolated.length > 0) {
    lines.push(`# Isolated nodes: ${isolated.map(n => n.id).join(" ")}`);
  }
  return lines.join("\n");
}

/**
 * Imports an Edge List string into nodes and edges.
 */
function importEdgeList(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const nodeMap = new Map();
  const edges = [];

  for (const line of lines) {
    if (line.startsWith("#")) {
      const isolatedMatch = line.match(/Isolated nodes:\s*(.*)/i);
      if (isolatedMatch) {
        const ids = isolatedMatch[1].split(/\s+/).filter(Boolean);
        for (const id of ids) {
          if (!nodeMap.has(id)) nodeMap.set(id, true);
        }
      }
      continue;
    }

    const parts = line.split(/[,\s]+/).filter(Boolean);
    if (parts.length >= 2) {
      const from = parts[0];
      const to = parts[1];
      const weight = parts[2] !== undefined ? Number(parts[2]) : 1;
      nodeMap.set(from, true);
      nodeMap.set(to, true);
      edges.push({
        from,
        to,
        weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
      });
    }
  }

  const ids = Array.from(nodeMap.keys()).sort();
  const count = ids.length;
  const nodes = ids.map((id, idx) => {
    const angle = (2 * Math.PI * idx) / (count || 1) - Math.PI / 2;
    return {
      id,
      x: Math.round(450 + 200 * Math.cos(angle)),
      y: Math.round(280 + 200 * Math.sin(angle)),
    };
  });

  return { nodes, edges };
}

/**
 * Exports graph as a JSON string.
 */
function exportJSON(nodes, edges, options = {}) {
  const payload = {
    version: "2.0",
    directed: Boolean(options.directed),
    nodes: nodes.map(n => ({ id: n.id, x: n.x, y: n.y })),
    edges: edges.map(e => ({
      from: e.from,
      to: e.to,
      weight: Number(e.weight) || 1,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Imports a JSON string into nodes and edges.
 */
function importJSON(jsonText) {
  const data = JSON.parse(jsonText);
  if (!data || !Array.isArray(data.nodes)) {
    throw new Error("Invalid graph JSON: 'nodes' array required.");
  }

  const nodes = data.nodes.map((n, i) => ({
    id: String(n.id || String.fromCharCode(65 + i)),
    x: Number(n.x) || 100 + (i % 6) * 120,
    y: Number(n.y) || 100 + Math.floor(i / 6) * 120,
  }));

  const edges = Array.isArray(data.edges)
    ? data.edges.map(e => ({
        from: String(e.from),
        to: String(e.to),
        weight: Number(e.weight) || 1,
      }))
    : [];

  return {
    nodes,
    edges,
    directed: Boolean(data.directed),
  };
}

if (typeof window !== "undefined") {
  window.GraphLogic = {
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
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
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
  };
}
