const doc = typeof document !== "undefined" ? document : null;
const win = typeof window !== "undefined" ? window : null;

const keys = doc ? doc.querySelectorAll(".key") : [];
const status = doc ? doc.getElementById("status") : null;

let audioContext = null;
let masterBus = null;

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
  KeyK: "C5",
  a: "C4",
  w: "C#4",
  s: "D4",
  e: "D#4",
  d: "E4",
  f: "F4",
  t: "F#4",
  g: "G4",
  y: "G#4",
  h: "A4",
  u: "A#4",
  j: "B4",
  k: "C5",
};

const engine =
  typeof PianoEngine !== "undefined"
    ? PianoEngine
    : typeof require === "function"
      ? require("./pianoEngine.js")
      : null;

if (engine && typeof engine.onSampleError === "function") {
  engine.onSampleError(err => {
    showAudioBlockedUI(`Sample load error: ${err.message}`);
  });
}


let isAudioBlocked = false;

function showAudioBlockedUI(message) {
  isAudioBlocked = true;
  if (!status) return;
  status.classList.add("audio-blocked");
  status.setAttribute("role", "alert");
  status.textContent =
    message || "Audio blocked by browser. Click here to enable sound.";
  status.style.cursor = "pointer";
  status.title = "Click to enable audio playback";
}

function clearAudioBlockedUI() {
  if (!isAudioBlocked) return;
  isAudioBlocked = false;
  if (!status) return;
  status.classList.remove("audio-blocked");
  status.removeAttribute("role");
  status.style.cursor = "";
  status.title = "";
  if (activeNotes.size === 0) {
    status.textContent = "Ready";
  }
}

async function resumeAudio() {
  if (!audioContext) {
    getAudioContext();
  }
  if (!audioContext) {
    showAudioBlockedUI("Web Audio API is not supported in this browser.");
    return false;
  }
  if (audioContext.state === "running") {
    clearAudioBlockedUI();
    return true;
  }
  try {
    await audioContext.resume();
    if (audioContext.state === "running") {
      clearAudioBlockedUI();
      return true;
    } else {
      showAudioBlockedUI("Audio is suspended. Click here to enable sound.");
      return false;
    }
  } catch (error) {
    console.warn("AudioContext resume failed:", error);
    showAudioBlockedUI("Audio blocked by browser. Click here to enable sound.");
    return false;
  }
}

function getAudioContext() {
  if (!audioContext) {
    const AudioCtx =
      (win && (win.AudioContext || win.webkitAudioContext)) ||
      (typeof globalThis !== "undefined" &&
        (globalThis.AudioContext || globalThis.webkitAudioContext));
    if (AudioCtx) {
      try {
        audioContext = new AudioCtx();
      } catch (err) {
        console.warn("Failed to create AudioContext:", err);
        showAudioBlockedUI("Audio initialization failed. Click here to retry.");
        return null;
      }
    }
  }

  if (audioContext && audioContext.state === "suspended") {
    audioContext
      .resume()
      .then(() => {
        clearAudioBlockedUI();
      })
      .catch(err => {
        console.warn("AudioContext resume rejected:", err);
        showAudioBlockedUI(
          "Audio blocked by browser. Click here to enable sound."
        );
      });
  }

  return audioContext;
}

if (status) {
  status.addEventListener("click", () => {
    if (
      isAudioBlocked ||
      (audioContext && audioContext.state === "suspended")
    ) {
      resumeAudio();
    }
  });
}

function getMasterBus(context) {
  if (!context) return null;
  if (!masterBus) {
    try {
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-6, context.currentTime);
      compressor.knee.setValueAtTime(6, context.currentTime);
      compressor.ratio.setValueAtTime(4, context.currentTime);
      compressor.attack.setValueAtTime(0.003, context.currentTime);
      compressor.release.setValueAtTime(0.1, context.currentTime);

      const gain = context.createGain();
      gain.gain.setValueAtTime(0.75, context.currentTime);

      compressor.connect(gain);
      gain.connect(context.destination);
      masterBus = compressor;
    } catch {
      masterBus = context.destination;
    }
  }
  return masterBus;
}

