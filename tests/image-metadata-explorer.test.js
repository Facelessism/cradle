const assert = require("node:assert");
const test = require("node:test");

const {
  dmsToDecimal,
  normalizeMetadata,
  formatExposureTime,
  formatFNumber,
  formatFocalLength,
  parse,
  readFileBuffer,
  classifyReadError,
  FileReadError,
  detectFormat,
  parseIPTC,
  parseXMP,
  scrubMetadata,
} = require("../projects/file-tools/image-metadata-explorer/metadataEngine");

/* -----------------------------
   GPS Conversion
----------------------------- */

test("dmsToDecimal converts north latitude correctly", () => {
  assert.strictEqual(dmsToDecimal([26, 50, 0], "N"), 26.833333);
});

test("dmsToDecimal converts south latitude to negative", () => {
  assert.strictEqual(dmsToDecimal([26, 50, 0], "S"), -26.833333);
});

test("dmsToDecimal converts west longitude to negative", () => {
  assert.strictEqual(dmsToDecimal([80, 56, 0], "W"), -80.933333);
});

test("dmsToDecimal returns null for invalid coordinates", () => {
  assert.strictEqual(dmsToDecimal([26, 50], "N"), null);
});

/* -----------------------------
   Exposure Formatting
----------------------------- */

test("formatExposureTime formats shutter speed correctly", () => {
  assert.strictEqual(formatExposureTime(0.01), "1/100 s");

  assert.strictEqual(formatExposureTime(2), "2 s");
});

test("formatExposureTime rejects invalid values", () => {
  assert.strictEqual(formatExposureTime(0), null);

  assert.strictEqual(formatExposureTime(-1), null);
});

test("formatFNumber formats aperture correctly", () => {
  assert.strictEqual(formatFNumber(2.8), "f/2.8");

  assert.strictEqual(formatFNumber(5.6), "f/5.6");
});

test("formatFocalLength formats focal length correctly", () => {
  assert.strictEqual(formatFocalLength(50), "50 mm");

  assert.strictEqual(formatFocalLength(24.5), "24.5 mm");
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

  assert.strictEqual(metadata.altitude, "120.5 m");
});

test("normalizeMetadata handles negative altitude", () => {
  const metadata = normalizeMetadata({
    altitude: 15,
    altitudeRef: 1,
  });

  assert.strictEqual(metadata.altitude, "-15 m");
});

/* -----------------------------
   Date & Other Metadata
----------------------------- */

test("normalizeMetadata extracts capture date", () => {
  const metadata = normalizeMetadata({
    dateTaken: "2026:08:09 10:30:00",
  });

  assert.strictEqual(metadata.dateTaken, "2026:08:09 10:30:00");
});

test("normalizeMetadata falls back to DateTime", () => {
  const metadata = normalizeMetadata({
    dateTime: "2026:08:09 10:30:00",
  });

  assert.strictEqual(metadata.dateTaken, "2026:08:09 10:30:00");
});

test("normalizeMetadata converts orientation", () => {
  const metadata = normalizeMetadata({
    orientation: 1,
  });

  assert.strictEqual(metadata.orientation, "Normal");
});

test("normalizeMetadata converts color space", () => {
  const metadata = normalizeMetadata({
    colorSpace: 1,
  });

  assert.strictEqual(metadata.colorSpace, "sRGB");
});

/* -----------------------------
   Invalid / Empty Metadata
----------------------------- */

test("normalizeMetadata returns empty object for invalid input", () => {
  assert.deepStrictEqual(normalizeMetadata(null), {});

  assert.deepStrictEqual(normalizeMetadata(undefined), {});
});

test("normalizeMetadata ignores invalid exposure values", () => {
  const metadata = normalizeMetadata({
    exposureTime: 0,
    apertureValue: -2,
    focalLength: 0,
    iso: -100,
  });

  assert.strictEqual(metadata.exposureTime, undefined);

  assert.strictEqual(metadata.fNumber, undefined);

  assert.strictEqual(metadata.focalLength, undefined);

  assert.strictEqual(metadata.iso, undefined);
});

