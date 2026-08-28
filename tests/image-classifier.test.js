const test = require("node:test");
const assert = require("node:assert/strict");

const {
  IMAGE_SIZE_LIMITS,
  validateImageSize,
  validateFileSize,
  canPredictCustom,
  formatConfidence,
  formatCustomPredictions,
  validateClassName,
} = require("../projects/aiml/image-classifier/classifierEngine.js");

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

// IMAGE SIZE LIMITS

test("IMAGE_SIZE_LIMITS has sensible defaults", () => {
  assert.ok(IMAGE_SIZE_LIMITS.maxDimension > 0);
  assert.ok(IMAGE_SIZE_LIMITS.maxFileSize > 0);
  assert.equal(IMAGE_SIZE_LIMITS.maxDimension, 1024);
  assert.equal(IMAGE_SIZE_LIMITS.maxFileSize, 10 * 1024 * 1024);
});

// validateImageSize

test("validateImageSize returns no warning for small images", () => {
  const result = validateImageSize(800, 600);
  assert.equal(result.valid, true);
  assert.equal(result.warning, null);
});

test("validateImageSize returns warning for oversized images", () => {
  const result = validateImageSize(4000, 3000);
  assert.equal(result.valid, true);
  assert.ok(result.warning.includes("4000×3000px"));
  assert.ok(result.warning.includes("1024px"));
});

test("validateImageSize returns warning when width exceeds limit", () => {
  const result = validateImageSize(2000, 500);
  assert.equal(result.valid, true);
  assert.ok(result.warning);
});

test("validateImageSize returns warning when height exceeds limit", () => {
  const result = validateImageSize(500, 2000);
  assert.equal(result.valid, true);
  assert.ok(result.warning);
});

test("validateImageSize returns no warning at exact limit", () => {
  const result = validateImageSize(1024, 1024);
  assert.equal(result.valid, true);
  assert.equal(result.warning, null);
});

// validateFileSize

test("validateFileSize accepts files within limit", () => {
  const file = { size: 1024 * 1024 }; // 1 MB
  const result = validateFileSize(file);
  assert.equal(result.valid, true);
  assert.equal(result.error, null);
});

test("validateFileSize rejects files exceeding limit", () => {
  const file = { size: 15 * 1024 * 1024 }; // 15 MB
  const result = validateFileSize(file);
  assert.equal(result.valid, false);
  assert.ok(result.error.includes("15.0MB"));
  assert.ok(result.error.includes("10MB"));
});

test("validateFileSize accepts files at exact limit", () => {
  const file = { size: 10 * 1024 * 1024 }; // exactly 10 MB
  const result = validateFileSize(file);
  assert.equal(result.valid, true);
  assert.equal(result.error, null);
});

test("validateFileSize accepts small files", () => {
  const file = { size: 500 }; // 500 bytes
  const result = validateFileSize(file);
  assert.equal(result.valid, true);
  assert.equal(result.error, null);
});

test("custom class rendering does not interpolate user input into innerHTML", () => {
  const source = require("fs").readFileSync(
    require.resolve("../projects/aiml/image-classifier/script.js"),
    "utf8"
  );

  assert.doesNotMatch(source, /innerHTML\\s*=.*\\$\\{c\\.name\\}/);
  assert.doesNotMatch(source, /innerHTML\\s*=.*\\$\\{prediction\\.className\\}/);
  assert.match(source, /textContent = text/);
});
