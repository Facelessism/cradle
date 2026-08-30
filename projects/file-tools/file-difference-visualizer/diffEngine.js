/**
 * File Difference Visualizer Engine (diffEngine.js)
 * High-performance line and word-level diffing algorithms.
 * Supports UMD loading for both Node.js tests and browser runtime.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DiffEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const DEFAULT_MAX_FILE_SIZE_BYTES = 1048576; // 1 MB
  const DEFAULT_MAX_LINE_COUNT = 5000;

  /**
   * Helper to compute byte size of a string.
   */
  function getByteSize(str) {
    if (!str) return 0;
    if (typeof Blob !== "undefined") {
      return new Blob([str]).size;
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.byteLength(str, "utf8");
    }
    return str.length;
  }

  /**
   * Validates input sizes against byte size and line count limits.
   *
   * @param {string} textA - Original text input.
   * @param {string} textB - Modified text input.
   * @param {Object} [options] - Options object with maxSizeBytes and maxLines.
   * @returns {{valid: boolean, error: string|null, exceededLimit: string|null}}
   */
  function validateInputSize(textA = "", textB = "", options = {}) {
    const maxSizeBytes =
      options.maxSizeBytes != null
        ? options.maxSizeBytes
        : DEFAULT_MAX_FILE_SIZE_BYTES;
    const maxLines =
      options.maxLines != null ? options.maxLines : DEFAULT_MAX_LINE_COUNT;

    const sizeA = getByteSize(textA);
    if (sizeA > maxSizeBytes) {
      return {
        valid: false,
        error: `Original file (A) size (${sizeA} bytes) exceeds maximum limit of ${maxSizeBytes} bytes.`,
        exceededLimit: "size",
        file: "A",
        size: sizeA,
        limit: maxSizeBytes,
      };
    }

    const sizeB = getByteSize(textB);
    if (sizeB > maxSizeBytes) {
      return {
        valid: false,
        error: `Modified file (B) size (${sizeB} bytes) exceeds maximum limit of ${maxSizeBytes} bytes.`,
        exceededLimit: "size",
        file: "B",
        size: sizeB,
        limit: maxSizeBytes,
      };
    }

    const linesA = splitLines(textA);
    if (linesA.length > maxLines) {
      return {
        valid: false,
        error: `Original file (A) line count (${linesA.length}) exceeds maximum limit of ${maxLines} lines.`,
        exceededLimit: "lines",
        file: "A",
        lines: linesA.length,
        limit: maxLines,
      };
    }

    const linesB = splitLines(textB);
    if (linesB.length > maxLines) {
      return {
        valid: false,
        error: `Modified file (B) line count (${linesB.length}) exceeds maximum limit of ${maxLines} lines.`,
        exceededLimit: "lines",
        file: "B",
        lines: linesB.length,
        limit: maxLines,
      };
    }

    return {
      valid: true,
      error: null,
      exceededLimit: null,
    };
  }

  /**
   * Split string into normalized line array.
   */
  function splitLines(text) {
    if (!text) return [];
    return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  }

  /**
   * Compute character/word-level diff for intra-line changes.
   */
  function computeCharDiff(str1, str2) {
    if (str1 === str2) {
      return [{ type: "equal", value: str1 }];
    }
    const words1 = str1.match(/\S+|\s+/g) || [];
    const words2 = str2.match(/\S+|\s+/g) || [];

    const n = words1.length;
    const m = words2.length;
    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (words1[i - 1] === words2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = n;
    let j = m;
    const diff = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && words1[i - 1] === words2[j - 1]) {
        diff.push({ type: "equal", value: words1[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        diff.push({ type: "add", value: words2[j - 1] });
        j--;
      } else {
        diff.push({ type: "delete", value: words1[i - 1] });
        i--;
      }
    }

    return diff.reverse();
  }

  /**
   * Compute line-by-line diff between two texts using LCS.
   */
  function computeLineDiff(textA, textB, options = {}) {
    const validation = validateInputSize(textA, textB, options);
    if (!validation.valid) {
      const emptyAlignment = [];
      emptyAlignment.error = validation.error;
      emptyAlignment.validation = validation;
      return emptyAlignment;
    }

    const ignoreWhitespace = !!options.ignoreWhitespace;
    const ignoreCase = !!options.ignoreCase;

    const rawLinesA = splitLines(textA);
    const rawLinesB = splitLines(textB);

    const norm = (line) => {
      let s = line;
      if (ignoreWhitespace) s = s.trim().replace(/\s+/g, " ");
      if (ignoreCase) s = s.toLowerCase();
      return s;
    };

    const linesA = rawLinesA.map(norm);
    const linesB = rawLinesB.map(norm);

    const n = linesA.length;
    const m = linesB.length;

    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (linesA[i - 1] === linesB[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = n;
    let j = m;
    const alignment = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
        alignment.push({
          type: "equal",
          valA: rawLinesA[i - 1],
          valB: rawLinesB[j - 1],
          lineA: i,
          lineB: j,
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        alignment.push({
          type: "add",
          valB: rawLinesB[j - 1],
          lineB: j,
        });
        j--;
      } else {
        alignment.push({
          type: "delete",
          valA: rawLinesA[i - 1],
          lineA: i,
        });
        i--;
      }
    }

    alignment.reverse();
    return alignment;
  }

  /**
   * Compute summary statistics from alignment.
   */
  function computeDiffStats(alignment) {
    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    if (!alignment || alignment.error) {
      return {
        additions: 0,
        deletions: 0,
        unchanged: 0,
        totalChanges: 0,
        totalLines: 0,
        error: alignment ? alignment.error : "Invalid alignment",
      };
    }

    for (const item of alignment) {
      if (item.type === "add") additions++;
      else if (item.type === "delete") deletions++;
      else if (item.type === "equal") unchanged++;
    }

    return {
      additions,
      deletions,
      unchanged,
      totalChanges: additions + deletions,
      totalLines: alignment.length,
    };
  }

  /**
   * Generate standard unified patch (.patch) text.
   */
  function generateUnifiedPatch(filenameA, filenameB, alignment) {
    if (!alignment || alignment.error) {
      return `# Error generating patch: ${alignment ? alignment.error : "Invalid alignment"}\n`;
    }
    const nameA = filenameA || "a/original.txt";
    const nameB = filenameB || "b/modified.txt";
    let patch = `--- ${nameA}\n+++ ${nameB}\n@@ -1,${alignment.length} +1,${alignment.length} @@\n`;

    for (const item of alignment) {
      if (item.type === "equal") {
        patch += ` ${item.valA}\n`;
      } else if (item.type === "delete") {
        patch += `-${item.valA}\n`;
      } else if (item.type === "add") {
        patch += `+${item.valB}\n`;
      }
    }

    return patch;
  }

  return {
    DEFAULT_MAX_FILE_SIZE_BYTES,
    DEFAULT_MAX_LINE_COUNT,
    validateInputSize,
    splitLines,
    computeCharDiff,
    computeLineDiff,
    computeDiffStats,
    generateUnifiedPatch,
  };
});