/* -----------------------------
   Core Image Parsing tests (Issue #613)
----------------------------- */

function createMockFile(buffer, name, type) {
  return {
    arrayBuffer: async () =>
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ),
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
      item.tag & 0xff,
      (item.tag >> 8) & 0xff,
      item.type & 0xff,
      (item.type >> 8) & 0xff,
      count & 0xff,
      (count >> 8) & 0xff,
      (count >> 16) & 0xff,
      (count >> 24) & 0xff,
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
  return [
    ...tiffHeader,
    ...entryCountBytes,
    ...entries,
    ...nextIfdOffset,
    ...values,
  ];
}

function createFakeJpeg(tags) {
  const tiffData = createFakeTiffData(tags);
  const app1Length = 2 + 6 + tiffData.length;
  const app1Header = [
    0xff,
    0xe1,
    (app1Length >> 8) & 0xff,
    app1Length & 0xff,
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00,
  ];
  const jpeg = [0xff, 0xd8, ...app1Header, ...tiffData, 0xff, 0xd9];
  return Buffer.from(jpeg);
}

function createFakePng(tags) {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdrData = [
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
    0x00,
  ];
  const ihdrChunk = [
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52,
    ...ihdrData,
    0x00,
    0x00,
    0x00,
    0x00,
  ];
  const tiffData = createFakeTiffData(tags);
  const exifChunk = [
    (tiffData.length >> 24) & 0xff,
    (tiffData.length >> 16) & 0xff,
    (tiffData.length >> 8) & 0xff,
    tiffData.length & 0xff,
    0x65,
    0x58,
    0x49,
    0x66,
    ...tiffData,
    0x00,
    0x00,
    0x00,
    0x00,
  ];
  const iendChunk = [
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ];
  return Buffer.from([
    ...pngSignature,
    ...ihdrChunk,
    ...exifChunk,
    ...iendChunk,
  ]);
}

function createFakePngWithText(keyword, text) {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdrChunk = [
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00,
  ];
  const keywordBuf = Buffer.from(keyword);
  const textBuf = Buffer.from(text);
  const tEXtData = [...Array.from(keywordBuf), 0x00, ...Array.from(textBuf)];
  const textChunk = [
    (tEXtData.length >> 24) & 0xff,
    (tEXtData.length >> 16) & 0xff,
    (tEXtData.length >> 8) & 0xff,
    tEXtData.length & 0xff,
    0x74,
    0x45,
    0x58,
    0x74,
    ...tEXtData,
    0x00,
    0x00,
    0x00,
    0x00,
  ];
  const iendChunk = [
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ];
  return Buffer.from([
    ...pngSignature,
    ...ihdrChunk,
    ...textChunk,
    ...iendChunk,
  ]);
}

function createFakeWebP(tags) {
  const riffHeader = [
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ];
  const vp8xData = [0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  const vp8xChunk = [
    0x56,
    0x50,
    0x38,
    0x58,
    0x0a,
    0x00,
    0x00,
    0x00,
    ...vp8xData,
  ];
  const tiffData = createFakeTiffData(tags);
  const exifPrefix = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  const exifChunkData = [...exifPrefix, ...tiffData];
  const exifChunkSize = exifChunkData.length;
  const exifChunk = [
    0x45,
    0x58,
    0x49,
    0x46,
    exifChunkSize & 0xff,
    (exifChunkSize >> 8) & 0xff,
    (exifChunkSize >> 16) & 0xff,
    (exifChunkSize >> 24) & 0xff,
    ...exifChunkData,
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
    { tag: 0x0110, type: 2, value: "Alpha 7 III" },
  ]);
  const mockFile = createMockFile(jpegBuffer, "test.jpg", "image/jpeg");
  const metadata = await parse(mockFile);

  assert.strictEqual(metadata.make, "Sony");
  assert.strictEqual(metadata.model, "Alpha 7 III");
});

