/**
 * Pathfinding Algorithms Implementation
 * Supports BFS, Dijkstra, A*, Bidirectional Dijkstra, and Bidirectional A*
 * With 4-way / 8-way movement, corner-cutting prevention, and multiple heuristics.
 * Returns { visitedNodesInOrder, shortestPathNodes }
 */

export const heuristics = {
  manhattan(nodeA, nodeB) {
    return Math.abs(nodeA.r - nodeB.r) + Math.abs(nodeA.c - nodeB.c);
  },
  euclidean(nodeA, nodeB) {
    const dr = nodeA.r - nodeB.r;
    const dc = nodeA.c - nodeB.c;
    return Math.sqrt(dr * dr + dc * dc);
  },
  chebyshev(nodeA, nodeB) {
    return Math.max(Math.abs(nodeA.r - nodeB.r), Math.abs(nodeA.c - nodeB.c));
  },
  octile(nodeA, nodeB) {
    const dx = Math.abs(nodeA.r - nodeB.r);
    const dy = Math.abs(nodeA.c - nodeB.c);
    const F = Math.SQRT2 - 1;
    return dx < dy ? F * dx + dy : F * dy + dx;
  },
};

export function calculateHeuristic(nodeA, nodeB, type = "manhattan") {
  const fn = heuristics[type] || heuristics.manhattan;
  return fn(nodeA, nodeB);
}

export function getNodesInShortestPathOrder(endNode) {
  const nodesInShortestPathOrder = [];
  let currentNode = endNode;
  while (currentNode !== null) {
    nodesInShortestPathOrder.unshift(currentNode);
    currentNode = currentNode.previousNode;
  }
  return nodesInShortestPathOrder;
}

/**
 * Returns neighbor nodes along with step weights.
 * Supports orthogonal (4-way) and diagonal (8-way) moves.
 * Corner-cutting prevention prevents diagonal movement across obstacle corners.
 */
export function getNeighbors(node, grid, options = {}) {
  const { allowDiagonal = false, preventCornerCutting = true } = options;
  const neighbors = [];
  const { r, c } = node;
  const rows = grid.length;
  const cols = grid[0].length;

  // Cardinal directions: [dr, dc, isDiagonal, weight]
  const directions = [
    [-1, 0, false, 1], // Up
    [1, 0, false, 1], // Down
    [0, -1, false, 1], // Left
    [0, 1, false, 1], // Right
  ];

  if (allowDiagonal) {
    directions.push(
      [-1, -1, true, Math.SQRT2], // Up-Left
      [-1, 1, true, Math.SQRT2], // Up-Right
      [1, -1, true, Math.SQRT2], // Down-Left
      [1, 1, true, Math.SQRT2] // Down-Right
    );
  }

  for (const [dr, dc, isDiag, weight] of directions) {
    const nr = r + dr;
    const nc = c + dc;

    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

    const neighbor = node.gridInstance?.getNode(nr, nc) || grid[nr]?.[nc];

    if (!neighbor || neighbor.isWall) continue;

    if (isDiag && preventCornerCutting) {
      const adj1 = node.gridInstance?.getNode(r + dr, c) || grid[r + dr]?.[c];
      const adj2 = node.gridInstance?.getNode(r, c + dc) || grid[r]?.[c + dc];
      if (adj1?.isWall || adj2?.isWall) {
        continue;
      }
    }

    neighbors.push({ neighbor, weight });
  }

  return neighbors;
}

export function getUnvisitedNeighbors(node, grid, options = {}) {
  const neighbors = getNeighbors(node, grid, options);
  return neighbors
    .filter(({ neighbor }) => !neighbor.isVisited && !neighbor.isWall)
    .map(({ neighbor }) => neighbor);
}

export function bfs(grid, startNode, endNode, options = {}) {
  const visitedNodesInOrder = [];
  const queue = [startNode];
  startNode.isVisited = true;

  while (queue.length > 0) {
    const currentNode = queue.shift();
    visitedNodesInOrder.push(currentNode);

    if (currentNode === endNode) {
      return {
        visitedNodesInOrder,
        shortestPathNodes: getNodesInShortestPathOrder(endNode),
      };
    }

    const neighbors = getNeighbors(currentNode, grid, options);
    for (const { neighbor } of neighbors) {
      if (!neighbor.isVisited && !neighbor.isWall) {
        neighbor.isVisited = true;
        neighbor.previousNode = currentNode;
        queue.push(neighbor);
      }
    }
  }
  return { visitedNodesInOrder, shortestPathNodes: [] };
}

