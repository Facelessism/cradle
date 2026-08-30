const assert = require("node:assert");
const test = require("node:test");

const {
  dmsToDecimal,
  normalizeMetadata,
  formatExposureTime,
  formatFNumber,
  formatFocalLength,
  parse,
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


/* -----------------------------
   Core Image Parsing tests (Issue #613)
----------------------------- */

function createMockFile(buffer, name, type) {
  return {
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    name,
    size: buffer.length,
    type,
  };
}

function createFakeTiffData(tags) {
  const tiffHeader = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00];
  const entryCount = tags.length;
  const entryCountBytes = [entryCount & 0xff, (entryCount >> 8) & 0xff];
  
  let entryOffset = 8 + 2 + entryCount * 12 + 4;
  const entries = [];
  const values = [];
  
  for (const item of tags) {
    const valueBuffer = Buffer.from(item.value + "\0");
    const count = valueBuffer.length;
    
    const entryBytes = [
      item.tag & 0xff, (item.tag >> 8) & 0xff,
      item.type & 0xff, (item.type >> 8) & 0xff,
      count & 0xff, (count >> 8) & 0xff, (count >> 16) & 0xff, (count >> 24) & 0xff,
    ];
    
    if (count <= 4) {
      const valBytes = Array.from(valueBuffer);
      while (valBytes.length < 4) valBytes.push(0x00);
      entryBytes.push(...valBytes);
    } else {
      entryBytes.push(
        entryOffset & 0xff,
        (entryOffset >> 8) & 0xff,
        (entryOffset >> 16) & 0xff,
        (entryOffset >> 24) & 0xff
      );
      values.push(...Array.from(valueBuffer));
      entryOffset += count;
    }
    entries.push(...entryBytes);
  }
  
  const nextIfdOffset = [0x00, 0x00, 0x00, 0x00];
  return [...tiffHeader, ...entryCountBytes, ...entries, ...nextIfdOffset, ...values];
}

function createFakeJpeg(tags) {
  const tiffData = createFakeTiffData(tags);
  const app1Length = 2 + 6 + tiffData.length;
  const app1Header = [
    0xff, 0xe1,
    (app1Length >> 8) & 0xff, app1Length & 0xff,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00
  ];
  const jpeg = [
    0xff, 0xd8,
    ...app1Header,
    ...tiffData,
    0xff, 0xd9
  ];
  return Buffer.from(jpeg);
}

function createFakePng(tags) {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdrData = [
    0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00
  ];
  const ihdrChunk = [
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    ...ihdrData,
    0x00, 0x00, 0x00, 0x00
  ];
  const tiffData = createFakeTiffData(tags);
  const exifChunk = [
    (tiffData.length >> 24) & 0xff,
    (tiffData.length >> 16) & 0xff,
    (tiffData.length >> 8) & 0xff,
    tiffData.length & 0xff,
    0x65, 0x58, 0x49, 0x66,
    ...tiffData,
    0x00, 0x00, 0x00, 0x00
  ];
  const iendChunk = [
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4e, 0x44,
    0xae, 0x42, 0x60, 0x82
  ];
  return Buffer.from([...pngSignature, ...ihdrChunk, ...exifChunk, ...iendChunk]);
}

function createFakePngWithText(keyword, text) {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdrChunk = [
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00
  ];
  const keywordBuf = Buffer.from(keyword);
  const textBuf = Buffer.from(text);
  const tEXtData = [...Array.from(keywordBuf), 0x00, ...Array.from(textBuf)];
  const textChunk = [
    (tEXtData.length >> 24) & 0xff,
    (tEXtData.length >> 16) & 0xff,
    (tEXtData.length >> 8) & 0xff,
    tEXtData.length & 0xff,
    0x74, 0x45, 0x58, 0x74,
    ...tEXtData,
    0x00, 0x00, 0x00, 0x00
  ];
  const iendChunk = [
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4e, 0x44,
    0xae, 0x42, 0x60, 0x82
  ];
  return Buffer.from([...pngSignature, ...ihdrChunk, ...textChunk, ...iendChunk]);
}

