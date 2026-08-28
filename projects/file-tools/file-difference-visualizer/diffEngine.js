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
  /**
   * Configurable size limits to protect against expensive diffs.
   */
  const SIZE_LIMITS = {
    /** Maximum combined line count before rejecting the diff. */
    maxLines: 50000,
    /** Maximum file size in bytes before rejecting the upload. */
    maxFileSize: 5 * 1024 * 1024, // 5 MB
    /** Maximum character count for inline text input. */
    maxCharCount: 2 * 1024 * 1024, // 2 MB
  };

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
    const ignoreWhitespace = !!options.ignoreWhitespace;
    const ignoreCase = !!options.ignoreCase;
    const maxLines = options.maxLines || SIZE_LIMITS.maxLines;

    const rawLinesA = splitLines(textA);
    const rawLinesB = splitLines(textB);

    const totalLines = rawLinesA.length + rawLinesB.length;
    if (totalLines > maxLines) {
      return {
        error: true,
        message: `Files too large for diff (${totalLines.toLocaleString()} lines, limit: ${maxLines.toLocaleString()}). Reduce file size or increase the limit.`,
        totalLines,
        maxLines,
      };
    }

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
    splitLines,
    computeCharDiff,
    computeLineDiff,
    computeDiffStats,
    generateUnifiedPatch,
    SIZE_LIMITS,
  };
});
