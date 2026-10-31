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
    E6: 1318.51,
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
    1: "C#5",
    l: "D5",
    2: "D#5",
    ";": "E5",
    "'": "F5",
    3: "F#5",
    ",": "G5",
    4: "G#5",
    ".": "A5",
    5: "A#5",
    "/": "B5",

    // C6 → E6
    6: "C6",
    7: "C#6",
    8: "D6",
    9: "D#6",
    0: "E6",
  });

  const NOTE_TO_KEY = Object.freeze(
    Object.fromEntries(
      Object.entries(KEY_TO_NOTE).map(([key, note]) => [note, key])
    )
  );

  const SEMITONE_MAP = Object.freeze({
    C: 0,
    "C#": 1,
    DB: 1,
    D: 2,
    "D#": 3,
    EB: 3,
    E: 4,
    F: 5,
    "F#": 6,
    GB: 6,
    G: 7,
    "G#": 8,
    AB: 8,
    A: 9,
    "A#": 10,
    BB: 10,
    B: 11,
  });

  const MIDI_NOTE_NAMES = Object.freeze([
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ]);

  /**
   * Converts a standard musical note name (e.g. "C4", "A#3") into a MIDI note number (0–127).
   * Returns null for invalid or out-of-range notes without throwing.
   */
  function noteToMidiNumber(note) {
    if (typeof note !== "string") return null;
    const trimmed = note.trim();
    const match = /^([A-Ga-g][#b]?)(-?\d+)$/.exec(trimmed);
    if (!match) return null;
    const pitch = match[1].toUpperCase();
    const semitone = SEMITONE_MAP[pitch];
    if (semitone === undefined) return null;
    const octave = parseInt(match[2], 10);
    const midi = (octave + 1) * 12 + semitone;
    return midi >= 0 && midi <= 127 ? midi : null;
  }

  /**
   * Converts a MIDI note number (0–127) into a canonical note name (e.g. 60 -> "C4").
   * Returns null for invalid MIDI numbers without throwing.
   */
  function midiNumberToNote(midi) {
    const num = Number(midi);
    if (!Number.isInteger(num) || num < 0 || num > 127) {
      return null;
    }
    const octave = Math.floor(num / 12) - 1;
    const pitch = MIDI_NOTE_NAMES[num % 12];
    return `${pitch}${octave}`;
  }

  // Precomputed standard MIDI mappings for all piano frequencies (C3=48 through E6=88)
  const DEFAULT_MIDI_TO_NOTE = Object.freeze(
    Object.fromEntries(
      Object.keys(NOTE_FREQUENCIES)
        .map(note => {
          const midi = noteToMidiNumber(note);
          return midi !== null ? [midi, note] : null;
        })
        .filter(Boolean)
    )
  );

  const DEFAULT_NOTE_TO_MIDI = Object.freeze(
    Object.fromEntries(
      Object.entries(DEFAULT_MIDI_TO_NOTE).map(([midi, note]) => [
        note,
        Number(midi),
      ])
    )
  );

  // Active mapping state (can be reconfigured after passing validation)
  let activeKeyToNote = { ...KEY_TO_NOTE };
  let activeNoteToKey = { ...NOTE_TO_KEY };

  let activeMidiToNote = { ...DEFAULT_MIDI_TO_NOTE };
  let activeNoteToMidi = { ...DEFAULT_NOTE_TO_MIDI };

  let audioContext = null;
  const activeVoices = new Map();

  class SampleLoadError extends Error {
    constructor(
      message,
      { type = "UNKNOWN", url = "", status = null, originalError = null } = {}
    ) {
      super(message);
      this.name = "SampleLoadError";
      this.type = type; // 'NOT_FOUND' | 'CORS' | 'NETWORK' | 'DECODE' | 'FORBIDDEN' | 'SERVER_ERROR' | 'INVALID_INPUT' | 'ABORTED'
      this.url = url;
      this.status = status;
      this.originalError = originalError;
    }
  }

  const sampleBuffers = new Map();
  const sampleLoadErrors = new Map();
  const sampleErrorListeners = [];

  function onSampleError(callback) {
    if (typeof callback === "function") {
      sampleErrorListeners.push(callback);
    }
    return () => {
      const idx = sampleErrorListeners.indexOf(callback);
      if (idx !== -1) sampleErrorListeners.splice(idx, 1);
    };
  }

  function emitSampleError(error) {
    sampleErrorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (cbErr) {
        console.error("Error in PianoEngine sample error listener:", cbErr);
      }
    });
  }


  function getAudioContext() {
    if (typeof window === "undefined" && typeof globalThis === "undefined") {
      return null;
    }

    const AudioContext =
      (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) ||
      (typeof globalThis !== "undefined" && (globalThis.AudioContext || globalThis.webkitAudioContext));

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
    const length = Math.floor(context.sampleRate * duration);

    const buffer = context.createBuffer(1, length, context.sampleRate);

    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const progress = i / length;
      const decay = Math.pow(1 - progress, 2.5);

      data[i] = (Math.random() * 2 - 1) * decay;
    }

    return buffer;
  }

  function createHammerAttack(context, destination, frequency, time) {
    const source = context.createBufferSource();

    const filter = context.createBiquadFilter();

    const gain = context.createGain();

    source.buffer = createNoiseBuffer(context, 0.035);

    filter.type = "bandpass";

    filter.frequency.setValueAtTime(
      Math.min(Math.max(frequency * 5, 1800), 6500),
      time
    );

    filter.Q.setValueAtTime(1.8, time);

    gain.gain.setValueAtTime(0.0001, time);

    gain.gain.exponentialRampToValueAtTime(0.24, time + 0.001);

    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.032);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    source.start(time);
    source.stop(time + 0.04);
  }

  function createStringAttack(context, destination, frequency, time) {
    const oscillator = context.createOscillator();

    const gain = context.createGain();

    const filter = context.createBiquadFilter();

    oscillator.type = "sawtooth";

    oscillator.frequency.setValueAtTime(frequency * 2.01, time);

    filter.type = "highpass";

    filter.frequency.setValueAtTime(Math.min(frequency * 1.5, 3000), time);

    gain.gain.setValueAtTime(0.0001, time);

    gain.gain.exponentialRampToValueAtTime(0.09, time + 0.002);

    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    oscillator.start(time);
    oscillator.stop(time + 0.14);
  }

  function createVoice(context, frequency, time) {
    const output = context.createGain();

    const brightness = context.createBiquadFilter();

    brightness.type = "lowpass";

    brightness.frequency.setValueAtTime(7200, time);

    brightness.Q.setValueAtTime(0.35, time);

    output.gain.setValueAtTime(0.0001, time);

    output.gain.exponentialRampToValueAtTime(0.42, time + 0.006);

    output.gain.exponentialRampToValueAtTime(0.24, time + 0.12);

    output.gain.exponentialRampToValueAtTime(0.14, time + 0.8);

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
      [7, 0.008, 0.996],
    ];

    harmonics.forEach(([multiplier, volume, detune]) => {
      const oscillator = context.createOscillator();

      const harmonicGain = context.createGain();

      oscillator.type = multiplier === 1 ? "triangle" : "sine";

      oscillator.frequency.setValueAtTime(
        frequency * multiplier * detune,
        time
      );

      harmonicGain.gain.setValueAtTime(volume, time);

      oscillator.connect(harmonicGain);

      harmonicGain.connect(brightness);

      oscillator.start(time);

      oscillators.push(oscillator);
    });

    return {
      output,
      oscillators,
    };
  }

  function startNote(note) {
    if (!isValidNote(note)) {
      return false;
    }

    if (activeVoices.has(note)) {
      return true;
    }

    const context = getAudioContext();

    if (!context) {
      return false;
    }

    const time = context.currentTime;

    const sampleBuffer = sampleBuffers.get(note);
    if (sampleBuffer) {
      try {
        const source = context.createBufferSource();
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.8, time);
        source.buffer = sampleBuffer;
        source.connect(gain);
        gain.connect(context.destination);
        source.start(time);
        const voice = {
          isSample: true,
          source,
          output: gain,
          oscillators: [],
        };
        source.onended = () => {
          if (activeVoices.get(note) === voice) {
            activeVoices.delete(note);
          }
        };
        activeVoices.set(note, voice);
        return true;
      } catch (err) {
        console.warn(`Failed to play sample for note "${note}", falling back to synthesis:`, err);
      }
    }

    const frequency = NOTE_FREQUENCIES[note];

    const voice = createVoice(context, frequency, time);

    createHammerAttack(context, voice.output, frequency, time);

    createStringAttack(context, voice.output, frequency, time);

    activeVoices.set(note, voice);

    return true;
  }

  function stopNote(note) {
    const voice = activeVoices.get(note);

    if (!voice) {
      return false;
    }

    const context = getAudioContext();

    if (!context) {
      return false;
    }

    const time = context.currentTime;

    if (voice.isSample) {
      if (voice.output && voice.output.gain) {
        voice.output.gain.cancelScheduledValues(time);
        voice.output.gain.setValueAtTime(
          Math.max(voice.output.gain.value, 0.0001),
          time
        );
        voice.output.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
      }
      if (voice.source) {
        try {
          voice.source.stop(time + 0.12);
        } catch (_) {}
      }
      activeVoices.delete(note);
      return true;
    }

    voice.output.gain.cancelScheduledValues(time);

    voice.output.gain.setValueAtTime(
      Math.max(voice.output.gain.value, 0.0001),
      time
    );

    voice.output.gain.exponentialRampToValueAtTime(0.0001, time + 0.7);

    const stopTime = time + 0.75;

    voice.oscillators.forEach(oscillator => {
      try {
        oscillator.stop(stopTime);
      } catch (_) {}
    });

    activeVoices.delete(note);

    return true;
  }

  function playNote(note) {
    if (!startNote(note)) {
      return false;
    }

    const voice = activeVoices.get(note);

    if (!voice) {
      return false;
    }

    if (voice.isSample) {
      return true;
    }

    const context = getAudioContext();

    if (!context) {
      return false;
    }

    voice.output.gain.cancelScheduledValues(context.currentTime);

    const time = context.currentTime;

    voice.output.gain.cancelScheduledValues(time);

    voice.output.gain.setValueAtTime(0.0001, time);

    voice.output.gain.exponentialRampToValueAtTime(0.42, time + 0.006);

    voice.output.gain.exponentialRampToValueAtTime(0.14, time + 0.8);

    voice.output.gain.exponentialRampToValueAtTime(0.0001, time + 2.2);

    const stopTime = time + 2.25;

    voice.oscillators.forEach(oscillator => {
      try {
        oscillator.stop(stopTime);
      } catch (_) {}
    });

    activeVoices.delete(note);

    return true;
  }

  function stopAllNotes() {
    [...activeVoices.keys()].forEach(note => {
      stopNote(note);
    });
  }

  function playNoteFromKey(key) {
    const note = getNoteFromKey(key);

    if (!note) {
      return false;
    }

    return startNote(note);
  }

  function stopNoteFromKey(key) {
    const note = getNoteFromKey(key);

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

    const lower = key.toLowerCase();
    if (activeKeyToNote[lower]) {
      return activeKeyToNote[lower];
    }
    if (/^key[a-z0-9]$/i.test(key)) {
      const stripped = key.slice(3).toLowerCase();
      if (activeKeyToNote[stripped]) {
        return activeKeyToNote[stripped];
      }
    }

    return null;
  }

  function getKeyFromNote(note) {
    if (typeof note !== "string") {
      return null;
    }

    return activeNoteToKey[note] || null;
  }

  function isValidNote(note) {
    return (
      typeof note === "string" &&
      Object.prototype.hasOwnProperty.call(NOTE_FREQUENCIES, note.trim())
    );
  }

  function getNotes() {
    return Object.keys(NOTE_FREQUENCIES);
  }

  function getKeyboardMap() {
    return {
      ...activeKeyToNote,
    };
  }

  /**
   * Validates a keyboard mapping object without throwing uncaught exceptions.
   * Detects duplicate key assignments, duplicate notes, invalid keys, invalid notes, and missing notes.
   *
   * @param {Object} mapping - Key-to-note mapping object ({ [key]: note }).
   * @param {Object} [options={}] - Validation options.
   * @param {boolean} [options.requireAllNotes=false] - When true, fails if mapping does not cover all visible notes.
   * @param {boolean} [options.allowDuplicateNotes=false] - When true, permits multiple keys to map to the same note.
   * @param {boolean} [options.caseSensitive=false] - Whether to preserve key casing.
   * @param {Array<string>} [options.expectedNotes] - Override list of notes to verify against.
   * @returns {Object} Validation result { isValid, errors, warnings, duplicateKeys, duplicateNotes, missingNotes, invalidMappings, sanitizedMapping }.
   */
  function validateKeyboardMapping(mapping, options = {}) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      duplicateKeys: [],
      duplicateNotes: [],
      missingNotes: [],
      invalidMappings: [],
      sanitizedMapping: {},
    };

    if (
      mapping === null ||
      mapping === undefined ||
      typeof mapping !== "object" ||
      Array.isArray(mapping)
    ) {
      result.isValid = false;
      result.errors.push("Keyboard mapping must be a non-null object.");
      result.invalidMappings.push({
        reason: "Mapping is not an object",
        value: mapping,
      });
      return result;
    }

    const requireAllNotes = Boolean(options.requireAllNotes);
    const allowDuplicateNotes = Boolean(options.allowDuplicateNotes);
    const caseSensitive = Boolean(options.caseSensitive);
    const expectedNotes = Array.isArray(options.expectedNotes)
      ? options.expectedNotes
      : getNotes();

    const sanitized = {};
    const seenNotes = new Map(); // note -> array of keys
    const seenKeys = new Set();

    let entries = [];
    try {
      entries = Object.entries(mapping);
    } catch (_) {
      result.isValid = false;
      result.errors.push("Failed to read keyboard mapping entries.");
      return result;
    }

    if (entries.length === 0) {
      result.warnings.push("Keyboard mapping is empty.");
      if (requireAllNotes) {
        result.isValid = false;
        result.errors.push("Keyboard mapping is empty but notes are required.");
      }
    }

    for (const [rawKey, rawNote] of entries) {
      if (typeof rawKey !== "string" || rawKey.trim().length === 0) {
        result.isValid = false;
        const msg = `Empty or blank key identifier: "${rawKey}". Key must be a non-empty string.`;
        result.errors.push(msg);
        result.invalidMappings.push({ key: rawKey, note: rawNote, reason: msg });
        continue;
      }

      const key = caseSensitive ? rawKey : rawKey.toLowerCase();

      if (seenKeys.has(key)) {
        result.isValid = false;
        const msg = `Duplicate key assignment detected for key "${key}".`;
        result.errors.push(msg);
        if (!result.duplicateKeys.includes(key)) {
          result.duplicateKeys.push(key);
        }
        result.invalidMappings.push({ key, note: rawNote, reason: msg });
        continue;
      }
      seenKeys.add(key);

      if (typeof rawNote !== "string" || !isValidNote(rawNote.trim())) {
        result.isValid = false;
        const msg = `Invalid note assignment "${rawNote}" for key "${key}".`;
        result.errors.push(msg);
        result.invalidMappings.push({ key, note: rawNote, reason: msg });
        continue;
      }

      const note = rawNote.trim();

      if (!seenNotes.has(note)) {
        seenNotes.set(note, []);
      }
      seenNotes.get(note).push(key);

      if (seenNotes.get(note).length > 1) {
        if (!allowDuplicateNotes) {
          result.isValid = false;
          const msg = `Duplicate note assignment: note "${note}" is assigned to multiple keys (${seenNotes.get(note).join(", ")}).`;
          result.errors.push(msg);
          if (!result.duplicateNotes.includes(note)) {
            result.duplicateNotes.push(note);
          }
          result.invalidMappings.push({ key, note, reason: msg });
        } else {
          result.warnings.push(
            `Note "${note}" is assigned to multiple keys (${seenNotes.get(note).join(", ")}).`
          );
        }
      }

      sanitized[key] = note;
    }

    // Check for missing notes
    const mappedNoteSet = new Set(Object.values(sanitized));
    const missing = expectedNotes.filter(n => !mappedNoteSet.has(n));
    if (missing.length > 0) {
      result.missingNotes = missing;
      if (requireAllNotes) {
        result.isValid = false;
        result.errors.push(
          `Mapping is missing ${missing.length} required notes: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}.`
        );
      } else {
        result.warnings.push(
          `Mapping does not cover ${missing.length} notes: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}.`
        );
      }
    }

    result.sanitizedMapping = Object.freeze(sanitized);

    return result;
  }

  /**
   * Applies a validated keyboard mapping to the piano engine.
   * If validation fails, retains the existing mapping and returns a structured failure without throwing.
   *
   * @param {Object} mapping - Proposed key-to-note mapping.
   * @param {Object} [options={}] - Validation options.
   * @returns {{ success: boolean, mapping?: Object, errors?: Array<string>, validation: Object }}
   */
  function setKeyboardMapping(mapping, options = {}) {
    const validation = validateKeyboardMapping(mapping, options);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
        validation,
      };
    }

    activeKeyToNote = { ...validation.sanitizedMapping };
    activeNoteToKey = Object.fromEntries(
      Object.entries(activeKeyToNote).map(([k, n]) => [n, k])
    );

    return {
      success: true,
      mapping: { ...activeKeyToNote },
      validation,
    };
  }

  function applyKeyboardMapping(mapping, options = {}) {
    return setKeyboardMapping(mapping, options);
  }

  /**
   * Resets keyboard mapping back to default factory configuration.
   */
  function resetKeyboardMapping() {
    activeKeyToNote = { ...KEY_TO_NOTE };
    activeNoteToKey = { ...NOTE_TO_KEY };
    return true;
  }

  /**
   * Validates a MIDI mapping (either { [midiNumber]: note } or { [note]: midiNumber }).
   * Detects duplicate MIDI assignments, duplicate notes, out-of-bounds MIDI numbers, invalid notes, and missing notes.
   *
   * @param {Object} mapping - MIDI mapping object.
   * @param {Object} [options={}] - Validation options.
   * @param {boolean} [options.requireAllNotes=false] - When true, fails if mapping does not cover all expected notes.
   * @param {boolean} [options.allowDuplicateNotes=false] - When true, permits multiple MIDI numbers to map to one note.
   * @param {boolean} [options.allowDuplicateMidi=false] - When true, permits multiple notes to share a MIDI number.
   * @param {number} [options.minMidi=0] - Lower bound for MIDI note number.
   * @param {number} [options.maxMidi=127] - Upper bound for MIDI note number.
   * @param {Array<string>} [options.expectedNotes] - Notes required to be covered.
   * @returns {Object} Validation result { isValid, errors, warnings, duplicateMidiNumbers, duplicateNotes, missingNotes, invalidMappings, sanitizedMapping }.
   */
  function validateMidiMapping(mapping, options = {}) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      duplicateMidiNumbers: [],
      duplicateNotes: [],
      missingNotes: [],
      invalidMappings: [],
      sanitizedMapping: {},
    };

    if (
      mapping === null ||
      mapping === undefined ||
      typeof mapping !== "object" ||
      Array.isArray(mapping)
    ) {
      result.isValid = false;
      result.errors.push("MIDI mapping must be a non-null object.");
      result.invalidMappings.push({
        reason: "Mapping is not an object",
        value: mapping,
      });
      return result;
    }

    const requireAllNotes = Boolean(options.requireAllNotes);
    const allowDuplicateNotes = Boolean(options.allowDuplicateNotes);
    const allowDuplicateMidi = Boolean(options.allowDuplicateMidi);
    const minMidi = typeof options.minMidi === "number" ? options.minMidi : 0;
    const maxMidi = typeof options.maxMidi === "number" ? options.maxMidi : 127;
    const expectedNotes = Array.isArray(options.expectedNotes)
      ? options.expectedNotes
      : getNotes();

    let entries = [];
    try {
      entries = Object.entries(mapping);
    } catch (_) {
      result.isValid = false;
      result.errors.push("Failed to read MIDI mapping entries.");
      return result;
    }

    if (entries.length === 0) {
      result.warnings.push("MIDI mapping is empty.");
      if (requireAllNotes) {
        result.isValid = false;
        result.errors.push("MIDI mapping is empty but notes are required.");
      }
    }

    const midiToNote = {};
    const noteToMidi = {};
    const seenMidi = new Map(); // midi -> array of notes
    const seenNotes = new Map(); // note -> array of midis

    for (const [rawKey, rawVal] of entries) {
      let midiNum = null;
      let noteName = null;

      const keyAsNum = Number(rawKey);
      const valAsNum = Number(rawVal);

      if (
        !Number.isNaN(keyAsNum) &&
        Number.isInteger(keyAsNum) &&
        typeof rawVal === "string"
      ) {
        // midi -> note orientation
        midiNum = keyAsNum;
        noteName = rawVal.trim();
      } else if (
        typeof rawKey === "string" &&
        !Number.isNaN(valAsNum) &&
        Number.isInteger(valAsNum)
      ) {
        // note -> midi orientation
        noteName = rawKey.trim();
        midiNum = valAsNum;
      } else {
        result.isValid = false;
        const msg = `Invalid MIDI mapping entry: [${rawKey}, ${rawVal}]. Expected integer MIDI number (${minMidi}–${maxMidi}) and valid note string.`;
        result.errors.push(msg);
        result.invalidMappings.push({ key: rawKey, value: rawVal, reason: msg });
        continue;
      }

      // Check bounds
      if (midiNum < minMidi || midiNum > maxMidi) {
        result.isValid = false;
        const msg = `MIDI note number ${midiNum} is out of bounds (${minMidi}–${maxMidi}).`;
        result.errors.push(msg);
        result.invalidMappings.push({ midi: midiNum, note: noteName, reason: msg });
        continue;
      }

      // Validate Note
      if (!isValidNote(noteName)) {
        result.isValid = false;
        const msg = `Invalid piano note "${noteName}" for MIDI note ${midiNum}.`;
        result.errors.push(msg);
        result.invalidMappings.push({ midi: midiNum, note: noteName, reason: msg });
        continue;
      }

      // Track duplicate MIDI assignments
      if (!seenMidi.has(midiNum)) {
        seenMidi.set(midiNum, []);
      }
      seenMidi.get(midiNum).push(noteName);

      if (!allowDuplicateMidi && seenMidi.get(midiNum).length > 1) {
        result.isValid = false;
        const msg = `Duplicate MIDI assignment: MIDI note ${midiNum} is assigned to multiple notes (${seenMidi.get(midiNum).join(", ")}).`;
        result.errors.push(msg);
        if (!result.duplicateMidiNumbers.includes(midiNum)) {
          result.duplicateMidiNumbers.push(midiNum);
        }
        result.invalidMappings.push({ midi: midiNum, note: noteName, reason: msg });
      }

      // Track duplicate Note assignments
      if (!seenNotes.has(noteName)) {
        seenNotes.set(noteName, []);
      }
      seenNotes.get(noteName).push(midiNum);

      if (!allowDuplicateNotes && seenNotes.get(noteName).length > 1) {
        result.isValid = false;
        const msg = `Duplicate note assignment: Note "${noteName}" is assigned to multiple MIDI notes (${seenNotes.get(noteName).join(", ")}).`;
        result.errors.push(msg);
        if (!result.duplicateNotes.includes(noteName)) {
          result.duplicateNotes.push(noteName);
        }
        result.invalidMappings.push({ midi: midiNum, note: noteName, reason: msg });
      }

      midiToNote[midiNum] = noteName;
      noteToMidi[noteName] = midiNum;
    }

    // Check for missing notes
    const mappedNoteSet = new Set(Object.values(midiToNote));
    const missing = expectedNotes.filter(n => !mappedNoteSet.has(n));
    if (missing.length > 0) {
      result.missingNotes = missing;
      if (requireAllNotes) {
        result.isValid = false;
        result.errors.push(
          `MIDI mapping is missing ${missing.length} required notes: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}.`
        );
      } else {
        result.warnings.push(
          `MIDI mapping does not cover ${missing.length} notes: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}.`
        );
      }
    }

    const sanitizedObj = Object.assign({}, midiToNote);
    Object.defineProperty(sanitizedObj, "midiToNote", {
      value: Object.freeze({ ...midiToNote }),
      enumerable: false,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(sanitizedObj, "noteToMidi", {
      value: Object.freeze({ ...noteToMidi }),
      enumerable: false,
      configurable: true,
      writable: true,
    });
    result.sanitizedMapping = Object.freeze(sanitizedObj);

    return result;
  }

  /**
   * Applies a validated MIDI mapping to the piano engine.
   * If validation fails, retains the existing mapping and returns a structured failure without throwing.
   *
   * @param {Object} mapping - Proposed MIDI mapping.
   * @param {Object} [options={}] - Validation options.
   * @returns {{ success: boolean, mapping?: Object, errors?: Array<string>, validation: Object }}
   */
  function setMidiMapping(mapping, options = {}) {
    const validation = validateMidiMapping(mapping, options);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
        validation,
      };
    }

    activeMidiToNote = { ...validation.sanitizedMapping.midiToNote };
    activeNoteToMidi = { ...validation.sanitizedMapping.noteToMidi };

    return {
      success: true,
      mapping: {
        midiToNote: { ...activeMidiToNote },
        noteToMidi: { ...activeNoteToMidi },
      },
      validation,
    };
  }

  function applyMidiMapping(mapping, options = {}) {
    return setMidiMapping(mapping, options);
  }

  /**
   * Resets MIDI mapping back to default factory configuration.
   */
  function resetMidiMapping() {
    activeMidiToNote = { ...DEFAULT_MIDI_TO_NOTE };
    activeNoteToMidi = { ...DEFAULT_NOTE_TO_MIDI };
    return true;
  }

  function getMidiMap() {
    return {
      ...activeMidiToNote,
    };
  }

  function getMidiMapping() {
    return {
      midiToNote: { ...activeMidiToNote },
      noteToMidi: { ...activeNoteToMidi },
    };
  }

  function getNoteFromMidi(midi) {
    const num = Number(midi);
    if (!Number.isInteger(num)) return null;
    return activeMidiToNote[num] || null;
  }

  function getMidiFromNote(note) {
    if (typeof note !== "string") return null;
    const num = activeNoteToMidi[note.trim()];
    return num !== undefined ? num : null;
  }

  function playNoteFromMidi(midi) {
    const note = getNoteFromMidi(midi);
    if (!note) return false;
    return playNote(note);
  }

  function stopNoteFromMidi(midi) {
    const note = getNoteFromMidi(midi);
    if (!note) return false;
    return stopNote(note);
  }

  function midiToFrequency(midi) {
    const num = Number(midi);
    if (Number.isNaN(num)) return null;
    return 440 * Math.pow(2, (num - 69) / 12);
  }

  function frequencyToMidi(frequency) {
    const freq = Number(frequency);
    if (Number.isNaN(freq) || freq <= 0) return null;
    return Math.round(69 + 12 * Math.log2(freq / 440));
  }


  async function loadSample(note, url, options = {}) {
    if (!isValidNote(note)) {
      const err = new SampleLoadError(
        `Invalid piano note identifier "${note}". Must be a valid note name between C3 and E6 (e.g. "C4", "F#4").`,
        { type: "INVALID_INPUT", url }
      );
      sampleLoadErrors.set(note, err);
      emitSampleError(err);
      if (options.throwOnError) throw err;
      return { success: false, note, error: err.message, errorDetails: err, type: err.type, url };
    }

    const context = options.audioContext || getAudioContext();
    if (!context) {
      const err = new SampleLoadError(
        `Cannot load audio sample: AudioContext is not available or supported in this environment.`,
        { type: "INVALID_INPUT", url }
      );
      sampleLoadErrors.set(note, err);
      emitSampleError(err);
      if (options.throwOnError) throw err;
      return { success: false, note, error: err.message, errorDetails: err, type: err.type, url };
    }

    const fetchFn =
      options.fetchFn ||
      (typeof fetch === "function" ? fetch : null) ||
      (typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
        ? globalThis.fetch
        : null);

    if (!fetchFn) {
      const err = new SampleLoadError(
        `Fetch API is not available in the current environment to load audio sample "${url}".`,
        { type: "NETWORK", url }
      );
      sampleLoadErrors.set(note, err);
      emitSampleError(err);
      if (options.throwOnError) throw err;
      return { success: false, note, error: err.message, errorDetails: err, type: err.type, url };
    }

    if (!url || typeof url !== "string" || !url.trim()) {
      const err = new SampleLoadError(
        `Invalid audio sample URL provided for note "${note}": expected non-empty string.`,
        { type: "INVALID_INPUT", url }
      );
      sampleLoadErrors.set(note, err);
      emitSampleError(err);
      if (options.throwOnError) throw err;
      return { success: false, note, error: err.message, errorDetails: err, type: err.type, url };
    }

    const trimmedUrl = url.trim();

    let response;
    try {
      const fetchOpts = {
        mode: options.corsMode || "cors",
        ...options.fetchOptions,
      };
      response = await fetchFn(trimmedUrl, fetchOpts);
    } catch (fetchErr) {
      const isAborted = fetchErr.name === "AbortError";
      const msg = fetchErr.message || "";
      const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
      const isCors =
        !isOffline &&
        (fetchErr.name === "SecurityError" ||
          msg.toLowerCase().includes("cors") ||
          msg.toLowerCase().includes("cross-origin") ||
          msg.includes("Failed to fetch") ||
          msg.includes("NetworkError"));

      let errType = isAborted ? "ABORTED" : isCors ? "CORS" : "NETWORK";
      let errMsg = isAborted
        ? `Audio sample request for note "${note}" (${trimmedUrl}) was aborted.`
        : isCors
          ? `Failed to load audio sample for note "${note}" from "${trimmedUrl}": Cross-Origin Request Blocked (CORS restriction). The audio sample server must allow cross-origin requests via Access-Control-Allow-Origin headers.`
          : `Failed to load audio sample for note "${note}" from "${trimmedUrl}": Network failure (${msg || "connection refused or host unreachable"}). Verify network connectivity and server availability.`;

      const err = new SampleLoadError(errMsg, {
        type: errType,
        url: trimmedUrl,
        originalError: fetchErr,
      });

      sampleLoadErrors.set(note, err);
      emitSampleError(err);
      if (typeof options.onError === "function") options.onError(err);
      if (!options.silent) console.error(`[PianoEngine] ${errMsg}`);
      if (options.throwOnError) throw err;
      return { success: false, note, error: errMsg, errorDetails: err, type: errType, url: trimmedUrl };
    }

    if (!response.ok) {
      const status = response.status;
      const statusText = response.statusText || "";
      let errType = "HTTP_ERROR";
      let errMsg = "";

      if (status === 404) {
        errType = "NOT_FOUND";
        errMsg = `Failed to load audio sample for note "${note}" from "${trimmedUrl}": File not found (HTTP 404). Ensure the sample audio file exists at the specified URL.`;
      } else if (status === 403) {
        errType = "FORBIDDEN";
        errMsg = `Failed to load audio sample for note "${note}" from "${trimmedUrl}": Access denied (HTTP 403). Permissions or credentials required.`;
      } else if (status >= 500) {
        errType = "SERVER_ERROR";
        errMsg = `Failed to load audio sample for note "${note}" from "${trimmedUrl}": Server error (HTTP ${status} ${statusText}). The audio host encountered an internal error.`;
      } else {
        errMsg = `Failed to load audio sample for note "${note}" from "${trimmedUrl}": HTTP ${status} (${statusText || "Request failed"}).`;
      }

      const err = new SampleLoadError(errMsg, {
        type: errType,
        url: trimmedUrl,
        status,
        originalError: new Error(`HTTP ${status} ${statusText}`),
      });

      sampleLoadErrors.set(note, err);
      emitSampleError(err);
      if (typeof options.onError === "function") options.onError(err);
      if (!options.silent) console.error(`[PianoEngine] ${errMsg}`);
      if (options.throwOnError) throw err;
      return { success: false, note, error: errMsg, errorDetails: err, type: errType, url: trimmedUrl, status };
    }

    let arrayBuffer;
    try {
      arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        const err = new SampleLoadError(
          `Failed to load audio sample for note "${note}" from "${trimmedUrl}": Received empty audio payload (0 bytes).`,
          { type: "DECODE", url: trimmedUrl }
        );
        sampleLoadErrors.set(note, err);
        emitSampleError(err);
        if (options.throwOnError) throw err;
        return { success: false, note, error: err.message, errorDetails: err, type: "DECODE", url: trimmedUrl };
      }
    } catch (readErr) {
      const err = new SampleLoadError(
        `Failed to read audio data stream for note "${note}" from "${trimmedUrl}": ${readErr.message}`,
        { type: "NETWORK", url: trimmedUrl, originalError: readErr }
      );
      sampleLoadErrors.set(note, err);
      emitSampleError(err);
      if (options.throwOnError) throw err;
      return { success: false, note, error: err.message, errorDetails: err, type: "NETWORK", url: trimmedUrl };
    }

    return new Promise((resolve, reject) => {
      function onDecodeSuccess(decoded) {
        sampleBuffers.set(note, decoded);
        sampleLoadErrors.delete(note);
        resolve({
          success: true,
          note,
          buffer: decoded,
          url: trimmedUrl,
          error: null,
        });
      }

      function onDecodeFailure(decodeErr) {
        const err = new SampleLoadError(
          `Failed to decode audio sample for note "${note}" from "${trimmedUrl}": The audio file is corrupted or in an unsupported format.`,
          { type: "DECODE", url: trimmedUrl, originalError: decodeErr }
        );
        sampleLoadErrors.set(note, err);
        emitSampleError(err);
        if (typeof options.onError === "function") options.onError(err);
        if (!options.silent) console.error(`[PianoEngine] ${err.message}`);
        if (options.throwOnError) {
          reject(err);
        } else {
          resolve({
            success: false,
            note,
            buffer: null,
            error: err.message,
            errorDetails: err,
            type: "DECODE",
            url: trimmedUrl,
          });
        }
      }

      try {
        const bufferCopy = arrayBuffer.slice(0);
        const promise = context.decodeAudioData(
          bufferCopy,
          onDecodeSuccess,
          onDecodeFailure
        );

        if (promise && typeof promise.then === "function") {
          promise.then(onDecodeSuccess).catch(onDecodeFailure);
        }
      } catch (exc) {
        onDecodeFailure(exc);
      }
    });
  }

  async function loadSamples(sampleMap, options = {}) {
    const results = {};
    if (!sampleMap || typeof sampleMap !== "object") {
      return results;
    }

    await Promise.all(
      Object.entries(sampleMap).map(async ([note, url]) => {
        results[note] = await loadSample(note, url, {
          ...options,
          throwOnError: false,
        });
      })
    );

    return results;
  }

  function getSample(note) {
    return sampleBuffers.get(note) || null;
  }

  function hasSample(note) {
    return sampleBuffers.has(note);
  }

  function getSampleErrors() {
    return new Map(sampleLoadErrors);
  }

  function clearSamples() {
    sampleBuffers.clear();
    sampleLoadErrors.clear();
  }

  return {
    SampleLoadError,
    loadSample,
    loadSamples,
    getSample,
    hasSample,
    getSampleErrors,
    clearSamples,
    onSampleError,
    NOTE_FREQUENCIES,
    KEY_TO_NOTE,
    NOTE_TO_KEY,
    DEFAULT_MIDI_TO_NOTE,
    DEFAULT_NOTE_TO_MIDI,
    getFrequency,
    getNoteFromKey,
    getKeyFromNote,
    isValidNote,
    getNotes,
    getKeyboardMap,
    validateKeyboardMapping,
    setKeyboardMapping,
    applyKeyboardMapping,
    resetKeyboardMapping,
    validateMidiMapping,
    setMidiMapping,
    applyMidiMapping,
    resetMidiMapping,
    getMidiMap,
    getMidiMapping,
    getNoteFromMidi,
    getMidiFromNote,
    noteToMidiNumber,
    midiNumberToNote,
    midiToFrequency,
    frequencyToMidi,
    playNoteFromMidi,
    stopNoteFromMidi,
    startNote,
    stopNote,
    playNote,
    playNoteFromKey,
    stopNoteFromKey,
    stopAllNotes,
  };
});
