/**
 * graphLogic.js
 * Pure graph algorithms — no DOM access, so this file works identically
 * in the browser (loaded via <script>) and in Node (required by tests).
 *
 * Graph shape used throughout:
 *   nodes: [{ id: string }]
 *   edges: [{ from: string, to: string, weight: number }]
 *
 * All algorithms below return an array of "steps" describing what happened
 * at each point in time, so the UI can animate through them one by one
 * instead of only showing the final result.
 */

function buildAdjacency(nodes, edges) {
    const adj = new Map();
    for (const node of nodes) adj.set(node.id, []);
    for (const edge of edges) {
        const weight = edge.weight ?? 1;
        if (!adj.has(edge.from)) adj.set(edge.from, []);
        if (!adj.has(edge.to)) adj.set(edge.to, []);
        adj.get(edge.from).push({ to: edge.to, weight });
        adj.get(edge.to).push({ to: edge.from, weight });
    }
    return adj;
}

function bfs(nodes, edges, startId) {
    const adj = buildAdjacency(nodes, edges);
    const steps = [];
    const visited = new Set([startId]);
    const queue = [startId];

    steps.push({ type: "visit", node: startId });

    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = (adj.get(current) || []).slice().sort((a, b) => a.to.localeCompare(b.to));
        for (const { to } of neighbors) {
            if (!visited.has(to)) {
                visited.add(to);
                steps.push({ type: "frontier-edge", edge: { from: current, to } });
                steps.push({ type: "visit", node: to });
                queue.push(to);
            }
        }
    }
    return steps;
}

function dfs(nodes, edges, startId) {
    const adj = buildAdjacency(nodes, edges);
    const steps = [];
    const visited = new Set();

    function visit(nodeId, parent) {
        visited.add(nodeId);
        if (parent) steps.push({ type: "frontier-edge", edge: { from: parent, to: nodeId } });
        steps.push({ type: "visit", node: nodeId });

        const neighbors = (adj.get(nodeId) || []).slice().sort((a, b) => a.to.localeCompare(b.to));
        for (const { to } of neighbors) {
            if (!visited.has(to)) visit(to, nodeId);
        }
    }

    visit(startId, null);
    return steps;
}

function primMST(nodes, edges, startId) {
    const adj = buildAdjacency(nodes, edges);
    const start = startId || (nodes[0] && nodes[0].id);
    const steps = [];
    const inTree = new Set();
    const mstEdges = [];
    let totalWeight = 0;

    if (!start) return { steps, totalWeight, mstEdges };

    inTree.add(start);
    steps.push({ type: "visit", node: start });

    while (inTree.size < nodes.length) {
        let best = null;
        for (const from of inTree) {
            for (const { to, weight } of adj.get(from) || []) {
                if (!inTree.has(to)) {
                    if (
                        !best ||
                        weight < best.weight ||
                        (weight === best.weight && `${from}${to}` < `${best.from}${best.to}`)
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
        steps.push({ type: "tree-edge", edge: best });
        steps.push({ type: "visit", node: best.to });
    }

    return { steps, totalWeight, mstEdges };
}

function dijkstra(nodes, edges, startId, endId) {
    const adj = buildAdjacency(nodes, edges);
    const dist = new Map(nodes.map(n => [n.id, Infinity]));
    const prev = new Map();
    const settled = new Set();
    const steps = [];

    dist.set(startId, 0);

    while (settled.size < nodes.length) {
        let current = null;
        let currentDist = Infinity;
        for (const [id, d] of dist) {
            if (!settled.has(id) && d < currentDist) {
                current = id;
                currentDist = d;
            }
        }
        if (current === null) break;

        settled.add(current);
        steps.push({ type: "settle", node: current });

        if (current === endId) break;

        for (const { to, weight } of adj.get(current) || []) {
            if (settled.has(to)) continue;
            const candidate = currentDist + weight;
            if (candidate < dist.get(to)) {
                dist.set(to, candidate);
                prev.set(to, current);
                steps.push({ type: "relax", edge: { from: current, to } });
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

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        buildAdjacency,
        bfs,
        dfs,
        primMST,
        dijkstra,
    };
}