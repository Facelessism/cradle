/**
 * Audio Spectrogram Analyzer — Dedicated Visualizer Worker
 * ────────────────────────────────────────────────────────
 * Executes off-main-thread pixel processing and canvas frame composition
 * onto an OffscreenCanvas transferred from the main thread.
 *
 * Prevents UI thread jank, unblocking 60 FPS interactions during high-rate
 * audio streaming and intensive FFT analysis.
 */

import {
  frequencyToY,
  yToFrequency,
  getFrequencyTicks,
  getDecibelTicks,
  formatFrequency,
} from "./scale.js";

/**
 * Offscreen Spectrogram Renderer
 * Manages offscreen waterfall heatmap buffers, calibrated axes overlays,
 * and dBFS colorbar rendering in worker scope.
 */
export class SpectrogramWorkerRenderer {
  constructor({
    canvas = null,
    width = 800,
    height = 400,
    isLogarithmic = false,
    layout = null,
    sliceWidth = 2,
  } = {}) {
    this.canvas = canvas;
    this.ctx =
      canvas && typeof canvas.getContext === "function"
        ? canvas.getContext("2d")
        : null;

    this.width = width;
    this.height = height;
    this.isLogarithmic = isLogarithmic;
    this.sliceWidth = sliceWidth;
    this.timeMarkers = [];
    this.lastMarkerTime = 0;
    this.smoothedPeakDb = -100;

    this.layout = layout || {
      marginTop: 22,
      marginBottom: 28,
      marginLeft: 62,
      marginRight: 64,
    };

    this.colormap = this.generateMagmaColormap();

    this.spectrogramCanvas = null;
    this.spectrogramCtx = null;
    this.bufferCanvas = null;
    this.bufferCtx = null;

    this.createOffscreenBuffers();
    this.renderStatic();
  }

  getPlotDimensions() {
    const width = this.width || (this.canvas ? this.canvas.width : 800);
    const height = this.height || (this.canvas ? this.canvas.height : 400);
    const plotWidth = Math.max(
      10,
      width - this.layout.marginLeft - this.layout.marginRight
    );
    const plotHeight = Math.max(
      10,
      height - this.layout.marginTop - this.layout.marginBottom
    );
    return {
      width,
      height,
      plotX: this.layout.marginLeft,
      plotY: this.layout.marginTop,
      plotWidth,
      plotHeight,
    };
  }

  createOffscreenBuffers() {
    const { plotWidth, plotHeight } = this.getPlotDimensions();

    if (typeof OffscreenCanvas !== "undefined") {
      this.spectrogramCanvas = new OffscreenCanvas(plotWidth, plotHeight);
      this.spectrogramCtx = this.spectrogramCanvas.getContext("2d");
      this.bufferCanvas = new OffscreenCanvas(plotWidth, plotHeight);
      this.bufferCtx = this.bufferCanvas.getContext("2d");
    } else if (typeof document !== "undefined") {
      this.spectrogramCanvas = document.createElement("canvas");
      this.spectrogramCanvas.width = plotWidth;
      this.spectrogramCanvas.height = plotHeight;
      this.spectrogramCtx = this.spectrogramCanvas.getContext("2d");

      this.bufferCanvas = document.createElement("canvas");
      this.bufferCanvas.width = plotWidth;
      this.bufferCanvas.height = plotHeight;
      this.bufferCtx = this.bufferCanvas.getContext("2d");
    }

    if (this.spectrogramCtx) {
      this.spectrogramCtx.fillStyle = "#000004";
      this.spectrogramCtx.fillRect(0, 0, plotWidth, plotHeight);
    }
  }

