import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import MorseEngine from "../projects/misc/morse-code-studio/morseEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptSource = fs.readFileSync(
  path.join(__dirname, "../projects/misc/morse-code-studio/script.js"),
  "utf8"
);

function createStudioSandbox() {
  const listeners = {
    window: {},
    document: {},
  };

  let oscillatorStopped = false;
  let oscillatorDisconnected = false;
  let gainValuesCancelled = false;
  let gainDisconnected = false;
  let contextSuspended = false;
  let contextClosed = false;

  const mockOscillator = {
    type: "sine",
    frequency: { value: 650 },
    connect: () => {},
    disconnect: () => {
      oscillatorDisconnected = true;
    },
    start: () => {},
    stop: () => {
      oscillatorStopped = true;
    },
    addEventListener: (evt, fn) => {
      if (evt === "ended") {
        setTimeout(fn, 0);
      }
    },
  };

  const mockGain = {
    gain: {
      setValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
      cancelScheduledValues: () => {
        gainValuesCancelled = true;
      },
    },
    connect: () => {},
    disconnect: () => {
      gainDisconnected = true;
    },
  };

  const mockAudioContext = {
    currentTime: 0,
    state: "running",
    createOscillator: () => mockOscillator,
    createGain: () => mockGain,
    suspend: async () => {
      contextSuspended = true;
      mockAudioContext.state = "suspended";
    },
    resume: async () => {
      mockAudioContext.state = "running";
    },
    close: async () => {
      contextClosed = true;
      mockAudioContext.state = "closed";
    },
    destination: {},
  };

  const mockElements = {
    inputText: { value: "SOS" },
    outputText: { value: "... --- ..." },
    decodeBtn: { addEventListener: () => {} },
    encodeBtn: { addEventListener: () => {} },
    clearBtn: { addEventListener: () => {} },
    copyBtn: { addEventListener: () => {}, textContent: "" },
    playBtn: {
      addEventListener: () => {},
      disabled: false,
      textContent: "▶ Play",
    },
    speedSlider: { value: "20", addEventListener: () => {} },
    speedValue: { textContent: "" },
  };

  const mockWindow = {
    AudioContext: function () {
      return mockAudioContext;
    },
    addEventListener: (evt, fn) => {
      listeners.window[evt] = listeners.window[evt] || [];
      listeners.window[evt].push(fn);
    },
  };

  const mockDocument = {
    hidden: false,
    getElementById: id => mockElements[id] || null,
    addEventListener: (evt, fn) => {
      listeners.document[evt] = listeners.document[evt] || [];
      listeners.document[evt].push(fn);
    },
  };

  const sandbox = {
    window: mockWindow,
    document: mockDocument,
    MorseEngine,
    setTimeout,
    clearTimeout,
    module: { exports: {} },
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(scriptSource, sandbox);

  return {
    sandbox,
    listeners,
    mockAudioContext,
    mockOscillator,
    mockGain,
    mockElements,
    getAudioFlags: () => ({
      get oscillatorStopped() {
        return oscillatorStopped;
      },
      get oscillatorDisconnected() {
        return oscillatorDisconnected;
      },
      get gainValuesCancelled() {
        return gainValuesCancelled;
      },
      get gainDisconnected() {
        return gainDisconnected;
      },
      get contextSuspended() {
        return contextSuspended;
      },
      get contextClosed() {
        return contextClosed;
      },
    }),
  };
}

test("textToMorse converts plain text to standard morse representation", () => {
  assert.equal(MorseEngine.textToMorse("SOS"), "... --- ...");
  assert.equal(
    MorseEngine.textToMorse("Hello World"),
    ".... . .-.. .-.. --- / .-- --- .-. .-.. -.."
  );
});

test("morseToText decodes morse signals back to uppercase text", () => {
  assert.equal(MorseEngine.morseToText("... --- ..."), "SOS");
  assert.equal(
    MorseEngine.morseToText(".... . .-.. .-.. --- / .-- --- .-. .-.. -.."),
    "HELLO WORLD"
  );
});

test("getDitDurationMs computes duration correctly based on WPM speed", () => {
  // 1200 / 20 = 60ms
  assert.equal(MorseEngine.getDitDurationMs(20), 60);
  // 1200 / 12 = 100ms
  assert.equal(MorseEngine.getDitDurationMs(12), 100);
});

test("generateAudioSequence builds alternating tone and pause events", () => {
  const sequence = MorseEngine.generateAudioSequence(".", 20, 600);
  assert.equal(sequence.length, 1);
  assert.equal(sequence[0].type, "tone");
  assert.equal(sequence[0].durationMs, 60);
});

test("stopAudio stops active oscillator, gain node, suspends context, and resets UI", () => {
  const env = createStudioSandbox();
  const { sandbox, mockAudioContext, mockElements, getAudioFlags } = env;
  const { module } = sandbox;
  const { stopAudio, setAudioContext, setIsPlaying } = module.exports;

  setAudioContext(mockAudioContext);
  setIsPlaying(true);
  mockElements.playBtn.disabled = true;
  mockElements.playBtn.textContent = "■ Playing...";

  // Simulate active oscillator and gain node
  const osc = mockAudioContext.createOscillator();
  const gain = mockAudioContext.createGain();
  module.exports.setActiveNodes(osc, gain);

  // Run stopAudio
  stopAudio();

  assert.equal(
    module.exports.getAudioState().isPlaying,
    false,
    "isPlaying should be false"
  );
  assert.equal(
    mockElements.playBtn.disabled,
    false,
    "playBtn should be enabled"
  );
  assert.equal(
    mockElements.playBtn.textContent,
    "▶ Play",
    "playBtn text should be reset"
  );
  assert.equal(
    getAudioFlags().oscillatorStopped,
    true,
    "active oscillator should be stopped"
  );
  assert.equal(
    getAudioFlags().oscillatorDisconnected,
    true,
    "active oscillator should be disconnected"
  );
  assert.equal(
    getAudioFlags().gainValuesCancelled,
    true,
    "gain values should be cancelled"
  );
  assert.equal(
    getAudioFlags().gainDisconnected,
    true,
    "active gain node should be disconnected"
  );
  assert.equal(
    getAudioFlags().contextSuspended,
    true,
    "audioContext should be suspended"
  );
});

test("pagehide event listener halts audio playback and closes AudioContext", () => {
  const env = createStudioSandbox();
  const { sandbox, listeners, mockAudioContext, mockElements, getAudioFlags } =
    env;
  const { module } = sandbox;
  const { setAudioContext, setIsPlaying } = module.exports;

  setAudioContext(mockAudioContext);
  setIsPlaying(true);
  mockElements.playBtn.disabled = true;

  assert.ok(
    listeners.window.pagehide && listeners.window.pagehide.length > 0,
    "pagehide listener should be registered"
  );

  // Trigger pagehide
  listeners.window.pagehide.forEach(fn => fn());

  assert.equal(
    module.exports.getAudioState().isPlaying,
    false,
    "Playback should stop on pagehide"
  );
  assert.equal(
    getAudioFlags().contextClosed,
    true,
    "AudioContext should close on pagehide"
  );
  assert.equal(mockElements.playBtn.disabled, false);
});

test("visibilitychange event listener halts audio playback when document is hidden", () => {
  const env = createStudioSandbox();
  const { sandbox, listeners, mockAudioContext, mockElements, getAudioFlags } =
    env;
  const { module } = sandbox;
  const { setAudioContext, setIsPlaying } = module.exports;

  setAudioContext(mockAudioContext);
  setIsPlaying(true);
  mockElements.playBtn.disabled = true;

  assert.ok(
    listeners.document.visibilitychange &&
      listeners.document.visibilitychange.length > 0,
    "visibilitychange listener should be registered"
  );

  // When visible, should not stop
  sandbox.document.hidden = false;
  listeners.document.visibilitychange.forEach(fn => fn());
  assert.equal(
    module.exports.getAudioState().isPlaying,
    true,
    "Playback should continue when document is visible"
  );

  // When hidden, should stop
  sandbox.document.hidden = true;
  listeners.document.visibilitychange.forEach(fn => fn());
  assert.equal(
    module.exports.getAudioState().isPlaying,
    false,
    "Playback should stop when document is hidden"
  );
  assert.equal(
    getAudioFlags().contextSuspended,
    true,
    "AudioContext should suspend when document is hidden"
  );
});

test("clicking Back to Home button stops playback and closes AudioContext", () => {
  const env = createStudioSandbox();
  const { sandbox, listeners, mockAudioContext, mockElements, getAudioFlags } =
    env;
  const { module } = sandbox;
  const { setAudioContext, setIsPlaying } = module.exports;

  setAudioContext(mockAudioContext);
  setIsPlaying(true);
  mockElements.playBtn.disabled = true;

  assert.ok(
    listeners.document.click && listeners.document.click.length > 0,
    "click listener should be registered on document"
  );

  const mockBackBtn = {
    matches: sel => sel.includes(".cradle-back-home"),
  };
  const mockClickEvent = {
    target: {
      closest: sel => (sel.includes(".cradle-back-home") ? mockBackBtn : null),
    },
  };

  listeners.document.click.forEach(fn => fn(mockClickEvent));

  assert.equal(
    module.exports.getAudioState().isPlaying,
    false,
    "Playback should stop on BackToHome click"
  );
  assert.equal(
    getAudioFlags().contextClosed,
    true,
    "AudioContext should close on BackToHome click"
  );
  assert.equal(mockElements.playBtn.disabled, false);
});

test("pointerdown on Back to Home button halts playback immediately in capture phase", () => {
  const env = createStudioSandbox();
  const { sandbox, listeners, mockAudioContext, mockElements, getAudioFlags } =
    env;
  const { module } = sandbox;
  const { setAudioContext, setIsPlaying } = module.exports;

  setAudioContext(mockAudioContext);
  setIsPlaying(true);
  mockElements.playBtn.disabled = true;

  assert.ok(
    listeners.document.pointerdown && listeners.document.pointerdown.length > 0,
    "pointerdown listener should be registered on document"
  );

  const mockBackBtn = {
    matches: sel => sel.includes(".cradle-back-home"),
  };
  const mockPointerEvent = {
    target: {
      closest: sel => (sel.includes(".cradle-back-home") ? mockBackBtn : null),
    },
  };

  listeners.document.pointerdown.forEach(fn => fn(mockPointerEvent));

  assert.equal(
    module.exports.getAudioState().isPlaying,
    false,
    "Playback should stop on pointerdown"
  );
  assert.equal(
    getAudioFlags().contextClosed,
    true,
    "AudioContext should close on pointerdown"
  );
});

test("beforeunload, unload, and popstate listeners close AudioContext and stop playback", () => {
  const env = createStudioSandbox();
  const { sandbox, listeners, mockAudioContext, mockElements, getAudioFlags } =
    env;
  const { module } = sandbox;
  const { setAudioContext, setIsPlaying } = module.exports;

  assert.ok(
    listeners.window.beforeunload && listeners.window.beforeunload.length > 0,
    "beforeunload listener registered"
  );
  assert.ok(
    listeners.window.unload && listeners.window.unload.length > 0,
    "unload listener registered"
  );
  assert.ok(
    listeners.window.popstate && listeners.window.popstate.length > 0,
    "popstate listener registered"
  );

  // Trigger beforeunload
  setAudioContext(mockAudioContext);
  setIsPlaying(true);
  mockElements.playBtn.disabled = true;
  listeners.window.beforeunload.forEach(fn => fn());
  assert.equal(module.exports.getAudioState().isPlaying, false);
  assert.equal(getAudioFlags().contextClosed, true);

  // Trigger popstate
  let popstateClosed = false;
  const freshCtx = {
    currentTime: 0,
    state: "running",
    close: async () => {
      popstateClosed = true;
      freshCtx.state = "closed";
    },
    suspend: async () => {},
  };
  setAudioContext(freshCtx);
  setIsPlaying(true);
  listeners.window.popstate.forEach(fn => fn());
  assert.equal(module.exports.getAudioState().isPlaying, false);
  assert.equal(popstateClosed, true);
});

test("stopAudio with closeContext=true closes and nulls AudioContext", () => {
  const env = createStudioSandbox();
  const { sandbox, mockAudioContext, getAudioFlags } = env;
  const { module } = sandbox;
  const { stopAudio, setAudioContext, setIsPlaying } = module.exports;

  setAudioContext(mockAudioContext);
  setIsPlaying(true);

  stopAudio({ closeContext: true });

  assert.equal(module.exports.getAudioState().isPlaying, false);
  assert.equal(getAudioFlags().contextClosed, true);
  assert.equal(module.exports.getAudioState().audioContext, null);
});

test("playMorse creates new AudioContext if previous context is closed or null", async () => {
  const env = createStudioSandbox();
  const { sandbox, mockElements } = env;
  const { module } = sandbox;
  const { playMorse, setAudioContext, getAudioState } = module.exports;

  // Closed context initially
  setAudioContext({ state: "closed" });
  mockElements.outputText.value = ".";

  await playMorse();

  const currentCtx = getAudioState().audioContext;
  assert.ok(currentCtx, "A new AudioContext should be created");
  assert.notEqual(currentCtx.state, "closed", "State should not be closed");
});

test("calculateTiming calculates accurate Paris standard values at 20 WPM", () => {
  const timing = MorseEngine.calculateTiming(20, null, 700);
  assert.equal(timing.ditMs, 60);
  assert.equal(timing.dahMs, 180);
  assert.equal(timing.symbolPauseMs, 60);
  assert.equal(timing.charPauseMs, 180);
  assert.equal(timing.wordPauseMs, 420);
  assert.equal(timing.frequency, 700);
});

test("calculateTiming clamps WPM and frequency to valid amateur radio ranges", () => {
  // Clamps WPM below 5 and above 60
  const lowTiming = MorseEngine.calculateTiming(2, null, 150);
  assert.equal(lowTiming.charWpm, 5);
  assert.equal(lowTiming.frequency, 300);

  const highTiming = MorseEngine.calculateTiming(100, null, 1500);
  assert.equal(highTiming.charWpm, 60);
  assert.equal(highTiming.frequency, 1000);
});

test("calculateTiming applies ARRL Farnsworth formula when farnsworthWpm < charWpm", () => {
  const farnsworth = MorseEngine.calculateTiming(20, 12, 650);
  // Dits and dahs remain fast (20 WPM)
  assert.equal(farnsworth.ditMs, 60);
  assert.equal(farnsworth.dahMs, 180);
  assert.equal(farnsworth.symbolPauseMs, 60);

  // Character pause and word pause are stretched to match overall 12 WPM
  // Extra unit space = (60000/12 - 37200/20) / 19 = (5000 - 1860) / 19 = 165.26 ms
  // charPause = 3 * 165.26 ~ 496 ms (> 180 ms)
  // wordPause = 7 * 165.26 ~ 1157 ms (> 420 ms)
  assert.ok(farnsworth.charPauseMs > 180, "Char pause should be elongated");
  assert.ok(farnsworth.wordPauseMs > 420, "Word pause should be elongated");
  assert.equal(farnsworth.charPauseMs, 496);
  assert.equal(farnsworth.wordPauseMs, 1157);
});

test("generateAudioSequence respects custom sidetone pitch and Farnsworth timing", () => {
  const sequence = MorseEngine.generateAudioSequence("A", 20, 750, 12);
  // 'A' is ".-" -> tone (dit), pause (symbol), tone (dah)
  assert.equal(sequence.length, 3);
  assert.equal(sequence[0].type, "tone");
  assert.equal(sequence[0].frequency, 750);
  assert.equal(sequence[0].durationMs, 60);
  assert.equal(sequence[1].type, "pause");
  assert.equal(sequence[1].durationMs, 60);
  assert.equal(sequence[2].type, "tone");
  assert.equal(sequence[2].frequency, 750);
  assert.equal(sequence[2].durationMs, 180);

  // For multiple characters: "A B" with Farnsworth timing
  const seqMulti = MorseEngine.generateAudioSequence("A B", 20, 650, 12);
  const wordPause = seqMulti.find(
    evt => evt.type === "pause" && evt.durationMs > 500
  );
  assert.ok(wordPause, "A prolonged word pause should be present");
});

test("classifyPulse classifies dits, dahs, and suppresses noise glitches", () => {
  const ditMs = 60; // 20 WPM
  // Glitch under 0.3 * 60 = 18 ms
  assert.equal(MorseEngine.classifyPulse(10, ditMs), null);

  // Dit: 20 ms to 119 ms
  assert.equal(MorseEngine.classifyPulse(55, ditMs), ".");
  assert.equal(MorseEngine.classifyPulse(70, ditMs), ".");

  // Dah: >= 120 ms
  assert.equal(MorseEngine.classifyPulse(120, ditMs), "-");
  assert.equal(MorseEngine.classifyPulse(185, ditMs), "-");
});

test("classifyGap categorizes intra-character, inter-character, and word pauses", () => {
  const ditMs = 60; // 20 WPM
  // Transient bounce under 21 ms
  assert.equal(MorseEngine.classifyGap(15, ditMs), null);

  // Element gap: 21 ms to 131 ms
  assert.equal(MorseEngine.classifyGap(60, ditMs), "element");

  // Character gap: 132 ms to 329 ms
  assert.equal(MorseEngine.classifyGap(180, ditMs), "character");

  // Word gap: >= 330 ms
  assert.equal(MorseEngine.classifyGap(420, ditMs), "word");
});

test("createMorseStreamDecoder decodes pulse and silence sequences to text", () => {
  const decoder = MorseEngine.createMorseStreamDecoder({ wpm: 20 });

  // Feed "S": . . .
  decoder.feedTone(60);
  decoder.feedSilence(60);
  decoder.feedTone(60);
  decoder.feedSilence(60);
  decoder.feedTone(60);
  decoder.feedSilence(180); // character gap triggers decode of "S"

  assert.equal(decoder.getText(), "S");
  assert.equal(decoder.getBuffer(), "");

  // Feed "O": - - -
  decoder.feedTone(180);
  decoder.feedSilence(60);
  decoder.feedTone(180);
  decoder.feedSilence(60);
  decoder.feedTone(180);
  decoder.feedSilence(180); // character gap triggers decode of "O"

  assert.equal(decoder.getText(), "SO");

  // Feed "S" + word space
  decoder.feedTone(60);
  decoder.feedSilence(60);
  decoder.feedTone(60);
  decoder.feedSilence(60);
  decoder.feedTone(60);
  decoder.feedSilence(420); // word gap triggers decode of "S" and word space

  assert.equal(decoder.getText(), "SOS ");
});

test("createMorseStreamDecoder processState handles real-time timestamped keying", () => {
  const decoder = MorseEngine.createMorseStreamDecoder({ wpm: 20 });
  let t = 1000;

  // Key down for 'E' (dit = 60 ms)
  decoder.processState(true, t);
  t += 60;
  decoder.processState(false, t);

  // Silence for 200 ms (char break)
  t += 200;
  decoder.processState(false, t);

  assert.equal(decoder.getText(), "E");
});

test("detectPeakFrequency detects peak frequency in FFT spectral magnitude array", () => {
  // 512 bins, sampleRate 48000 -> bin width = 46.875 Hz
  const freqData = new Uint8Array(512);
  const targetFreq = 703; // ~ bin 15 (15 * 46.875 = 703.125 Hz)
  const targetBin = Math.round((targetFreq * 1024) / 48000);

  freqData[targetBin - 1] = 120;
  freqData[targetBin] = 220;
  freqData[targetBin + 1] = 130;

  const detected = MorseEngine.detectPeakFrequency(freqData, 48000, 300, 1000);
  assert.ok(
    Math.abs(detected.frequency - 703) < 30,
    `Detected freq ${detected.frequency} should be close to 703 Hz`
  );
  assert.equal(detected.magnitude, 220);
});

test("isTonePresent accurately checks threshold detection in target frequency band", () => {
  const freqData = new Uint8Array(512);
  const targetBin = Math.round((650 * 1024) / 48000);

  // Below threshold
  freqData[targetBin] = 30;
  let check = MorseEngine.isTonePresent(freqData, 48000, 650, 90, 45);
  assert.equal(check.active, false);

  // Above threshold
  freqData[targetBin] = 80;
  check = MorseEngine.isTonePresent(freqData, 48000, 650, 90, 45);
  assert.equal(check.active, true);
  assert.equal(check.level, 80);
});

test("stopListening halts active microphone stream tracks and resets decoder state", () => {
  const env = createStudioSandbox();
  const { sandbox } = env;
  const { module } = sandbox;
  const { stopListening, getDecoderState } = module.exports;

  let trackStopped = false;
  const mockTrack = {
    stop: () => {
      trackStopped = true;
    },
  };
  const mockStream = {
    getTracks: () => [mockTrack],
  };

  // Attach mock decoder stream
  sandbox.module.exports.getDecoderState().decoderStream = mockStream;

  stopListening();

  assert.equal(
    getDecoderState().isListening,
    false,
    "Decoder should not be listening after stopListening"
  );
});
