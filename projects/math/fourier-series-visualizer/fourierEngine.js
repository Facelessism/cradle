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
    case "sine":
      // Pure sine: only the fundamental (n=1), all others zero
      return n === 1 ? { a: 0, b: 1 } : { a: 0, b: 0 };

    case "square":
      // Square wave: odd harmonics only, bₙ = 4/(nπ)
      if (n % 2 === 0) return { a: 0, b: 0 };
      return { a: 0, b: 4 / (n * Math.PI) };

    case "sawtooth":
      // Sawtooth wave: all harmonics, bₙ = 2·(-1)^(n+1) / (nπ)
      return { a: 0, b: (2 * Math.pow(-1, n + 1)) / (n * Math.PI) };

    case "triangle":
      // Triangle wave: odd harmonics only, bₙ = 8·(-1)^((n-1)/2) / (n²π²)
      if (n % 2 === 0) return { a: 0, b: 0 };
      return {
        a: 0,
        b: (8 * Math.pow(-1, (n - 1) / 2)) / (n * n * Math.PI * Math.PI),
      };

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
function computeWaveform(
  waveType,
  numHarmonics,
  frequency,
  sampleRate,
  duration,
  activeFilter
) {
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
function buildProgressiveFrames(
  waveType,
  maxHarmonics,
  frequency,
  sampleRate,
  duration
) {
  const frames = [];
  for (let step = 1; step <= maxHarmonics; step++) {
    const result = computeWaveform(
      waveType,
      step,
      frequency,
      sampleRate,
      duration
    );
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

/* ──── Complex 1D Discrete Fourier Transform (DFT) Engine ─────────── */

/**
 * 1D Complex Discrete Fourier Transform (DFT).
 * Decomposes an arbitrary closed 2D path represented as a sequence of complex points
 * z_n = x_n + i*y_n into discrete frequency harmonics:
 *   X_k = (1/N) * Σ [z_n * e^(-i * 2π * k * n / N)]
 *
 * @param {Array<{x: number, y: number}>} points - Array of 2D coordinates
 * @param {boolean} [sortByAmplitude=true] - Sort harmonics in descending order of radius
 * @returns {Array<{freq: number, re: number, im: number, amp: number, phase: number}>}
 */
function dft1DComplex(points, sortByAmplitude = true) {
  const N = points ? points.length : 0;
  if (N === 0) return [];

  const X = [];
  const minK = -Math.floor((N - 1) / 2);
  const maxK = Math.floor(N / 2);

  for (let k = minK; k <= maxK; k++) {
    let re = 0;
    let im = 0;

    for (let n = 0; n < N; n++) {
      const phi = (2 * Math.PI * k * n) / N;
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      const x = points[n].x;
      const y = points[n].y;

      // (x + i*y) * (cos(phi) - i*sin(phi))
      re += x * cosPhi + y * sinPhi;
      im += y * cosPhi - x * sinPhi;
    }

    re /= N;
    im /= N;

    const amp = Math.hypot(re, im);
    const phase = Math.atan2(im, re);

    X.push({ freq: k, re, im, amp, phase });
  }

  if (sortByAmplitude) {
    X.sort((a, b) => b.amp - a.amp);
  }

  return X;
}

/**
 * Evaluates the rotating epicycle chain at a specific time angle t in [0, 2*PI].
 * Computes individual circle centers, radii, rotating vector tip coordinates,
 * and the final drawing head position.
 *
 * @param {Array<{freq: number, re: number, im: number, amp: number, phase: number}>} components
 * @param {number} time - Angular time in [0, 2*PI]
 * @param {number} [maxEpicycles] - Maximum number of harmonics to sum (default: all)
 * @param {{x: number, y: number}} [origin={x: 0, y: 0}] - Center anchor of the chain
 * @returns {{ circles: Array<{prevX: number, prevY: number, x: number, y: number, radius: number, angle: number, freq: number, phase: number}>, tip: {x: number, y: number} }}
 */
function sampleEpicycles(components, time, maxEpicycles, origin = { x: 0, y: 0 }) {
  if (!components || components.length === 0) {
    return { circles: [], tip: { x: origin.x, y: origin.y } };
  }

  const limit =
    typeof maxEpicycles === "number" && maxEpicycles > 0
      ? Math.min(maxEpicycles, components.length)
      : components.length;

  let x = origin.x;
  let y = origin.y;
  const circles = [];

  for (let i = 0; i < limit; i++) {
    const prevX = x;
    const prevY = y;
    const { freq, amp, phase } = components[i];
    const angle = freq * time + phase;
    x += amp * Math.cos(angle);
    y += amp * Math.sin(angle);

    circles.push({
      prevX,
      prevY,
      x,
      y,
      radius: amp,
      angle,
      freq,
      phase,
    });
  }

  return { circles, tip: { x, y } };
}

/**
 * Resamples an array of 2D points to produce an array of equidistant points along the path's
 * cumulative arc length. Ensures uniform angular velocity for DFT epicycles.
 *
 * @param {Array<{x: number, y: number}>} points
 * @param {number} targetCount - Number of points to sample
 * @param {boolean} [closed=true] - Whether to close the path between end and start
 * @returns {Array<{x: number, y: number}>}
 */
function resamplePoints(points, targetCount, closed = true) {
  if (!points || points.length === 0) return [];
  const count = Math.max(1, targetCount || 1);
  if (points.length === 1 || count === 1) {
    const p = points[0];
    const res = [];
    for (let i = 0; i < count; i++) res.push({ x: p.x, y: p.y });
    return res;
  }

  const n = points.length;
  const dists = [0];
  let totalDist = 0;

  for (let i = 1; i < n; i++) {
    const d = Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    );
    totalDist += d;
    dists.push(totalDist);
  }

  if (closed) {
    const closeDist = Math.hypot(
      points[0].x - points[n - 1].x,
      points[0].y - points[n - 1].y
    );
    totalDist += closeDist;
  }

  if (totalDist === 0) {
    const p = points[0];
    const res = [];
    for (let i = 0; i < count; i++) res.push({ x: p.x, y: p.y });
    return res;
  }

  const resampled = [];
  const step = totalDist / (closed ? count : count - 1);
  let segIdx = 0;

  for (let i = 0; i < count; i++) {
    const targetDist = i * step;

    while (segIdx < n - 1 && dists[segIdx + 1] < targetDist) {
      segIdx++;
    }

    let p0, p1, segStart, segLen;
    if (segIdx < n - 1) {
      p0 = points[segIdx];
      p1 = points[segIdx + 1];
      segStart = dists[segIdx];
      segLen = dists[segIdx + 1] - dists[segIdx];
    } else {
      p0 = points[n - 1];
      p1 = points[0];
      segStart = dists[n - 1];
      segLen = totalDist - dists[n - 1];
    }

    const t =
      segLen > 0
        ? Math.max(0, Math.min(1, (targetDist - segStart) / segLen))
        : 0;

    resampled.push({
      x: p0.x + t * (p1.x - p0.x),
      y: p0.y + t * (p1.y - p0.y),
    });
  }

  return resampled;
}

/**
 * Centers and scales a set of points to fit nicely within a target width and height.
 *
 * @param {Array<{x: number, y: number}>} points
 * @param {number} targetWidth - Available width
 * @param {number} targetHeight - Available height
 * @param {number} [padding=40] - Margin from bounds
 * @param {boolean} [zeroCenter=false] - If true, centers around (0,0); else at (targetWidth/2, targetHeight/2)
 * @returns {Array<{x: number, y: number}>}
 */
function centerAndScalePoints(
  points,
  targetWidth,
  targetHeight,
  padding = 40,
  zeroCenter = false
) {
  if (!points || points.length === 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;

  for (let i = 0; i < points.length; i++) {
    const { x, y } = points[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    sumX += x;
    sumY += y;
  }

  const cx = sumX / points.length;
  const cy = sumY / points.length;

  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);

  const availW = Math.max(10, targetWidth - padding * 2);
  const availH = Math.max(10, targetHeight - padding * 2);
  const scale = Math.min(availW / w, availH / h);

  const outCenterX = zeroCenter ? 0 : targetWidth / 2;
  const outCenterY = zeroCenter ? 0 : targetHeight / 2;

  return points.map(p => ({
    x: (p.x - cx) * scale + outCenterX,
    y: (p.y - cy) * scale + outCenterY,
  }));
}

/**
 * Calculates the percentage of total spectral energy captured by the first K harmonics.
 *
 * @param {Array<{amp: number}>} components - DFT components sorted by amplitude
 * @param {number} maxEpicycles - Number of components included
 * @returns {{ totalEnergy: number, capturedEnergy: number, ratio: number, percentage: number }}
 */
function computeDftEnergy(components, maxEpicycles) {
  if (!components || components.length === 0) {
    return { totalEnergy: 0, capturedEnergy: 0, ratio: 0, percentage: 0 };
  }
  let total = 0;
  for (let i = 0; i < components.length; i++) {
    total += components[i].amp * components[i].amp;
  }
  if (total === 0) {
    return { totalEnergy: 0, capturedEnergy: 0, ratio: 1, percentage: 100 };
  }
  const limit = Math.min(components.length, Math.max(1, maxEpicycles));
  let captured = 0;
  for (let i = 0; i < limit; i++) {
    captured += components[i].amp * components[i].amp;
  }
  const ratio = Math.min(1, captured / total);
  return {
    totalEnergy: total,
    capturedEnergy: captured,
    ratio,
    percentage: +(ratio * 100).toFixed(1),
  };
}

/**
 * Fallback parser to extract coordinate pairs from raw SVG path strings.
 *
 * @param {string} pathData
 * @param {number} sampleCount
 * @returns {Array<{x: number, y: number}>}
 */
function fallbackParseSvgCoordinates(pathData, sampleCount = 200) {
  const numbers = pathData.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g);
  if (!numbers || numbers.length < 2) return [];

  const rawPoints = [];
  for (let i = 0; i < numbers.length - 1; i += 2) {
    const x = parseFloat(numbers[i]);
    const y = parseFloat(numbers[i + 1]);
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      rawPoints.push({ x, y });
    }
  }

  if (rawPoints.length === 0) return [];
  return resamplePoints(rawPoints, sampleCount, true);
}

/**
 * Parses an SVG path string or samples points along an SVG path.
 * In browser environments, uses path.getPointAtLength for exact vector sampling.
 * In non-browser (Node.js) environments, parses coordinate points or SVG commands.
 *
 * @param {string} pathData - SVG path "d" attribute or polyline points
 * @param {number} [sampleCount=200] - Number of points to sample
 * @returns {Array<{x: number, y: number}>}
 */
function parseSvgPathToPoints(pathData, sampleCount = 200) {
  if (!pathData || typeof pathData !== "string") return [];

  if (
    typeof document !== "undefined" &&
    typeof document.createElementNS === "function"
  ) {
    try {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.setAttribute("d", pathData);
      svg.appendChild(path);
      const totalLen = path.getTotalLength ? path.getTotalLength() : 0;
      if (totalLen > 0) {
        const points = [];
        for (let i = 0; i < sampleCount; i++) {
          const pt = path.getPointAtLength((i * totalLen) / sampleCount);
          points.push({ x: pt.x, y: pt.y });
        }
        return points;
      }
    } catch (_) {
      // Fallback
    }
  }

  return fallbackParseSvgCoordinates(pathData, sampleCount);
}

/**
 * Generates coordinate points for built-in geometric and Fourier presets.
 *
 * @param {string} shapeName - 'heart' | 'star' | 'infinity' | 'butterfly' | 'pi' | 'circle'
 * @param {number} [pointCount=200]
 * @returns {Array<{x: number, y: number}>}
 */
function generateParametricShape(shapeName, pointCount = 200) {
  const points = [];
  const N = Math.max(10, pointCount);

  switch (shapeName) {
    case "heart": {
      for (let i = 0; i < N; i++) {
        const t = (2 * Math.PI * i) / N;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = -(
          13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t)
        );
        points.push({ x, y });
      }
      break;
    }
    case "star": {
      const spikes = 5;
      const outerR = 100;
      const innerR = 40;
      const totalPts = spikes * 2;
      const starVertices = [];
      for (let i = 0; i < totalPts; i++) {
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        starVertices.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
      }
      return resamplePoints(starVertices, N, true);
    }
    case "infinity": {
      for (let i = 0; i < N; i++) {
        const t = (2 * Math.PI * i) / N;
        const denom = 1 + Math.sin(t) * Math.sin(t);
        const a = 120;
        const x = (a * Math.SQRT2 * Math.cos(t)) / denom;
        const y = (a * Math.SQRT2 * Math.sin(t) * Math.cos(t)) / denom;
        points.push({ x, y });
      }
      break;
    }
    case "butterfly": {
      for (let i = 0; i < N; i++) {
        const t = (2 * Math.PI * i) / N;
        const r =
          Math.exp(Math.cos(t)) -
          2 * Math.cos(4 * t) +
          Math.pow(Math.sin(t / 12), 5);
        const x = 30 * Math.sin(t) * r;
        const y = -30 * Math.cos(t) * r;
        points.push({ x, y });
      }
      break;
    }
    case "pi": {
      const piPath =
        "M 20 40 C 40 38 120 38 140 40 C 145 40 150 35 150 30 C 150 25 145 20 135 20 L 25 20 C 15 20 10 25 10 30 C 10 35 15 40 20 40 Z M 50 40 L 45 120 C 45 135 35 145 20 145 C 15 145 10 140 10 135 C 10 130 15 125 25 125 C 30 125 35 120 35 110 L 40 40 Z M 110 40 L 115 110 C 115 125 120 135 130 135 C 140 135 148 128 152 120 C 155 115 160 115 162 118 C 165 122 162 128 155 135 C 145 145 132 148 122 145 C 108 140 102 128 102 112 L 98 40 Z";
      return parseSvgPathToPoints(piPath, N);
    }
    case "circle":
    default: {
      for (let i = 0; i < N; i++) {
        const t = (2 * Math.PI * i) / N;
        points.push({ x: 100 * Math.cos(t), y: 100 * Math.sin(t) });
      }
      break;
    }
  }

  return resamplePoints(points, N, true);
}

/* ──── Module Exports ─────────────────────────────────────────────── */

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    fourierCoeff,
    computeWaveform,
    sampleAt,
    buildProgressiveFrames,
    normalise,
    dft1DComplex,
    sampleEpicycles,
    resamplePoints,
    centerAndScalePoints,
    computeDftEnergy,
    parseSvgPathToPoints,
    fallbackParseSvgCoordinates,
    generateParametricShape,
  };
}
