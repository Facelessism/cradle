/**
 * Fourier Series Visualizer — Application Script
 *
 * Ties the Fourier engine to canvas rendering, user controls, and animation.
 */

/* ──── DOM Refs ────────────────────────────────────────────────────── */
const compositeCanvas = document.getElementById("compositeCanvas");
const harmonicsCanvas = document.getElementById("harmonicsCanvas");
const epicyclesCanvas = document.getElementById("epicyclesCanvas");
const spectrumCanvas = document.getElementById("spectrumCanvas");

const ctxComposite = compositeCanvas ? compositeCanvas.getContext("2d") : null;
const ctxHarmonics = harmonicsCanvas ? harmonicsCanvas.getContext("2d") : null;
const ctxEpicycles = epicyclesCanvas ? epicyclesCanvas.getContext("2d") : null;
const ctxSpectrum = spectrumCanvas ? spectrumCanvas.getContext("2d") : null;

// Mode navigation
const tabWaveforms = document.getElementById("tabWaveforms");
const tabEpicycles = document.getElementById("tabEpicycles");
const controlsWaveforms = document.getElementById("controlsWaveforms");
const controlsEpicycles = document.getElementById("controlsEpicycles");
const workspaceWaveforms = document.getElementById("workspaceWaveforms");
const workspaceEpicycles = document.getElementById("workspaceEpicycles");

// Waveform Controls
const waveBtns = document.querySelectorAll(".wave-btn");
const freqSlider = document.getElementById("freqSlider");
const harmCount = document.getElementById("harmCount");
const speedSlider = document.getElementById("speedSlider");
const freqDisplay = document.getElementById("freqDisplay");
const harmDisplay = document.getElementById("harmDisplay");
const speedDisplay = document.getElementById("speedDisplay");
const harmonicListEl = document.getElementById("harmonicList");
const animateBtn = document.getElementById("animateBtn");
const animateIcon = document.getElementById("animateIcon");
const resetBtn = document.getElementById("resetBtn");
const compositeMeta = document.getElementById("compositeMeta");
const harmonicsMeta = document.getElementById("harmonicsMeta");
const statusLeft = document.getElementById("statusLeft");
const statusRight = document.getElementById("statusRight");
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

// Epicycle Source & Presets
const srcPresetsBtn = document.getElementById("srcPresetsBtn");
const srcDrawBtn = document.getElementById("srcDrawBtn");
const srcUploadBtn = document.getElementById("srcUploadBtn");
const presetsSubpanel = document.getElementById("presetsSubpanel");
const drawSubpanel = document.getElementById("drawSubpanel");
const uploadSubpanel = document.getElementById("uploadSubpanel");
const presetBtns = document.querySelectorAll(".preset-btn");
const clearDrawBtn = document.getElementById("clearDrawBtn");
const traceDrawBtn = document.getElementById("traceDrawBtn");
const drawCanvasHint = document.getElementById("drawCanvasHint");

// Epicycle SVG Upload
const svgFileInput = document.getElementById("svgFileInput");
const uploadSvgTrigger = document.getElementById("uploadSvgTrigger");
const svgPathInput = document.getElementById("svgPathInput");
const loadSvgPathBtn = document.getElementById("loadSvgPathBtn");

// Epicycle Controls
const epicycleCountSlider = document.getElementById("epicycleCountSlider");
const epicycleCountDisplay = document.getElementById("epicycleCountDisplay");
const epicycleResolutionSelect = document.getElementById("epicycleResolutionSelect");
const epicycleSpeedSlider = document.getElementById("epicycleSpeedSlider");
const epicycleSpeedDisplay = document.getElementById("epicycleSpeedDisplay");
const epicycleScrubber = document.getElementById("epicycleScrubber");
const epicycleScrubberDisplay = document.getElementById("epicycleScrubberDisplay");
const epicyclePlayBtn = document.getElementById("epicyclePlayBtn");
const epicyclePlayIcon = document.getElementById("epicyclePlayIcon");
const epicycleResetBtn = document.getElementById("epicycleResetBtn");

// Epicycle Toggles & Themes
const chkCircles = document.getElementById("chkCircles");
const chkVectors = document.getElementById("chkVectors");
const chkTrail = document.getElementById("chkTrail");
const chkOriginal = document.getElementById("chkOriginal");
const epicycleThemeSelect = document.getElementById("epicycleThemeSelect");

// Epicycle Metrics & Status
const metricPoints = document.getElementById("metricPoints");
const metricHarmonics = document.getElementById("metricHarmonics");
const metricEnergy = document.getElementById("metricEnergy");
const metricMaxRadius = document.getElementById("metricMaxRadius");
const tipCoordDisplay = document.getElementById("tipCoordDisplay");
const epicyclesMeta = document.getElementById("epicyclesMeta");
const spectrumMeta = document.getElementById("spectrumMeta");
const epicyclesStatusLeft = document.getElementById("epicyclesStatusLeft");
const epicyclesStatusRight = document.getElementById("epicyclesStatusRight");

/* ──── State ──────────────────────────────────────────────────────── */
let activeVisualizerMode = "waveforms"; // 'waveforms' | 'epicycles'

const WAVE_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
  "#06b6d4",
  "#d946ef",
];

