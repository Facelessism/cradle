import { test } from "node:test";
import assert from "node:assert/strict";
import {
  frequencyToY,
  yToFrequency,
  getFrequencyTicks,
  byteToDecibels,
  decibelsToByte,
  getDecibelTicks,
  formatFrequency,
  hzToMel,
  melToHz,
  frequencyToNote,
  detectPitchYIN,
} from "../projects/misc/audio-spectrogram-analyzer/scale.js";
import { AudioProcessor } from "../projects/misc/audio-spectrogram-analyzer/audio-processor.js";
import {
  SpectrogramVisualizer,
  isOffscreenCanvasSupported,
} from "../projects/misc/audio-spectrogram-analyzer/visualizer.js";
import { SpectrogramWorkerRenderer } from "../projects/misc/audio-spectrogram-analyzer/visualizer-worker.js";

test("formatFrequency formats Hertz and kiloHertz correctly", () => {
  assert.equal(formatFrequency(0), "0 Hz");
  assert.equal(formatFrequency(50), "50 Hz");
  assert.equal(formatFrequency(100), "100 Hz");
  assert.equal(formatFrequency(500), "500 Hz");
  assert.equal(formatFrequency(1000), "1 kHz");
  assert.equal(formatFrequency(5000), "5 kHz");
  assert.equal(formatFrequency(10000), "10 kHz");
  assert.equal(formatFrequency(20000), "20 kHz");
  assert.equal(formatFrequency(22050), "22.1 kHz");
  assert.equal(formatFrequency(NaN), "0 Hz");
});

test("frequencyToY and yToFrequency operate accurately in Linear mode", () => {
  const nyquist = 20000;
  const height = 400;

  // 0 Hz sits at the bottom (y = height)
  assert.equal(frequencyToY(0, nyquist, height, false), 400);

  // Nyquist sits at the top (y = 0)
  assert.equal(frequencyToY(nyquist, nyquist, height, false), 0);

  // 10 kHz sits in the exact middle (y = 200)
  assert.equal(frequencyToY(10000, nyquist, height, false), 200);

  // Invertibility test
  const testFrequencies = [0, 50, 100, 500, 1000, 5000, 10000, 15000, 20000];
  for (const f of testFrequencies) {
    const y = frequencyToY(f, nyquist, height, false);
    const recoveredF = yToFrequency(y, nyquist, height, false);
    assert.ok(
      Math.abs(recoveredF - f) < 1e-6,
      `Failed invertibility for ${f} Hz: got ${recoveredF}`
    );
  }
});

test("frequencyToY and yToFrequency operate accurately in Logarithmic mode", () => {
  const nyquist = 20000;
  const minFreq = 20;
  const height = 400;

  // minFreq sits at the bottom (y = height)
  assert.equal(frequencyToY(minFreq, nyquist, height, true, minFreq), 400);

  // Nyquist sits at the top (y = 0)
  assert.equal(frequencyToY(nyquist, nyquist, height, true, minFreq), 0);

  // Log scale should allocate much more vertical space to lower frequencies
  const y1kLinear = frequencyToY(1000, nyquist, height, false);
  const y1kLog = frequencyToY(1000, nyquist, height, true, minFreq);

  // 1 kHz in linear is 400 * (1 - 1000/20000) = 380 (compressed in bottom 5%)
  assert.equal(y1kLinear, 380);
  // 1 kHz in log is 400 * (1 - log10(50)/log10(1000)) = 400 * (1 - 1.69897 / 3) ~ 173.47
  assert.ok(
    y1kLog < 200,
    `Log Y for 1 kHz should be above mid-canvas: got ${y1kLog}`
  );

  // Invertibility test across decades
  const testFrequencies = [
    20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000,
  ];
  for (const f of testFrequencies) {
    const y = frequencyToY(f, nyquist, height, true, minFreq);
    const recoveredF = yToFrequency(y, nyquist, height, true, minFreq);
    assert.ok(
      Math.abs(recoveredF - f) < 1e-4,
      `Failed log invertibility for ${f} Hz: got ${recoveredF}`
    );
  }
});

