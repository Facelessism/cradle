/**
 * Pathfinding Algorithms Implementation
 * Returns { visitedNodesInOrder, shortestPathNodes }
 */

export function getNodesInShortestPathOrder(endNode) {
    const nodesInShortestPathOrder = [];
    let currentNode = endNode;
    while (currentNode !== null) {
        nodesInShortestPathOrder.unshift(currentNode);
        currentNode = currentNode.previousNode;
    }
    return nodesInShortestPathOrder;
}

export function bfs(grid, startNode, endNode) {
    const visitedNodesInOrder = [];
    const queue = [startNode];
    startNode.isVisited = true;

    while (queue.length > 0) {
        const currentNode = queue.shift();
        visitedNodesInOrder.push(currentNode);

        if (currentNode === endNode) return { visitedNodesInOrder, shortestPathNodes: getNodesInShortestPathOrder(endNode) };

        const unvisitedNeighbors = getUnvisitedNeighbors(currentNode, grid);
        for (const neighbor of unvisitedNeighbors) {
            neighbor.isVisited = true;
            neighbor.previousNode = currentNode;
            queue.push(neighbor);
        }
    }
    return { visitedNodesInOrder, shortestPathNodes: [] };
}

export function dijkstra(grid, startNode, endNode) {
    const visitedNodesInOrder = [];
    startNode.distance = 0;
    const unvisitedNodes = getAllNodes(grid);

    while (unvisitedNodes.length > 0) {
        sortNodesByDistance(unvisitedNodes);
        const closestNode = unvisitedNodes.shift();

        if (closestNode.isWall) continue;
        if (closestNode.distance === Infinity) return { visitedNodesInOrder, shortestPathNodes: [] };

        closestNode.isVisited = true;
        visitedNodesInOrder.push(closestNode);

        if (closestNode === endNode) return { visitedNodesInOrder, shortestPathNodes: getNodesInShortestPathOrder(endNode) };

        updateUnvisitedNeighbors(closestNode, grid);
    }
    return { visitedNodesInOrder, shortestPathNodes: [] };
}

export function astar(grid, startNode, endNode) {
    const visitedNodesInOrder = [];
    const openSet = [startNode];
    startNode.distance = 0;
    startNode.heuristic = calculateHeuristic(startNode, endNode);
    startNode.totalDistance = startNode.heuristic;

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.totalDistance - b.totalDistance);
        const currentNode = openSet.shift();

        if (currentNode.isWall) continue;
        currentNode.isVisited = true;
        visitedNodesInOrder.push(currentNode);

        if (currentNode === endNode) return { visitedNodesInOrder, shortestPathNodes: getNodesInShortestPathOrder(endNode) };

        const neighbors = getUnvisitedNeighbors(currentNode, grid);
        for (const neighbor of neighbors) {
            const tentativeDistance = currentNode.distance + 1;
            if (tentativeDistance < neighbor.distance) {
                neighbor.previousNode = currentNode;
                neighbor.distance = tentativeDistance;
                neighbor.heuristic = calculateHeuristic(neighbor, endNode);
                neighbor.totalDistance = neighbor.distance + neighbor.heuristic;

                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor);
                }
            }
        }
    }
    return { visitedNodesInOrder, shortestPathNodes: [] };
}

function getUnvisitedNeighbors(node, grid) {
    const neighbors = [];
    const { r, c } = node;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // Up, Down, Left, Right

    for (const [dr, dc] of directions) {
        const neighbor = node.gridInstance?.getNode(r + dr, c + dc) || grid[r + dr]?.[c + dc]; // Fallback to grid array
        if (neighbor && !neighbor.isVisited && !neighbor.isWall) {
            neighbors.push(neighbor);
        }
    }
    return neighbors;
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

function updateUnvisitedNeighbors(node, grid) {
    const unvisitedNeighbors = getUnvisitedNeighbors(node, grid);
    for (const neighbor of unvisitedNeighbors) {
        if (node.distance + 1 < neighbor.distance) {
            neighbor.distance = node.distance + 1;
            neighbor.previousNode = node;
        }
    }
}

function calculateHeuristic(nodeA, nodeB) {
    // Manhattan distance
    return Math.abs(nodeA.r - nodeB.r) + Math.abs(nodeA.c - nodeB.c);
}