const EPICYCLE_THEMES = {
  indigo: {
    circle: "rgba(99, 102, 241, 0.22)",
    vector: "#818cf8",
    trail: "#6366f1",
    trailGlow: "rgba(99, 102, 241, 0.4)",
    ref: "rgba(255, 255, 255, 0.22)",
    tip: "#ffffff",
  },
  rainbow: {
    circle: "rainbow",
    vector: "rainbow",
    trail: "#ec4899",
    trailGlow: "rgba(236, 72, 153, 0.4)",
    ref: "rgba(255, 255, 255, 0.22)",
    tip: "#fbbf24",
  },
  amber: {
    circle: "rgba(245, 158, 11, 0.22)",
    vector: "#fbbf24",
    trail: "#f59e0b",
    trailGlow: "rgba(245, 158, 11, 0.4)",
    ref: "rgba(255, 255, 255, 0.22)",
    tip: "#fffbeb",
  },
  emerald: {
    circle: "rgba(16, 185, 129, 0.22)",
    vector: "#34d399",
    trail: "#10b981",
    trailGlow: "rgba(16, 185, 129, 0.4)",
    ref: "rgba(255, 255, 255, 0.22)",
    tip: "#d1fae5",
  },
};

const state = {
  waveType: "square",
  frequency: 100,
  numHarmonics: 5,
  speed: 1200, // ms per animation cycle
  animate: false,
  animId: null,
  animStartTime: null,
  activeHarmonics: new Set(), // Set of 1-indexed active harmonic numbers
  dpr: 1,
  firstRender: true,
};

const epicycleState = {
  source: "presets", // 'presets' | 'draw' | 'upload'
  preset: "heart",
  resolution: 150,
  kEpicycles: 50,
  speed: 8000, // ms per full loop
  isPlaying: true,
  time: 0,
  colorTheme: "indigo",
  showCircles: true,
  showVectors: true,
  showTrail: true,
  showOriginal: true,
  isDrawing: false,
  drawPoints: [],
  rawPoints: [],
  zeroCenteredPoints: [],
  scaledPoints: [],
  dftComponents: [],
  tracedPath: [],
  animId: null,
  lastFrameTime: null,
};

/* ──── Canvas Sizing ───────────────────────────────────────────────── */
function resizeCanvas(canvas) {
  if (!canvas) return;
  const rect = canvas.parentElement
    ? canvas.parentElement.getBoundingClientRect()
    : canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  state.dpr = dpr;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeAllCanvases() {
  resizeCanvas(compositeCanvas);
  resizeCanvas(harmonicsCanvas);
  resizeCanvas(epicyclesCanvas);
  resizeCanvas(spectrumCanvas);
}

/* ──── Drawing Helpers ────────────────────────────────────────────── */
function getThemeCanvasColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    bg: style.getPropertyValue("--canvas-bg").trim() || "#0a0e1a",
    grid:
      style.getPropertyValue("--grid-color").trim() ||
      "rgba(255, 255, 255, 0.04)",
    axis:
      style.getPropertyValue("--grid-axis-color").trim() ||
      "rgba(255, 255, 255, 0.08)",
  };
}

function clearCanvas(ctx, w, h) {
  const colors = getThemeCanvasColors();
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);
}

