const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const decodeBtn = document.getElementById("decodeBtn");
const encodeBtn = document.getElementById("encodeBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const playBtn = document.getElementById("playBtn");
const speedSlider = document.getElementById("speedSlider");
const speedValue = document.getElementById("speedValue");

let audioContext = null;
let isPlaying = false;

function getWpm() {
  const value = Number(speedSlider.value);
  return Math.max(5, Math.min(60, value || 20));
}

function updateSpeed() {
  speedValue.textContent = `${getWpm()} WPM`;
}

function encodeText() {
  const text = inputText.value.trim();

  if (!text) {
    outputText.value = "";
    return;
  }

  outputText.value = MorseEngine.textToMorse(text);
}

function decodeText() {
  const morse = inputText.value.trim();

  if (!morse) {
    outputText.value = "";
    return;
  }

  outputText.value = MorseEngine.morseToText(morse);
}

function clearFields() {
  inputText.value = "";
  outputText.value = "";
  updateCopyButton("📋 Copy");
}

async function copyOutput() {
  const value = outputText.value.trim();

  if (!value) return;

  try {
    await navigator.clipboard.writeText(value);
    updateCopyButton("✓ Copied!");

    setTimeout(() => {
      updateCopyButton("📋 Copy");
    }, 1200);
  } catch {
    updateCopyButton("Copy failed");

    setTimeout(() => {
      updateCopyButton("📋 Copy");
    }, 1200);
  }
}

function updateCopyButton(text) {
  copyBtn.textContent = text;
}

async function playMorse() {
  const morse = outputText.value.trim();

  if (!morse || isPlaying) return;

  isPlaying = true;
  playBtn.disabled = true;
  playBtn.textContent = "■ Playing...";

  try {
    if (!audioContext) {
      audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const sequence = MorseEngine.generateAudioSequence(
      morse,
      getWpm(),
      650
    );

    for (const item of sequence) {
      if (item.type === "tone") {
        await beep(audioContext, item.durationMs, item.frequency);
      } else {
        await wait(item.durationMs);
      }
    }
  } finally {
    isPlaying = false;
    playBtn.disabled = false;
    playBtn.textContent = "▶ Play";
  }
}

function beep(context, duration, frequency) {
  return new Promise(resolve => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.15,
      context.currentTime + 0.01
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + duration / 1000
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + duration / 1000);

    oscillator.addEventListener("ended", resolve, { once: true });
  });
}

function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

speedSlider.addEventListener("input", updateSpeed);
encodeBtn.addEventListener("click", encodeText);
decodeBtn.addEventListener("click", decodeText);
clearBtn.addEventListener("click", clearFields);
copyBtn.addEventListener("click", copyOutput);
playBtn.addEventListener("click", playMorse);

updateSpeed();