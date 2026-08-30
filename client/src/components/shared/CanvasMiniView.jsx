import React, { useRef, useEffect } from 'react';
import { scaleCanvasForHighDPI, getCanvasPointerCoordinates } from '../../utils/canvasScaler';

export default function CanvasMiniView({ width = 300, height = 150 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!canvas || !ctx) return;

    // Acceptance Criteria: Adapt buffer grid layout to high-DPI context
    scaleCanvasForHighDPI(canvas, ctx, width, height);

    // Demonstration drawing code tracking normalized metrics scaling
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(20, 20, 100, 50);
  }, [width, height]);

  const handlePointerInteraction = (e) => {
    const coords = getCanvasPointerCoordinates(canvasRef.current, e);
    console.log(`[CANVAS CLICK MAPPED CLUSTER] Target Coordinates: X=${coords.x}, Y=${coords.y}`);
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handlePointerInteraction}
      onTouchStart={handlePointerInteraction}
      className="border border-slate-800 rounded-lg bg-slate-950/40"
    />
  );
}
