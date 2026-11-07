const doc = typeof document !== "undefined" ? document : null;
const win = typeof window !== "undefined" ? window : null;

// Core Editor & Toolbar Elements
const inputText = doc ? doc.getElementById("inputText") : null;
const outputText = doc ? doc.getElementById("outputText") : null;
const decodeBtn = doc ? doc.getElementById("decodeBtn") : null;
const encodeBtn = doc ? doc.getElementById("encodeBtn") : null;
const clearBtn = doc ? doc.getElementById("clearBtn") : null;
const copyBtn = doc ? doc.getElementById("copyBtn") : null;
const playBtn = doc ? doc.getElementById("playBtn") : null;
const speedSlider = doc ? doc.getElementById("speedSlider") : null;
const speedValue = doc ? doc.getElementById("speedValue") : null;

// Audio Synthesis & Farnsworth Timing Elements
const pitchSlider = doc ? doc.getElementById("pitchSlider") : null;
const pitchValue = doc ? doc.getElementById("pitchValue") : null;
const testPitchBtn = doc ? doc.getElementById("testPitchBtn") : null;
const farnsworthToggle = doc ? doc.getElementById("farnsworthToggle") : null;
const farnsworthControls = doc ? doc.getElementById("farnsworthControls") : null;
const farnsworthSlider = doc ? doc.getElementById("farnsworthSlider") : null;
const farnsworthValue = doc ? doc.getElementById("farnsworthValue") : null;

// Live Audio Decoder Elements
const startDecoderBtn = doc ? doc.getElementById("startDecoderBtn") : null;
const decoderStatus = doc ? doc.getElementById("decoderStatus") : null;
const cwSignalLed = doc ? doc.getElementById("cwSignalLed") : null;
const liveMorseBuffer = doc ? doc.getElementById("liveMorseBuffer") : null;
const decoderVisualizer = doc ? doc.getElementById("decoderVisualizer") : null;
const detectedPeakFreq = doc ? doc.getElementById("detectedPeakFreq") : null;
const signalLevelText = doc ? doc.getElementById("signalLevelText") : null;
const thresholdLineText = doc ? doc.getElementById("thresholdLineText") : null;
const decoderFreqSlider = doc ? doc.getElementById("decoderFreqSlider") : null;
const decoderFreqValue = doc ? doc.getElementById("decoderFreqValue") : null;
const decoderThresholdSlider = doc ? doc.getElementById("decoderThresholdSlider") : null;
const decoderThresholdValue = doc ? doc.getElementById("decoderThresholdValue") : null;
const decoderWpmSlider = doc ? doc.getElementById("decoderWpmSlider") : null;
const decoderWpmValue = doc ? doc.getElementById("decoderWpmValue") : null;
const decodedFeed = doc ? doc.getElementById("decodedFeed") : null;
const copyDecodedBtn = doc ? doc.getElementById("copyDecodedBtn") : null;
const clearDecodedBtn = doc ? doc.getElementById("clearDecodedBtn") : null;
const sendToInputBtn = doc ? doc.getElementById("sendToInputBtn") : null;

const engine =
  typeof MorseEngine !== "undefined"
    ? MorseEngine
    : typeof require === "function"
      ? require("./morseEngine.js")
      : null;

// Audio synthesis state
let audioContext = null;
let isPlaying = false;
let activeOscillator = null;
let activeGain = null;
let waitTimeoutId = null;
let playbackSessionId = 0;
let resolveActiveTone = null;
let resolveActiveWait = null;

// Live decoder audio state
let decoderStream = null;
let decoderSourceNode = null;
let decoderFilterNode = null;
let decoderAnalyserNode = null;
let decoderRafId = null;
let isListening = false;
let streamDecoder = null;
let freqDataArray = null;

function getWpm() {
  if (!speedSlider) return 20;
  const value = Number(speedSlider.value);
  return Math.max(5, Math.min(60, value || 20));
}