export function dijkstra(grid, startNode, endNode, options = {}) {
  const visitedNodesInOrder = [];
  startNode.distance = 0;
  const unvisitedNodes = getAllNodes(grid);

  while (unvisitedNodes.length > 0) {
    sortNodesByDistance(unvisitedNodes);
    const closestNode = unvisitedNodes.shift();

    if (closestNode.isWall) continue;
    if (closestNode.distance === Infinity) {
      return { visitedNodesInOrder, shortestPathNodes: [] };
    }

    closestNode.isVisited = true;
    visitedNodesInOrder.push(closestNode);

    if (closestNode === endNode) {
      return {
        visitedNodesInOrder,
        shortestPathNodes: getNodesInShortestPathOrder(endNode),
      };
    }

    const neighbors = getNeighbors(closestNode, grid, options);
    for (const { neighbor, weight } of neighbors) {
      if (neighbor.isVisited || neighbor.isWall) continue;
      const tentativeDistance = closestNode.distance + weight;
      if (tentativeDistance < neighbor.distance) {
        neighbor.distance = tentativeDistance;
        neighbor.previousNode = closestNode;
      }
    }
  }
  return { visitedNodesInOrder, shortestPathNodes: [] };
}

export function astar(grid, startNode, endNode, options = {}) {
  const { heuristic = "manhattan" } = options;
  const visitedNodesInOrder = [];
  const openSet = [startNode];
  startNode.distance = 0;
  startNode.heuristic = calculateHeuristic(startNode, endNode, heuristic);
  startNode.totalDistance = startNode.heuristic;

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.totalDistance - b.totalDistance);
    const currentNode = openSet.shift();

    if (currentNode.isWall) continue;
    currentNode.isVisited = true;
    visitedNodesInOrder.push(currentNode);

    if (currentNode === endNode) {
      return {
        visitedNodesInOrder,
        shortestPathNodes: getNodesInShortestPathOrder(endNode),
      };
    }

    const neighbors = getNeighbors(currentNode, grid, options);
    for (const { neighbor, weight } of neighbors) {
      if (neighbor.isVisited || neighbor.isWall) continue;
      const tentativeDistance = currentNode.distance + weight;
      if (tentativeDistance < neighbor.distance) {
        neighbor.previousNode = currentNode;
        neighbor.distance = tentativeDistance;
        neighbor.heuristic = calculateHeuristic(neighbor, endNode, heuristic);
        neighbor.totalDistance = neighbor.distance + neighbor.heuristic;

        if (!openSet.includes(neighbor)) {
          openSet.push(neighbor);
        }
      }
    }
  }
  return { visitedNodesInOrder, shortestPathNodes: [] };
}

