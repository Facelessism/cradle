/**
 * Matrix Storage & Preset Manager
 * Handles built-in matrix presets, localStorage persistence, and LaTeX / JSON / CSV exports.
 */
(function (exports) {
  "use strict";

  const storage =
    typeof window !== "undefined" && window.CradleStorage
      ? window.CradleStorage
      : require("../../../src/components/ui/storage.js");

  const STORAGE_KEY = "cradle_matrix_playground_saved_v1";

  const PRESETS = {
    identity3: {
      name: "3x3 Identity Matrix",
      matrix: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
      ]
    },
    rotation45: {
      name: "2D 45° Rotation Matrix",
      matrix: [
        [0.7071, -0.7071],
        [0.7071, 0.7071]
      ]
    },
    shear2d: {
      name: "2D Shear Matrix",
      matrix: [
        [1, 1.5],
        [0, 1]
      ]
    },
    magicSquare3: {
      name: "3x3 Magic Square Matrix",
      matrix: [
        [8, 1, 6],
        [3, 5, 7],
        [4, 9, 2]
      ]
    },
    symmetric3: {
      name: "3x3 Symmetric Matrix",
      matrix: [
        [4, 1, -2],
        [1, 2, 0],
        [-2, 0, 5]
      ]
    },
    hilbert3: {
      name: "3x3 Hilbert Matrix",
      matrix: [
        [1.0, 0.5, 0.3333],
        [0.5, 0.3333, 0.25],
        [0.3333, 0.25, 0.2]
      ]
    }
  };

  function getPresets() {
    return PRESETS;
  }

  function getPreset(key) {
    return PRESETS[key] ? PRESETS[key].matrix : null;
  }

  function saveCustomMatrix(name, matrix) {
    const current = getSavedMatrices();
    current[name] = {
      name,
      matrix,
      timestamp: Date.now()
    };
    return storage.set(STORAGE_KEY, current);
  }

  function getSavedMatrices() {
    const saved = storage.get(STORAGE_KEY, {});
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  }

  function deleteSavedMatrix(name) {
    const current = getSavedMatrices();
    delete current[name];
    return storage.set(STORAGE_KEY, current);
  }

  /**
   * Format matrix into LaTeX matrix block string.
   */
  function toLaTeX(matrix, env = "bmatrix") {
    if (!matrix || !matrix.length) return "";
    const rows = matrix.map(row => row.map(val => Number(val.toFixed(4))).join(" & "));
    return `\\begin{${env}}\n` + rows.map(r => `  ${r} \\\\`).join("\n") + `\n\\end{${env}}`;
  }

  /**
   * Format matrix into CSV string.
   */
  function toCSV(matrix) {
    if (!matrix || !matrix.length) return "";
    return matrix.map(row => row.join(",")).join("\n");
  }

  /**
   * Format matrix into JSON payload string.
   */
  function toJSON(matrix) {
    return JSON.stringify(matrix, null, 2);
  }

  /**
   * Parse CSV or JSON string into matrix array.
   */
  function parseMatrixString(str) {
    const trimmed = str.trim();
    if (trimmed.startsWith("[")) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
        return parsed;
      }
    }
    // Parse CSV
    const lines = trimmed.split("\n").filter(l => l.trim().length > 0);
    return lines.map(line => line.split(",").map(val => parseFloat(val.trim())));
  }

  exports.getPresets = getPresets;
  exports.getPreset = getPreset;
  exports.saveCustomMatrix = saveCustomMatrix;
  exports.getSavedMatrices = getSavedMatrices;
  exports.deleteSavedMatrix = deleteSavedMatrix;
  exports.toLaTeX = toLaTeX;
  exports.toCSV = toCSV;
  exports.toJSON = toJSON;
  exports.parseMatrixString = parseMatrixString;
})(typeof exports === "undefined" ? (window.MatrixStorage = {}) : exports);
