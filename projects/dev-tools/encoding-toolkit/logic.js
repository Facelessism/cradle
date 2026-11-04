/**
 * Encoding Toolkit — Conversion Logic
 * ────────────────────────────────────
 * Pure, DOM-free encode/decode functions for six formats:
 * Base64, URL, HTML entities, Unicode escapes, Hex, and Binary.
 *
 * Every decode function throws a descriptive Error on malformed input
 * instead of returning garbage or crashing the page — script.js is
 * responsible for catching these and showing a friendly message.
 */

function encodeBase64(input) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function decodeBase64(input) {
  const clean = input.trim();
  if (clean === "") return "";

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 !== 0) {
    throw new Error("Invalid Base64 input.");
  }

  try {
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Invalid Base64 input.");
  }
}

function encodeURLText(input) {
  try {
    return encodeURIComponent(input);
  } catch {
    throw new Error("Cannot URL-encode text containing unpaired Unicode surrogates.");
  }
}

function decodeURLText(input) {
  try {
    return decodeURIComponent(input);
  } catch {
    throw new Error("Malformed URL-encoded input.");
  }
}

const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const HTML_ENTITIES_REVERSE = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
};

/**
 * Encodes special HTML characters, preserving supplementary-plane
 * characters and emoji by default. Optional encodeNonAscii flag converts
 * characters outside ASCII (including emoji) into numeric entities.
 */