function drawGrid(ctx, w, h) {
  const colors = getThemeCanvasColors();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;

  // Horizontal grid lines (zero line + quarter markers)
  const midY = h / 2;
  for (let y = 0; y <= h; y += h / 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Vertical grid lines
  const step = w / 20;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // Zero axis (brighter)
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(w, midY);
  ctx.stroke();
}

function drawWaveform(ctx, samples, color, w, h, alpha) {
  const midY = h / 2;
  const amplitude = (h / 2) * 0.85;
  const len = samples.length;

  ctx.globalAlpha = alpha || 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  for (let i = 0; i < len; i++) {
    const x = (i / (len - 1)) * w;
    const y = midY - samples[i] * amplitude;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawCompositeFill(ctx, samples, w, h, color) {
  const midY = h / 2;
  const amplitude = (h / 2) * 0.85;
  const len = samples.length;

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(
    0,
    color
      .replace(")", ", 0.15)")
      .replace("rgb", "rgba")
      .replace("#6366f1", "rgba(99, 102, 241")
  );
  gradient.addColorStop(
    0.5,
    color
      .replace(")", ", 0.05)")
      .replace("rgb", "rgba")
      .replace("#6366f1", "rgba(99, 102, 241")
  );
  gradient.addColorStop(
    1,
    color
      .replace(")", ", 0.15)")
      .replace("rgb", "rgba")
      .replace("#6366f1", "rgba(99, 102, 241")
  );

  ctx.fillStyle = "rgba(99, 102, 241, 0.08)";
  ctx.beginPath();
  ctx.moveTo(0, midY);

  for (let i = 0; i < len; i++) {
    const x = (i / (len - 1)) * w;
    const y = midY - samples[i] * amplitude;
    ctx.lineTo(x, y);
  }

  ctx.lineTo(w, midY);
  ctx.closePath();
  ctx.fill();
}

/* ──── Rendering ──────────────────────────────────────────────────── */
function render() {
  if (!compositeCanvas || !harmonicsCanvas) return;
  const cw = compositeCanvas.width / state.dpr;
  const ch = compositeCanvas.height / state.dpr;
  const hw = harmonicsCanvas.width / state.dpr;
  const hh = harmonicsCanvas.height / state.dpr;

  if (cw === 0 || ch === 0) return;

  // Compute waveform data
  const sampleRate = cw; // 1 sample per pixel
  const duration = 1; // 1 cycle visible
  const result = computeWaveform(
    state.waveType,
    state.numHarmonics,
    state.frequency,
    sampleRate,
    duration,
    n => state.activeHarmonics.has(n) || state.activeHarmonics.size === 0
  );

  const normalisedSamples = normalise(result.samples);

  // Update meta info
  const effectiveHarmonics = result.harmonics ? result.harmonics.length : 0;
  const displayedHarmonics =
    state.activeHarmonics.size > 0
      ? state.activeHarmonics.size
      : state.numHarmonics;
  if (compositeMeta)
    compositeMeta.textContent = `${displayedHarmonics} harmonic${displayedHarmonics !== 1 ? "s" : ""} · ${state.frequency} Hz`;
  if (harmonicsMeta)
    harmonicsMeta.textContent = `${effectiveHarmonics} active / ${state.numHarmonics} max`;

  // ── Composite Canvas ──
  if (ctxComposite) {
    clearCanvas(ctxComposite, cw, ch);
    drawGrid(ctxComposite, cw, ch);
    drawCompositeFill(
      ctxComposite,
      normalisedSamples,
      cw,
      ch,
      "var(--theme-accent)"
    );
    drawWaveform(ctxComposite, normalisedSamples, "#6366f1", cw, ch);
  }

  // ── Harmonics Canvas ──
  if (ctxHarmonics) {
    clearCanvas(ctxHarmonics, hw, hh);
    drawGrid(ctxHarmonics, hw, hh);
  }

  const midY = hh / 2;
  const amp = (hh / 2) * 0.85;
  const maxHarmToDraw = result.harmonics ? result.harmonics.length : 0;

  for (let idx = 0; idx < maxHarmToDraw && idx < WAVE_COLORS.length; idx++) {
    const hData = result.harmonics[idx];
    if (!hData) continue;
    const n = hData.n;
    const color = WAVE_COLORS[(n - 1) % WAVE_COLORS.length];
    const hNorm = normalise(hData.samples);
    // Scale harmonic amplitude relative to fundamental
    const coeff = fourierCoeff(state.waveType, n);
    const ampScale = Math.abs(coeff.b) || Math.abs(coeff.a) || 1e-10;
    // Find max coefficient for normalisation
    let maxCoeff = 0;
    for (let k = 1; k <= state.numHarmonics; k++) {
      const c = fourierCoeff(state.waveType, k);
      const mag = Math.abs(c.b) || Math.abs(c.a);
      if (mag > maxCoeff) maxCoeff = mag;
    }

    const scaleFactor = maxCoeff > 0 ? ampScale / maxCoeff : 1;

    // Draw harmonic sub-waveform with scaled amplitude
    ctxHarmonics.strokeStyle = color;
    ctxHarmonics.lineWidth = 1.2;
    ctxHarmonics.globalAlpha = 0.7;
    ctxHarmonics.beginPath();
    for (let i = 0; i < hw; i++) {
      const t = i / sampleRate;
      const val = sampleAt(state.waveType, n, state.frequency, t, k => k === n);
      const maxVal = ampScale;
      const scaled = maxVal > 0 ? val / maxVal : val;
      const x = (i / (hw - 1)) * hw;
      const y = midY - scaled * amp * scaleFactor;
      if (i === 0) ctxHarmonics.moveTo(x, y);
      else ctxHarmonics.lineTo(x, y);
    }
    ctxHarmonics.stroke();
    ctxHarmonics.globalAlpha = 1;
  }

  // Update legend
  updateLegend(result.harmonics);
}

/* ──── Legend ──────────────────────────────────────────────────────── */
function updateLegend(harmonics) {
  const container = document.getElementById("compositeLegend");
  // Keep the first "Composite" item, replace the rest
  let items = container.querySelectorAll(".legend-item");
  let compositeLabel = items[0];

  // Clear all but first
  while (container.children.length > 1) {
    container.removeChild(container.lastChild);
  }

  for (const h of harmonics) {
    const n = h.n;
    const color = WAVE_COLORS[(n - 1) % WAVE_COLORS.length];
    const div = document.createElement("span");
    div.className = "legend-item";
    div.innerHTML = `<span class="legend-swatch" style="background:${color}"></span> n=${n}`;
    container.appendChild(div);
  }
}

/* ──── Harmonic List ──────────────────────────────────────────────── */
function buildHarmonicList() {
  if (!harmonicListEl) return;
  harmonicListEl.innerHTML = "";
  const count = harmCount ? parseInt(harmCount.value, 10) : 1;

  for (let n = 1; n <= count; n++) {
    const coeff = fourierCoeff(state.waveType, n);
    const amp = Math.abs(coeff.b) || Math.abs(coeff.a) || 0;
    const color = WAVE_COLORS[(n - 1) % WAVE_COLORS.length];

    const label = document.createElement("label");
    label.className = "harmonic-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked =
      state.activeHarmonics.size === 0 || state.activeHarmonics.has(n);
    checkbox.dataset.n = n;

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.activeHarmonics.add(n);
      } else {
        state.activeHarmonics.delete(n);
      }
      render();
    });

    const swatch = document.createElement("span");
    swatch.className = "harmonic-color";
    swatch.style.background = color;

    const nameSpan = document.createElement("span");
    nameSpan.className = "harmonic-label";
    nameSpan.textContent = `n = ${n}`;

    const ampSpan = document.createElement("span");
    ampSpan.className = "harmonic-amp";
    ampSpan.textContent = amp > 0 ? `A = ${amp.toFixed(3)}` : "A = 0";

    label.appendChild(checkbox);
    label.appendChild(swatch);
    label.appendChild(nameSpan);
    label.appendChild(ampSpan);
    harmonicListEl.appendChild(label);
  }

  // If all are checked, clear active set (meaning "all active")
  if (state.activeHarmonics.size === count) {
    state.activeHarmonics.clear();
  }
}