function updateSpeed() {
  if (speedValue) {
    speedValue.textContent = `${getWpm()} WPM`;
  }
  if (farnsworthSlider) {
    farnsworthSlider.max = String(getWpm());
    if (Number(farnsworthSlider.value) > getWpm()) {
      farnsworthSlider.value = String(getWpm());
      updateFarnsworth();
    }
  }
}

function getPitch() {
  if (!pitchSlider) return 650;
  const value = Number(pitchSlider.value);
  return Math.max(300, Math.min(1000, value || 650));
}

function updatePitch() {
  if (pitchValue) {
    pitchValue.textContent = `${getPitch()} Hz`;
  }
}

function getFarnsworthEnabled() {
  return farnsworthToggle ? Boolean(farnsworthToggle.checked) : false;
}

function getFarnsworthWpm() {
  if (!getFarnsworthEnabled() || !farnsworthSlider) return null;
  const value = Number(farnsworthSlider.value);
  return Math.max(5, Math.min(getWpm(), value || 12));
}

function updateFarnsworth() {
  const isEnabled = getFarnsworthEnabled();
  if (farnsworthControls) {
    if (isEnabled) {
      farnsworthControls.classList.remove("is-disabled");
    } else {
      farnsworthControls.classList.add("is-disabled");
    }
  }
  if (farnsworthSlider) {
    farnsworthSlider.disabled = !isEnabled;
  }
  if (farnsworthValue) {
    const val = getFarnsworthWpm() || (farnsworthSlider ? Number(farnsworthSlider.value) : 12);
    farnsworthValue.textContent = `${val} WPM`;
  }
}

function getDecoderFreq() {
  if (!decoderFreqSlider) return 650;
  const value = Number(decoderFreqSlider.value);
  return Math.max(300, Math.min(1000, value || 650));
}

function updateDecoderFreq() {
  const freq = getDecoderFreq();
  if (decoderFreqValue) {
    decoderFreqValue.textContent = `${freq} Hz`;
  }
  if (decoderFilterNode && audioContext && audioContext.state !== "closed") {
    try {
      decoderFilterNode.frequency.setValueAtTime(freq, audioContext.currentTime);
    } catch {
      // Ignored if audio context state unavailable
    }
  }
}

function getDecoderThreshold() {
  if (!decoderThresholdSlider) return 40;
  const value = Number(decoderThresholdSlider.value);
  return Math.max(10, Math.min(90, value || 40));
}

function updateDecoderThreshold() {
  if (decoderThresholdValue) {
    decoderThresholdValue.textContent = String(getDecoderThreshold());
  }
  if (thresholdLineText) {
    thresholdLineText.textContent = `Threshold: ${getDecoderThreshold()}`;
  }
}

function getDecoderWpm() {
  if (!decoderWpmSlider) return 20;
  const value = Number(decoderWpmSlider.value);
  return Math.max(5, Math.min(60, value || 20));
}

function updateDecoderWpm() {
  const wpm = getDecoderWpm();
  if (decoderWpmValue) {
    decoderWpmValue.textContent = `${wpm} WPM`;
  }
  if (streamDecoder) {
    streamDecoder.setWpm(wpm);
  }
}

function encodeText() {
  if (!inputText || !outputText) return;
  const text = inputText.value.trim();

  if (!text) {
    outputText.value = "";
    return;
  }

  outputText.value = engine ? engine.textToMorse(text) : "";
}

function decodeText() {
  if (!inputText || !outputText) return;
  const morse = inputText.value.trim();

  if (!morse) {
    outputText.value = "";
    return;
  }

  outputText.value = engine ? engine.morseToText(morse) : "";
}

function clearFields() {
  stopAudio();
  if (inputText) inputText.value = "";
  if (outputText) outputText.value = "";
  updateCopyButton("📋 Copy");
}

async function copyOutput() {
  if (!outputText) return;
  const value = outputText.value.trim();

  if (!value) return;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      updateCopyButton("✓ Copied!");

      setTimeout(() => {
        updateCopyButton("📋 Copy");
      }, 1200);
    }
  } catch {
    updateCopyButton("Copy failed");

    setTimeout(() => {
      updateCopyButton("📋 Copy");
    }, 1200);
  }
}

