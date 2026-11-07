/**
 * Unit tests for Fourier Series Visualizer — fourierEngine.js
 *
 * Tests are designed to be run with Node.js (no browser required):
 *   node tests/fourier-series-visualizer.test.js
 *
 * Or via the project's test suite:
 *   npm test
 */

const {
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
} = require("../projects/math/fourier-series-visualizer/fourierEngine.js");

/* ──── Test utilities ─────────────────────────────────────────────── */
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

function assertClose(actual, expected, tolerance, msg) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error(
      `  ✗ FAIL: ${msg} — expected ${expected} ± ${tolerance}, got ${actual}`
    );
  }
}

function assertArrayLen(arr, len, msg) {
  assert(arr.length === len, `${msg} (length: ${arr.length}, expected ${len})`);
}

function heading(title) {
  console.log(`\n  ${title}`);
}

/* ──── Tests ──────────────────────────────────────────────────────── */

// ── fourierCoeff ──
heading("fourierCoeff");

// Sine wave
assertClose(fourierCoeff("sine", 1).b, 1, 1e-10, "sine n=1 b=1");
assertClose(fourierCoeff("sine", 1).a, 0, 1e-10, "sine n=1 a=0");
assertClose(fourierCoeff("sine", 2).b, 0, 1e-10, "sine n=2 b=0");
assertClose(fourierCoeff("sine", 3).b, 0, 1e-10, "sine n=3 b=0");

// Square wave — odd harmonics
assertClose(
  fourierCoeff("square", 1).b,
  4 / Math.PI,
  1e-10,
  "square n=1 b=4/π"
);
assertClose(fourierCoeff("square", 2).b, 0, 1e-10, "square n=2 b=0");
assertClose(
  fourierCoeff("square", 3).b,
  4 / (3 * Math.PI),
  1e-10,
  "square n=3 b=4/(3π)"
);
assertClose(fourierCoeff("square", 4).b, 0, 1e-10, "square n=4 b=0");
assertClose(
  fourierCoeff("square", 5).b,
  4 / (5 * Math.PI),
  1e-10,
  "square n=5 b=4/(5π)"
);
assert(fourierCoeff("square", 1).a === 0, "square a=0 always");

// Sawtooth wave — all harmonics
assertClose(
  fourierCoeff("sawtooth", 1).b,
  2 / Math.PI,
  1e-10,
  "sawtooth n=1 b=2/π"
);
assertClose(
  fourierCoeff("sawtooth", 2).b,
  -2 / (2 * Math.PI),
  1e-10,
  "sawtooth n=2 b=-2/(2π)"
);
assertClose(
  fourierCoeff("sawtooth", 3).b,
  2 / (3 * Math.PI),
  1e-10,
  "sawtooth n=3 b=2/(3π)"
);
assertClose(fourierCoeff("sawtooth", 1).a, 0, 1e-10, "sawtooth a=0 always");

// Triangle wave — odd harmonics, alternating sign
assertClose(
  fourierCoeff("triangle", 1).b,
  8 / (Math.PI * Math.PI),
  1e-10,
  "triangle n=1 b=8/π²"
);
assertClose(fourierCoeff("triangle", 2).b, 0, 1e-10, "triangle n=2 b=0");
assertClose(
  fourierCoeff("triangle", 3).b,
  (8 * -1) / (9 * Math.PI * Math.PI),
  1e-10,
  "triangle n=3 b=-8/(9π²)"
);
assertClose(fourierCoeff("triangle", 4).b, 0, 1e-10, "triangle n=4 b=0");
assertClose(fourierCoeff("triangle", 1).a, 0, 1e-10, "triangle a=0 always");

// Unknown wave type
assertClose(
  fourierCoeff("unknown", 1).b,
  0,
  1e-10,
  "unknown wave returns zeros"
);

// ── computeWaveform ──
heading("computeWaveform");

const sampleRate = 10;
const duration = 1;

// Sine, 1 harmonic → should produce a single sine cycle
const sineResult = computeWaveform("sine", 1, 1, sampleRate, duration);
assertArrayLen(
  sineResult.time,
  sampleRate * duration,
  "sine time array length"
);
assertArrayLen(
  sineResult.samples,
  sampleRate * duration,
  "sine sample array length"
);
assertClose(sineResult.samples[0], 0, 1e-10, "sine starts at 0");
assertClose(
  sineResult.samples[Math.floor(sampleRate / 4)],
  1,
  0.1,
  "sine peaks at 1 (quarter cycle)"
);
assertClose(
  sineResult.samples[Math.floor(sampleRate / 2)],
  0,
  0.1,
  "sine crosses 0 at half cycle"
);

// Harmonics array
assert(sineResult.harmonics.length > 0, "sine has at least 1 harmonic entry");
assert(sineResult.harmonics[0].n === 1, "first harmonic is n=1");
assertArrayLen(
  sineResult.harmonics[0].samples,
  sampleRate * duration,
  "harmonic sample length"
);

