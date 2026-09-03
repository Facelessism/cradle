(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define([], factory);
    } else if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.GuzhengEngine = factory();
    }
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    /* Guzheng strings are tuned to a pentatonic scale (D major pentatonic:
       D E F# A B), spanning roughly 4 octaves — 21 strings, low to high. */
    const STRINGS = Object.freeze([
        { note: "D3", freq: 146.83, key: "1" },
        { note: "E3", freq: 164.81, key: "2" },
        { note: "F#3", freq: 185.0, key: "3" },
        { note: "A3", freq: 220.0, key: "4" },
        { note: "B3", freq: 246.94, key: "5" },
        { note: "D4", freq: 293.66, key: "6" },
        { note: "E4", freq: 329.63, key: "7" },
        { note: "F#4", freq: 369.99, key: "8" },
        { note: "A4", freq: 440.0, key: "9" },
        { note: "B4", freq: 493.88, key: "0" },
        { note: "D5", freq: 587.33, key: "q" },
        { note: "E5", freq: 659.25, key: "w" },
        { note: "F#5", freq: 739.99, key: "e" },
        { note: "A5", freq: 880.0, key: "r" },
        { note: "B5", freq: 987.77, key: "t" },
        { note: "D6", freq: 1174.66, key: "y" },
        { note: "E6", freq: 1318.51, key: "u" },
        { note: "F#6", freq: 1479.98, key: "i" },
        { note: "A6", freq: 1760.0, key: "o" },
        { note: "B6", freq: 1975.53, key: "p" },
        { note: "D7", freq: 2349.32, key: "[" }
    ]);

    const KEY_TO_NOTE = Object.freeze(
        Object.fromEntries(STRINGS.map(s => [s.key, s.note]))
    );

    const NOTE_TO_KEY = Object.freeze(
        Object.fromEntries(STRINGS.map(s => [s.note, s.key]))
    );

    const NOTE_TO_FREQ = Object.freeze(
        Object.fromEntries(STRINGS.map(s => [s.note, s.freq]))
    );

    let audioContext = null;

    function getAudioContext() {
        if (typeof window === "undefined") {
            return null;
        }

        const AudioContext = window.AudioContext || window.webkitAudioContext;

        if (!AudioContext) {
            return null;
        }

        if (!audioContext) {
            audioContext = new AudioContext();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume().catch(() => { });
        }

        return audioContext;
    }

    function createPluckNoise(context, destination, frequency, time) {
        const duration = 0.03;
        const length = Math.floor(context.sampleRate * duration);
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / length);
        }

        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();

        source.buffer = buffer;
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(
            Math.min(Math.max(frequency * 3, 1200), 6000),
            time
        );
        filter.Q.setValueAtTime(1.4, time);

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.18, time + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(destination);

        source.start(time);
        source.stop(time + duration + 0.01);
    }

    function pluckString(note) {
        if (!isValidNote(note)) {
            return false;
        }

        const context = getAudioContext();

        if (!context) {
            return false;
        }

        const time = context.currentTime;
        const frequency = NOTE_TO_FREQ[note];

        const output = context.createGain();
        output.gain.setValueAtTime(0.0001, time);
        output.gain.exponentialRampToValueAtTime(0.4, time + 0.004);
        output.gain.exponentialRampToValueAtTime(0.16, time + 0.5);
        output.gain.exponentialRampToValueAtTime(0.0001, time + 2.6);
        output.connect(context.destination);

        /* Harmonic series shaped for a bright, metallic zither timbre. */
        const harmonics = [
            [1, 0.65],
            [2, 0.3],
            [3, 0.16],
            [4, 0.09],
            [5, 0.05],
            [6, 0.03]
        ];

        harmonics.forEach(([multiplier, volume]) => {
            const oscillator = context.createOscillator();
            const harmonicGain = context.createGain();

            oscillator.type = multiplier === 1 ? "triangle" : "sine";
            oscillator.frequency.setValueAtTime(frequency * multiplier, time);

            harmonicGain.gain.setValueAtTime(volume, time);

            oscillator.connect(harmonicGain);
            harmonicGain.connect(output);

            oscillator.start(time);
            oscillator.stop(time + 2.7);
        });

        createPluckNoise(context, output, frequency, time);

        return true;
    }

    function pluckStringFromKey(key) {
        const note = getNoteFromKey(key);

        if (!note) {
            return false;
        }

        return pluckString(note);
    }

    function getNoteFromKey(key) {
        if (typeof key !== "string") {
            return null;
        }

        return KEY_TO_NOTE[key.toLowerCase()] || null;
    }

    function getKeyFromNote(note) {
        return NOTE_TO_KEY[note] || null;
    }

    function getFrequency(note) {
        return NOTE_TO_FREQ[note] || null;
    }

    function isValidNote(note) {
        return Object.prototype.hasOwnProperty.call(NOTE_TO_FREQ, note);
    }

    function getStrings() {
        return STRINGS.map(s => ({ ...s }));
    }

    return {
        STRINGS,
        KEY_TO_NOTE,
        NOTE_TO_KEY,
        getNoteFromKey,
        getKeyFromNote,
        getFrequency,
        isValidNote,
        getStrings,
        pluckString,
        pluckStringFromKey
    };
});