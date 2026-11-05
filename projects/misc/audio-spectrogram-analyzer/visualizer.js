import {
  frequencyToY,
  yToFrequency,
  getFrequencyTicks,
  getDecibelTicks,
  formatFrequency,
} from "./scale.js";

/**
 * Spectrogram Visualizer
 * Renders a scrolling time-frequency heatmap on Canvas 2D with calibrated
 * Frequency Y-axis ticks (Linear / Logarithmic), scrolling Time markers,
 * and a dynamic dBFS colorbar.
 */
export class SpectrogramVisualizer {
  constructor(canvasId) {
    this.canvas =
      typeof canvasId === "string"
        ? typeof document !== "undefined"
          ? document.getElementById(canvasId)
          : null
        : canvasId;
    this.ctx =
      this.canvas && typeof this.canvas.getContext === "function"
        ? this.canvas.getContext("2d")
        : null;

    this.isRunning = false;
    this.animationId = null;
    this.colormap = this.generateMagmaColormap();

    // Scale & calibration options
    this.isLogarithmic = false;
    this.sliceWidth = 2; // Pixels per frequency column
    this.timeMarkers = []; // Active scrolling time markers [{ x, time }]
    this.lastMarkerTime = 0;
    this.smoothedPeakDb = -100;

    // Layout margins around the central spectrogram heatmap
    this.layout = {
      marginTop: 22,
      marginBottom: 28,
      marginLeft: 62,
      marginRight: 64,
    };

    // Offscreen spectrogram canvas & buffer canvas
    if (typeof document !== "undefined") {
      this.spectrogramCanvas = document.createElement("canvas");
      this.spectrogramCtx = this.spectrogramCanvas.getContext("2d");
      this.bufferCanvas = document.createElement("canvas");
      this.bufferCtx = this.bufferCanvas.getContext("2d");
    } else {
      this.spectrogramCanvas = null;
      this.spectrogramCtx = null;
      this.bufferCanvas = null;
      this.bufferCtx = null;
    }

    this.boundResize = this.resizeCanvas.bind(this);
    this.resizeCanvas();

    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.boundResize);
    }

    // Render initial static calibrated axes
    this.renderStatic();
  }

  getPlotDimensions() {
    const width = this.canvas ? this.canvas.width : 800;
    const height = this.canvas ? this.canvas.height : 400;
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

  resizeCanvas() {
    if (!this.canvas) return;
    if (
      this.canvas.parentElement &&
      typeof this.canvas.parentElement.getBoundingClientRect === "function"
    ) {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      if (rect.width > 0) this.canvas.width = rect.width;
      if (rect.height > 0) this.canvas.height = rect.height;
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

    if (!this.isRunning) {
      this.renderStatic();
    }
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
      if (!this.isRunning) {
        this.renderStatic();
      }
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
          const localT =
            (t - stops[j].pos) / (stops[j + 1].pos - stops[j].pos);
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
    this.lastMarkerTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.draw(audioProcessor);
  }

  stop() {
    this.isRunning = false;
    if (this.animationId !== null) {
      if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.animationId);
      }
      this.animationId = null;
    }
  }

  destroy() {
    this.stop();
    if (this.boundResize && typeof window !== "undefined") {
      window.removeEventListener("resize", this.boundResize);
    }
  }

  renderStatic() {
    if (!this.ctx || !this.canvas) return;
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

    // Frequency Y-axis border
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY);
    ctx.lineTo(plotX, plotY + plotHeight);
    ctx.stroke();

    // Axis title
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
        frequencyToY(
          tick.freq,
          nyquist,
          plotHeight,
          this.isLogarithmic
        );

      // Tick mark
      ctx.strokeStyle = "#6b7280";
      ctx.beginPath();
      ctx.moveTo(plotX - 4, y);
      ctx.lineTo(plotX, y);
      ctx.stroke();

      // Dotted horizontal grid line across spectrogram
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
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

    // Time X-axis border
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotHeight);
    ctx.lineTo(plotX + plotWidth, plotY + plotHeight);
    ctx.stroke();

    // 0s (current time) at right edge
    ctx.fillStyle = "#e5e7eb";
    ctx.strokeStyle = "#9ca3af";
    ctx.beginPath();
    ctx.moveTo(plotX + plotWidth, plotY + plotHeight);
    ctx.lineTo(plotX + plotWidth, plotY + plotHeight + 4);
    ctx.stroke();
    ctx.fillText("0s", plotX + plotWidth, plotY + plotHeight + 6);

    // Active scrolling time markers
    for (const marker of this.timeMarkers) {
      const screenX = plotX + marker.x;
      if (screenX >= plotX && screenX <= plotX + plotWidth - 10) {
        // Vertical dashed gridline
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(screenX, plotY);
        ctx.lineTo(screenX, plotY + plotHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Bottom tick mark
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

    // Time axis label
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

    // Title
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("dBFS", barX - 2, barY - 8);

    // Colorbar Gradient (Top = Max / Bright, Bottom = Min / Dark)
    const gradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    gradient.addColorStop(0.0, "rgb(255, 255, 255)");
    gradient.addColorStop(0.2, "rgb(240, 150, 50)");
    gradient.addColorStop(0.4, "rgb(180, 50, 50)");
    gradient.addColorStop(0.6, "rgb(100, 20, 80)");
    gradient.addColorStop(0.8, "rgb(30, 15, 60)");
    gradient.addColorStop(1.0, "rgb(0, 0, 4)");

    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Colorbar border
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Calibrated dBFS tick marks & labels
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

    // Dynamic dBFS peak needle indicator
    const clampedPeak = Math.max(minDb, Math.min(peakDb, maxDb));
    const peakNorm = (clampedPeak - minDb) / (maxDb - minDb);
    const needleY = barY + barHeight * (1 - peakNorm);

    // Pointer notch & indicator line
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX - 3, needleY);
    ctx.lineTo(barX + barWidth + 3, needleY);
    ctx.stroke();

    // Triangle notch pointing into the bar
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(barX - 4, needleY);
    ctx.lineTo(barX - 8, needleY - 4);
    ctx.lineTo(barX - 8, needleY + 4);
    ctx.closePath();
    ctx.fill();

    // Dynamic digital readout below colorbar
    ctx.font = "9px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(`${Math.round(clampedPeak)} dB`, barX + barWidth / 2, barY + barHeight + 14);

    ctx.restore();
  }

  draw(audioProcessor) {
    if (!this.isRunning) return;

    const data = audioProcessor ? audioProcessor.getFrequencyData() : new Uint8Array(0);
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();

    const sampleRate =
      audioProcessor && typeof audioProcessor.getSampleRate === "function"
        ? audioProcessor.getSampleRate()
        : 44100;
    const nyquist = sampleRate / 2;

    const minDb =
      audioProcessor && typeof audioProcessor.getMinDecibels === "function"
        ? audioProcessor.getMinDecibels()
        : -100;
    const maxDb =
      audioProcessor && typeof audioProcessor.getMaxDecibels === "function"
        ? audioProcessor.getMaxDecibels()
        : -30;

    const currentPeakDb =
      audioProcessor && typeof audioProcessor.getPeakDecibels === "function"
        ? audioProcessor.getPeakDecibels()
        : minDb;

    // Smooth peak decay for natural meter movement
    if (currentPeakDb > this.smoothedPeakDb) {
      this.smoothedPeakDb = currentPeakDb;
    } else {
      this.smoothedPeakDb = Math.max(minDb, this.smoothedPeakDb - 1.2);
    }

    const { width, height, plotX, plotY, plotWidth, plotHeight } =
      this.getPlotDimensions();

    // Step 1: Scroll and draw new frequency column on offscreen spectrogram canvas
    if (this.spectrogramCtx && this.spectrogramCanvas && data.length > 0) {
      // Shift left by sliceWidth
      if (this.bufferCtx && this.bufferCanvas) {
        this.bufferCtx.drawImage(this.spectrogramCanvas, 0, 0);
        this.spectrogramCtx.drawImage(this.bufferCanvas, -this.sliceWidth, 0);
      }

      // Draw new vertical column on the right
      const colX = plotWidth - this.sliceWidth;
      const binCount = data.length;

      for (let y = 0; y < plotHeight; y++) {
        const freq = yToFrequency(
          y,
          nyquist,
          plotHeight,
          this.isLogarithmic
        );
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

      // Update scrolling time markers
      for (const marker of this.timeMarkers) {
        marker.x -= this.sliceWidth;
      }
      this.timeMarkers = this.timeMarkers.filter(m => m.x >= 0);

      // Add a time marker every 1.0 second (1000 ms)
      if (now - this.lastMarkerTime >= 1000) {
        this.timeMarkers.push({ x: plotWidth, time: now });
        this.lastMarkerTime = now;
      }
    }

    // Step 2: Render full composited frame on display canvas
    if (this.ctx) {
      this.ctx.fillStyle = "#0a0d14";
      this.ctx.fillRect(0, 0, width, height);

      // Draw scrolling heatmap inside plot rectangle
      if (this.spectrogramCanvas) {
        this.ctx.drawImage(this.spectrogramCanvas, plotX, plotY);
      }

      // Draw calibrated Y-axis frequency ticks & grid
      this.drawFrequencyAxis(
        this.ctx,
        nyquist,
        plotX,
        plotY,
        plotWidth,
        plotHeight
      );

      // Draw calibrated X-axis time markers & grid
      this.drawTimeAxis(
        this.ctx,
        plotX,
        plotY,
        plotWidth,
        plotHeight,
        now
      );

      // Draw dynamic dBFS colorbar with peak needle
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

    if (typeof requestAnimationFrame === "function") {
      this.animationId = requestAnimationFrame(() =>
        this.draw(audioProcessor)
      );
    }
  }
}