function encodeHTML(input, options = {}) {
  const encodeNonAscii = options && options.encodeNonAscii === true;
  if (!encodeNonAscii) {
    return input.replace(/[&<>"']/g, ch => HTML_ENTITIES[ch]);
  }

  return Array.from(input)
    .map(ch => {
      if (HTML_ENTITIES[ch]) return HTML_ENTITIES[ch];
      const cp = ch.codePointAt(0);
      if (cp > 127) {
        return `&#x${cp.toString(16).toUpperCase()};`;
      }
      return ch;
    })
    .join("");
}

/**
 * Decodes HTML entities including named, decimal, hexadecimal, and
 * surrogate-pair numeric entities (e.g. &#xD83D;&#xDE00; or &#55357;&#56832;).
 */
function decodeHTML(input) {
  // First combine surrogate pair entities like &#xD83D;&#xDE00; or &#55357;&#56832;
  const surrogatePairEntityRegex =
    /&(?:#x([dD][89a-bA-B][0-9a-fA-F]{2})|#(55[2-9][0-9]{2}|56[0-2][0-9]{2}));&(?:#x([dD][c-fC-F][0-9a-fA-F]{2})|#(56[3-9][0-9]{2}|57[0-2][0-9]{2}|5734[0-3]));/gi;

  let processed = input.replace(
    surrogatePairEntityRegex,
    (match, hexHigh, decHigh, hexLow, decLow) => {
      const high = hexHigh ? parseInt(hexHigh, 16) : parseInt(decHigh, 10);
      const low = hexLow ? parseInt(hexLow, 16) : parseInt(decLow, 10);
      if (
        high >= 0xd800 &&
        high <= 0xdbff &&
        low >= 0xdc00 &&
        low <= 0xdfff
      ) {
        const code = 0x10000 + ((high - 0xd800) << 10) + (low - 0xdc00);
        return String.fromCodePoint(code);
      }
      return match;
    }
  );

  return processed.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (match, entity) => {
      if (entity[0] === "#") {
        const isHex = entity[1] === "x" || entity[1] === "X";
        const code = isHex
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);

        if (Number.isNaN(code) || code < 0 || code > 0x10ffff) {
          throw new Error("Malformed HTML entity: " + match);
        }
        return String.fromCodePoint(code);
      }

      if (HTML_ENTITIES_REVERSE[entity] !== undefined) {
        return HTML_ENTITIES_REVERSE[entity];
      }
      throw new Error("Unknown HTML entity: " + match);
    }
  );
}

/** Check if a code point is a Unicode surrogate (U+D800 - U+DFFF) */
function isSurrogate(codePoint) {
  return codePoint >= 0xd800 && codePoint <= 0xdfff;
}

/** Check if a code point is a high (leading) surrogate (U+D800 - U+DBFF) */
function isHighSurrogate(codePoint) {
  return codePoint >= 0xd800 && codePoint <= 0xdbff;
}

/** Check if a code point is a low (trailing) surrogate (U+DC00 - U+DFFF) */
function isLowSurrogate(codePoint) {
  return codePoint >= 0xdc00 && codePoint <= 0xdfff;
}

/** Convert a surrogate pair to its combined supplementary code point */
function surrogatePairToCodePoint(high, low) {
  if (!isHighSurrogate(high) || !isLowSurrogate(low)) {
    throw new Error("Invalid surrogate pair.");
  }
  return 0x10000 + ((high - 0xd800) << 10) + (low - 0xdc00);
}

/** Convert a supplementary code point (> 0xFFFF) to its high and low surrogate pair */
function codePointToSurrogatePair(codePoint) {
  if (codePoint < 0x10000 || codePoint > 0x10ffff) {
    throw new Error("Code point is not in supplementary planes (U+10000 to U+10FFFF).");
  }
  const high = Math.floor((codePoint - 0x10000) / 0x400) + 0xd800;
  const low = ((codePoint - 0x10000) % 0x400) + 0xdc00;
  return { high, low };
}

/**
 * Encodes text to Unicode escapes.
 * For supplementary plane characters (astral/emoji):
 * - By default or with options.surrogatePairs === true, supports surrogate pairs or braced escapes.
 */
function encodeUnicode(input, options = {}) {
  const useSurrogates = options && options.surrogatePairs === true;
  return Array.from(input)
    .map(ch => {
      const codePoint = ch.codePointAt(0);
      if (codePoint > 0xffff) {
        if (useSurrogates) {
          const { high, low } = codePointToSurrogatePair(codePoint);
          return (
            "\\u" +
            high.toString(16).padStart(4, "0") +
            "\\u" +
            low.toString(16).padStart(4, "0")
          );
        }
        return "\\u{" + codePoint.toString(16) + "}";
      }
      return "\\u" + codePoint.toString(16).padStart(4, "0");
    })
    .join("");
}

/**
 * Decodes Unicode escapes, combining surrogate pairs into their supplementary
 * code point representation (e.g. \uD83D\uDE00 -> 😀) and supporting \u{XXXXX}.
 */
function decodeUnicode(input) {
  if (input === "") return "";

  if (!/^(\\u\{[0-9a-fA-F]+\}|\\u[0-9a-fA-F]{4})+$/.test(input)) {
    throw new Error("Invalid Unicode escape sequence.");
  }

  // 1. First pair high and low surrogates: \uD8xx\uDCxx
  const surrogatePairRegex =
    /\\u([dD][89a-bA-B][0-9a-fA-F]{2})\\u([dD][c-fC-F][0-9a-fA-F]{2})/g;
  let normalized = input.replace(surrogatePairRegex, (_, highStr, lowStr) => {
    const high = parseInt(highStr, 16);
    const low = parseInt(lowStr, 16);
    const codePoint = surrogatePairToCodePoint(high, low);
    return String.fromCodePoint(codePoint);
  });

  // 2. Decode remaining standard and braced escapes with bounds validation
  return normalized.replace(
    /\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g,
    (match, braced, plain) => {
      const hex = braced || plain;
      const codePoint = parseInt(hex, 16);
      if (Number.isNaN(codePoint) || codePoint > 0x10ffff) {
        throw new Error("Invalid Unicode escape sequence: " + match);
      }
      return String.fromCodePoint(codePoint);
    }
  );
}

function encodeHex(input) {
  const bytes = new TextEncoder().encode(input);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join(" ");
}

function decodeHex(input) {
  const clean = input.trim().replace(/\s+/g, "");
  if (clean === "") return "";

  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error("Invalid Hex input.");
  }

  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Hex does not decode to valid UTF-8 text.");
  }
}

function encodeBinary(input) {
  const bytes = new TextEncoder().encode(input);
  return Array.from(bytes)
    .map(b => b.toString(2).padStart(8, "0"))
    .join(" ");
}

function decodeBinary(input) {
  const clean = input.trim().replace(/\s+/g, " ").trim();
  if (clean === "") return "";

  const groups = clean.split(" ");
  if (!groups.every(g => /^[01]{8}$/.test(g))) {
    throw new Error("Invalid Binary input. Use 8-bit groups of 0s and 1s.");
  }

  const bytes = new Uint8Array(groups.map(g => parseInt(g, 2)));

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Binary does not decode to valid UTF-8 text.");
  }
}

// UMD-style export so this file works as a plain <script> in the browser
// AND as a require()-able module in Node test files.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    encodeBase64,
    decodeBase64,
    encodeURLText,
    decodeURLText,
    encodeHTML,
    decodeHTML,
    encodeUnicode,
    decodeUnicode,
    encodeHex,
    decodeHex,
    encodeBinary,
    decodeBinary,
    isSurrogate,
    isHighSurrogate,
    isLowSurrogate,
    surrogatePairToCodePoint,
    codePointToSurrogatePair,
  };
}
