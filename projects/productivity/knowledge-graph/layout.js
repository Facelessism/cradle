/**
 * Layout and Viewport Helpers
 * Handles node coordinate preservation across reloads, viewport centering,
 * and directed arrowhead geometric calculations.
 */

/**
 * Places nodes by matching existing nodes by id to copy x, y, vx, and vy,
 * as well as pinned state (pinned, fx, fy), and assigning random positions
 * only to genuinely new nodes. Does not treat (0, 0) as a sentinel.
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
      if (prev.pinned !== undefined) {
        node.pinned = prev.pinned;
      }
      if (prev.fx !== undefined) {
        node.fx = prev.fx;
      }
      if (prev.fy !== undefined) {
        node.fy = prev.fy;
      }
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

/**
 * Calculates coordinates for a directed edge arrowhead pointing towards the target node perimeter.
 *
 * @param {{x: number, y: number}} source - Source node coordinates.
 * @param {{x: number, y: number}} target - Target node coordinates.
 * @param {number} [nodeRadius=20] - Radius of the target node.
 * @param {number} [arrowLength=10] - Length of the arrowhead.
 * @param {number} [arrowAngle=Math.PI / 6] - Half-angle of the arrowhead in radians.
 * @returns {{tip: {x: number, y: number}, left: {x: number, y: number}, right: {x: number, y: number}, angle: number} | null} Arrowhead coordinates or null if nodes overlap.
 */
export function computeArrowhead(
  source,
  target,
  nodeRadius = 20,
  arrowLength = 10,
  arrowAngle = Math.PI / 6
) {
  if (!source || !target) return null;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= nodeRadius || Number.isNaN(dist)) return null;

  const angle = Math.atan2(dy, dx);
  const tipX = target.x - nodeRadius * Math.cos(angle);
  const tipY = target.y - nodeRadius * Math.sin(angle);

  const leftX = tipX - arrowLength * Math.cos(angle - arrowAngle);
  const leftY = tipY - arrowLength * Math.sin(angle - arrowAngle);

  const rightX = tipX - arrowLength * Math.cos(angle + arrowAngle);
  const rightY = tipY - arrowLength * Math.sin(angle + arrowAngle);

  return {
    tip: { x: tipX, y: tipY },
    left: { x: leftX, y: leftY },
    right: { x: rightX, y: rightY },
    angle,
  };
}
