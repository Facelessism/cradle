const keys = document.querySelectorAll(".key");
const status = document.getElementById("status");

let audioContext = null;

const activeNotes = new Map();
const activePointers = new Map();
const pressedKeyboardKeys = new Set();

const KEY_CODES = {
  KeyA: "C4",
  KeyW: "C#4",
  KeyS: "D4",
  KeyE: "D#4",
  KeyD: "E4",
  KeyF: "F4",
  KeyT: "F#4",
  KeyG: "G4",
  KeyY: "G#4",
  KeyH: "A4",
  KeyU: "A#4",
  KeyJ: "B4",
  KeyK: "C5"
};

function getAudioContext() {
  if (!audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function getKeyElement(note) {
  return [...keys].find(key => key.dataset.note === note);
}

function setKeyPressed(key, pressed) {
  if (!key) {
    return;
  }

  key.classList.toggle("active", pressed);
  key.setAttribute("aria-pressed", String(pressed));
}

function createHammerNoise(context, time) {
  const duration = 0.035;
  const bufferSize = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.value = 1400;

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.07, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);

  source.start(time);
  source.stop(time + duration);
}

function createPianoVoice(context, frequency, time) {
  const masterGain = context.createGain();
  const fundamental = context.createOscillator();
  const second = context.createOscillator();
  const third = context.createOscillator();

  fundamental.type = "triangle";
  second.type = "sine";
  third.type = "sine";

  fundamental.frequency.value = frequency;
  second.frequency.value = frequency * 2;
  third.frequency.value = frequency * 3;

  const fundamentalGain = context.createGain();
  const harmonicGain = context.createGain();

  fundamentalGain.gain.value = 0.75;
  harmonicGain.gain.value = 0.2;

  masterGain.gain.setValueAtTime(0.0001, time);
  masterGain.gain.exponentialRampToValueAtTime(0.3, time + 0.015);
  masterGain.gain.exponentialRampToValueAtTime(0.16, time + 0.3);

  fundamental.connect(fundamentalGain);
  second.connect(harmonicGain);
  third.connect(harmonicGain);

  fundamentalGain.connect(masterGain);
  harmonicGain.connect(masterGain);

  masterGain.connect(context.destination);

  fundamental.start(time);
  second.start(time);
  third.start(time);

  return {
    fundamental,
    second,
    third,
    masterGain
  };
}

function playNote(note) {
  if (!PianoEngine.isValidNote(note) || activeNotes.has(note)) {
    return;
  }

  const context = getAudioContext();
  const time = context.currentTime;
  const frequency = PianoEngine.getFrequency(note);
  const key = getKeyElement(note);

  const voice = createPianoVoice(context, frequency, time);

  createHammerNoise(context, time);

  activeNotes.set(note, voice);

  setKeyPressed(key, true);

  if (status) {
    status.textContent = `Playing ${note}`;
  }
}

function stopNote(note) {
  const voice = activeNotes.get(note);

  if (!voice) {
    return;
  }

  const context = getAudioContext();
  const time = context.currentTime;

  voice.masterGain.gain.cancelScheduledValues(time);
  voice.masterGain.gain.setValueAtTime(
    Math.max(voice.masterGain.gain.value, 0.0001),
    time
  );

  voice.masterGain.gain.exponentialRampToValueAtTime(
    0.0001,
    time + 0.4
  );

  const stopTime = time + 0.45;

  voice.fundamental.stop(stopTime);
  voice.second.stop(stopTime);
  voice.third.stop(stopTime);

  activeNotes.delete(note);

  const key = getKeyElement(note);

  setKeyPressed(key, false);

  if (activeNotes.size === 0 && status) {
    status.textContent = "Ready";
  }
}

function pressKey(key) {
  if (!key) {
    return;
  }

  playNote(key.dataset.note);
}

function releaseKey(key) {
  if (!key) {
    return;
  }

  stopNote(key.dataset.note);
}

keys.forEach(key => {
  setKeyPressed(key, false);

  key.addEventListener("pointerdown", event => {
    event.preventDefault();

    activePointers.set(event.pointerId, key);

    if (key.setPointerCapture) {
      key.setPointerCapture(event.pointerId);
    }

    pressKey(key);
  });

  key.addEventListener("pointerup", event => {
    event.preventDefault();

    const pressedKey = activePointers.get(event.pointerId);

    if (pressedKey) {
      releaseKey(pressedKey);
    }

    activePointers.delete(event.pointerId);
  });

  key.addEventListener("pointercancel", event => {
    event.preventDefault();

    const pressedKey = activePointers.get(event.pointerId);

    if (pressedKey) {
      releaseKey(pressedKey);
    }

    activePointers.delete(event.pointerId);
  });

  key.addEventListener("lostpointercapture", event => {
    const pressedKey = activePointers.get(event.pointerId);

    if (pressedKey) {
      releaseKey(pressedKey);
      activePointers.delete(event.pointerId);
    }
  });
});

document.addEventListener("keydown", event => {
  const note = KEY_CODES[event.code];

  if (!note || pressedKeyboardKeys.has(event.code)) {
    return;
  }

  event.preventDefault();

  pressedKeyboardKeys.add(event.code);

  const key = getKeyElement(note);

  pressKey(key);
});

document.addEventListener("keyup", event => {
  const note = KEY_CODES[event.code];

  if (!note) {
    return;
  }

  event.preventDefault();

  pressedKeyboardKeys.delete(event.code);

  const key = getKeyElement(note);

  releaseKey(key);
});

window.addEventListener("blur", () => {
  pressedKeyboardKeys.clear();
  activePointers.clear();

  [...activeNotes.keys()].forEach(note => {
    stopNote(note);
  });
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    return;
  }

  pressedKeyboardKeys.clear();
  activePointers.clear();

  [...activeNotes.keys()].forEach(note => {
    stopNote(note);
  });
});