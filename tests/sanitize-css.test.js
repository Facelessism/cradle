const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ALLOWED_CSS_PROPERTIES,
  sanitizeCssProperty,
  isAllowedCssProperty,
  sanitizeCssValue,
  sanitizeCssDeclaration,
  sanitizeInlineStyle,
  sanitizeCssUrl,
  sanitizeHexColor,
} = require("../src/components/ui/sanitizeCss.js");
const ClampCalculator = require("../projects/dev-tools/css-clamp-calculator/clampCalculator.js");

// --- sanitizeCssProperty ---

test("sanitizeCssProperty allows approved properties", () => {
  assert.equal(sanitizeCssProperty("font-size"), "font-size");
  assert.equal(sanitizeCssProperty("gap"), "gap");
  assert.equal(sanitizeCssProperty("max-width"), "max-width");
  assert.equal(sanitizeCssProperty("padding-block"), "padding-block");
  assert.equal(sanitizeCssProperty("  FONT-SIZE  "), "font-size");
});

test("sanitizeCssProperty rejects non-allowlisted properties", () => {
  assert.equal(sanitizeCssProperty("behavior", null), null);
  assert.equal(sanitizeCssProperty("-moz-binding", null), null);
  assert.equal(sanitizeCssProperty("position", null), null);
  assert.equal(sanitizeCssProperty("background", null), "background"); // background is allowlisted for shape designer
  assert.equal(sanitizeCssProperty("color", null), null); // not in clamp allowlist, but might be considered safe elsewhere; our allowlist treats it as not allowed for clamp
});

test("sanitizeCssProperty rejects injection attempts", () => {
  assert.equal(sanitizeCssProperty("font-size; color: red", null), null);
  assert.equal(sanitizeCssProperty("font-size: red", null), null);
  assert.equal(
    sanitizeCssProperty("font-size } .evil { color: red", null),
    null
  );
  assert.equal(sanitizeCssProperty("expression", null), null);
  assert.equal(sanitizeCssProperty("", null), null);
  assert.equal(
    sanitizeCssProperty(
      "a-very-long-property-name-that-exceeds-fifty-characters-xxxxxxxx",
      null
    ),
    null
  );
});

test("sanitizeCssProperty returns fallback for invalid input", () => {
  assert.equal(sanitizeCssProperty(null, "font-size"), "font-size");
  assert.equal(sanitizeCssProperty(undefined, "gap"), "gap");
  assert.equal(sanitizeCssProperty(123, "width"), "width");
});

test("isAllowedCssProperty checks allowlist", () => {
  assert.equal(isAllowedCssProperty("font-size"), true);
  assert.equal(isAllowedCssProperty("behavior"), false);
  assert.equal(isAllowedCssProperty("font-size;"), false);
  assert.equal(isAllowedCssProperty(""), false);
});

// --- sanitizeCssValue ---

test("sanitizeCssValue allows safe clamp values", () => {
  assert.equal(
    sanitizeCssValue("clamp(1rem, calc(0.5rem + 1vw), 2rem)", null),
    "clamp(1rem, calc(0.5rem + 1vw), 2rem)"
  );
  assert.equal(sanitizeCssValue("16px", null), "16px");
  assert.equal(sanitizeCssValue("#ff00ff", null), "#ff00ff");
});

test("sanitizeCssValue rejects dangerous patterns", () => {
  assert.equal(sanitizeCssValue("expression(alert(1))", null), null);
  assert.equal(sanitizeCssValue("behavior: url(x.htc)", null), null);
  assert.equal(sanitizeCssValue("-moz-binding: url(x.xml)", null), null);
  assert.equal(sanitizeCssValue("javascript:alert(1)", null), null);
  assert.equal(
    sanitizeCssValue("red; background: url(javascript:alert(1))", null),
    null
  );
  assert.equal(sanitizeCssValue("red } .evil { color: blue", null), null);
});

test("sanitizeCssValue rejects url() with javascript: scheme", () => {
  assert.equal(sanitizeCssValue("url(javascript:alert(1))", null), null);
  assert.equal(sanitizeCssValue("url('javascript:alert(1)')", null), null);
});

test("sanitizeCssValue allows url() with https", () => {
  assert.equal(
    sanitizeCssValue("url(https://example.com/img.png)", null),
    "url(https://example.com/img.png)"
  );
});

// --- sanitizeCssDeclaration ---

test("sanitizeCssDeclaration validates both property and value", () => {
  assert.deepEqual(sanitizeCssDeclaration("font-size", "16px"), {
    property: "font-size",
    value: "16px",
  });
  assert.equal(sanitizeCssDeclaration("behavior", "url(x)"), null);
  assert.equal(
    sanitizeCssDeclaration("font-size", "expression(alert(1))"),
    null
  );
  assert.equal(sanitizeCssDeclaration("font-size; color: red", "16px"), null);
});

// --- sanitizeInlineStyle ---

test("sanitizeInlineStyle keeps only allowlisted declarations", () => {
  assert.equal(
    sanitizeInlineStyle("font-size: 16px; behavior: url(x); gap: 10px"),
    "font-size: 16px; gap: 10px"
  );
  assert.equal(
    sanitizeInlineStyle("font-size: 16px; color: red"),
    "font-size: 16px"
  );
  assert.equal(sanitizeInlineStyle(""), "");
  assert.equal(sanitizeInlineStyle("not-a-declaration"), "");
});

