/**
 * Sound Wave Visualizer
 * Real-time audio visualization using the Web Audio API + Canvas 2D.
 * Features: Waveform, Frequency Spectrum (FFT), Spectrogram, Recording + Playback.
 */

"use strict";

// ──────────────────────────────────────────────────────────────────────────────
// Config & State
// ──────────────────────────────────────────────────────────────────────────────
const COLOR_THEMES = {
  cyan: {
    wave: "#06b6d4",
    spec: ["#06b6d4", "#0ea5e9", "#38bdf8"],
    spgStart: [6, 182, 212],
    spgEnd: [14, 165, 233],
  },
  violet: {
    wave: "#8b5cf6",
    spec: ["#7c3aed", "#8b5cf6", "#c084fc"],
    spgStart: [124, 58, 237],
    spgEnd: [192, 132, 252],
  },
  amber: {
    wave: "#f59e0b",
    spec: ["#d97706", "#f59e0b", "#fbbf24"],
    spgStart: [217, 119, 6],
    spgEnd: [251, 191, 36],
  },
  green: {
    wave: "#10b981",
    spec: ["#059669", "#10b981", "#34d399"],
    spgStart: [5, 150, 105],
    spgEnd: [52, 211, 153],
  },
  rainbow: { wave: null, spec: null, spgStart: null, spgEnd: null },
};

let audioCtx = null;
let analyser = null;
let gainNode = null;
let mediaStream = null;
let mediaRecorder = null;
let sourceNode = null;

let recordedChunks = [];
let recordings = []; // { id, name, url, blob, duration }
let currentPlayback = null; // { audio, id }

let isRecording = false;
let timerInterval = null;
let timerStart = 0;
let animFrameId = null;

let settings = {
  fftSize: 2048,
  smoothing: 0.8,
  gain: 1,
  colorScheme: "violet",
};

function getPeakLevel(dataArray) {
    if (typeof VisualizerEngine !== 'undefined') {
        return VisualizerEngine.calculatePeakLevel(dataArray);
    }
    let max = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const val = Math.abs(dataArray[i] - 128);
        if (val > max) max = val;
    }
    return Math.min(1, max / 128);
}

// ──────────────────────────────────────────────────────────────────────────────
// DOM
// ──────────────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const ui = {
  btnRecord: $("btn-record"),
  btnRecordLabel: $("btn-record-label"),
  recordIcon: $("record-icon"),
  btnStop: $("btn-stop"),
  btnPlay: $("btn-play"),
  btnDownload: $("btn-download"),
  timer: $("timer"),
  statusPill: $("status-pill"),
  statusDot: $("status-dot"),
  statusText: $("status-text"),

  // settings
  fftSizeSelect: $("fft-size"),
  smoothingRange: $("smoothing"),
  smoothingVal: $("smoothing-val"),
  gainRange: $("gain"),
  gainVal: $("gain-val"),
  colorSchemeSelect: $("color-scheme"),

  // canvases
  canvasWaveform: $("canvas-waveform"),
  canvasSpectrum: $("canvas-spectrum"),
  canvasSpectrogram: $("canvas-spectrogram"),

  // info labels
  waveformMeta: $("waveform-meta"),
  spectrumMeta: $("spectrum-meta"),
  freqAxis: $("freq-axis"),

  // recordings
  recordingsList: $("recordings-list"),
  emptyRecordings: $("empty-recordings"),
};

// Canvas contexts
const ctxWave = ui.canvasWaveform.getContext("2d");
const ctxSpec = ui.canvasSpectrum.getContext("2d");
const ctxSpgm = ui.canvasSpectrogram.getContext("2d");

// ──────────────────────────────────────────────────────────────────────────────
// Canvas Setup — responsive sizing
// ──────────────────────────────────────────────────────────────────────────────
function resizeCanvases() {
  [ui.canvasWaveform, ui.canvasSpectrum, ui.canvasSpectrogram].forEach(c => {
    const rect = c.parentElement.getBoundingClientRect();
    c.width = Math.max(100, Math.floor(rect.width));
    c.height = Math.max(60, Math.floor(rect.height));
  });
  buildFreqAxis();
}

// ──────────────────────────────────────────────────────────────────────────────
// Audio Graph Setup
// ──────────────────────────────────────────────────────────────────────────────
async function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  analyser = audioCtx.createAnalyser();
  applyAnalyserSettings();

  gainNode = audioCtx.createGain();
  gainNode.gain.value = settings.gain;
  gainNode.connect(analyser);
  analyser.connect(audioCtx.destination);
}