test("getFrequencyTicks returns calibrated frequency ticks within Nyquist", () => {
  const linearTicks = getFrequencyTicks(22050, false);
  assert.ok(linearTicks.length > 0);
  const linearFreqs = linearTicks.map(t => t.freq);
  assert.ok(linearFreqs.includes(100));
  assert.ok(linearFreqs.includes(1000));
  assert.ok(linearFreqs.includes(5000));
  assert.ok(linearFreqs.includes(10000));
  assert.ok(linearFreqs.includes(20000));
  assert.ok(!linearFreqs.some(f => f > 22050));

  const logTicks = getFrequencyTicks(22050, true, 20);
  const logFreqs = logTicks.map(t => t.freq);
  assert.ok(logFreqs.includes(50));
  assert.ok(logFreqs.includes(100));
  assert.ok(logFreqs.includes(500));
  assert.ok(logFreqs.includes(1000));
  assert.ok(logFreqs.includes(5000));
  assert.ok(logFreqs.includes(10000));
});

test("byteToDecibels and decibelsToByte convert between Web Audio byte data and dBFS", () => {
  const minDb = -100;
  const maxDb = -30;

  // Byte 0 -> -100 dBFS
  assert.equal(byteToDecibels(0, minDb, maxDb), -100);

  // Byte 255 -> -30 dBFS
  assert.equal(byteToDecibels(255, minDb, maxDb), -30);

  // Half-scale byte
  const midDb = byteToDecibels(127.5, minDb, maxDb);
  assert.equal(midDb, -65);

  // Roundtrip conversion
  for (let b = 0; b <= 255; b += 15) {
    const db = byteToDecibels(b, minDb, maxDb);
    const recoveredByte = decibelsToByte(db, minDb, maxDb);
    assert.equal(recoveredByte, b);
  }
});

test("getDecibelTicks returns stepped intervals between maxDecibels and minDecibels", () => {
  const ticks = getDecibelTicks(-100, -30, 10);
  assert.equal(ticks.length, 8); // -30, -40, -50, -60, -70, -80, -90, -100
  assert.equal(ticks[0].dB, -30);
  assert.equal(ticks[0].label, "-30 dB");
  assert.equal(ticks[ticks.length - 1].dB, -100);
  assert.equal(ticks[ticks.length - 1].label, "-100 dB");
});

test("AudioProcessor decibel getters and peak calculations function properly", () => {
  const processor = new AudioProcessor();

  assert.equal(processor.getMinDecibels(), -100);
  assert.equal(processor.getMaxDecibels(), -30);
  assert.deepEqual(processor.getDecibelRange(), {
    minDecibels: -100,
    maxDecibels: -30,
  });
  assert.equal(processor.getSampleRate(), 44100);

  // Peak calculation on empty / uninitialized data
  assert.equal(processor.getPeakDecibels(), -100);

  // Peak calculation on mock frequency buffer
  processor.cachedFrequencyData = new Uint8Array([0, 50, 255, 120]);
  assert.equal(processor.getPeakDecibels(), -30); // 255 corresponds to maxDecibels (-30)

  processor.cachedFrequencyData = new Uint8Array([0, 0, 0, 0]);
  assert.equal(processor.getPeakDecibels(), -100); // 0 corresponds to minDecibels (-100)
});

test("SpectrogramVisualizer manages scale toggle and layout dimensions", () => {
  const mockCanvas = {
    width: 800,
    height: 400,
    getContext: () => ({
      fillRect: () => {},
      drawImage: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      strokeRect: () => {},
      fillText: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      setLineDash: () => {},
      save: () => {},
      restore: () => {},
    }),
  };

  const visualizer = new SpectrogramVisualizer(mockCanvas);

  assert.equal(visualizer.isLogarithmic, false);
  const dims = visualizer.getPlotDimensions();
  assert.equal(dims.width, 800);
  assert.equal(dims.height, 400);
  assert.equal(dims.plotX, 62);
  assert.equal(dims.plotY, 22);
  assert.equal(dims.plotWidth, 800 - 62 - 64); // 674
  assert.equal(dims.plotHeight, 400 - 22 - 28); // 350

  // Switch to logarithmic scale
  visualizer.setScale("logarithmic");
  assert.equal(visualizer.isLogarithmic, true);

  // Switch back to linear scale
  visualizer.setScale("linear");
  assert.equal(visualizer.isLogarithmic, false);
});