function updateCopyButton(text) {
  if (copyBtn) {
    copyBtn.textContent = text;
  }
}

function ensureAudioContext() {
  if (!audioContext || audioContext.state === "closed") {
    const AudioCtx =
      (win && (win.AudioContext || win.webkitAudioContext)) ||
      (typeof globalThis !== "undefined" &&
        (globalThis.AudioContext || globalThis.webkitAudioContext));
    if (AudioCtx) {
      audioContext = new AudioCtx();
    }
  }
  return audioContext;
}

function stopAudio(options = {}) {
  const shouldClose =
    typeof options === "boolean"
      ? options
      : Boolean(options && (options.closeContext || options.destroy));

  isPlaying = false;
  playbackSessionId++;

  if (activeOscillator) {
    try {
      activeOscillator.stop();
    } catch {
      // Ignored if oscillator already stopped
    }
    try {
      activeOscillator.disconnect();
    } catch {
      // Ignored if already disconnected
    }
    activeOscillator = null;
  }

  if (activeGain) {
    try {
      if (
        audioContext &&
        activeGain.gain &&
        typeof activeGain.gain.cancelScheduledValues === "function"
      ) {
        activeGain.gain.cancelScheduledValues(audioContext.currentTime);
        activeGain.gain.setValueAtTime(0, audioContext.currentTime);
      }
    } catch {
      // Ignored if context closed or scheduled values cannot be cancelled
    }
    try {
      activeGain.disconnect();
    } catch {
      // Ignored if already disconnected
    }
    activeGain = null;
  }

  if (waitTimeoutId) {
    clearTimeout(waitTimeoutId);
    waitTimeoutId = null;
  }

  if (resolveActiveTone) {
    const res = resolveActiveTone;
    resolveActiveTone = null;
    res();
  }

  if (resolveActiveWait) {
    const res = resolveActiveWait;
    resolveActiveWait = null;
    res();
  }

  if (shouldClose) {
    stopListening();
  }

  if (audioContext && audioContext.state !== "closed") {
    try {
      if (shouldClose) {
        if (typeof audioContext.close === "function") {
          audioContext.close().catch(() => {});
        }
        audioContext = null;
      } else {
        if (typeof audioContext.suspend === "function") {
          audioContext.suspend().catch(() => {});
        }
      }
    } catch {
      // Ignored if suspend or close throws synchronously
    }
  }

  if (playBtn) {
    playBtn.disabled = false;
    playBtn.textContent = "▶ Play";
  }
}

function handlePageExit() {
  stopListening();
  stopAudio({ closeContext: true });
}

async function playMorse() {
  if (!outputText) return;
  const morse = outputText.value.trim();

  if (!morse || isPlaying) return;

  isPlaying = true;
  if (playBtn) {
    playBtn.disabled = true;
    playBtn.textContent = "■ Playing...";
  }

  const currentSession = ++playbackSessionId;

  try {
    ensureAudioContext();

    if (audioContext && audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch (err) {
        console.warn("AudioContext resume rejected:", err);
        isPlaying = false;
        if (playBtn) {
          playBtn.disabled = false;
          playBtn.textContent = "⚠ Click to enable audio";
          playBtn.onclick = async () => {
            playBtn.onclick = null;
            try {
              await audioContext.resume();
              playBtn.textContent = "▶ Play";
              playMorse();
            } catch (e) {
              console.error("Audio resume retry failed:", e);
            }
          };
        }
        return;
      }
    }

    if (!audioContext || !isPlaying || playbackSessionId !== currentSession) {
      return;
    }

    const wpm = getWpm();
    const frequency = getPitch();
    const farnsworthWpm = getFarnsworthWpm();

    const sequence = engine
      ? engine.generateAudioSequence(morse, wpm, frequency, farnsworthWpm)
      : [];

    for (const item of sequence) {
      if (!isPlaying || playbackSessionId !== currentSession) break;

      if (item.type === "tone") {
        await beep(audioContext, item.durationMs, item.frequency);
      } else {
        await wait(item.durationMs);
      }

      if (!isPlaying || playbackSessionId !== currentSession) break;
    }
  } finally {
    if (playbackSessionId === currentSession) {
      isPlaying = false;
      if (playBtn) {
        playBtn.disabled = false;
        playBtn.textContent = "▶ Play";
      }
    }
  }
}