export function bidirectionalDijkstra(grid, startNode, endNode, options = {}) {
  const visitedNodesInOrder = [];
  if (startNode === endNode) {
    return {
      visitedNodesInOrder: [startNode],
      shortestPathNodes: [startNode],
    };
  }

  const distStart = new Map();
  const distEnd = new Map();
  const parentStart = new Map();
  const parentEnd = new Map();
  const visitedStart = new Set();
  const visitedEnd = new Set();

  distStart.set(startNode, 0);
  distEnd.set(endNode, 0);

  const openStart = [startNode];
  const openEnd = [endNode];

  let bestIntersection = null;
  let bestPathLength = Infinity;

  while (openStart.length > 0 && openEnd.length > 0) {
    openStart.sort((a, b) => distStart.get(a) - distStart.get(b));
    openEnd.sort((a, b) => distEnd.get(a) - distEnd.get(b));

    if (
      bestIntersection &&
      distStart.get(openStart[0]) + distEnd.get(openEnd[0]) >= bestPathLength
    ) {
      break;
    }

    // Forward Step
    const currStart = openStart.shift();
    if (!currStart.isWall && !visitedStart.has(currStart)) {
      visitedStart.add(currStart);
      currStart.visitDirection = "forward";
      visitedNodesInOrder.push(currStart);

      if (visitedEnd.has(currStart)) {
        const total = distStart.get(currStart) + distEnd.get(currStart);
        if (total < bestPathLength) {
          bestPathLength = total;
          bestIntersection = currStart;
        }
      }

      const neighborsStart = getNeighbors(currStart, grid, options);
      for (const { neighbor, weight } of neighborsStart) {
        if (neighbor.isWall) continue;
        const d = distStart.get(currStart) + weight;
        const currD = distStart.has(neighbor)
          ? distStart.get(neighbor)
          : Infinity;
        if (d < currD) {
          distStart.set(neighbor, d);
          parentStart.set(neighbor, currStart);
          if (!openStart.includes(neighbor) && !visitedStart.has(neighbor)) {
            openStart.push(neighbor);
          }
          if (visitedEnd.has(neighbor)) {
            const total = d + distEnd.get(neighbor);
            if (total < bestPathLength) {
              bestPathLength = total;
              bestIntersection = neighbor;
            }
          }
        }
      }
    }

    if (
      bestIntersection &&
      openStart.length > 0 &&
      openEnd.length > 0 &&
      distStart.get(openStart[0]) + distEnd.get(openEnd[0]) >= bestPathLength
    ) {
      break;
    }

    // Backward Step
    const currEnd = openEnd.shift();
    if (!currEnd.isWall && !visitedEnd.has(currEnd)) {
      visitedEnd.add(currEnd);
      currEnd.visitDirection = "backward";
      visitedNodesInOrder.push(currEnd);

      if (visitedStart.has(currEnd)) {
        const total = distStart.get(currEnd) + distEnd.get(currEnd);
        if (total < bestPathLength) {
          bestPathLength = total;
          bestIntersection = currEnd;
        }
      }

      const neighborsEnd = getNeighbors(currEnd, grid, options);
      for (const { neighbor, weight } of neighborsEnd) {
        if (neighbor.isWall) continue;
        const d = distEnd.get(currEnd) + weight;
        const currD = distEnd.has(neighbor) ? distEnd.get(neighbor) : Infinity;
        if (d < currD) {
          distEnd.set(neighbor, d);
          parentEnd.set(neighbor, currEnd);
          if (!openEnd.includes(neighbor) && !visitedEnd.has(neighbor)) {
            openEnd.push(neighbor);
          }
          if (visitedStart.has(neighbor)) {
            const total = distStart.get(neighbor) + d;
            if (total < bestPathLength) {
              bestPathLength = total;
              bestIntersection = neighbor;
            }
          }
        }
      }
    }
  }

  const shortestPathNodes = [];
  if (bestIntersection) {
    const forwardPath = [];
    let curr = bestIntersection;
    while (curr) {
      forwardPath.unshift(curr);
      curr = parentStart.get(curr);
    }

    const backwardPath = [];
    curr = parentEnd.get(bestIntersection);
    while (curr) {
      backwardPath.push(curr);
      curr = parentEnd.get(curr);
    }

    shortestPathNodes.push(...forwardPath, ...backwardPath);
  }

  return { visitedNodesInOrder, shortestPathNodes };
}

