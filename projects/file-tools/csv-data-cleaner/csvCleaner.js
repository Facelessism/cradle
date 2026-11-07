(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CsvCleaner = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function parseCsv(text) {
    if (typeof text !== "string") {
      throw new Error("CSV input must be a string.");
    }

    if (!text || text.trim() === "") {
      throw new Error("CSV input is empty.");
    }

    const rows = [];
    let field = "";
    let row = [];
    let insideQuotes = false;
    let startOfField = true;
    const warnings = [];

    try {
      for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];

        if (startOfField) {
          startOfField = false;
          if (char === '"') {
            insideQuotes = true;
            continue;
          }
        }

        if (char === '"') {
          if (insideQuotes) {
            if (next === '"') {
              field += '"';
              index += 1;
            } else {
              insideQuotes = false;
              // Validate that characters after the closing quote are only whitespace until next delimiter/newline
              let lookAhead = index + 1;
              while (lookAhead < text.length) {
                const nextChar = text[lookAhead];
                if (
                  nextChar === "," ||
                  nextChar === "\n" ||
                  nextChar === "\r"
                ) {
                  break;
                }
                if (nextChar !== " " && nextChar !== "\t") {
                  throw new Error("The CSV contains malformed quoting.");
                }
                lookAhead += 1;
              }
            }
          } else {
            // Unquoted field has a quote inside it - malformed quoting!
            throw new Error("The CSV contains malformed quoting.");
          }
        } else if (char === "," && !insideQuotes) {
          row.push(field);
          field = "";
          startOfField = true;
        } else if ((char === "\n" || char === "\r") && !insideQuotes) {
          if (char === "\r" && next === "\n") {
            index += 1;
          }
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
          startOfField = true;
        } else {
          field += char;
        }
      }

      if (insideQuotes) {
        throw new Error("The CSV contains malformed quoting.");
      }

      if (field.length > 0 || row.length > 0 || text.endsWith(",")) {
        row.push(field);
        rows.push(row);
      }
    } catch (err) {
      if (
        err.message &&
        err.message.includes("The CSV contains malformed quoting")
      ) {
        throw err;
      }
      throw new Error("The CSV could not be parsed.");
    }

    const headerIndex = rows.findIndex(cells =>
      cells.some(cell => String(cell).trim() !== "")
    );

    if (headerIndex === -1) {
      throw new Error("CSV input is empty.");
    }

    const headers = rows[headerIndex].map((header, index) => {
      const trimmed = header.trim();
      return trimmed || `Column ${index + 1}`;
    });

    const dataRows = rows.slice(headerIndex + 1).map((cells, index) => {
      const rowIndex = index + headerIndex + 2;
      const isEmpty = cells.every(cell => String(cell).trim() === "");
      if (!isEmpty && cells.length !== headers.length) {
        warnings.push(
          `Row ${rowIndex} has an unexpected number of columns (expected ${headers.length}, got ${cells.length}).`
        );
      }
      return normalizeRowLength(cells, headers.length);
    });

    return { headers, rows: dataRows, warnings };
  }

  function normalizeRowLength(row, length) {
    const normalized = row.slice(0, length);
    while (normalized.length < length) {
      normalized.push("");
    }
    return normalized;
  }

  function ensureValidDataset(dataset) {
    if (!dataset || typeof dataset !== "object") {
      return { headers: [], rows: [], warnings: [] };
    }
    return {
      headers: Array.isArray(dataset.headers) ? dataset.headers : [],
      rows: Array.isArray(dataset.rows)
        ? dataset.rows.map(r => (Array.isArray(r) ? r : []))
        : [],
      warnings: Array.isArray(dataset.warnings) ? dataset.warnings : [],
    };
  }

  function trimCells(inputDataset) {
    const dataset = ensureValidDataset(inputDataset);
    return {
      headers: dataset.headers.map(header => String(header).trim()),
      rows: dataset.rows.map(row => row.map(cell => String(cell).trim())),
      warnings: dataset.warnings.slice(),
    };
  }

  function isEmptyRow(row) {
    if (!Array.isArray(row)) return true;
    return row.every(cell => String(cell).trim() === "");
  }

  function removeEmptyRows(inputDataset) {
    const dataset = ensureValidDataset(inputDataset);
    return {
      headers: dataset.headers.slice(),
      rows: dataset.rows.filter(row => !isEmptyRow(row)),
      warnings: dataset.warnings.slice(),
    };
  }

  function removeDuplicateRows(inputDataset) {
    const dataset = ensureValidDataset(inputDataset);
    const seen = new Set();
    const rows = [];

    for (const row of dataset.rows) {
      const key = JSON.stringify(row.map(cell => String(cell)));
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(row.slice());
      }
    }

    return {
      headers: dataset.headers.slice(),
      rows,
      warnings: dataset.warnings.slice(),
    };
  }

  function detectMissingValues(inputDataset) {
    const dataset = ensureValidDataset(inputDataset);
    const missing = [];

    dataset.rows.forEach((row, rowIndex) => {
      dataset.headers.forEach((header, columnIndex) => {
        if (String(row[columnIndex] || "").trim() === "") {
          missing.push({
            rowIndex,
            columnIndex,
            header,
          });
        }
      });
    });

    return missing;
  }

  // =========================================================
  // COLUMN TYPE PROFILING & ANOMALY DETECTION
  // =========================================================

  const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
  const DATE_COMMON_REGEX = /^(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?$/;
  const NUMERIC_REGEX = /^[+-]?(?:\$|€|£|¥)?\s*[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?%?$/;
  const BOOLEAN_REGEX = /^(?:true|false|yes|no|1|0|t|f)$/i;

  function parseNumericValue(raw) {
    if (typeof raw === "number") return raw;
    if (typeof raw !== "string") return NaN;
    const cleaned = raw.trim().replace(/[\$,€£¥%]/g, "").replace(/\s+/g, "");
    if (!cleaned) return NaN;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : NaN;
  }

  function isNumericString(str) {
    if (typeof str !== "string") return false;
    const trimmed = str.trim();
    if (!trimmed) return false;
    return NUMERIC_REGEX.test(trimmed) && !isNaN(parseNumericValue(trimmed));
  }

  function isDateString(str) {
    if (typeof str !== "string") return false;
    const trimmed = str.trim();
    if (!trimmed || trimmed.length < 6) return false;
    if (DATE_ISO_REGEX.test(trimmed) || DATE_COMMON_REGEX.test(trimmed)) {
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) {
        const year = new Date(parsed).getFullYear();
        return year >= 1800 && year <= 2200;
      }
    }
    return false;
  }

  function isBooleanString(str) {
    if (typeof str !== "string") return false;
    return BOOLEAN_REGEX.test(str.trim());
  }

  /**
   * Infer column types and calculate summary statistics.
   */
  function profileColumns(inputDataset) {
    const dataset = ensureValidDataset(inputDataset);
    const totalRows = dataset.rows.length;

    return dataset.headers.map((header, columnIndex) => {
      const rawValues = dataset.rows.map(row => (row[columnIndex] !== undefined ? String(row[columnIndex]) : ""));
      const nonBlankValues = rawValues.filter(val => val.trim() !== "");
      const missingCount = totalRows - nonBlankValues.length;
      const missingPct = totalRows > 0 ? (missingCount / totalRows) * 100 : 0;

      if (nonBlankValues.length === 0) {
        return {
          header,
          columnIndex,
          inferredType: "Unknown",
          totalCount: totalRows,
          nonBlankCount: 0,
          missingCount,
          missingPct: Math.round(missingPct * 10) / 10,
          uniqueCount: 0,
          stats: null,
        };
      }

      let numericCount = 0;
      let dateCount = 0;
      let booleanCount = 0;
      const freqMap = new Map();
      const numericList = [];

      nonBlankValues.forEach(val => {
        const trimmed = val.trim();
        freqMap.set(trimmed, (freqMap.get(trimmed) || 0) + 1);

        if (isNumericString(trimmed)) {
          numericCount += 1;
          numericList.push(parseNumericValue(trimmed));
        }
        if (isDateString(trimmed)) {
          dateCount += 1;
        }
        if (isBooleanString(trimmed)) {
          booleanCount += 1;
        }
      });

      const count = nonBlankValues.length;
      let inferredType = "String";

      if (booleanCount === count || (count >= 3 && booleanCount / count >= 0.95)) {
        inferredType = "Boolean";
      } else if (numericCount / count >= 0.85) {
        inferredType = "Numeric";
      } else if (dateCount / count >= 0.85) {
        inferredType = "DateTime";
      } else {
        const uniqueCount = freqMap.size;
        // Categorical if small discrete set or high repetition ratio
        if (uniqueCount <= 10 || (count >= 6 && uniqueCount / count <= 0.4)) {
          inferredType = "Categorical";
        } else {
          inferredType = "String";
        }
      }

      // Calculate statistics
      const stats = {
        uniqueCount: freqMap.size,
        topValues: Array.from(freqMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([value, count]) => ({ value, count })),
      };

      if (inferredType === "Numeric" && numericList.length > 0) {
        numericList.sort((a, b) => a - b);
        const sum = numericList.reduce((acc, curr) => acc + curr, 0);
        const mean = sum / numericList.length;
        const mid = Math.floor(numericList.length / 2);
        const median =
          numericList.length % 2 !== 0
            ? numericList[mid]
            : (numericList[mid - 1] + numericList[mid]) / 2;

        const q1Index = Math.floor(numericList.length * 0.25);
        const q3Index = Math.floor(numericList.length * 0.75);
        const q1 = numericList[q1Index];
        const q3 = numericList[q3Index];
        const iqr = q3 - q1;

        stats.min = numericList[0];
        stats.max = numericList[numericList.length - 1];
        stats.mean = Math.round(mean * 100) / 100;
        stats.median = Math.round(median * 100) / 100;
        stats.q1 = q1;
        stats.q3 = q3;
        stats.iqr = iqr;
        stats.outlierLower = q1 - 1.5 * iqr;
        stats.outlierUpper = q3 + 1.5 * iqr;
      }

      return {
        header,
        columnIndex,
        inferredType,
        totalCount: totalRows,
        nonBlankCount: count,
        missingCount,
        missingPct: Math.round(missingPct * 10) / 10,
        uniqueCount: freqMap.size,
        stats,
      };
    });
  }

  /**
   * Detect anomalies across all cells:
   * - Outliers (numeric IQR)
   * - Unexpected whitespace (leading, trailing, or multiple internal spaces)
   * - Mixed formatting / type inconsistencies
   */
  function detectAnomalies(inputDataset, profiles = null) {
    const dataset = ensureValidDataset(inputDataset);
    const colProfiles = profiles || profileColumns(dataset);
    const anomalies = [];

    dataset.rows.forEach((row, rowIndex) => {
      colProfiles.forEach(profile => {
        const colIdx = profile.columnIndex;
        const cell = row[colIdx] !== undefined ? String(row[colIdx]) : "";
        const trimmed = cell.trim();

        if (trimmed === "") {
          return; // Missing values handled separately
        }

        // 1. Check for unexpected whitespace anomalies
        if (cell !== trimmed || /\s{2,}/.test(cell) || cell.includes("\t") || cell.includes("\u00A0")) {
          anomalies.push({
            rowIndex,
            columnIndex: colIdx,
            header: profile.header,
            value: cell,
            type: "whitespace",
            description: `Unexpected whitespace (leading, trailing, or multiple spaces) in "${profile.header}".`,
          });
        }

        // 2. Check for type inconsistency / mixed formatting
        if (profile.inferredType === "Numeric") {
          if (!isNumericString(trimmed)) {
            anomalies.push({
              rowIndex,
              columnIndex: colIdx,
              header: profile.header,
              value: cell,
              type: "mixed_format",
              description: `Non-numeric value "${cell}" in predominantly Numeric column "${profile.header}".`,
            });
          } else if (profile.stats && profile.stats.iqr > 0) {
            const numVal = parseNumericValue(trimmed);
            if (numVal < profile.stats.outlierLower || numVal > profile.stats.outlierUpper) {
              anomalies.push({
                rowIndex,
                columnIndex: colIdx,
                header: profile.header,
                value: cell,
                type: "outlier",
                description: `Outlier value ${cell} (IQR expected range: [${profile.stats.outlierLower}, ${profile.stats.outlierUpper}]).`,
              });
            }
          }
        } else if (profile.inferredType === "DateTime") {
          if (!isDateString(trimmed)) {
            anomalies.push({
              rowIndex,
              columnIndex: colIdx,
              header: profile.header,
              value: cell,
              type: "mixed_format",
              description: `Non-date value "${cell}" in predominantly DateTime column "${profile.header}".`,
            });
          }
        } else if (profile.inferredType === "Boolean") {
          if (!isBooleanString(trimmed)) {
            anomalies.push({
              rowIndex,
              columnIndex: colIdx,
              header: profile.header,
              value: cell,
              type: "mixed_format",
              description: `Non-boolean value "${cell}" in Boolean column "${profile.header}".`,
            });
          }
        }
      });
    });

    return anomalies;
  }

  // =========================================================
  // ONE-CLICK BATCH TRANSFORMATIONS
  // =========================================================

  /**
   * Impute missing values using mean, median, or mode.
   * Strategy can be "auto" (mean/median for numeric, mode for others), "mean", "median", or "mode".
   */
  function imputeMissingValues(inputDataset, options = {}) {
    const dataset = ensureValidDataset(inputDataset);
    const strategy = options.strategy || "auto";
    const profiles = profileColumns(dataset);
    let imputedCount = 0;
    const imputationMap = new Map();

    // Determine replacement value for each column
    profiles.forEach(profile => {
      const colIdx = profile.columnIndex;
      let replacement = "";

      if (strategy === "mean" && profile.inferredType === "Numeric" && profile.stats) {
        replacement = String(profile.stats.mean);
      } else if (strategy === "median" && profile.inferredType === "Numeric" && profile.stats) {
        replacement = String(profile.stats.median);
      } else if (strategy === "mode" || (strategy === "auto" && profile.inferredType !== "Numeric")) {
        if (profile.stats && profile.stats.topValues && profile.stats.topValues.length > 0) {
          replacement = profile.stats.topValues[0].value;
        }
      } else if (strategy === "auto" && profile.inferredType === "Numeric" && profile.stats) {
        replacement = String(profile.stats.median !== undefined ? profile.stats.median : profile.stats.mean);
      }

      if (replacement) {
        imputationMap.set(colIdx, replacement);
      }
    });

    const newRows = dataset.rows.map(row => {
      return row.map((cell, colIdx) => {
        if (String(cell || "").trim() === "" && imputationMap.has(colIdx)) {
          imputedCount += 1;
          return imputationMap.get(colIdx);
        }
        return cell;
      });
    });

    return {
      dataset: {
        headers: dataset.headers.slice(),
        rows: newRows,
        warnings: dataset.warnings.slice(),
      },
      imputedCount,
      imputationMap: Object.fromEntries(
        Array.from(imputationMap.entries()).map(([idx, val]) => [dataset.headers[idx] || idx, val])
      ),
    };
  }

  /**
   * Normalize text cells:
   * - Trim leading and trailing whitespace
   * - Collapse multiple consecutive internal spaces to single space
   * - Remove control characters
   */
  function normalizeTextCells(inputDataset, options = {}) {
    const dataset = ensureValidDataset(inputDataset);
    let modifiedCount = 0;

    const newRows = dataset.rows.map(row => {
      return row.map(cell => {
        if (typeof cell !== "string") return cell;
        // Trim and collapse multiple spaces/tabs
        const normalized = cell
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // Strip control characters
          .replace(/[\t\u00A0]/g, " ") // Convert tabs and non-breaking spaces
          .replace(/\s{2,}/g, " ") // Collapse multiple spaces
          .trim();

        if (normalized !== cell) {
          modifiedCount += 1;
        }
        return normalized;
      });
    });

    return {
      dataset: {
        headers: dataset.headers.map(h => h.trim().replace(/\s{2,}/g, " ")),
        rows: newRows,
        warnings: dataset.warnings.slice(),
      },
      modifiedCount,
    };
  }

  /**
   * Export dataset as JSON array of objects.
   * If options.typed is true, converts numeric/boolean strings to native JSON types.
   */
  function exportJson(inputDataset, options = {}) {
    const dataset = ensureValidDataset(inputDataset);
    const typed = options.typed !== false;
    const indent = options.indent !== undefined ? options.indent : 2;
    const profiles = typed ? profileColumns(dataset) : null;

    const records = dataset.rows.map(row => {
      const record = {};
      dataset.headers.forEach((header, colIdx) => {
        const val = row[colIdx];
        if (val === undefined || val === null || String(val).trim() === "") {
          record[header] = null;
        } else if (typed && profiles) {
          const profile = profiles[colIdx];
          const trimmed = String(val).trim();
          if (profile && profile.inferredType === "Numeric" && isNumericString(trimmed)) {
            record[header] = parseNumericValue(trimmed);
          } else if (profile && profile.inferredType === "Boolean" && isBooleanString(trimmed)) {
            record[header] = /^(true|yes|1|t)$/i.test(trimmed);
          } else {
            record[header] = val;
          }
        } else {
          record[header] = val;
        }
      });
      return record;
    });

    return JSON.stringify(records, null, indent);
  }

  function cleanDataset(inputDataset, options = {}) {
    const dataset = ensureValidDataset(inputDataset);
    const beforeRows = dataset.rows.length;
    let cleaned = {
      headers: dataset.headers.slice(),
      rows: dataset.rows.map(row =>
        normalizeRowLength(row, dataset.headers.length)
      ),
      warnings: dataset.warnings.slice(),
    };

    if (options.trimSpaces !== false) {
      cleaned = trimCells(cleaned);
    }

    let emptyRowsRemoved = 0;
    if (options.removeEmptyRows !== false) {
      const rowsBeforeEmpty = cleaned.rows.length;
      cleaned = removeEmptyRows(cleaned);
      emptyRowsRemoved = rowsBeforeEmpty - cleaned.rows.length;
    }

    let duplicateRowsRemoved = 0;
    if (options.removeDuplicates !== false) {
      const rowsBeforeDuplicates = cleaned.rows.length;
      cleaned = removeDuplicateRows(cleaned);
      duplicateRowsRemoved = rowsBeforeDuplicates - cleaned.rows.length;
    }

    const missingValues = detectMissingValues(cleaned);
    const profiles = profileColumns(cleaned);
    const anomalies = detectAnomalies(cleaned, profiles);
    const warnings = dataset.warnings || [];

    return {
      dataset: cleaned,
      summary: {
        beforeRows,
        afterRows: cleaned.rows.length,
        emptyRowsRemoved,
        duplicateRowsRemoved,
        missingValueCount: missingValues.length,
        missingValues,
        anomaliesCount: anomalies.length,
        anomalies,
        profiles,
        warnings,
      },
    };
  }

  function escapeCsvCell(value) {
    const text = String(value == null ? "" : value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function exportCsv(inputDataset) {
    const dataset = ensureValidDataset(inputDataset);
    const lines = [
      dataset.headers.map(escapeCsvCell).join(","),
      ...dataset.rows.map(row =>
        normalizeRowLength(row, dataset.headers.length)
          .map(escapeCsvCell)
          .join(",")
      ),
    ];

    return lines.join("\n");
  }

  function analyzeCsv(text, options = {}) {
    const parsed = parseCsv(text);
    return cleanDataset(parsed, options);
  }

  return {
    analyzeCsv,
    cleanDataset,
    detectMissingValues,
    detectAnomalies,
    escapeCsvCell,
    exportCsv,
    exportJson,
    imputeMissingValues,
    isEmptyRow,
    normalizeRowLength,
    normalizeTextCells,
    parseCsv,
    profileColumns,
    removeDuplicateRows,
    removeEmptyRows,
    trimCells,
  };
});
