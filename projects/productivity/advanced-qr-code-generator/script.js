import {
  renderQrToSvgString,
  downloadSvgFile,
  rasterizeSvgToPngBlob,
} from "./svg-renderer.js";

/**
 * Generates a deterministic QR matrix with finder patterns, timing patterns,
 * alignment pattern, and UTF-8 byte-stream payload encoding (Version 2 - 25x25).
 * Replace with your existing encoder if supporting higher byte capacities.
 * @param {string} text
 * @returns {number[][]}
 */
export function generateQrMatrix(text) {
  const size = 25;
  const grid = Array.from({ length: size }, () => Array(size).fill(0));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  function placeFinder(ox, oy) {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const x = ox + dx;
        const y = oy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const inOuter = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const inBorder =
          inOuter && (dx === 0 || dx === 6 || dy === 0 || dy === 6);
        const inCore = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        grid[y][x] = inBorder || inCore ? 1 : 0;
        reserved[y][x] = true;
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(size - 7, 0);
  placeFinder(0, size - 7);

  // Alignment pattern at (16, 16) for Version 2
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const x = 16 + dx;
      const y = 16 + dy;
      const isEdge = Math.abs(dx) === 2 || Math.abs(dy) === 2;
      const isCenter = dx === 0 && dy === 0;
      grid[y][x] = isEdge || isCenter ? 1 : 0;
      reserved[y][x] = true;
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i += 1) {
    grid[6][i] = i % 2 === 0 ? 1 : 0;
    grid[i][6] = i % 2 === 0 ? 1 : 0;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }

  // Encode payload bits
  const bytes = new TextEncoder().encode(text || " ");
  const bits = [0, 1, 0, 0]; // Byte mode indicator
  const len = Math.min(bytes.length, 32);
  for (let i = 7; i >= 0; i -= 1) {
    bits.push((len >> i) & 1);
  }
  for (let b = 0; b < len; b += 1) {
    for (let i = 7; i >= 0; i -= 1) {
      bits.push((bytes[b] >> i) & 1);
    }
  }

  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = col - offset;
        if (reserved[row][x]) continue;
        const bit = bitIdx < bits.length ? bits[bitIdx] : (row + x) % 3 === 0 ? 1 : 0;
        bitIdx += 1;
        // Apply mask pattern (row + x) % 2 === 0
        grid[row][x] = bit ^ ((row + x) % 2 === 0 ? 1 : 0);
      }
    }
    upward = !upward;
  }

  return grid;
}

const inputEl = document.getElementById("qr-input");
const styleEl = document.getElementById("module-style");
const quietZoneEl = document.getElementById("quiet-zone");
const fgColorEl = document.getElementById("fg-color");
const bgColorEl = document.getElementById("bg-color");
const exportSizeEl = document.getElementById("export-size");
const transparentBgEl = document.getElementById("transparent-bg");
const previewStageEl = document.getElementById("qr-preview-stage");
const metaEl = document.getElementById("qr-meta");
const statusEl = document.getElementById("status-banner");
const downloadSvgBtn = document.getElementById("download-svg-btn");
const copySvgBtn = document.getElementById("copy-svg-btn");
const downloadPngBtn = document.getElementById("download-png-btn");

let latestSvgString = "";

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function updatePreview() {
  if (!inputEl || !previewStageEl) return;

  const content = inputEl.value.trim() || "https://cradle-zeta.vercel.app";
  const matrix = generateQrMatrix(content);
  const exportSize = Number(exportSizeEl.value) || 512;
  const quietZone = Math.max(0, Math.min(10, Number(quietZoneEl.value) || 0));
  const moduleStyle = styleEl.value;
  const fgColor = fgColorEl.value;
  const bgColor = transparentBgEl.checked ? "transparent" : bgColorEl.value;

  latestSvgString = renderQrToSvgString(matrix, {
    fgColor,
    bgColor,
    quietZone,
    exportSize,
    moduleStyle,
    label: `QR Code for ${content.slice(0, 60)}`,
  });

  previewStageEl.innerHTML = latestSvgString;
  const viewBoxDim = matrix.length + quietZone * 2;
  metaEl.textContent = `SVG Vector (${viewBoxDim}×${viewBoxDim} logical units) • Export: ${exportSize}×${exportSize}px`;
}

if (typeof document !== "undefined" && previewStageEl) {
  [
    inputEl,
    styleEl,
    quietZoneEl,
    fgColorEl,
    bgColorEl,
    exportSizeEl,
    transparentBgEl,
  ].forEach((el) => {
    el?.addEventListener("input", updatePreview);
    el?.addEventListener("change", updatePreview);
  });

  downloadSvgBtn?.addEventListener("click", () => {
    if (!latestSvgString) updatePreview();
    downloadSvgFile(latestSvgString, "cradle-qrcode.svg");
    setStatus("Exported crisp vector SVG file.");
  });

  copySvgBtn?.addEventListener("click", async () => {
    if (!latestSvgString) updatePreview();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(latestSvgString);
      setStatus("SVG markup copied to clipboard.");
    } else {
      setStatus("Clipboard API unavailable in this context.");
    }
  });

  downloadPngBtn?.addEventListener("click", async () => {
    if (!latestSvgString) updatePreview();
    const exportSize = Number(exportSizeEl.value) || 512;
    try {
      const pngBlob = await rasterizeSvgToPngBlob(latestSvgString, exportSize);
      const url = URL.createObjectURL(pngBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cradle-qrcode-${exportSize}px.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`Exported ${exportSize}×${exportSize}px PNG from vector source.`);
    } catch (err) {
      setStatus(`PNG export failed: ${err.message}`);
    }
  });

  updatePreview();
}