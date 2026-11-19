/**
 * Spectrogram Scale & Calibration Utilities
 * Provides mathematical conversions for Linear/Logarithmic/Mel frequency axes,
 * decibel (dBFS) amplitude mappings, musical chromatic pitch conversion,
 * YIN autocorrelation fundamental frequency (F0) detection, and tick generators.
 */

/**
 * Musical note chromatic names in standard 12-Tone Equal Temperament (12-TET).
 */
export const NOTE_NAMES = [
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
];

/**
 * Converts frequency in Hertz to the Mel scale.
 * Formula: Mel(f) = 2595 * log10(1 + f / 700)
 *
 * @param {number} freq - Frequency in Hz.
 * @returns {number} Value in Mel.
 */
export function hzToMel(freq) {
  if (typeof freq !== "number" || Number.isNaN(freq) || freq <= 0) return 0;
  return 2595 * Math.log10(1 + freq / 700);
}

/**
 * Converts a value on the Mel scale back to frequency in Hertz.
 * Formula: f = 700 * (10^(m / 2595) - 1)
 *
 * @param {number} mel - Value in Mel.
 * @returns {number} Frequency in Hz.
 */
export function melToHz(mel) {
  if (typeof mel !== "number" || Number.isNaN(mel) || mel <= 0) return 0;
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

/**
 * Formats a frequency in Hertz to a human-readable string.
 *
 * @param {number} freq - Frequency in Hz.
 * @returns {string} Formatted label (e.g. "100 Hz", "1 kHz", "10 kHz").
 */
export function formatFrequency(freq) {
  if (typeof freq !== "number" || Number.isNaN(freq)) return "0 Hz";
  if (freq >= 1000) {
    const khz = freq / 1000;
    return `${Number.isInteger(khz) ? khz : khz.toFixed(1)} kHz`;
  }
  return `${Math.round(freq)} Hz`;
}

/**
 * Converts a frequency (Hz) to a Canvas Y-coordinate (pixels from top).
 * Note: Low frequencies are at the bottom (Y = height), high frequencies at the top (Y = 0).
 *
 * @param {number} freq - Frequency in Hz.
 * @param {number} nyquist - Maximum frequency (Hz), typically sampleRate / 2.
 * @param {number} height - Canvas plot height in pixels.
 * @param {boolean|string} [scale="linear"] - Scale mode: "linear", "logarithmic", "mel", or boolean.
 * @param {number} [minFreq=20] - Lower frequency bound for logarithmic scaling.
 * @returns {number} Y coordinate in pixels.
 */
export function frequencyToY(
  freq,
  nyquist,
  height,
  scale = "linear",
  minFreq = 20
) {
  if (height <= 0) return 0;
  if (!nyquist || nyquist <= 0) return height;

  const isLog =
    scale === true || scale === "logarithmic" || scale === "log";
  const isMel = scale === "mel" || scale === "Mel";

  if (isMel) {
    const clampedFreq = Math.max(0, Math.min(freq, nyquist));
    const melMin = hzToMel(0);
    const melMax = hzToMel(nyquist);
    if (melMax === melMin) return 0;
    const norm = (hzToMel(clampedFreq) - melMin) / (melMax - melMin);
    return height * (1 - norm);
  }

  if (isLog) {
    const clampedFreq = Math.max(minFreq, Math.min(freq, nyquist));
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(nyquist);
    if (logMax === logMin) return 0;
    const norm = (Math.log10(clampedFreq) - logMin) / (logMax - logMin);
    return height * (1 - norm);
  }

  const clampedFreq = Math.max(0, Math.min(freq, nyquist));
  const norm = clampedFreq / nyquist;
  return height * (1 - norm);
}

/**
 * Converts a Canvas Y-coordinate (pixels from top) back to frequency (Hz).
 *
 * @param {number} y - Canvas Y coordinate.
 * @param {number} nyquist - Maximum frequency (Hz).
 * @param {number} height - Canvas plot height in pixels.
 * @param {boolean|string} [scale="linear"] - Scale mode: "linear", "logarithmic", "mel", or boolean.
 * @param {number} [minFreq=20] - Lower frequency bound for logarithmic scaling.
 * @returns {number} Frequency in Hz.
 */
export function yToFrequency(
  y,
  nyquist,
  height,
  scale = "linear",
  minFreq = 20
) {
  if (height <= 0 || !nyquist || nyquist <= 0) return 0;
  const clampedY = Math.max(0, Math.min(y, height));
  const norm = 1 - clampedY / height;

  const isLog =
    scale === true || scale === "logarithmic" || scale === "log";
  const isMel = scale === "mel" || scale === "Mel";

  if (isMel) {
    const melMax = hzToMel(nyquist);
    const melVal = norm * melMax;
    return melToHz(melVal);
  }

  if (isLog) {
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(nyquist);
    const logFreq = logMin + norm * (logMax - logMin);
    return Math.pow(10, logFreq);
  }

  return norm * nyquist;
}

/**
 * Generates calibrated frequency ticks and labels for the Y-axis.
 *
 * @param {number} nyquist - Maximum frequency (Hz).
 * @param {boolean|string} [scale="linear"] - Scale mode: "linear", "logarithmic", "mel", or boolean.
 * @param {number} [minFreq=20] - Minimum frequency for log scale.
 * @returns {Array<{ freq: number, label: string }>} Array of tick objects.
 */
export function getFrequencyTicks(
  nyquist,
  scale = "linear",
  minFreq = 20
) {
  if (!nyquist || nyquist <= 0) return [];

  const isLog =
    scale === true || scale === "logarithmic" || scale === "log";
  const isMel = scale === "mel" || scale === "Mel";

  let candidates;
  if (isMel) {
    candidates = [20000, 10000, 5000, 2500, 1000, 500, 250, 100, 50];
  } else if (isLog) {
    candidates = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];
  } else {
    candidates = [20000, 15000, 10000, 5000, 2000, 1000, 500, 100];
  }

  const ticks = [];
  for (const f of candidates) {
    if (f <= nyquist && (!isLog || f >= minFreq)) {
      ticks.push({
        freq: f,
        label: formatFrequency(f),
      });
    }
  }

  return ticks;
}