test("parse extracts metadata from valid PNG with EXIF chunk", async () => {
  const pngBuffer = createFakePng([
    { tag: 0x010f, type: 2, value: "Fujifilm" },
    { tag: 0x0110, type: 2, value: "X-T4" },
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
    { tag: 0x0110, type: 2, value: "Z6" },
  ]);
  const mockFile = createMockFile(webpBuffer, "test.webp", "image/webp");
  const metadata = await parse(mockFile);

  assert.strictEqual(metadata.make, "Nikon");
  assert.strictEqual(metadata.model, "Z6");
  assert.strictEqual(metadata.dimensions, "1 × 1");
});

test("parse rejects unsupported formats with an explicit error", async () => {
  const gifBuffer = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  ]);
  const mockFile = createMockFile(gifBuffer, "test.gif", "image/gif");

  await assert.rejects(parse(mockFile), /Unsupported image format/);
});

test("parse handles empty files gracefully", async () => {
  const emptyBuffer = Buffer.alloc(0);
  const mockFile = createMockFile(emptyBuffer, "empty.jpg", "image/jpeg");

  await assert.rejects(parse(mockFile), /The image file is empty/);
});

test("parse handles null/undefined input gracefully", async () => {
  await assert.rejects(parse(null), /No image file provided/);
});

/* -----------------------------
   File-Read Error Handling (Issue: Improve file-read error handling)
----------------------------- */

test("FileReadError instantiates with code, name, and cause", () => {
  const cause = new Error("Underlying reason");
  const err = new FileReadError("Permission denied", "PERMISSION_DENIED", cause);

  assert.strictEqual(err.name, "FileReadError");
  assert.strictEqual(err.message, "Permission denied");
  assert.strictEqual(err.code, "PERMISSION_DENIED");
  assert.strictEqual(err.cause, cause);
});

test("classifyReadError maps NotReadableError to PERMISSION_DENIED", () => {
  const err = new Error("File is locked by OS");
  err.name = "NotReadableError";
  const classified = classifyReadError(err);

  assert.strictEqual(classified instanceof FileReadError, true);
  assert.strictEqual(classified.code, "PERMISSION_DENIED");
  assert.match(classified.message, /Permission denied/);
});

test("classifyReadError maps SecurityError to SECURITY_ERROR", () => {
  const err = new Error("Cross-origin or security restriction");
  err.name = "SecurityError";
  const classified = classifyReadError(err);

  assert.strictEqual(classified.code, "SECURITY_ERROR");
  assert.match(classified.message, /Security error/);
});

test("classifyReadError maps AbortError to READ_ABORTED", () => {
  const err = new Error("Read aborted by caller");
  err.name = "AbortError";
  const classified = classifyReadError(err);

  assert.strictEqual(classified.code, "READ_ABORTED");
  assert.match(classified.message, /aborted/);
});

test("classifyReadError maps NotFoundError to FILE_NOT_FOUND", () => {
  const err = new Error("File moved");
  err.name = "NotFoundError";
  const classified = classifyReadError(err);

  assert.strictEqual(classified.code, "FILE_NOT_FOUND");
  assert.match(classified.message, /File not found/);
});

test("readFileBuffer resolves ArrayBuffer directly", async () => {
  const buf = new Uint8Array([1, 2, 3]).buffer;
  const result = await readFileBuffer(buf);
  assert.strictEqual(result, buf);
});

test("readFileBuffer resolves typed arrays as sliced ArrayBuffer", async () => {
  const arr = new Uint8Array([1, 2, 3, 4]);
  const result = await readFileBuffer(arr);
  assert.strictEqual(result.byteLength, 4);
});

test("readFileBuffer rejects empty buffer with EMPTY_FILE", async () => {
  const buf = new ArrayBuffer(0);
  await assert.rejects(
    readFileBuffer(buf),
    err => err instanceof FileReadError && err.code === "EMPTY_FILE"
  );
});

test("readFileBuffer rejects null input with INVALID_INPUT", async () => {
  await assert.rejects(
    readFileBuffer(null),
    err => err instanceof FileReadError && err.code === "INVALID_INPUT"
  );
});