async function testPitch() {
  if (isPlaying) return;
  ensureAudioContext();
  if (audioContext && audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      return;
    }
  }
  if (!audioContext || audioContext.state === "closed") return;

  try {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const freq = getPitch();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  } catch {
    // Ignored in headless/test environments
  }
}

function beep(context, duration, frequency = 650) {
  return new Promise(resolve => {
    if (!isPlaying || !context || context.state === "closed") {
      resolve();
      return;
    }

    let oscillator = null;
    let gain = null;

    try {
      oscillator = context.createOscillator();
      gain = context.createGain();
    } catch {
      resolve();
      return;
    }

    activeOscillator = oscillator;
    activeGain = gain;
    resolveActiveTone = resolve;

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);

    oscillator.connect(gain);
    gain.connect(context.destination);

    const onEnded = () => {
      if (activeOscillator === oscillator) {
        activeOscillator = null;
        activeGain = null;
      }
      if (resolveActiveTone === resolve) {
        resolveActiveTone = null;
      }
      resolve();
    };

    oscillator.addEventListener("ended", onEnded, { once: true });

    try {
      oscillator.start();
      oscillator.stop(now + duration / 1000);
    } catch {
      onEnded();
    }
  });
}

function wait(ms) {
  return new Promise(resolve => {
    if (!isPlaying) {
      resolve();
      return;
    }

    resolveActiveWait = resolve;
    waitTimeoutId = setTimeout(() => {
      waitTimeoutId = null;
      if (resolveActiveWait === resolve) {
        resolveActiveWait = null;
      }
      resolve();
    }, ms);
  });
}

// =========================================================
// LIVE AUDIO DECODER ENGINE & SPECTRUM VISUALIZER
// =========================================================

