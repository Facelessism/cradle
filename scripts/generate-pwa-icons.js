const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function createPng(width, height, getPixel) {
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  for (let y = 0; y < height; y++) {
    scanlines[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      scanlines[offset++] = Math.min(255, Math.max(0, Math.round(r)));
      scanlines[offset++] = Math.min(255, Math.max(0, Math.round(g)));
      scanlines[offset++] = Math.min(255, Math.max(0, Math.round(b)));
      scanlines[offset++] = Math.min(255, Math.max(0, Math.round(a)));
    }
  }

  const idatData = zlib.deflateSync(scanlines);

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, "ascii");
    data.copy(buf, 8);
    const crc = zlib.crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makeChunk("IHDR", ihdr);
  const idatChunk = makeChunk("IDAT", idatData);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Cubic bezier point evaluation
function cubicBezier(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

// Distance from point to line segment
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Pre-sample the C curve
// Path: M 22 10.5 C 19.8 8.2 16.2 7.5 13 9 C 9.8 10.5 7.8 13.8 8 17.2 C 8.2 20.8 10.8 23.8 14.2 24.5 C 17.5 25.1 20.8 23.5 22.5 20.5
const bezierSegments = [
  {
    p0: { x: 22, y: 10.5 },
    p1: { x: 19.8, y: 8.2 },
    p2: { x: 16.2, y: 7.5 },
    p3: { x: 13, y: 9 },
  },
  {
    p0: { x: 13, y: 9 },
    p1: { x: 9.8, y: 10.5 },
    p2: { x: 7.8, y: 13.8 },
    p3: { x: 8, y: 17.2 },
  },
  {
    p0: { x: 8, y: 17.2 },
    p1: { x: 8.2, y: 20.8 },
    p2: { x: 10.8, y: 23.8 },
    p3: { x: 14.2, y: 24.5 },
  },
  {
    p0: { x: 14.2, y: 24.5 },
    p1: { x: 17.5, y: 25.1 },
    p2: { x: 20.8, y: 23.5 },
    p3: { x: 22.5, y: 20.5 },
  },
];

const sampledPoints = [];
const SAMPLES_PER_SEGMENT = 40;
for (const seg of bezierSegments) {
  for (let i = 0; i <= SAMPLES_PER_SEGMENT; i++) {
    sampledPoints.push(
      cubicBezier(seg.p0, seg.p1, seg.p2, seg.p3, i / SAMPLES_PER_SEGMENT)
    );
  }
}

// Signed distance to rounded box
function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - r;
}

// Helper to blend color (src over dst)
function blend(dst, src) {
  const sa = src[3] / 255;
  const da = (dst[3] / 255) * (1 - sa);
  const outA = sa + da;
  if (outA <= 0) return [0, 0, 0, 0];
  return [
    Math.round((src[0] * sa + dst[0] * da) / outA),
    Math.round((src[1] * sa + dst[1] * da) / outA),
    Math.round((src[2] * sa + dst[2] * da) / outA),
    Math.round(outA * 255),
  ];
}

