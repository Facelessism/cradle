// --- IMAGE METADATA ENGINE (EXIF, IPTC, XMP, GPS & PRIVACY SCRUBBER) ---

const TAGS = {
  // IFD0 / Baseline
  0x010e: "imageDescription",
  0x010f: "make",
  0x0110: "model",
  0x0112: "orientation",
  0x0131: "software",
  0x0132: "dateTime",
  0x013b: "artist",
  0x8298: "copyright",
  0x8769: "exifOffset",
  0x8825: "gpsOffset",

  // Exif SubIFD
  0x829a: "exposureTime",
  0x829d: "fNumber",
  0x8822: "exposureProgram",
  0x8827: "iso",
  0x9003: "dateTaken",
  0x9004: "dateDigitized",
  0x9201: "shutterSpeed",
  0x9202: "apertureValue",
  0x9204: "exposureBias",
  0x9207: "meteringMode",
  0x9209: "flash",
  0x920a: "focalLength",
  0x9286: "userComment",
  0xa001: "colorSpace",
  0xa403: "whiteBalance",
  0xa404: "digitalZoomRatio",
  0xa405: "focalLengthIn35mm",
  0xa406: "sceneCaptureType",
  0xa431: "bodySerialNumber",
  0xa432: "lensSpecification",
  0xa433: "lensMake",
  0xa434: "lensModel",
  0xa435: "lensSerialNumber",
};

const GPS_TAGS = {
  0x0000: "gpsVersion",
  0x0001: "latitudeRef",
  0x0002: "latitude",
  0x0003: "longitudeRef",
  0x0004: "longitude",
  0x0005: "altitudeRef",
  0x0006: "altitude",
  0x0007: "gpsTimeStamp",
  0x0012: "gpsMapDatum",
  0x001d: "gpsDateStamp",
};

const TYPE_SIZES = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  7: 1, // UNDEFINED
  9: 4, // SLONG
  10: 8, // SRATIONAL
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

  let decimal = degrees + minutes / 60 + seconds / 3600;

  const direction = String(reference || "").toUpperCase();

  if (direction === "S" || direction === "W") {
    decimal *= -1;
  }

  return Number(decimal.toFixed(6));
}

function metadataToJSON(metadata) {
  return JSON.stringify(metadata, null, 2);
}

function isValidString(value) {
  if (typeof value !== "string") {
    return false;
  }

  const cleaned = value.replace(/[\x00-\x1f\x7f]/g, "").trim();
  return cleaned.length > 0;
}

function cleanString(value) {
  if (!isValidString(value)) {
    return null;
  }

  return value.replace(/[\x00-\x1f\x7f]/g, "").trim();
}

function readString(view, offset, length) {
  if (offset < 0 || length <= 0 || offset + length > view.byteLength) {
    return null;
  }

  let value = "";

  for (let i = 0; i < length; i++) {
    const char = view.getUint8(offset + i);
    if (char === 0) break;
    if (char >= 32 && char <= 126) {
      value += String.fromCharCode(char);
    }
  }

  return cleanString(value);
}

function readLatin1(view, start, length) {
  let value = "";
  const end = Math.min(start + length, view.byteLength);
  for (let i = start; i < end; i++) {
    value += String.fromCharCode(view.getUint8(i));
  }
  return value;
}

function readUtf8(view, start, length) {
  const end = Math.min(start + length, view.byteLength);
  const bytes = new Uint8Array(view.buffer, view.byteOffset + start, end - start);
  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return readLatin1(view, start, length);
  }
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
    if (valueFieldOffset + 4 > view.byteLength) {
      return null;
    }
    valueOffset = tiffStart + view.getUint32(valueFieldOffset, littleEndian);
  }

  if (valueOffset < 0 || valueOffset + totalSize > view.byteLength) {
    return null;
  }

  switch (type) {
    case 2:
      return readString(view, valueOffset, count);

    case 3: {
      const values = [];
      for (let i = 0; i < count; i++) {
        values.push(view.getUint16(valueOffset + i * 2, littleEndian));
      }
      return count === 1 ? values[0] : values;
    }

    case 4: {
      const values = [];
      for (let i = 0; i < count; i++) {
        values.push(view.getUint32(valueOffset + i * 4, littleEndian));
      }
      return count === 1 ? values[0] : values;
    }

    case 5: {
      const values = [];
      for (let i = 0; i < count; i++) {
        const numerator = view.getUint32(valueOffset + i * 8, littleEndian);
        const denominator = view.getUint32(
          valueOffset + i * 8 + 4,
          littleEndian
        );
        values.push(denominator === 0 ? null : numerator / denominator);
      }
      return count === 1 ? values[0] : values;
    }

    case 1:
    case 7: {
      const values = [];
      for (let i = 0; i < count; i++) {
        values.push(view.getUint8(valueOffset + i));
      }
      return count === 1 ? values[0] : values;
    }

    case 9: {
      const values = [];
      for (let i = 0; i < count; i++) {
        values.push(view.getInt32(valueOffset + i * 4, littleEndian));
      }
      return count === 1 ? values[0] : values;
    }

    case 10: {
      const values = [];
      for (let i = 0; i < count; i++) {
        const numerator = view.getInt32(valueOffset + i * 8, littleEndian);
        const denominator = view.getInt32(
          valueOffset + i * 8 + 4,
          littleEndian
        );
        values.push(denominator === 0 ? null : numerator / denominator);
      }
      return count === 1 ? values[0] : values;
    }

    default:
      return null;
  }
}