/**
 * Converts a raw byte value (0-255) from AnalyserNode.getByteFrequencyData() to decibels (dBFS).
 *
 * @param {number} byteVal - Byte value between 0 and 255.
 * @param {number} [minDecibels=-100] - AnalyserNode.minDecibels.
 * @param {number} [maxDecibels=-30] - AnalyserNode.maxDecibels.
 * @returns {number} Value in dBFS.
 */
export function byteToDecibels(byteVal, minDecibels = -100, maxDecibels = -30) {
  const clamped = Math.max(0, Math.min(byteVal, 255));
  return minDecibels + (clamped / 255) * (maxDecibels - minDecibels);
}

/**
 * Converts a decibel value (dBFS) to an AnalyserNode byte value (0-255).
 *
 * @param {number} dB - Amplitude in dBFS.
 * @param {number} [minDecibels=-100] - AnalyserNode.minDecibels.
 * @param {number} [maxDecibels=-30] - AnalyserNode.maxDecibels.
 * @returns {number} Byte value between 0 and 255.
 */
export function decibelsToByte(dB, minDecibels = -100, maxDecibels = -30) {
  if (maxDecibels === minDecibels) return 0;
  const clamped = Math.max(minDecibels, Math.min(dB, maxDecibels));
  const norm = (clamped - minDecibels) / (maxDecibels - minDecibels);
  return Math.round(norm * 255);
}

/**
 * Generates calibrated decibel ticks and labels for the dBFS colorbar.
 *
 * @param {number} [minDecibels=-100] - Minimum dBFS.
 * @param {number} [maxDecibels=-30] - Maximum dBFS.
 * @param {number} [step=10] - Step size in dB.
 * @returns {Array<{ dB: number, label: string }>} Array of dB tick objects.
 */
export function getDecibelTicks(
  minDecibels = -100,
  maxDecibels = -30,
  step = 10
) {
  const ticks = [];
  const start = Math.floor(maxDecibels / step) * step;
  for (let db = start; db >= minDecibels; db -= step) {
    ticks.push({
      dB: db,
      label: `${db} dB`,
    });
  }
  return ticks;
}

/**
 * Maps an acoustic frequency in Hz to its nearest musical chromatic pitch (12-TET),
 * octave, and deviation in cents (±50 cents).
 * Standard reference: A4 = 440 Hz.
 *
 * @param {number} freq - Acoustic frequency in Hz.
 * @returns {null|{
 *   note: string,
 *   noteName: string,
 *   octave: number,
 *   midi: number,
 *   cents: number,
 *   exactFreq: number,
 *   diffHz: number,
 *   frequency: number,
 *   inTune: boolean
 * }}
 */
export function frequencyToNote(freq) {
  if (typeof freq !== "number" || !Number.isFinite(freq) || freq <= 0) {
    return null;
  }

  // A4 = 440 Hz is MIDI note 69
  const midi = 69 + 12 * Math.log2(freq / 440);
  const nearestMidi = Math.round(midi);
  const cents = Math.round((midi - nearestMidi) * 100 * 10) / 10;
  const noteIndex = ((nearestMidi % 12) + 12) % 12;
  const noteName = NOTE_NAMES[noteIndex];
  const octave = Math.floor(nearestMidi / 12) - 1;
  const exactFreq = 440 * Math.pow(2, (nearestMidi - 69) / 12);
  const diffHz = Math.round((freq - exactFreq) * 100) / 100;
  const inTune = Math.abs(cents) <= 5;

  return {
    note: `${noteName}${octave}`,
    noteName,
    octave,
    midi: nearestMidi,
    cents,
    exactFreq: Math.round(exactFreq * 100) / 100,
    diffHz,
    frequency: Math.round(freq * 10) / 10,
    inTune,
  };
}