test("isOffscreenCanvasSupported returns boolean safely", () => {
  const supported = isOffscreenCanvasSupported();
  assert.equal(typeof supported, "boolean");
});

test("SpectrogramVisualizer uses OffscreenCanvas worker when supported", () => {
  const postedMessages = [];
  let terminated = false;

  class MockWorker {
    constructor(url, options) {
      this.url = url;
      this.options = options;
    }
    postMessage(data, transfer) {
      postedMessages.push({ data, transfer });
    }
    terminate() {
      terminated = true;
    }
  }

  const originalWorker = globalThis.Worker;
  globalThis.Worker = MockWorker;

  try {
    const mockOffscreen = {
      width: 800,
      height: 400,
      getContext: () => ({
        fillRect: () => {},
        drawImage: () => {},
      }),
    };

    let transferred = false;
    const mockCanvas = {
      width: 800,
      height: 400,
      transferControlToOffscreen: () => {
        transferred = true;
        return mockOffscreen;
      },
    };

    const visualizer = new SpectrogramVisualizer(mockCanvas);

    assert.equal(transferred, true);
    assert.equal(visualizer.isWorkerMode, true);
    assert.ok(visualizer.worker instanceof MockWorker);
    assert.equal(postedMessages.length, 1);
    assert.equal(postedMessages[0].data.type, "init");
    assert.equal(postedMessages[0].data.width, 800);
    assert.equal(postedMessages[0].data.height, 400);

    // Test resize
    visualizer.resizeCanvas();
    assert.equal(postedMessages.length, 2);
    assert.equal(postedMessages[1].data.type, "resize");

    // Test scale switch
    visualizer.setScale("logarithmic");
    assert.equal(postedMessages.length, 3);
    assert.equal(postedMessages[2].data.type, "setScale");
    assert.equal(postedMessages[2].data.scale, "logarithmic");

    // Test draw frame transfer
    const mockProcessor = {
      getFrequencyData: () => new Uint8Array([10, 50, 100, 200]),
      getSampleRate: () => 48000,
      getMinDecibels: () => -100,
      getMaxDecibels: () => -20,
      getPeakDecibels: () => -45,
    };
    visualizer.isRunning = true;
    visualizer.draw(mockProcessor);

    const frameMsg = postedMessages.find(m => m.data.type === "frame");
    assert.ok(frameMsg);
    assert.equal(frameMsg.data.sampleRate, 48000);
    assert.equal(frameMsg.data.peakDb, -45);
    assert.ok(frameMsg.data.data instanceof ArrayBuffer);
    assert.equal(frameMsg.transfer.length, 1);

    // Test destroy
    visualizer.destroy();
    assert.equal(terminated, true);
    assert.equal(visualizer.worker, null);
    assert.equal(visualizer.isWorkerMode, false);
  } finally {
    globalThis.Worker = originalWorker;
  }
});

test("SpectrogramVisualizer falls back gracefully if transferControlToOffscreen throws", () => {
  const originalWorker = globalThis.Worker;
  globalThis.Worker = class {
    postMessage() {}
    terminate() {}
  };

  try {
    let contextRequested = false;
    const throwingCanvas = {
      width: 800,
      height: 400,
      transferControlToOffscreen: () => {
        throw new Error(
          "InvalidStateError: Canvas already has a 2D rendering context"
        );
      },
      getContext: () => {
        contextRequested = true;
        return { fillRect: () => {} };
      },
    };

    const visualizer = new SpectrogramVisualizer(throwingCanvas);

    assert.equal(visualizer.isWorkerMode, false);
    assert.equal(visualizer.worker, null);
    assert.equal(contextRequested, true);
    assert.ok(visualizer.ctx);
  } finally {
    globalThis.Worker = originalWorker;
  }
});

