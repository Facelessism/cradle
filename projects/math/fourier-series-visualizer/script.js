/**
 * Fourier Series Visualizer — Application Script
 *
 * Ties the Fourier engine to canvas rendering, user controls, and animation.
 */

/* ──── DOM Refs ────────────────────────────────────────────────────── */
const compositeCanvas = document.getElementById('compositeCanvas');
const harmonicsCanvas = document.getElementById('harmonicsCanvas');
const ctxComposite = compositeCanvas.getContext('2d');
const ctxHarmonics = harmonicsCanvas.getContext('2d');

const waveBtns = document.querySelectorAll('.wave-btn');
const freqSlider = document.getElementById('freqSlider');
const harmCount = document.getElementById('harmCount');
const speedSlider = document.getElementById('speedSlider');
const freqDisplay = document.getElementById('freqDisplay');
const harmDisplay = document.getElementById('harmDisplay');
const speedDisplay = document.getElementById('speedDisplay');
const harmonicListEl = document.getElementById('harmonicList');
const animateBtn = document.getElementById('animateBtn');
const animateIcon = document.getElementById('animateIcon');
const resetBtn = document.getElementById('resetBtn');
const compositeMeta = document.getElementById('compositeMeta');
const harmonicsMeta = document.getElementById('harmonicsMeta');
const statusLeft = document.getElementById('statusLeft');
const statusRight = document.getElementById('statusRight');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

/* ──── State ──────────────────────────────────────────────────────── */
const WAVE_COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#06b6d4',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
  '#6366f1', '#84cc16', '#06b6d4', '#d946ef',
];

const state = {
  waveType: 'square',
  frequency: 100,
  numHarmonics: 5,
  speed: 1200,                     // ms per animation cycle
  animate: false,
  animId: null,
  animStartTime: null,
  activeHarmonics: new Set(),      // Set of 1-indexed active harmonic numbers
  dpr: 1,
  firstRender: true,
};

/* ──── Canvas Sizing ───────────────────────────────────────────────── */
function resizeCanvas(canvas) {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  state.dpr = dpr;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctxComposite.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctxHarmonics.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeAllCanvases() {
  resizeCanvas(compositeCanvas);
  resizeCanvas(harmonicsCanvas);
}

/* ──── Drawing Helpers ────────────────────────────────────────────── */
function getThemeCanvasColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    bg: style.getPropertyValue('--canvas-bg').trim() || '#0a0e1a',
    grid: style.getPropertyValue('--grid-color').trim() || 'rgba(255, 255, 255, 0.04)',
    axis: style.getPropertyValue('--grid-axis-color').trim() || 'rgba(255, 255, 255, 0.08)',
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
  gradient.addColorStop(0, color.replace(')', ', 0.15)').replace('rgb', 'rgba').replace('#6366f1', 'rgba(99, 102, 241'));
  gradient.addColorStop(0.5, color.replace(')', ', 0.05)').replace('rgb', 'rgba').replace('#6366f1', 'rgba(99, 102, 241'));
  gradient.addColorStop(1, color.replace(')', ', 0.15)').replace('rgb', 'rgba').replace('#6366f1', 'rgba(99, 102, 241'));

  ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
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
  const cw = compositeCanvas.width / state.dpr;
  const ch = compositeCanvas.height / state.dpr;
  const hw = harmonicsCanvas.width / state.dpr;
  const hh = harmonicsCanvas.height / state.dpr;

  if (cw === 0 || ch === 0) return;

  // Compute waveform data
  const sampleRate = cw;  // 1 sample per pixel
  const duration = 1;     // 1 cycle visible
  const result = computeWaveform(
    state.waveType,
    state.numHarmonics,
    state.frequency,
    sampleRate,
    duration,
    (n) => state.activeHarmonics.has(n) || state.activeHarmonics.size === 0
  );

  const normalisedSamples = normalise(result.samples);

  // Update meta info
  const effectiveHarmonics = result.harmonics.length;
  const displayedHarmonics = state.activeHarmonics.size > 0
    ? state.activeHarmonics.size
    : state.numHarmonics;
  compositeMeta.textContent = `${displayedHarmonics} harmonic${displayedHarmonics !== 1 ? 's' : ''} · ${state.frequency} Hz`;
  harmonicsMeta.textContent = `${effectiveHarmonics} active / ${state.numHarmonics} max`;

  // ── Composite Canvas ──
  clearCanvas(ctxComposite, cw, ch);
  drawGrid(ctxComposite, cw, ch);
  drawCompositeFill(ctxComposite, normalisedSamples, cw, ch, 'var(--theme-accent)');
  drawWaveform(ctxComposite, normalisedSamples, '#6366f1', cw, ch);

  // ── Harmonics Canvas ──
  clearCanvas(ctxHarmonics, hw, hh);
  drawGrid(ctxHarmonics, hw, hh);

  const midY = hh / 2;
  const amp = (hh / 2) * 0.85;
  const maxHarmToDraw = result.harmonics.length;

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
      const val = sampleAt(state.waveType, n, state.frequency, t, (k) => k === n);
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
  const container = document.getElementById('compositeLegend');
  // Keep the first "Composite" item, replace the rest
  let items = container.querySelectorAll('.legend-item');
  let compositeLabel = items[0];

  // Clear all but first
  while (container.children.length > 1) {
    container.removeChild(container.lastChild);
  }

  for (const h of harmonics) {
    const n = h.n;
    const color = WAVE_COLORS[(n - 1) % WAVE_COLORS.length];
    const div = document.createElement('span');
    div.className = 'legend-item';
    div.innerHTML = `<span class="legend-swatch" style="background:${color}"></span> n=${n}`;
    container.appendChild(div);
  }
}

