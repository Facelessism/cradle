const ContrastEngine = (() => {
  const WCAG_THRESHOLDS = {
    normalAA: 4.5,
    normalAAA: 7,
    largeAA: 3,
    largeAAA: 4.5,
    uiAA: 3,
  };

  const APCA_THRESHOLDS = {
    fluentText: 90, // Preferred for fluent text reading (14-16px normal)
    bodyText: 75, // Minimum for standard body copy (16px normal, 14px bold)
    largeText: 60, // Minimum for 24px normal or 18px bold content
    headlineText: 45, // Minimum for 36px normal or 24px bold / large UI
    uiComponents: 30, // Minimum for icons, non-text, borders, disabled controls
  };

  // APCA G-4g reference constants (W3C WCAG 3 candidate algorithm)
  const APCA_CONSTANTS = {
    mainTRC: 2.4,
    sRco: 0.2126729,
    sGco: 0.7151522,
    sBco: 0.072175,
    normBG: 0.56,
    normTXT: 0.57,
    revTXT: 0.62,
    revBG: 0.65,
    blkThrs: 0.022,
    blkClmp: 1.414,
    scaleBoW: 1.14,
    scaleWoB: 1.14,
    loBoWoffset: 0.027,
    loWoBoffset: 0.027,
    loClip: 0.001,
    deltaYmin: 0.0005,
  };

  // Color Vision Deficiency (CVD) simulation matrices
  const CVD_TYPES = {
    normal: {
      id: "normal",
      label: "Normal Vision",
      shortLabel: "Normal",
      description: "Standard trichromatic color vision",
      matrix: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      svgFilter: "none",
    },
    protanopia: {
      id: "protanopia",
      label: "Protanopia",
      shortLabel: "Red-Blind",
      description: "L-cone deficiency / red-insensitivity (~1% males)",
      matrix: [
        [0.56667, 0.43333, 0.0],
        [0.55833, 0.44167, 0.0],
        [0.0, 0.24167, 0.75833],
      ],
      svgFilter: "url(#cvd-protanopia)",
    },
    deuteranopia: {
      id: "deuteranopia",
      label: "Deuteranopia",
      shortLabel: "Green-Blind",
      description: "M-cone deficiency / green-insensitivity (~5% males)",
      matrix: [
        [0.625, 0.375, 0.0],
        [0.7, 0.3, 0.0],
        [0.0, 0.3, 0.7],
      ],
      svgFilter: "url(#cvd-deuteranopia)",
    },
    tritanopia: {
      id: "tritanopia",
      label: "Tritanopia",
      shortLabel: "Blue-Blind",
      description: "S-cone deficiency / blue-insensitivity (rare, <0.1%)",
      matrix: [
        [0.95, 0.05, 0.0],
        [0.0, 0.43333, 0.56667],
        [0.0, 0.475, 0.525],
      ],
      svgFilter: "url(#cvd-tritanopia)",
    },
    achromatopsia: {
      id: "achromatopsia",
      label: "Achromatopsia",
      shortLabel: "Monochrome",
      description: "Total color blindness / luminance only (~0.003%)",
      matrix: [
        [0.299, 0.587, 0.114],
        [0.299, 0.587, 0.114],
        [0.299, 0.587, 0.114],
      ],
      svgFilter: "url(#cvd-achromatopsia)",
    },
  };

  const SAMPLE_PALETTES = [
    { name: "Cradle Dark", foreground: "#e2e8f0", background: "#020617" },
    { name: "Ocean CTA", foreground: "#ffffff", background: "#0f766e" },
    { name: "Warning Panel", foreground: "#451a03", background: "#facc15" },
    { name: "Soft Indigo", foreground: "#eef2ff", background: "#3730a3" },
    { name: "Slate Muted", foreground: "#94a3b8", background: "#0f172a" },
  ];

  function normalizeHex(input) {
    if (typeof input !== "string") return null;
    const value = input.trim();
    const match = value.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (!match) return null;

    const hex = match[1];
    const expanded =
      hex.length === 3
        ? hex
            .split("")
            .map(char => char + char)
            .join("")
        : hex;

    return `#${expanded.toLowerCase()}`;
  }

  function isValidHexColor(input) {
    return normalizeHex(input) !== null;
  }

  function hexToRgb(input) {
    const hex = normalizeHex(input);
    if (!hex) {
      throw new Error("Expected a 3 or 6 digit hex color.");
    }

    const value = hex.slice(1);
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  function channelToLinear(channel) {
    const srgb = channel / 255;
    return srgb <= 0.03928
      ? srgb / 12.92
      : Math.pow((srgb + 0.055) / 1.055, 2.4);
  }

  function getRelativeLuminance(input) {
    const { r, g, b } = hexToRgb(input);
    return (
      0.2126 * channelToLinear(r) +
      0.7152 * channelToLinear(g) +
      0.0722 * channelToLinear(b)
    );
  }

  function calculateContrastRatio(foreground, background) {
    const fg = getRelativeLuminance(foreground);
    const bg = getRelativeLuminance(background);
    const lighter = Math.max(fg, bg);
    const darker = Math.min(fg, bg);
    return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
  }

  function getWcagStatus(ratio) {
    return {
      normalAA: ratio >= WCAG_THRESHOLDS.normalAA,
      normalAAA: ratio >= WCAG_THRESHOLDS.normalAAA,
      largeAA: ratio >= WCAG_THRESHOLDS.largeAA,
      largeAAA: ratio >= WCAG_THRESHOLDS.largeAAA,
      uiAA: ratio >= WCAG_THRESHOLDS.uiAA,
    };
  }

  function clampChannel(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function rgbToHex({ r, g, b }) {
    return `#${[r, g, b]
      .map(channel => clampChannel(channel).toString(16).padStart(2, "0"))
      .join("")}`;
  }

  function mixColor(color, target, amount) {
    const rgb = hexToRgb(color);
    const targetRgb = hexToRgb(target);
    return rgbToHex({
      r: rgb.r + (targetRgb.r - rgb.r) * amount,
      g: rgb.g + (targetRgb.g - rgb.g) * amount,
      b: rgb.b + (targetRgb.b - rgb.b) * amount,
    });
  }

  function findAccessibleVariant(
    foreground,
    background,
    targetRatio,
    direction
  ) {
    const target = direction === "lighter" ? "#ffffff" : "#000000";
    for (let step = 1; step <= 20; step += 1) {
      const amount = step / 20;
      const candidate = mixColor(foreground, target, amount);
      const ratio = calculateContrastRatio(candidate, background);
      if (ratio >= targetRatio) {
        return { color: candidate, ratio, direction };
      }
    }

    const fallback = target;
    return {
      color: fallback,
      ratio: calculateContrastRatio(fallback, background),
      direction,
    };
  }

  function suggestAccessibleAlternatives(
    foreground,
    background,
    targetRatio = WCAG_THRESHOLDS.normalAA
  ) {
    const current = calculateContrastRatio(foreground, background);
    if (current >= targetRatio) {
      return [];
    }

    const lighter = findAccessibleVariant(
      foreground,
      background,
      targetRatio,
      "lighter"
    );
    const darker = findAccessibleVariant(
      foreground,
      background,
      targetRatio,
      "darker"
    );

    return [lighter, darker]
      .filter(item => item.ratio >= targetRatio)
      .filter(
        (item, index, list) =>
          list.findIndex(candidate => candidate.color === item.color) === index
      )
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 2);
  }

  function getCssVariables(foreground, background) {
    const fg = normalizeHex(foreground);
    const bg = normalizeHex(background);
    if (!fg || !bg) {
      throw new Error("Both colors must be valid hex values.");
    }

    return `:root {
  --contrast-foreground: ${fg};
  --contrast-background: ${bg};
}`;
  }

  // ─── APCA (Advanced Perceptual Contrast Algorithm) WCAG 3.0 ───────
  function sRGBtoY({ r, g, b }) {
    function exp(chan) {
      return Math.pow(chan / 255.0, APCA_CONSTANTS.mainTRC);
    }
    return (
      APCA_CONSTANTS.sRco * exp(r) +
      APCA_CONSTANTS.sGco * exp(g) +
      APCA_CONSTANTS.sBco * exp(b)
    );
  }

  function APCAcontrast(txtY, bgY) {
    let SAPC = 0.0;
    let outputContrast = 0.0;

    const ytxt =
      txtY >= APCA_CONSTANTS.blkThrs
        ? txtY
        : txtY + Math.pow(APCA_CONSTANTS.blkThrs - txtY, APCA_CONSTANTS.blkClmp);
    const ybg =
      bgY >= APCA_CONSTANTS.blkThrs
        ? bgY
        : bgY + Math.pow(APCA_CONSTANTS.blkThrs - bgY, APCA_CONSTANTS.blkClmp);

    if (Math.abs(ybg - ytxt) < APCA_CONSTANTS.deltaYmin) {
      return 0.0;
    }

    // Black on White (Dark text on light background) -> positive Lc
    if (ybg > ytxt) {
      SAPC =
        (Math.pow(ybg, APCA_CONSTANTS.normBG) -
          Math.pow(ytxt, APCA_CONSTANTS.normTXT)) *
        APCA_CONSTANTS.scaleBoW;
      outputContrast =
        SAPC < APCA_CONSTANTS.loClip ? 0.0 : SAPC - APCA_CONSTANTS.loBoWoffset;
    }
    // White on Black (Light text on dark background) -> negative Lc
    else {
      SAPC =
        (Math.pow(ybg, APCA_CONSTANTS.revBG) -
          Math.pow(ytxt, APCA_CONSTANTS.revTXT)) *
        APCA_CONSTANTS.scaleWoB;
      outputContrast =
        SAPC > -APCA_CONSTANTS.loClip ? 0.0 : SAPC + APCA_CONSTANTS.loWoBoffset;
    }

    return Number((outputContrast * 100.0).toFixed(1));
  }

  function calculateApca(foreground, background) {
    const fg = hexToRgb(foreground);
    const bg = hexToRgb(background);
    const txtY = sRGBtoY(fg);
    const bgY = sRGBtoY(bg);
    return APCAcontrast(txtY, bgY);
  }

  function getApcaStatus(lc) {
    const abs = Math.abs(lc);
    let rating = "Fail";
    let detail = "Insufficient contrast for readable text";

    if (abs >= APCA_THRESHOLDS.fluentText) {
      rating = "Preferred Body";
      detail = "Ideal for fluent body reading (300-400 weight, 14-16px)";
    } else if (abs >= APCA_THRESHOLDS.bodyText) {
      rating = "Minimum Body";
      detail = "Minimum for standard body copy (400 weight 16px, or 700 bold 14px)";
    } else if (abs >= APCA_THRESHOLDS.largeText) {
      rating = "Content Text";
      detail = "Acceptable for large content (400 weight 24px, or 700 bold 18px)";
    } else if (abs >= APCA_THRESHOLDS.headlineText) {
      rating = "Headings Only";
      detail = "Large display headlines (400 weight 36px, or 700 bold 24px)";
    } else if (abs >= APCA_THRESHOLDS.uiComponents) {
      rating = "Non-Text & Spot";
      detail = "Icons, non-text UI components, borders, and disabled controls";
    }

    return {
      score: lc,
      absScore: abs,
      polarity:
        lc > 0
          ? "Dark on Light (BoW)"
          : lc < 0
            ? "Light on Dark (WoB)"
            : "None",
      rating,
      detail,
      fluentText: abs >= APCA_THRESHOLDS.fluentText,
      bodyText: abs >= APCA_THRESHOLDS.bodyText,
      largeText: abs >= APCA_THRESHOLDS.largeText,
      headlineText: abs >= APCA_THRESHOLDS.headlineText,
      uiComponents: abs >= APCA_THRESHOLDS.uiComponents,
    };
  }

  // ─── CVD (Color Vision Deficiency) Simulation ──────────────────────
  function simulateCvd(hexColor, cvdType = "normal") {
    const norm = normalizeHex(hexColor);
    if (!norm) return null;
    const type = CVD_TYPES[cvdType] || CVD_TYPES.normal;
    if (cvdType === "normal") return norm;

    const rgb = hexToRgb(norm);
    const m = type.matrix;
    const r = m[0][0] * rgb.r + m[0][1] * rgb.g + m[0][2] * rgb.b;
    const g = m[1][0] * rgb.r + m[1][1] * rgb.g + m[1][2] * rgb.b;
    const b = m[2][0] * rgb.r + m[2][1] * rgb.g + m[2][2] * rgb.b;

    return rgbToHex({
      r: clampChannel(r),
      g: clampChannel(g),
      b: clampChannel(b),
    });
  }

  function getCvdSimulationReport(foreground, background) {
    const fg = normalizeHex(foreground);
    const bg = normalizeHex(background);
    if (!fg || !bg) return null;

    const results = {};
    for (const [key, type] of Object.entries(CVD_TYPES)) {
      const simFg = simulateCvd(fg, key);
      const simBg = simulateCvd(bg, key);
      const ratio = calculateContrastRatio(simFg, simBg);
      const apca = calculateApca(simFg, simBg);
      results[key] = {
        id: type.id,
        label: type.label,
        shortLabel: type.shortLabel,
        description: type.description,
        svgFilter: type.svgFilter,
        simulatedForeground: simFg,
        simulatedBackground: simBg,
        ratio,
        wcagStatus: getWcagStatus(ratio),
        apca,
        apcaStatus: getApcaStatus(apca),
      };
    }
    return results;
  }

  function getContrastReport(foreground, background) {
    const fg = normalizeHex(foreground);
    const bg = normalizeHex(background);

    if (!fg || !bg) {
      return {
        valid: false,
        error: "Enter valid 3 or 6 digit hex colors.",
      };
    }

    const ratio = calculateContrastRatio(fg, bg);
    const apca = calculateApca(fg, bg);
    const apcaStatus = getApcaStatus(apca);
    const cvd = getCvdSimulationReport(fg, bg);

    return {
      valid: true,
      foreground: fg,
      background: bg,
      ratio,
      status: getWcagStatus(ratio),
      apca,
      apcaStatus,
      cvd,
      suggestions: suggestAccessibleAlternatives(fg, bg),
      cssVariables: getCssVariables(fg, bg),
    };
  }

  return {
    SAMPLE_PALETTES,
    WCAG_THRESHOLDS,
    APCA_THRESHOLDS,
    APCA_CONSTANTS,
    CVD_TYPES,
    calculateContrastRatio,
    calculateApca,
    getApcaStatus,
    APCAcontrast,
    sRGBtoY,
    simulateCvd,
    getCvdSimulationReport,
    getContrastReport,
    getCssVariables,
    getRelativeLuminance,
    getWcagStatus,
    hexToRgb,
    isValidHexColor,
    normalizeHex,
    suggestAccessibleAlternatives,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = ContrastEngine;
}