/* --------------------------------
   IFD Reader
-------------------------------- */

function readIFD(view, offset, littleEndian, tagMap, tiffStart = 0) {
  const metadata = {};

  if (offset < 0 || offset + 2 > view.byteLength) {
    return metadata;
  }

  const entryCount = view.getUint16(offset, littleEndian);
  const entriesStart = offset + 2;

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = entriesStart + i * 12;

    if (entryOffset + 12 > view.byteLength) {
      break;
    }

    const tag = view.getUint16(entryOffset, littleEndian);
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);

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

    if (value !== null && value !== undefined) {
      metadata[name] = value;
    }
  }

  return metadata;
}

/* --------------------------------
   TIFF Parser
-------------------------------- */

function parseTIFF(view, tiffStart) {
  if (tiffStart + 8 > view.byteLength) {
    return {};
  }

  const byteOrder = String.fromCharCode(
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

  const magic = view.getUint16(tiffStart + 2, littleEndian);
  if (magic !== 42) {
    return {};
  }

  const firstIFDOffset = view.getUint32(tiffStart + 4, littleEndian);
  const ifdOffset = tiffStart + firstIFDOffset;

  if (ifdOffset < tiffStart || ifdOffset >= view.byteLength) {
    return {};
  }

  const metadata = readIFD(view, ifdOffset, littleEndian, TAGS, tiffStart);

  if (metadata.exifOffset) {
    const exifMetadata = readIFD(
      view,
      tiffStart + metadata.exifOffset,
      littleEndian,
      TAGS,
      tiffStart
    );
    Object.assign(metadata, exifMetadata);
  }

  if (metadata.gpsOffset) {
    const gpsMetadata = readIFD(
      view,
      tiffStart + metadata.gpsOffset,
      littleEndian,
      GPS_TAGS,
      tiffStart
    );
    Object.assign(metadata, gpsMetadata);
  }

  return metadata;
}

/* --------------------------------
   IPTC-NAA Parser (APP13 / 8BIM 0x0404)
-------------------------------- */

const IPTC_TAGS = {
  0x0205: "title", // Object Name
  0x0219: "keywords", // Keywords
  0x0237: "dateCreated", // Date Created
  0x0250: "creator", // By-line
  0x0255: "bylineTitle", // By-line Title
  0x025a: "city", // City
  0x025f: "provinceOrState", // Province/State
  0x0265: "country", // Country/Primary Location
  0x0269: "headline", // Headline
  0x026e: "credit", // Credit
  0x0273: "source", // Source
  0x0274: "copyright", // Copyright Notice
  0x0278: "caption", // Caption/Abstract
};

function parseIPTC(view, startOffset, length) {
  const metadata = {};
  if (!view || startOffset < 0 || startOffset + length > view.byteLength) {
    return metadata;
  }

  let offset = startOffset;
  const endOffset = startOffset + length;

  // Scan for 8BIM blocks inside APP13
  while (offset + 12 <= endOffset) {
    // Check for '8BIM' signature
    if (
      view.getUint8(offset) === 0x38 &&
      view.getUint8(offset + 1) === 0x42 &&
      view.getUint8(offset + 2) === 0x49 &&
      view.getUint8(offset + 3) === 0x4d
    ) {
      const resourceId = view.getUint16(offset + 4, false);
      let pos = offset + 6;

      // Pascal string for resource name
      const nameLen = view.getUint8(pos);
      pos += 1 + nameLen;
      if (pos % 2 !== 0) {
        pos += 1; // 8BIM pads to even bytes
      }

      if (pos + 4 > endOffset) break;
      const dataSize = view.getUint32(pos, false);
      pos += 4;

      if (resourceId === 0x0404 && pos + dataSize <= endOffset) {
        // IPTC-NAA record
        let iptcPos = pos;
        const iptcEnd = pos + dataSize;
        const keywords = [];

        while (iptcPos + 5 <= iptcEnd) {
          const tagMarker = view.getUint8(iptcPos);
          if (tagMarker !== 0x1c) {
            iptcPos++;
            continue;
          }

          const recordNum = view.getUint8(iptcPos + 1);
          const datasetNum = view.getUint8(iptcPos + 2);
          const tagSize = view.getUint16(iptcPos + 3, false);
          const tagDataStart = iptcPos + 5;

          if (tagDataStart + tagSize > iptcEnd) break;

          const fullTag = (recordNum << 8) | datasetNum;
          const tagName = IPTC_TAGS[fullTag];

          if (tagName) {
            const rawVal = readUtf8(view, tagDataStart, tagSize).trim();
            if (rawVal) {
              if (tagName === "keywords") {
                keywords.push(rawVal);
              } else if (!metadata[tagName]) {
                metadata[tagName] = rawVal;
              }
            }
          }

          iptcPos = tagDataStart + tagSize;
        }

        if (keywords.length > 0) {
          metadata.keywords = keywords.join(", ");
        }
      }

      // Move to next 8BIM block, padded to even length
      offset = pos + dataSize + (dataSize % 2);
    } else {
      offset++;
    }
  }

  return metadata;
}

/* --------------------------------
   XMP Parser (Extensible Metadata Platform)
-------------------------------- */

function parseXMP(xmpString) {
  const metadata = {};
  if (!xmpString || typeof xmpString !== "string") {
    return metadata;
  }

  function getFirstMatch(regex) {
    const match = regex.exec(xmpString);
    return match && match[1] ? cleanString(match[1]) : null;
  }

  function getAllListMatches(containerTag) {
    const containerRegex = new RegExp(
      `<${containerTag}[^>]*>([\\s\\S]*?)<\\/${containerTag}>`,
      "i"
    );
    const containerMatch = containerRegex.exec(xmpString);
    if (!containerMatch) return [];

    const itemRegex = /<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/gi;
    const items = [];
    let itemMatch;
    while ((itemMatch = itemRegex.exec(containerMatch[1])) !== null) {
      const cleaned = cleanString(itemMatch[1]);
      if (cleaned) items.push(cleaned);
    }
    return items;
  }

  // Dublin Core
  const title = getFirstMatch(/<dc:title[^>]*>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i) ||
    getFirstMatch(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
  if (title) metadata.title = title;

  const description = getFirstMatch(/<dc:description[^>]*>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i) ||
    getFirstMatch(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
  if (description) metadata.caption = description;

  const creator = getFirstMatch(/<dc:creator[^>]*>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i) ||
    getFirstMatch(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
  if (creator) metadata.creator = creator;

  const rights = getFirstMatch(/<dc:rights[^>]*>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/i) ||
    getFirstMatch(/<dc:rights[^>]*>([\s\S]*?)<\/dc:rights>/i);
  if (rights) metadata.copyright = rights;

  const keywords = getAllListMatches("dc:subject");
  if (keywords.length > 0) {
    metadata.keywords = keywords.join(", ");
  }

  // Photoshop XMP
  const headline = getFirstMatch(/<photoshop:Headline>([\s\S]*?)<\/photoshop:Headline>/i) ||
    getFirstMatch(/photoshop:Headline="([^"]+)"/i);
  if (headline) metadata.headline = headline;

  const credit = getFirstMatch(/<photoshop:Credit>([\s\S]*?)<\/photoshop:Credit>/i) ||
    getFirstMatch(/photoshop:Credit="([^"]+)"/i);
  if (credit) metadata.credit = credit;

  const city = getFirstMatch(/<photoshop:City>([\s\S]*?)<\/photoshop:City>/i) ||
    getFirstMatch(/photoshop:City="([^"]+)"/i);
  if (city) metadata.city = city;

  const state = getFirstMatch(/<photoshop:State>([\s\S]*?)<\/photoshop:State>/i) ||
    getFirstMatch(/photoshop:State="([^"]+)"/i);
  if (state) metadata.provinceOrState = state;

  const country = getFirstMatch(/<photoshop:Country>([\s\S]*?)<\/photoshop:Country>/i) ||
    getFirstMatch(/photoshop:Country="([^"]+)"/i);
  if (country) metadata.country = country;

  // XMP General & Camera Specs
  const createDate = getFirstMatch(/<xmp:CreateDate>([\s\S]*?)<\/xmp:CreateDate>/i) ||
    getFirstMatch(/xmp:CreateDate="([^"]+)"/i);
  if (createDate) metadata.xmpCreateDate = createDate;

  const creatorTool = getFirstMatch(/<xmp:CreatorTool>([\s\S]*?)<\/xmp:CreatorTool>/i) ||
    getFirstMatch(/xmp:CreatorTool="([^"]+)"/i);
  if (creatorTool) metadata.creatorTool = creatorTool;

  const lensModel = getFirstMatch(/<(?:exif|aux):Lens(?:Model)?>([\s\S]*?)<\/(?:exif|aux):Lens(?:Model)?>/i) ||
    getFirstMatch(/(?:exif|aux):Lens(?:Model)?="([^"]+)"/i);
  if (lensModel) metadata.lensModel = lensModel;

  const lensSerialNumber = getFirstMatch(/<aux:LensSerialNumber>([\s\S]*?)<\/aux:LensSerialNumber>/i) ||
    getFirstMatch(/aux:LensSerialNumber="([^"]+)"/i);
  if (lensSerialNumber) metadata.lensSerialNumber = lensSerialNumber;

  const serialNumber = getFirstMatch(/<(?:exif|aux):SerialNumber>([\s\S]*?)<\/(?:exif|aux):SerialNumber>/i) ||
    getFirstMatch(/(?:exif|aux):SerialNumber="([^"]+)"/i);
  if (serialNumber) metadata.bodySerialNumber = serialNumber;

  metadata.xmp = "Present";
  return metadata;
}