function drawVisualizer(freqData, sampleRate, targetFreq, threshold) {
  if (!decoderVisualizer) return;
  const canvas = decoderVisualizer;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  ctx.fillStyle = "#080c14";
  ctx.fillRect(0, 0, width, height);

  if (!freqData || freqData.length === 0) {
    ctx.strokeStyle = "#1f2937";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    return;
  }

  // Draw frequency bars in the 200 Hz - 1200 Hz window
  const fftSize = freqData.length * 2;
  const binResolution = sampleRate / fftSize;
  const startFreq = 200;
  const endFreq = 1200;
  const startBin = Math.max(0, Math.floor(startFreq / binResolution));
  const endBin = Math.min(freqData.length - 1, Math.ceil(endFreq / binResolution));
  const totalBins = Math.max(1, endBin - startBin);
  const barWidth = width / totalBins;

  for (let i = startBin; i <= endBin; i += 1) {
    const mag = freqData[i];
    const barHeight = (mag / 255) * (height - 10);
    const x = (i - startBin) * barWidth;
    const y = height - barHeight;

    const binFreq = i * binResolution;
    const isNearTarget = Math.abs(binFreq - targetFreq) < 50;

    if (isNearTarget && mag >= threshold) {
      ctx.fillStyle = "#10b981"; // Active tone in green
    } else if (isNearTarget) {
      ctx.fillStyle = "#6366f1"; // Target pitch bin in indigo
    } else {
      ctx.fillStyle = "#374151"; // Background spectrum
    }

    ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
  }

  // Draw target frequency vertical line
  const targetX = ((targetFreq - startFreq) / (endFreq - startFreq)) * width;
  if (targetX >= 0 && targetX <= width) {
    ctx.strokeStyle = "rgba(129, 140, 248, 0.7)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(targetX, 0);
    ctx.lineTo(targetX, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw horizontal threshold line
  const thresholdY = height - (threshold / 100) * (height - 10);
  ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, thresholdY);
  ctx.lineTo(width, thresholdY);
  ctx.stroke();
  ctx.setLineDash([]);
}

function processDecoderFrame() {
  if (!isListening || !decoderAnalyserNode || !audioContext) return;

  if (!freqDataArray) {
    freqDataArray = new Uint8Array(decoderAnalyserNode.frequencyBinCount);
  }

  decoderAnalyserNode.getByteFrequencyData(freqDataArray);

  const sampleRate = audioContext.sampleRate || 48000;
  const targetFreq = getDecoderFreq();
  const threshold = getDecoderThreshold();

  const peakInfo = engine
    ? engine.detectPeakFrequency(freqDataArray, sampleRate, 300, 1000)
    : { frequency: targetFreq, magnitude: 0 };

  const toneCheck = engine
    ? engine.isTonePresent(freqDataArray, sampleRate, targetFreq, 90, threshold)
    : { active: false, level: 0 };

  const isToneOn = toneCheck.active;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();

  if (streamDecoder) {
    streamDecoder.processState(isToneOn, now);
  }

  // Update LED Indicator
  if (cwSignalLed) {
    if (isToneOn) {
      cwSignalLed.classList.add("active");
    } else {
      cwSignalLed.classList.remove("active");
    }
  }

  // Update Peak & Level labels
  if (detectedPeakFreq) {
    detectedPeakFreq.textContent = `Peak: ${peakInfo.frequency || targetFreq} Hz`;
  }
  if (signalLevelText) {
    signalLevelText.textContent = `Level: ${toneCheck.level} / 100`;
  }

  // Update Status Pill
  if (decoderStatus) {
    if (isToneOn) {
      decoderStatus.className = "status-badge status-active";
      decoderStatus.textContent = "Signal In";
    } else {
      decoderStatus.className = "status-badge status-listening";
      decoderStatus.textContent = "Listening";
    }
  }

  // Render Visualizer
  drawVisualizer(freqDataArray, sampleRate, targetFreq, threshold);

  if (isListening) {
    decoderRafId = (win && win.requestAnimationFrame) ? win.requestAnimationFrame(processDecoderFrame) : null;
  }
}

async function startListening() {
  if (isListening) return;

  if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (decoderStatus) {
      decoderStatus.className = "status-badge status-error";
      decoderStatus.textContent = "Mic Unsupported";
    }
    return;
  }

  try {
    ensureAudioContext();
    if (audioContext && audioContext.state === "suspended") {
      await audioContext.resume();
    }

    if (startDecoderBtn) {
      startDecoderBtn.textContent = "⏳ Accessing Mic...";
      startDecoderBtn.disabled = true;
    }

    decoderStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    if (!audioContext || audioContext.state === "closed") {
      ensureAudioContext();
    }

    decoderSourceNode = audioContext.createMediaStreamSource(decoderStream);
    decoderFilterNode = audioContext.createBiquadFilter();
    decoderFilterNode.type = "bandpass";
    decoderFilterNode.frequency.setValueAtTime(getDecoderFreq(), audioContext.currentTime);
    decoderFilterNode.Q.value = 6;

    decoderAnalyserNode = audioContext.createAnalyser();
    decoderAnalyserNode.fftSize = 1024;
    decoderAnalyserNode.smoothingTimeConstant = 0.2;

    decoderSourceNode.connect(decoderFilterNode);
    decoderFilterNode.connect(decoderAnalyserNode);
    // Note: Do NOT connect to audioContext.destination to avoid acoustic feedback!

    streamDecoder = engine ? engine.createMorseStreamDecoder({
      wpm: getDecoderWpm(),
      onSymbol: (_symbol, buffer) => {
        if (liveMorseBuffer) {
          liveMorseBuffer.textContent = buffer || "—";
        }
      },
      onCharacter: (char) => {
        if (decodedFeed) {
          decodedFeed.value += char;
          decodedFeed.scrollTop = decodedFeed.scrollHeight;
        }
        if (liveMorseBuffer) {
          liveMorseBuffer.textContent = "—";
        }
      },
      onWordSpace: () => {
        if (decodedFeed && !decodedFeed.value.endsWith(" ")) {
          decodedFeed.value += " ";
          decodedFeed.scrollTop = decodedFeed.scrollHeight;
        }
      },
      onUpdate: (state) => {
        if (liveMorseBuffer && !state.buffer) {
          liveMorseBuffer.textContent = "—";
        }
      },
    }) : null;

    isListening = true;

    if (startDecoderBtn) {
      startDecoderBtn.disabled = false;
      startDecoderBtn.classList.add("is-listening");
      startDecoderBtn.textContent = "⏹ Stop Listening";
    }

    if (decoderStatus) {
      decoderStatus.className = "status-badge status-listening";
      decoderStatus.textContent = "Listening";
    }

    processDecoderFrame();
  } catch (err) {
    console.error("Microphone access error:", err);
    stopListening();
    if (decoderStatus) {
      decoderStatus.className = "status-badge status-error";
      decoderStatus.textContent = "Mic Denied";
    }
    if (startDecoderBtn) {
      startDecoderBtn.disabled = false;
      startDecoderBtn.textContent = "🎤 Start Listening";
    }
  }
}

