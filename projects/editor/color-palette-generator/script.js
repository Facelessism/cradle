/**
 * Color Palette Generator — script.js
 * Perceptual OKLCH color math, harmony engine, WCAG contrast checking,
 * N x N contrast matrix, multi-format export, and interactive UI.
 */

/* ------------------------------------------------------------------ */
/*  Pure Color Utility Functions (Exportable for Unit Testing)         */
/* ------------------------------------------------------------------ */

/** Parse hex to { r, g, b } 0-255 */
function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") return { r: 0, g: 0, b: 0 };
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16) || 0,
      g: parseInt(h[1] + h[1], 16) || 0,
      b: parseInt(h[2] + h[2], 16) || 0,
    };
  }
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

/** RGB to hex */
function rgbToHex(r, g, b) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(Number(v) || 0)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map(v => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

/** RGB to HSL  { h: 0-360, s: 0-100, l: 0-100 } */
function rgbToHsl(r, g, b) {
  r = Math.max(0, Math.min(255, Number(r) || 0)) / 255;
  g = Math.max(0, Math.min(255, Number(g) || 0)) / 255;
  b = Math.max(0, Math.min(255, Number(b) || 0)) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/** HSL to RGB */
function hslToRgb(h, s, l) {
  h = (((Number(h) || 0) % 360) + 360) % 360;
  h /= 360;
  s = Math.max(0, Math.min(100, Number(s) || 0)) / 100;
  l = Math.max(0, Math.min(100, Number(l) || 0)) / 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/* ------------------------------------------------------------------ */
/*  OKLCH Perceptual Color Math                                       */
/* ------------------------------------------------------------------ */

/** Convert sRGB 0-255 to linear sRGB 0.0-1.0 */
function srgbToLinear(c) {
  const v = Math.max(0, Math.min(255, Number(c) || 0)) / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Convert linear sRGB 0.0-1.0 to sRGB 0-255 */
function linearToSrgb(c) {
  const v =
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

/**
 * Convert sRGB (0-255) to OKLCH.
 * Returns { l: 0..1, c: 0..~0.4, h: 0..360 }
 */
function rgbToOklch(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bVal = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(a * a + bVal * bVal);
  let h = (Math.atan2(bVal, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  if (C < 1e-5) h = 0;

  return {
    l: Math.max(0, Math.min(1, L)),
    c: Math.max(0, C),
    h: h % 360,
  };
}

/**
 * Convert OKLCH to sRGB (0-255).
 * @param {number} l - Lightness (0..1)
 * @param {number} c - Chroma (0..~0.4)
 * @param {number} h - Hue in degrees (0..360)
 * @returns {{ r: number, g: number, b: number }}
 */
function oklchToRgb(l, c, h) {
  const hRad = ((Number(h) || 0) * Math.PI) / 180;
  const a = (Number(c) || 0) * Math.cos(hRad);
  const bVal = (Number(c) || 0) * Math.sin(hRad);
  const L = Number(l) || 0;

  const l_ = L + 0.3963377774 * a + 0.2158037573 * bVal;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bVal;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * bVal;

  const lCube = l_ * l_ * l_;
  const mCube = m_ * m_ * m_;
  const sCube = s_ * s_ * s_;

  const rLin = +4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube;
  const gLin = -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube;
  const bLin = -0.0041960863 * lCube - 0.7034186147 * mCube + 1.7076147010 * sCube;

  return {
    r: linearToSrgb(rLin),
    g: linearToSrgb(gLin),
    b: linearToSrgb(bLin),
  };
}

/** Parse hex to OKLCH { l, c, h } */
function hexToOklch(hex) {
  const rgb = hexToRgb(hex);
  return rgbToOklch(rgb.r, rgb.g, rgb.b);
}

/** OKLCH to hex string */
function oklchToHex(l, c, h) {
  const rgb = oklchToRgb(l, c, h);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/** Formats OKLCH as a CSS color string, e.g. "oklch(76.2% 0.124 228.5)" */
function formatOklch(l, c, h) {
  const lPct = (Math.max(0, Math.min(1, l)) * 100).toFixed(1);
  const cVal = Math.max(0, c).toFixed(3);
  const hVal = (((Number(h) || 0) % 360) + 360) % 360;
  return `oklch(${lPct}% ${cVal} ${hVal.toFixed(1)})`;
}

/** Relative luminance for WCAG 2.x */
function luminance(r, g, b) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

/** Contrast ratio between two hex colors */
function contrastRatio(hex1, hex2) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  const l1 = luminance(c1.r, c1.g, c1.b);
  const l2 = luminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Random hex color */
function randomHex() {
  return (
    "#" +
    Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")
  );
}

/**
 * Resolves the current hex value for a swatch element or copy button.
 * Reads directly from data-hex or from currentPalette[index] to avoid stale closure references.
 *
 * @param {HTMLElement|Object} target - The clicked button or swatch element/dataset
 * @param {Array<string>} currentPalette - The currently active palette array
 * @returns {string} The active hex code formatted with uppercase (e.g. "#38BDF8")
 */
function resolveSwatchHex(target, currentPalette = []) {
  if (!target) return "";
  const hex =
    (target.dataset && target.dataset.hex) ||
    (target.getAttribute && target.getAttribute("data-hex")) ||
    "";
  if (hex) return hex.toUpperCase();

  const idx =
    target.dataset && target.dataset.index !== undefined
      ? parseInt(target.dataset.index, 10)
      : -1;
  if (idx >= 0 && currentPalette && currentPalette[idx]) {
    return currentPalette[idx].toUpperCase();
  }
  return "";
}

/**
 * Generates an array of harmonic colors using the perceptual OKLCH color space.
 * Preserves uniform perceived lightness and chroma transitions across hues.
 *
 * @param {string} hex - Base hex color
 * @param {string} mode - Harmony mode
 * @returns {Array<string>} Array of 5 hex color strings
 */
function generateOklchPalette(hex, mode) {
  const ok = hexToOklch(hex);
  const { l, c, h } = ok;
  const colors = [];

  const wrapHue = angle => ((angle % 360) + 360) % 360;

  switch (mode) {
    case "analogous":
      // Sweeps hue with uniform perceptual lightness and chroma
      for (let i = -2; i <= 2; i++) {
        if (i === 0) {
          colors.push(hex.toLowerCase());
        } else {
          colors.push(oklchToHex(l, c, wrapHue(h + i * 30)).toLowerCase());
        }
      }
      break;

    case "monochromatic": {
      // Perceptually uniform lightness scale with gamut-adapted chroma
      const lSteps = [
        Math.max(0.12, l - 0.28),
        Math.max(0.22, l - 0.14),
        l,
        Math.min(0.86, l + 0.14),
        Math.min(0.96, l + 0.28),
      ];
      lSteps.forEach((stepL, idx) => {
        if (idx === 2) {
          colors.push(hex.toLowerCase());
        } else {
          // Adjust chroma slightly at extreme tints/shades to avoid out-of-gamut clipping
          const chromaFactor = Math.max(0.4, 1 - Math.abs(stepL - l) * 0.9);
          colors.push(oklchToHex(stepL, c * chromaFactor, h).toLowerCase());
        }
      });
      break;
    }

    case "triadic":
      // 120° equilateral distribution with perceptual balance
      colors.push(hex.toLowerCase());
      colors.push(oklchToHex(l, c, wrapHue(h + 120)).toLowerCase());
      colors.push(oklchToHex(l, c, wrapHue(h + 240)).toLowerCase());
      // Accent 1: Soft tint of triad 1
      colors.push(
        oklchToHex(Math.min(0.9, l + 0.16), c * 0.75, wrapHue(h + 120)).toLowerCase()
      );
      // Accent 2: Rich shade of triad 2
      colors.push(
        oklchToHex(Math.max(0.2, l - 0.2), c * 0.85, wrapHue(h + 240)).toLowerCase()
      );
      break;

    case "tetradic":
      // Square 90° distribution in OKLCH
      colors.push(hex.toLowerCase());
      colors.push(oklchToHex(l, c, wrapHue(h + 90)).toLowerCase());
      colors.push(oklchToHex(l, c, wrapHue(h + 180)).toLowerCase());
      colors.push(oklchToHex(l, c, wrapHue(h + 270)).toLowerCase());
      // Complementary highlight
      colors.push(
        oklchToHex(Math.min(0.92, l + 0.14), c * 0.7, wrapHue(h + 45)).toLowerCase()
      );
      break;

    case "split-complementary":
      // Base + hues at 150° and 210°
      colors.push(hex.toLowerCase());
      colors.push(oklchToHex(l, c, wrapHue(h + 150)).toLowerCase());
      colors.push(oklchToHex(l, c, wrapHue(h + 210)).toLowerCase());
      // Soft tint of split 1
      colors.push(
        oklchToHex(Math.min(0.9, l + 0.16), c * 0.7, wrapHue(h + 150)).toLowerCase()
      );
      // Soft tint of split 2
      colors.push(
        oklchToHex(Math.min(0.9, l + 0.16), c * 0.7, wrapHue(h + 210)).toLowerCase()
      );
      break;

    case "complementary":
    default:
      colors.push(hex.toLowerCase());
      colors.push(oklchToHex(l, c, wrapHue(h + 180)).toLowerCase());
      // Soft tint of base
      colors.push(oklchToHex(Math.min(0.9, l + 0.16), c * 0.65, h).toLowerCase());
      // Soft tint of complement
      colors.push(
        oklchToHex(Math.min(0.9, l + 0.16), c * 0.65, wrapHue(h + 180)).toLowerCase()
      );
      // Deep shade of base
      colors.push(oklchToHex(Math.max(0.18, l - 0.22), c * 0.9, h).toLowerCase());
      break;
  }

  return colors;
}

/**
 * Legacy HSL-based palette generation for backward compatibility.
 *
 * @param {string} hex - Base hex color
 * @param {string} mode - Harmony mode
 * @returns {Array<string>} Array of 5 hex color strings
 */
function generateHslPalette(hex, mode) {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const colors = [];

  const hslToHex = (h, s, l) => {
    h = ((h % 360) + 360) % 360;
    const c = hslToRgb(h, s, l);
    return rgbToHex(c.r, c.g, c.b).toLowerCase();
  };

  switch (mode) {
    case "complementary":
      colors.push(hex.toLowerCase());
      colors.push(hslToHex(hsl.h + 180, hsl.s, hsl.l));
      colors.push(
        hslToHex(hsl.h, Math.max(hsl.s - 20, 10), Math.min(hsl.l + 20, 90))
      );
      colors.push(
        hslToHex(
          hsl.h + 180,
          Math.max(hsl.s - 20, 10),
          Math.min(hsl.l + 20, 90)
        )
      );
      colors.push(hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 25, 10)));
      break;

    case "analogous":
      for (let i = -2; i <= 2; i++) {
        colors.push(hslToHex(hsl.h + i * 30, hsl.s, hsl.l));
      }
      break;

    case "triadic":
      colors.push(hex.toLowerCase());
      colors.push(hslToHex(hsl.h + 120, hsl.s, hsl.l));
      colors.push(hslToHex(hsl.h + 240, hsl.s, hsl.l));
      colors.push(
        hslToHex(
          hsl.h + 120,
          Math.max(hsl.s - 15, 10),
          Math.min(hsl.l + 15, 90)
        )
      );
      colors.push(
        hslToHex(
          hsl.h + 240,
          Math.max(hsl.s - 15, 10),
          Math.min(hsl.l + 15, 90)
        )
      );
      break;

    case "split-complementary":
      colors.push(hex.toLowerCase());
      colors.push(hslToHex(hsl.h + 150, hsl.s, hsl.l));
      colors.push(hslToHex(hsl.h + 210, hsl.s, hsl.l));
      colors.push(
        hslToHex(
          hsl.h + 150,
          Math.max(hsl.s - 20, 10),
          Math.min(hsl.l + 20, 90)
        )
      );
      colors.push(
        hslToHex(
          hsl.h + 210,
          Math.max(hsl.s - 20, 10),
          Math.min(hsl.l + 20, 90)
        )
      );
      break;

    case "tetradic":
      colors.push(hex.toLowerCase());
      colors.push(hslToHex(hsl.h + 90, hsl.s, hsl.l));
      colors.push(hslToHex(hsl.h + 180, hsl.s, hsl.l));
      colors.push(hslToHex(hsl.h + 270, hsl.s, hsl.l));
      colors.push(
        hslToHex(hsl.h + 45, Math.max(hsl.s - 20, 10), Math.min(hsl.l + 15, 90))
      );
      break;

    case "monochromatic":
      colors.push(hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 30, 8)));
      colors.push(hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 15, 12)));
      colors.push(hex.toLowerCase());
      colors.push(hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 15, 88)));
      colors.push(hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 30, 92)));
      break;

    default:
      colors.push(hex.toLowerCase());
  }

  return colors;
}

