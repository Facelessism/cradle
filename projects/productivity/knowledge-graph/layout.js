/**
 * Layout and Viewport Helpers
 * Handles node coordinate preservation across reloads and viewport centering.
 */

/**
 * Places nodes by matching existing nodes by id to copy x, y, vx, and vy,
 * and assigning random positions only to genuinely new nodes.
 * Does not treat (0, 0) as a sentinel.
 *
 * @param {Array<Object>} nodes - Fresh nodes parsed from notes.
 * @param {Array<Object>} [previousNodes=[]] - Existing nodes from previous layout state.
 * @returns {Array<Object>} The placed nodes array.
 */
export function placeNodes(nodes, previousNodes = []) {
  if (!Array.isArray(nodes)) return [];

  const prevMap = new Map();
  if (Array.isArray(previousNodes)) {
    for (const prev of previousNodes) {
      if (prev && prev.id !== undefined && prev.id !== null) {
        prevMap.set(prev.id, prev);
      }
    }
  }

  for (const node of nodes) {
    if (prevMap.has(node.id)) {
      const prev = prevMap.get(node.id);
      node.x = prev.x;
      node.y = prev.y;
      node.vx = prev.vx;
      node.vy = prev.vy;
    } else {
      node.x = (Math.random() - 0.5) * 200;
      node.y = (Math.random() - 0.5) * 200;
      node.vx = 0;
      node.vy = 0;
    }
  }

  return nodes;
}

/**
 * Calculates a viewport transform that centers world point (0, 0)
 * in a canvas of the specified width and height.
 *
 * @param {number} width - Canvas display width.
 * @param {number} height - Canvas display height.
 * @param {number} [k=1] - Zoom factor.
 * @returns {{ x: number, y: number, k: number }} Centered viewport transform.
 */
export function getCenteredTransform(width, height, k = 1) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const zoom = typeof k === "number" && !Number.isNaN(k) ? k : 1;
  return {
    x: w / 2,
    y: h / 2,
    k: zoom,
  };
}
