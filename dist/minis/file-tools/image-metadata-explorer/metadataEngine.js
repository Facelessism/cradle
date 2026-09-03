// --- BASIC IMAGE METADATA ENGINE ---

const TAGS = {
  0x010f: "make",
  0x0110: "model",
  0x0112: "orientation",
  0x0131: "software",
  0x0132: "dateTime",
  0x8769: "exifOffset",
  0x8825: "gpsOffset",
  0x9003: "dateTaken",
  0x920a: "focalLength",
  0x829a: "exposureTime",
  0x829d: "fNumber",
  0x8827: "iso",
  0xa434: "lensModel",
};

const GPS_TAGS = {
  0x0001: "latitudeRef",
  0x0002: "latitude",
  0x0003: "longitudeRef",
  0x0004: "longitude",
  0x0005: "altitudeRef",
  0x0006: "altitude",
};

const TYPE_SIZES = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  7: 1,
  9: 4,
  10: 8,
};

/* --------------------------------
   Utility Functions
-------------------------------- */

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 Bytes";
  }

  if (bytes < 1024) {
    return `${bytes} Bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function gpsToDecimal(coordinates, reference) {
  if (!Array.isArray(coordinates) || coordinates.length < 3) {
    return null;
  }

  const degrees = Number(coordinates[0]);
  const minutes = Number(coordinates[1]);
  const seconds = Number(coordinates[2]);

  if (
    !Number.isFinite(degrees) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return null;
  }

  let decimal =
    degrees +
    minutes / 60 +
    seconds / 3600;

  const direction = String(reference || "").toUpperCase();

  if (direction === "S" || direction === "W") {
    decimal *= -1;
  }

  return Number(decimal.toFixed(6));
}

function metadataToJSON(metadata) {
  return JSON.stringify(metadata, null, 2);
}

function getMetadataGroups(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }

  const groups = [
    {
      title: "Camera",
      items: [],
    },
    {
      title: "Capture",
      items: [],
    },
    {
      title: "Location",
      items: [],
    },
    {
      title: "Other",
      items: [],
    },
  ];

  const cameraKeys = [
    "make",
    "model",
    "lensModel",
  ];

  const captureKeys = [
    "dateTaken",
    "orientation",
    "iso",
    "exposureTime",
    "fNumber",
    "focalLength",
  ];

  const locationKeys = [
    "latitude",
    "longitude",
    "altitude",
  ];

  Object.entries(metadata).forEach(([key, value]) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return;
    }

    let group;

    if (cameraKeys.includes(key)) {
      group = groups[0];
    } else if (captureKeys.includes(key)) {
      group = groups[1];
    } else if (locationKeys.includes(key)) {
      group = groups[2];
    } else {
      group = groups[3];
    }

    group.items.push({
      key,
      value,
    });
  });

  return groups.filter(
    (group) => group.items.length > 0
  );
}

/* --------------------------------
   String Helpers
-------------------------------- */

function isValidString(value) {
  if (typeof value !== "string") {
    return false;
  }

  const cleaned = value
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();

  return cleaned.length > 0;
}

function cleanString(value) {
  if (!isValidString(value)) {
    return null;
  }

  return value
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();
}

function readString(view, offset, length) {
  if (
    offset < 0 ||
    length <= 0 ||
    offset + length > view.byteLength
  ) {
    return null;
  }

  let value = "";

  for (let i = 0; i < length; i++) {
    const char = view.getUint8(offset + i);

    if (char === 0) {
      break;
    }

    if (char >= 32 && char <= 126) {
      value += String.fromCharCode(char);
    }
  }

  return cleanString(value);
}

/* --------------------------------
   TIFF Value Reader
-------------------------------- */

function readValue(
  view,
  type,
  count,
  valueFieldOffset,
  littleEndian,
  tiffStart = 0
) {
  const size = TYPE_SIZES[type];

  if (!size || !Number.isFinite(count) || count <= 0) {
    return null;
  }

  const totalSize = size * count;

  let valueOffset;

  if (totalSize <= 4) {
    valueOffset = valueFieldOffset;
  } else {
    if (
      valueFieldOffset + 4 >
      view.byteLength
    ) {
      return null;
    }

    valueOffset = tiffStart + view.getUint32(
      valueFieldOffset,
      littleEndian
    );
  }

  if (
    valueOffset < 0 ||
    valueOffset + totalSize >
    view.byteLength
  ) {
    return null;
  }

  switch (type) {
    case 2:
      return readString(
        view,
        valueOffset,
        count
      );

    case 3: {
      const values = [];

      for (let i = 0; i < count; i++) {
        values.push(
          view.getUint16(
            valueOffset + i * 2,
            littleEndian
          )
        );
      }

      return count === 1
        ? values[0]
        : values;
    }

    case 4: {
      const values = [];

      for (let i = 0; i < count; i++) {
        values.push(
          view.getUint32(
            valueOffset + i * 4,
            littleEndian
          )
        );
      }

      return count === 1
        ? values[0]
        : values;
    }

    case 5: {
      const values = [];

      for (let i = 0; i < count; i++) {
        const numerator = view.getUint32(
          valueOffset + i * 8,
          littleEndian
        );

        const denominator = view.getUint32(
          valueOffset + i * 8 + 4,
          littleEndian
        );

        values.push(
          denominator === 0
            ? null
            : numerator / denominator
        );
      }

      return count === 1
        ? values[0]
        : values;
    }

    case 1:
    case 7: {
      const values = [];

      for (let i = 0; i < count; i++) {
        values.push(
          view.getUint8(
            valueOffset + i
          )
        );
      }

      return count === 1
        ? values[0]
        : values;
    }

    case 9: {
      const values = [];

      for (let i = 0; i < count; i++) {
        values.push(
          view.getInt32(
            valueOffset + i * 4,
            littleEndian
          )
        );
      }

      return count === 1
        ? values[0]
        : values;
    }

    case 10: {
      const values = [];

      for (let i = 0; i < count; i++) {
        const numerator = view.getInt32(
          valueOffset + i * 8,
          littleEndian
        );

        const denominator = view.getInt32(
          valueOffset + i * 8 + 4,
          littleEndian
        );

        values.push(
          denominator === 0
            ? null
            : numerator / denominator
        );
      }

      return count === 1
        ? values[0]
        : values;
    }

    default:
      return null;
  }
}

/* --------------------------------
   IFD Reader
-------------------------------- */

function readIFD(
  view,
  offset,
  littleEndian,
  tagMap,
  tiffStart = 0
) {
  const metadata = {};

  if (
    offset < 0 ||
    offset + 2 > view.byteLength
  ) {
    return metadata;
  }

  const entryCount = view.getUint16(
    offset,
    littleEndian
  );

  const entriesStart = offset + 2;

  for (let i = 0; i < entryCount; i++) {
    const entryOffset =
      entriesStart + i * 12;

    if (
      entryOffset + 12 >
      view.byteLength
    ) {
      break;
    }

    const tag = view.getUint16(
      entryOffset,
      littleEndian
    );

    const type = view.getUint16(
      entryOffset + 2,
      littleEndian
    );

    const count = view.getUint32(
      entryOffset + 4,
      littleEndian
    );

    const name = tagMap[tag];

    if (!name) {
      continue;
    }

    const value = readValue(
      view,
      type,
      count,
      entryOffset + 8,
      littleEndian,
      tiffStart
    );

    if (value !== null) {
      metadata[name] = value;
    }
  }

  return metadata;
}

/* --------------------------------
   JPEG EXIF Detection
-------------------------------- */

function findExifSegment(view) {
  if (view.byteLength < 4) {
    return -1;
  }

  if (
    view.getUint8(0) !== 0xff ||
    view.getUint8(1) !== 0xd8
  ) {
    return -1;
  }

  let offset = 2;

  while (
    offset + 4 <=
    view.byteLength
  ) {
    if (
      view.getUint8(offset) !== 0xff
    ) {
      offset++;
      continue;
    }

    const marker =
      view.getUint8(offset + 1);

    if (marker === 0xda) {
      break;
    }

    if (
      marker === 0xd8 ||
      marker === 0xd9
    ) {
      offset += 2;
      continue;
    }

    const segmentLength =
      view.getUint16(
        offset + 2,
        false
      );

    if (segmentLength < 2) {
      break;
    }

    if (marker === 0xe1) {
      const exifStart =
        offset + 4;

      if (
        exifStart + 6 <=
        view.byteLength &&
        view.getUint8(exifStart) ===
        0x45 &&
        view.getUint8(exifStart + 1) ===
        0x78 &&
        view.getUint8(exifStart + 2) ===
        0x69 &&
        view.getUint8(exifStart + 3) ===
        0x66 &&
        view.getUint8(exifStart + 4) ===
        0x00 &&
        view.getUint8(exifStart + 5) ===
        0x00
      ) {
        return exifStart + 6;
      }
    }

    offset +=
      2 + segmentLength;
  }

  return -1;
}

/* --------------------------------
   TIFF Parser
-------------------------------- */

function parseTIFF(view, tiffStart) {
  if (
    tiffStart + 8 >
    view.byteLength
  ) {
    return {};
  }

  const byteOrder =
    String.fromCharCode(
      view.getUint8(tiffStart),
      view.getUint8(tiffStart + 1)
    );

  let littleEndian;

  if (byteOrder === "II") {
    littleEndian = true;
  } else if (byteOrder === "MM") {
    littleEndian = false;
  } else {
    return {};
  }

  const magic = view.getUint16(
    tiffStart + 2,
    littleEndian
  );

  if (magic !== 42) {
    return {};
  }

  const firstIFDOffset =
    view.getUint32(
      tiffStart + 4,
      littleEndian
    );

  const ifdOffset =
    tiffStart + firstIFDOffset;

  if (
    ifdOffset < tiffStart ||
    ifdOffset >= view.byteLength
  ) {
    return {};
  }

  const metadata = readIFD(
    view,
    ifdOffset,
    littleEndian,
    TAGS,
    tiffStart
  );

  if (metadata.exifOffset) {
    const exifMetadata =
      readIFD(
        view,
        tiffStart +
        metadata.exifOffset,
        littleEndian,
        TAGS,
        tiffStart
      );

    Object.assign(
      metadata,
      exifMetadata
    );
  }

  if (metadata.gpsOffset) {
    const gpsMetadata =
      readIFD(
        view,
        tiffStart +
        metadata.gpsOffset,
        littleEndian,
        GPS_TAGS,
        tiffStart
      );

    Object.assign(
      metadata,
      gpsMetadata
    );
  }

  return metadata;
}

/* --------------------------------
   Format Detection
-------------------------------- */

function detectFormat(view) {
  if (
    view.byteLength >= 3 &&
    view.getUint8(0) === 0xff &&
    view.getUint8(1) === 0xd8
  ) {
    return "jpeg";
  }

  if (
    view.byteLength >= 8 &&
    view.getUint8(0) === 0x89 &&
    view.getUint8(1) === 0x50 &&
    view.getUint8(2) === 0x4e &&
    view.getUint8(3) === 0x47 &&
    view.getUint8(4) === 0x0d &&
    view.getUint8(5) === 0x0a &&
    view.getUint8(6) === 0x1a &&
    view.getUint8(7) === 0x0a
  ) {
    return "png";
  }

  if (
    view.byteLength >= 12 &&
    view.getUint8(0) === 0x52 &&
    view.getUint8(1) === 0x49 &&
    view.getUint8(2) === 0x46 &&
    view.getUint8(3) === 0x46 &&
    view.getUint8(8) === 0x57 &&
    view.getUint8(9) === 0x45 &&
    view.getUint8(10) === 0x42 &&
    view.getUint8(11) === 0x50
  ) {
    return "webp";
  }

  return "unknown";
}

/* --------------------------------
   PNG Parser
-------------------------------- */

const PNG_TEXT_KEY_MAP = {
  Author: "artist",
  Software: "software",
  "Creation Time": "dateTime",
  Description: "imageDescription",
  Copyright: "copyright",
  Title: "title",
  Comment: "comment",
  Source: "source",
  Disclaimer: "disclaimer",
  Warning: "warning",
};

function mapPNGKeyword(keyword) {
  return PNG_TEXT_KEY_MAP[keyword] || keyword;
}

function readLatin1(view, start, length) {
  let value = "";
  for (let i = 0; i < length; i++) {
    value += String.fromCharCode(view.getUint8(start + i));
  }
  return value;
}

function readPNGtEXt(view, start, length) {
  let nullPos = -1;
  for (let i = 0; i < length; i++) {
    if (view.getUint8(start + i) === 0) {
      nullPos = i;
      break;
    }
  }
  if (nullPos === -1) return null;

  const keyword = readLatin1(view, start, nullPos);
  const text = readLatin1(
    view,
    start + nullPos + 1,
    length - nullPos - 1
  );

  if (!keyword) return null;

  return { key: mapPNGKeyword(keyword), value: cleanString(text) };
}

function readPNGiTXt(view, start, length) {
  let nullPos = -1;
  for (let i = 0; i < length; i++) {
    if (view.getUint8(start + i) === 0) {
      nullPos = i;
      break;
    }
  }
  if (nullPos === -1) return null;

  const keyword = readLatin1(view, start, nullPos);
  let pos = nullPos + 1;

  if (pos + 2 > length) return null;
  const compressionFlag = view.getUint8(start + pos);
  pos += 2;

  let langEnd = -1;
  for (let i = pos; i < length; i++) {
    if (view.getUint8(start + i) === 0) {
      langEnd = i;
      break;
    }
  }
  if (langEnd === -1) return null;
  pos = langEnd + 1;

  let translatedEnd = -1;
  for (let i = pos; i < length; i++) {
    if (view.getUint8(start + i) === 0) {
      translatedEnd = i;
      break;
    }
  }
  if (translatedEnd === -1) return null;
  pos = translatedEnd + 1;

  if (compressionFlag === 1) {
    return null;
  }

  const textBytes = [];
  for (let i = pos; i < length; i++) {
    textBytes.push(view.getUint8(start + i));
  }

  let text;
  try {
    text = new TextDecoder("utf-8").decode(new Uint8Array(textBytes));
  } catch {
    text = readLatin1(view, start + pos, length - pos);
  }

  if (!keyword) return null;

  return { key: mapPNGKeyword(keyword), value: cleanString(text) };
}

function parsePNG(view) {
  const metadata = {};
  let dimensions = null;

  let offset = 8;

  while (offset + 8 <= view.byteLength) {
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );

    const dataStart = offset + 8;

    if (dataStart + length > view.byteLength) {
      break;
    }

    if (type === "IHDR" && length >= 8) {
      dimensions = {
        width: view.getUint32(dataStart, false),
        height: view.getUint32(dataStart + 4, false),
      };
    } else if (type === "tEXt") {
      const entry = readPNGtEXt(view, dataStart, length);
      if (entry && entry.value) metadata[entry.key] = entry.value;
    } else if (type === "iTXt") {
      const entry = readPNGiTXt(view, dataStart, length);
      if (entry && entry.value) metadata[entry.key] = entry.value;
    } else if (type === "eXIf") {
      const exifMetadata = parseTIFF(view, dataStart);
      Object.assign(metadata, exifMetadata);
    } else if (type === "IEND") {
      break;
    }

    offset = dataStart + length + 4;
  }

  return { metadata, dimensions };
}

/* --------------------------------
   WebP Parser
-------------------------------- */

function parseWebP(view) {
  const metadata = {};
  let dimensions = null;

  if (view.byteLength < 12) {
    return { metadata, dimensions };
  }

  let offset = 12;

  while (offset + 8 <= view.byteLength) {
    const fourCC = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );

    const chunkSize = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;

    if (dataStart + chunkSize > view.byteLength) {
      break;
    }

    if (fourCC === "VP8X" && chunkSize >= 10) {
      const width =
        1 +
        (view.getUint8(dataStart + 4) |
          (view.getUint8(dataStart + 5) << 8) |
          (view.getUint8(dataStart + 6) << 16));
      const height =
        1 +
        (view.getUint8(dataStart + 7) |
          (view.getUint8(dataStart + 8) << 8) |
          (view.getUint8(dataStart + 9) << 16));
      dimensions = { width, height };
    } else if (fourCC === "VP8 " && !dimensions && chunkSize >= 10) {
      const w = view.getUint16(dataStart + 6, true) & 0x3fff;
      const h = view.getUint16(dataStart + 8, true) & 0x3fff;
      dimensions = { width: w, height: h };
    } else if (fourCC === "VP8L" && !dimensions && chunkSize >= 5) {
      const b0 = view.getUint8(dataStart + 1);
      const b1 = view.getUint8(dataStart + 2);
      const b2 = view.getUint8(dataStart + 3);
      const b3 = view.getUint8(dataStart + 4);
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height =
        1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      dimensions = { width, height };
    } else if (fourCC === "EXIF") {
      let exifStart = dataStart;
      if (
        chunkSize >= 6 &&
        view.getUint8(dataStart) === 0x45 &&
        view.getUint8(dataStart + 1) === 0x78 &&
        view.getUint8(dataStart + 2) === 0x69 &&
        view.getUint8(dataStart + 3) === 0x66 &&
        view.getUint8(dataStart + 4) === 0x00 &&
        view.getUint8(dataStart + 5) === 0x00
      ) {
        exifStart = dataStart + 6;
      }
      const exifMetadata = parseTIFF(view, exifStart);
      Object.assign(metadata, exifMetadata);
    } else if (fourCC === "XMP ") {
      const xmp = readLatin1(view, dataStart, chunkSize);
      if (xmp && xmp.trim()) {
        metadata.xmp = "Present";
      }
    }

    offset = dataStart + chunkSize + (chunkSize % 2);
  }

  return { metadata, dimensions };
}

function formatExposureTime(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num >= 1 ? `${Number(num.toFixed(3))} s` : `1/${Math.round(1 / num)} s`;
}

function formatFNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `f/${Number(num.toFixed(1))}`;
}

function formatFocalLength(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > 1000) return null;
  return `${Number(num.toFixed(1))} mm`;
}

/* --------------------------------
   Metadata Normalization
-------------------------------- */

function normalizeMetadata(raw) {
  const metadata = {};

  if (
    !raw ||
    typeof raw !== "object"
  ) {
    return metadata;
  }

  const make = cleanString(raw.make);
  const model = cleanString(raw.model);
  const lensModel =
    cleanString(raw.lensModel);
  const software =
    cleanString(raw.software);

  if (make) {
    metadata.make = make;
  }

  if (model) {
    metadata.model = model;
  }

  if (lensModel) {
    metadata.lensModel = lensModel;
  }

  if (software) {
    metadata.software = software;
  }

  if (
    Number.isFinite(
      Number(raw.exposureTime)
    )
  ) {
    const formatted = formatExposureTime(raw.exposureTime);
    if (formatted) metadata.exposureTime = formatted;
  }

  const rawFNumber = raw.fNumber ?? raw.apertureValue;
  if (
    Number.isFinite(
      Number(rawFNumber)
    )
  ) {
    const formatted = formatFNumber(rawFNumber);
    if (formatted) metadata.fNumber = formatted;
  }

  if (
    Number.isFinite(
      Number(raw.iso)
    )
  ) {
    const value =
      Number(raw.iso);

    if (
      value > 0 &&
      value <= 100000
    ) {
      metadata.iso = value;
    }
  }

  if (
    Number.isFinite(
      Number(raw.focalLength)
    )
  ) {
    const formatted = formatFocalLength(raw.focalLength);
    if (formatted) metadata.focalLength = formatted;
  }

  if (
    raw.latitude &&
    raw.latitudeRef
  ) {
    const latitude =
      gpsToDecimal(
        raw.latitude,
        raw.latitudeRef
      );

    if (latitude !== null) {
      metadata.latitude =
        latitude;
    }
  }

  if (
    raw.longitude &&
    raw.longitudeRef
  ) {
    const longitude =
      gpsToDecimal(
        raw.longitude,
        raw.longitudeRef
      );

    if (longitude !== null) {
      metadata.longitude =
        longitude;
    }
  }

  if (
    Number.isFinite(
      Number(raw.altitude)
    )
  ) {
    let altitude =
      Number(raw.altitude);

    if (
      Number(raw.altitudeRef) === 1
    ) {
      altitude *= -1;
    }

    metadata.altitude =
      `${Number(altitude.toFixed(1))} m`;
  }

  const dateTaken =
    cleanString(raw.dateTaken) ||
    cleanString(raw.dateTime);

  if (dateTaken) {
    metadata.dateTaken =
      dateTaken;
  }

  const orientationNames = {
    1: "Normal",
    2: "Mirrored horizontally",
    3: "Rotated 180°",
    4: "Mirrored vertically",
    5: "Mirrored horizontally and rotated 270°",
    6: "Rotated 90° clockwise",
    7: "Mirrored horizontally and rotated 90°",
    8: "Rotated 270° clockwise",
  };

  if (
    raw.orientation !== undefined
  ) {
    const orientation =
      orientationNames[
      raw.orientation
      ];

    if (orientation) {
      metadata.orientation =
        orientation;
    }
  }

  const colorSpaceNames = {
    1: "sRGB",
    65535: "Uncalibrated",
  };

  if (raw.colorSpace !== undefined) {
    const colorSpace = colorSpaceNames[raw.colorSpace];
    if (colorSpace) {
      metadata.colorSpace = colorSpace;
    }
  }

  const passthroughKeys = [
    "artist",
    "title",
    "comment",
    "copyright",
    "source",
    "disclaimer",
    "warning",
    "imageDescription",
    "xmp",
  ];

  passthroughKeys.forEach((key) => {
    const value = cleanString(raw[key]);
    if (value) {
      metadata[key] = value;
    }
  });

  return metadata;
}

/* --------------------------------
   Main Parser
-------------------------------- */

async function parse(file) {
  if (!file) {
    throw new Error(
      "No image file provided."
    );
  }

  if (
    typeof file.arrayBuffer !==
    "function"
  ) {
    throw new Error(
      "Invalid image file."
    );
  }

  const buffer =
    await file.arrayBuffer();

  if (
    !buffer ||
    buffer.byteLength === 0
  ) {
    throw new Error(
      "The image file is empty."
    );
  }

  const view = new DataView(buffer);
  const format = detectFormat(view);

  let rawMetadata = {};
  let dimensions = null;

  if (format === "jpeg") {
    const tiffStart = findExifSegment(view);
    if (tiffStart !== -1) {
      rawMetadata = parseTIFF(view, tiffStart);
    }
  } else if (format === "png") {
    const result = parsePNG(view);
    rawMetadata = result.metadata;
    dimensions = result.dimensions;
  } else if (format === "webp") {
    const result = parseWebP(view);
    rawMetadata = result.metadata;
    dimensions = result.dimensions;
  } else {
    throw new Error(
      "Unsupported image format. Only JPEG, PNG, and WebP are supported."
    );
  }

  const metadata = normalizeMetadata(rawMetadata);

  if (dimensions) {
    metadata.dimensions = `${dimensions.width} × ${dimensions.height}`;
  }

  return metadata;
}

/* --------------------------------
   Browser API
-------------------------------- */

const ImageMetadataEngine = {
  parse,
  formatFileSize,
  gpsToDecimal,
  getMetadataGroups,
  metadataToJSON,
};

if (typeof globalThis !== "undefined") {
  globalThis.ImageMetadataEngine =
    ImageMetadataEngine;
}

/* --------------------------------
   Node.js API
-------------------------------- */

if (
  typeof module !== "undefined" &&
  module.exports
) {
  module.exports = {
    formatFileSize,
    gpsToDecimal,
    dmsToDecimal: gpsToDecimal,
    normalizeMetadata,
    formatExposureTime,
    formatFNumber,
    formatFocalLength,
    getMetadataGroups,
    metadataToJSON,
    parse,
  };
}