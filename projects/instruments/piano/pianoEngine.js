(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PianoEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const NOTE_FREQUENCIES = Object.freeze({
    C3: 130.81,
    "C#3": 138.59,
    D3: 146.83,
    "D#3": 155.56,
    E3: 164.81,
    F3: 174.61,
    "F#3": 185.0,
    G3: 196.0,
    "G#3": 207.65,
    A3: 220.0,
    "A#3": 233.08,
    B3: 246.94,

    C4: 261.63,
    "C#4": 277.18,
    D4: 293.66,
    "D#4": 311.13,
    E4: 329.63,
    F4: 349.23,
    "F#4": 369.99,
    G4: 392.0,
    "G#4": 415.3,
    A4: 440.0,
    "A#4": 466.16,
    B4: 493.88,

    C5: 523.25,
    "C#5": 554.37,
    D5: 587.33,
    "D#5": 622.25,
    E5: 659.25,
    F5: 698.46,
    "F#5": 739.99,
    G5: 783.99,
    "G#5": 830.61,
    A5: 880.0,
    "A#5": 932.33,
    B5: 987.77,

    C6: 1046.5,
    "C#6": 1108.73,
    D6: 1174.66,
    "D#6": 1244.51,
    E6: 1318.51
  });


  const KEY_TO_NOTE = Object.freeze({
    // C3 → B3
    z: "C3",
    s: "C#3",
    x: "D3",
    d: "D#3",
    c: "E3",
    v: "F3",
    g: "F#3",
    b: "G3",
    h: "G#3",
    n: "A3",
    j: "A#3",
    m: "B3",

    // C4 → B4
    a: "C4",
    w: "C#4",
    q: "D4",
    e: "D#4",
    r: "E4",
    t: "F4",
    y: "F#4",
    u: "G4",
    i: "G#4",
    o: "A4",
    p: "A#4",
    "[": "B4",

    // C5 → B5
    k: "C5",
    "1": "C#5",
    l: "D5",
    "2": "D#5",
    ";": "E5",
    "'": "F5",
    "3": "F#5",
    ",": "G5",
    "4": "G#5",
    ".": "A5",
    "5": "A#5",
    "/": "B5",

    // C6 → E6
    "6": "C6",
    "7": "C#6",
    "8": "D6",
    "9": "D#6",
    "0": "E6"
  });

  const NOTE_TO_KEY = Object.freeze(
    Object.fromEntries(
      Object.entries(KEY_TO_NOTE).map(
        ([key, note]) => [note, key]
      )
    )
  );

  let audioContext = null;

  const activeVoices = new Map();

  function getAudioContext() {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      return null;
    }

    if (!audioContext) {
      audioContext = new AudioContext();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    return audioContext;
  }

  function createNoiseBuffer(context, duration) {
    const length = Math.floor(
      context.sampleRate * duration
    );

    const buffer = context.createBuffer(
      1,
      length,
      context.sampleRate
    );

    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const progress = i / length;
      const decay = Math.pow(
        1 - progress,
        2.5
      );

      data[i] =
        (Math.random() * 2 - 1) *
        decay;
    }

    return buffer;
  }

  function createHammerAttack(
    context,
    destination,
    frequency,
    time
  ) {
    const source =
      context.createBufferSource();

    const filter =
      context.createBiquadFilter();

    const gain =
      context.createGain();

    source.buffer =
      createNoiseBuffer(
        context,
        0.035
      );

    filter.type = "bandpass";

    filter.frequency.setValueAtTime(
      Math.min(
        Math.max(
          frequency * 5,
          1800
        ),
        6500
      ),
      time
    );

    filter.Q.setValueAtTime(
      1.8,
      time
    );

    gain.gain.setValueAtTime(
      0.0001,
      time
    );

    gain.gain.exponentialRampToValueAtTime(
      0.24,
      time + 0.001
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      time + 0.032
    );

    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    source.start(time);
    source.stop(time + 0.04);
  }

  function createStringAttack(
    context,
    destination,
    frequency,
    time
  ) {
    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    const filter =
      context.createBiquadFilter();

    oscillator.type = "sawtooth";

    oscillator.frequency.setValueAtTime(
      frequency * 2.01,
      time
    );

    filter.type = "highpass";

    filter.frequency.setValueAtTime(
      Math.min(
        frequency * 1.5,
        3000
      ),
      time
    );

    gain.gain.setValueAtTime(
      0.0001,
      time
    );

    gain.gain.exponentialRampToValueAtTime(
      0.09,
      time + 0.002
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      time + 0.12
    );

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    oscillator.start(time);
    oscillator.stop(time + 0.14);
  }

  function createVoice(
    context,
    frequency,
    time
  ) {
    const output =
      context.createGain();

    const brightness =
      context.createBiquadFilter();

    brightness.type = "lowpass";

    brightness.frequency.setValueAtTime(
      7200,
      time
    );

    brightness.Q.setValueAtTime(
      0.35,
      time
    );

    output.gain.setValueAtTime(
      0.0001,
      time
    );

    output.gain.exponentialRampToValueAtTime(
      0.42,
      time + 0.006
    );

    output.gain.exponentialRampToValueAtTime(
      0.24,
      time + 0.12
    );

    output.gain.exponentialRampToValueAtTime(
      0.14,
      time + 0.8
    );

    brightness.connect(output);
    output.connect(context.destination);

    const oscillators = [];

    const harmonics = [
      [1, 0.72, 1],
      [2, 0.24, 1.001],
      [3, 0.12, 0.999],
      [4, 0.055, 1.002],
      [5, 0.028, 0.997],
      [6, 0.014, 1.003],
      [7, 0.008, 0.996]
    ];

    harmonics.forEach(
      ([multiplier, volume, detune]) => {
        const oscillator =
          context.createOscillator();

        const harmonicGain =
          context.createGain();

        oscillator.type =
          multiplier === 1
            ? "triangle"
            : "sine";

        oscillator.frequency.setValueAtTime(
          frequency *
            multiplier *
            detune,
          time
        );

        harmonicGain.gain.setValueAtTime(
          volume,
          time
        );

        oscillator.connect(
          harmonicGain
        );

        harmonicGain.connect(
          brightness
        );

        oscillator.start(time);

        oscillators.push(
          oscillator
        );
      }
    );

    return {
      output,
      oscillators
    };
  }

  function startNote(note) {
    if (!isValidNote(note)) {
      return false;
    }

    if (activeVoices.has(note)) {
      return true;
    }

    const context =
      getAudioContext();

    if (!context) {
      return false;
    }

    const time =
      context.currentTime;

    const frequency =
      NOTE_FREQUENCIES[note];

    const voice =
      createVoice(
        context,
        frequency,
        time
      );

    createHammerAttack(
      context,
      voice.output,
      frequency,
      time
    );

    createStringAttack(
      context,
      voice.output,
      frequency,
      time
    );

    activeVoices.set(
      note,
      voice
    );

    return true;
  }

  function stopNote(note) {
    const voice =
      activeVoices.get(note);

    if (!voice) {
      return false;
    }

    const context =
      getAudioContext();

    if (!context) {
      return false;
    }

    const time =
      context.currentTime;

    voice.output.gain.cancelScheduledValues(
      time
    );

    voice.output.gain.setValueAtTime(
      Math.max(
        voice.output.gain.value,
        0.0001
      ),
      time
    );

    voice.output.gain.exponentialRampToValueAtTime(
      0.0001,
      time + 0.7
    );

    const stopTime =
      time + 0.75;

    voice.oscillators.forEach(
      oscillator => {
        try {
          oscillator.stop(
            stopTime
          );
        } catch (_) {}
      }
    );

    activeVoices.delete(note);

    return true;
  }

  function playNote(note) {
    if (!startNote(note)) {
      return false;
    }

    const context =
      getAudioContext();

    if (!context) {
      return false;
    }

    const voice =
      activeVoices.get(note);

    if (!voice) {
      return false;
    }

    const time =
      context.currentTime;

    voice.output.gain.cancelScheduledValues(
      time
    );

    voice.output.gain.setValueAtTime(
      0.0001,
      time
    );

    voice.output.gain.exponentialRampToValueAtTime(
      0.42,
      time + 0.006
    );

    voice.output.gain.exponentialRampToValueAtTime(
      0.14,
      time + 0.8
    );

    voice.output.gain.exponentialRampToValueAtTime(
      0.0001,
      time + 2.2
    );

    const stopTime =
      time + 2.25;

    voice.oscillators.forEach(
      oscillator => {
        try {
          oscillator.stop(
            stopTime
          );
        } catch (_) {}
      }
    );

    activeVoices.delete(note);

    return true;
  }

  function stopAllNotes() {
    [...activeVoices.keys()].forEach(
      note => {
        stopNote(note);
      }
    );
  }

  function playNoteFromKey(key) {
    const note =
      getNoteFromKey(key);

    if (!note) {
      return false;
    }

    return startNote(note);
  }

  function stopNoteFromKey(key) {
    const note =
      getNoteFromKey(key);

    if (!note) {
      return false;
    }

    return stopNote(note);
  }

  function getFrequency(note) {
    return NOTE_FREQUENCIES[note] || null;
  }

  function getNoteFromKey(key) {
    if (typeof key !== "string") {
      return null;
    }

    return (
      KEY_TO_NOTE[
        key.toLowerCase()
      ] || null
    );
  }

  function getKeyFromNote(note) {
    return (
      NOTE_TO_KEY[note] || null
    );
  }

  function isValidNote(note) {
    return Object.prototype.hasOwnProperty.call(
      NOTE_FREQUENCIES,
      note
    );
  }

  function getNotes() {
    return Object.keys(
      NOTE_FREQUENCIES
    );
  }

  function getKeyboardMap() {
    return {
      ...KEY_TO_NOTE
    };
  }

  return {
    NOTE_FREQUENCIES,
    KEY_TO_NOTE,
    NOTE_TO_KEY,
    getFrequency,
    getNoteFromKey,
    getKeyFromNote,
    isValidNote,
    getNotes,
    getKeyboardMap,
    startNote,
    stopNote,
    playNote,
    playNoteFromKey,
    stopNoteFromKey,
    stopAllNotes
  };
});