/**
 * Generates an array of harmonic colors based on harmony mode and color engine.
 *
 * @param {string} hex - Base hex color
 * @param {string} mode - Harmony mode
 * @param {string} [engine="oklch"] - "oklch" (perceptual) or "hsl" (standard)
 * @returns {Array<string>} Array of 5 hex color strings
 */
function generatePalette(hex, mode, engine = "oklch") {
  if (engine === "hsl") {
    return generateHslPalette(hex, mode);
  }
  return generateOklchPalette(hex, mode);
}

/**
 * Computes an N x N contrast matrix for all palette pairings.
 * Evaluates WCAG 2.1 AA / AAA compliance for every background x foreground combination.
 *
 * @param {Array<string>} palette - Array of hex colors
 * @returns {Object} Matrix data with rows, pairs, readable count, and total
 */
function computeContrastMatrix(palette) {
  if (!Array.isArray(palette)) {
    return { colors: [], matrix: [], readableCount: 0, totalPairs: 0 };
  }
  const n = palette.length;
  const matrix = [];
  let readableCount = 0;
  let totalPairs = 0;

  for (let i = 0; i < n; i++) {
    const row = [];
    const bg = palette[i];
    for (let j = 0; j < n; j++) {
      const fg = palette[j];
      const ratio = contrastRatio(bg, fg);
      const aaLarge = ratio >= 3.0;
      const aa = ratio >= 4.5;
      const aaa = ratio >= 7.0;

      let status = "Fail";
      if (aaa) status = "AAA";
      else if (aa) status = "AA";
      else if (aaLarge) status = "AA Large";

      if (i !== j) {
        totalPairs++;
        if (aaLarge) readableCount++;
      }

      row.push({
        bg,
        fg,
        bgIndex: i,
        fgIndex: j,
        ratio: Number(ratio.toFixed(2)),
        formattedRatio: `${ratio.toFixed(2)}:1`,
        aaa,
        aa,
        aaLarge,
        status,
        isSelf: i === j,
      });
    }
    matrix.push(row);
  }

  return {
    colors: palette,
    matrix,
    readableCount,
    totalPairs,
  };
}

