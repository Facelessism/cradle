const test = require("node:test");
const assert = require("node:assert/strict");
const ClampCalculator = require("../projects/dev-tools/css-clamp-calculator/clampCalculator.js");

test("generateClamp creates a valid rem clamp formula", () => {
  const result = ClampCalculator.generateClamp({
    property: "font-size",
    unit: "rem",
    minViewport: 320,
    maxViewport: 1280,
    minValue: 1,
    maxValue: 2.25,
  });

  assert.equal(result.clamp, "clamp(1rem, calc(0.5833rem + 2.0833vw), 2.25rem)");
  assert.equal(result.cssRule, "font-size: clamp(1rem, calc(0.5833rem + 2.0833vw), 2.25rem);");
});

test("calculatePreferredValue returns slope and intercept", () => {
  const result = ClampCalculator.calculatePreferredValue({
    minViewport: 400,
    maxViewport: 1000,
    minValue: 16,
    maxValue: 28,
    unit: "px",
  });

  assert.equal(result.slope, 2);
  assert.equal(result.intercept, 8);
});

test("generateClamp handles negative intercepts", () => {
  const result = ClampCalculator.generateClamp({
    property: "width",
    unit: "px",
    minViewport: 320,
    maxViewport: 640,
    minValue: 100,
    maxValue: 500,
  });

  assert.match(result.clamp, /calc\(125vw - 300px\)/);
});

test("pxToRem and remToPx convert using base font size", () => {
  assert.equal(ClampCalculator.pxToRem(24), 1.5);
  assert.equal(ClampCalculator.remToPx(1.5), 24);
  assert.equal(ClampCalculator.pxToRem(20, 10), 2);
});

test("convertValue converts between px and rem", () => {
  assert.equal(ClampCalculator.convertValue(32, "px", "rem"), 2);
  assert.equal(ClampCalculator.convertValue(2, "rem", "px"), 32);
  assert.equal(ClampCalculator.convertValue(2, "rem", "rem"), 2);
});

test("validateInput rejects invalid viewport ranges", () => {
  assert.throws(() => {
    ClampCalculator.generateClamp({
      minViewport: 900,
      maxViewport: 600,
      minValue: 1,
      maxValue: 2,
      unit: "rem",
    });
  }, /Maximum viewport/);
});

test("validateInput rejects max value smaller than min value", () => {
  assert.throws(() => {
    ClampCalculator.generateClamp({
      minViewport: 320,
      maxViewport: 960,
      minValue: 3,
      maxValue: 2,
      unit: "rem",
    });
  }, /Maximum value/);
});

test("validateInput rejects unsupported units", () => {
  assert.throws(() => {
    ClampCalculator.generateClamp({
      minViewport: 320,
      maxViewport: 960,
      minValue: 1,
      maxValue: 2,
      unit: "%",
    });
  }, /Unit/);
});

test("formatNumber removes unnecessary trailing zeros", () => {
  assert.equal(ClampCalculator.formatNumber(1.5000), "1.5");
  assert.equal(ClampCalculator.formatNumber(2), "2");
});
