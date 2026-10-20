/**
 * Spectrogram Visualizer
 * Renders a scrolling time-frequency heatmap on Canvas 2D.
 */
export class SpectrogramVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.isRunning = false;
    this.scrollOffset = 0;
    this.animationId = null;
    this.colormap = this.generateMagmaColormap();

    // Reuse one offscreen surface instead of allocating a canvas per frame.
    this.bufferCanvas = document.createElement("canvas");
    this.bufferCtx = this.bufferCanvas.getContext("2d");

    this.handleResize = () => this.resizeCanvas();
    this.resizeCanvas();
    window.addEventListener("resize", this.handleResize);
  }

  resizeCanvas() {
    // Internal resolution matches display size for sharpness
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    if (this.bufferCanvas) {
      this.bufferCanvas.width = rect.width;
      this.bufferCanvas.height = rect.height;
    }
  }

  generateMagmaColormap() {
    // Simplified Magma-like colormap: Black -> Purple -> Red -> Yellow -> White
    const stops = [
      { pos: 0.0, r: 0, g: 0, b: 4 },
      { pos: 0.2, r: 30, g: 15, b: 60 },
      { pos: 0.4, r: 100, g: 20, b: 80 },
      { pos: 0.6, r: 180, g: 50, b: 50 },
      { pos: 0.8, r: 240, g: 150, b: 50 },
      { pos: 1.0, r: 255, g: 255, b: 255 },
    ];

    const map = new Uint8ClampedArray(256 * 4);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let color = stops[0];
      for (let j = 0; j < stops.length - 1; j++) {
        if (t >= stops[j].pos && t <= stops[j + 1].pos) {
          const localT = (t - stops[j].pos) / (stops[j + 1].pos - stops[j].pos);
          color = {
            r: Math.round(stops[j].r + (stops[j + 1].r - stops[j].r) * localT),
            g: Math.round(stops[j].g + (stops[j + 1].g - stops[j].g) * localT),
            b: Math.round(stops[j].b + (stops[j + 1].b - stops[j].b) * localT),
          };
          break;
        }
      }
      map[i * 4] = color.r;
      map[i * 4 + 1] = color.g;
      map[i * 4 + 2] = color.b;
      map[i * 4 + 3] = 255;
    }
    return map;
  }

  start(audioProcessor) {
    this.stop();
    this.isRunning = true;
    this.draw(audioProcessor);
  }

  stop() {
    this.isRunning = false;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener("resize", this.handleResize);
    this.handleResize = null;
    this.bufferCanvas = null;
    this.bufferCtx = null;
  }

  draw(audioProcessor) {
    if (!this.isRunning) return;

    const data = audioProcessor.getFrequencyData();
    if (data.length === 0) {
      this.animationId = requestAnimationFrame(() => this.draw(audioProcessor));
      return;
    }

    const width = this.canvas.width;
    const height = this.canvas.height;
    const sliceWidth = 2; // Scroll speed

    // Snapshot the current image into the reusable buffer.
    this.bufferCtx.clearRect(0, 0, width, height);
    this.bufferCtx.drawImage(this.canvas, 0, 0);

    // Clear main canvas
    this.ctx.clearRect(0, 0, width, height);

    // Draw shifted previous frame
    this.ctx.drawImage(this.bufferCanvas, -sliceWidth, 0);

    // Draw new frequency column on the right
    const binHeight = height / data.length;
    for (let i = 0; i < data.length; i++) {
      const value = data[i]; // 0-255
      const colorIndex = value;
      const r = this.colormap[colorIndex * 4];
      const g = this.colormap[colorIndex * 4 + 1];
      const b = this.colormap[colorIndex * 4 + 2];

      this.ctx.fillStyle = `rgb(${r},${g},${b})`;

      // Invert Y so low frequencies are at the bottom
      const y = height - i * binHeight - binHeight;
      this.ctx.fillRect(width - sliceWidth, y, sliceWidth, binHeight + 1); // +1 to prevent gaps
    }

    this.animationId = requestAnimationFrame(() => this.draw(audioProcessor));
  }
}
