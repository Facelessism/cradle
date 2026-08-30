const test = require("node:test");
const assert = require("node:assert/strict");
const AvatarEngine = require("../projects/misc/avatar-creator/avatarEngine");

test("AvatarEngine constants grid properties are correct", () => {
  assert.equal(AvatarEngine.GRID_SIZE, 16);
  assert.equal(AvatarEngine.CANVAS_SIZE, 200);
  assert.equal(AvatarEngine.PIXEL_SIZE, 12.5);
});

test("AvatarEngine generateAvatarSVG outputs valid SVG string with default options", () => {
  const svg = AvatarEngine.generateAvatarSVG();

  assert.ok(svg.includes('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('width="200"'));
  assert.ok(svg.includes('height="200"'));
  assert.ok(svg.includes('fill="#3b82f6"')); // default bgColor
  assert.ok(svg.includes('fill="#ffdbac"')); // default skinColor
  assert.ok(svg.includes('fill="#4a3728"')); // default hairColor
  assert.ok(svg.includes('fill="#1e293b"')); // eye color
  assert.ok(svg.includes('fill="#dc2626"')); // mouth color
  assert.ok(svg.includes('fill="#f87171"')); // blush color
});

test("AvatarEngine generateAvatarSVG respects custom options and colors", () => {
  const svg = AvatarEngine.generateAvatarSVG({
    bgColor: "#ff0000",
    skinColor: "#00ff00",
    hairColor: "#0000ff",
    hairStyle: 1,
  });

  assert.ok(svg.includes('fill="#ff0000"'));
  assert.ok(svg.includes('fill="#00ff00"'));
  assert.ok(svg.includes('fill="#0000ff"'));
});

test("AvatarEngine generateAvatarSVG handles out-of-bounds or invalid hair style fallback", () => {
  const svgInvalidIndex = AvatarEngine.generateAvatarSVG({ hairStyle: 99 });
  const svgBaldIndex = AvatarEngine.generateAvatarSVG({ hairStyle: 2 });

  // Out of bounds hairStyle falls back to hairStyles[0] (Bowl Cut)
  assert.ok(svgInvalidIndex.includes("<svg"));
  assert.ok(svgBaldIndex.includes("<svg"));
});

test("AvatarEngine generateRandomOptions returns valid option structure", () => {
  const opts = AvatarEngine.generateRandomOptions();
  assert.ok(typeof opts.bgColor === "string" && opts.bgColor.startsWith("#"));
  assert.ok(
    typeof opts.skinColor === "string" && opts.skinColor.startsWith("#")
  );
  assert.ok(
    typeof opts.hairColor === "string" && opts.hairColor.startsWith("#")
  );
  assert.ok(Number.isInteger(opts.hairStyle));
  assert.ok(opts.hairStyle >= 0 && opts.hairStyle <= 2);
});

test("AvatarEngine.validateSVG accepts valid SVG and properties", () => {
  const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>';
  const result = AvatarEngine.validateSVG(validSvg, 100, "image/svg+xml", "avatar.svg");
  assert.equal(result, true);
});

test("AvatarEngine.validateSVG rejects size exceeding limit", () => {
  const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>';
  assert.throws(
    () => AvatarEngine.validateSVG(validSvg, 200000, "image/svg+xml", "avatar.svg"),
    /size exceeds the maximum limit/
  );
});

test("AvatarEngine.validateSVG rejects non-SVG extension", () => {
  const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>';
  assert.throws(
    () => AvatarEngine.validateSVG(validSvg, 100, "image/svg+xml", "avatar.png"),
    /Unsupported file extension/
  );
});

test("AvatarEngine.validateSVG rejects non-SVG MIME type", () => {
  const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>';
  assert.throws(
    () => AvatarEngine.validateSVG(validSvg, 100, "image/png", "avatar.svg"),
    /Unsupported file MIME type/
  );
});

test("AvatarEngine.validateSVG rejects empty content", () => {
  assert.throws(
    () => AvatarEngine.validateSVG("", 0, "image/svg+xml", "avatar.svg"),
    /SVG content is empty/
  );
  assert.throws(
    () => AvatarEngine.validateSVG("   ", 3, "image/svg+xml", "avatar.svg"),
    /SVG content is empty/
  );
});

test("AvatarEngine.validateSVG rejects malformed SVG content", () => {
  const unclosedTag = '<svg xmlns="http://www.w3.org/2000/svg"';
  const nonSvgRoot = '<div>hello</div>';
  
  assert.throws(
    () => AvatarEngine.validateSVG(unclosedTag, unclosedTag.length, "image/svg+xml", "avatar.svg"),
    /Malformed SVG content|is not a valid SVG/
  );
  assert.throws(
    () => AvatarEngine.validateSVG(nonSvgRoot, nonSvgRoot.length, "image/svg+xml", "avatar.svg"),
    /is not a valid SVG/
  );
});
