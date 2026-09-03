/**
 * CSS Shape Designer Engine (shapeEngine.js)
 * Core shape calculation, clip-path formatting, SVG paths, and Tailwind exporters.
 * UMD compliant for Node.js test suites and browser execution.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ShapeEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const PRESETS = {
    triangle: [
      { x: 50, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    square: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    pentagon: [
      { x: 50, y: 0 },
      { x: 100, y: 38 },
      { x: 81, y: 100 },
      { x: 19, y: 100 },
      { x: 0, y: 38 },
    ],
    hexagon: [
      { x: 50, y: 0 },
      { x: 100, y: 25 },
      { x: 100, y: 75 },
      { x: 50, y: 100 },
      { x: 0, y: 75 },
      { x: 0, y: 25 },
    ],
    star: [
      { x: 50, y: 0 },
      { x: 63, y: 38 },
      { x: 100, y: 38 },
      { x: 69, y: 59 },
      { x: 82, y: 100 },
      { x: 50, y: 75 },
      { x: 18, y: 100 },
      { x: 31, y: 59 },
      { x: 0, y: 38 },
      { x: 37, y: 38 },
    ],
    rhombus: [
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 },
    ],
  };

  /**
   * Generate CSS clip-path or border-radius code snippet for given shape.
   */
  function generateClipPathCSS(type, shapeData) {
    if (type === "polygon") {
      const vertices = shapeData.vertices || PRESETS.triangle;
      const pointsStr = vertices.map((v) => `${Math.round(v.x)}% ${Math.round(v.y)}%`).join(", ");
      return `clip-path: polygon(${pointsStr});`;
    }

    if (type === "circle") {
      const c = shapeData.circle || { cx: 50, cy: 50, r: 40 };
      return `clip-path: circle(${Math.round(c.r)}% at ${Math.round(c.cx)}% ${Math.round(c.cy)}%);`;
    }

    if (type === "ellipse") {
      const e = shapeData.ellipse || { cx: 50, cy: 50, rx: 40, ry: 30 };
      return `clip-path: ellipse(${Math.round(e.rx)}% ${Math.round(e.ry)}% at ${Math.round(e.cx)}% ${Math.round(e.cy)}%);`;
    }

    if (type === "blob") {
      const b = shapeData.blob || {
        tlh: 30, trh: 70, brh: 70, blh: 30,
        tlv: 30, trv: 30, brv: 70, blv: 70,
      };
      const radiusStr = `${b.tlh}% ${100 - b.trh}% ${100 - b.brh}% ${b.blh}% / ${b.tlv}% ${b.trv}% ${100 - b.brv}% ${100 - b.blv}%`;
      return `border-radius: ${radiusStr};`;
    }

    return "clip-path: none;";
  }

  /**
   * Generate SVG code string representation.
   */
  function generateSVGCode(type, shapeData, width = 200, height = 200) {
    if (type === "polygon") {
      const vertices = shapeData.vertices || PRESETS.triangle;
      const points = vertices
        .map((v) => `${(v.x * width) / 100},${(v.y * height) / 100}`)
        .join(" ");
      return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <polygon points="${points}" fill="#818cf8" />\n</svg>`;
    }

    if (type === "circle") {
      const c = shapeData.circle || { cx: 50, cy: 50, r: 40 };
      const cx = (c.cx * width) / 100;
      const cy = (c.cy * height) / 100;
      const r = (c.r * Math.min(width, height)) / 100;
      return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#818cf8" />\n</svg>`;
    }

    if (type === "ellipse") {
      const e = shapeData.ellipse || { cx: 50, cy: 50, rx: 40, ry: 30 };
      const cx = (e.cx * width) / 100;
      const cy = (e.cy * height) / 100;
      const rx = (e.rx * width) / 100;
      const ry = (e.ry * height) / 100;
      return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#818cf8" />\n</svg>`;
    }

    return `<svg width="${width}" height="${height}"></svg>`;
  }

  /**
   * Generate Tailwind arbitrary value class snippet.
   */
  function generateTailwindCode(type, shapeData) {
    const css = generateClipPathCSS(type, shapeData);
    if (type === "blob") {
      const radiusValue = css.replace("border-radius: ", "").replace(";", "");
      return `class="rounded-[${radiusValue.replace(/\s+/g, "_")}]"`;
    }
    const clipValue = css.replace("clip-path: ", "").replace(";", "");
    return `class="[clip-path:${clipValue.replace(/\s+/g, "_")}]"`;
  }

  return {
    PRESETS,
    generateClipPathCSS,
    generateSVGCode,
    generateTailwindCode,
  };
});