/* ──── Theme ───────────────────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = saved !== null ? saved === "dark" : prefersDark;
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "dark" : "light"
  );
  applyTheme(isDark);
}

function applyTheme(isDark) {
  if (themeIcon)
    themeIcon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
  if (themeToggle) themeToggle.setAttribute("aria-pressed", String(isDark));
}

themeToggle?.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  if (themeIcon)
    themeIcon.className =
      next === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
  if (themeToggle)
    themeToggle.setAttribute("aria-pressed", String(next === "dark"));
});

/* ──── Animation ──────────────────────────────────────────────────── */
function startAnimation() {
  if (state.animId) return;
  state.animate = true;
  state.animStartTime = performance.now();
  if (animateIcon) animateIcon.className = "fa-solid fa-pause";
  if (animateBtn)
    animateBtn.innerHTML =
      '<i class="fa-solid fa-pause" id="animateIcon"></i> Pause';

  // Reset to first harmonic and build up progressively
  let currentStep = 1;
  const maxSteps = Math.min(state.numHarmonics, 10); // limit for performance
  const stepDuration = state.speed / maxSteps;

  function animateFrame() {
    if (!state.animate) {
      state.animId = null;
      return;
    }

    // Use a time-based approach: cycle through harmonics
    const elapsed = performance.now() - state.animStartTime;
    const cycleMs = state.speed;
    const progress = (elapsed % cycleMs) / cycleMs;

    currentStep = Math.max(1, Math.ceil(progress * maxSteps));

    // Temporarily override active harmonics for the animation
    const prevActive = new Set(state.activeHarmonics);

    // If user has toggled some off, respect that — only animate among active ones
    if (prevActive.size > 0) {
      const activeArr = Array.from(prevActive).sort((a, b) => a - b);
      const stepIdx = Math.min(currentStep - 1, activeArr.length - 1);
      const visibleSet = new Set(activeArr.slice(0, stepIdx + 1));
      state.activeHarmonics = visibleSet;
    } else {
      const visibleSet = new Set();
      for (let i = 1; i <= currentStep; i++) {
        visibleSet.add(i);
      }
      state.activeHarmonics = visibleSet;
    }

    render();
    updateHarmonicCheckboxes();

    // Restore previous state after render (we swap for next frame)
    state.activeHarmonics = prevActive;

    state.animId = requestAnimationFrame(animateFrame);
  }

  state.animId = requestAnimationFrame(animateFrame);
}

function stopAnimation() {
  state.animate = false;
  if (state.animId) {
    cancelAnimationFrame(state.animId);
    state.animId = null;
  }
  if (animateIcon) animateIcon.className = "fa-solid fa-play";
  if (animateBtn)
    animateBtn.innerHTML =
      '<i class="fa-solid fa-play" id="animateIcon"></i> Animate Build';

  // Restore full set
  if (state.activeHarmonics.size === 0) {
    // nothing to restore — all active
  }
  render();
  buildHarmonicList();
}

function updateHarmonicCheckboxes() {
  const checkboxes = harmonicListEl.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => {
    const n = parseInt(cb.dataset.n, 10);
    cb.checked =
      state.activeHarmonics.size === 0 || state.activeHarmonics.has(n);
  });
}

animateBtn?.addEventListener("click", () => {
  if (state.animate) {
    stopAnimation();
  } else {
    startAnimation();
  }
});

resetBtn?.addEventListener("click", () => {
  if (state.animate) stopAnimation();
  state.activeHarmonics.clear();
  const count = harmCount ? parseInt(harmCount.value, 10) : 1;
  // Set first harmonic only
  state.activeHarmonics.add(1);
  // Wait — reset should show all. Clear means "all active"
  state.activeHarmonics.clear();
  render();
  buildHarmonicList();
  if (statusLeft) statusLeft.textContent = "Reset to default view";
});

/* ──── Controls Setup ─────────────────────────────────────────────── */
waveBtns.forEach(btn => {
  btn?.addEventListener("click", () => {
    waveBtns.forEach(b => b?.classList.remove("active"));
    btn.classList.add("active");
    state.waveType = btn.dataset.wave;
    state.activeHarmonics.clear();
    if (state.animate) stopAnimation();
    render();
    buildHarmonicList();
    if (statusLeft)
      statusLeft.textContent = `Switched to ${state.waveType} wave`;
  });
});

freqSlider?.addEventListener("input", () => {
  if (!freqSlider) return;
  state.frequency = parseInt(freqSlider.value, 10);
  if (freqDisplay) freqDisplay.textContent = state.frequency + " Hz";
  if (state.animate) {
    // Just update — no reset needed
  }
  render();
  if (statusLeft) statusLeft.textContent = `Frequency: ${state.frequency} Hz`;
});

harmCount?.addEventListener("input", () => {
  if (!harmCount) return;
  const val = parseInt(harmCount.value, 10);
  state.numHarmonics = val;
  if (harmDisplay) harmDisplay.textContent = val;
  state.activeHarmonics.clear();
  render();
  buildHarmonicList();
  if (statusLeft) statusLeft.textContent = `Harmonics: ${val}`;
});

speedSlider?.addEventListener("input", () => {
  if (!speedSlider) return;
  state.speed = parseInt(speedSlider.value, 10);
  if (speedDisplay)
    speedDisplay.textContent = (state.speed / 1000).toFixed(1) + "s";
  if (statusLeft)
    statusLeft.textContent = `Animation speed: ${state.speed}ms per cycle`;
});

/* ──── Epicycle Tracing & Complex 1D DFT Engine ──────────────────── */

function switchVisualizerMode(mode) {
  activeVisualizerMode = mode;

  if (tabWaveforms) {
    tabWaveforms.classList.toggle("active", mode === "waveforms");
    tabWaveforms.setAttribute("aria-selected", String(mode === "waveforms"));
  }
  if (tabEpicycles) {
    tabEpicycles.classList.toggle("active", mode === "epicycles");
    tabEpicycles.setAttribute("aria-selected", String(mode === "epicycles"));
  }

  if (controlsWaveforms) {
    controlsWaveforms.style.display = mode === "waveforms" ? "block" : "none";
  }
  if (controlsEpicycles) {
    controlsEpicycles.style.display = mode === "epicycles" ? "block" : "none";
  }
  if (workspaceWaveforms) {
    workspaceWaveforms.style.display = mode === "waveforms" ? "block" : "none";
  }
  if (workspaceEpicycles) {
    workspaceEpicycles.style.display = mode === "epicycles" ? "block" : "none";
  }

  resizeAllCanvases();

  if (mode === "epicycles") {
    if (epicycleState.dftComponents.length === 0) {
      loadPreset("heart");
    }
    if (!epicycleState.animId) {
      epicycleState.lastFrameTime = performance.now();
      epicycleState.animId = requestAnimationFrame(updateAndRenderEpicycles);
    }
  } else {
    render();
  }
}