function stopListening() {
  isListening = false;

  if (decoderRafId && win && win.cancelAnimationFrame) {
    win.cancelAnimationFrame(decoderRafId);
    decoderRafId = null;
  }

  if (decoderSourceNode) {
    try {
      decoderSourceNode.disconnect();
    } catch {
      // Ignored
    }
    decoderSourceNode = null;
  }

  if (decoderFilterNode) {
    try {
      decoderFilterNode.disconnect();
    } catch {
      // Ignored
    }
    decoderFilterNode = null;
  }

  if (decoderAnalyserNode) {
    try {
      decoderAnalyserNode.disconnect();
    } catch {
      // Ignored
    }
    decoderAnalyserNode = null;
  }

  if (decoderStream) {
    try {
      decoderStream.getTracks().forEach(track => track.stop());
    } catch {
      // Ignored
    }
    decoderStream = null;
  }

  if (streamDecoder) {
    streamDecoder.flushBuffer();
  }

  if (cwSignalLed) {
    cwSignalLed.classList.remove("active");
  }

  if (liveMorseBuffer) {
    liveMorseBuffer.textContent = "—";
  }

  if (startDecoderBtn) {
    startDecoderBtn.classList.remove("is-listening");
    startDecoderBtn.textContent = "🎤 Start Listening";
    startDecoderBtn.disabled = false;
  }

  if (decoderStatus) {
    decoderStatus.className = "status-badge status-idle";
    decoderStatus.textContent = "Idle";
  }

  drawVisualizer(null, 48000, getDecoderFreq(), getDecoderThreshold());
}

function toggleDecoder() {
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
}

async function copyDecodedText() {
  if (!decodedFeed) return;
  const val = decodedFeed.value.trim();
  if (!val) return;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(val);
      if (copyDecodedBtn) {
        copyDecodedBtn.textContent = "✓ Copied!";
        setTimeout(() => {
          if (copyDecodedBtn) copyDecodedBtn.textContent = "📋 Copy Decoded";
        }, 1200);
      }
    }
  } catch {
    if (copyDecodedBtn) {
      copyDecodedBtn.textContent = "Copy failed";
      setTimeout(() => {
        if (copyDecodedBtn) copyDecodedBtn.textContent = "📋 Copy Decoded";
      }, 1200);
    }
  }
}

function clearDecodedText() {
  if (decodedFeed) {
    decodedFeed.value = "";
  }
  if (streamDecoder) {
    streamDecoder.reset();
  }
}

function sendDecodedToInput() {
  if (!decodedFeed || !inputText) return;
  const text = decodedFeed.value.trim();
  if (!text) return;
  inputText.value = text;
  encodeText();
}

// Event Listeners Wiring
if (speedSlider) speedSlider.addEventListener("input", updateSpeed);
if (pitchSlider) pitchSlider.addEventListener("input", updatePitch);
if (testPitchBtn) testPitchBtn.addEventListener("click", testPitch);
if (farnsworthToggle) farnsworthToggle.addEventListener("change", updateFarnsworth);
if (farnsworthSlider) farnsworthSlider.addEventListener("input", updateFarnsworth);

