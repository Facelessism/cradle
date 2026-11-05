/**
 * Spectrogram Scale & Calibration Utilities
 * Provides mathematical conversions for Linear/Logarithmic frequency axes,
 * decibel (dBFS) amplitude mappings, and tick generators.
 */

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
 * @param {boolean} [isLogarithmic=false] - Whether to use logarithmic frequency scaling.
 * @param {number} [minFreq=20] - Lower frequency bound for logarithmic scaling.
 * @returns {number} Y coordinate in pixels.
 */
export function frequencyToY(
  freq,
  nyquist,
  height,
  isLogarithmic = false,
  minFreq = 20
) {
  if (height <= 0) return 0;
  if (!nyquist || nyquist <= 0) return height;

  if (isLogarithmic) {
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
 * @param {boolean} [isLogarithmic=false] - Whether to use logarithmic frequency scaling.
 * @param {number} [minFreq=20] - Lower frequency bound for logarithmic scaling.
 * @returns {number} Frequency in Hz.
 */
export function yToFrequency(
  y,
  nyquist,
  height,
  isLogarithmic = false,
  minFreq = 20
) {
  if (height <= 0 || !nyquist || nyquist <= 0) return 0;
  const clampedY = Math.max(0, Math.min(y, height));
  const norm = 1 - clampedY / height;

  if (isLogarithmic) {
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
 * @param {boolean} [isLogarithmic=false] - Whether scale is logarithmic.
 * @param {number} [minFreq=20] - Minimum frequency for log scale.
 * @returns {Array<{ freq: number, label: string }>} Array of tick objects.
 */
export function getFrequencyTicks(
  nyquist,
  isLogarithmic = false,
  minFreq = 20
) {
  if (!nyquist || nyquist <= 0) return [];

  const candidates = isLogarithmic
    ? [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50]
    : [20000, 15000, 10000, 5000, 2000, 1000, 500, 100];

  const ticks = [];
  for (const f of candidates) {
    if (f <= nyquist && (!isLogarithmic || f >= minFreq)) {
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