function extractSvgPathData(svgText) {
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, "image/svg+xml");
      const paths = doc.querySelectorAll("path");
      if (paths.length > 0) {
        let combined = "";
        paths.forEach(p => {
          const d = p.getAttribute("d");
          if (d) combined += " " + d;
        });
        if (combined.trim()) return combined.trim();
      }
      const polylines = doc.querySelectorAll("polygon, polyline");
      if (polylines.length > 0) {
        const pts = polylines[0].getAttribute("points");
        if (pts) {
          const coords = pts.trim().split(/[\s,]+/);
          let d = "M " + coords[0] + " " + coords[1];
          for (let i = 2; i < coords.length; i += 2) {
            d += " L " + coords[i] + " " + coords[i + 1];
          }
          return d + " Z";
        }
      }
    } catch (_) {}
  }

  const match = svgText.match(/<path[^>]*\sd=["']([^"']+)["']/i);
  return match ? match[1] : svgText;
}

function loadEpicycleShapeFromPoints(rawPoints, shapeLabel = "Custom") {
  if (!rawPoints || rawPoints.length === 0) return;

  const w = epicyclesCanvas ? epicyclesCanvas.width / state.dpr : 600;
  const h = epicyclesCanvas ? epicyclesCanvas.height / state.dpr : 380;

  // 1. Arc-length uniform resampling
  const resampled = resamplePoints(
    rawPoints,
    epicycleState.resolution,
    true
  );
  epicycleState.rawPoints = resampled;

  // 2. Center around origin (0, 0) and scale to canvas viewport
  const zeroCentered = centerAndScalePoints(resampled, w, h, 60, true);
  epicycleState.zeroCenteredPoints = zeroCentered;

  // 3. Offset to canvas center for reference path rendering
  epicycleState.scaledPoints = zeroCentered.map(p => ({
    x: p.x + w / 2,
    y: p.y + h / 2,
  }));

  // 4. Compute 1D Complex DFT
  const dft = dft1DComplex(zeroCentered, true);
  epicycleState.dftComponents = dft;

  // 5. Update slider bounds and epicycles count
  if (epicycleCountSlider) {
    epicycleCountSlider.max = String(dft.length);
    if (epicycleState.kEpicycles > dft.length || epicycleState.kEpicycles <= 1) {
      epicycleState.kEpicycles = Math.min(50, dft.length);
      epicycleCountSlider.value = String(epicycleState.kEpicycles);
    }
  }

  // 6. Reset trajectory
  epicycleState.tracedPath = [];
  epicycleState.time = 0;

  updateEpicycleUI(shapeLabel);
  renderSpectrumCanvas();
}

function loadPreset(presetName) {
  epicycleState.preset = presetName;
  const pts = generateParametricShape(presetName, epicycleState.resolution);
  const capitalized =
    presetName.charAt(0).toUpperCase() + presetName.slice(1);
  loadEpicycleShapeFromPoints(pts, capitalized);

  presetBtns.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.preset === presetName);
  });
}

function updateEpicycleUI(shapeLabel = "") {
  const energy = computeDftEnergy(
    epicycleState.dftComponents,
    epicycleState.kEpicycles
  );

  if (epicycleCountDisplay) {
    epicycleCountDisplay.textContent = `${epicycleState.kEpicycles} (${energy.percentage}%)`;
  }
  if (metricPoints) {
    metricPoints.textContent = String(epicycleState.resolution);
  }
  if (metricHarmonics) {
    metricHarmonics.textContent = `${epicycleState.kEpicycles} / ${epicycleState.dftComponents.length}`;
  }
  if (metricEnergy) {
    metricEnergy.textContent = `${energy.percentage}%`;
  }
  if (metricMaxRadius && epicycleState.dftComponents[0]) {
    metricMaxRadius.textContent = `${epicycleState.dftComponents[0].amp.toFixed(1)} px`;
  }
  if (epicyclesMeta) {
    const label = shapeLabel || epicycleState.preset;
    epicyclesMeta.textContent = `${epicycleState.kEpicycles} epicycles · ${label} · ${(epicycleState.speed / 1000).toFixed(1)}s`;
  }
  if (spectrumMeta) {
    spectrumMeta.textContent = `Top ${epicycleState.kEpicycles} of ${epicycleState.dftComponents.length} harmonics active`;
  }
  if (epicyclesStatusLeft) {
    epicyclesStatusLeft.textContent = `Decomposed ${epicycleState.resolution} points into ${epicycleState.dftComponents.length} complex Fourier harmonics`;
  }
}

function updateScrubberUI() {
  if (epicycleScrubber) {
    const normalized = (epicycleState.time / (2 * Math.PI)) * 1000;
    epicycleScrubber.value = String(Math.round(normalized));
  }
  if (epicycleScrubberDisplay) {
    const piMultiple = (epicycleState.time / Math.PI).toFixed(2);
    epicycleScrubberDisplay.textContent = `${piMultiple}π`;
  }
}

function updateAndRenderEpicycles(timestamp) {
  if (!epicycleState.lastFrameTime) epicycleState.lastFrameTime = timestamp;
  const dt = timestamp - epicycleState.lastFrameTime;
  epicycleState.lastFrameTime = timestamp;

  if (activeVisualizerMode === "epicycles") {
    if (
      epicycleState.isPlaying &&
      !epicycleState.isDrawing &&
      epicycleState.dftComponents.length > 0
    ) {
      const deltaT = (2 * Math.PI * dt) / epicycleState.speed;
      epicycleState.time += deltaT;
      if (epicycleState.time >= 2 * Math.PI) {
        epicycleState.time = epicycleState.time % (2 * Math.PI);
        epicycleState.tracedPath = [];
      }
      updateScrubberUI();
    }

    renderEpicyclesStage();
    renderSpectrumCanvas();
  }

  epicycleState.animId = requestAnimationFrame(updateAndRenderEpicycles);
}