/**
 * Formats a palette array into export code according to format.
 * Supports CSS Custom Properties (:root), Tailwind CSS, Figma Design Tokens JSON,
 * full JSON color object, and SCSS variables.
 *
 * @param {Array<string>} palette - Colors in palette
 * @param {string} format - "css" | "tailwind" | "figma" | "json" | "scss"
 * @returns {string} Formatted code string
 */
function formatExport(palette, format) {
  const names = palette.map((_, i) => `color-${i + 1}`);

  switch (format) {
    case "css": {
      let code = ":root {\n";
      palette.forEach((c, i) => {
        const ok = hexToOklch(c);
        code += `  --${names[i]}: ${c};\n`;
        code += `  --${names[i]}-oklch: ${formatOklch(ok.l, ok.c, ok.h)};\n`;
      });
      code += "}";
      return code;
    }

    case "tailwind": {
      let code = `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        palette: {\n`;
      palette.forEach((c, i) => {
        code += `          '${(i + 1) * 100}': '${c}',\n`;
      });
      code += `        },\n      },\n    },\n  },\n};`;
      return code;
    }

    case "figma": {
      const tokens = {
        color: {
          palette: {},
        },
      };
      palette.forEach((c, i) => {
        const ok = hexToOklch(c);
        tokens.color.palette[names[i]] = {
          $value: c.toUpperCase(),
          $type: "color",
          $description: `OKLCH Lightness: ${(ok.l * 100).toFixed(1)}%, Chroma: ${ok.c.toFixed(3)}, Hue: ${ok.h.toFixed(1)}°`,
        };
      });
      return JSON.stringify(tokens, null, 2);
    }

    case "json": {
      const obj = {};
      palette.forEach((c, i) => {
        const rgb = hexToRgb(c);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const ok = hexToOklch(c);
        obj[names[i]] = {
          hex: c,
          rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
          hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
          oklch: formatOklch(ok.l, ok.c, ok.h),
        };
      });
      return JSON.stringify(obj, null, 2);
    }

    case "scss": {
      let code = "";
      palette.forEach((c, i) => {
        code += `$${names[i]}: ${c};\n`;
      });
      code += "\n$palette: (\n";
      palette.forEach((c, i) => {
        code += `  '${names[i]}': $${names[i]}${i < palette.length - 1 ? "," : ""}\n`;
      });
      code += ");";
      return code;
    }

    default:
      return "";
  }
}

