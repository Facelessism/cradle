import { test } from "node:test";
import assert from "node:assert/strict";
import QREngine from "../projects/productivity/advanced-qr-code-generator/qrEngine.js";

test("isValidHex validates hex colors correctly", () => {
  assert.equal(QREngine.isValidHex("#FFF"), true);
  assert.equal(QREngine.isValidHex("#2B2D42"), true);
  assert.equal(QREngine.isValidHex("2B2D42"), false);
  assert.equal(QREngine.isValidHex("#GGGGGG"), false);
});

test("sanitizeOptions returns fallback defaults for invalid parameters", () => {
  const sanitized = QREngine.sanitizeOptions({
    fgColor: "invalid",
    size: -50,
    errorLevel: "Z",
  });

  assert.equal(sanitized.fgColor, "#2B2D42");
  assert.equal(sanitized.size, 100);
  assert.equal(sanitized.errorLevel, "M");
});

test("buildConfigPayload formats valid QRCodeStyling config payload", () => {
  const payload = QREngine.buildConfigPayload({
    text: "https://cradle.dev",
    fgColor: "#000000",
    bgColor: "#FFFFFF",
    size: 400,
    errorLevel: "H",
  });

  assert.equal(payload.data, "https://cradle.dev");
  assert.equal(payload.width, 400);
  assert.equal(payload.dotsOptions.color, "#000000");
  assert.equal(payload.backgroundOptions.color, "#FFFFFF");
  assert.equal(payload.qrOptions.errorCorrectionLevel, "H");
});

test("getDownloadFilename generates descriptive filenames with valid extensions", () => {
  assert.equal(QREngine.getDownloadFilename(), "qr-code.png");
  assert.equal(QREngine.getDownloadFilename("qr-code", "png"), "qr-code.png");
  assert.equal(QREngine.getDownloadFilename("qr-code", "svg"), "qr-code.svg");
  assert.equal(
    QREngine.getDownloadFilename("custom-qr", "png"),
    "custom-qr.png"
  );
  assert.equal(
    QREngine.getDownloadFilename("custom-qr.png", "png"),
    "custom-qr.png"
  );
  assert.equal(
    QREngine.getDownloadFilename("custom-qr.svg", "svg"),
    "custom-qr.svg"
  );
  assert.equal(QREngine.getDownloadFilename("", "png"), "qr-code.png");
  assert.equal(QREngine.getDownloadFilename(null, "svg"), "qr-code.svg");
  assert.equal(
    QREngine.getDownloadFilename("invalid/name:code*", "png"),
    "invalid-name-code-.png"
  );
  assert.equal(
    QREngine.getDownloadFilename("qr-code", "unknown"),
    "qr-code.png"
  );
});

test("triggerDownload creates an anchor element with download attribute and clicks it", () => {
  let clicked = false;
  let appended = false;
  let removed = false;
  const createdAttr = {};

  const mockAnchor = {
    setAttribute(name, val) {
      createdAttr[name] = val;
    },
    click() {
      clicked = true;
    },
    parentNode: null,
  };

  const mockDoc = {
    createElement(tag) {
      if (tag === "a") return mockAnchor;
      return {};
    },
    body: {
      appendChild(node) {
        appended = true;
        node.parentNode = this;
      },
      removeChild(node) {
        removed = true;
        node.parentNode = null;
      },
    },
  };

  const success = QREngine.triggerDownload(
    "blob:https://example.com/mock-id",
    "qr-code.png",
    mockDoc
  );
  assert.equal(success, true);
  assert.equal(mockAnchor.download, "qr-code.png");
  assert.equal(mockAnchor.href, "blob:https://example.com/mock-id");
  assert.equal(createdAttr.download, "qr-code.png");
  assert.equal(appended, true);
  assert.equal(clicked, true);
});

test("triggerDownload returns false when document is unavailable", () => {
  const success = QREngine.triggerDownload("data:test", "qr-code.png", {});
  assert.equal(success, false);
});

test("isValidLogoType validates PNG, JPEG, SVG mime types", () => {
  assert.equal(QREngine.isValidLogoType("image/png"), true);
  assert.equal(QREngine.isValidLogoType("image/jpeg"), true);
  assert.equal(QREngine.isValidLogoType("image/svg+xml"), true);
  assert.equal(QREngine.isValidLogoType("application/x-msdownload"), false);
  assert.equal(QREngine.isValidLogoType("text/html"), false);
});

test("validateLogoSignature validates logo magic bytes", async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pngCheck = await QREngine.validateLogoSignature(png);
  assert.equal(pngCheck.valid, true);

  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const jpegCheck = await QREngine.validateLogoSignature(jpeg);
  assert.equal(jpegCheck.valid, true);

  const svg = new TextEncoder().encode("<svg viewBox='0 0 10 10'></svg>");
  const svgCheck = await QREngine.validateLogoSignature(svg);
  assert.equal(svgCheck.valid, true);

  const invalid = new Uint8Array([0x00, 0x11, 0x22, 0x33]);
  const invalidCheck = await QREngine.validateLogoSignature(invalid);
  assert.equal(invalidCheck.valid, false);
});