function renderEpicyclesStage() {
  if (!ctxEpicycles || !epicyclesCanvas) return;
  const w = epicyclesCanvas.width / state.dpr;
  const h = epicyclesCanvas.height / state.dpr;
  if (w <= 0 || h <= 0) return;

  clearCanvas(ctxEpicycles, w, h);
  drawGrid(ctxEpicycles, w, h);

  const theme =
    EPICYCLE_THEMES[epicycleState.colorTheme] || EPICYCLE_THEMES.indigo;

  // If user is currently drawing
  if (epicycleState.isDrawing && epicycleState.drawPoints.length > 1) {
    ctxEpicycles.strokeStyle = "var(--theme-accent)";
    ctxEpicycles.lineWidth = 2.5;
    ctxEpicycles.beginPath();
    for (let i = 0; i < epicycleState.drawPoints.length; i++) {
      const pt = epicycleState.drawPoints[i];
      if (i === 0) ctxEpicycles.moveTo(pt.x, pt.y);
      else ctxEpicycles.lineTo(pt.x, pt.y);
    }
    ctxEpicycles.stroke();
    return;
  }

  if (epicycleState.dftComponents.length === 0) return;

  // 1. Reference shape
  if (epicycleState.showOriginal && epicycleState.scaledPoints.length > 1) {
    ctxEpicycles.strokeStyle = theme.ref;
    ctxEpicycles.lineWidth = 1;
    ctxEpicycles.setLineDash([4, 4]);
    ctxEpicycles.beginPath();
    for (let i = 0; i < epicycleState.scaledPoints.length; i++) {
      const p = epicycleState.scaledPoints[i];
      if (i === 0) ctxEpicycles.moveTo(p.x, p.y);
      else ctxEpicycles.lineTo(p.x, p.y);
    }
    ctxEpicycles.closePath();
    ctxEpicycles.stroke();
    ctxEpicycles.setLineDash([]);
  }

  // 2. Epicycle evaluation
  const origin = { x: w / 2, y: h / 2 };
  const { circles, tip } = sampleEpicycles(
    epicycleState.dftComponents,
    epicycleState.time,
    epicycleState.kEpicycles,
    origin
  );

  // 3. Accumulate tip into trail
  if (epicycleState.isPlaying && !epicycleState.isDrawing) {
    epicycleState.tracedPath.push({ x: tip.x, y: tip.y });
    if (epicycleState.tracedPath.length > epicycleState.resolution * 2.2) {
      epicycleState.tracedPath.shift();
    }
  }

  // 4. Traced path
  if (epicycleState.showTrail && epicycleState.tracedPath.length > 1) {
    ctxEpicycles.strokeStyle = theme.trail;
    ctxEpicycles.lineWidth = 2.5;
    ctxEpicycles.shadowColor = theme.trailGlow;
    ctxEpicycles.shadowBlur = 8;
    ctxEpicycles.beginPath();
    for (let i = 0; i < epicycleState.tracedPath.length; i++) {
      const p = epicycleState.tracedPath[i];
      if (i === 0) ctxEpicycles.moveTo(p.x, p.y);
      else ctxEpicycles.lineTo(p.x, p.y);
    }
    ctxEpicycles.stroke();
    ctxEpicycles.shadowBlur = 0;
  }

  // 5. Epicycles (circles & radii vectors)
  for (let i = 0; i < circles.length; i++) {
    const c = circles[i];
    if (c.radius < 0.4) continue;

    const circleColor =
      theme.circle === "rainbow"
        ? `hsla(${(i * 360) / circles.length}, 80%, 65%, 0.22)`
        : theme.circle;

    const vectorColor =
      theme.vector === "rainbow"
        ? `hsl(${(i * 360) / circles.length}, 85%, 65%)`
        : theme.vector;

    if (epicycleState.showCircles) {
      ctxEpicycles.strokeStyle = circleColor;
      ctxEpicycles.lineWidth = 1;
      ctxEpicycles.beginPath();
      ctxEpicycles.arc(c.prevX, c.prevY, c.radius, 0, 2 * Math.PI);
      ctxEpicycles.stroke();
    }

    if (epicycleState.showVectors) {
      ctxEpicycles.strokeStyle = vectorColor;
      ctxEpicycles.lineWidth = 1.2;
      ctxEpicycles.beginPath();
      ctxEpicycles.moveTo(c.prevX, c.prevY);
      ctxEpicycles.lineTo(c.x, c.y);
      ctxEpicycles.stroke();

      ctxEpicycles.fillStyle = vectorColor;
      ctxEpicycles.beginPath();
      ctxEpicycles.arc(c.x, c.y, 1.8, 0, 2 * Math.PI);
      ctxEpicycles.fill();
    }
  }

  // 6. Tip drawing head
  ctxEpicycles.fillStyle = theme.tip;
  ctxEpicycles.shadowColor = theme.trail;
  ctxEpicycles.shadowBlur = 10;
  ctxEpicycles.beginPath();
  ctxEpicycles.arc(tip.x, tip.y, 4, 0, 2 * Math.PI);
  ctxEpicycles.fill();
  ctxEpicycles.shadowBlur = 0;

  if (tipCoordDisplay) {
    tipCoordDisplay.textContent = `x: ${Math.round(tip.x)}, y: ${Math.round(tip.y)}`;
  }
}