test("readFileBuffer catches permission failure (NotReadableError) from file", async () => {
  const failingFile = {
    arrayBuffer: async () => {
      const err = new Error("The requested file could not be read.");
      err.name = "NotReadableError";
      throw err;
    },
  };

  await assert.rejects(
    readFileBuffer(failingFile),
    err => err instanceof FileReadError && err.code === "PERMISSION_DENIED"
  );
});

test("readFileBuffer catches security restrictions (SecurityError)", async () => {
  const securityFile = {
    arrayBuffer: async () => {
      const err = new Error("Access was denied.");
      err.name = "SecurityError";
      throw err;
    },
  };

  await assert.rejects(
    readFileBuffer(securityFile),
    err => err instanceof FileReadError && err.code === "SECURITY_ERROR"
  );
});

test("readFileBuffer catches unreadable / corrupted file stream errors", async () => {
  const corruptedStreamFile = {
    arrayBuffer: async () => {
      throw new Error("I/O failure while streaming bytes");
    },
  };

  await assert.rejects(
    readFileBuffer(corruptedStreamFile),
    err => err instanceof FileReadError && err.code === "UNREADABLE_FILE"
  );
});

test("parse propagates permission error as FileReadError with PERMISSION_DENIED", async () => {
  const lockedFile = {
    arrayBuffer: async () => {
      const err = new Error("File locked by another process");
      err.name = "NotReadableError";
      throw err;
    },
  };

  await assert.rejects(
    parse(lockedFile),
    err => err instanceof FileReadError && err.code === "PERMISSION_DENIED"
  );
});

test("detectFormat detects various formats correctly", () => {
  const jpegHeader = new DataView(new Uint8Array([0xff, 0xd8, 0xff]).buffer);
  assert.strictEqual(detectFormat(jpegHeader), "jpeg");

  const pngHeader = new DataView(
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer
  );
  assert.strictEqual(detectFormat(pngHeader), "png");

  const gifHeader = new DataView(
    new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]).buffer
  );
  assert.strictEqual(detectFormat(gifHeader), "gif");

  const bmpHeader = new DataView(new Uint8Array([0x42, 0x4d, 0x00, 0x00]).buffer);
  assert.strictEqual(detectFormat(bmpHeader), "bmp");

  const tiffHeader = new DataView(
    new Uint8Array([0x49, 0x49, 0x2a, 0x00]).buffer
  );
  assert.strictEqual(detectFormat(tiffHeader), "tiff");

  const unknownHeader = new DataView(
    new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer
  );
  assert.strictEqual(detectFormat(unknownHeader), "unknown");
});

test("parse rejects BMP format with descriptive UNSUPPORTED_FORMAT error", async () => {
  const bmpBuffer = Buffer.from([0x42, 0x4d, 0x00, 0x00, 0x00, 0x00]);
  const mockFile = createMockFile(bmpBuffer, "test.bmp", "image/bmp");

  await assert.rejects(
    parse(mockFile),
    err =>
      err instanceof FileReadError &&
      err.code === "UNSUPPORTED_FORMAT" &&
      err.message.includes("BMP")
  );
});

test("parse rejects TIFF format with descriptive UNSUPPORTED_FORMAT error", async () => {
  const tiffBuffer = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
  const mockFile = createMockFile(tiffBuffer, "test.tiff", "image/tiff");

  await assert.rejects(
    parse(mockFile),
    err =>
      err instanceof FileReadError &&
      err.code === "UNSUPPORTED_FORMAT" &&
      err.message.includes("TIFF")
  );
});

/* -----------------------------
   Deep EXIF, IPTC, XMP & Scrubber Tests
----------------------------- */

