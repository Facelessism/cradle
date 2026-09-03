/**
 * ASCII Exporter Module
 * Provides export functions: Plain Text (.txt), HTML Document (.html), SVG Image (.svg).
 */
(function (exports) {
  "use strict";

  /**
   * Export ASCII lines to plain text string.
   */
  function toPlainText(lines) {
    return Array.isArray(lines) ? lines.join("\n") : String(lines);
  }

  /**
   * Export ASCII lines to styled HTML document string.
   */
  function toHTML(lines, options = {}) {
    const { title = "ASCII Art Export", bgColor = "#0f172a", textColor = "#38bdf8" } = options;
    const content = toPlainText(lines);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      background-color: ${bgColor};
      color: ${textColor};
      font-family: "Courier New", Courier, monospace;
      font-size: 10px;
      line-height: 8px;
      white-space: pre;
      margin: 20px;
    }
  </style>
</head>
<body>
${content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
</body>
</html>`;
  }

  /**
   * Export ASCII lines to scalable SVG document string.
   */
  function toSVG(lines, options = {}) {
    const { fontSize = 12, charWidth = 7, charHeight = 12, bgColor = "#0f172a", textColor = "#38bdf8" } = options;
    if (!lines || !lines.length) return "";

    const width = lines[0].length * charWidth;
    const height = lines.length * charHeight;

    const textNodes = lines.map((line, idx) => {
      const y = (idx + 1) * charHeight;
      const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `  <text x="0" y="${y}">${escaped}</text>`;
    }).join("\n");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bgColor}"/>
  <g font-family="monospace" font-size="${fontSize}px" fill="${textColor}">
${textNodes}
  </g>
</svg>`;
  }

  /**
   * Download generated file string payload.
   */
  function downloadFile(filename, content, mimeType = "text/plain") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exports.toPlainText = toPlainText;
  exports.toHTML = toHTML;
  exports.toSVG = toSVG;
  exports.downloadFile = downloadFile;
})(typeof exports === "undefined" ? (window.ASCIIExporter = {}) : exports);