// Active filter: exclude all → samples should be 0
const filtered = computeWaveform(
  "square",
  5,
  1,
  sampleRate,
  duration,
  () => false
);
let allZero = true;
for (let i = 0; i < filtered.samples.length; i++) {
  if (Math.abs(filtered.samples[i]) > 1e-10) {
    allZero = false;
    break;
  }
}
assert(allZero, "active filter returning false produces zero waveform");

// ── sampleAt ──
heading("sampleAt");

assertClose(sampleAt("sine", 1, 1, 0), 0, 1e-10, "sampleAt sine t=0 = 0");
assertClose(sampleAt("sine", 1, 1, 0.25), 1, 0.1, "sampleAt sine t=0.25 ≈ 1");

// ── buildProgressiveFrames ──
heading("buildProgressiveFrames");

const frames = buildProgressiveFrames("square", 3, 1, sampleRate, duration);
assertArrayLen(frames, 3, "3 progressive frames for 3 harmonics");
assert(frames[0].step === 1, "frame 0 step=1");
assert(frames[1].step === 2, "frame 1 step=2");
assert(frames[2].step === 3, "frame 2 step=3");
assertArrayLen(
  frames[0].samples,
  sampleRate * duration,
  "frame 0 sample length"
);
assertArrayLen(
  frames[2].samples,
  sampleRate * duration,
  "frame 2 sample length"
);

// Progressive build: adding more harmonics should change the waveform
// (Frame 1 has only n=1, frame 3 has n=1+2+3, so they differ)
let differs = false;
for (let i = 0; i < frames[0].samples.length; i++) {
  if (Math.abs(frames[0].samples[i] - frames[2].samples[i]) > 1e-10) {
    differs = true;
    break;
  }
}
assert(differs, "waveform changes as harmonics are added");

// ── normalise ──
heading("normalise");

const constArray = new Float64Array([2, 2, 2]);
const normConst = normalise(constArray);
assertClose(normConst[0], 1, 1e-10, "normalise constant array to 1");
assertClose(normConst[1], 1, 1e-10, "normalise constant[1] to 1");
assert(normConst instanceof Float64Array, "normalise returns Float64Array");

const mixedArray = new Float64Array([-3, 0, 1.5]);
const normMixed = normalise(mixedArray);
assertClose(normMixed[0], -1, 1e-10, "normalise mixed[0] to -1");
assertClose(normMixed[1], 0, 1e-10, "normalise mixed[1] to 0");
assertClose(normMixed[2], 0.5, 1e-10, "normalise mixed[2] to 0.5");

// Empty (all zeros) → should remain zeros
const zeroArray = new Float64Array([0, 0, 0]);
const normZero = normalise(zeroArray);
assert(normZero[0] === 0, "normalise zero array returns zeros");

// ── dft1DComplex ──
heading("dft1DComplex");

// Empty input
assert(dft1DComplex([]).length === 0, "empty points returns empty array");

// Single point
const singleDft = dft1DComplex([{ x: 10, y: 20 }]);
assert(singleDft.length === 1, "single point returns 1 component");
assert(singleDft[0].freq === 0, "single point frequency is 0 (DC)");
assertClose(singleDft[0].re, 10, 1e-10, "single point real component");
assertClose(singleDft[0].im, 20, 1e-10, "single point imaginary component");

// Circle of radius R = 50 decomposed into 32 points
const N_CIRCLE = 32;
const R_CIRCLE = 50;
const circlePoints = [];
for (let i = 0; i < N_CIRCLE; i++) {
  const theta = (2 * Math.PI * i) / N_CIRCLE;
  circlePoints.push({ x: R_CIRCLE * Math.cos(theta), y: R_CIRCLE * Math.sin(theta) });
}
const circleDft = dft1DComplex(circlePoints, true);
assert(circleDft.length === N_CIRCLE, "circle DFT has N components");
// Top component must have frequency 1 with amplitude close to R_CIRCLE
assert(circleDft[0].freq === 1, "top circle harmonic has freq = 1");
assertClose(circleDft[0].amp, R_CIRCLE, 1e-8, "top circle harmonic amplitude is R");
// Second largest component should be essentially zero
assertClose(circleDft[1].amp, 0, 1e-8, "second harmonic on pure circle is near 0");

// Monotonic sorting by amplitude
let sortedDesc = true;
for (let i = 1; i < circleDft.length; i++) {
  if (circleDft[i].amp > circleDft[i - 1].amp + 1e-12) {
    sortedDesc = false;
    break;
  }
}
assert(sortedDesc, "dft1DComplex sorts harmonics descending by amplitude");

// Inverse reconstruction check at sample index n=0
const testShape = [
  { x: 10, y: 15 },
  { x: 25, y: 40 },
  { x: -10, y: 30 },
  { x: -5, y: -10 },
];
const shapeDft = dft1DComplex(testShape, false);
// Sum_k X_k e^(i 0) = Sum_k X_k = z_0
let reconstructedX = 0;
let reconstructedY = 0;
for (const comp of shapeDft) {
  reconstructedX += comp.re;
  reconstructedY += comp.im;
}
assertClose(reconstructedX, testShape[0].x, 1e-8, "DFT inverse reconstruction matches x_0");
assertClose(reconstructedY, testShape[0].y, 1e-8, "DFT inverse reconstruction matches y_0");