  resize(width, height) {
    if (width > 0) this.width = width;
    if (height > 0) this.height = height;

    if (this.canvas) {
      if (width > 0) this.canvas.width = width;
      if (height > 0) this.canvas.height = height;
    }

    const { plotWidth, plotHeight } = this.getPlotDimensions();
    if (this.spectrogramCanvas) {
      this.spectrogramCanvas.width = plotWidth;
      this.spectrogramCanvas.height = plotHeight;
      if (this.spectrogramCtx) {
        this.spectrogramCtx.fillStyle = "#000004";
        this.spectrogramCtx.fillRect(0, 0, plotWidth, plotHeight);
      }
    }
    if (this.bufferCanvas) {
      this.bufferCanvas.width = plotWidth;
      this.bufferCanvas.height = plotHeight;
    }

    this.renderStatic();
  }

  setScale(scale) {
    const isLog = scale === "logarithmic" || scale === "log" || scale === true;
    if (this.isLogarithmic !== isLog) {
      this.isLogarithmic = isLog;
      if (this.spectrogramCtx && this.spectrogramCanvas) {
        this.spectrogramCtx.fillStyle = "#000004";
        this.spectrogramCtx.fillRect(
          0,
          0,
          this.spectrogramCanvas.width,
          this.spectrogramCanvas.height
        );
      }
      this.renderStatic();
    }
  }

  generateMagmaColormap() {
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

  renderStatic() {
    if (!this.ctx) return;
    const nyquist = 22050;
    const minDb = -100;
    const maxDb = -30;
    const peakDb = -100;

    const { width, height, plotX, plotY, plotWidth, plotHeight } =
      this.getPlotDimensions();

    this.ctx.fillStyle = "#0a0d14";
    this.ctx.fillRect(0, 0, width, height);

    if (this.spectrogramCanvas) {
      this.ctx.drawImage(this.spectrogramCanvas, plotX, plotY);
    } else {
      this.ctx.fillStyle = "#000004";
      this.ctx.fillRect(plotX, plotY, plotWidth, plotHeight);
    }

    this.drawFrequencyAxis(
      this.ctx,
      nyquist,
      plotX,
      plotY,
      plotWidth,
      plotHeight
    );
    this.drawTimeAxis(
      this.ctx,
      plotX,
      plotY,
      plotWidth,
      plotHeight,
      typeof performance !== "undefined" ? performance.now() : Date.now()
    );
    this.drawDecibelColorbar(
      this.ctx,
      minDb,
      maxDb,
      peakDb,
      plotX,
      plotY,
      plotWidth,
      plotHeight
    );
  }

  drawFrequencyAxis(ctx, nyquist, plotX, plotY, plotWidth, plotHeight) {
    ctx.save();
    ctx.font = "10px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotHeight);
    ctx.stroke();

    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "left";
    ctx.fillText(
      `Freq (${this.isLogarithmic ? "Log" : "Hz"})`,
      plotX - this.layout.marginLeft + 6,
      plotY - 8
    );

    const ticks = getFrequencyTicks(nyquist, this.isLogarithmic);
    for (const tick of ticks) {
      const y =
        plotY +
        frequencyToY(tick.freq, nyquist, plotHeight, this.isLogarithmic);

      ctx.strokeStyle = "#6b7280";
      ctx.beginPath();
      ctx.moveTo(plotX - 4, y);
      ctx.lineTo(plotX, y);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      if (typeof ctx.setLineDash === "function") {
        ctx.setLineDash([2, 4]);
      }
      ctx.beginPath();
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotWidth, y);
      ctx.stroke();
      if (typeof ctx.setLineDash === "function") {
        ctx.setLineDash([]);
      }

      ctx.fillStyle = "#9ca3af";
      ctx.textAlign = "right";
      ctx.fillText(tick.label, plotX - 6, y);
    }
    ctx.restore();
  }