/* --------------------------------
   ICC Profile Parser (APP2)
-------------------------------- */

function parseICCProfile(view, offset, length) {
  if (offset + 128 > view.byteLength) return null;
  // ICC header bytes 16-19: color space signature
  const colorSpace = readLatin1(view, offset + 16, 4).trim();
  return {
    colorSpace: colorSpace || "sRGB",
    present: true,
  };
}

/* --------------------------------
   JPEG Multi-Segment Scanner
-------------------------------- */

function findExifSegment(view) {
  const segments = scanJpegSegments(view);
  return segments.exifOffset !== undefined ? segments.exifOffset : -1;
}

function scanJpegSegments(view) {
  const result = {
    exifOffset: -1,
    xmpStrings: [],
    iptcOffset: -1,
    iptcLength: 0,
    iccProfile: null,
  };

  if (view.byteLength < 4) return result;
  if (view.getUint8(0) !== 0xff || view.getUint8(1) !== 0xd8) return result;

  let offset = 2;

  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset++;
      continue;
    }

    const marker = view.getUint8(offset + 1);

    if (marker === 0xda) {
      break; // Start of Scan (SOS)
    }

    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2) break;

    const dataStart = offset + 4;
    const dataLength = segmentLength - 2;

    // APP1: EXIF or XMP
    if (marker === 0xe1 && dataStart + dataLength <= view.byteLength) {
      if (
        dataLength >= 6 &&
        view.getUint8(dataStart) === 0x45 &&
        view.getUint8(dataStart + 1) === 0x78 &&
        view.getUint8(dataStart + 2) === 0x69 &&
        view.getUint8(dataStart + 3) === 0x66 &&
        view.getUint8(dataStart + 4) === 0x00 &&
        view.getUint8(dataStart + 5) === 0x00
      ) {
        if (result.exifOffset === -1) {
          result.exifOffset = dataStart + 6;
        }
      } else {
        const xmpSig = "http://ns.adobe.com/xap/1.0/\0";
        const sigLen = xmpSig.length;
        if (dataLength >= sigLen) {
          const headerStr = readLatin1(view, dataStart, sigLen);
          if (headerStr.startsWith("http://ns.adobe.com/xap/1.0/")) {
            const xmpContent = readUtf8(view, dataStart + sigLen, dataLength - sigLen);
            result.xmpStrings.push(xmpContent);
          }
        }
      }
    }

    // APP2: ICC Profile
    if (marker === 0xe2 && dataStart + dataLength <= view.byteLength) {
      const iccSig = "ICC_PROFILE\0";
      if (dataLength >= iccSig.length) {
        const headerStr = readLatin1(view, dataStart, iccSig.length);
        if (headerStr.startsWith("ICC_PROFILE")) {
          result.iccProfile = parseICCProfile(view, dataStart + 14, dataLength - 14);
        }
      }
    }

    // APP13: Photoshop / IPTC
    if (marker === 0xed && dataStart + dataLength <= view.byteLength) {
      const psSig = "Photoshop 3.0";
      if (dataLength >= psSig.length) {
        const headerStr = readLatin1(view, dataStart, psSig.length);
        if (headerStr.startsWith(psSig)) {
          result.iptcOffset = dataStart;
          result.iptcLength = dataLength;
        }
      }
    }

    offset += 2 + segmentLength;
  }

  return result;
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

  if (
    view.byteLength >= 6 &&
    view.getUint8(0) === 0x47 &&
    view.getUint8(1) === 0x49 &&
    view.getUint8(2) === 0x46 &&
    view.getUint8(3) === 0x38 &&
    (view.getUint8(4) === 0x37 || view.getUint8(4) === 0x39) &&
    view.getUint8(5) === 0x61
  ) {
    return "gif";
  }

  if (
    view.byteLength >= 2 &&
    view.getUint8(0) === 0x42 &&
    view.getUint8(1) === 0x4d
  ) {
    return "bmp";
  }

  if (
    (view.byteLength >= 4 &&
      view.getUint8(0) === 0x49 &&
      view.getUint8(1) === 0x49 &&
      view.getUint8(2) === 0x2a &&
      view.getUint8(3) === 0x00) ||
    (view.byteLength >= 4 &&
      view.getUint8(0) === 0x4d &&
      view.getUint8(1) === 0x4d &&
      view.getUint8(2) === 0x00 &&
      view.getUint8(3) === 0x2a)
  ) {
    return "tiff";
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
  const text = readLatin1(view, start + nullPos + 1, length - nullPos - 1);
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

  if (compressionFlag === 1) return null;

  let text;
  try {
    text = readUtf8(view, start + pos, length - pos);
  } catch {
    text = readLatin1(view, start + pos, length - pos);
  }

  if (!keyword) return null;

  return { key: mapPNGKeyword(keyword), value: cleanString(text), rawKeyword: keyword };
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
    if (dataStart + length > view.byteLength) break;

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
      if (entry && entry.value) {
        if (entry.rawKeyword === "XML:com.adobe.xmp") {
          const xmpData = parseXMP(entry.value);
          Object.assign(metadata, xmpData);
        } else {
          metadata[entry.key] = entry.value;
        }
      }
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

    if (dataStart + chunkSize > view.byteLength) break;

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
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
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
      const xmpText = readUtf8(view, dataStart, chunkSize);
      if (xmpText && xmpText.trim()) {
        const xmpData = parseXMP(xmpText);
        Object.assign(metadata, xmpData);
      }
    }

    offset = dataStart + chunkSize + (chunkSize % 2);
  }

  return { metadata, dimensions };
}