function getKeyElement(note) {
  return [...keys].find(key => key.dataset && key.dataset.note === note);
}

function setKeyPressed(key, pressed) {
  if (!key) {
    return;
  }

  if (key.classList) {
    key.classList.toggle("active", pressed);
  }
  if (key.setAttribute) {
    key.setAttribute("aria-pressed", String(pressed));
  }
}

function createHammerNoise(context, time, destination) {
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
  gain.connect(destination || context.destination);

  source.start(time);
  source.stop(time + duration);
}

function createPianoVoice(context, frequency, time, destination) {
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

  masterGain.connect(destination || context.destination);

  fundamental.start(time);
  second.start(time);
  third.start(time);

  return {
    fundamental,
    second,
    third,
    masterGain,
  };
}

function playNote(note) {
  const isValid = engine ? engine.isValidNote(note) : true;
  if (!isValid || activeNotes.has(note)) {
    return;
  }

  const context = getAudioContext();
  if (!context) return;

  const time = context.currentTime;
  const frequency = engine ? engine.getFrequency(note) : 440;
  const key = getKeyElement(note);
  const bus = getMasterBus(context);

  const voice = createPianoVoice(context, frequency, time, bus);
  createHammerNoise(context, time, bus);

  activeNotes.set(note, voice);
  setKeyPressed(key, true);

  if (status) {
    if (activeNotes.size === 1) {
      status.textContent = `Playing ${note}`;
    } else {
      status.textContent = `Playing ${[...activeNotes.keys()].join(", ")}`;
    }
  }
}

function stopNote(note) {
  const voice = activeNotes.get(note);

  if (!voice) {
    return;
  }

  activeNotes.delete(note);

  const context = getAudioContext();
  if (context) {
    const time = context.currentTime;

    try {
      voice.masterGain.gain.cancelScheduledValues(time);
      voice.masterGain.gain.setValueAtTime(
        Math.max(voice.masterGain.gain.value || 0.0001, 0.0001),
        time
      );
      voice.masterGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.4);

      const stopTime = time + 0.45;
      voice.fundamental.stop(stopTime);
      voice.second.stop(stopTime);
      voice.third.stop(stopTime);

      setTimeout(() => {
        try {
          voice.fundamental.disconnect();
          voice.second.disconnect();
          voice.third.disconnect();
          voice.masterGain.disconnect();
        } catch {}
      }, 500);
    } catch {}
  }

  const key = getKeyElement(note);
  setKeyPressed(key, false);

  if (status) {
    if (isAudioBlocked) {
      // Preserve blocked banner until audio is successfully resumed
    } else if (activeNotes.size === 0) {
      status.textContent = "Ready";
    } else {
      status.textContent = `Playing ${[...activeNotes.keys()].join(", ")}`;
    }
  }
}

function pressKey(key) {
  if (!key || !key.dataset) {
    return;
  }

  playNote(key.dataset.note);
}

function releaseKey(key) {
  if (!key || !key.dataset) {
    return;
  }

  stopNote(key.dataset.note);
}