test("normalizeMetadata handles advanced hardware and optics telemetry", () => {
  const metadata = normalizeMetadata({
    bodySerialNumber: "BODY-987654321",
    lensMake: "Sony",
    lensModel: "FE 24-70mm F2.8 GM II",
    lensSerialNumber: "LENS-12345678",
    focalLengthIn35mm: 24,
    exposureProgram: 3, // Aperture priority
    exposureBias: -0.7,
    meteringMode: 5, // Pattern
    whiteBalance: 0, // Auto
  });

  assert.strictEqual(metadata.bodySerialNumber, "BODY-987654321");
  assert.strictEqual(metadata.lensMake, "Sony");
  assert.strictEqual(metadata.lensModel, "FE 24-70mm F2.8 GM II");
  assert.strictEqual(metadata.lensSerialNumber, "LENS-12345678");
  assert.strictEqual(metadata.focalLengthIn35mm, "24 mm (35mm eq)");
  assert.strictEqual(metadata.exposureProgram, "Aperture priority");
  assert.strictEqual(metadata.exposureBias, "-0.7 EV");
  assert.strictEqual(metadata.meteringMode, "Pattern");
  assert.strictEqual(metadata.whiteBalance, "Auto");
});

test("parseXMP extracts Dublin Core and Photoshop metadata", () => {
  const sampleXmp = `
    <x:xmpmeta xmlns:x="adobe:ns:meta/">
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
        <rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"
                         xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
                         xmlns:xmp="http://ns.adobe.com/xap/1.0/"
                         xmlns:aux="http://ns.adobe.com/exif/1.0/aux/">
          <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Alpine Sunrise</rdf:li></rdf:Alt></dc:title>
          <dc:creator><rdf:Seq><rdf:li>Jane Doe</rdf:li></rdf:Seq></dc:creator>
          <dc:description><rdf:Alt><rdf:li xml:lang="x-default">First light hitting the summit.</rdf:li></rdf:Alt></dc:description>
          <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">© 2026 Jane Doe</rdf:li></rdf:Alt></dc:rights>
          <dc:subject><rdf:Bag><rdf:li>mountain</rdf:li><rdf:li>sunrise</rdf:li><rdf:li>landscape</rdf:li></rdf:Bag></dc:subject>
          <photoshop:Headline>Spectacular Peak</photoshop:Headline>
          <photoshop:Credit>Alpine Press</photoshop:Credit>
          <photoshop:City>Zermatt</photoshop:City>
          <photoshop:Country>Switzerland</photoshop:Country>
          <xmp:CreateDate>2026-08-01T06:15:30</xmp:CreateDate>
          <xmp:CreatorTool>Adobe Lightroom Classic</xmp:CreatorTool>
          <aux:LensModel>24-70mm F2.8</aux:LensModel>
          <aux:LensSerialNumber>LENS-999</aux:LensSerialNumber>
          <aux:SerialNumber>CAM-777</aux:SerialNumber>
        </rdf:Description>
      </rdf:RDF>
    </x:xmpmeta>
  `;

  const parsed = parseXMP(sampleXmp);
  assert.strictEqual(parsed.title, "Alpine Sunrise");
  assert.strictEqual(parsed.creator, "Jane Doe");
  assert.strictEqual(parsed.caption, "First light hitting the summit.");
  assert.strictEqual(parsed.copyright, "© 2026 Jane Doe");
  assert.strictEqual(parsed.keywords, "mountain, sunrise, landscape");
  assert.strictEqual(parsed.headline, "Spectacular Peak");
  assert.strictEqual(parsed.credit, "Alpine Press");
  assert.strictEqual(parsed.city, "Zermatt");
  assert.strictEqual(parsed.country, "Switzerland");
  assert.strictEqual(parsed.xmpCreateDate, "2026-08-01T06:15:30");
  assert.strictEqual(parsed.creatorTool, "Adobe Lightroom Classic");
  assert.strictEqual(parsed.lensModel, "24-70mm F2.8");
  assert.strictEqual(parsed.lensSerialNumber, "LENS-999");
  assert.strictEqual(parsed.bodySerialNumber, "CAM-777");
});