/* --------------------------------
   Exposure & Format Value Helpers
-------------------------------- */

function formatExposureTime(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num >= 1
    ? `${Number(num.toFixed(3))} s`
    : `1/${Math.round(1 / num)} s`;
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

function formatExposureProgram(value) {
  const programs = {
    0: "Not defined",
    1: "Manual",
    2: "Normal program",
    3: "Aperture priority",
    4: "Shutter priority",
    5: "Creative program (depth of field)",
    6: "Action program (fast shutter speed)",
    7: "Portrait mode",
    8: "Landscape mode",
  };
  return programs[value] || null;
}

function formatMeteringMode(value) {
  const modes = {
    0: "Unknown",
    1: "Average",
    2: "Center-weighted average",
    3: "Spot",
    4: "Multi-spot",
    5: "Pattern",
    6: "Partial",
    255: "Other",
  };
  return modes[value] || null;
}

function formatWhiteBalance(value) {
  if (value === 0) return "Auto";
  if (value === 1) return "Manual";
  return null;
}

/* --------------------------------
   Metadata Normalization
-------------------------------- */

function normalizeMetadata(raw) {
  const metadata = {};

  if (!raw || typeof raw !== "object") {
    return metadata;
  }

  const make = cleanString(raw.make);
  const model = cleanString(raw.model);
  const lensMake = cleanString(raw.lensMake);
  const lensModel = cleanString(raw.lensModel);
  const lensSerialNumber = cleanString(raw.lensSerialNumber);
  const bodySerialNumber = cleanString(raw.bodySerialNumber || raw.serialNumber);
  const software = cleanString(raw.software);

  if (make) metadata.make = make;
  if (model) metadata.model = model;
  if (lensMake) metadata.lensMake = lensMake;
  if (lensModel) metadata.lensModel = lensModel;
  if (lensSerialNumber) metadata.lensSerialNumber = lensSerialNumber;
  if (bodySerialNumber) metadata.bodySerialNumber = bodySerialNumber;
  if (software) metadata.software = software;

  // Exposure settings
  if (Number.isFinite(Number(raw.exposureTime))) {
    const formatted = formatExposureTime(raw.exposureTime);
    if (formatted) metadata.exposureTime = formatted;
  }

  const rawFNumber = raw.fNumber ?? raw.apertureValue;
  if (Number.isFinite(Number(rawFNumber))) {
    const formatted = formatFNumber(rawFNumber);
    if (formatted) metadata.fNumber = formatted;
  }

  if (Number.isFinite(Number(raw.iso))) {
    const value = Number(raw.iso);
    if (value > 0 && value <= 100000) {
      metadata.iso = value;
    }
  }

  if (Number.isFinite(Number(raw.focalLength))) {
    const formatted = formatFocalLength(raw.focalLength);
    if (formatted) metadata.focalLength = formatted;
  }

  if (Number.isFinite(Number(raw.focalLengthIn35mm))) {
    metadata.focalLengthIn35mm = `${Number(raw.focalLengthIn35mm)} mm (35mm eq)`;
  }

  if (raw.exposureProgram !== undefined) {
    const prog = formatExposureProgram(raw.exposureProgram);
    if (prog) metadata.exposureProgram = prog;
  }

  if (Number.isFinite(Number(raw.exposureBias))) {
    const bias = Number(raw.exposureBias);
    metadata.exposureBias = `${bias >= 0 ? "+" : ""}${bias.toFixed(1)} EV`;
  }

  if (raw.meteringMode !== undefined) {
    const mode = formatMeteringMode(raw.meteringMode);
    if (mode) metadata.meteringMode = mode;
  }

  if (raw.whiteBalance !== undefined) {
    const wb = formatWhiteBalance(raw.whiteBalance);
    if (wb) metadata.whiteBalance = wb;
  }

  // GPS coordinates
  if (raw.latitude && raw.latitudeRef) {
    const latitude = gpsToDecimal(raw.latitude, raw.latitudeRef);
    if (latitude !== null) metadata.latitude = latitude;
  } else if (Number.isFinite(Number(raw.latitude))) {
    metadata.latitude = Number(Number(raw.latitude).toFixed(6));
  }

  if (raw.longitude && raw.longitudeRef) {
    const longitude = gpsToDecimal(raw.longitude, raw.longitudeRef);
    if (longitude !== null) metadata.longitude = longitude;
  } else if (Number.isFinite(Number(raw.longitude))) {
    metadata.longitude = Number(Number(raw.longitude).toFixed(6));
  }

  if (Number.isFinite(Number(raw.altitude))) {
    let altitude = Number(raw.altitude);
    if (Number(raw.altitudeRef) === 1) {
      altitude *= -1;
    }
    metadata.altitude = `${Number(altitude.toFixed(1))} m`;
  }

  if (metadata.latitude !== undefined && metadata.longitude !== undefined) {
    metadata.gpsCoordinates = `${metadata.latitude.toFixed(6)}, ${metadata.longitude.toFixed(6)}`;
  }

  const dateTaken = cleanString(raw.dateTaken) || cleanString(raw.dateTime);
  if (dateTaken) metadata.dateTaken = dateTaken;

  const dateDigitized = cleanString(raw.dateDigitized);
  if (dateDigitized) metadata.dateDigitized = dateDigitized;

  const xmpCreateDate = cleanString(raw.xmpCreateDate);
  if (xmpCreateDate) metadata.xmpCreateDate = xmpCreateDate;

  const creatorTool = cleanString(raw.creatorTool);
  if (creatorTool) metadata.creatorTool = creatorTool;

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

  if (raw.orientation !== undefined) {
    const orientation = orientationNames[raw.orientation];
    if (orientation) metadata.orientation = orientation;
  }

  const colorSpaceNames = {
    1: "sRGB",
    2: "Adobe RGB",
    65535: "Uncalibrated",
  };

  if (raw.colorSpace !== undefined) {
    const colorSpace = colorSpaceNames[raw.colorSpace] || String(raw.colorSpace);
    if (colorSpace) metadata.colorSpace = colorSpace;
  }

  // IPTC & Rights Passthroughs
  const stringKeys = [
    "artist",
    "title",
    "headline",
    "creator",
    "bylineTitle",
    "credit",
    "copyright",
    "source",
    "caption",
    "imageDescription",
    "keywords",
    "city",
    "provinceOrState",
    "country",
    "comment",
    "disclaimer",
    "warning",
    "xmp",
    "dimensions",
  ];

  stringKeys.forEach(key => {
    const val = cleanString(raw[key]);
    if (val && !metadata[key]) {
      metadata[key] = val;
    }
  });

  return metadata;
}

/* --------------------------------
   Metadata Groups
-------------------------------- */

function getMetadataGroups(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }

  const groups = [
    {
      title: "Camera & Hardware",
      icon: "📷",
      items: [],
    },
    {
      title: "Exposure & Optics",
      icon: "⚙️",
      items: [],
    },
    {
      title: "Location & GPS",
      icon: "📍",
      items: [],
    },
    {
      title: "IPTC & Rights",
      icon: "📰",
      items: [],
    },
    {
      title: "XMP & Software",
      icon: "📄",
      items: [],
    },
    {
      title: "Image & Color",
      icon: "🎨",
      items: [],
    },
  ];

  const cameraKeys = [
    "make",
    "model",
    "lensMake",
    "lensModel",
    "lensSerialNumber",
    "bodySerialNumber",
    "software",
  ];

  const exposureKeys = [
    "exposureTime",
    "fNumber",
    "iso",
    "focalLength",
    "focalLengthIn35mm",
    "exposureProgram",
    "exposureBias",
    "meteringMode",
    "whiteBalance",
  ];

  const locationKeys = [
    "latitude",
    "longitude",
    "altitude",
    "gpsCoordinates",
  ];

  const iptcKeys = [
    "title",
    "headline",
    "creator",
    "artist",
    "bylineTitle",
    "credit",
    "copyright",
    "source",
    "caption",
    "imageDescription",
    "keywords",
    "city",
    "provinceOrState",
    "country",
  ];

  const xmpKeys = [
    "dateTaken",
    "dateDigitized",
    "xmpCreateDate",
    "creatorTool",
    "xmp",
  ];

  Object.entries(metadata).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;

    let group;
    if (cameraKeys.includes(key)) {
      group = groups[0];
    } else if (exposureKeys.includes(key)) {
      group = groups[1];
    } else if (locationKeys.includes(key)) {
      group = groups[2];
    } else if (iptcKeys.includes(key)) {
      group = groups[3];
    } else if (xmpKeys.includes(key)) {
      group = groups[4];
    } else {
      group = groups[5];
    }

    group.items.push({ key, value });
  });

  return groups.filter(group => group.items.length > 0);
}