function createFakeWebP(tags) {
  const riffHeader = [
    0x52, 0x49, 0x46, 0x46,
    0x00, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50
  ];
  const vp8xData = [
    0x08, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00,
    0x00, 0x00, 0x00
  ];
  const vp8xChunk = [
    0x56, 0x50, 0x38, 0x58,
    0x0a, 0x00, 0x00, 0x00,
    ...vp8xData
  ];
  const tiffData = createFakeTiffData(tags);
  const exifPrefix = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  const exifChunkData = [...exifPrefix, ...tiffData];
  const exifChunkSize = exifChunkData.length;
  const exifChunk = [
    0x45, 0x58, 0x49, 0x46,
    exifChunkSize & 0xff,
    (exifChunkSize >> 8) & 0xff,
    (exifChunkSize >> 16) & 0xff,
    (exifChunkSize >> 24) & 0xff,
    ...exifChunkData
  ];
  const totalBytes = [...riffHeader, ...vp8xChunk, ...exifChunk];
  const fileSize = totalBytes.length - 8;
  totalBytes[4] = fileSize & 0xff;
  totalBytes[5] = (fileSize >> 8) & 0xff;
  totalBytes[6] = (fileSize >> 16) & 0xff;
  totalBytes[7] = (fileSize >> 24) & 0xff;
  return Buffer.from(totalBytes);
}

test("parse extracts camera model and make from valid JPEG", async () => {
  const jpegBuffer = createFakeJpeg([
    { tag: 0x010f, type: 2, value: "Sony" },
    { tag: 0x0110, type: 2, value: "Alpha 7 III" }
  ]);
  const mockFile = createMockFile(jpegBuffer, "test.jpg", "image/jpeg");
  const metadata = await parse(mockFile);
  
  assert.strictEqual(metadata.make, "Sony");
  assert.strictEqual(metadata.model, "Alpha 7 III");
});

test("parse extracts metadata from valid PNG with EXIF chunk", async () => {
  const pngBuffer = createFakePng([
    { tag: 0x010f, type: 2, value: "Fujifilm" },
    { tag: 0x0110, type: 2, value: "X-T4" }
  ]);
  const mockFile = createMockFile(pngBuffer, "test.png", "image/png");
  const metadata = await parse(mockFile);
  
  assert.strictEqual(metadata.make, "Fujifilm");
  assert.strictEqual(metadata.model, "X-T4");
  assert.strictEqual(metadata.dimensions, "1 × 1");
});

test("parse extracts metadata from valid PNG with text chunk", async () => {
  const pngBuffer = createFakePngWithText("Software", "Adobe Photoshop");
  const mockFile = createMockFile(pngBuffer, "test.png", "image/png");
  const metadata = await parse(mockFile);
  
  assert.strictEqual(metadata.software, "Adobe Photoshop");
});

test("parse extracts metadata from valid WebP with EXIF chunk", async () => {
  const webpBuffer = createFakeWebP([
    { tag: 0x010f, type: 2, value: "Nikon" },
    { tag: 0x0110, type: 2, value: "Z6" }
  ]);
  const mockFile = createMockFile(webpBuffer, "test.webp", "image/webp");
  const metadata = await parse(mockFile);
  
  assert.strictEqual(metadata.make, "Nikon");
  assert.strictEqual(metadata.model, "Z6");
  assert.strictEqual(metadata.dimensions, "1 × 1");
});

test("parse rejects unsupported formats with an explicit error", async () => {
  const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);
  const mockFile = createMockFile(gifBuffer, "test.gif", "image/gif");
  
  await assert.rejects(
    parse(mockFile),
    /Unsupported image format/
  );
});

test("parse handles empty files gracefully", async () => {
  const emptyBuffer = Buffer.alloc(0);
  const mockFile = createMockFile(emptyBuffer, "empty.jpg", "image/jpeg");
  
  await assert.rejects(
    parse(mockFile),
    /The image file is empty/
  );
});

test("parse handles null/undefined input gracefully", async () => {
  await assert.rejects(
    parse(null),
    /No image file provided/
  );
});