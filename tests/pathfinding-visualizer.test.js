const test = require("node:test");
const assert = require("node:assert");

// Import algorithms
const algorithms = require("../projects/math/pathfinding-visualizer/algorithms.js");
const {
  bfs,
  dijkstra,
  astar,
  bidirectionalDijkstra,
  bidirectionalAstar,
  heuristics,
  calculateHeuristic,
  getNeighbors,
  getNodesInShortestPathOrder,
} = algorithms;

function createMockGrid(rows, cols) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        r,
        c,
        isWall: false,
        isStart: r === 0 && c === 0,
        isEnd: r === rows - 1 && c === cols - 1,
        element: {
          classList: {
            classes: new Set(),
            add(cls) {
              this.classes.add(cls);
            },
            remove(...clss) {
              for (const cls of clss) this.classes.delete(cls);
            },
            contains(cls) {
              return this.classes.has(cls);
            },
          },
        },
        distance: Infinity,
        totalDistance: Infinity,
        heuristic: 0,
        previousNode: null,
        isVisited: false,
      });
    }
    grid.push(row);
  }
  return grid;
}

test("BFS finds the shortest path on an unweighted grid", () => {
  const grid = createMockGrid(5, 5);
  const start = grid[0][0];
  const end = grid[4][4];

  const result = bfs(grid, start, end);
  assert.ok(result.visitedNodesInOrder.length > 0);
  assert.ok(result.shortestPathNodes.length > 0);
  assert.strictEqual(result.shortestPathNodes[0], start);
  assert.strictEqual(
    result.shortestPathNodes[result.shortestPathNodes.length - 1],
    end
  );
  // Manhattan distance is 8 steps (length 9 including start)
  assert.strictEqual(result.shortestPathNodes.length, 9);
});

test("A* navigates around walls to find shortest path", () => {
  const grid = createMockGrid(5, 5);
  const start = grid[0][0];
  const end = grid[2][0];

  // Block direct downward route
  grid[1][0].isWall = true;

  const result = astar(grid, start, end);
  assert.ok(result.shortestPathNodes.length > 0);
  assert.strictEqual(result.shortestPathNodes.includes(grid[1][0]), false);
  assert.strictEqual(result.shortestPathNodes[0], start);
  assert.strictEqual(
    result.shortestPathNodes[result.shortestPathNodes.length - 1],
    end
  );
});

test("Dijkstra reports no path when target is completely enclosed by walls", () => {
  const grid = createMockGrid(5, 5);
  const start = grid[0][0];
  const end = grid[2][2];

  // Enclose end node
  grid[1][2].isWall = true;
  grid[3][2].isWall = true;
  grid[2][1].isWall = true;
  grid[2][3].isWall = true;

  const result = dijkstra(grid, start, end);
  assert.strictEqual(result.shortestPathNodes.length, 0);
});

test("clearWalls, clearPath, and clearBoard reset grid states accurately", () => {
  const grid = createMockGrid(3, 3);

  // Set walls and path states
  grid[0][1].isWall = true;
  grid[0][1].element.classList.add("wall");
  grid[1][1].isVisited = true;
  grid[1][1].distance = 2;
  grid[1][1].element.classList.add("visited");
  grid[2][2].element.classList.add("path");

  // Helper simulating Grid clear methods
  function clearWalls(g) {
    for (const row of g) {
      for (const node of row) {
        node.isWall = false;
        node.element.classList.remove("wall");
      }
    }
  }

  function clearPath(g) {
    for (const row of g) {
      for (const node of row) {
        node.isVisited = false;
        node.previousNode = null;
        node.distance = Infinity;
        node.totalDistance = Infinity;
        node.heuristic = 0;
        node.element.classList.remove("visited", "path");
      }
    }
  }

  function clearBoard(g) {
    clearWalls(g);
    clearPath(g);
  }

  // Test clearWalls only
  clearWalls(grid);
  assert.strictEqual(grid[0][1].isWall, false);
  assert.strictEqual(grid[0][1].element.classList.contains("wall"), false);
  // Visited and path remain
  assert.strictEqual(grid[1][1].isVisited, true);
  assert.strictEqual(grid[1][1].element.classList.contains("visited"), true);

  // Test clearBoard clears everything
  clearBoard(grid);
  assert.strictEqual(grid[1][1].isVisited, false);
  assert.strictEqual(grid[1][1].distance, Infinity);
  assert.strictEqual(grid[1][1].element.classList.contains("visited"), false);
  assert.strictEqual(grid[2][2].element.classList.contains("path"), false);
});