/* --------------------------------
   One-Click Privacy Scrubber
-------------------------------- */

/**
 * Sanitizes image binary buffer by stripping all EXIF, GPS, IPTC, XMP,
 * ICC profile, and user comment segments while keeping raw pixel stream intact.
 */
function scrubMetadata(bufferInput) {
  if (!bufferInput) {
    throw new Error("No buffer provided to scrub.");
  }

  let arrayBuffer;
  if (bufferInput instanceof ArrayBuffer) {
    arrayBuffer = bufferInput;
  } else if (ArrayBuffer.isView(bufferInput)) {
    arrayBuffer = bufferInput.buffer.slice(
      bufferInput.byteOffset,
      bufferInput.byteOffset + bufferInput.byteLength
    );
  } else {
    throw new Error("Invalid buffer type for scrubbing.");
  }

  const view = new DataView(arrayBuffer);
  const format = detectFormat(view);

  if (format === "jpeg") {
    return scrubJpeg(arrayBuffer);
  }
  if (format === "png") {
    return scrubPng(arrayBuffer);
  }
  if (format === "webp") {
    return scrubWebP(arrayBuffer);
  }

  return arrayBuffer;
}

function scrubJpeg(buffer) {
  const src = new Uint8Array(buffer);
  if (src.length < 4 || src[0] !== 0xff || src[1] !== 0xd8) {
    return buffer;
  }

  const cleanBytes = [0xff, 0xd8]; // SOI
  let offset = 2;

  while (offset < src.length) {
    if (src[offset] !== 0xff) {
      cleanBytes.push(src[offset]);
      offset++;
      continue;
    }

    const marker = src[offset + 1];

    // EOI
    if (marker === 0xd9) {
      cleanBytes.push(0xff, 0xd9);
      break;
    }

    // Start of Scan (SOS): keep SOS and all following image data up to EOI
    if (marker === 0xda) {
      for (let i = offset; i < src.length; i++) {
        cleanBytes.push(src[i]);
      }
      break;
    }

    // Single-byte markers without length payload
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      cleanBytes.push(0xff, marker);
      offset += 2;
      continue;
    }

    if (offset + 3 >= src.length) break;
    const segmentLength = (src[offset + 2] << 8) | src[offset + 3];

    // Drop metadata segments:
    // APP1 (0xE1: EXIF/XMP), APP2 (0xE2: ICC/FlashPix), APP13 (0xED: IPTC),
    // APP3-APP12 (0xE3-0xEC), COM (0xFE: Comments)
    // Note: keep APP0 (0xE0: JFIF standard layout)
    const isMetadataSegment =
      (marker >= 0xe1 && marker <= 0xed) || marker === 0xfe;

    if (isMetadataSegment) {
      offset += 2 + segmentLength;
    } else {
      const end = Math.min(offset + 2 + segmentLength, src.length);
      for (let i = offset; i < end; i++) {
        cleanBytes.push(src[i]);
      }
      offset = end;
    }
  }

  return new Uint8Array(cleanBytes).buffer;
}

