const { NOTES, NOTE_NAMES } = WaveformEngine;
/**
 * Audio Waveform & Tone Generator — Main Script
 *
 * Uses the Web Audio API to synthesize waveforms (Sine, Square, Sawtooth,
 * Triangle) with real-time oscilloscope visualization on Canvas, plus an
 * interactive piano keyboard (C4–B4).
 */

/* ──── DOM Refs ────────────────────────────────────────────────────── */



const waveBtns = document.querySelectorAll(".wave-btn");
const freqSlider = document.getElementById("freqSlider");
const freqDisplay = document.getElementById("freqDisplay");
const volSlider = document.getElementById("volSlider");
const volDisplay = document.getElementById("volDisplay");
const playBtn = document.getElementById("playBtn");
const statusText = document.getElementById("statusText");
const canvas = document.getElementById("waveform");
const ctx = canvas ? canvas.getContext("2d") : null;
const canvasMeta = document.getElementById("canvasMeta");
const pianoEl = document.getElementById("piano");


/* ──── Audio Helpers ──────────────────────────────────────────────── */

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  oscillator = audioCtx.createOscillator();
  gainNode = audioCtx.createGain();
  analyser = audioCtx.createAnalyser();

  analyser.fftSize = 1024;
  const bufferLen = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLen);

  oscillator.type = currentWave;
  oscillator.frequency.setValueAtTime(currentFreq, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(currentVol, audioCtx.currentTime);

  oscillator.connect(gainNode);
  gainNode.connect(analyser);
  analyser.connect(audioCtx.destination);

  oscillator.start();
}

function ensureResumed() {
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function updateOscillator() {
  if (!oscillator) return;
  try {
    oscillator.type = currentWave;
    oscillator.frequency.setValueAtTime(currentFreq, audioCtx.currentTime);
  } catch {
    // oscillator may be stopped; rebuild
  }
}

function updateVolume() {
  if (gainNode) {
    gainNode.gain.setValueAtTime(currentVol, audioCtx.currentTime);
  }
}

/* ──── Start / Stop ───────────────────────────────────────────────── */

function start() {
  initAudio();
  ensureResumed();

  isPlaying = true;
  playBtn.textContent = "⏹ Stop";
  playBtn.classList.add("playing");
  statusText.textContent = "Playing";
  statusText.style.color = "#10b981";

  updateOscillator();
  updateVolume();
  startVisualization();
}

function stop() {
  isPlaying = false;
  playBtn.textContent = "▶ Play";
  playBtn.classList.remove("playing");
  statusText.textContent = "Stopped";
  statusText.style.color = "#64748b";

  stopVisualization();
  clearCanvas();
}

function togglePlay() {
  if (isPlaying) {
    stop();
  } else {
    start();
  }
}

/* ──── Visualization ──────────────────────────────────────────────── */

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = 200 * dpr;
  canvas.style.width = rect.width + "px";
  canvas.style.height = "200px";
  if (ctx) ctx.scale(dpr, dpr);
}

function drawWaveform() {
  if (!canvas || !ctx) return;

  if (!isPlaying || !analyser) {
    clearCanvas();
    animId = requestAnimationFrame(drawWaveform);
    return;
  }

  analyser.getByteTimeDomainData(dataArray);

  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);

  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = "#0a0e1a";
  ctx.fillRect(0, 0, w, h);

  // Center line
  ctx.strokeStyle = "#1f2d4a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  // Waveform
  const sliceWidth = w / dataArray.length;
  let x = 0;

  ctx.strokeStyle = "#7c3aed";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(124, 58, 237, 0.5)";
  ctx.shadowBlur = 6;
  ctx.beginPath();

  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 128.0; // normalize: 0–255 → 0.0–2.0
    const y = (v * h) / 2;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    x += sliceWidth;
  }

  ctx.stroke();
  ctx.shadowBlur = 0;

  // Update meta
  const peak = Math.max(...dataArray);
  canvasMeta.textContent = `Peak: ${Math.round((peak / 255) * 100)}%`;

  animId = requestAnimationFrame(drawWaveform);
}

function startVisualization() {
  stopVisualization();
  resizeCanvas();
  animId = requestAnimationFrame(drawWaveform);
}

function stopVisualization() {
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
}