function renderSpectrumCanvas() {
  if (!ctxSpectrum || !spectrumCanvas) return;
  const w = spectrumCanvas.width / state.dpr;
  const h = spectrumCanvas.height / state.dpr;
  if (w <= 0 || h <= 0) return;

  clearCanvas(ctxSpectrum, w, h);

  const comps = epicycleState.dftComponents;
  if (!comps || comps.length === 0) return;

  const maxAmp = comps[0] && comps[0].amp > 0 ? comps[0].amp : 1;
  const totalBars = Math.min(comps.length, 120);
  const barWidth = Math.max(1, (w - totalBars) / totalBars);
  const activeLimit = Math.min(epicycleState.kEpicycles, totalBars);

  for (let i = 0; i < totalBars; i++) {
    const c = comps[i];
    const barHeight = Math.max(2, (c.amp / maxAmp) * (h - 24));
    const x = i * (barWidth + 1);
    const y = h - barHeight - 4;

    if (i < activeLimit) {
      ctxSpectrum.fillStyle = "var(--theme-accent)";
      ctxSpectrum.globalAlpha = 0.85;
    } else {
      ctxSpectrum.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctxSpectrum.globalAlpha = 0.4;
    }

    ctxSpectrum.fillRect(x, y, barWidth, barHeight);
  }
  ctxSpectrum.globalAlpha = 1;

  // Cutoff marker
  const cutoffX = activeLimit * (barWidth + 1);
  ctxSpectrum.strokeStyle = "#ef4444";
  ctxSpectrum.lineWidth = 1.5;
  ctxSpectrum.setLineDash([3, 3]);
  ctxSpectrum.beginPath();
  ctxSpectrum.moveTo(cutoffX, 0);
  ctxSpectrum.lineTo(cutoffX, h);
  ctxSpectrum.stroke();
  ctxSpectrum.setLineDash([]);
}

function initDrawingOnCanvas() {
  if (!epicyclesCanvas) return;

  epicyclesCanvas.addEventListener("pointerdown", e => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    try {
      epicyclesCanvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    const rect = epicyclesCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    epicycleState.isDrawing = true;
    epicycleState.drawPoints = [{ x, y }];
    epicycleState.tracedPath = [];
    if (drawCanvasHint) drawCanvasHint.style.display = "none";
  });

  epicyclesCanvas.addEventListener("pointermove", e => {
    if (!epicycleState.isDrawing) return;
    const rect = epicyclesCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const last =
      epicycleState.drawPoints[epicycleState.drawPoints.length - 1];
    if (!last || Math.hypot(x - last.x, y - last.y) > 2) {
      epicycleState.drawPoints.push({ x, y });
    }
  });

  const finishDrawing = e => {
    if (!epicycleState.isDrawing) return;
    epicycleState.isDrawing = false;
    try {
      epicyclesCanvas.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (epicycleState.drawPoints.length > 5) {
      loadEpicycleShapeFromPoints(epicycleState.drawPoints, "Custom Drawing");
    }
  };

  epicyclesCanvas.addEventListener("pointerup", finishDrawing);
  epicyclesCanvas.addEventListener("pointercancel", finishDrawing);

  // Drag and drop SVG files
  epicyclesCanvas.addEventListener("dragover", e => {
    e.preventDefault();
    e.stopPropagation();
  });
  epicyclesCanvas.addEventListener("drop", e => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSvgFile(e.dataTransfer.files[0]);
    }
  });
}

function handleSvgFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const text = ev.target ? ev.target.result : "";
    if (typeof text === "string" && text.length > 0) {
      const pathData = extractSvgPathData(text);
      if (pathData) {
        const pts = parseSvgPathToPoints(
          pathData,
          epicycleState.resolution
        );
        if (pts.length > 0) {
          loadEpicycleShapeFromPoints(pts, file.name.replace(/\.svg$/i, ""));
          if (svgPathInput) svgPathInput.value = pathData.slice(0, 200) + "...";
        }
      }
    }
  };
  reader.readAsText(file);
}