test("clearBoard completely resets path and visited overlays after running visualization", () => {
  const grid = createMockGrid(6, 6);
  const start = grid[0][0];
  const end = grid[5][5];

  // User places walls
  grid[0][2].isWall = true;
  grid[0][2].element.classList.add("wall");
  grid[1][2].isWall = true;
  grid[1][2].element.classList.add("wall");
  grid[2][2].isWall = true;
  grid[2][2].element.classList.add("wall");

  // Run BFS visualization
  const result = bfs(grid, start, end);
  assert.ok(result.shortestPathNodes.length > 0);

  // Simulate applying animation classes
  for (const node of result.visitedNodesInOrder) {
    if (!node.isStart && !node.isEnd) {
      node.isVisited = true;
      node.element.classList.add("visited");
    }
  }
  for (const node of result.shortestPathNodes) {
    if (!node.isStart && !node.isEnd) {
      node.element.classList.add("path");
    }
  }

  // Verify elements are marked
  let visitedCount = 0;
  let pathCount = 0;
  let wallCount = 0;
  for (const row of grid) {
    for (const node of row) {
      if (node.element.classList.contains("visited")) visitedCount++;
      if (node.element.classList.contains("path")) pathCount++;
      if (node.element.classList.contains("wall")) wallCount++;
    }
  }
  assert.ok(visitedCount > 0, "Visited cells should exist before clear");
  assert.ok(pathCount > 0, "Path cells should exist before clear");
  assert.ok(wallCount > 0, "Wall cells should exist before clear");

  // Execute full board clear (simulating Grid.clearBoard)
  function clearBoard(g) {
    for (const row of g) {
      for (const node of row) {
        node.isWall = false;
        node.isVisited = false;
        node.previousNode = null;
        node.distance = Infinity;
        node.totalDistance = Infinity;
        node.heuristic = 0;
        node.element.classList.remove("wall", "visited", "path");
      }
    }
  }

  clearBoard(grid);

  // Verify that all visited, path, and wall cells are 100% wiped
  for (const row of grid) {
    for (const node of row) {
      assert.strictEqual(node.isWall, false);
      assert.strictEqual(node.isVisited, false);
      assert.strictEqual(node.distance, Infinity);
      assert.strictEqual(node.previousNode, null);
      assert.strictEqual(node.element.classList.contains("wall"), false);
      assert.strictEqual(node.element.classList.contains("visited"), false);
      assert.strictEqual(node.element.classList.contains("path"), false);
    }
  }
});

test("Heuristic models compute correct distances (Manhattan, Euclidean, Chebyshev, Octile)", () => {
  const nodeA = { r: 1, c: 1 };
  const nodeB = { r: 4, c: 5 }; // dr = 3, dc = 4

  // Manhattan: 3 + 4 = 7
  assert.strictEqual(heuristics.manhattan(nodeA, nodeB), 7);
  assert.strictEqual(calculateHeuristic(nodeA, nodeB, "manhattan"), 7);

  // Euclidean: sqrt(3^2 + 4^2) = 5
  assert.strictEqual(heuristics.euclidean(nodeA, nodeB), 5);
  assert.strictEqual(calculateHeuristic(nodeA, nodeB, "euclidean"), 5);

  // Chebyshev: max(3, 4) = 4
  assert.strictEqual(heuristics.chebyshev(nodeA, nodeB), 4);
  assert.strictEqual(calculateHeuristic(nodeA, nodeB, "chebyshev"), 4);

  // Octile: (sqrt(2)-1)*min(3,4) + max(3,4) = 3*sqrt(2) + 1 approx 5.2426
  const octileVal = heuristics.octile(nodeA, nodeB);
  assert.ok(Math.abs(octileVal - (3 * Math.SQRT2 + 1)) < 1e-6);
  assert.strictEqual(calculateHeuristic(nodeA, nodeB, "octile"), octileVal);
});