if (encodeBtn) encodeBtn.addEventListener("click", encodeText);
if (decodeBtn) decodeBtn.addEventListener("click", decodeText);
if (clearBtn) clearBtn.addEventListener("click", clearFields);
if (copyBtn) copyBtn.addEventListener("click", copyOutput);
if (playBtn) playBtn.addEventListener("click", playMorse);

if (startDecoderBtn) startDecoderBtn.addEventListener("click", toggleDecoder);
if (decoderFreqSlider) decoderFreqSlider.addEventListener("input", updateDecoderFreq);
if (decoderThresholdSlider) decoderThresholdSlider.addEventListener("input", updateDecoderThreshold);
if (decoderWpmSlider) decoderWpmSlider.addEventListener("input", updateDecoderWpm);
if (copyDecodedBtn) copyDecodedBtn.addEventListener("click", copyDecodedText);
if (clearDecodedBtn) clearDecodedBtn.addEventListener("click", clearDecodedText);
if (sendToInputBtn) sendToInputBtn.addEventListener("click", sendDecodedToInput);

// Initial values update
if (speedSlider && speedValue) updateSpeed();
if (pitchSlider && pitchValue) updatePitch();
if (farnsworthToggle) updateFarnsworth();
if (decoderFreqSlider && decoderFreqValue) updateDecoderFreq();
if (decoderThresholdSlider && decoderThresholdValue) updateDecoderThreshold();
if (decoderWpmSlider && decoderWpmValue) updateDecoderWpm();

if (win) {
  win.addEventListener("pagehide", handlePageExit);
  win.addEventListener("beforeunload", handlePageExit);
  win.addEventListener("unload", handlePageExit);
  win.addEventListener("popstate", handlePageExit);
  win.stopMorseAudio = stopAudio;
  win.MorseStudio = {
    stopAudio,
    handlePageExit,
    playMorse,
    beep,
    wait,
    testPitch,
    getWpm,
    getPitch,
    getFarnsworthWpm,
    startListening,
    stopListening,
    toggleDecoder,
    getAudioState: () => ({
      isPlaying,
      activeOscillator,
      activeGain,
      audioContext,
      waitTimeoutId,
      playbackSessionId,
    }),
    getDecoderState: () => ({
      isListening,
      decoderStream,
      decoderSourceNode,
      decoderFilterNode,
      decoderAnalyserNode,
      streamDecoder,
    }),
    setAudioContext: ctx => {
      audioContext = ctx;
    },
    setIsPlaying: val => {
      isPlaying = val;
    },
    setActiveNodes: (osc, gain) => {
      activeOscillator = osc;
      activeGain = gain;
    },
  };
}

if (doc) {
  doc.addEventListener("visibilitychange", () => {
    if (doc.hidden) {
      stopAudio();
    }
  });

  const onNavigationTrigger = e => {
    const target = e.target;
    const backBtn =
      target &&
      target.closest &&
      target.closest(
        ".cradle-back-home, [data-cradle-back-to-home], .back-home, #backHome, a[href*='index.html'], a[href='/']"
      );
    if (backBtn) {
      handlePageExit();
    }
  };

  doc.addEventListener("click", onNavigationTrigger, { capture: true });
  doc.addEventListener("pointerdown", onNavigationTrigger, { capture: true });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    stopAudio,
    handlePageExit,
    playMorse,
    beep,
    wait,
    testPitch,
    getWpm,
    getPitch,
    getFarnsworthWpm,
    startListening,
    stopListening,
    toggleDecoder,
    getAudioState: () => ({
      isPlaying,
      activeOscillator,
      activeGain,
      audioContext,
      waitTimeoutId,
      playbackSessionId,
    }),
    getDecoderState: () => ({
      isListening,
      decoderStream,
      decoderSourceNode,
      decoderFilterNode,
      decoderAnalyserNode,
      streamDecoder,
    }),
    setAudioContext: ctx => {
      audioContext = ctx;
    },
    setIsPlaying: val => {
      isPlaying = val;
    },
    setActiveNodes: (osc, gain) => {
      activeOscillator = osc;
      activeGain = gain;
    },
  };
}
