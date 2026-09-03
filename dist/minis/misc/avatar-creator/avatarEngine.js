/**
 * Avatar Creator Engine (avatarEngine.js)
 * Standalone 16x16 pixel grid SVG avatar generator with color palette and hair style engines.
 * UMD compliant for Node.js unit tests and browser execution.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AvatarEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const GRID_SIZE = 16;
  const CANVAS_SIZE = 200;
  const PIXEL_SIZE = CANVAS_SIZE / GRID_SIZE;

  const faceRows = {
    2: [7, 8],
    3: [6, 9],
    4: [5, 10],
    5: [4, 11],
    6: [4, 11],
    7: [3, 12],
    8: [3, 12],
    9: [3, 12],
    10: [4, 11],
    11: [4, 11],
    12: [5, 10],
    13: [6, 9],
    14: [7, 8],
  };

  const hairStyles = [
    // 0: Bowl Cut
    [
      [1, 7], [1, 8], [2, 6], [2, 7], [2, 8], [2, 9],
      [3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10],
      [4, 4], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10], [4, 11],
      [5, 4], [5, 11]
    ],
    // 1: Spiky
    [
      [3, 4], [4, 4], [5, 4], [4, 5], [5, 5], [2, 6], [3, 6], [4, 6], [5, 6],
      [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [0, 8], [1, 8], [2, 8],
      [3, 8], [4, 8], [5, 8], [2, 9], [3, 9], [4, 9], [5, 9], [4, 10], [5, 10],
      [3, 11], [4, 11], [5, 11]
    ],
    // 2: Bald
    []
  ];

  const eyePositions = [[9, 5], [9, 10]];
  const mouthPositions = [[12, 7], [12, 8]];
  const blushPositions = [[10, 4], [10, 11]];

  /**
   * Generate SVG markup string representing the 16x16 avatar pixel grid.
   */
  function generateAvatarSVG(options = {}) {
    const bgColor = options.bgColor || "#3b82f6";
    const skinColor = options.skinColor || "#ffdbac";
    const hairColor = options.hairColor || "#4a3728";
    const hairStyleIdx = parseInt(options.hairStyle || 0, 10);

    let rects = [];
    rects.push(`<rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="${bgColor}" />`);

    // Draw face pixels
    for (const [r, [cStart, cEnd]] of Object.entries(faceRows)) {
      const row = parseInt(r, 10);
      for (let col = cStart; col <= cEnd; col++) {
        rects.push(`<rect x="${col * PIXEL_SIZE}" y="${row * PIXEL_SIZE}" width="${PIXEL_SIZE}" height="${PIXEL_SIZE}" fill="${skinColor}" />`);
      }
    }

    // Draw eyes
    eyePositions.forEach(([r, c]) => {
      rects.push(`<rect x="${c * PIXEL_SIZE}" y="${r * PIXEL_SIZE}" width="${PIXEL_SIZE}" height="${PIXEL_SIZE}" fill="#1e293b" />`);
    });

    // Draw mouth
    mouthPositions.forEach(([r, c]) => {
      rects.push(`<rect x="${c * PIXEL_SIZE}" y="${r * PIXEL_SIZE}" width="${PIXEL_SIZE}" height="${PIXEL_SIZE}" fill="#dc2626" />`);
    });

    // Draw blush
    blushPositions.forEach(([r, c]) => {
      rects.push(`<rect x="${c * PIXEL_SIZE}" y="${r * PIXEL_SIZE}" width="${PIXEL_SIZE}" height="${PIXEL_SIZE}" fill="#f87171" opacity="0.6" />`);
    });

    // Draw hair
    const stylePixels = hairStyles[hairStyleIdx] || hairStyles[0];
    stylePixels.forEach(([r, c]) => {
      rects.push(`<rect x="${c * PIXEL_SIZE}" y="${r * PIXEL_SIZE}" width="${PIXEL_SIZE}" height="${PIXEL_SIZE}" fill="${hairColor}" />`);
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">\n  ${rects.join("\n  ")}\n</svg>`;
  }

  /**
   * Produce random options for background, skin tone, hair color, and style.
   */
  function generateRandomOptions() {
    const bgColors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];
    const skinColors = ["#ffdbac", "#f1c27d", "#e0ac69", "#c68642", "#8d5524"];
    const hairColors = ["#000000", "#4a3728", "#b55239", "#e6cea8", "#808080", "#a855f7"];

    return {
      bgColor: bgColors[Math.floor(Math.random() * bgColors.length)],
      skinColor: skinColors[Math.floor(Math.random() * skinColors.length)],
      hairColor: hairColors[Math.floor(Math.random() * hairColors.length)],
      hairStyle: Math.floor(Math.random() * hairStyles.length),
    };
  }

  function validateSVG(content, size, mimeType, fileName, maxSize = 100 * 1024) {
    if (size > maxSize) {
      throw new Error("SVG file size exceeds the maximum limit of 100 KB.");
    }

    if (fileName) {
      const ext = fileName.split(".").pop().toLowerCase();
      if (ext !== "svg") {
        throw new Error("Unsupported file extension. Only .svg files are allowed.");
      }
    }

    if (mimeType && mimeType !== "image/svg+xml") {
      throw new Error("Unsupported file MIME type. Only image/svg+xml is allowed.");
    }

    if (!content || content.trim() === "") {
      throw new Error("SVG content is empty.");
    }

    if (typeof DOMParser !== "undefined") {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "image/svg+xml");
      const parserError = doc.querySelector("parsererror");
      if (parserError) {
        throw new Error("Malformed SVG content.");
      }
      if (doc.documentElement.nodeName.toLowerCase() !== "svg") {
        throw new Error("Uploaded file is not a valid SVG.");
      }
    } else {
      const trimmed = content.trim();
      const cleanContent = trimmed
        .replace(/^<\?xml[^>]*\?>/i, "")
        .replace(/^<!--[\s\S]*?-->/i, "")
        .trim();

      if (!cleanContent.toLowerCase().startsWith("<svg") || !cleanContent.toLowerCase().endsWith("</svg>")) {
        throw new Error("Uploaded file is not a valid SVG.");
      }

      const openBrackets = (cleanContent.match(/</g) || []).length;
      const closeBrackets = (cleanContent.match(/>/g) || []).length;
      if (openBrackets !== closeBrackets) {
        throw new Error("Malformed SVG content.");
      }
    }

    return true;
  }

  return {
    GRID_SIZE,
    CANVAS_SIZE,
    PIXEL_SIZE,
    generateAvatarSVG,
    generateRandomOptions,
    validateSVG,
  };
});