test("buildConfigPayload supports custom dot geometry and corner styles", () => {
  // Test squircle modules (extra-rounded) and classy curves
  const payload1 = QREngine.buildConfigPayload({
    text: "https://cradle.dev/test",
    dotStyle: "extra-rounded",
    cornerSquareStyle: "extra-rounded",
    cornerDotStyle: "dot",
  });
  assert.equal(payload1.dotsOptions.type, "extra-rounded");
  assert.equal(payload1.cornersSquareOptions.type, "extra-rounded");
  assert.equal(payload1.cornersDotOptions.type, "dot");

  // Test diamond geometry: maps to dots in QRCodeStyling for polygon post-processing
  const payload2 = QREngine.buildConfigPayload({
    text: "https://cradle.dev/diamonds",
    dotStyle: "diamond",
  });
  assert.equal(payload2.dotsOptions.type, "dots");

  // Test classy curves
  const payload3 = QREngine.buildConfigPayload({
    text: "https://cradle.dev/classy",
    dotStyle: "classy",
  });
  assert.equal(payload3.dotsOptions.type, "classy");
});

test("Automatic Reed-Solomon elevation: logo presence forces errorLevel to H", () => {
  const payloadWithLogo = QREngine.buildConfigPayload({
    text: "https://cradle.dev",
    errorLevel: "L", // User selected Low (7%)
    logo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  });

  // Must automatically elevate to H (up to 30% damage recovery) to protect center occlusion
  assert.equal(
    payloadWithLogo.qrOptions.errorCorrectionLevel,
    "H",
    "Logo embedding must automatically elevate error correction level to Level H (30%)"
  );
});

test("buildConfigPayload configures linear and radial gradient fills", () => {
  // Linear gradient with 45° rotation
  const linearPayload = QREngine.buildConfigPayload({
    text: "https://cradle.dev/gradient",
    gradientEnabled: true,
    gradientType: "linear",
    gradientColor1: "#10B981",
    gradientColor2: "#3B82F6",
    gradientRotation: 45,
  });

  assert.ok(linearPayload.dotsOptions.gradient);
  assert.equal(linearPayload.dotsOptions.gradient.type, "linear");
  assert.equal(
    linearPayload.dotsOptions.gradient.rotation.toFixed(4),
    ((45 * Math.PI) / 180).toFixed(4)
  );
  assert.equal(linearPayload.dotsOptions.gradient.colorStops[0].color, "#10B981");
  assert.equal(linearPayload.dotsOptions.gradient.colorStops[1].color, "#3B82F6");

  // Radial gradient
  const radialPayload = QREngine.buildConfigPayload({
    text: "https://cradle.dev/radial",
    gradientEnabled: true,
    gradientType: "radial",
    gradientColor1: "#F59E0B",
    gradientColor2: "#EF4444",
  });
  assert.equal(radialPayload.dotsOptions.gradient.type, "radial");
});

test("getDownloadFilename supports vector EPS extension", () => {
  assert.equal(QREngine.getDownloadFilename("my-qr", "eps"), "my-qr.eps");
  assert.equal(QREngine.getDownloadFilename("vector-code.eps", "eps"), "vector-code.eps");
  assert.equal(QREngine.getDownloadFilename("", "eps"), "qr-code.eps");
});

test("applyDiamondGeometry transforms circular SVG dots into vector polygons", () => {
  const sampleSvg = '<svg viewBox="0 0 100 100"><circle cx="20" cy="30" r="5" fill="#2B2D42"/></svg>';
  const resultSvg = QREngine.applyDiamondGeometry(sampleSvg);

  assert.ok(resultSvg.includes("<polygon"), "Must convert circle into polygon");
  // Center (20, 30), radius 5 => Top (20, 25), Right (25, 30), Bottom (20, 35), Left (15, 30)
  assert.ok(resultSvg.includes("20.000,25.000"));
  assert.ok(resultSvg.includes("25.000,30.000"));
  assert.ok(resultSvg.includes("20.000,35.000"));
  assert.ok(resultSvg.includes("15.000,30.000"));
  assert.ok(resultSvg.includes('fill="#2B2D42"'));
});

test("svgToEps generates valid Encapsulated PostScript (EPSF-3.0) with drawing commands", () => {
  const svg = `
    <svg viewBox="0 0 300 300" width="300" height="300">
      <rect x="0" y="0" width="300" height="300" fill="#FFFFFF"/>
      <rect x="20" y="20" width="10" height="10" fill="#2B2D42"/>
      <circle cx="50" cy="50" r="5" fill="#6366F1"/>
      <polygon points="10,10 20,10 20,20 10,20" fill="#10B981"/>
      <path d="M 5 5 L 15 5 L 15 15 Z" fill="#EF4444"/>
    </svg>
  `;

  const eps = QREngine.svgToEps(svg);

  assert.ok(eps.startsWith("%!PS-Adobe-3.0 EPSF-3.0"), "Must start with EPS header");
  assert.ok(eps.includes("%%BoundingBox: 0 0 300 300"));
  assert.ok(eps.includes("0 300.000 translate"));
  assert.ok(eps.includes("1 -1 scale"));
  assert.ok(eps.includes("rectfill"));
  assert.ok(eps.includes("arc fill"));
  assert.ok(eps.includes("moveto"));
  assert.ok(eps.includes("lineto"));
  assert.ok(eps.includes("closepath fill"));
  assert.ok(eps.includes("showpage"));
  assert.ok(eps.includes("%%EOF"));
});