/**
 * Detects fundamental frequency (F0) using the autocorrelation / YIN algorithm
 * with sub-sample parabolic interpolation and RMS energy thresholding.
 *
 * @param {Float32Array|Uint8Array|Array<number>} timeDomainData - Audio time-domain samples.
 * @param {number} [sampleRate=44100] - Audio sample rate in Hz.
 * @param {Object} [options={}] - Tuner parameters.
 * @param {number} [options.threshold=0.15] - Absolute threshold for normalized difference.
 * @param {number} [options.minFreq=50] - Lower frequency bound in Hz.
 * @param {number} [options.maxFreq=2000] - Upper frequency bound in Hz.
 * @param {number} [options.rmsThreshold=0.006] - Minimum RMS volume to ignore noise.
 * @returns {null|{
 *   freq: number,
 *   clarity: number,
 *   rms: number,
 *   noteInfo: Object
 * }}
 */
export function detectPitchYIN(
  timeDomainData,
  sampleRate = 44100,
  options = {}
) {
  if (!timeDomainData || timeDomainData.length < 32 || !sampleRate) {
    return null;
  }

  const {
    threshold = 0.15,
    minFreq = 50,
    maxFreq = 2000,
    rmsThreshold = 0.006,
  } = options;

  const len = timeDomainData.length;
  let buffer;
  if (timeDomainData instanceof Float32Array) {
    buffer = timeDomainData;
  } else {
    buffer = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      buffer[i] = (timeDomainData[i] - 128) / 128;
    }
  }

  // 1. RMS Energy check (noise gate)
  let sumSquares = 0;
  for (let i = 0; i < len; i++) {
    sumSquares += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSquares / len);
  if (rms < rmsThreshold) {
    return null;
  }

  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));
  const maxTau = Math.min(Math.floor(len / 2), Math.floor(sampleRate / minFreq));
  if (minTau >= maxTau) return null;

  const halfLen = Math.floor(len / 2);

  // 2. Difference function: d(tau) = sum_{j=0}^{halfLen - 1} (x[j] - x[j + tau])^2
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let diffSum = 0;
    for (let j = 0; j < halfLen; j++) {
      const delta = buffer[j] - buffer[j + tau];
      diffSum += delta * delta;
    }
    d[tau] = diffSum;
  }

  // 3. Cumulative mean normalized difference function: d'(tau)
  const dPrime = new Float32Array(maxTau + 1);
  dPrime[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    runningSum += d[tau];
    dPrime[tau] = runningSum > 0 ? (d[tau] * tau) / runningSum : 1;
  }

  // 4. Absolute threshold: search for first tau >= minTau with dPrime[tau] < threshold
  let chosenTau = -1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (dPrime[tau] < threshold) {
      // Advance to the local minimum
      while (tau + 1 <= maxTau && dPrime[tau + 1] < dPrime[tau]) {
        tau++;
      }
      chosenTau = tau;
      break;
    }
  }

  // Fallback: if no minimum is below threshold, find global minimum in range
  if (chosenTau === -1) {
    let bestTau = minTau;
    let minVal = dPrime[minTau];
    for (let tau = minTau + 1; tau <= maxTau; tau++) {
      if (dPrime[tau] < minVal) {
        minVal = dPrime[tau];
        bestTau = tau;
      }
    }
    if (minVal < 0.38) {
      chosenTau = bestTau;
    } else {
      return null;
    }
  }

  // 5. Parabolic interpolation around chosenTau for sub-sample accuracy
  let refinedTau = chosenTau;
  if (chosenTau > 1 && chosenTau < maxTau) {
    const s0 = dPrime[chosenTau - 1];
    const s1 = dPrime[chosenTau];
    const s2 = dPrime[chosenTau + 1];
    const denom = 2 * (s0 - 2 * s1 + s2);
    if (denom !== 0) {
      const delta = (s0 - s2) / denom;
      if (Math.abs(delta) < 1) {
        refinedTau += delta;
      }
    }
  }

  const f0 = sampleRate / refinedTau;
  if (f0 < minFreq || f0 > maxFreq) {
    return null;
  }

  const clarity = Math.max(0, Math.min(1, 1 - dPrime[chosenTau]));
  const noteInfo = frequencyToNote(f0);

  return {
    freq: Math.round(f0 * 10) / 10,
    clarity: Math.round(clarity * 1000) / 1000,
    rms: Math.round(rms * 10000) / 10000,
    noteInfo,
  };
}