function scrubPng(buffer) {
  const src = new Uint8Array(buffer);
  const cleanBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  let offset = 8;
  const view = new DataView(buffer);

  while (offset + 8 <= src.length) {
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(
      src[offset + 4],
      src[offset + 5],
      src[offset + 6],
      src[offset + 7]
    );

    const chunkTotalLength = 12 + length; // 4 len + 4 type + data + 4 crc
    if (offset + chunkTotalLength > src.length) break;

    // Drop metadata chunks
    const isMetadataChunk =
      type === "eXIf" ||
      type === "tEXt" ||
      type === "iTXt" ||
      type === "zTXt";

    if (!isMetadataChunk) {
      for (let i = offset; i < offset + chunkTotalLength; i++) {
        cleanBytes.push(src[i]);
      }
    }

    if (type === "IEND") break;
    offset += chunkTotalLength;
  }

  return new Uint8Array(cleanBytes).buffer;
}

function scrubWebP(buffer) {
  const src = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (src.length < 12) return buffer;

  const chunks = [];
  let offset = 12;

  while (offset + 8 <= src.length) {
    const fourCC = String.fromCharCode(
      src[offset],
      src[offset + 1],
      src[offset + 2],
      src[offset + 3]
    );
    const chunkSize = view.getUint32(offset + 4, true);
    const paddedSize = chunkSize + (chunkSize % 2);
    const chunkEnd = offset + 8 + paddedSize;
    if (chunkEnd > src.length) break;

    // Drop EXIF and XMP chunks
    if (fourCC !== "EXIF" && fourCC !== "XMP ") {
      const chunkBytes = src.slice(offset, chunkEnd);

      // If VP8X chunk, clear EXIF (bit 3) and XMP (bit 2) flags
      if (fourCC === "VP8X" && chunkBytes.length >= 18) {
        chunkBytes[8] = chunkBytes[8] & ~(0x08 | 0x04);
      }

      chunks.push(chunkBytes);
    }

    offset = chunkEnd;
  }

  // Calculate new RIFF size
  let totalChunksLen = 4; // 'WEBP'
  chunks.forEach(c => (totalChunksLen += c.length));

  const result = new Uint8Array(8 + totalChunksLen);
  // RIFF
  result[0] = 0x52;
  result[1] = 0x49;
  result[2] = 0x46;
  result[3] = 0x46;

  // File size
  const sizeView = new DataView(result.buffer);
  sizeView.setUint32(4, totalChunksLen, true);

  // WEBP
  result[8] = 0x57;
  result[9] = 0x45;
  result[10] = 0x42;
  result[11] = 0x50;

  let writePos = 12;
  chunks.forEach(c => {
    result.set(c, writePos);
    writePos += c.length;
  });

  return result.buffer;
}

