/**
 * Fourier Series Engine — Pure Math
 *
 * Computes Fourier series coefficients and waveform samples for common
 * periodic waveforms. All functions are pure and have zero DOM dependency.
 *
 * Fourier series: f(t) = a₀/2 + Σ[aₙ·cos(nωt) + bₙ·sin(nωt)]
 */

/* ──── Fourier Coefficients for Common Waveforms ──────────────────── */

/**
 * Compute the Fourier coefficients for harmonic `n` of a given wave type.
 * Returns { a, b } where aₙ and bₙ are the cosine and sine coefficients.
 *
 * @param {string} waveType - 'square' | 'sawtooth' | 'triangle' | 'sine'
 * @param {number} n        - Harmonic index (1-based)
 * @returns {{ a: number, b: number }}
 */
function fourierCoeff(waveType, n) {
  switch (waveType) {
    case 'sine':
      // Pure sine: only the fundamental (n=1), all others zero
      return n === 1 ? { a: 0, b: 1 } : { a: 0, b: 0 };

    case 'square':
      // Square wave: odd harmonics only, bₙ = 4/(nπ)
      if (n % 2 === 0) return { a: 0, b: 0 };
      return { a: 0, b: 4 / (n * Math.PI) };

    case 'sawtooth':
      // Sawtooth wave: all harmonics, bₙ = 2·(-1)^(n+1) / (nπ)
      return { a: 0, b: (2 * Math.pow(-1, n + 1)) / (n * Math.PI) };

    case 'triangle':
      // Triangle wave: odd harmonics only, bₙ = 8·(-1)^((n-1)/2) / (n²π²)
      if (n % 2 === 0) return { a: 0, b: 0 };
      return { a: 0, b: (8 * Math.pow(-1, (n - 1) / 2)) / (n * n * Math.PI * Math.PI) };

    default:
      return { a: 0, b: 0 };
  }
}

/* ──── Waveform Sampling ──────────────────────────────────────────── */

/**
 * Generate an array of time-domain samples for a Fourier-series waveform.
 *
 * @param {string}   waveType      - 'square' | 'sawtooth' | 'triangle' | 'sine'
 * @param {number}   numHarmonics  - Number of harmonics to sum (1-based count)
 * @param {number}   frequency     - Fundamental frequency in Hz
 * @param {number}   sampleRate    - Samples per second
 * @param {number}   duration      - Duration in seconds
 * @param {Function} [activeFilter] - Optional function (n) => bool to skip harmonics
 * @returns {{ time: Float64Array, samples: Float64Array, harmonics: Array<{n: number, samples: Float64Array}> }}
 */
function computeWaveform(waveType, numHarmonics, frequency, sampleRate, duration, activeFilter) {
  const numSamples = Math.ceil(sampleRate * duration);
  const time = new Float64Array(numSamples);
  const samples = new Float64Array(numSamples);
  const omega = 2 * Math.PI * frequency;

  // Pre-compute individual harmonic contributions
  const harmonics = [];
  for (let n = 1; n <= numHarmonics; n++) {
    if (activeFilter && !activeFilter(n)) continue;
    const coeff = fourierCoeff(waveType, n);
    const hSamples = new Float64Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      if (i === 0) time[i] = t;
      else time[i] = t;

      const angle = n * omega * t;
      // DC offset (a₀) is ignored for these wave types (always 0)
      const value = coeff.a * Math.cos(angle) + coeff.b * Math.sin(angle);
      hSamples[i] = value;
      samples[i] += value;
    }

    harmonics.push({ n, samples: hSamples });
  }

  return { time, samples, harmonics };
}

/**
 * Compute the waveform at a specific point in time.
 * Useful for real-time rendering where you want per-sample calculation.
 *
 * @param {string} waveType
 * @param {number} numHarmonics
 * @param {number} frequency
 * @param {number} time - Time in seconds
 * @param {Function} [activeFilter]
 * @returns {number} Amplitude at the given time
 */
function sampleAt(waveType, numHarmonics, frequency, time, activeFilter) {
  const omega = 2 * Math.PI * frequency;
  let value = 0;

  for (let n = 1; n <= numHarmonics; n++) {
    if (activeFilter && !activeFilter(n)) continue;
    const coeff = fourierCoeff(waveType, n);
    const angle = n * omega * time;
    value += coeff.a * Math.cos(angle) + coeff.b * Math.sin(angle);
  }

  return value;
}

/**
 * Generate a progressive build animation sequence.
 * Returns an array of frames, each showing the cumulative sum of harmonics 1..k.
 *
 * @param {string} waveType
 * @param {number} maxHarmonics
 * @param {number} frequency
 * @param {number} sampleRate
 * @param {number} duration
 * @returns {Array<{ step: number, samples: Float64Array }>}
 */
function buildProgressiveFrames(waveType, maxHarmonics, frequency, sampleRate, duration) {
  const frames = [];
  for (let step = 1; step <= maxHarmonics; step++) {
    const result = computeWaveform(waveType, step, frequency, sampleRate, duration);
    frames.push({ step, samples: result.samples, time: result.time });
  }
  return frames;
}

/* ──── Normalisation ──────────────────────────────────────────────── */

/**
 * Normalise an array of samples to the range [-1, 1].
 */
function normalise(samples) {
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxAbs) maxAbs = abs;
  }
  if (maxAbs === 0) return samples;
  const out = new Float64Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i] / maxAbs;
  }
  return out;
}

/* ──── Module Exports ─────────────────────────────────────────────── */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fourierCoeff,
    computeWaveform,
    sampleAt,
    buildProgressiveFrames,
    normalise,
  };
}