/* ──── Harmonic List ──────────────────────────────────────────────── */
function buildHarmonicList() {
  harmonicListEl.innerHTML = '';
  const count = parseInt(harmCount.value, 10);

  for (let n = 1; n <= count; n++) {
    const coeff = fourierCoeff(state.waveType, n);
    const amp = Math.abs(coeff.b) || Math.abs(coeff.a) || 0;
    const color = WAVE_COLORS[(n - 1) % WAVE_COLORS.length];

    const label = document.createElement('label');
    label.className = 'harmonic-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.activeHarmonics.size === 0 || state.activeHarmonics.has(n);
    checkbox.dataset.n = n;

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.activeHarmonics.add(n);
      } else {
        state.activeHarmonics.delete(n);
      }
      render();
    });

    const swatch = document.createElement('span');
    swatch.className = 'harmonic-color';
    swatch.style.background = color;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'harmonic-label';
    nameSpan.textContent = `n = ${n}`;

    const ampSpan = document.createElement('span');
    ampSpan.className = 'harmonic-amp';
    ampSpan.textContent = amp > 0 ? `A = ${amp.toFixed(3)}` : 'A = 0';

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
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved !== null ? saved === 'dark' : prefersDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  themeIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  themeToggle.setAttribute('aria-pressed', String(isDark));
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  themeIcon.className = next === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  themeToggle.setAttribute('aria-pressed', String(next === 'dark'));
});

/* ──── Animation ──────────────────────────────────────────────────── */
function startAnimation() {
  if (state.animId) return;
  state.animate = true;
  state.animStartTime = performance.now();
  animateIcon.className = 'fa-solid fa-pause';
  animateBtn.innerHTML = '<i class="fa-solid fa-pause" id="animateIcon"></i> Pause';

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
  animateIcon.className = 'fa-solid fa-play';
  animateBtn.innerHTML = '<i class="fa-solid fa-play" id="animateIcon"></i> Animate Build';

  // Restore full set
  if (state.activeHarmonics.size === 0) {
    // nothing to restore — all active
  }
  render();
  buildHarmonicList();
}

function updateHarmonicCheckboxes() {
  const checkboxes = harmonicListEl.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((cb) => {
    const n = parseInt(cb.dataset.n, 10);
    cb.checked = state.activeHarmonics.size === 0 || state.activeHarmonics.has(n);
  });
}

animateBtn.addEventListener('click', () => {
  if (state.animate) {
    stopAnimation();
  } else {
    startAnimation();
  }
});

resetBtn.addEventListener('click', () => {
  if (state.animate) stopAnimation();
  state.activeHarmonics.clear();
  const count = parseInt(harmCount.value, 10);
  // Set first harmonic only
  state.activeHarmonics.add(1);
  // Wait — reset should show all. Clear means "all active"
  state.activeHarmonics.clear();
  render();
  buildHarmonicList();
  statusLeft.textContent = 'Reset to default view';
});

/* ──── Controls Setup ─────────────────────────────────────────────── */
waveBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    waveBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.waveType = btn.dataset.wave;
    state.activeHarmonics.clear();
    if (state.animate) stopAnimation();
    render();
    buildHarmonicList();
    statusLeft.textContent = `Switched to ${state.waveType} wave`;
  });
});

freqSlider.addEventListener('input', () => {
  state.frequency = parseInt(freqSlider.value, 10);
  freqDisplay.textContent = state.frequency + ' Hz';
  if (state.animate) {
    // Just update — no reset needed
  }
  render();
  statusLeft.textContent = `Frequency: ${state.frequency} Hz`;
});

harmCount.addEventListener('input', () => {
  const val = parseInt(harmCount.value, 10);
  state.numHarmonics = val;
  harmDisplay.textContent = val;
  state.activeHarmonics.clear();
  render();
  buildHarmonicList();
  statusLeft.textContent = `Harmonics: ${val}`;
});

speedSlider.addEventListener('input', () => {
  state.speed = parseInt(speedSlider.value, 10);
  speedDisplay.textContent = (state.speed / 1000).toFixed(1) + 's';
  statusLeft.textContent = `Animation speed: ${state.speed}ms per cycle`;
});

/* ──── Initialisation ─────────────────────────────────────────────── */
function init() {
  initTheme();
  resizeAllCanvases();

  // Initialise state
  state.activeHarmonics.clear(); // all active

  // Build harmonic list
  buildHarmonicList();

  // First render
  render();

  // Status
  statusLeft.textContent = 'Ready — adjust controls to explore Fourier series';
}

// Resize observer
const resizeObserver = new ResizeObserver(() => {
  resizeAllCanvases();
  render();
});
resizeObserver.observe(compositeCanvas.parentElement);
resizeObserver.observe(harmonicsCanvas.parentElement);

// Init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