/* --------------------------------
   Custom Errors & File Reading
-------------------------------- */

class FileReadError extends Error {
  constructor(message, code = "UNREADABLE_FILE", cause = null) {
    super(message);
    this.name = "FileReadError";
    this.code = code;
    if (cause) {
      this.cause = cause;
    }
  }
}

function classifyReadError(err) {
  if (err instanceof FileReadError) {
    return err;
  }

  const name =
    (err && (err.name || (err.constructor && err.constructor.name))) || "";
  const msg = err && err.message ? String(err.message) : "";

  if (
    name === "NotReadableError" ||
    /permission/i.test(msg) ||
    /not readable/i.test(msg) ||
    /locked/i.test(msg)
  ) {
    return new FileReadError(
      "Permission denied: Unable to read file due to permission restrictions or file lock.",
      "PERMISSION_DENIED",
      err
    );
  }

  if (name === "SecurityError" || /security/i.test(msg)) {
    return new FileReadError(
      "Security error: Access to the file was blocked by browser security restrictions.",
      "SECURITY_ERROR",
      err
    );
  }

  if (name === "NotFoundError" || /not found/i.test(msg)) {
    return new FileReadError(
      "File not found: The selected file could not be accessed.",
      "FILE_NOT_FOUND",
      err
    );
  }

  if (name === "AbortError" || /aborted/i.test(msg)) {
    return new FileReadError(
      "File read operation was aborted.",
      "READ_ABORTED",
      err
    );
  }

  return new FileReadError(
    msg ? `Failed to read file: ${msg}` : "Unreadable file: Unable to read file data.",
    "UNREADABLE_FILE",
    err
  );
}

