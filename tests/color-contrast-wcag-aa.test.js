const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function channelToLinear(c) {
  const srgb = c / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map(x => x + x)
      .join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function relativeLuminance(rgb) {
  return (
    0.2126 * channelToLinear(rgb.r) +
    0.7152 * channelToLinear(rgb.g) +
    0.0722 * channelToLinear(rgb.b)
  );
}

function contrastRatio(fgHex, bgHex) {
  const fg = relativeLuminance(hexToRgb(fgHex));
  const bg = relativeLuminance(hexToRgb(bgHex));
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

function alphaBlend(fgHex, alpha, bgHex) {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  return {
    r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
  };
}

function rgbToHex(rgb) {
  return (
    "#" +
    [rgb.r, rgb.g, rgb.b].map(x => x.toString(16).padStart(2, "0")).join("")
  );
}

const tokensCss = fs.readFileSync(
  path.join(__dirname, "../src/components/ui/tokens.css"),
  "utf8"
);
const styleCss = fs.readFileSync(path.join(__dirname, "../style.css"), "utf8");

test("Color tokens define WCAG AA compliant values in dark and light themes", () => {
  // Dark theme checks
  assert.match(
    tokensCss,
    /--cradle-accent-outline:\s*#60a5fa/,
    "Dark theme must define accessible outline blue #60a5fa"
  );
  assert.match(
    tokensCss,
    /--cradle-success:\s*#15803d/,
    "Dark theme success must meet AA contrast with white (#15803d)"
  );

  // Light theme checks
  assert.match(
    tokensCss,
    /--cradle-muted:\s*#475569/,
    "Light theme muted must meet AA contrast on light background (#475569)"
  );
  assert.match(
    tokensCss,
    /--cradle-highlight:\s*#1d4ed8/,
    "Light theme highlight must meet AA contrast on light badges (#1d4ed8)"
  );
  assert.match(
    tokensCss,
    /--cradle-warning:\s*#92400e/,
    "Light theme warning text must meet AA contrast (#92400e)"
  );
  assert.match(
    tokensCss,
    /--cradle-accent-outline:\s*#1d4ed8/,
    "Light theme outline must meet AA contrast (#1d4ed8)"
  );
});

test("Home page and shared component color pairings pass WCAG AA (>= 4.5:1) in Dark Theme", () => {
  const darkPairs = [
    { name: "Body text on background", fg: "#f3f4f6", bg: "#05070d" },
    { name: "Hero tagline on background", fg: "#cbd5e1", bg: "#05070d" },
    { name: "Section subtitle / project count", fg: "#9ca3af", bg: "#05070d" },
    { name: "Card title on surface", fg: "#f3f4f6", bg: "#111827" },
    {
      name: "Card subtitle / content on surface",
      fg: "#cbd5e1",
      bg: "#111827",
    },
    {
      name: "Card badge text on badge pill background",
      fg: "#93c5fd",
      bg: rgbToHex(alphaBlend("#2563eb", 0.15, "#111827")),
    },
    {
      name: "Card ribbon text on ribbon background",
      fg: "#f59e0b",
      bg: rgbToHex(alphaBlend("#f59e0b", 0.15, "#111827")),
    },
    { name: "Primary button (white on accent)", fg: "#ffffff", bg: "#1e3a8a" },
    {
      name: "Primary button (white on accentHover)",
      fg: "#ffffff",
      bg: "#2563eb",
    },
    { name: "Secondary button on surface2", fg: "#f3f4f6", bg: "#172033" },
    {
      name: "Outline button text on card surface",
      fg: "#60a5fa",
      bg: "#111827",
    },
    { name: "Ghost button on card surface", fg: "#f3f4f6", bg: "#111827" },
    { name: "Success button (white on green)", fg: "#ffffff", bg: "#15803d" },
    { name: "Danger button (white on red)", fg: "#ffffff", bg: "#dc2626" },
    { name: "Search placeholder on card", fg: "#9ca3af", bg: "#111827" },
    { name: "Footer text on background", fg: "#9ca3af", bg: "#05070d" },
    { name: "Footer link on background", fg: "#93c5fd", bg: "#05070d" },
    {
      name: "Recent card badge on card",
      fg: "#bfdbfe",
      bg: rgbToHex(alphaBlend("#0f172a", 0.72, "#111827")),
    },
  ];

  for (const pair of darkPairs) {
    const ratio = contrastRatio(pair.fg, pair.bg);
    assert.ok(
      ratio >= 4.5,
      `Dark theme ${pair.name} (${pair.fg} on ${pair.bg}) must be >= 4.5:1, got ${ratio}:1`
    );
  }
});

test("Home page and shared component color pairings pass WCAG AA (>= 4.5:1) in Light Theme", () => {
  const lightPairs = [
    { name: "Body text on background", fg: "#0f172a", bg: "#f5f7fb" },
    { name: "Hero tagline on background", fg: "#334155", bg: "#f5f7fb" },
    { name: "Section subtitle / project count", fg: "#475569", bg: "#f5f7fb" },
    { name: "Card title on surface", fg: "#0f172a", bg: "#ffffff" },
    {
      name: "Card subtitle / content on surface",
      fg: "#334155",
      bg: "#ffffff",
    },
    {
      name: "Card badge text on badge pill background",
      fg: "#1d4ed8",
      bg: rgbToHex(alphaBlend("#2563eb", 0.1, "#ffffff")),
    },
    {
      name: "Card ribbon text on ribbon background",
      fg: "#92400e",
      bg: rgbToHex(alphaBlend("#92400e", 0.12, "#ffffff")),
    },
    { name: "Primary button (white on accent)", fg: "#ffffff", bg: "#2563eb" },
    {
      name: "Primary button (white on accentHover)",
      fg: "#ffffff",
      bg: "#1d4ed8",
    },
    { name: "Secondary button on surface2", fg: "#0f172a", bg: "#f1f5f9" },
    {
      name: "Outline button text on card surface",
      fg: "#1d4ed8",
      bg: "#ffffff",
    },
    { name: "Ghost button on card surface", fg: "#0f172a", bg: "#ffffff" },
    { name: "Success button (white on green)", fg: "#ffffff", bg: "#15803d" },
    { name: "Danger button (white on red)", fg: "#ffffff", bg: "#dc2626" },
    { name: "Search placeholder on card", fg: "#475569", bg: "#ffffff" },
    { name: "Footer text on background", fg: "#475569", bg: "#f5f7fb" },
    { name: "Footer link on background", fg: "#1d4ed8", bg: "#f5f7fb" },
    {
      name: "Recent card badge on card",
      fg: "#1d4ed8",
      bg: rgbToHex(alphaBlend("#ffffff", 0.82, "#ffffff")),
    },
  ];

  for (const pair of lightPairs) {
    const ratio = contrastRatio(pair.fg, pair.bg);
    assert.ok(
      ratio >= 4.5,
      `Light theme ${pair.name} (${pair.fg} on ${pair.bg}) must be >= 4.5:1, got ${ratio}:1`
    );
  }
});