// ── sampleEpicycles ──
heading("sampleEpicycles");

const epicycleResult = sampleEpicycles(circleDft, 0, 10, { x: 100, y: 100 });
assert(epicycleResult.circles.length === 10, "samples exactly 10 epicycles");
assertClose(epicycleResult.circles[0].prevX, 100, 1e-10, "first epicycle starts at origin.x");
assertClose(epicycleResult.circles[0].prevY, 100, 1e-10, "first epicycle starts at origin.y");
assertClose(epicycleResult.tip.x, 100 + R_CIRCLE, 1e-8, "epicycle tip at t=0 on circle");
assertClose(epicycleResult.tip.y, 100, 1e-8, "epicycle tip y at t=0 on circle");

// Empty components fallback
const emptyEpicycles = sampleEpicycles([], 0, 5, { x: 50, y: 50 });
assert(emptyEpicycles.circles.length === 0, "empty components returns empty circles");
assert(emptyEpicycles.tip.x === 50 && emptyEpicycles.tip.y === 50, "empty components tip is origin");

// ── resamplePoints ──
heading("resamplePoints");

const squarePolyline = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];
const resampledSquare = resamplePoints(squarePolyline, 16, true);
assert(resampledSquare.length === 16, "resamples to exactly 16 points");
// Segment lengths between successive points should be equal: perimeter = 400, step = 400 / 16 = 25
const stepDist = Math.hypot(
  resampledSquare[1].x - resampledSquare[0].x,
  resampledSquare[1].y - resampledSquare[0].y
);
assertClose(stepDist, 25, 1e-8, "uniform arc length between points is 25");

// Edge case: single point
const singleResample = resamplePoints([{ x: 42, y: 99 }], 5);
assert(singleResample.length === 5, "resampling single point returns length 5");
assert(singleResample[0].x === 42 && singleResample[0].y === 99, "resampled single point coordinates preserved");

// ── centerAndScalePoints ──
heading("centerAndScalePoints");

const offCenterPoints = [
  { x: 200, y: 300 },
  { x: 400, y: 300 },
  { x: 400, y: 500 },
  { x: 200, y: 500 },
];
const scaledZeroCentered = centerAndScalePoints(offCenterPoints, 600, 400, 40, true);
let avgX = 0;
let avgY = 0;
for (const p of scaledZeroCentered) {
  avgX += p.x;
  avgY += p.y;
}
avgX /= scaledZeroCentered.length;
avgY /= scaledZeroCentered.length;
assertClose(avgX, 0, 1e-8, "zeroCenter centers centroid around x=0");
assertClose(avgY, 0, 1e-8, "zeroCenter centers centroid around y=0");

// ── computeDftEnergy ──
heading("computeDftEnergy");

const energyAll = computeDftEnergy(circleDft, circleDft.length);
assertClose(energyAll.ratio, 1.0, 1e-8, "energy ratio is 1.0 when all harmonics are used");
assertClose(energyAll.percentage, 100.0, 1e-8, "energy percentage is 100% when all harmonics are used");

const energyOne = computeDftEnergy(circleDft, 1);
assertClose(energyOne.percentage, 100.0, 1e-4, "first harmonic contains ~100% energy of pure circle");

// ── parseSvgPathToPoints & fallbackParseSvgCoordinates ──
heading("parseSvgPathToPoints & fallbackParseSvgCoordinates");

const sampleSvgPath = "M 10 20 L 50 20 L 50 60 L 10 60 Z";
const parsedFromCoords = fallbackParseSvgCoordinates(sampleSvgPath, 20);
assert(parsedFromCoords.length === 20, "fallbackParseSvgCoordinates extracts 20 points");

const parsedPath = parseSvgPathToPoints(sampleSvgPath, 20);
assert(parsedPath.length === 20, "parseSvgPathToPoints returns 20 points");

// ── generateParametricShape ──
heading("generateParametricShape");

const heartPts = generateParametricShape("heart", 30);
assert(heartPts.length === 30, "generates 30 points for heart preset");

const starPts = generateParametricShape("star", 40);
assert(starPts.length === 40, "generates 40 points for star preset");

const infinityPts = generateParametricShape("infinity", 25);
assert(infinityPts.length === 25, "generates 25 points for infinity preset");

const butterflyPts = generateParametricShape("butterfly", 50);
assert(butterflyPts.length === 50, "generates 50 points for butterfly preset");

const piPts = generateParametricShape("pi", 35);
assert(piPts.length === 35, "generates 35 points for pi preset");

const defaultCirclePts = generateParametricShape("circle", 20);
assert(defaultCirclePts.length === 20, "generates 20 points for circle preset");

/* ──── Summary ────────────────────────────────────────────────────── */
console.log(`\n────────────────────────────────────────`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`────────────────────────────────────────\n`);
process.exit(failed > 0 ? 1 : 0);