function clearCanvas() {
  if (!canvas || !ctx) return;
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);

  ctx.fillStyle = "#0a0e1a";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#1f2d4a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  if (canvasMeta) canvasMeta.textContent = "—";
}

/* ──── Wave Type ──────────────────────────────────────────────────── */

if (waveBtns) waveBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    waveBtns.forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-pressed", "true");

    currentWave = btn.dataset.wave;
    if (isPlaying) {
      updateOscillator();
    }
  });
});

/* ──── Frequency ──────────────────────────────────────────────────── */

freqSlider?.addEventListener("input", () => {
  if (!freqSlider) return;
  currentFreq = parseFloat(freqSlider.value);
  if (freqDisplay) freqDisplay.textContent = Math.round(currentFreq) + " Hz";
  if (isPlaying) {
    updateOscillator();
  }
});

/* ──── Volume ─────────────────────────────────────────────────────── */

volSlider?.addEventListener("input", () => {
  if (!volSlider) return;
  currentVol = parseFloat(volSlider.value) / 100;
  if (volDisplay) volDisplay.textContent = Math.round(volSlider.value) + "%";
  if (isPlaying) {
    updateVolume();
  }
});

/* ──── Play Button ────────────────────────────────────────────────── */

playBtn?.addEventListener("click", togglePlay);

/* ──── Piano Keyboard ─────────────────────────────────────────────── */

function buildPiano() {
  if (!pianoEl) return;
  pianoEl.innerHTML = "";

  if (Array.isArray(NOTES)) NOTES.forEach(({ note, freq }) => {
    const key = document.createElement("div");
    key.className = "piano-key";
    key.dataset.note = note;
    key.dataset.freq = freq;

    key.innerHTML = `
      <span class="note-label">${note}</span>
      <span class="freq-label">${freq} Hz</span>
    `;

    key.addEventListener("mousedown", e => {
      e.preventDefault();
      playNote(note, freq, key);
    });

    key.addEventListener("mouseenter", e => {
      if (e.buttons & 1) {
        // Mouse button is held while dragging across keys
        playNote(note, freq, key);
      }
    });

    // Touch support
    key.addEventListener("touchstart", e => {
      e.preventDefault();
      playNote(note, freq, key);
    });

    pianoEl.appendChild(key);
  });
}

function playNote(note, freq, keyEl) {
  // Set oscillator frequency
  currentFreq = freq;
  if (freqSlider) freqSlider.value = freq;
  if (freqDisplay) freqDisplay.textContent = Math.round(freq) + " Hz";

  // If not playing, start
  if (!isPlaying) {
    start();
  } else {
    updateOscillator();
  }

  // Visual feedback
  document
    .querySelectorAll(".piano-key")
    .forEach(k => k.classList.remove("active"));
  if (keyEl) keyEl.classList.add("active");
}

/* ──── Keyboard Shortcuts ─────────────────────────────────────────── */

document.addEventListener("keydown", e => {
  // Space = toggle play
  if (e.key === " " && e.target === document.body) {
    e.preventDefault();
    togglePlay();
    return;
  }

  // Number keys for wave types
  const waveMap = { 1: "sine", 2: "square", 3: "sawtooth", 4: "triangle" };
  const wave = waveMap[e.key];
  if (wave) {
    const btn = document.querySelector(`.wave-btn[data-wave="${wave}"]`);
    if (btn) btn.click();
    return;
  }

  // Piano keys: A=C4, S=D4, D=E4, F=F4, G=G4, H=A4, J=B4
  const keyNoteMap = {
    a: "C4",
    s: "D4",
    d: "E4",
    f: "F4",
    g: "G4",
    h: "A4",
    j: "B4",
  };
  const note = keyNoteMap[e.key.toLowerCase()];
  if (note) {
    e.preventDefault();
    const freq = NOTE_NAMES[note];
    const keyEl = document.querySelector(`.piano-key[data-note="${note}"]`);
    if (keyEl) playNote(note, freq, keyEl);
  }
});

// Release piano key on mouseup anywhere
document.addEventListener("mouseup", () => {
  document
    .querySelectorAll(".piano-key")
    .forEach(k => k.classList.remove("active"));
});

/* ──── Resize ─────────────────────────────────────────────────────── */

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (isPlaying) resizeCanvas();
    else clearCanvas();
  }, 150);
});

/* ──── Initialization ─────────────────────────────────────────────── */

buildPiano();
resizeCanvas();
clearCanvas();
