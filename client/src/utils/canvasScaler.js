/**
 * Synchronizes canvas structural dimensions with the backing buffer resolution.
 * Prevents blur and pointer misalignment on high-DPI displays.
 * 
 * @param {HTMLCanvasElement} canvas 
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} width CSS bounding display width
 * @param {number} height CSS bounding display height
 */
export function scaleCanvasForHighDPI(canvas, ctx, width, height) {
  const dpr = window.devicePixelRatio || 1;

  // Set physical drawing buffer boundaries
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  // Enforce logical display layout sizing via CSS style mappings
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // Scale the context metrics once to align all future draw operations
  ctx.scale(dpr, dpr);
}

/**
 * Normalizes mouse/touch interactive coordinate vectors relative to the DPR offset.
 * 
 * @param {HTMLCanvasElement} canvas 
 * @param {MouseEvent|TouchEvent} event 
 * @returns {{x: number, y: number}} Normalized coordinate vector mapping
 */
export function getCanvasPointerCoordinates(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  
  // Extract client interaction paths
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;

  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}
