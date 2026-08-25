const keys = document.querySelectorAll(".key");
const status = document.getElementById("status");

let audioContext = null;

const activeNotes = new Map();
const activePointers = new Map();
const pressedKeyboardKeys = new Set();

const KEY_CODES = {
  // Octave 3 - White Keys
  KeyA: "C3",
  a: "C3",
  A: "C3",
  KeyS: "D3",
  s: "D3",
  S: "D3",
  KeyD: "E3",
  d: "E3",
  D: "E3",
  KeyF: "F3",
  f: "F3",
  F: "F3",
  KeyG: "G3",
  g: "G3",
  G: "G3",
  KeyH: "A3",
  h: "A3",
  H: "A3",
  KeyJ: "B3",
  j: "B3",
  J: "B3",

  // Octave 4 - White Keys
  KeyK: "C4",
  k: "C4",
  K: "C4",
  KeyL: "D4",
  l: "D4",
  L: "D4",
  KeyZ: "E4",
  z: "E4",
  Z: "E4",
  KeyX: "F4",
  x: "F4",
  X: "F4",
  KeyC: "G4",
  c: "G4",
  C: "G4",
  KeyV: "A4",
  v: "A4",
  V: "A4",
  KeyB: "B4",
  b: "B4",
  B: "B4",

  // Octave 5 - White Keys
  KeyN: "C5",
  n: "C5",
  N: "C5",
  KeyM: "D5",
  m: "D5",
  M: "D5",
  KeyQ: "E5",
  q: "E5",
  Q: "E5",
  KeyW: "F5",
  w: "F5",
  W: "F5",
  KeyE: "G5",
  e: "G5",
  E: "G5",
  KeyR: "A5",
  r: "A5",
  R: "A5",
  KeyT: "B5",
  t: "B5",
  T: "B5",

  // Octave 6 - White Keys
  KeyY: "C6",
  y: "C6",
  Y: "C6",
  KeyU: "D6",
  u: "D6",
  U: "D6",
  KeyI: "E6",
  i: "E6",
  I: "E6",

  // Octave 3 - Black Keys
  Digit1: "C#3",
  "1": "C#3",
  Digit2: "D#3",
  "2": "D#3",
  Digit3: "F#3",
  "3": "F#3",
  Digit4: "G#3",
  "4": "G#3",
  Digit5: "A#3",
  "5": "A#3",

  // Octave 4 - Black Keys
  Digit6: "C#4",
  "6": "C#4",
  Digit7: "D#4",
  "7": "D#4",
  Digit8: "F#4",
  "8": "F#4",
  Digit9: "G#4",
  "9": "G#4",
  Digit0: "A#4",
  "0": "A#4",

  // Octave 5 - Black Keys
  "!": "C#5",
  "@": "D#5",
  "#": "F#5",
  "$": "G#5",
  "%": "A#5",

  // Octave 6 - Black Keys
  "^": "C#6",
  "&": "D#6"
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
  const note = KEY_CODES[event.key] || KEY_CODES[event.code];

  if (!note || pressedKeyboardKeys.has(event.code)) {
    return;
  }

  event.preventDefault();

  pressedKeyboardKeys.add(event.code);

  const key = getKeyElement(note);

  pressKey(key);
});

document.addEventListener("keyup", event => {
  const note = KEY_CODES[event.key] || KEY_CODES[event.code];

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