if (keys && keys.length) {
  keys.forEach(key => {
    setKeyPressed(key, false);

    key.addEventListener("pointerdown", event => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }

      activePointers.set(event.pointerId, key);

      if (key.setPointerCapture) {
        key.setPointerCapture(event.pointerId);
      }

      pressKey(key);
    });

    key.addEventListener("pointerup", event => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }

      const pressedKey = activePointers.get(event.pointerId);
      activePointers.delete(event.pointerId);

      if (pressedKey && pressedKey.dataset) {
        const note = pressedKey.dataset.note;
        const isHeldByKeyboard = [...pressedKeyboardKeys].some(
          code =>
            KEY_CODES[code] === note ||
            (engine && engine.getNoteFromKey(code) === note)
        );
        const isHeldByPointer = [...activePointers.values()].some(
          k => k === pressedKey
        );

        if (!isHeldByKeyboard && !isHeldByPointer) {
          releaseKey(pressedKey);
        }
      }
    });

    key.addEventListener("pointercancel", event => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }

      const pressedKey = activePointers.get(event.pointerId);
      activePointers.delete(event.pointerId);

      if (pressedKey && pressedKey.dataset) {
        const note = pressedKey.dataset.note;
        const isHeldByKeyboard = [...pressedKeyboardKeys].some(
          code =>
            KEY_CODES[code] === note ||
            (engine && engine.getNoteFromKey(code) === note)
        );
        const isHeldByPointer = [...activePointers.values()].some(
          k => k === pressedKey
        );

        if (!isHeldByKeyboard && !isHeldByPointer) {
          releaseKey(pressedKey);
        }
      }
    });

    key.addEventListener("lostpointercapture", event => {
      const pressedKey = activePointers.get(event.pointerId);
      if (pressedKey && pressedKey.dataset) {
        activePointers.delete(event.pointerId);
        const note = pressedKey.dataset.note;
        const isHeldByKeyboard = [...pressedKeyboardKeys].some(
          code =>
            KEY_CODES[code] === note ||
            (engine && engine.getNoteFromKey(code) === note)
        );
        const isHeldByPointer = [...activePointers.values()].some(
          k => k === pressedKey
        );

        if (!isHeldByKeyboard && !isHeldByPointer) {
          releaseKey(pressedKey);
        }
      }
    });
  });
}

function handleKeydown(event) {
  // Ignore auto-repeated events from holding keys
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) {
    return;
  }

  const code = event.code || event.key;
  const note =
    KEY_CODES[event.code] ||
    KEY_CODES[code] ||
    (engine ? engine.getNoteFromKey(event.key || code) : null);
  if (!note) {
    return;
  }

  // Deduplicate if physical key is already tracked as pressed or note is already actively playing
  if (
    pressedKeyboardKeys.has(code) ||
    (event.code && pressedKeyboardKeys.has(event.code)) ||
    activeNotes.has(note)
  ) {
    return;
  }

  if (typeof event.preventDefault === "function") {
    event.preventDefault();
  }

  pressedKeyboardKeys.add(code);
  if (event.code) pressedKeyboardKeys.add(event.code);
  const key = getKeyElement(note);
  pressKey(key);
}

function handleKeyup(event) {
  const code = event.code || event.key;
  const note =
    KEY_CODES[event.code] ||
    KEY_CODES[code] ||
    (engine ? engine.getNoteFromKey(event.key || code) : null);
  if (!note) {
    return;
  }

  if (typeof event.preventDefault === "function") {
    event.preventDefault();
  }

  pressedKeyboardKeys.delete(code);
  if (event.code) pressedKeyboardKeys.delete(event.code);

  // Only release the note if no other physical key or pointer is holding it
  const isHeldByKeyboard = [...pressedKeyboardKeys].some(
    c =>
      KEY_CODES[c] === note ||
      (engine && engine.getNoteFromKey(c) === note)
  );
  const isHeldByPointer = [...activePointers.values()].some(
    k => k && k.dataset && k.dataset.note === note
  );

  if (!isHeldByKeyboard && !isHeldByPointer) {
    const key = getKeyElement(note);
    releaseKey(key);
  }
}

function handleMidiMessage(event) {
  if (!event || !event.data || event.data.length < 2) return;
  const [statusByte, noteNumber, velocity = 0] = event.data;
  const command = statusByte >> 4;
  if (command === 9 && velocity > 0) {
    // Note On
    if (engine && typeof engine.getNoteFromMidi === "function") {
      const note = engine.getNoteFromMidi(noteNumber);
      if (note) playNote(note);
    }
  } else if (command === 8 || (command === 9 && velocity === 0)) {
    // Note Off
    if (engine && typeof engine.getNoteFromMidi === "function") {
      const note = engine.getNoteFromMidi(noteNumber);
      if (note) stopNote(note);
    }
  }
}

