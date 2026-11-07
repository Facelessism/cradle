const test = require("node:test");
const assert = require("node:assert/strict");
const ContrastEngine = require("../projects/dev-tools/color-contrast-checker/contrastEngine.js");

test("normalizeHex accepts 3 and 6 digit hex colors", () => {
  assert.equal(ContrastEngine.normalizeHex("#fff"), "#ffffff");
  assert.equal(ContrastEngine.normalizeHex("0f172a"), "#0f172a");
  assert.equal(ContrastEngine.normalizeHex("ABC"), "#aabbcc");
});

test("isValidHexColor rejects invalid hex values", () => {
  assert.equal(ContrastEngine.isValidHexColor("#12"), false);
  assert.equal(ContrastEngine.isValidHexColor("#gggggg"), false);
  assert.equal(ContrastEngine.isValidHexColor("12345z"), false);
  assert.equal(ContrastEngine.isValidHexColor(null), false);
});

test("calculateContrastRatio returns WCAG contrast for black and white", () => {
  assert.equal(ContrastEngine.calculateContrastRatio("#000000", "#ffffff"), 21);
});

test("calculateContrastRatio is order independent", () => {
  const first = ContrastEngine.calculateContrastRatio("#1e293b", "#f8fafc");
  const second = ContrastEngine.calculateContrastRatio("#f8fafc", "#1e293b");
  assert.equal(first, second);
});

test("getWcagStatus marks AA and AAA pass states", () => {
  assert.deepEqual(ContrastEngine.getWcagStatus(7), {
    normalAA: true,
    normalAAA: true,
    largeAA: true,
    largeAAA: true,
    uiAA: true,
  });
});

test("getWcagStatus marks normal text fail while UI components pass at 3:1", () => {
  const status = ContrastEngine.getWcagStatus(3);
  assert.equal(status.normalAA, false);
  assert.equal(status.normalAAA, false);
  assert.equal(status.largeAA, true);
  assert.equal(status.uiAA, true);
});

test("getContrastReport returns invalid result for bad inputs", () => {
  const report = ContrastEngine.getContrastReport("#12345z", "#ffffff");
  assert.equal(report.valid, false);
  assert.match(report.error, /valid/i);
});

test("getContrastReport includes ratio, pass/fail status, and CSS variables", () => {
  const report = ContrastEngine.getContrastReport("#ffffff", "#020617");
  assert.equal(report.valid, true);
  assert.ok(report.ratio >= 15);
  assert.equal(report.status.normalAA, true);
  assert.match(report.cssVariables, /--contrast-foreground: #ffffff/);
  assert.match(report.cssVariables, /--contrast-background: #020617/);
});

test("suggestAccessibleAlternatives returns AA normal candidates for failing colors", () => {
  const suggestions = ContrastEngine.suggestAccessibleAlternatives(
    "#94a3b8",
    "#f8fafc"
  );
  assert.ok(suggestions.length > 0);
  assert.ok(
    suggestions.every(
      item => item.ratio >= ContrastEngine.WCAG_THRESHOLDS.normalAA
    )
  );
});

test("suggestAccessibleAlternatives returns empty list for already accessible colors", () => {
  const suggestions = ContrastEngine.suggestAccessibleAlternatives(
    "#ffffff",
    "#000000"
  );
  assert.deepEqual(suggestions, []);
});

test("calculateApca returns directional lightness contrast (Lc)", () => {
  const bow = ContrastEngine.calculateApca("#000000", "#ffffff");
  const wob = ContrastEngine.calculateApca("#ffffff", "#000000");
  const identical = ContrastEngine.calculateApca("#1e293b", "#1e293b");

  assert.ok(bow > 100, `Expected black-on-white Lc > 100, got ${bow}`);
  assert.ok(wob < -100, `Expected white-on-black Lc < -100, got ${wob}`);
  assert.equal(identical, 0);
});

test("getApcaStatus classifies readability tiers and contrast polarity", () => {
  const highContrast = ContrastEngine.getApcaStatus(106.0);
  assert.equal(highContrast.polarity, "Dark on Light (BoW)");
  assert.equal(highContrast.fluentText, true);
  assert.equal(highContrast.bodyText, true);
  assert.equal(highContrast.largeText, true);
  assert.equal(highContrast.headlineText, true);
  assert.equal(highContrast.uiComponents, true);
  assert.equal(highContrast.rating, "Preferred Body");

  const midContrast = ContrastEngine.getApcaStatus(-65.0);
  assert.equal(midContrast.polarity, "Light on Dark (WoB)");
  assert.equal(midContrast.fluentText, false);
  assert.equal(midContrast.bodyText, false);
  assert.equal(midContrast.largeText, true);
  assert.equal(midContrast.headlineText, true);
  assert.equal(midContrast.uiComponents, true);
  assert.equal(midContrast.rating, "Content Text");

  const lowContrast = ContrastEngine.getApcaStatus(20.0);
  assert.equal(lowContrast.uiComponents, false);
  assert.equal(lowContrast.rating, "Fail");
});

test("simulateCvd simulates color vision deficiencies accurately", () => {
  assert.equal(
    ContrastEngine.simulateCvd("#ff0000", "normal"),
    "#ff0000"
  );

  const protan = ContrastEngine.simulateCvd("#ff0000", "protanopia");
  assert.ok(ContrastEngine.isValidHexColor(protan));

  const deutan = ContrastEngine.simulateCvd("#00ff00", "deuteranopia");
  assert.ok(ContrastEngine.isValidHexColor(deutan));

  const tritan = ContrastEngine.simulateCvd("#0000ff", "tritanopia");
  assert.ok(ContrastEngine.isValidHexColor(tritan));

  const achroma = ContrastEngine.simulateCvd("#ff5500", "achromatopsia");
  assert.ok(ContrastEngine.isValidHexColor(achroma));
  const rgb = ContrastEngine.hexToRgb(achroma);
  assert.equal(rgb.r, rgb.g);
  assert.equal(rgb.g, rgb.b);
});

test("getCvdSimulationReport generates full metrics for all deficiencies", () => {
  const report = ContrastEngine.getCvdSimulationReport("#3b82f6", "#ffffff");
  assert.ok(report.normal);
  assert.ok(report.protanopia);
  assert.ok(report.deuteranopia);
  assert.ok(report.tritanopia);
  assert.ok(report.achromatopsia);

  assert.ok(typeof report.protanopia.ratio === "number");
  assert.ok(typeof report.protanopia.apca === "number");
  assert.ok(typeof report.achromatopsia.ratio === "number");
});

test("getContrastReport includes APCA and CVD simulation data", () => {
  const report = ContrastEngine.getContrastReport("#ffffff", "#020617");
  assert.equal(report.valid, true);
  assert.ok(typeof report.apca === "number");
  assert.ok(report.apcaStatus);
  assert.ok(report.apcaStatus.rating);
  assert.ok(report.cvd);
  assert.ok(report.cvd.protanopia);
});