function applyAnalyserSettings() {
  analyser.fftSize = settings.fftSize;
  analyser.smoothingTimeConstant = settings.smoothing;
}

// ──────────────────────────────────────────────────────────────────────────────
// Recording
// ──────────────────────────────────────────────────────────────────────────────
async function startRecording() {
  try {
    await initAudio();
    if (audioCtx.state === "suspended") await audioCtx.resume();

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    sourceNode = audioCtx.createMediaStreamSource(mediaStream);
    sourceNode.connect(gainNode);

    // MediaRecorder for capture
    recordedChunks = [];
    const mime = getSupportedMimeType();
    mediaRecorder = new MediaRecorder(
      mediaStream,
      mime ? { mimeType: mime } : {}
    );
    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = finalizeRecording;
    mediaRecorder.start(100);

    isRecording = true;
    timerStart = performance.now();
    timerInterval = setInterval(updateTimer, 100);

    setStatus("recording", "● Recording");
    ui.btnRecord.classList.add("recording");
    ui.btnRecordLabel.textContent = "Recording…";
    ui.recordIcon.textContent = "⏹";
    ui.btnStop.disabled = false;
    ui.timer.classList.add("recording");

    startAnimation();
  } catch (err) {
    console.error("[Visualizer] Mic access failed:", err);
    setStatus("error", "Mic access denied or unavailable");
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }

  isRecording = false;
  clearInterval(timerInterval);
  timerInterval = null;

  setStatus("stopped", "Stopped");
  ui.btnRecord.classList.remove("recording");
  ui.btnRecordLabel.textContent = "Record";
  ui.recordIcon.textContent = "⏺";
  ui.btnStop.disabled = true;
  ui.timer.classList.remove("recording");
}

function finalizeRecording() {
  if (recordedChunks.length === 0) return;

  const blob = new Blob(recordedChunks, {
    type: recordedChunks[0].type || "audio/webm",
  });
  const url = URL.createObjectURL(blob);
  const id = `rec-${Date.now()}`;
  const now = new Date();
  const name = `Recording ${now.toLocaleTimeString()}`;
  const durationSec = parseFloat(
    ((performance.now() - timerStart) / 1000).toFixed(1)
  );

  recordings.push({ id, name, url, blob, duration: durationSec });
  renderRecordings();

  // Enable play / download for the latest
  ui.btnPlay.disabled = false;
  ui.btnDownload.disabled = false;
  ui.btnPlay.dataset.recId = id;
  ui.btnDownload.dataset.recId = id;
}

function getSupportedMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || "";
}

// ──────────────────────────────────────────────────────────────────────────────
// Playback
// ──────────────────────────────────────────────────────────────────────────────
function playRecording(recId) {
  stopPlayback();
  const rec = recordings.find(r => r.id === recId);
  if (!rec) return;

  const audio = new Audio(rec.url);
  audio.play();
  audio.onended = () => {
    currentPlayback = null;
    setStatus("ready", "Ready");
    updatePlayButtons(recId, false);
  };
  currentPlayback = { audio, id: recId };
  setStatus("playing", "▶ Playing");
  updatePlayButtons(recId, true);
}

function stopPlayback() {
  if (currentPlayback) {
    currentPlayback.audio.pause();
    updatePlayButtons(currentPlayback.id, false);
    currentPlayback = null;
  }
}

function togglePlayback(recId) {
  if (currentPlayback && currentPlayback.id === recId) {
    stopPlayback();
    setStatus("ready", "Ready");
  } else {
    playRecording(recId);
  }
}