test("SpectrogramWorkerRenderer manages offscreen rendering pipeline", () => {
  const mockCtx = {
    fillRect: () => {},
    drawImage: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    strokeRect: () => {},
    fillText: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    setLineDash: () => {},
    save: () => {},
    restore: () => {},
  };
  const mockCanvas = {
    width: 800,
    height: 400,
    getContext: () => mockCtx,
  };

  const renderer = new SpectrogramWorkerRenderer({
    canvas: mockCanvas,
    width: 800,
    height: 400,
  });

  const dims = renderer.getPlotDimensions();
  assert.equal(dims.width, 800);
  assert.equal(dims.height, 400);

  // Resize
  renderer.resize(1000, 500);
  assert.equal(renderer.width, 1000);
  assert.equal(renderer.height, 500);

  // Scale switch
  renderer.setScale("logarithmic");
  assert.equal(renderer.isLogarithmic, true);

  // Render frame
  const testBuffer = new Uint8Array([10, 20, 30, 40]).buffer;
  assert.doesNotThrow(() => {
    renderer.renderFrame({
      data: testBuffer,
      sampleRate: 44100,
      minDb: -100,
      maxDb: -30,
      peakDb: -60,
      timestamp: 1000,
    });
  });

  // Destroy
  renderer.destroy();
  assert.equal(renderer.canvas, null);
  assert.equal(renderer.ctx, null);
});

test("hzToMel and melToHz convert between physical Hz and perceptual Mel scale", () => {
  assert.equal(hzToMel(0), 0);
  assert.equal(melToHz(0), 0);

  // 1000 Hz ~ 1000 Mel
  const mel1k = hzToMel(1000);
  assert.ok(
    Math.abs(mel1k - 1000) < 1,
    `1 kHz should map to ~1000 Mel: got ${mel1k}`
  );

  // Invertibility across audio spectrum
  const testFreqs = [20, 100, 440, 1000, 3000, 5000, 10000, 20000];
  for (const f of testFreqs) {
    const mel = hzToMel(f);
    const recoveredF = melToHz(mel);
    assert.ok(
      Math.abs(recoveredF - f) < 1e-4,
      `Failed Mel invertibility for ${f} Hz: got ${recoveredF}`
    );
  }
});

test("frequencyToY and yToFrequency operate accurately in Mel scale mode", () => {
  const nyquist = 20000;
  const height = 400;

  // 0 Hz at the bottom
  assert.equal(frequencyToY(0, nyquist, height, "mel"), 400);

  // Nyquist at the top
  assert.equal(frequencyToY(nyquist, nyquist, height, "mel"), 0);

  // Invertibility test
  const testFrequencies = [0, 50, 100, 440, 1000, 2500, 5000, 10000, 20000];
  for (const f of testFrequencies) {
    const y = frequencyToY(f, nyquist, height, "mel");
    const recoveredF = yToFrequency(y, nyquist, height, "mel");
    assert.ok(
      Math.abs(recoveredF - f) < 1e-4,
      `Failed Mel scale invertibility for ${f} Hz: got ${recoveredF}`
    );
  }
});

test("getFrequencyTicks returns calibrated frequency ticks for Mel scale", () => {
  const melTicks = getFrequencyTicks(22050, "mel");
  assert.ok(melTicks.length > 0);
  const melFreqs = melTicks.map(t => t.freq);
  assert.ok(melFreqs.includes(100));
  assert.ok(melFreqs.includes(1000));
  assert.ok(melFreqs.includes(5000));
  assert.ok(melFreqs.includes(10000));
  assert.ok(melFreqs.includes(20000));
});

