(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define([], factory);
    } else if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.PercussionEngine = factory();
    }
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    const PADS = Object.freeze([
        { id: "kick", label: "Kick", key: "q" },
        { id: "snare", label: "Snare", key: "w" },
        { id: "hihatClosed", label: "Closed Hi-Hat", key: "e" },
        { id: "hihatOpen", label: "Open Hi-Hat", key: "r" },
        { id: "tomLow", label: "Low Tom", key: "a" },
        { id: "tomHigh", label: "High Tom", key: "s" },
        { id: "clap", label: "Clap", key: "d" },
        { id: "crash", label: "Crash", key: "f" }
    ]);

    const KEY_TO_PAD = Object.freeze(
        Object.fromEntries(PADS.map(pad => [pad.key, pad.id]))
    );

    const PAD_TO_KEY = Object.freeze(
        Object.fromEntries(PADS.map(pad => [pad.id, pad.key]))
    );

    const PAD_LABELS = Object.freeze(
        Object.fromEntries(PADS.map(pad => [pad.id, pad.label]))
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

    function createNoiseBuffer(context, duration) {
        const length = Math.floor(context.sampleRate * duration);
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        return buffer;
    }

    function playKick(context, destination, time) {
        const osc = context.createOscillator();
        const gain = context.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(45, time + 0.18);

        gain.gain.setValueAtTime(0.9, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(time);
        osc.stop(time + 0.4);
    }

    function playSnare(context, destination, time) {
        const noise = context.createBufferSource();
        noise.buffer = createNoiseBuffer(context, 0.2);

        const noiseFilter = context.createBiquadFilter();
        noiseFilter.type = "highpass";
        noiseFilter.frequency.setValueAtTime(1000, time);

        const noiseGain = context.createGain();
        noiseGain.gain.setValueAtTime(0.55, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(destination);

        const osc = context.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(180, time);

        const oscGain = context.createGain();
        oscGain.gain.setValueAtTime(0.5, time);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);

        osc.connect(oscGain);
        oscGain.connect(destination);

        noise.start(time);
        noise.stop(time + 0.2);
        osc.start(time);
        osc.stop(time + 0.12);
    }

    function playHiHat(context, destination, time, open) {
        const duration = open ? 0.55 : 0.09;

        const noise = context.createBufferSource();
        noise.buffer = createNoiseBuffer(context, duration);

        const filter = context.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(7000, time);

        const gain = context.createGain();
        gain.gain.setValueAtTime(0.35, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(destination);

        noise.start(time);
        noise.stop(time + duration);
    }

    function playTom(context, destination, time, high) {
        const osc = context.createOscillator();
        const gain = context.createGain();

        const startFreq = high ? 260 : 150;
        const endFreq = high ? 120 : 70;

        osc.type = "sine";
        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.25);

        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);

        osc.connect(gain);
        gain.connect(destination);

        osc.start(time);
        osc.stop(time + 0.35);
    }

    function playClap(context, destination, time) {
        [0, 0.02, 0.04].forEach(offset => {
            const noise = context.createBufferSource();
            noise.buffer = createNoiseBuffer(context, 0.08);

            const filter = context.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.setValueAtTime(1200, time + offset);
            filter.Q.setValueAtTime(1.2, time + offset);

            const gain = context.createGain();
            gain.gain.setValueAtTime(0.45, time + offset);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + offset + 0.08);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(destination);

            noise.start(time + offset);
            noise.stop(time + offset + 0.08);
        });
    }

    function playCrash(context, destination, time) {
        const noise = context.createBufferSource();
        noise.buffer = createNoiseBuffer(context, 1.2);

        const filter = context.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.setValueAtTime(4500, time);

        const gain = context.createGain();
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.2);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(destination);

        noise.start(time);
        noise.stop(time + 1.2);
    }

    const PLAYERS = Object.freeze({
        kick: (context, destination, time) => playKick(context, destination, time),
        snare: (context, destination, time) => playSnare(context, destination, time),
        hihatClosed: (context, destination, time) =>
            playHiHat(context, destination, time, false),
        hihatOpen: (context, destination, time) =>
            playHiHat(context, destination, time, true),
        tomLow: (context, destination, time) => playTom(context, destination, time, false),
        tomHigh: (context, destination, time) => playTom(context, destination, time, true),
        clap: (context, destination, time) => playClap(context, destination, time),
        crash: (context, destination, time) => playCrash(context, destination, time)
    });

    function isValidPad(padId) {
        return Object.prototype.hasOwnProperty.call(PAD_LABELS, padId);
    }

    function getPadFromKey(key) {
        if (typeof key !== "string") {
            return null;
        }

        return KEY_TO_PAD[key.toLowerCase()] || null;
    }

    function getKeyFromPad(padId) {
        return PAD_TO_KEY[padId] || null;
    }

    function getPadLabel(padId) {
        return PAD_LABELS[padId] || null;
    }

    function getPads() {
        return PADS.map(pad => ({ ...pad }));
    }

    function playPad(padId) {
        if (!isValidPad(padId)) {
            return false;
        }

        const context = getAudioContext();

        if (!context) {
            return false;
        }

        const time = context.currentTime;
        PLAYERS[padId](context, context.destination, time);

        return true;
    }

    function playPadFromKey(key) {
        const padId = getPadFromKey(key);

        if (!padId) {
            return false;
        }

        return playPad(padId);
    }

    return {
        PADS,
        KEY_TO_PAD,
        PAD_TO_KEY,
        getPadFromKey,
        getKeyFromPad,
        getPadLabel,
        isValidPad,
        getPads,
        playPad,
        playPadFromKey
    };
});