function hexToRgb(hex) {
  const num = parseInt(hex.replace("#", ""), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lerpRgb(c1, c2, t) {
  t = Math.max(0, Math.min(1, t));
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

// Gradient 1: #38bdf8 (0%) -> #3b82f6 (50%) -> #8b5cf6 (100%)
const cGrad0 = hexToRgb("#38bdf8");
const cGrad50 = hexToRgb("#3b82f6");
const cGrad100 = hexToRgb("#8b5cf6");
function getCradleGrad(t) {
  if (t < 0.5) {
    return lerpRgb(cGrad0, cGrad50, t * 2);
  }
  return lerpRgb(cGrad50, cGrad100, (t - 0.5) * 2);
}

// Accent gradient: #60a5fa (0%) -> #c084fc (100%)
const cAcc0 = hexToRgb("#60a5fa");
const cAcc100 = hexToRgb("#c084fc");
function getAccentGrad(t) {
  return lerpRgb(cAcc0, cAcc100, t);
}

function renderPixel(x, y, width, height, isMaskable = false) {
  // Coordinate in 0..32 space
  const scale = 32 / width;
  const sx = (x + 0.5) * scale;
  const sy = (y + 0.5) * scale;
  const pixelScale = 32 / width; // size of 1 pixel in 32-space

  let pixel = [0, 0, 0, 0];

  // 1. Background
  if (isMaskable) {
    // Solid background across entire area for maskable
    pixel = [7, 10, 19, 255]; // #070a13
  } else {
    // Rounded rect: width 32, height 32, rx 7
    const distBg = sdRoundedBox(sx - 16, sy - 16, 16, 16, 7);
    const alphaBg = Math.max(0, Math.min(1, 0.5 - distBg / pixelScale));
    if (alphaBg > 0) {
      pixel = [7, 10, 19, Math.round(alphaBg * 255)];
    }
  }

  // 2. Stroke rect: width 30, height 30, rx 6, centered
  const distStrokeBox = sdRoundedBox(sx - 16, sy - 16, 15, 15, 6);
  const strokeBorderDist = Math.abs(distStrokeBox); // centered on boundary
  const strokeHalfWidth = 0.5;
  if (strokeBorderDist < strokeHalfWidth + pixelScale) {
    const strokeAlpha =
      Math.max(
        0,
        Math.min(1, 0.5 - (strokeBorderDist - strokeHalfWidth) / pixelScale)
      ) * 0.35;
    if (strokeAlpha > 0) {
      const t = (sx + sy) / 64;
      const col = getCradleGrad(t);
      pixel = blend(pixel, [...col, Math.round(strokeAlpha * 255)]);
    }
  }

  // 3. Stylized 'C' curve (stroke-width: 3, radius: 1.5)
  let minCurveDist = Infinity;
  for (let i = 0; i < sampledPoints.length - 1; i++) {
    const pA = sampledPoints[i];
    const pB = sampledPoints[i + 1];
    const d = distToSegment(sx, sy, pA.x, pA.y, pB.x, pB.y);
    if (d < minCurveDist) minCurveDist = d;
  }
  const curveRadius = 1.5;
  if (minCurveDist < curveRadius + pixelScale) {
    const curveAlpha = Math.max(
      0,
      Math.min(1, 0.5 - (minCurveDist - curveRadius) / pixelScale)
    );
    if (curveAlpha > 0) {
      const t = (sx + sy) / 64;
      const col = getCradleGrad(t);
      pixel = blend(pixel, [...col, Math.round(curveAlpha * 255)]);
    }
  }

  // 4. Circle at cx: 17, cy: 16, r: 2.5
  const distCircle = Math.hypot(sx - 17, sy - 16);
  const circleRadius = 2.5;
  if (distCircle < circleRadius + pixelScale) {
    const circleAlpha = Math.max(
      0,
      Math.min(1, 0.5 - (distCircle - circleRadius) / pixelScale)
    );
    if (circleAlpha > 0) {
      const t = (sx + (32 - sy)) / 64;
      const col = getAccentGrad(t);
      pixel = blend(pixel, [...col, Math.round(circleAlpha * 255)]);
    }
  }

  return pixel;
}

// Generate icons
const assetsDir = path.resolve(__dirname, "..", "assets");
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const icons = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-192-maskable.png", size: 192, maskable: true },
  { name: "icon-512-maskable.png", size: 512, maskable: true },
];

for (const icon of icons) {
  const filePath = path.join(assetsDir, icon.name);
  const buf = createPng(icon.size, icon.size, (x, y, w, h) =>
    renderPixel(x, y, w, h, icon.maskable)
  );
  fs.writeFileSync(filePath, buf);
  console.log(
    `Generated ${icon.name} (${icon.size}x${icon.size}, ${buf.length} bytes)`
  );
}