test("frequencyToNote correctly maps Hz to chromatic notes and cent deviations", () => {
  // A4 = 440 Hz
  const a4 = frequencyToNote(440);
  assert.equal(a4.note, "A4");
  assert.equal(a4.noteName, "A");
  assert.equal(a4.octave, 4);
  assert.equal(a4.midi, 69);
  assert.equal(a4.cents, 0);
  assert.equal(a4.inTune, true);

  // C5 = ~523.25 Hz
  const c5 = frequencyToNote(523.25);
  assert.equal(c5.note, "C5");
  assert.equal(c5.noteName, "C");
  assert.equal(c5.octave, 5);
  assert.equal(c5.midi, 72);
  assert.ok(Math.abs(c5.cents) < 1);
  assert.equal(c5.inTune, true);

  // Slightly sharp A4 (445 Hz)
  const a4Sharp = frequencyToNote(445);
  assert.equal(a4Sharp.note, "A4");
  assert.ok(
    a4Sharp.cents > 0,
    `Expected positive cents for sharp note: got ${a4Sharp.cents}`
  );

  // Slightly flat A4 (435 Hz)
  const a4Flat = frequencyToNote(435);
  assert.equal(a4Flat.note, "A4");
  assert.ok(
    a4Flat.cents < 0,
    `Expected negative cents for flat note: got ${a4Flat.cents}`
  );

  // Invalid frequencies return null
  assert.equal(frequencyToNote(0), null);
  assert.equal(frequencyToNote(-100), null);
  assert.equal(frequencyToNote(NaN), null);
});

test("detectPitchYIN detects fundamental frequency from time-domain sine wave", () => {
  const sampleRate = 44100;
  const targetFreq = 440; // A4
  const numSamples = 2048;
  const buffer = new Float32Array(numSamples);

  // Generate pure 440 Hz sine wave
  for (let i = 0; i < numSamples; i++) {
    buffer[i] = 0.8 * Math.sin((2 * Math.PI * targetFreq * i) / sampleRate);
  }

  const pitchResult = detectPitchYIN(buffer, sampleRate);
  assert.ok(pitchResult !== null, "Pitch detection should find F0");
  assert.ok(
    Math.abs(pitchResult.freq - 440) < 2,
    `Expected ~440 Hz: got ${pitchResult.freq} Hz`
  );
  assert.equal(pitchResult.noteInfo.note, "A4");
  assert.ok(pitchResult.clarity > 0.85);

  // Silence should return null
  const silenceBuffer = new Float32Array(numSamples);
  assert.equal(detectPitchYIN(silenceBuffer, sampleRate), null);
});

test("AudioProcessor getHarmonicPeaks calculates overtones and decibel amplitudes", () => {
  const processor = new AudioProcessor();
  processor.cachedFrequencyData = new Uint8Array(1024).fill(50);
  const sampleRate = 44100;
  const nyquist = sampleRate / 2;
  const bin440 = Math.round((440 / nyquist) * 1024);
  const bin880 = Math.round((880 / nyquist) * 1024);
  processor.cachedFrequencyData[bin440] = 240;
  processor.cachedFrequencyData[bin880] = 180;

  const harmonics = processor.getHarmonicPeaks(440, 4);
  assert.equal(harmonics.length, 4);
  assert.equal(harmonics[0].harmonic, 1);
  assert.equal(harmonics[0].freq, 440);
  assert.equal(harmonics[1].harmonic, 2);
  assert.equal(harmonics[1].freq, 880);
});

test("SpectrogramVisualizer and SpectrogramWorkerRenderer support Mel scale mode and hover", () => {
  const mockCanvas = {
    width: 800,
    height: 400,
    getContext: () => ({
      fillRect: () => {},
      drawImage: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      strokeRect: () => {},
      fillText: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      setLineDash: () => {},
      save: () => {},
      restore: () => {},
      arc: () => {},
    }),
  };

  const visualizer = new SpectrogramVisualizer(mockCanvas);
  visualizer.setScale("mel");
  assert.equal(visualizer.scaleMode, "mel");
  assert.equal(visualizer.isLogarithmic, false);

  const renderer = new SpectrogramWorkerRenderer({
    canvas: mockCanvas,
    width: 800,
    height: 400,
    scaleMode: "mel",
  });
  assert.equal(renderer.scaleMode, "mel");
  renderer.setScale("linear");
  assert.equal(renderer.scaleMode, "linear");
  renderer.setScale("mel");
  assert.equal(renderer.scaleMode, "mel");
  renderer.destroy();
});