test("8-Directional movement navigates diagonally to reduce path length", () => {
  const grid = createMockGrid(5, 5);
  const start = grid[0][0];
  const end = grid[3][3];

  // 4-Directional A* requires 6 steps (7 nodes)
  const result4Way = astar(grid, start, end, { allowDiagonal: false });
  assert.strictEqual(result4Way.shortestPathNodes.length, 7);

  // Reset grid
  for (const row of grid) {
    for (const node of row) {
      node.distance = Infinity;
      node.totalDistance = Infinity;
      node.heuristic = 0;
      node.previousNode = null;
      node.isVisited = false;
    }
  }

  // 8-Directional A* takes 3 diagonal steps (4 nodes: (0,0)->(1,1)->(2,2)->(3,3))
  const result8Way = astar(grid, start, end, {
    allowDiagonal: true,
    heuristic: "octile",
  });
  assert.strictEqual(result8Way.shortestPathNodes.length, 4);
  assert.strictEqual(result8Way.shortestPathNodes[0], start);
  assert.strictEqual(result8Way.shortestPathNodes[3], end);
});

test("Corner-cutting prevention restricts diagonal moves around obstacle corners", () => {
  const grid = createMockGrid(3, 3);
  const start = grid[0][0];
  const end = grid[1][1];

  // Place wall at (0, 1) to test corner cutting
  grid[0][1].isWall = true;

  // With preventCornerCutting: true, (0,0) cannot step directly to (1,1)
  const neighborsPrevented = getNeighbors(start, grid, {
    allowDiagonal: true,
    preventCornerCutting: true,
  });
  const hasDiagPrevented = neighborsPrevented.some(
    ({ neighbor }) => neighbor === end
  );
  assert.strictEqual(hasDiagPrevented, false);

  // With preventCornerCutting: false, (0,0) can cut corner to (1,1)
  const neighborsAllowed = getNeighbors(start, grid, {
    allowDiagonal: true,
    preventCornerCutting: false,
  });
  const hasDiagAllowed = neighborsAllowed.some(
    ({ neighbor }) => neighbor === end
  );
  assert.strictEqual(hasDiagAllowed, true);
});

test("Bidirectional Dijkstra finds shortest path and expands two converging frontiers", () => {
  const grid = createMockGrid(7, 7);
  const start = grid[0][0];
  const end = grid[6][6];

  const result = bidirectionalDijkstra(grid, start, end);
  assert.ok(result.shortestPathNodes.length > 0);
  assert.strictEqual(result.shortestPathNodes[0], start);
  assert.strictEqual(
    result.shortestPathNodes[result.shortestPathNodes.length - 1],
    end
  );

  // Verify both forward and backward frontiers were visited
  const hasForward = result.visitedNodesInOrder.some(
    n => n.visitDirection === "forward"
  );
  const hasBackward = result.visitedNodesInOrder.some(
    n => n.visitDirection === "backward"
  );
  assert.ok(hasForward, "Forward frontier should expand from start");
  assert.ok(hasBackward, "Backward frontier should expand from end");
});

test("Bidirectional A* finds shortest path with Octile heuristic on 8-way grid", () => {
  const grid = createMockGrid(7, 7);
  const start = grid[1][1];
  const end = grid[5][5];

  const result = bidirectionalAstar(grid, start, end, {
    allowDiagonal: true,
    heuristic: "octile",
  });
  assert.ok(result.shortestPathNodes.length > 0);
  assert.strictEqual(result.shortestPathNodes[0], start);
  assert.strictEqual(
    result.shortestPathNodes[result.shortestPathNodes.length - 1],
    end
  );
  // Diagonal straight line takes 4 diagonal steps (5 nodes)
  assert.strictEqual(result.shortestPathNodes.length, 5);
});

test("Bidirectional search returns empty path when destination is completely blocked", () => {
  const grid = createMockGrid(5, 5);
  const start = grid[0][0];
  const end = grid[4][4];

  // Completely wall off row 2
  for (let c = 0; c < 5; c++) {
    grid[2][c].isWall = true;
  }

  const resultDijkstra = bidirectionalDijkstra(grid, start, end);
  assert.strictEqual(resultDijkstra.shortestPathNodes.length, 0);

  const resultAstar = bidirectionalAstar(grid, start, end);
  assert.strictEqual(resultAstar.shortestPathNodes.length, 0);
});
