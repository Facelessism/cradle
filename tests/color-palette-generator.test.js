const test = require("node:test");
const assert = require("node:assert/strict");

const {
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
} = require("../projects/editor/color-palette-generator/script.js");

test("hexToRgb parses 6-digit and 3-digit hex strings", () => {
  assert.deepEqual(hexToRgb("#ffffff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(hexToRgb("#000000"), { r: 0, g: 0, b: 0 });
  assert.deepEqual(hexToRgb("#38bdf8"), { r: 56, g: 189, b: 248 });
  assert.deepEqual(hexToRgb("#fff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(hexToRgb(""), { r: 0, g: 0, b: 0 });
});

test("rgbToHex formats RGB to uppercase 6-digit hex", () => {
  assert.equal(rgbToHex(255, 255, 255).toLowerCase(), "#ffffff");
  assert.equal(rgbToHex(0, 0, 0), "#000000");
  assert.equal(rgbToHex(56, 189, 248).toLowerCase(), "#38bdf8");
  // Clamping test
  assert.equal(rgbToHex(300, -10, 100).toLowerCase(), "#ff0064");
});

test("contrastRatio accurately computes WCAG contrast ratios", () => {
  assert.equal(Number(contrastRatio("#000000", "#ffffff").toFixed(2)), 21.0);
  assert.equal(Number(contrastRatio("#ffffff", "#ffffff").toFixed(2)), 1.0);
  // Symmetric / order independent
  const r1 = contrastRatio("#38bdf8", "#0f172a");
  const r2 = contrastRatio("#0f172a", "#38bdf8");
  assert.equal(r1.toFixed(4), r2.toFixed(4));
});

test("generatePalette generates 5 valid hex colors across all harmony modes", () => {
  const modes = [
    "complementary",
    "analogous",
    "triadic",
    "split-complementary",
    "tetradic",
    "monochromatic",
  ];

  const hexRegex = /^#[0-9a-fA-F]{6}$/;

  modes.forEach(mode => {
    const palette = generatePalette("#38bdf8", mode);
    assert.equal(palette.length, 5, `Mode ${mode} should generate 5 colors`);
    palette.forEach((color, idx) => {
      assert.match(
        color,
        hexRegex,
        `Mode ${mode} swatch ${idx} should be valid 6-digit hex: ${color}`
      );
    });
  });
});

test("Issue #999 - resolveSwatchHex resolves current swatch hex from button dataset", () => {
  const button = {
    dataset: {
      index: "0",
      hex: "#3A7BD5",
    },
  };
  const currentPalette = [
    "#3A7BD5",
    "#00D2FF",
    "#F87171",
    "#34D399",
    "#A78BFA",
  ];

  const resolved = resolveSwatchHex(button, currentPalette);
  assert.equal(resolved, "#3A7BD5");
});

test("Issue #999 - Multi-generation test: Copy HEX never returns stale closure data", () => {
  // Step 1: Initial palette generated (#38BDF8 base)
  const initialPalette = [
    "#38BDF8",
    "#F87171",
    "#34D399",
    "#FBBF24",
    "#A78BFA",
  ];
  const initialSwatchButton = {
    dataset: {
      index: "0",
      hex: initialPalette[0].toUpperCase(),
    },
  };

  const initialCopiedHex = resolveSwatchHex(
    initialSwatchButton,
    initialPalette
  );
  assert.equal(initialCopiedHex, "#38BDF8");

  // Step 2: User clicks 'Generate New Palette' (new base #3A7BD5)
  const newPalette = ["#3A7BD5", "#E11D48", "#10B981", "#F59E0B", "#8B5CF6"];
  const newSwatchButton = {
    dataset: {
      index: "0",
      hex: newPalette[0].toUpperCase(),
    },
  };

  // Step 3: User clicks 'Copy HEX' on the newly generated palette's swatch
  const newCopiedHex = resolveSwatchHex(newSwatchButton, newPalette);

  // Must copy the NEW palette's color, NEVER the previous/stale palette color
  assert.equal(
    newCopiedHex,
    "#3A7BD5",
    "Copy HEX must reflect the new palette color, not stale closure"
  );
  assert.notEqual(
    newCopiedHex,
    initialCopiedHex,
    "New copied hex must differ from the initial palette hex"
  );
});

test("Issue #999 - resolveSwatchHex falls back to live palette index when dataset.hex is missing", () => {
  const buttonWithoutHexAttr = {
    dataset: {
      index: "2",
    },
  };
  const activePalette = ["#111111", "#222222", "#334455", "#444444", "#555555"];

  const resolved = resolveSwatchHex(buttonWithoutHexAttr, activePalette);
  assert.equal(resolved, "#334455");
});

test("formatExport supports css, tailwind, json, and scss formats", () => {
  const testPalette = ["#111111", "#222222", "#333333", "#444444", "#555555"];

  // CSS variables
  const css = formatExport(testPalette, "css");
  assert.match(css, /:root \{/);
  assert.match(css, /--color-1: #111111;/);
  assert.match(css, /--color-5: #555555;/);

  // Tailwind
  const tw = formatExport(testPalette, "tailwind");
  assert.match(tw, /tailwind\.config\.js/);
  assert.match(tw, /'100': '#111111'/);

  // JSON
  const jsonStr = formatExport(testPalette, "json");
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed["color-1"].hex, "#111111");

  // SCSS
  const scss = formatExport(testPalette, "scss");
  assert.match(scss, /\$color-1: #111111;/);
  assert.match(scss, /\$palette: \(/);
});

test("OKLCH Color Math: hexToOklch and oklchToHex roundtrip cleanly", () => {
  const testColors = ["#ffffff", "#000000", "#38bdf8", "#ef4444", "#10b981", "#8b5cf6"];

  testColors.forEach(hex => {
    const oklch = hexToOklch(hex);
    assert.ok(oklch.l >= 0 && oklch.l <= 1, `Lightness should be in [0, 1] for ${hex}`);
    assert.ok(oklch.c >= 0, `Chroma should be >= 0 for ${hex}`);
    assert.ok(oklch.h >= 0 && oklch.h < 360, `Hue should be in [0, 360) for ${hex}`);

    const recoveredHex = oklchToHex(oklch.l, oklch.c, oklch.h).toLowerCase();
    const originalRgb = hexToRgb(hex);
    const recoveredRgb = hexToRgb(recoveredHex);

    // Channels should match within rounding tolerance (<= 2 delta)
    assert.ok(
      Math.abs(originalRgb.r - recoveredRgb.r) <= 2,
      `Red channel roundtrip tolerance for ${hex}: ${originalRgb.r} vs ${recoveredRgb.r}`
    );
    assert.ok(
      Math.abs(originalRgb.g - recoveredRgb.g) <= 2,
      `Green channel roundtrip tolerance for ${hex}: ${originalRgb.g} vs ${recoveredRgb.g}`
    );
    assert.ok(
      Math.abs(originalRgb.b - recoveredRgb.b) <= 2,
      `Blue channel roundtrip tolerance for ${hex}: ${originalRgb.b} vs ${recoveredRgb.b}`
    );
  });

  // Boundary condition tests
  const whiteOklch = hexToOklch("#ffffff");
  assert.equal(Number(whiteOklch.l.toFixed(2)), 1.0);
  assert.ok(whiteOklch.c < 0.001);

  const blackOklch = hexToOklch("#000000");
  assert.equal(Number(blackOklch.l.toFixed(2)), 0.0);
  assert.ok(blackOklch.c < 0.001);
});

test("formatOklch formats valid CSS oklch functional notation", () => {
  const oklchStr = formatOklch(0.762, 0.124, 228.5);
  assert.equal(oklchStr, "oklch(76.2% 0.124 228.5)");
});

test("generateOklchPalette generates 5 valid hex colors across all presets", () => {
  const modes = [
    "analogous",
    "monochromatic",
    "triadic",
    "tetradic",
    "split-complementary",
    "complementary",
  ];
  const hexRegex = /^#[0-9a-fA-F]{6}$/;

  modes.forEach(mode => {
    const palette = generateOklchPalette("#38bdf8", mode);
    assert.equal(palette.length, 5, `OKLCH mode ${mode} must generate 5 colors`);
    palette.forEach((color, idx) => {
      assert.match(
        color,
        hexRegex,
        `OKLCH mode ${mode} swatch ${idx} should be valid 6-digit hex: ${color}`
      );
    });
  });
});

test("OKLCH Analogous harmony preserves uniform perceived lightness", () => {
  const baseHex = "#38bdf8";
  const palette = generateOklchPalette(baseHex, "analogous");
  const baseOklch = hexToOklch(baseHex);

  // In OKLCH Analogous, hue varies while perceived lightness L remains uniform
  palette.forEach((color, idx) => {
    const oklch = hexToOklch(color);
    const lightnessDelta = Math.abs(oklch.l - baseOklch.l);
    assert.ok(
      lightnessDelta < 0.05,
      `Swatch ${idx} (${color}) lightness delta (${lightnessDelta.toFixed(3)}) should be < 0.05 from base (${baseOklch.l.toFixed(3)})`
    );
  });
});

test("computeContrastMatrix returns valid N x N matrix with WCAG classifications", () => {
  const palette = ["#000000", "#ffffff", "#38bdf8", "#1e293b", "#f59e0b"];
  const matrixResult = computeContrastMatrix(palette);

  assert.equal(matrixResult.colors.length, 5);
  assert.equal(matrixResult.matrix.length, 5);
  assert.equal(matrixResult.totalPairs, 20); // 5 * 5 - 5 diagonal
  assert.ok(matrixResult.readableCount >= 0);

  for (let i = 0; i < 5; i++) {
    assert.equal(matrixResult.matrix[i].length, 5);
    for (let j = 0; j < 5; j++) {
      const cell = matrixResult.matrix[i][j];
      assert.equal(cell.bg, palette[i]);
      assert.equal(cell.fg, palette[j]);
      assert.equal(cell.bgIndex, i);
      assert.equal(cell.fgIndex, j);

      if (i === j) {
        assert.equal(cell.isSelf, true);
        assert.equal(cell.ratio, 1.0);
        assert.equal(cell.status, "Fail");
      } else {
        assert.equal(cell.isSelf, false);
        assert.ok(cell.ratio >= 1.0 && cell.ratio <= 21.0);

        // Reciprocal symmetry with transposed cell
        const transposed = matrixResult.matrix[j][i];
        assert.equal(cell.ratio, transposed.ratio);
        assert.equal(cell.status, transposed.status);

        // WCAG status matches threshold
        if (cell.ratio >= 7.0) {
          assert.equal(cell.status, "AAA");
          assert.equal(cell.aaa, true);
          assert.equal(cell.aa, true);
        } else if (cell.ratio >= 4.5) {
          assert.equal(cell.status, "AA");
          assert.equal(cell.aa, true);
          assert.equal(cell.aaa, false);
        } else if (cell.ratio >= 3.0) {
          assert.equal(cell.status, "AA Large");
          assert.equal(cell.aaLarge, true);
          assert.equal(cell.aa, false);
        } else {
          assert.equal(cell.status, "Fail");
          assert.equal(cell.aaLarge, false);
        }
      }
    }
  }

  // Black vs White pairing in matrix must be AAA 21:1
  const blackVsWhite = matrixResult.matrix[0][1];
  assert.equal(blackVsWhite.ratio, 21.0);
  assert.equal(blackVsWhite.status, "AAA");
});

test("formatExport supports Figma Design Tokens JSON and OKLCH CSS vars", () => {
  const testPalette = ["#38bdf8", "#0f172a", "#f8fafc", "#10b981", "#ef4444"];

  // Figma Design Tokens
  const figmaJson = formatExport(testPalette, "figma");
  const parsedFigma = JSON.parse(figmaJson);
  assert.ok(parsedFigma.color);
  assert.ok(parsedFigma.color.palette);
  assert.equal(parsedFigma.color.palette["color-1"].$value, "#38BDF8");
  assert.equal(parsedFigma.color.palette["color-1"].$type, "color");
  assert.match(parsedFigma.color.palette["color-1"].$description, /OKLCH/);
  assert.equal(parsedFigma.color.palette["color-5"].$value, "#EF4444");

  // CSS variables includes both hex and oklch
  const css = formatExport(testPalette, "css");
  assert.match(css, /--color-1: #38bdf8;/);
  assert.match(css, /--color-1-oklch: oklch\(/);
  assert.match(css, /--color-5: #ef4444;/);
  assert.match(css, /--color-5-oklch: oklch\(/);
});