test("sanitizeInlineStyle handles case-insensitive properties", () => {
  assert.equal(sanitizeInlineStyle("FONT-SIZE: 16px"), "font-size: 16px");
});

// --- sanitizeCssUrl ---

test("sanitizeCssUrl allows https and http URLs", () => {
  assert.equal(
    sanitizeCssUrl("https://example.com/img.jpg"),
    "https://example.com/img.jpg"
  );
  assert.equal(
    sanitizeCssUrl("http://example.com/img.jpg"),
    "http://example.com/img.jpg"
  );
  assert.equal(
    sanitizeCssUrl("https://images.unsplash.com/photo.jpg?w=600"),
    "https://images.unsplash.com/photo.jpg?w=600"
  );
});

test("sanitizeCssUrl allows relative URLs", () => {
  assert.equal(sanitizeCssUrl("/assets/img.png"), "/assets/img.png");
  assert.equal(sanitizeCssUrl("images/photo.jpg"), "images/photo.jpg");
});

test("sanitizeCssUrl allows data:image URLs", () => {
  assert.equal(
    sanitizeCssUrl("data:image/png;base64,abc123"),
    "data:image/png;base64,abc123"
  );
  assert.equal(
    sanitizeCssUrl("data:image/svg+xml;base64,PHN2Zz8="),
    "data:image/svg+xml;base64,PHN2Zz8="
  );
});

test("sanitizeCssUrl rejects javascript: and data:text/html", () => {
  assert.equal(sanitizeCssUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeCssUrl("data:text/html,<script>alert(1)</script>"), "");
  assert.equal(sanitizeCssUrl("vbscript:msgbox(1)"), "");
});

test("sanitizeCssUrl rejects URLs with breakout characters", () => {
  assert.equal(
    sanitizeCssUrl('https://example.com/img.jpg"); color: red; --x:"'),
    ""
  );
  assert.equal(
    sanitizeCssUrl("https://example.com/img.jpg'); color: red; --x:'"),
    ""
  );
  assert.equal(sanitizeCssUrl("https://example.com/img.jpg)"), "");
  assert.equal(sanitizeCssUrl("https://example.com/img.jpg; color: red"), "");
});

test("sanitizeCssUrl returns fallback for empty and non-string", () => {
  assert.equal(sanitizeCssUrl("", "fallback"), "fallback");
  assert.equal(sanitizeCssUrl(null, "fallback"), "fallback");
  assert.equal(sanitizeCssUrl(undefined), "");
});

// --- sanitizeHexColor ---

test("sanitizeHexColor allows valid hex colors", () => {
  assert.equal(sanitizeHexColor("#fff", "fallback"), "#fff");
  assert.equal(sanitizeHexColor("#ff00ff", "fallback"), "#ff00ff");
  assert.equal(sanitizeHexColor("#ff00ffaa", "fallback"), "#ff00ffaa");
  assert.equal(sanitizeHexColor("  #123abc  ", "fallback"), "#123abc");
});

test("sanitizeHexColor rejects invalid colors", () => {
  assert.equal(sanitizeHexColor("red", "fallback"), "fallback");
  assert.equal(sanitizeHexColor("rgb(255,0,0)", "fallback"), "fallback");
  assert.equal(sanitizeHexColor("#gggggg", "fallback"), "fallback");
  assert.equal(sanitizeHexColor("#ff00ff; color: red", "fallback"), "fallback");
  assert.equal(sanitizeHexColor(null, "fallback"), "fallback");
});

// --- Integration: ClampCalculator rejects disallowed properties ---

test("ClampCalculator rejects disallowed CSS property", () => {
  assert.throws(() => {
    ClampCalculator.generateClamp({
      property: "behavior",
      unit: "rem",
      minViewport: 320,
      maxViewport: 1280,
      minValue: 1,
      maxValue: 2,
    });
  }, /Unsupported CSS property/);
});

test("ClampCalculator rejects injected property with semicolon", () => {
  assert.throws(() => {
    ClampCalculator.generateClamp({
      property: "font-size; color: red",
      unit: "rem",
      minViewport: 320,
      maxViewport: 1280,
      minValue: 1,
      maxValue: 2,
    });
  }, /Unsupported CSS property/);
});

test("ClampCalculator rejects -moz-binding", () => {
  assert.throws(() => {
    ClampCalculator.generateClamp({
      property: "-moz-binding",
      unit: "rem",
      minViewport: 320,
      maxViewport: 1280,
      minValue: 1,
      maxValue: 2,
    });
  }, /Unsupported CSS property/);
});

test("ClampCalculator allows all preset properties", () => {
  for (const preset of ClampCalculator.PRESETS) {
    const result = ClampCalculator.generateClamp({
      property: preset.property,
      unit: preset.unit,
      minViewport: preset.minViewport,
      maxViewport: preset.maxViewport,
      minValue: preset.minValue,
      maxValue: preset.maxValue,
    });
    assert.equal(result.property, preset.property);
  }
});

test("ALLOWED_CSS_PROPERTIES contains expected safe properties", () => {
  assert.ok(ALLOWED_CSS_PROPERTIES.has("font-size"));
  assert.ok(ALLOWED_CSS_PROPERTIES.has("gap"));
  assert.ok(ALLOWED_CSS_PROPERTIES.has("max-width"));
  assert.ok(!ALLOWED_CSS_PROPERTIES.has("behavior"));
  assert.ok(!ALLOWED_CSS_PROPERTIES.has("expression"));
});
