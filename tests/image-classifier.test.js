const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_IMAGE_DIMENSION,
  calculateClampedDimensions,
  validateAndClampImage,
  resizeImage,
  canPredictCustom,
  formatConfidence,
  formatCustomPredictions,
  validateClassName,
} = require("../projects/aiml/image-classifier/classifierEngine.js");

// calculateClampedDimensions
test("calculateClampedDimensions leaves normal-sized image unchanged", () => {
  const result = calculateClampedDimensions(800, 600, 1024);
  assert.deepEqual(result, {
    width: 800,
    height: 600,
    resized: false,
  });
});

test("calculateClampedDimensions clamps oversized landscape image while preserving aspect ratio", () => {
  // 2048 x 1024 (aspect ratio 2:1) -> 1024 x 512
  const result = calculateClampedDimensions(2048, 1024, 1024);
  assert.equal(result.resized, true);
  assert.equal(result.width, 1024);
  assert.equal(result.height, 512);
  assert.ok(result.width <= MAX_IMAGE_DIMENSION);
  assert.ok(result.height <= MAX_IMAGE_DIMENSION);
  assert.equal(result.width / result.height, 2);
});

test("calculateClampedDimensions clamps oversized portrait image while preserving aspect ratio", () => {
  // 1200 x 3600 (aspect ratio 1:3) -> 341 x 1024
  const result = calculateClampedDimensions(1200, 3600, 1024);
  assert.equal(result.resized, true);
  assert.equal(result.height, 1024);
  assert.equal(result.width, Math.round((1200 * 1024) / 3600));
  assert.ok(result.width <= MAX_IMAGE_DIMENSION);
  assert.ok(result.height <= MAX_IMAGE_DIMENSION);
});

test("calculateClampedDimensions handles square oversized images", () => {
  const result = calculateClampedDimensions(2000, 2000, 1024);
  assert.deepEqual(result, {
    width: 1024,
    height: 1024,
    resized: true,
  });
});

test("calculateClampedDimensions handles invalid or zero input dimensions gracefully", () => {
  assert.deepEqual(calculateClampedDimensions(0, 500), { width: 0, height: 0, resized: false });
  assert.deepEqual(calculateClampedDimensions(-100, 500), { width: 0, height: 0, resized: false });
  assert.deepEqual(calculateClampedDimensions("abc", 500), { width: 0, height: 0, resized: false });
});

// validateAndClampImage
test("validateAndClampImage returns expected structure and warning for oversized images", () => {
  const image = { naturalWidth: 4000, naturalHeight: 3000 };
  const res = validateAndClampImage(image, 1024);

  assert.equal(res.valid, true);
  assert.equal(res.resized, true);
  assert.equal(res.width, 1024);
  assert.equal(res.height, 768);
  assert.equal(res.originalWidth, 4000);
  assert.equal(res.originalHeight, 3000);
  assert.match(res.warning, /exceeded the maximum limit of 1024px/);
  assert.equal(res.error, null);
});

test("validateAndClampImage returns valid and no warning for normal-sized image", () => {
  const image = { width: 500, height: 400 };
  const res = validateAndClampImage(image, 1024);

  assert.equal(res.valid, true);
  assert.equal(res.resized, false);
  assert.equal(res.width, 500);
  assert.equal(res.height, 400);
  assert.equal(res.warning, null);
  assert.equal(res.error, null);
});

test("validateAndClampImage handles null or invalid image input gracefully", () => {
  const nullRes = validateAndClampImage(null);
  assert.equal(nullRes.valid, false);
  assert.equal(nullRes.resized, false);
  assert.match(nullRes.error, /No image input/);

  const zeroRes = validateAndClampImage({ width: 0, height: 0 });
  assert.equal(zeroRes.valid, false);
  assert.equal(zeroRes.resized, false);
  assert.match(zeroRes.error, /Invalid or zero-sized/);
});

// resizeImage
test("resizeImage returns original element when within max dimensions", () => {
  const dummyImg = { width: 600, height: 400 };
  const res = resizeImage(dummyImg);

  assert.equal(res.valid, true);
  assert.equal(res.resized, false);
  assert.equal(res.element, dummyImg);
  assert.equal(res.warning, null);
});

// canPredictCustom
test("canPredictCustom returns true when there are at least two trained classes and a test image", () => {
  const classes = [
    { id: "1", name: "Cat", count: 3 },
    { id: "2", name: "Dog", count: 2 },
  ];

  assert.equal(canPredictCustom(classes, {}), true);
});

test("canPredictCustom returns false when fewer than two classes have images", () => {
  const classes = [
    { id: "1", name: "Cat", count: 3 },
    { id: "2", name: "Dog", count: 0 },
  ];

  assert.equal(canPredictCustom(classes, {}), false);
});

test("canPredictCustom returns false when there is no test image", () => {
  const classes = [
    { id: "1", name: "Cat", count: 3 },
    { id: "2", name: "Dog", count: 2 },
  ];

  assert.equal(canPredictCustom(classes, null), false);
});

// formatConfidence
test("formatConfidence converts probability to percentage with two decimals", () => {
  assert.equal(formatConfidence(0.8765), "87.65");
  assert.equal(formatConfidence(0.5), "50.00");
  assert.equal(formatConfidence(1), "100.00");
  assert.equal(formatConfidence(0), "0.00");
});

// formatCustomPredictions
test("formatCustomPredictions converts class IDs into class names", () => {
  const confidences = {
    "class-1": 0.8,
    "class-2": 0.2,
  };

  const classes = [
    { id: "class-1", name: "Cat", count: 3 },
    { id: "class-2", name: "Dog", count: 3 },
  ];

  assert.deepEqual(formatCustomPredictions(confidences, classes), [
    {
      className: "Cat",
      probability: 0.8,
    },
    {
      className: "Dog",
      probability: 0.2,
    },
  ]);
});

test("formatCustomPredictions sorts predictions by probability", () => {
  const confidences = {
    "class-1": 0.2,
    "class-2": 0.8,
  };

  const classes = [
    { id: "class-1", name: "Cat", count: 3 },
    { id: "class-2", name: "Dog", count: 3 },
  ];

  const result = formatCustomPredictions(confidences, classes);

  assert.equal(result[0].className, "Dog");
  assert.equal(result[0].probability, 0.8);
});

// validateClassName
test("validateClassName accepts a new non-empty class name", () => {
  const classes = [{ id: "1", name: "Cat", count: 2 }];

  assert.deepEqual(validateClassName("Dog", classes), {
    valid: true,
    error: null,
  });
});

test("validateClassName rejects an empty class name", () => {
  assert.deepEqual(validateClassName("   ", []), {
    valid: false,
    error: "Class name cannot be empty.",
  });
});

test("validateClassName rejects duplicate class names", () => {
  const classes = [{ id: "1", name: "Cat", count: 2 }];

  assert.deepEqual(validateClassName("Cat", classes), {
    valid: false,
    error: "Class name already exists.",
  });
});

test("custom class rendering does not interpolate user input into innerHTML", () => {
  const source = require("fs").readFileSync(
    require.resolve("../projects/aiml/image-classifier/script.js"),
    "utf8"
  );

  assert.doesNotMatch(source, /innerHTML\s*=.*\$\{c\.name\}/);
  assert.doesNotMatch(source, /innerHTML\s*=.*\$\{prediction\.className\}/);
  assert.match(source, /textContent = text/);
});
