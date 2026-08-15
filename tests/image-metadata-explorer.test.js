const assert = require("node:assert");
const test = require("node:test");

const {
  dmsToDecimal,
  normalizeMetadata,
  formatExposureTime,
  formatFNumber,
  formatFocalLength,
} = require("../projects/file-tools/image-metadata-explorer/metadataEngine");


/* -----------------------------
   GPS Conversion
----------------------------- */

test("dmsToDecimal converts north latitude correctly", () => {
  assert.strictEqual(
    dmsToDecimal([26, 50, 0], "N"),
    26.833333
  );
});

test("dmsToDecimal converts south latitude to negative", () => {
  assert.strictEqual(
    dmsToDecimal([26, 50, 0], "S"),
    -26.833333
  );
});

test("dmsToDecimal converts west longitude to negative", () => {
  assert.strictEqual(
    dmsToDecimal([80, 56, 0], "W"),
    -80.933333
  );
});

test("dmsToDecimal returns null for invalid coordinates", () => {
  assert.strictEqual(
    dmsToDecimal([26, 50], "N"),
    null
  );
});


/* -----------------------------
   Exposure Formatting
----------------------------- */

test("formatExposureTime formats shutter speed correctly", () => {
  assert.strictEqual(
    formatExposureTime(0.01),
    "1/100 s"
  );

  assert.strictEqual(
    formatExposureTime(2),
    "2 s"
  );
});

test("formatExposureTime rejects invalid values", () => {
  assert.strictEqual(
    formatExposureTime(0),
    null
  );

  assert.strictEqual(
    formatExposureTime(-1),
    null
  );
});


test("formatFNumber formats aperture correctly", () => {
  assert.strictEqual(
    formatFNumber(2.8),
    "f/2.8"
  );

  assert.strictEqual(
    formatFNumber(5.6),
    "f/5.6"
  );
});


test("formatFocalLength formats focal length correctly", () => {
  assert.strictEqual(
    formatFocalLength(50),
    "50 mm"
  );

  assert.strictEqual(
    formatFocalLength(24.5),
    "24.5 mm"
  );
});


/* -----------------------------
   Metadata Normalization
----------------------------- */

test("normalizeMetadata extracts basic camera metadata", () => {
  const metadata = normalizeMetadata({
    make: "Canon",
    model: "EOS R5",
    lensModel: "RF 24-70mm",
    software: "Camera Firmware",
  });

  assert.strictEqual(metadata.make, "Canon");
  assert.strictEqual(metadata.model, "EOS R5");
  assert.strictEqual(metadata.lensModel, "RF 24-70mm");
  assert.strictEqual(metadata.software, "Camera Firmware");
});


test("normalizeMetadata formats basic exposure metadata", () => {
  const metadata = normalizeMetadata({
    exposureTime: 0.01,
    apertureValue: 2.8,
    iso: 200,
    focalLength: 50,
  });

  assert.strictEqual(metadata.exposureTime, "1/100 s");
  assert.strictEqual(metadata.fNumber, "f/2.8");
  assert.strictEqual(metadata.iso, 200);
  assert.strictEqual(metadata.focalLength, "50 mm");
});


/* -----------------------------
   Location Metadata
----------------------------- */

test("normalizeMetadata converts GPS coordinates", () => {
  const metadata = normalizeMetadata({
    latitude: [26, 50, 0],
    latitudeRef: "N",
    longitude: [80, 56, 0],
    longitudeRef: "E",
  });

  assert.strictEqual(metadata.latitude, 26.833333);
  assert.strictEqual(metadata.longitude, 80.933333);
});


test("normalizeMetadata handles altitude", () => {
  const metadata = normalizeMetadata({
    altitude: 120.5,
    altitudeRef: 0,
  });

  assert.strictEqual(
    metadata.altitude,
    "120.5 m"
  );
});


test("normalizeMetadata handles negative altitude", () => {
  const metadata = normalizeMetadata({
    altitude: 15,
    altitudeRef: 1,
  });

  assert.strictEqual(
    metadata.altitude,
    "-15 m"
  );
});


/* -----------------------------
   Date & Other Metadata
----------------------------- */

test("normalizeMetadata extracts capture date", () => {
  const metadata = normalizeMetadata({
    dateTaken: "2026:08:09 10:30:00",
  });

  assert.strictEqual(
    metadata.dateTaken,
    "2026:08:09 10:30:00"
  );
});


test("normalizeMetadata falls back to DateTime", () => {
  const metadata = normalizeMetadata({
    dateTime: "2026:08:09 10:30:00",
  });

  assert.strictEqual(
    metadata.dateTaken,
    "2026:08:09 10:30:00"
  );
});


test("normalizeMetadata converts orientation", () => {
  const metadata = normalizeMetadata({
    orientation: 1,
  });

  assert.strictEqual(
    metadata.orientation,
    "Normal"
  );
});


test("normalizeMetadata converts color space", () => {
  const metadata = normalizeMetadata({
    colorSpace: 1,
  });

  assert.strictEqual(
    metadata.colorSpace,
    "sRGB"
  );
});


/* -----------------------------
   Invalid / Empty Metadata
----------------------------- */

test("normalizeMetadata returns empty object for invalid input", () => {
  assert.deepStrictEqual(
    normalizeMetadata(null),
    {}
  );

  assert.deepStrictEqual(
    normalizeMetadata(undefined),
    {}
  );
});


test("normalizeMetadata ignores invalid exposure values", () => {
  const metadata = normalizeMetadata({
    exposureTime: 0,
    apertureValue: -2,
    focalLength: 0,
    iso: -100,
  });

  assert.strictEqual(
    metadata.exposureTime,
    undefined
  );

  assert.strictEqual(
    metadata.fNumber,
    undefined
  );

  assert.strictEqual(
    metadata.focalLength,
    undefined
  );

  assert.strictEqual(
    metadata.iso,
    undefined
  );
});