function updatePlayButtons(recId, playing) {
  document
    .querySelectorAll(`.rec-play-btn[data-id="${recId}"]`)
    .forEach(btn => {
      btn.textContent = playing ? "⏸" : "▶";
      btn.classList.toggle("rec-playing", playing);
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// Timer
// ──────────────────────────────────────────────────────────────────────────────
function updateTimer() {
  const elapsed = (performance.now() - timerStart) / 1000;
  const minutes = Math.floor(elapsed / 60);
  const seconds = Math.floor(elapsed % 60);
  const tenths = Math.floor((elapsed % 1) * 10);
  ui.timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Animation Loop
// ──────────────────────────────────────────────────────────────────────────────
function startAnimation() {
  if (animFrameId) return;
  drawLoop();
}

function stopAnimation() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

function drawLoop() {
  animFrameId = requestAnimationFrame(drawLoop);

  if (!analyser) return;

  const bufferLength = analyser.frequencyBinCount; // fftSize / 2
  const timeData = new Uint8Array(bufferLength);
  const freqData = new Uint8Array(bufferLength);

  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  drawWaveform(timeData);
  drawSpectrum(freqData, bufferLength);
  drawSpectrogram(freqData, bufferLength);
}

// ──────────────────────────────────────────────────────────────────────────────
// Waveform
// ──────────────────────────────────────────────────────────────────────────────
function drawWaveform(data) {
  const c = ui.canvasWaveform;
  const cx = ctxWave;
  const W = c.width,
    H = c.height;
  const theme = COLOR_THEMES[settings.colorScheme];

  cx.clearRect(0, 0, W, H);

  // Background
  cx.fillStyle = "#0a0e1a";
  cx.fillRect(0, 0, W, H);

  // Centre line
  cx.strokeStyle = "rgba(255,255,255,0.05)";
  cx.lineWidth = 1;
  cx.beginPath();
  cx.moveTo(0, H / 2);
  cx.lineTo(W, H / 2);
  cx.stroke();

  // Waveform
  const sliceWidth = W / data.length;
  let rms = 0;

  cx.lineWidth = 1.5;
  cx.shadowBlur = 8;

  if (settings.colorScheme === "rainbow") {
    // Each segment coloured by hue
    for (let i = 0; i < data.length - 1; i++) {
      const hue = (i / data.length) * 360;
      cx.strokeStyle = `hsl(${hue}, 80%, 60%)`;
      cx.shadowColor = `hsl(${hue}, 80%, 60%)`;
      cx.beginPath();
      const x0 = i * sliceWidth;
      const y0 = (data[i] / 255 - 0.5) * H + H / 2;
      const x1 = (i + 1) * sliceWidth;
      const y1 = (data[i + 1] / 255 - 0.5) * H + H / 2;
      cx.moveTo(x0, y0);
      cx.lineTo(x1, y1);
      cx.stroke();
      rms += Math.pow(data[i] / 128 - 1, 2);
    }
  } else {
    cx.strokeStyle = theme.wave;
    cx.shadowColor = theme.wave;
    cx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * sliceWidth;
      const v = data[i] / 255 - 0.5;
      const y = v * H + H / 2;
      rms += v * v;
      if (i === 0) cx.moveTo(x, y);
      else cx.lineTo(x, y);
    }
    cx.stroke();
  }

  cx.shadowBlur = 0;

  // RMS dB
  rms = Math.sqrt(rms / data.length);
  const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  ui.waveformMeta.textContent = isFinite(db)
    ? `${db.toFixed(1)} dB RMS`
    : "— dB RMS";
}

// ──────────────────────────────────────────────────────────────────────────────
// Frequency Spectrum
// ──────────────────────────────────────────────────────────────────────────────
function drawSpectrum(data, bufferLength) {
  const c = ui.canvasSpectrum;
  const cx = ctxSpec;
  const W = c.width,
    H = c.height;
  const theme = COLOR_THEMES[settings.colorScheme];

  cx.clearRect(0, 0, W, H);
  cx.fillStyle = "#0a0e1a";
  cx.fillRect(0, 0, W, H);

  // Grid lines
  cx.strokeStyle = "rgba(255,255,255,0.04)";
  cx.lineWidth = 1;
  for (let db = 0; db <= 255; db += 64) {
    const y = H - (db / 255) * H;
    cx.beginPath();
    cx.moveTo(0, y);
    cx.lineTo(W, y);
    cx.stroke();
  }

  const barW = Math.max(1, W / bufferLength);
  let peakFreq = 0,
    peakMag = 0;

  for (let i = 0; i < bufferLength; i++) {
    const magnitude = data[i];
    const barH = (magnitude / 255) * H;
    const x = i * barW;

    let fillColor;
    if (settings.colorScheme === "rainbow") {
      fillColor = `hsl(${(i / bufferLength) * 270}, 80%, 55%)`;
    } else {
      // Gradient by magnitude
      const t = magnitude / 255;
      fillColor = blendColors(theme.spec[0], theme.spec[2], t);
    }

    cx.fillStyle = fillColor;
    cx.fillRect(x, H - barH, barW - 0.5, barH);

    if (magnitude > peakMag) {
      peakMag = magnitude;
      peakFreq = i;
    }
  }

  // Peak frequency label
  if (audioCtx && peakMag > 10) {
    const freqHz = (peakFreq / bufferLength) * (audioCtx.sampleRate / 2);
    ui.spectrumMeta.textContent = `Peak: ${formatHz(freqHz)} @ ${peakMag} / 255`;
  } else {
    ui.spectrumMeta.textContent = "Peak: —";
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Spectrogram (scrolling time-frequency map)
// ──────────────────────────────────────────────────────────────────────────────
function drawSpectrogram(data, bufferLength) {
  const c = ui.canvasSpectrogram;
  const cx = ctxSpgm;
  const W = c.width,
    H = c.height;
  const theme = COLOR_THEMES[settings.colorScheme];

  // Scroll left by 1 pixel
  const imageData = cx.getImageData(1, 0, W - 1, H);
  cx.putImageData(imageData, 0, 0);

  // Draw new column on the right
  for (let i = 0; i < bufferLength; i++) {
    const magnitude = data[i];
    const y = H - Math.floor((i / bufferLength) * H) - 1;
    const t = magnitude / 255;

    let r, g, b;
    if (settings.colorScheme === "rainbow") {
      const hue = (1 - t) * 240; // blue (cold) → red (hot)
      [r, g, b] = hslToRgb(hue / 360, 0.8, 0.1 + t * 0.5);
    } else {
      r = Math.round(lerp(10, theme.spgStart[0], t));
      g = Math.round(lerp(10, theme.spgStart[1], t));
      b = Math.round(lerp(10, theme.spgStart[2], t));
    }

    cx.fillStyle = `rgb(${r},${g},${b})`;
    cx.fillRect(W - 1, y, 1, 1);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Frequency Axis Labels
// ──────────────────────────────────────────────────────────────────────────────
function buildFreqAxis() {
  if (!audioCtx) {
    ui.freqAxis.innerHTML = "";
    return;
  }
  const nyquist = audioCtx.sampleRate / 2;
  const labels = [0, 0.1, 0.25, 0.5, 0.75, 1.0];
  ui.freqAxis.innerHTML = labels
    .map(f => `<span class="freq-label">${formatHz(f * nyquist)}</span>`)
    .join("");
}

// ──────────────────────────────────────────────────────────────────────────────
// Recordings Render
// ──────────────────────────────────────────────────────────────────────────────
function renderRecordings() {
  if (recordings.length === 0) {
    ui.recordingsList.innerHTML = "";
    ui.emptyRecordings.hidden = false;
    return;
  }
  ui.emptyRecordings.hidden = true;

  ui.recordingsList.innerHTML = recordings
    .slice()
    .reverse()
    .map(
      rec => `
    <div class="recording-row" id="row-${rec.id}">
      <div class="recording-name">${escapeHtml(rec.name)}</div>
      <div class="recording-meta">${formatDuration(rec.duration)}</div>
      <div class="recording-actions">
        <button class="rec-play-btn" data-id="${rec.id}" title="Play / Pause">▶</button>
        <button class="rec-dl-btn"   data-id="${rec.id}" title="Download">💾</button>
        <button class="rec-del-btn"  data-id="${rec.id}" title="Delete">🗑</button>
      </div>
    </div>`
    )
    .join("");

  ui.recordingsList.querySelectorAll(".rec-play-btn").forEach(btn => {
    btn.addEventListener("click", () => togglePlayback(btn.dataset.id));
  });
  ui.recordingsList.querySelectorAll(".rec-dl-btn").forEach(btn => {
    btn.addEventListener("click", () => downloadRecording(btn.dataset.id));
  });
  ui.recordingsList.querySelectorAll(".rec-del-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteRecording(btn.dataset.id));
  });
}

function downloadRecording(recId) {
  const rec = recordings.find(r => r.id === recId);
  if (!rec) return;
  const ext = rec.blob.type.includes("ogg")
    ? "ogg"
    : rec.blob.type.includes("mp4")
      ? "mp4"
      : "webm";
  const a = document.createElement("a");
  a.href = rec.url;
  a.download = `${rec.name.replace(/[^a-z0-9]/gi, "_")}.${ext}`;
  a.click();
}

function deleteRecording(recId) {
  if (!confirm("Delete this recording?")) return;
  if (currentPlayback && currentPlayback.id === recId) stopPlayback();
  const rec = recordings.find(r => r.id === recId);
  if (rec) URL.revokeObjectURL(rec.url);
  recordings = recordings.filter(r => r.id !== recId);
  renderRecordings();
  if (recordings.length === 0) {
    ui.btnPlay.disabled = true;
    ui.btnDownload.disabled = true;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Status Helper
// ──────────────────────────────────────────────────────────────────────────────
function setStatus(state, text) {
  ui.statusDot.className = `status-dot ${state}`;
  ui.statusText.textContent = text;
}

// ──────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ──────────────────────────────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function blendColors(hex1, hex2, t) {
  const r1 = parseInt(hex1.slice(1, 3), 16),
    g1 = parseInt(hex1.slice(3, 5), 16),
    b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16),
    g2 = parseInt(hex2.slice(3, 5), 16),
    b2 = parseInt(hex2.slice(5, 7), 16);
  return `rgb(${Math.round(lerp(r1, r2, t))},${Math.round(lerp(g1, g2, t))},${Math.round(lerp(b1, b2, t))})`;
}

function formatHz(hz) {
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)}k`;
  return `${Math.round(hz)}`;
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60),
    s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function escapeHtml(str) {
  return CradleEscape.escapeHtml(str);
}

// ──────────────────────────────────────────────────────────────────────────────
// Event Wiring
// ──────────────────────────────────────────────────────────────────────────────
ui.btnRecord.addEventListener("click", () => {
  if (isRecording) {
    stopRecording();
    stopAnimation();
    // Draw one last idle frame
    requestAnimationFrame(() => {
      if (analyser) {
        const buf = new Uint8Array(analyser.frequencyBinCount);
        buf.fill(128);
        drawWaveform(buf);
      }
    });
  } else {
    startRecording();
  }
});

ui.btnStop.addEventListener("click", () => {
  if (isRecording) stopRecording();
  stopAnimation();
});

ui.btnPlay.addEventListener("click", () => {
  const recId = ui.btnPlay.dataset.recId;
  if (!recId) return;
  if (currentPlayback && currentPlayback.id === recId) {
    stopPlayback();
    setStatus("ready", "Ready");
  } else {
    playRecording(recId);
  }
});

ui.btnDownload.addEventListener("click", () => {
  const recId = ui.btnDownload.dataset.recId;
  if (recId) downloadRecording(recId);
});

// Settings
ui.fftSizeSelect.addEventListener("change", () => {
  settings.fftSize = parseInt(ui.fftSizeSelect.value, 10);
  if (analyser) {
    applyAnalyserSettings();
    buildFreqAxis();
  }
});

ui.smoothingRange.addEventListener("input", () => {
  settings.smoothing = parseFloat(ui.smoothingRange.value);
  ui.smoothingVal.textContent = settings.smoothing.toFixed(2);
  if (analyser) applyAnalyserSettings();
});

ui.gainRange.addEventListener("input", () => {
  settings.gain = parseFloat(ui.gainRange.value);
  ui.gainVal.textContent = `${settings.gain.toFixed(1)}×`;
  if (gainNode) gainNode.gain.value = settings.gain;
});

ui.colorSchemeSelect.addEventListener("change", () => {
  settings.colorScheme = ui.colorSchemeSelect.value;
  // Clear spectrogram when theme changes
  ctxSpgm.clearRect(
    0,
    0,
    ui.canvasSpectrogram.width,
    ui.canvasSpectrogram.height
  );
  ctxSpgm.fillStyle = "#0a0e1a";
  ctxSpgm.fillRect(
    0,
    0,
    ui.canvasSpectrogram.width,
    ui.canvasSpectrogram.height
  );
});

// Responsive canvas resize
const resizeObserver = new ResizeObserver(() => {
  resizeCanvases();
  // Redraw idle frames after resize
  if (analyser) {
    const buf = new Uint8Array(analyser.frequencyBinCount).fill(128);
    drawWaveform(buf);
    const freqBuf = new Uint8Array(analyser.frequencyBinCount).fill(0);
    drawSpectrum(freqBuf, freqBuf.length);
  }
});
resizeObserver.observe(document.querySelector(".visualizer-grid"));

// ──────────────────────────────────────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────────────────────────────────────
(function init() {
  resizeCanvases();

  // Draw idle state on canvases
  [ctxWave, ctxSpec, ctxSpgm].forEach((cx, i) => {
    const c = [ui.canvasWaveform, ui.canvasSpectrum, ui.canvasSpectrogram][i];
    cx.fillStyle = "#0a0e1a";
    cx.fillRect(0, 0, c.width, c.height);
    cx.fillStyle = "rgba(100,116,139,0.25)";
    cx.font = "13px Outfit, sans-serif";
    cx.textAlign = "center";
    cx.fillText("Press Record to start", c.width / 2, c.height / 2);
  });

  setStatus("ready", "Ready");
  renderRecordings();
})();
