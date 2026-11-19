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
    gradientEnabled: false,
    gradientType: "linear",
    gradientColor1: "#2B2D42",
    gradientColor2: "#6366F1",
    gradientRotation: 0,
    logo: null,
    logoSize: 0.3,
    logoMargin: 6,
    exportResolution: 4000,
  });

  const VALID_ERROR_LEVELS = ["L", "M", "Q", "H"];
  const VALID_DOT_STYLES = [
    "square",
    "dots",
    "rounded",
    "extra-rounded",
    "classy",
    "classy-rounded",
    "diamond",
  ];
  const VALID_CORNER_SQUARE_STYLES = ["square", "dot", "extra-rounded"];
  const VALID_CORNER_DOT_STYLES = ["square", "dot"];
  const VALID_GRADIENT_TYPES = ["linear", "radial"];

  /** Validate a hex color string */
  function isValidHex(hex) {
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
  }

  /** Sanitize & validate configuration options */
  function sanitizeOptions(inputOpts = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...inputOpts };

    opts.text = typeof opts.text === "string" ? opts.text : "";
    opts.fgColor = isValidHex(opts.fgColor)
      ? opts.fgColor
      : DEFAULT_OPTIONS.fgColor;
    opts.bgColor = isValidHex(opts.bgColor)
      ? opts.bgColor
      : DEFAULT_OPTIONS.bgColor;

    opts.size =
      typeof opts.size === "number" && !isNaN(opts.size)
        ? Math.max(100, Math.min(1000, opts.size))
        : DEFAULT_OPTIONS.size;

    opts.margin =
      typeof opts.margin === "number" && !isNaN(opts.margin)
        ? Math.max(0, Math.min(100, opts.margin))
        : DEFAULT_OPTIONS.margin;

    opts.errorLevel = VALID_ERROR_LEVELS.includes(opts.errorLevel)
      ? opts.errorLevel
      : DEFAULT_OPTIONS.errorLevel;

    // Automatic Reed-Solomon elevation to Level H (30% damage recovery) when logo is present
    if (opts.logo) {
      opts.errorLevel = "H";
    }

    opts.dotStyle = VALID_DOT_STYLES.includes(opts.dotStyle)
      ? opts.dotStyle
      : DEFAULT_OPTIONS.dotStyle;

    opts.cornerSquareStyle = VALID_CORNER_SQUARE_STYLES.includes(
      opts.cornerSquareStyle
    )
      ? opts.cornerSquareStyle
      : DEFAULT_OPTIONS.cornerSquareStyle;

    opts.cornerDotStyle = VALID_CORNER_DOT_STYLES.includes(opts.cornerDotStyle)
      ? opts.cornerDotStyle
      : DEFAULT_OPTIONS.cornerDotStyle;

    opts.gradientEnabled = Boolean(opts.gradientEnabled);
    opts.gradientType = VALID_GRADIENT_TYPES.includes(opts.gradientType)
      ? opts.gradientType
      : DEFAULT_OPTIONS.gradientType;

    opts.gradientColor1 = isValidHex(opts.gradientColor1)
      ? opts.gradientColor1
      : opts.fgColor;
    opts.gradientColor2 = isValidHex(opts.gradientColor2)
      ? opts.gradientColor2
      : DEFAULT_OPTIONS.gradientColor2;

    opts.gradientRotation =
      typeof opts.gradientRotation === "number" && !isNaN(opts.gradientRotation)
        ? Math.max(0, Math.min(360, opts.gradientRotation))
        : DEFAULT_OPTIONS.gradientRotation;

    opts.logoSize =
      typeof opts.logoSize === "number" && !isNaN(opts.logoSize)
        ? Math.max(0.15, Math.min(0.38, opts.logoSize))
        : DEFAULT_OPTIONS.logoSize;

    opts.logoMargin =
      typeof opts.logoMargin === "number" && !isNaN(opts.logoMargin)
        ? Math.max(0, Math.min(20, opts.logoMargin))
        : DEFAULT_OPTIONS.logoMargin;

    opts.exportResolution =
      typeof opts.exportResolution === "number" && !isNaN(opts.exportResolution)
        ? Math.max(100, Math.min(4000, opts.exportResolution))
        : DEFAULT_OPTIONS.exportResolution;

    return opts;
  }

  /** Format QRCodeStyling configuration payload */
  function buildConfigPayload(opts) {
    const sanitized = sanitizeOptions(opts);

    // Automatic Reed-Solomon elevation to Level H when logo is present
    const effectiveErrorLevel = sanitized.logo ? "H" : sanitized.errorLevel;

    // For diamond style, QRCodeStyling renders circular dots which are subsequently
    // post-processed into vector diamond polygons in SVG and PostScript EPS.
    const resolvedDotType =
      sanitized.dotStyle === "diamond" ? "dots" : sanitized.dotStyle;

    const dotsOptions = {
      type: resolvedDotType,
    };

    if (sanitized.gradientEnabled) {
      dotsOptions.gradient = {
        type: sanitized.gradientType,
        rotation: (sanitized.gradientRotation * Math.PI) / 180,
        colorStops: [
          { offset: 0, color: sanitized.gradientColor1 },
          { offset: 1, color: sanitized.gradientColor2 },
        ],
      };
    } else {
      dotsOptions.color = sanitized.fgColor;
    }

    return {
      width: sanitized.size,
      height: sanitized.size,
      data: sanitized.text,
      margin: sanitized.margin,
      qrOptions: {
        errorCorrectionLevel: effectiveErrorLevel,
      },
      dotsOptions,
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
        margin: sanitized.logoMargin,
        imageSize: sanitized.logoSize,
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
    const existingIndex = presets.findIndex(
      p => p.name.toLowerCase() === name.toLowerCase()
    );

    const presetObj = {
      id:
        existingIndex >= 0 ? presets[existingIndex].id : Date.now().toString(),
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

  /**
   * Generate a sanitized filename with appropriate extension.
   * Ensures output is always formatted e.g. "qr-code.png", "qr-code.svg", or "qr-code.eps".
   */
  function getDownloadFilename(name = "qr-code", extension = "png") {
    const ext =
      typeof extension === "string"
        ? extension.toLowerCase().replace(/^\./, "").trim()
        : "png";
    const validExts = ["png", "svg", "eps", "jpeg", "jpg", "webp"];
    const resolvedExt = validExts.includes(ext)
      ? ext === "jpg"
        ? "jpeg"
        : ext
      : "png";

    let cleanName = typeof name === "string" ? name.trim() : "";
    if (!cleanName) {
      cleanName = "qr-code";
    }

    // Remove invalid filename characters: < > : " / \ | ? * and control chars
    cleanName = cleanName
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      .replace(/\.+$/, "");
    if (!cleanName) {
      cleanName = "qr-code";
    }

    // If cleanName already ends with .ext, preserve it
    const lowerName = cleanName.toLowerCase();
    if (
      lowerName.endsWith("." + resolvedExt) ||
      (resolvedExt === "jpeg" && lowerName.endsWith(".jpg"))
    ) {
      return cleanName;
    }

    return `${cleanName}.${resolvedExt}`;
  }

  /**
   * Post-processes SVG markup to transform circular module dots into diamond geometry.
   * Replaces `<circle cx="..." cy="..." r="..." ...>` with `<polygon points="..." ...>`.
   */
  function applyDiamondGeometry(svgString) {
    if (!svgString || typeof svgString !== "string") return svgString;
    return svgString.replace(/<circle\b([^>]*?)\/?>/gi, (match, attrs) => {
      const cxMatch = attrs.match(/\bcx=["']([\d.-]+)["']/i);
      const cyMatch = attrs.match(/\bcy=["']([\d.-]+)["']/i);
      const rMatch = attrs.match(/\br=["']([\d.-]+)["']/i);
      if (!cxMatch || !cyMatch || !rMatch) return match;

      const cx = parseFloat(cxMatch[1]);
      const cy = parseFloat(cyMatch[1]);
      const r = parseFloat(rMatch[1]);

      const cleanAttrs = attrs
        .replace(/\bcx=["'][\d.-]+["']/gi, "")
        .replace(/\bcy=["'][\d.-]+["']/gi, "")
        .replace(/\br=["'][\d.-]+["']/gi, "")
        .trim();

      const top = `${cx.toFixed(3)},${(cy - r).toFixed(3)}`;
      const right = `${(cx + r).toFixed(3)},${cy.toFixed(3)}`;
      const bottom = `${cx.toFixed(3)},${(cy + r).toFixed(3)}`;
      const left = `${(cx - r).toFixed(3)},${cy.toFixed(3)}`;
      const points = `${top} ${right} ${bottom} ${left}`;

      return `<polygon points="${points}" ${cleanAttrs} />`;
    });
  }

  /**
   * Converts SVG vector markup into standard Encapsulated PostScript (EPS Level 2/3).
   * Generates EPSF-3.0 header, handles coordinate mapping, and converts vector shapes
   * (rects, circles, polygons, paths) into native PostScript drawing operators.
   *
   * @param {string} svgString - Valid SVG markup
   * @returns {string} Encapsulated PostScript (.eps) file content
   */
  function svgToEps(svgString) {
    if (!svgString || typeof svgString !== "string") return "";

    let width = 1000;
    let height = 1000;

    const vbMatch = svgString.match(
      /viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i
    );
    if (vbMatch) {
      width = parseFloat(vbMatch[3]) || 1000;
      height = parseFloat(vbMatch[4]) || 1000;
    } else {
      const wMatch = svgString.match(/width=["']([\d.]+)p?x?["']/i);
      const hMatch = svgString.match(/height=["']([\d.]+)p?x?["']/i);
      if (wMatch) width = parseFloat(wMatch[1]) || 1000;
      if (hMatch) height = parseFloat(hMatch[1]) || 1000;
    }

    const epsLines = [
      "%!PS-Adobe-3.0 EPSF-3.0",
      "%%Creator: Cradle Advanced QR Code Generator",
      "%%Title: QR Code Vector Export",
      `%%BoundingBox: 0 0 ${Math.ceil(width)} ${Math.ceil(height)}`,
      `%%HiResBoundingBox: 0.000 0.000 ${width.toFixed(3)} ${height.toFixed(3)}`,
      "%%Pages: 1",
      "%%LanguageLevel: 2",
      "%%EndComments",
      "%%Page: 1 1",
      "save",
      `0 ${height.toFixed(3)} translate`,
      "1 -1 scale",
      "",
      "/rgb { setrgbcolor } bind def",
    ];

    function parseColor(colorStr) {
      if (!colorStr) return "0.0 0.0 0.0";
      const str = colorStr.trim();
      if (str.startsWith("#")) {
        const hex = str.replace("#", "");
        if (hex.length === 3) {
          const r = parseInt(hex[0] + hex[0], 16) / 255;
          const g = parseInt(hex[1] + hex[1], 16) / 255;
          const b = parseInt(hex[2] + hex[2], 16) / 255;
          return `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`;
        } else if (hex.length >= 6) {
          const r = parseInt(hex.substring(0, 2), 16) / 255;
          const g = parseInt(hex.substring(2, 4), 16) / 255;
          const b = parseInt(hex.substring(4, 6), 16) / 255;
          return `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`;
        }
      } else if (str.startsWith("rgb")) {
        const nums = str.match(/[\d.]+/g);
        if (nums && nums.length >= 3) {
          const r = parseFloat(nums[0]) / 255;
          const g = parseFloat(nums[1]) / 255;
          const b = parseFloat(nums[2]) / 255;
          return `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`;
        }
      }
      return "0.0 0.0 0.0";
    }

    // 1. Rectangles
    const rectRegex = /<rect\b([^>]*?)\/?>/gi;
    let match;
    while ((match = rectRegex.exec(svgString)) !== null) {
      const attrs = match[1];
      const xMatch = attrs.match(/\bx=["']([\d.-]+)["']/i);
      const yMatch = attrs.match(/\by=["']([\d.-]+)["']/i);
      const wMatch = attrs.match(/\bwidth=["']([\d.-]+)["']/i);
      const hMatch = attrs.match(/\bheight=["']([\d.-]+)["']/i);
      const fillMatch = attrs.match(/\bfill=["']([^"']+)["']/i);

      const x = xMatch ? parseFloat(xMatch[1]) : 0;
      const y = yMatch ? parseFloat(yMatch[1]) : 0;
      const w = wMatch ? parseFloat(wMatch[1]) : width;
      const h = hMatch ? parseFloat(hMatch[1]) : height;
      const fill = fillMatch ? fillMatch[1] : "#FFFFFF";

      if (fill.toLowerCase() !== "none") {
        epsLines.push(`${parseColor(fill)} rgb`);
        epsLines.push(
          `${x.toFixed(3)} ${y.toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)} rectfill`
        );
      }
    }

    // 2. Circles
    const circleRegex = /<circle\b([^>]*?)\/?>/gi;
    while ((match = circleRegex.exec(svgString)) !== null) {
      const attrs = match[1];
      const cxMatch = attrs.match(/\bcx=["']([\d.-]+)["']/i);
      const cyMatch = attrs.match(/\bcy=["']([\d.-]+)["']/i);
      const rMatch = attrs.match(/\br=["']([\d.-]+)["']/i);
      const fillMatch = attrs.match(/\bfill=["']([^"']+)["']/i);

      if (cxMatch && cyMatch && rMatch) {
        const cx = parseFloat(cxMatch[1]);
        const cy = parseFloat(cyMatch[1]);
        const r = parseFloat(rMatch[1]);
        const fill = fillMatch ? fillMatch[1] : "#000000";

        if (fill.toLowerCase() !== "none") {
          epsLines.push(`${parseColor(fill)} rgb`);
          epsLines.push(
            `newpath ${cx.toFixed(3)} ${cy.toFixed(3)} ${r.toFixed(3)} 0 360 arc fill`
          );
        }
      }
    }

    // 3. Polygons
    const polyRegex = /<polygon\b([^>]*?)\/?>/gi;
    while ((match = polyRegex.exec(svgString)) !== null) {
      const attrs = match[1];
      const ptsMatch = attrs.match(/\bpoints=["']([^"']+)["']/i);
      const fillMatch = attrs.match(/\bfill=["']([^"']+)["']/i);

      if (ptsMatch) {
        const rawPoints = ptsMatch[1].trim().split(/[\s,]+/);
        if (rawPoints.length >= 4) {
          const fill = fillMatch ? fillMatch[1] : "#000000";
          if (fill.toLowerCase() !== "none") {
            epsLines.push(`${parseColor(fill)} rgb`);
            epsLines.push("newpath");
            for (let i = 0; i < rawPoints.length; i += 2) {
              const px = parseFloat(rawPoints[i]);
              const py = parseFloat(rawPoints[i + 1]);
              if (i === 0) {
                epsLines.push(`${px.toFixed(3)} ${py.toFixed(3)} moveto`);
              } else {
                epsLines.push(`${px.toFixed(3)} ${py.toFixed(3)} lineto`);
              }
            }
            epsLines.push("closepath fill");
          }
        }
      }
    }

    // 4. Paths
    const pathRegex = /<path\b([^>]*?)\/?>/gi;
    while ((match = pathRegex.exec(svgString)) !== null) {
      const attrs = match[1];
      const dMatch = attrs.match(/\bd=["']([^"']+)["']/i);
      const fillMatch = attrs.match(/\bfill=["']([^"']+)["']/i);

      if (dMatch) {
        const d = dMatch[1];
        const fill = fillMatch ? fillMatch[1] : "#000000";
        if (fill.toLowerCase() !== "none") {
          epsLines.push(`${parseColor(fill)} rgb`);
          epsLines.push("newpath");
          const tokens = d.match(/([a-df-z]|[\d.-]+)/gi);
          if (tokens) {
            let i = 0;
            let cmd = "";
            let curX = 0;
            let curY = 0;
            while (i < tokens.length) {
              if (/^[a-df-z]$/i.test(tokens[i])) {
                cmd = tokens[i++];
              }
              if (cmd === "M" || cmd === "m") {
                const x = parseFloat(tokens[i++]);
                const y = parseFloat(tokens[i++]);
                curX = cmd === "M" ? x : curX + x;
                curY = cmd === "M" ? y : curY + y;
                epsLines.push(`${curX.toFixed(3)} ${curY.toFixed(3)} moveto`);
                cmd = cmd === "M" ? "L" : "l";
              } else if (cmd === "L" || cmd === "l") {
                const x = parseFloat(tokens[i++]);
                const y = parseFloat(tokens[i++]);
                curX = cmd === "L" ? x : curX + x;
                curY = cmd === "L" ? y : curY + y;
                epsLines.push(`${curX.toFixed(3)} ${curY.toFixed(3)} lineto`);
              } else if (cmd === "H" || cmd === "h") {
                const x = parseFloat(tokens[i++]);
                curX = cmd === "H" ? x : curX + x;
                epsLines.push(`${curX.toFixed(3)} ${curY.toFixed(3)} lineto`);
              } else if (cmd === "V" || cmd === "v") {
                const y = parseFloat(tokens[i++]);
                curY = cmd === "V" ? y : curY + y;
                epsLines.push(`${curX.toFixed(3)} ${curY.toFixed(3)} lineto`);
              } else if (cmd === "C" || cmd === "c") {
                const x1 = parseFloat(tokens[i++]);
                const y1 = parseFloat(tokens[i++]);
                const x2 = parseFloat(tokens[i++]);
                const y2 = parseFloat(tokens[i++]);
                const x = parseFloat(tokens[i++]);
                const y = parseFloat(tokens[i++]);
                const cp1X = cmd === "C" ? x1 : curX + x1;
                const cp1Y = cmd === "C" ? y1 : curY + y1;
                const cp2X = cmd === "C" ? x2 : curX + x2;
                const cp2Y = cmd === "C" ? y2 : curY + y2;
                curX = cmd === "C" ? x : curX + x;
                curY = cmd === "C" ? y : curY + y;
                epsLines.push(
                  `${cp1X.toFixed(3)} ${cp1Y.toFixed(3)} ${cp2X.toFixed(3)} ${cp2Y.toFixed(3)} ${curX.toFixed(3)} ${curY.toFixed(3)} curveto`
                );
              } else if (cmd === "Z" || cmd === "z") {
                epsLines.push("closepath");
              } else {
                i++;
              }
            }
          }
          epsLines.push("fill");
        }
      }
    }

    epsLines.push("restore");
    epsLines.push("showpage");
    epsLines.push("%%EOF");

    return epsLines.join("\n");
  }

  /**
   * Trigger browser download for a Blob, data URL, or object URL with an explicit filename.
   * Ensures anchor element has download="filename.ext" set before clicking.
   */
  function triggerDownload(blobOrUrl, filename = "qr-code.png", doc = null) {
    const documentObj =
      doc || (typeof document !== "undefined" ? document : null);
    if (!documentObj || typeof documentObj.createElement !== "function") {
      return false;
    }

    const isBlob = typeof Blob !== "undefined" && blobOrUrl instanceof Blob;
    let url = blobOrUrl;
    let objectUrlCreated = false;

    if (isBlob) {
      if (
        typeof URL !== "undefined" &&
        typeof URL.createObjectURL === "function"
      ) {
        url = URL.createObjectURL(blobOrUrl);
        objectUrlCreated = true;
      }
    }

    const anchor = documentObj.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.setAttribute("download", filename);

    if (
      documentObj.body &&
      typeof documentObj.body.appendChild === "function"
    ) {
      documentObj.body.appendChild(anchor);
    }

    if (typeof anchor.click === "function") {
      anchor.click();
    }

    setTimeout(() => {
      if (
        anchor.parentNode &&
        typeof anchor.parentNode.removeChild === "function"
      ) {
        anchor.parentNode.removeChild(anchor);
      }
      if (
        objectUrlCreated &&
        typeof URL !== "undefined" &&
        typeof URL.revokeObjectURL === "function"
      ) {
        URL.revokeObjectURL(url);
      }
    }, 1000);

    return true;
  }


  function isValidLogoType(type) {
    return ["image/png", "image/jpeg", "image/svg+xml"].includes(type);
  }

  async function validateLogoSignature(blobOrBytes) {
    if (!blobOrBytes) {
      return { valid: false, error: "No logo file provided." };
    }

    let bytes = null;
    if (blobOrBytes instanceof Uint8Array) {
      bytes = blobOrBytes;
    } else if (ArrayBuffer.isView(blobOrBytes)) {
      bytes = new Uint8Array(
        blobOrBytes.buffer,
        blobOrBytes.byteOffset,
        blobOrBytes.byteLength
      );
    } else if (blobOrBytes instanceof ArrayBuffer) {
      bytes = new Uint8Array(blobOrBytes);
    } else if (typeof blobOrBytes.slice === "function") {
      try {
        const slice = blobOrBytes.slice(0, 64);
        const buffer = await slice.arrayBuffer();
        bytes = new Uint8Array(buffer);
      } catch (err) {
        return { valid: false, error: "Failed to read logo header." };
      }
    }

    if (!bytes || bytes.length < 3) {
      return { valid: false, error: "Logo file is empty or corrupted." };
    }

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { valid: true, mimeType: "image/jpeg" };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return { valid: true, mimeType: "image/png" };
    }

    // SVG: UTF-8 XML/SVG markup
    let isSvg = false;
    let hasNull = false;
    for (let i = 0; i < Math.min(bytes.length, 32); i++) {
      if (bytes[i] === 0) {
        hasNull = true;
        break;
      }
    }
    if (!hasNull) {
      let str = "";
      try {
        if (typeof TextDecoder !== "undefined") {
          str = new TextDecoder("utf-8").decode(bytes);
        } else {
          str = String.fromCharCode.apply(null, Array.from(bytes));
        }
        const trimmed = str.trim().toLowerCase();
        if (
          trimmed.startsWith("<svg") ||
          (trimmed.startsWith("<?xml") && trimmed.includes("<svg")) ||
          trimmed.includes("<svg")
        ) {
          isSvg = true;
        }
      } catch (_) {}
    }

    if (isSvg) {
      return { valid: true, mimeType: "image/svg+xml" };
    }

    return {
      valid: false,
      error:
        "File signature does not match any supported logo format (PNG, JPEG, SVG).",
    };
  }

  return {
    DEFAULT_OPTIONS,
    isValidLogoType,
    validateLogoSignature,
    isValidHex,
    sanitizeOptions,
    buildConfigPayload,
    getSavedPresets,
    savePreset,
    deletePreset,
    getDownloadFilename,
    triggerDownload,
    applyDiamondGeometry,
    svgToEps,
  };
});
