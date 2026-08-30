'use strict';

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GuitarEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const STANDARD_TUNING = [
    { name: 'E2', frequency: 82.4069 },
    { name: 'A2', frequency: 110.0 },
    { name: 'D3', frequency: 146.832 },
    { name: 'G3', frequency: 195.998 },
    { name: 'B3', frequency: 246.942 },
    { name: 'E4', frequency: 329.628 }
  ];

  const NOTE_NAMES = [
    'C', 'C#', 'D', 'D#', 'E', 'F',
    'F#', 'G', 'G#', 'A', 'A#', 'B'
  ];

  const DEFAULTS = {
    duration: 2.2,
    volume: 0.45,
    decay: 2,
    brightness: 0.35
  };

  class GuitarEngine {
    constructor(options = {}) {
      this.options = {
        ...DEFAULTS,
        ...options
      };

      this.audioContext = null;
      this.masterGain = null;
      this.activeVoices = new Set();
      this.initialized = false;
    }

    initialize() {
      if (this.initialized) {
        return this.audioContext;
      }

      const AudioContext =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContext) {
        throw new Error(
          'Web Audio API is not supported in this browser.'
        );
      }

      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.options.volume;
      this.masterGain.connect(this.audioContext.destination);

      this.initialized = true;

      return this.audioContext;
    }

    async resume() {
      this.initialize();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      return this.audioContext;
    }

    midiToFrequency(midi) {
      return 440 * Math.pow(2, (midi - 69) / 12);
    }

    noteToMidi(note) {
      const match = /^([A-G])(#|b)?(-?\d+)$/.exec(note);

      if (!match) {
        throw new Error(`Invalid note: ${note}`);
      }

      const letter = match[1];
      const accidental = match[2] || '';
      const octave = Number(match[3]);

      let semitone = {
        C: 0,
        D: 2,
        E: 4,
        F: 5,
        G: 7,
        A: 9,
        B: 11
      }[letter];

      if (accidental === '#') {
        semitone += 1;
      }

      if (accidental === 'b') {
        semitone -= 1;
      }

      return (octave + 1) * 12 + semitone;
    }

    midiToNote(midi) {
      const octave = Math.floor(midi / 12) - 1;
      const note = NOTE_NAMES[((midi % 12) + 12) % 12];

      return `${note}${octave}`;
    }

    getFrequency(stringIndex, fret = 0) {
      this.validateString(stringIndex);

      if (!Number.isInteger(fret) || fret < 0) {
        throw new Error(
          'Fret must be a non-negative integer.'
        );
      }

      const baseFrequency =
        STANDARD_TUNING[stringIndex].frequency;

      return baseFrequency * Math.pow(2, fret / 12);
    }

    getNote(stringIndex, fret = 0) {
      this.validateString(stringIndex);

      if (!Number.isInteger(fret) || fret < 0) {
        throw new Error(
          'Fret must be a non-negative integer.'
        );
      }

      const baseNote = STANDARD_TUNING[stringIndex].name;
      const midi = this.noteToMidi(baseNote) + fret;

      return this.midiToNote(midi);
    }

    getString(stringIndex) {
      this.validateString(stringIndex);

      return {
        index: stringIndex,
        name: STANDARD_TUNING[stringIndex].name,
        frequency: STANDARD_TUNING[stringIndex].frequency
      };
    }

    getTuning() {
      return STANDARD_TUNING.map((string, index) => ({
        index,
        ...string
      }));
    }

    async playString(stringIndex, fret = 0, options = {}) {
      await this.resume();

      this.validateString(stringIndex);

      const frequency = this.getFrequency(stringIndex, fret);
      const note = this.getNote(stringIndex, fret);

      const settings = {
        ...this.options,
        ...options
      };

      const now = this.audioContext.currentTime;

      const oscillator = this.audioContext.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, now);

      const harmonic = this.audioContext.createOscillator();
      harmonic.type = 'sine';
      harmonic.frequency.setValueAtTime(frequency * 2, now);

      const gain = this.audioContext.createGain();

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(
        0.9,
        now + 0.008
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + settings.duration
      );

      const harmonicGain = this.audioContext.createGain();

      harmonicGain.gain.setValueAtTime(0.0001, now);
      harmonicGain.gain.exponentialRampToValueAtTime(
        settings.brightness * 0.25,
        now + 0.006
      );
      harmonicGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + settings.duration * 0.7
      );

      const filter = this.audioContext.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(
        Math.min(5000, frequency * 12),
        now
      );
      filter.Q.value = 0.7;

      const noiseBuffer = this.createPluckNoise();
      const noise = this.audioContext.createBufferSource();

      noise.buffer = noiseBuffer;

      const noiseGain = this.audioContext.createGain();

      noiseGain.gain.setValueAtTime(0.18, now);
      noiseGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.045
      );

      oscillator
        .connect(gain)
        .connect(filter);

      harmonic
        .connect(harmonicGain)
        .connect(filter);

      noise
        .connect(noiseGain)
        .connect(filter);

      filter.connect(this.masterGain);

      const voice = {
        oscillator,
        harmonic,
        noise,
        gain,
        harmonicGain,
        noiseGain,
        filter
      };

      this.activeVoices.add(voice);

      oscillator.start(now);
      harmonic.start(now);
      noise.start(now);

      const stopTime =
        now + settings.duration + 0.05;

      oscillator.stop(stopTime);
      harmonic.stop(stopTime);
      noise.stop(now + 0.06);

      oscillator.addEventListener('ended', () => {
        this.activeVoices.delete(voice);
      });

      return {
        string: stringIndex,
        fret,
        note,
        frequency
      };
    }

  async playNote(frequency, options = {}) {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new Error(
      'Frequency must be a positive number.'
    );
  }

  await this.resume();

  const settings = {
    ...this.options,
    ...options
  };

  const now = this.audioContext.currentTime;

  const oscillator = this.audioContext.createOscillator();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, now);

  const gain = this.audioContext.createGain();

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(
    0.8,
    now + 0.008
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + settings.duration
  );

  oscillator
    .connect(gain)
    .connect(this.masterGain);

  oscillator.start(now);
  oscillator.stop(
    now + settings.duration + 0.05
  );

  return {
    frequency
  };
}

    async strum(
      stringIndexes = [0, 1, 2, 3, 4, 5],
      options = {}
    ) {
      await this.resume();

      const direction = options.direction || 'down';
      const delay = options.delay ?? 0.035;

      const strings =
        direction === 'up'
          ? [...stringIndexes].reverse()
          : [...stringIndexes];

      const results = [];

      for (let index = 0; index < strings.length; index++) {
        const result = await new Promise(resolve => {
          setTimeout(async () => {
            const note = await this.playString(
              strings[index],
              options.fret ?? 0,
              options
            );

            resolve(note);
          }, index * delay);
        });

        results.push(result);
      }

      return results;
    }

    createPluckNoise() {
      const sampleRate = this.audioContext.sampleRate;
      const duration = 0.06;

      const buffer = this.audioContext.createBuffer(
        1,
        sampleRate * duration,
        sampleRate
      );

      const data = buffer.getChannelData(0);

      for (let i = 0; i < data.length; i++) {
        const envelope = 1 - i / data.length;

        data[i] =
          (Math.random() * 2 - 1) * envelope;
      }

      return buffer;
    }

    stopAll() {
      for (const voice of this.activeVoices) {
        try {
          voice.oscillator.stop();
        } catch (_) {}

        try {
          voice.harmonic.stop();
        } catch (_) {}

        try {
          voice.noise.stop();
        } catch (_) {}
      }

      this.activeVoices.clear();
    }

    setVolume(value) {
      this.initialize();

      const volume = Math.max(
        0,
        Math.min(1, Number(value))
      );

      this.options.volume = volume;

      this.masterGain.gain.setTargetAtTime(
        volume,
        this.audioContext.currentTime,
        0.01
      );
    }

    validateString(stringIndex) {
      if (
        !Number.isInteger(stringIndex) ||
        stringIndex < 0 ||
        stringIndex >= STANDARD_TUNING.length
      ) {
        throw new Error(
          `Invalid guitar string: ${stringIndex}`
        );
      }
    }

    static get STANDARD_TUNING() {
      return STANDARD_TUNING.map(string => ({
        ...string
      }));
    }
  }

  return GuitarEngine;
});