/* ------------------------------------------------------------------ */
/*  Browser DOM Controller                                             */
/* ------------------------------------------------------------------ */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    /* ── DOM References ── */
    const baseColorInput = document.getElementById("baseColor");
    const hexInput = document.getElementById("hexInput");
    const randomBtn = document.getElementById("randomBtn");
    const engineButtons = document.querySelectorAll(".btn-engine");
    const harmonyButtons = document.querySelectorAll(".btn-harmony");
    const paletteGrid = document.getElementById("paletteGrid");
    const regenerateBtn = document.getElementById("regenerateBtn");
    const contrastBg = document.getElementById("contrastBg");
    const contrastFg = document.getElementById("contrastFg");
    const useFromPaletteBtn = document.getElementById("useFromPalette");
    const contrastResults = document.getElementById("contrastResults");
    const contrastPreview = document.getElementById("contrastPreview");
    const contrastMatrixTable = document.getElementById("contrastMatrixTable");
    const matrixSummary = document.getElementById("matrixSummary");
    const exportTabs = document.querySelectorAll(".btn-tab");
    const exportCode = document.getElementById("exportCode");
    const copyExport = document.getElementById("copyExport");

    /* ── State ── */
    let currentHex = "#38bdf8";
    let currentMode = "complementary";
    let currentEngine = "oklch";
    let currentFormat = "css";
    let palette = [];
    let lockedIndices = new Set();
    let contrastUseMode = "fg"; // toggles between fg and bg when clicking palette swatch
    let selectedMatrixCell = null;

    /* ── Toast ── */
    let toastEl = null;
    function showToast(msg) {
      if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.className = "toast";
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = msg;
      toastEl.classList.add("visible");
      clearTimeout(toastEl._timer);
      toastEl._timer = setTimeout(
        () => toastEl.classList.remove("visible"),
        1800
      );
    }

    /* ── Clipboard Copy Helper ── */
    async function copySwatchHex(hex, btn) {
      if (!hex) return false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(hex);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = hex;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }

        if (btn) {
          btn.classList.add("copied");
          btn.textContent = "✓ Copied";
          setTimeout(() => {
            btn.classList.remove("copied");
            btn.textContent = "Copy HEX";
          }, 1500);
        }
        showToast(`Copied ${hex} to clipboard!`);
        return true;
      } catch {
        showToast("Failed to copy — try selecting manually");
        return false;
      }
    }

    /* ── Render Palette ── */
    function renderPalette() {
      const newColors = generatePalette(currentHex, currentMode, currentEngine);
      // Merge locked colors
      palette = newColors.map((c, i) => {
        if (lockedIndices.has(i) && palette[i]) return palette[i];
        return c;
      });

      paletteGrid.innerHTML = palette
        .map((color, idx) => {
          const rgb = hexToRgb(color);
          const ok = hexToOklch(color);
          const isLocked = lockedIndices.has(idx);
          const displayHex = color.toUpperCase();
          const displayOklch = formatOklch(ok.l, ok.c, ok.h);
          return `
            <div class="swatch" data-index="${idx}" data-hex="${displayHex}">
              <div class="swatch-color" style="background:${color}">
                <button class="swatch-lock ${isLocked ? "locked" : ""}"
                        data-index="${idx}"
                        title="${isLocked ? "Unlock" : "Lock"} color"
                        aria-label="${isLocked ? "Unlock" : "Lock"} color ${displayHex}">
                  ${isLocked ? "🔒" : "🔓"}
                </button>
              </div>
              <div class="swatch-info">
                <div class="swatch-hex">${displayHex}</div>
                <div class="swatch-oklch" title="OKLCH: ${displayOklch}">${displayOklch}</div>
                <div class="swatch-rgb">rgb(${rgb.r}, ${rgb.g}, ${rgb.b})</div>
                <button class="btn btn-copy-hex swatch-copy-btn"
                        data-index="${idx}"
                        data-hex="${displayHex}"
                        title="Copy HEX ${displayHex}"
                        aria-label="Copy HEX ${displayHex}">
                  Copy HEX
                </button>
              </div>
            </div>`;
        })
        .join("");

      renderContrastMatrix();
      updateExport();
    }

    /* ── Render N x N Contrast Matrix ── */
    function renderContrastMatrix() {
      if (!contrastMatrixTable) return;
      const matrixData = computeContrastMatrix(palette);
      const { colors, matrix, readableCount, totalPairs } = matrixData;

      if (matrixSummary) {
        matrixSummary.innerHTML = `
          <span class="matrix-count-badge">
            <strong>${readableCount}</strong> / ${totalPairs} pairings pass WCAG 2.1 AA/AAA
          </span>`;
      }

      // Build header row (Foreground / Columns)
      let tableHtml = "<thead><tr>";
      tableHtml += `<th class="matrix-th-corner" scope="col"><span class="matrix-label-bg">BG ↓</span> / <span class="matrix-label-fg">FG →</span></th>`;
      colors.forEach((colColor, j) => {
        const ok = hexToOklch(colColor);
        tableHtml += `
          <th scope="col" class="matrix-th-col" title="Foreground: ${colColor.toUpperCase()} (${formatOklch(ok.l, ok.c, ok.h)})">
            <span class="matrix-header-swatch" style="background:${colColor};"></span>
            <span class="matrix-header-title">C${j + 1}</span>
            <span class="matrix-header-hex">${colColor.toUpperCase()}</span>
          </th>`;
      });
      tableHtml += "</tr></thead><tbody>";

      // Build data rows (Background / Rows)
      matrix.forEach((row, i) => {
        const rowColor = colors[i];
        const ok = hexToOklch(rowColor);
        tableHtml += "<tr>";
        tableHtml += `
          <th scope="row" class="matrix-th-row" title="Background: ${rowColor.toUpperCase()} (${formatOklch(ok.l, ok.c, ok.h)})">
            <span class="matrix-header-swatch" style="background:${rowColor};"></span>
            <span class="matrix-header-title">C${i + 1}</span>
            <span class="matrix-header-hex">${rowColor.toUpperCase()}</span>
          </th>`;

        row.forEach((cell, j) => {
          let badgeClass = "badge-fail";
          if (cell.aaa) badgeClass = "badge-aaa";
          else if (cell.aa) badgeClass = "badge-aa";
          else if (cell.aaLarge) badgeClass = "badge-large";

          const isSelected =
            selectedMatrixCell &&
            selectedMatrixCell.bgIndex === i &&
            selectedMatrixCell.fgIndex === j;

          tableHtml += `
            <td class="matrix-cell ${cell.isSelf ? "matrix-cell-self" : ""} ${isSelected ? "active-pair" : ""}"
                data-bg="${cell.bg}"
                data-fg="${cell.fg}"
                data-bg-idx="${i}"
                data-fg-idx="${j}"
                data-ratio="${cell.ratio}"
                tabindex="0"
                role="button"
                aria-label="Background C${i + 1} ${cell.bg.toUpperCase()}, Foreground C${j + 1} ${cell.fg.toUpperCase()}: ${cell.formattedRatio} contrast, rating ${cell.status}">
              <div class="matrix-cell-inner" style="background:${cell.bg}; color:${cell.fg};">
                <span class="matrix-cell-ratio">${cell.formattedRatio}</span>
                <span class="badge ${badgeClass}">${cell.status}</span>
              </div>
            </td>`;
        });
        tableHtml += "</tr>";
      });
      tableHtml += "</tbody>";

      contrastMatrixTable.innerHTML = tableHtml;
    }

    /* ── Matrix Table Click Event Delegation ── */
    if (contrastMatrixTable) {
      const handleCellSelection = targetCell => {
        if (!targetCell) return;
        const bg = targetCell.dataset.bg;
        const fg = targetCell.dataset.fg;
        const bgIdx = parseInt(targetCell.dataset.bgIdx, 10);
        const fgIdx = parseInt(targetCell.dataset.fgIdx, 10);
        if (!bg || !fg) return;

        selectedMatrixCell = { bgIndex: bgIdx, fgIndex: fgIdx };

        // Highlight active cell in table
        contrastMatrixTable.querySelectorAll(".matrix-cell").forEach(c => {
          c.classList.remove("active-pair");
        });
        targetCell.classList.add("active-pair");

        // Apply to contrast checker and preview
        contrastBg.value = bg;
        contrastFg.value = fg;
        runContrastCheck();

        showToast(
          `Matrix Pair: BG ${bg.toUpperCase()} & FG ${fg.toUpperCase()} (${targetCell.dataset.ratio}:1)`
        );
      };

      contrastMatrixTable.addEventListener("click", e => {
        const cell = e.target.closest(".matrix-cell");
        if (cell) handleCellSelection(cell);
      });

      contrastMatrixTable.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          const cell = e.target.closest(".matrix-cell");
          if (cell) {
            e.preventDefault();
            handleCellSelection(cell);
          }
        }
      });
    }

    /* ── Palette Grid Event Delegation (Stale-Closure Immune) ── */
    paletteGrid.addEventListener("click", e => {
      // 1. Copy HEX button clicked
      const copyBtn = e.target.closest(".swatch-copy-btn, .btn-copy-hex");
      if (copyBtn) {
        e.stopPropagation();
        const swatch = copyBtn.closest(".swatch");
        const hex =
          resolveSwatchHex(copyBtn, palette) ||
          (swatch ? resolveSwatchHex(swatch, palette) : "");
        copySwatchHex(hex, copyBtn);
        return;
      }

      // 2. Lock button clicked
      const lockBtn = e.target.closest(".swatch-lock");
      if (lockBtn) {
        e.stopPropagation();
        const idx = parseInt(lockBtn.dataset.index, 10);
        if (lockedIndices.has(idx)) lockedIndices.delete(idx);
        else lockedIndices.add(idx);
        renderPalette();
        return;
      }

      // 3. Click swatch body to load into contrast checker
      const swatch = e.target.closest(".swatch");
      if (swatch) {
        const idx = parseInt(swatch.dataset.index, 10);
        const color = palette[idx] || resolveSwatchHex(swatch, palette);
        if (contrastUseMode === "fg") {
          contrastFg.value = color;
          contrastUseMode = "bg";
        } else {
          contrastBg.value = color;
          contrastUseMode = "fg";
        }
        runContrastCheck();
        showToast(
          `Applied ${color.toUpperCase()} as ${contrastUseMode === "fg" ? "background" : "foreground"}`
        );
      }
    });

    /* ── Contrast Checker ── */
    function runContrastCheck() {
      const bg = contrastBg.value;
      const fg = contrastFg.value;
      const ratio = contrastRatio(bg, fg);

      const aaLarge = ratio >= 3;
      const aa = ratio >= 4.5;
      const aaa = ratio >= 7;

      contrastResults.innerHTML = `
        <div class="contrast-ratio">${ratio.toFixed(2)}:1</div>
        <div class="contrast-badges">
          <span class="${aa ? "badge-pass" : "badge-fail"}">AA Normal ${aa ? "✓" : "✗"}</span>
          <span class="${aaLarge ? "badge-pass" : "badge-fail"}">AA Large ${aaLarge ? "✓" : "✗"}</span>
          <span class="${aaa ? "badge-pass" : "badge-fail"}">AAA ${aaa ? "✓" : "✗"}</span>
        </div>`;

      contrastPreview.style.background = bg;
      contrastPreview.style.color = fg;
    }

    /* ── Export Generation ── */
    function updateExport() {
      exportCode.textContent = formatExport(palette, currentFormat);
    }

    /* ── Event Bindings ── */

    // Base color picker
    baseColorInput.addEventListener("input", e => {
      currentHex = e.target.value;
      hexInput.value = currentHex.replace("#", "");
      renderPalette();
    });

    // Hex text input
    hexInput.addEventListener("input", e => {
      let val = e.target.value.replace(/[^0-9a-fA-F]/g, "").substring(0, 6);
      e.target.value = val;
      if (val.length === 6) {
        currentHex = "#" + val;
        baseColorInput.value = currentHex;
        renderPalette();
      }
    });

    // Random button
    randomBtn.addEventListener("click", () => {
      currentHex = randomHex();
      baseColorInput.value = currentHex;
      hexInput.value = currentHex.replace("#", "");
      renderPalette();
      showToast("Random palette generated!");
    });

    // Engine toggle buttons (OKLCH vs HSL)
    engineButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        engineButtons.forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
        currentEngine = btn.dataset.engine || "oklch";
        lockedIndices.clear();
        renderPalette();
        showToast(
          `Switched engine to ${currentEngine === "oklch" ? "Perceptual OKLCH" : "Standard HSL"}`
        );
      });
    });

    // Harmony mode buttons
    harmonyButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        harmonyButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentMode = btn.dataset.mode;
        lockedIndices.clear();
        renderPalette();
      });
    });

    // Generate New Palette / Regenerate
    regenerateBtn.addEventListener("click", () => {
      lockedIndices.clear();
      renderPalette();
      showToast("Palette regenerated!");
    });

    // Contrast checker inputs
    contrastBg.addEventListener("input", runContrastCheck);
    contrastFg.addEventListener("input", runContrastCheck);

    useFromPaletteBtn.addEventListener("click", () => {
      if (palette.length >= 2) {
        contrastBg.value = palette[0];
        contrastFg.value = palette[1];
        runContrastCheck();
        showToast("Loaded first two palette colors");
      }
    });

    // Export format tabs
    exportTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        exportTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentFormat = tab.dataset.format;
        updateExport();
      });
    });

    // Copy full export code
    copyExport.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(exportCode.textContent);
        copyExport.classList.add("copied");
        copyExport.textContent = "✓ Copied";
        showToast("Copied to clipboard!");
        setTimeout(() => {
          copyExport.classList.remove("copied");
          copyExport.textContent = "📋 Copy";
        }, 2000);
      } catch {
        showToast("Failed to copy — try selecting manually");
      }
    });

    /* ── Init ── */
    renderPalette();
    runContrastCheck();
  });
}

/* ------------------------------------------------------------------ */
/*  Node.js CommonJS Exports for Testing                               */
/* ------------------------------------------------------------------ */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    hexToRgb,
    rgbToHex,
    rgbToHsl,
    hslToRgb,
    srgbToLinear,
    linearToSrgb,
    rgbToOklch,
    oklchToRgb,
    hexToOklch,
    oklchToHex,
    formatOklch,
    luminance,
    contrastRatio,
    randomHex,
    generatePalette,
    generateOklchPalette,
    generateHslPalette,
    computeContrastMatrix,
    resolveSwatchHex,
    formatExport,
  };
}
