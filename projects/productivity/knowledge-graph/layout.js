/**
 * Layout Helpers
 * Pure node placement and viewport helpers for the knowledge graph.
 */

const INITIAL_SPREAD = 200;

/**
 * Keep existing nodes where they are and assign random positions only to new
 * nodes. Matching by id avoids using (0, 0) as an "uninitialized" sentinel.
 */
export function placeNodes(nodes, previousNodes = []) {
  const previousById = new Map(previousNodes.map(node => [node.id, node]));

  for (const node of nodes) {
    const previous = previousById.get(node.id);

    if (previous) {
      node.x = previous.x;
      node.y = previous.y;
      node.vx = previous.vx;
      node.vy = previous.vy;
      continue;
    }

    node.x = (Math.random() - 0.5) * INITIAL_SPREAD;
    node.y = (Math.random() - 0.5) * INITIAL_SPREAD;
    node.vx = 0;
    node.vy = 0;
  }

  return nodes;
}

/**
 * Build a viewport transform that places the world origin at the center of a
 * canvas of the given size.
 */
export function getCenteredTransform(width, height, k = 1) {
  return { x: width / 2, y: height / 2, k };
}
