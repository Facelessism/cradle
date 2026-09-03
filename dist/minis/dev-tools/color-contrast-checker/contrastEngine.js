const ContrastEngine = (() => {
  const WCAG_THRESHOLDS = {
    normalAA: 4.5,
    normalAAA: 7,
    largeAA: 3,
    largeAAA: 4.5,
    uiAA: 3,
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
    const expanded = hex.length === 3
      ? hex.split("").map(char => char + char).join("")
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

  function findAccessibleVariant(foreground, background, targetRatio, direction) {
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

  function suggestAccessibleAlternatives(foreground, background, targetRatio = WCAG_THRESHOLDS.normalAA) {
    const current = calculateContrastRatio(foreground, background);
    if (current >= targetRatio) {
      return [];
    }

    const lighter = findAccessibleVariant(foreground, background, targetRatio, "lighter");
    const darker = findAccessibleVariant(foreground, background, targetRatio, "darker");

    return [lighter, darker]
      .filter(item => item.ratio >= targetRatio)
      .filter((item, index, list) =>
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
    return {
      valid: true,
      foreground: fg,
      background: bg,
      ratio,
      status: getWcagStatus(ratio),
      suggestions: suggestAccessibleAlternatives(fg, bg),
      cssVariables: getCssVariables(fg, bg),
    };
  }

  return {
    SAMPLE_PALETTES,
    WCAG_THRESHOLDS,
    calculateContrastRatio,
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