function readFileBuffer(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new FileReadError("No image file provided.", "INVALID_INPUT"));
      return;
    }

    if (file instanceof ArrayBuffer) {
      if (file.byteLength === 0) {
        reject(new FileReadError("The image file is empty.", "EMPTY_FILE"));
        return;
      }
      resolve(file);
      return;
    }

    if (ArrayBuffer.isView(file)) {
      if (file.byteLength === 0) {
        reject(new FileReadError("The image file is empty.", "EMPTY_FILE"));
        return;
      }
      resolve(
        file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
      );
      return;
    }

    if (
      typeof FileReader !== "undefined" &&
      (typeof Blob === "undefined" ||
        file instanceof Blob ||
        typeof file.slice === "function")
    ) {
      try {
        const reader = new FileReader();

        reader.onload = () => {
          const result = reader.result;
          if (!result || result.byteLength === 0) {
            reject(
              new FileReadError("The image file is empty.", "EMPTY_FILE")
            );
            return;
          }
          resolve(result);
        };

        reader.onerror = () => {
          reject(classifyReadError(reader.error));
        };

        reader.onabort = () => {
          reject(
            new FileReadError(
              "File read operation was aborted.",
              "READ_ABORTED"
            )
          );
        };

        reader.readAsArrayBuffer(file);
        return;
      } catch (err) {
        if (typeof file.arrayBuffer !== "function") {
          reject(classifyReadError(err));
          return;
        }
      }
    }

    if (typeof file.arrayBuffer === "function") {
      file
        .arrayBuffer()
        .then(buffer => {
          if (!buffer || buffer.byteLength === 0) {
            reject(
              new FileReadError("The image file is empty.", "EMPTY_FILE")
            );
            return;
          }
          resolve(buffer);
        })
        .catch(err => {
          reject(classifyReadError(err));
        });
      return;
    }

    reject(new FileReadError("Invalid image file.", "INVALID_INPUT"));
  });
}

/* --------------------------------
   Main Parser
-------------------------------- */

async function parse(file) {
  if (!file) {
    throw new FileReadError("No image file provided.", "INVALID_INPUT");
  }

  const buffer = await readFileBuffer(file);

  if (!buffer || buffer.byteLength === 0) {
    throw new FileReadError("The image file is empty.", "EMPTY_FILE");
  }

  const view = new DataView(buffer);
  const format = detectFormat(view);

  let rawMetadata = {};
  let dimensions = null;

  if (format === "jpeg") {
    try {
      const segments = scanJpegSegments(view);

      if (segments.exifOffset !== -1) {
        const exifData = parseTIFF(view, segments.exifOffset);
        Object.assign(rawMetadata, exifData);
      }

      if (segments.xmpStrings && segments.xmpStrings.length > 0) {
        segments.xmpStrings.forEach(xmpStr => {
          const xmpData = parseXMP(xmpStr);
          Object.assign(rawMetadata, xmpData);
        });
      }

      if (segments.iptcOffset !== -1 && segments.iptcLength > 0) {
        const iptcData = parseIPTC(view, segments.iptcOffset, segments.iptcLength);
        Object.assign(rawMetadata, iptcData);
      }

      if (segments.iccProfile) {
        rawMetadata.colorSpace = segments.iccProfile.colorSpace || rawMetadata.colorSpace;
      }
    } catch (err) {
      throw new FileReadError(
        `Corrupted image data: Failed to parse JPEG metadata (${err.message}).`,
        "UNREADABLE_FILE",
        err
      );
    }
  } else if (format === "png") {
    try {
      const result = parsePNG(view);
      rawMetadata = result.metadata;
      dimensions = result.dimensions;
    } catch (err) {
      throw new FileReadError(
        `Corrupted image data: Failed to parse PNG metadata (${err.message}).`,
        "UNREADABLE_FILE",
        err
      );
    }
  } else if (format === "webp") {
    try {
      const result = parseWebP(view);
      rawMetadata = result.metadata;
      dimensions = result.dimensions;
    } catch (err) {
      throw new FileReadError(
        `Corrupted image data: Failed to parse WebP metadata (${err.message}).`,
        "UNREADABLE_FILE",
        err
      );
    }
  } else {
    const detectedName =
      format && format !== "unknown" ? ` (${format.toUpperCase()})` : "";
    throw new FileReadError(
      `Unsupported image format${detectedName}. Only JPEG, PNG, and WebP are supported.`,
      "UNSUPPORTED_FORMAT"
    );
  }

  const metadata = normalizeMetadata(rawMetadata);

  if (dimensions) {
    metadata.dimensions = `${dimensions.width} × ${dimensions.height}`;
  }

  return metadata;
}

/* --------------------------------
   Browser & Node Exports
-------------------------------- */

const ImageMetadataEngine = {
  parse,
  readFileBuffer,
  classifyReadError,
  FileReadError,
  detectFormat,
  formatFileSize,
  gpsToDecimal,
  dmsToDecimal: gpsToDecimal,
  normalizeMetadata,
  formatExposureTime,
  formatFNumber,
  formatFocalLength,
  getMetadataGroups,
  metadataToJSON,
  parseIPTC,
  parseXMP,
  scrubMetadata,
};

if (typeof globalThis !== "undefined") {
  globalThis.ImageMetadataEngine = ImageMetadataEngine;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ImageMetadataEngine;
}