function initMidiAccess() {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.requestMIDIAccess === "function"
  ) {
    navigator
      .requestMIDIAccess()
      .then(midiAccess => {
        for (const input of midiAccess.inputs.values()) {
          input.onmidimessage = handleMidiMessage;
        }
        midiAccess.onstatechange = e => {
          if (e.port && e.port.type === "input" && e.port.state === "connected") {
            e.port.onmidimessage = handleMidiMessage;
          }
        };
      })
      .catch(() => {
        // MIDI access not granted or unavailable
      });
  }
}

if (doc) {
  doc.addEventListener("keydown", handleKeydown);
  doc.addEventListener("keyup", handleKeyup);

  doc.addEventListener("visibilitychange", () => {
    if (!doc.hidden) {
      return;
    }

    pressedKeyboardKeys.clear();
    activePointers.clear();

    [...activeNotes.keys()].forEach(note => {
      stopNote(note);
    });
  });
}

if (win) {
  initMidiAccess();

  win.addEventListener("blur", () => {
    pressedKeyboardKeys.clear();
    activePointers.clear();

    [...activeNotes.keys()].forEach(note => {
      stopNote(note);
    });
  });

  win.addEventListener("pagehide", () => {
    pressedKeyboardKeys.clear();
    activePointers.clear();

    [...activeNotes.keys()].forEach(note => {
      stopNote(note);
    });

    if (audioContext && audioContext.state !== "closed") {
      try {
        audioContext.suspend().catch(() => {});
      } catch {}
    }
  });

  win.PianoStudio = {
    playNote,
    SampleLoadError: engine?.SampleLoadError,
    loadSample: (n, u, o) => engine?.loadSample(n, u, o),
    loadSamples: (m, o) => engine?.loadSamples(m, o),
    getSample: n => engine?.getSample(n),
    hasSample: n => engine?.hasSample(n),
    getSampleErrors: () => engine?.getSampleErrors(),
    clearSamples: () => engine?.clearSamples(),
    onSampleError: fn => engine?.onSampleError(fn),
    stopNote,
    pressKey,
    releaseKey,
    handleKeydown,
    handleKeyup,
    resumeAudio,
    isAudioBlocked: () => isAudioBlocked,
    showAudioBlockedUI,
    clearAudioBlockedUI,
    setKeyboardMapping: (m, opt) => engine?.setKeyboardMapping(m, opt),
    setMidiMapping: (m, opt) => engine?.setMidiMapping(m, opt),
    validateKeyboardMapping: (m, opt) => engine?.validateKeyboardMapping(m, opt),
    validateMidiMapping: (m, opt) => engine?.validateMidiMapping(m, opt),
    getActiveNotes: () => activeNotes,
    getPressedKeyboardKeys: () => pressedKeyboardKeys,
    getActivePointers: () => activePointers,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    playNote,
    SampleLoadError: engine?.SampleLoadError,
    loadSample: (n, u, o) => engine?.loadSample(n, u, o),
    loadSamples: (m, o) => engine?.loadSamples(m, o),
    getSample: n => engine?.getSample(n),
    hasSample: n => engine?.hasSample(n),
    getSampleErrors: () => engine?.getSampleErrors(),
    clearSamples: () => engine?.clearSamples(),
    onSampleError: fn => engine?.onSampleError(fn),
    stopNote,
    pressKey,
    releaseKey,
    handleKeydown,
    handleKeyup,
    resumeAudio,
    isAudioBlocked: () => isAudioBlocked,
    showAudioBlockedUI,
    clearAudioBlockedUI,
    setKeyboardMapping: (m, opt) => engine?.setKeyboardMapping(m, opt),
    setMidiMapping: (m, opt) => engine?.setMidiMapping(m, opt),
    validateKeyboardMapping: (m, opt) => engine?.validateKeyboardMapping(m, opt),
    validateMidiMapping: (m, opt) => engine?.validateMidiMapping(m, opt),
    getActiveNotes: () => activeNotes,
    getPressedKeyboardKeys: () => pressedKeyboardKeys,
    getActivePointers: () => activePointers,
  };
}