test("parseIPTC decodes Photoshop 8BIM IPTC record 2 datasets", () => {
  // Construct a minimal 8BIM IPTC block
  // 8BIM header: 0x38 0x42 0x49 0x4d, ID 0x0404, empty name (0x00 0x00), 4 bytes size
  const iptcData = [];
  function addIptcTag(record, dataset, str) {
    const bytes = Buffer.from(str, "utf8");
    iptcData.push(0x1c, record, dataset, (bytes.length >> 8) & 0xff, bytes.length & 0xff);
    for (const b of bytes) iptcData.push(b);
  }

  addIptcTag(2, 5, "Photo Headline");
  addIptcTag(2, 80, "John Photographer");
  addIptcTag(2, 90, "San Francisco");
  addIptcTag(2, 101, "USA");
  addIptcTag(2, 25, "urban");
  addIptcTag(2, 25, "golden-gate");

  const dataLen = iptcData.length;
  const bimBlock = [
    0x38, 0x42, 0x49, 0x4d, // '8BIM'
    0x04, 0x04,             // IPTC-NAA ID
    0x00, 0x00,             // empty Pascal name + padding
    (dataLen >> 24) & 0xff,
    (dataLen >> 16) & 0xff,
    (dataLen >> 8) & 0xff,
    dataLen & 0xff,
    ...iptcData,
  ];
  if (dataLen % 2 !== 0) bimBlock.push(0x00); // Pad to even

  const view = new DataView(new Uint8Array(bimBlock).buffer);
  const parsed = parseIPTC(view, 0, bimBlock.length);

  assert.strictEqual(parsed.title, "Photo Headline");
  assert.strictEqual(parsed.creator, "John Photographer");
  assert.strictEqual(parsed.city, "San Francisco");
  assert.strictEqual(parsed.country, "USA");
  assert.strictEqual(parsed.keywords, "urban, golden-gate");
});

test("scrubMetadata strips all EXIF and metadata markers from JPEG", async () => {
  const jpegWithExif = createFakeJpeg([
    { tag: 0x010f, type: 2, value: "Nikon" },
    { tag: 0x0110, type: 2, value: "D850" },
  ]);

  // Verify EXIF is present initially
  const initialMeta = await parse(createMockFile(jpegWithExif, "test.jpg", "image/jpeg"));
  assert.strictEqual(initialMeta.make, "Nikon");
  assert.strictEqual(initialMeta.model, "D850");

  // Scrub the binary buffer
  const scrubbedBuffer = scrubMetadata(jpegWithExif);
  assert.ok(scrubbedBuffer.byteLength < jpegWithExif.length, "Scrubbed JPEG should be smaller");

  // Re-parse scrubbed buffer: EXIF should be completely gone
  const scrubbedMeta = await parse(createMockFile(Buffer.from(scrubbedBuffer), "clean.jpg", "image/jpeg"));
  assert.strictEqual(scrubbedMeta.make, undefined);
  assert.strictEqual(scrubbedMeta.model, undefined);
});

test("scrubMetadata strips eXIf and tEXt chunks from PNG", async () => {
  const pngWithExif = createFakePng([
    { tag: 0x010f, type: 2, value: "Canon" },
  ]);

  const initialMeta = await parse(createMockFile(pngWithExif, "test.png", "image/png"));
  assert.strictEqual(initialMeta.make, "Canon");

  const scrubbedBuffer = scrubMetadata(pngWithExif);
  const scrubbedMeta = await parse(createMockFile(Buffer.from(scrubbedBuffer), "clean.png", "image/png"));
  assert.strictEqual(scrubbedMeta.make, undefined);
});

test("scrubMetadata strips EXIF chunks and clears VP8X flags from WebP", async () => {
  const webpWithExif = createFakeWebP([
    { tag: 0x010f, type: 2, value: "Sony" },
  ]);

  const initialMeta = await parse(createMockFile(webpWithExif, "test.webp", "image/webp"));
  assert.strictEqual(initialMeta.make, "Sony");

  const scrubbedBuffer = scrubMetadata(webpWithExif);
  const scrubbedMeta = await parse(createMockFile(Buffer.from(scrubbedBuffer), "clean.webp", "image/webp"));
  assert.strictEqual(scrubbedMeta.make, undefined);
});
