/* =========================================================
   ADVANCED QR CODE GENERATOR — ENGINE MODULE
   Modular logic for QR option validation, preset storage,
   SVG export payload building, and configuration management.
   ========================================================= */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.QREngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const storage =
    typeof window !== "undefined" && window.CradleStorage
      ? window.CradleStorage
      : require("../../../src/components/ui/storage.js");

  const STORAGE_KEY = "qr-studio-presets-v1";

  const DEFAULT_OPTIONS = Object.freeze({
    text: "",
    fgColor: "#2B2D42",
    bgColor: "#FFFFFF",
    size: 300,
    margin: 10,
    errorLevel: "M",
    dotStyle: "rounded",
    cornerSquareStyle: "extra-rounded",
    cornerDotStyle: "dot",
    logo: null,
  });

  const VALID_ERROR_LEVELS = ["L", "M", "Q", "H"];
  const VALID_DOT_STYLES = ["square", "dots", "rounded", "extra-rounded", "classy", "classy-rounded"];
  const VALID_CORNER_SQUARE_STYLES = ["square", "dot", "extra-rounded"];
  const VALID_CORNER_DOT_STYLES = ["square", "dot"];

  /** Validate a hex color string */
  function isValidHex(hex) {
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
  }

  /** Sanitize & validate configuration options */
  function sanitizeOptions(inputOpts = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...inputOpts };

    opts.text = typeof opts.text === "string" ? opts.text : "";
    opts.fgColor = isValidHex(opts.fgColor) ? opts.fgColor : DEFAULT_OPTIONS.fgColor;
    opts.bgColor = isValidHex(opts.bgColor) ? opts.bgColor : DEFAULT_OPTIONS.bgColor;

    opts.size = typeof opts.size === "number" && !isNaN(opts.size)
      ? Math.max(100, Math.min(1000, opts.size))
      : DEFAULT_OPTIONS.size;

    opts.margin = typeof opts.margin === "number" && !isNaN(opts.margin)
      ? Math.max(0, Math.min(100, opts.margin))
      : DEFAULT_OPTIONS.margin;

    opts.errorLevel = VALID_ERROR_LEVELS.includes(opts.errorLevel)
      ? opts.errorLevel
      : DEFAULT_OPTIONS.errorLevel;

    opts.dotStyle = VALID_DOT_STYLES.includes(opts.dotStyle)
      ? opts.dotStyle
      : DEFAULT_OPTIONS.dotStyle;

    opts.cornerSquareStyle = VALID_CORNER_SQUARE_STYLES.includes(opts.cornerSquareStyle)
      ? opts.cornerSquareStyle
      : DEFAULT_OPTIONS.cornerSquareStyle;

    opts.cornerDotStyle = VALID_CORNER_DOT_STYLES.includes(opts.cornerDotStyle)
      ? opts.cornerDotStyle
      : DEFAULT_OPTIONS.cornerDotStyle;

    return opts;
  }

  /** Format QRCodeStyling configuration payload */
  function buildConfigPayload(opts) {
    const sanitized = sanitizeOptions(opts);

    return {
      width: sanitized.size,
      height: sanitized.size,
      data: sanitized.text,
      margin: sanitized.margin,
      qrOptions: {
        errorCorrectionLevel: sanitized.errorLevel,
      },
      dotsOptions: {
        color: sanitized.fgColor,
        type: sanitized.dotStyle,
      },
      cornersSquareOptions: {
        color: sanitized.fgColor,
        type: sanitized.cornerSquareStyle,
      },
      cornersDotOptions: {
        color: sanitized.fgColor,
        type: sanitized.cornerDotStyle,
      },
      backgroundOptions: {
        color: sanitized.bgColor,
      },
      image: sanitized.logo || undefined,
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 6,
        imageSize: 0.4,
      },
    };
  }

  /** Load saved presets from storage */
  function getSavedPresets() {
    const presets = storage.get(STORAGE_KEY, []);
    return Array.isArray(presets) ? presets : [];
  }

  /** Save preset configuration */
  function savePreset(name, options) {
    if (!name || typeof name !== "string") return false;
    const presets = getSavedPresets();
    const cleanOpts = sanitizeOptions(options);
    const existingIndex = presets.findIndex(p => p.name.toLowerCase() === name.toLowerCase());

    const presetObj = {
      id: existingIndex >= 0 ? presets[existingIndex].id : Date.now().toString(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      options: {
        fgColor: cleanOpts.fgColor,
        bgColor: cleanOpts.bgColor,
        size: cleanOpts.size,
        margin: cleanOpts.margin,
        errorLevel: cleanOpts.errorLevel,
        dotStyle: cleanOpts.dotStyle,
      },
    };

    if (existingIndex >= 0) {
      presets[existingIndex] = presetObj;
    } else {
      presets.push(presetObj);
    }

    return storage.set(STORAGE_KEY, presets);
  }

  /** Delete a preset by ID */
  function deletePreset(id) {
    const presets = getSavedPresets();
    const filtered = presets.filter(p => p.id !== id);
    return storage.set(STORAGE_KEY, filtered);
  }

  return {
    DEFAULT_OPTIONS,
    isValidHex,
    sanitizeOptions,
    buildConfigPayload,
    getSavedPresets,
    savePreset,
    deletePreset,
  };
});