export function bidirectionalAstar(grid, startNode, endNode, options = {}) {
  const { heuristic = "manhattan" } = options;
  const visitedNodesInOrder = [];

  if (startNode === endNode) {
    return {
      visitedNodesInOrder: [startNode],
      shortestPathNodes: [startNode],
    };
  }

  const gStart = new Map();
  const gEnd = new Map();
  const fStart = new Map();
  const fEnd = new Map();
  const parentStart = new Map();
  const parentEnd = new Map();
  const visitedStart = new Set();
  const visitedEnd = new Set();

  gStart.set(startNode, 0);
  fStart.set(startNode, calculateHeuristic(startNode, endNode, heuristic));
  gEnd.set(endNode, 0);
  fEnd.set(endNode, calculateHeuristic(endNode, startNode, heuristic));

  const openStart = [startNode];
  const openEnd = [endNode];

  let bestIntersection = null;
  let bestPathLength = Infinity;

  while (openStart.length > 0 && openEnd.length > 0) {
    openStart.sort((a, b) => fStart.get(a) - fStart.get(b));
    openEnd.sort((a, b) => fEnd.get(a) - fEnd.get(b));

    const topFStart = fStart.get(openStart[0]);
    const topFEnd = fEnd.get(openEnd[0]);

    if (bestIntersection && Math.max(topFStart, topFEnd) >= bestPathLength) {
      break;
    }

    // Forward Step
    const currStart = openStart.shift();
    if (!currStart.isWall && !visitedStart.has(currStart)) {
      visitedStart.add(currStart);
      currStart.visitDirection = "forward";
      visitedNodesInOrder.push(currStart);

      if (visitedEnd.has(currStart)) {
        const total = gStart.get(currStart) + gEnd.get(currStart);
        if (total < bestPathLength) {
          bestPathLength = total;
          bestIntersection = currStart;
        }
      }

      const neighborsStart = getNeighbors(currStart, grid, options);
      for (const { neighbor, weight } of neighborsStart) {
        if (neighbor.isWall) continue;
        const tentativeG = gStart.get(currStart) + weight;
        const currentG = gStart.has(neighbor) ? gStart.get(neighbor) : Infinity;

        if (tentativeG < currentG) {
          gStart.set(neighbor, tentativeG);
          const h = calculateHeuristic(neighbor, endNode, heuristic);
          fStart.set(neighbor, tentativeG + h);
          parentStart.set(neighbor, currStart);

          if (!openStart.includes(neighbor) && !visitedStart.has(neighbor)) {
            openStart.push(neighbor);
          }

          if (visitedEnd.has(neighbor)) {
            const total = tentativeG + gEnd.get(neighbor);
            if (total < bestPathLength) {
              bestPathLength = total;
              bestIntersection = neighbor;
            }
          }
        }
      }
    }

    if (bestIntersection && openStart.length > 0 && openEnd.length > 0) {
      if (
        Math.max(fStart.get(openStart[0]), fEnd.get(openEnd[0])) >=
        bestPathLength
      ) {
        break;
      }
    }

    // Backward Step
    const currEnd = openEnd.shift();
    if (!currEnd.isWall && !visitedEnd.has(currEnd)) {
      visitedEnd.add(currEnd);
      currEnd.visitDirection = "backward";
      visitedNodesInOrder.push(currEnd);

      if (visitedStart.has(currEnd)) {
        const total = gStart.get(currEnd) + gEnd.get(currEnd);
        if (total < bestPathLength) {
          bestPathLength = total;
          bestIntersection = currEnd;
        }
      }

      const neighborsEnd = getNeighbors(currEnd, grid, options);
      for (const { neighbor, weight } of neighborsEnd) {
        if (neighbor.isWall) continue;
        const tentativeG = gEnd.get(currEnd) + weight;
        const currentG = gEnd.has(neighbor) ? gEnd.get(neighbor) : Infinity;

        if (tentativeG < currentG) {
          gEnd.set(neighbor, tentativeG);
          const h = calculateHeuristic(neighbor, startNode, heuristic);
          fEnd.set(neighbor, tentativeG + h);
          parentEnd.set(neighbor, currEnd);

          if (!openEnd.includes(neighbor) && !visitedEnd.has(neighbor)) {
            openEnd.push(neighbor);
          }

          if (visitedStart.has(neighbor)) {
            const total = gStart.get(neighbor) + tentativeG;
            if (total < bestPathLength) {
              bestPathLength = total;
              bestIntersection = neighbor;
            }
          }
        }
      }
    }
  }

  const shortestPathNodes = [];
  if (bestIntersection) {
    const forwardPath = [];
    let curr = bestIntersection;
    while (curr) {
      forwardPath.unshift(curr);
      curr = parentStart.get(curr);
    }

    const backwardPath = [];
    curr = parentEnd.get(bestIntersection);
    while (curr) {
      backwardPath.push(curr);
      curr = parentEnd.get(curr);
    }

    shortestPathNodes.push(...forwardPath, ...backwardPath);
  }

  return { visitedNodesInOrder, shortestPathNodes };
}

function getAllNodes(grid) {
  const nodes = [];
  for (const row of grid) {
    for (const node of row) {
      if (!node.isVisited) nodes.push(node);
    }
  }
  return nodes;
}

function sortNodesByDistance(unvisitedNodes) {
  unvisitedNodes.sort((nodeA, nodeB) => nodeA.distance - nodeB.distance);
}