  drawTimeAxis(ctx, plotX, plotY, plotWidth, plotHeight, now) {
    ctx.save();
    ctx.font = "10px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotHeight);
    ctx.lineTo(plotX + plotWidth, plotY + plotHeight);
    ctx.stroke();

    ctx.fillStyle = "#e5e7eb";
    ctx.strokeStyle = "#9ca3af";
    ctx.beginPath();
    ctx.moveTo(plotX + plotWidth, plotY + plotHeight);
    ctx.lineTo(plotX + plotWidth, plotY + plotHeight + 4);
    ctx.stroke();
    ctx.fillText("0s", plotX + plotWidth, plotY + plotHeight + 6);

    for (const marker of this.timeMarkers) {
      const screenX = plotX + marker.x;
      if (screenX >= plotX && screenX <= plotX + plotWidth - 10) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        if (typeof ctx.setLineDash === "function") {
          ctx.setLineDash([2, 4]);
        }
        ctx.beginPath();
        ctx.moveTo(screenX, plotY);
        ctx.lineTo(screenX, plotY + plotHeight);
        ctx.stroke();
        if (typeof ctx.setLineDash === "function") {
          ctx.setLineDash([]);
        }

        ctx.strokeStyle = "#6b7280";
        ctx.beginPath();
        ctx.moveTo(screenX, plotY + plotHeight);
        ctx.lineTo(screenX, plotY + plotHeight + 4);
        ctx.stroke();

        const elapsedSec = Math.max(1, Math.round((now - marker.time) / 1000));
        ctx.fillStyle = "#9ca3af";
        ctx.fillText(`-${elapsedSec}s`, screenX, plotY + plotHeight + 6);
      }
    }

    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "left";
    ctx.fillText("Time (s)", plotX, plotY + plotHeight + 6);
    ctx.restore();
  }

  drawDecibelColorbar(
    ctx,
    minDb,
    maxDb,
    peakDb,
    plotX,
    plotY,
    plotWidth,
    plotHeight
  ) {
    ctx.save();
    const barX = plotX + plotWidth + 12;
    const barWidth = 12;
    const barY = plotY;
    const barHeight = plotHeight;

    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("dBFS", barX - 2, barY - 8);

    if (typeof ctx.createLinearGradient === "function") {
      const gradient = ctx.createLinearGradient(
        barX,
        barY,
        barX,
        barY + barHeight
      );
      gradient.addColorStop(0.0, "rgb(255, 255, 255)");
      gradient.addColorStop(0.2, "rgb(240, 150, 50)");
      gradient.addColorStop(0.4, "rgb(180, 50, 50)");
      gradient.addColorStop(0.6, "rgb(100, 20, 80)");
      gradient.addColorStop(0.8, "rgb(30, 15, 60)");
      gradient.addColorStop(1.0, "rgb(0, 0, 4)");
      ctx.fillStyle = gradient;
      ctx.fillRect(barX, barY, barWidth, barHeight);
    } else {
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(barX, barY, barWidth, barHeight);
    }

    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    const dbTicks = getDecibelTicks(minDb, maxDb, 10);
    ctx.font = "9px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#9ca3af";

    for (const tick of dbTicks) {
      const norm = (tick.dB - minDb) / (maxDb - minDb);
      const y = barY + barHeight * (1 - norm);

      ctx.strokeStyle = "#6b7280";
      ctx.beginPath();
      ctx.moveTo(barX + barWidth, y);
      ctx.lineTo(barX + barWidth + 3, y);
      ctx.stroke();

      ctx.fillText(tick.label, barX + barWidth + 5, y);
    }

    const clampedPeak = Math.max(minDb, Math.min(peakDb, maxDb));
    const peakNorm = (clampedPeak - minDb) / (maxDb - minDb);
    const needleY = barY + barHeight * (1 - peakNorm);

    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX - 3, needleY);
    ctx.lineTo(barX + barWidth + 3, needleY);
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(barX - 4, needleY);
    ctx.lineTo(barX - 8, needleY - 4);
    ctx.lineTo(barX - 8, needleY + 4);
    ctx.closePath();
    ctx.fill();

    ctx.font = "9px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(
      `${Math.round(clampedPeak)} dB`,
      barX + barWidth / 2,
      barY + barHeight + 14
    );

    ctx.restore();
  }

  renderFrame({
    data: dataBuffer,
    sampleRate = 44100,
    minDb = -100,
    maxDb = -30,
    peakDb = -100,
    timestamp = 0,
  } = {}) {
    const data = dataBuffer ? new Uint8Array(dataBuffer) : new Uint8Array(0);
    const now =
      timestamp ||
      (typeof performance !== "undefined" ? performance.now() : Date.now());
    const nyquist = sampleRate / 2;

    if (peakDb > this.smoothedPeakDb) {
      this.smoothedPeakDb = peakDb;
    } else {
      this.smoothedPeakDb = Math.max(minDb, this.smoothedPeakDb - 1.2);
    }

    const { width, height, plotX, plotY, plotWidth, plotHeight } =
      this.getPlotDimensions();

    // 1. Scroll heatmap buffer and render incoming frequency column
    if (this.spectrogramCtx && this.spectrogramCanvas && data.length > 0) {
      if (this.bufferCtx && this.bufferCanvas) {
        this.bufferCtx.drawImage(this.spectrogramCanvas, 0, 0);
        this.spectrogramCtx.drawImage(this.bufferCanvas, -this.sliceWidth, 0);
      }

      const colX = plotWidth - this.sliceWidth;
      const binCount = data.length;

      for (let y = 0; y < plotHeight; y++) {
        const freq = yToFrequency(y, nyquist, plotHeight, this.isLogarithmic);
        const binIndex = Math.min(
          binCount - 1,
          Math.max(0, Math.floor((freq / nyquist) * binCount))
        );
        const value = data[binIndex];
        const r = this.colormap[value * 4];
        const g = this.colormap[value * 4 + 1];
        const b = this.colormap[value * 4 + 2];

        this.spectrogramCtx.fillStyle = `rgb(${r},${g},${b})`;
        this.spectrogramCtx.fillRect(colX, y, this.sliceWidth, 1);
      }

      for (const marker of this.timeMarkers) {
        marker.x -= this.sliceWidth;
      }
      this.timeMarkers = this.timeMarkers.filter(m => m.x >= 0);

      if (now - this.lastMarkerTime >= 1000) {
        this.timeMarkers.push({ x: plotWidth, time: now });
        this.lastMarkerTime = now;
      }
    }

    // 2. Composite onto transferred display canvas
    if (this.ctx) {
      this.ctx.fillStyle = "#0a0d14";
      this.ctx.fillRect(0, 0, width, height);

      if (this.spectrogramCanvas) {
        this.ctx.drawImage(this.spectrogramCanvas, plotX, plotY);
      }

      this.drawFrequencyAxis(
        this.ctx,
        nyquist,
        plotX,
        plotY,
        plotWidth,
        plotHeight
      );

      this.drawTimeAxis(this.ctx, plotX, plotY, plotWidth, plotHeight, now);

      this.drawDecibelColorbar(
        this.ctx,
        minDb,
        maxDb,
        this.smoothedPeakDb,
        plotX,
        plotY,
        plotWidth,
        plotHeight
      );
    }
  }

  destroy() {
    this.spectrogramCanvas = null;
    this.spectrogramCtx = null;
    this.bufferCanvas = null;
    this.bufferCtx = null;
    this.ctx = null;
    this.canvas = null;
  }
}

// Attach worker message listener when running in worker context
if (
  typeof self !== "undefined" &&
  typeof self.postMessage === "function" &&
  typeof WorkerGlobalScope !== "undefined"
) {
  let renderer = null;

  self.onmessage = event => {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "init":
        renderer = new SpectrogramWorkerRenderer({
          canvas: msg.canvas,
          width: msg.width,
          height: msg.height,
          isLogarithmic: msg.isLogarithmic,
          layout: msg.layout,
          sliceWidth: msg.sliceWidth,
        });
        break;

      case "resize":
        if (renderer) renderer.resize(msg.width, msg.height);
        break;

      case "setScale":
        if (renderer) renderer.setScale(msg.scale);
        break;

      case "frame":
        if (renderer) renderer.renderFrame(msg);
        break;

      case "renderStatic":
        if (renderer) renderer.renderStatic();
        break;

      case "destroy":
        if (renderer) {
          renderer.destroy();
          renderer = null;
        }
        break;
    }
  };
}
