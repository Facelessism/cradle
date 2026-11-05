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
} from "../projects/misc/audio-spectrogram-analyzer/scale.js";
import { AudioProcessor } from "../projects/misc/audio-spectrogram-analyzer/audio-processor.js";
import { SpectrogramVisualizer } from "../projects/misc/audio-spectrogram-analyzer/visualizer.js";

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
  assert.ok(y1kLog < 200, `Log Y for 1 kHz should be above mid-canvas: got ${y1kLog}`);

  // Invertibility test across decades
  const testFrequencies = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
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
      fillRect: () => { },
      drawImage: () => { },
      beginPath: () => { },
      moveTo: () => { },
      lineTo: () => { },
      stroke: () => { },
      strokeRect: () => { },
      fillText: () => { },
      createLinearGradient: () => ({ addColorStop: () => { } }),
      setLineDash: () => { },
      save: () => { },
      restore: () => { },
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