function initEpicycleControls() {
  // Mode switcher tabs
  tabWaveforms?.addEventListener("click", () => switchVisualizerMode("waveforms"));
  tabEpicycles?.addEventListener("click", () => switchVisualizerMode("epicycles"));

  // Source selector tabs
  srcPresetsBtn?.addEventListener("click", () => {
    srcPresetsBtn.classList.add("active");
    srcDrawBtn?.classList.remove("active");
    srcUploadBtn?.classList.remove("active");
    if (presetsSubpanel) presetsSubpanel.style.display = "block";
    if (drawSubpanel) drawSubpanel.style.display = "none";
    if (uploadSubpanel) uploadSubpanel.style.display = "none";
    if (drawCanvasHint) drawCanvasHint.style.display = "none";
  });

  srcDrawBtn?.addEventListener("click", () => {
    srcDrawBtn.classList.add("active");
    srcPresetsBtn?.classList.remove("active");
    srcUploadBtn?.classList.remove("active");
    if (presetsSubpanel) presetsSubpanel.style.display = "none";
    if (drawSubpanel) drawSubpanel.style.display = "block";
    if (uploadSubpanel) uploadSubpanel.style.display = "none";
    if (drawCanvasHint) drawCanvasHint.style.display = "flex";
  });

  srcUploadBtn?.addEventListener("click", () => {
    srcUploadBtn.classList.add("active");
    srcPresetsBtn?.classList.remove("active");
    srcDrawBtn?.classList.remove("active");
    if (presetsSubpanel) presetsSubpanel.style.display = "none";
    if (drawSubpanel) drawSubpanel.style.display = "none";
    if (uploadSubpanel) uploadSubpanel.style.display = "block";
    if (drawCanvasHint) drawCanvasHint.style.display = "none";
  });

  // Preset buttons
  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;
      if (preset) loadPreset(preset);
    });
  });

  // Draw subpanel buttons
  clearDrawBtn?.addEventListener("click", () => {
    epicycleState.drawPoints = [];
    epicycleState.tracedPath = [];
    if (drawCanvasHint) drawCanvasHint.style.display = "flex";
    if (ctxEpicycles && epicyclesCanvas) {
      clearCanvas(
        ctxEpicycles,
        epicyclesCanvas.width / state.dpr,
        epicyclesCanvas.height / state.dpr
      );
      drawGrid(
        ctxEpicycles,
        epicyclesCanvas.width / state.dpr,
        epicyclesCanvas.height / state.dpr
      );
    }
  });

  traceDrawBtn?.addEventListener("click", () => {
    if (epicycleState.drawPoints.length > 5) {
      loadEpicycleShapeFromPoints(epicycleState.drawPoints, "Custom Drawing");
    } else {
      loadPreset(epicycleState.preset);
    }
  });

  // Upload subpanel
  uploadSvgTrigger?.addEventListener("click", () => {
    svgFileInput?.click();
  });

  svgFileInput?.addEventListener("change", () => {
    if (svgFileInput.files && svgFileInput.files[0]) {
      handleSvgFile(svgFileInput.files[0]);
    }
  });

  loadSvgPathBtn?.addEventListener("click", () => {
    if (svgPathInput && svgPathInput.value.trim()) {
      const pathData = extractSvgPathData(svgPathInput.value.trim());
      const pts = parseSvgPathToPoints(pathData, epicycleState.resolution);
      if (pts.length > 0) {
        loadEpicycleShapeFromPoints(pts, "Custom SVG Path");
      }
    }
  });

  // Epicycle Count Slider
  epicycleCountSlider?.addEventListener("input", () => {
    epicycleState.kEpicycles = parseInt(epicycleCountSlider.value, 10);
    epicycleState.tracedPath = [];
    updateEpicycleUI();
    renderSpectrumCanvas();
  });

  // Point resolution select
  epicycleResolutionSelect?.addEventListener("change", () => {
    epicycleState.resolution = parseInt(epicycleResolutionSelect.value, 10);
    if (epicycleState.rawPoints.length > 0) {
      loadEpicycleShapeFromPoints(epicycleState.rawPoints, "Re-sampled");
    } else {
      loadPreset(epicycleState.preset);
    }
  });

  // Speed slider
  epicycleSpeedSlider?.addEventListener("input", () => {
    epicycleState.speed = parseInt(epicycleSpeedSlider.value, 10);
    if (epicycleSpeedDisplay) {
      epicycleSpeedDisplay.textContent = `${(epicycleState.speed / 1000).toFixed(1)}s`;
    }
    updateEpicycleUI();
  });

  // Scrubber
  epicycleScrubber?.addEventListener("input", () => {
    const val = parseInt(epicycleScrubber.value, 10);
    epicycleState.time = (val / 1000) * 2 * Math.PI;
    updateScrubberUI();
    renderEpicyclesStage();
  });

  // Play/Pause button
  epicyclePlayBtn?.addEventListener("click", () => {
    epicycleState.isPlaying = !epicycleState.isPlaying;
    if (epicyclePlayBtn) {
      epicyclePlayBtn.innerHTML = epicycleState.isPlaying
        ? '<i class="fa-solid fa-pause" id="epicyclePlayIcon"></i> Pause'
        : '<i class="fa-solid fa-play" id="epicyclePlayIcon"></i> Play';
    }
  });

  // Reset button
  epicycleResetBtn?.addEventListener("click", () => {
    epicycleState.time = 0;
    epicycleState.tracedPath = [];
    updateScrubberUI();
    renderEpicyclesStage();
  });

  // Toggles
  chkCircles?.addEventListener("change", () => {
    epicycleState.showCircles = chkCircles.checked;
    renderEpicyclesStage();
  });
  chkVectors?.addEventListener("change", () => {
    epicycleState.showVectors = chkVectors.checked;
    renderEpicyclesStage();
  });
  chkTrail?.addEventListener("change", () => {
    epicycleState.showTrail = chkTrail.checked;
    renderEpicyclesStage();
  });
  chkOriginal?.addEventListener("change", () => {
    epicycleState.showOriginal = chkOriginal.checked;
    renderEpicyclesStage();
  });

  // Theme selector
  epicycleThemeSelect?.addEventListener("change", () => {
    epicycleState.colorTheme = epicycleThemeSelect.value;
    renderEpicyclesStage();
  });

  initDrawingOnCanvas();
}

/* ──── Initialisation ─────────────────────────────────────────────── */
function init() {
  initTheme();
  resizeAllCanvases();

  // Initialise state
  state.activeHarmonics.clear(); // all active

  // Build harmonic list
  buildHarmonicList();

  // Epicycles setup
  initEpicycleControls();

  // First render
  render();

  // Status
  if (statusLeft)
    statusLeft.textContent =
      "Ready — adjust controls to explore Fourier series";
}

// Resize observer
const resizeObserver = new ResizeObserver(() => {
  resizeAllCanvases();
  if (activeVisualizerMode === "waveforms") {
    render();
  } else {
    renderEpicyclesStage();
    renderSpectrumCanvas();
  }
});
if (compositeCanvas?.parentElement)
  resizeObserver.observe(compositeCanvas.parentElement);
if (harmonicsCanvas?.parentElement)
  resizeObserver.observe(harmonicsCanvas.parentElement);
if (epicyclesCanvas?.parentElement)
  resizeObserver.observe(epicyclesCanvas.parentElement);
if (spectrumCanvas?.parentElement)
  resizeObserver.observe(spectrumCanvas.parentElement);

// Module Exports for Node testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    state,
    epicycleState,
    switchVisualizerMode,
    extractSvgPathData,
    loadEpicycleShapeFromPoints,
    loadPreset,
    EPICYCLE_THEMES,
  };
}

// Init on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
