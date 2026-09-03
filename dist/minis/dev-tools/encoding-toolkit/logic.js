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
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
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
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Invalid Base64 input.");
  }
}

function encodeURLText(input) {
  return encodeURIComponent(input);
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

function encodeHTML(input) {
  return input.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]);
}

function decodeHTML(input) {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1] === "x" || entity[1] === "X";
      const code = isHex
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);

      if (Number.isNaN(code)) {
        throw new Error("Malformed HTML entity: " + match);
      }
      return String.fromCodePoint(code);
    }

    if (HTML_ENTITIES_REVERSE[entity] !== undefined) {
      return HTML_ENTITIES_REVERSE[entity];
    }
    throw new Error("Unknown HTML entity: " + match);
  });
}

function encodeUnicode(input) {
  return Array.from(input)
    .map((ch) => {
      const codePoint = ch.codePointAt(0);
      return codePoint > 0xffff
        ? "\\u{" + codePoint.toString(16) + "}"
        : "\\u" + codePoint.toString(16).padStart(4, "0");
    })
    .join("");
}

function decodeUnicode(input) {
  if (input === "") return "";

  if (!/^(\\u\{[0-9a-fA-F]+\}|\\u[0-9a-fA-F]{4})+$/.test(input)) {
    throw new Error("Invalid Unicode escape sequence.");
  }

  return input.replace(
    /\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g,
    (_, braced, plain) => String.fromCodePoint(parseInt(braced || plain, 16))
  );
}

function encodeHex(input) {
  const bytes = new TextEncoder().encode(input);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
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
    .map((b) => b.toString(2).padStart(8, "0"))
    .join(" ");
}

function decodeBinary(input) {
  const clean = input.trim().replace(/\s+/g, " ").trim();
  if (clean === "") return "";

  const groups = clean.split(" ");
  if (!groups.every((g) => /^[01]{8}$/.test(g))) {
    throw new Error("Invalid Binary input. Use 8-bit groups of 0s and 1s.");
  }

  const bytes = new Uint8Array(groups.map((g) => parseInt(g, 2)));

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
  };
}