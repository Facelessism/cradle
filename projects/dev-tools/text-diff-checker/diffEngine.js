"use strict";

/**
 * Text Difference Engine
 * Myers diff algorithm, character & word-level highlighting,
 * configurable ignore rules, and Git Unified Diff (.patch) generator.
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toLines(text) {
  if (!text || text.length === 0) return [];
  // Split on newlines, normalize \r\n to \n
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function toWordTokens(text) {
  if (!text || text.length === 0) return [];
  return text.match(/\S+|\s+/g) || [];
}

function toCharTokens(text) {
  if (!text || text.length === 0) return [];
  return Array.from(text);
}

function normalizeToken(token, options = {}) {
  if (typeof token !== "string") return token;
  let t = token;
  if (options.trimLineEndings) {
    t = t.replace(/\r+$/, "").trimEnd();
  }
  if (options.ignoreWhitespace) {
    t = t.trim().replace(/\s+/g, " ");
  }
  if (options.ignoreCase) {
    t = t.toLowerCase();
  }
  return t;
}

function areTokensEqual(a, b, options = {}) {
  return normalizeToken(a, options) === normalizeToken(b, options);
}

/**
 * Myers Diff Algorithm (SES - Shortest Edit Script)
 * O((N+M)D) time, O(N+M) space.
 * Compares two arrays using an equality predicate.
 */
function myersDiff(a, b, options = {}) {
  const areEqual = options.areEqual || ((x, y) => areTokensEqual(x, y, options));
  const n = a.length;
  const m = b.length;
  const max = n + m;

  if (n === 0 && m === 0) return [];
  if (n === 0) return b.map(val => ({ type: "add", value: val }));
  if (m === 0) return a.map(val => ({ type: "del", value: val }));

  // Trim common prefix
  let prefixCount = 0;
  while (prefixCount < n && prefixCount < m && areEqual(a[prefixCount], b[prefixCount])) {
    prefixCount++;
  }

  // Trim common suffix
  let suffixCount = 0;
  while (
    suffixCount < n - prefixCount &&
    suffixCount < m - prefixCount &&
    areEqual(a[n - 1 - suffixCount], b[m - 1 - suffixCount])
  ) {
    suffixCount++;
  }

  const midA = a.slice(prefixCount, n - suffixCount);
  const midB = b.slice(prefixCount, m - suffixCount);
  const midN = midA.length;
  const midM = midB.length;

  let midOps = [];
  if (midN > 0 || midM > 0) {
    midOps = computeMyersPath(midA, midB, areEqual);
  }

  const result = [];
  for (let i = 0; i < prefixCount; i++) {
    result.push({ type: "equal", value: a[i] });
  }
  for (let i = 0; i < midOps.length; i++) {
    result.push(midOps[i]);
  }
  for (let i = n - suffixCount; i < n; i++) {
    result.push({ type: "equal", value: a[i] });
  }

  return result;
}

function computeMyersPath(a, b, areEqual) {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const vSize = 2 * max + 1;
  const v = new Int32Array(vSize);
  const offset = max;
  const trace = [];

  v[offset + 1] = 0;

  for (let d = 0; d <= max; d++) {
    const vCopy = new Int32Array(v);
    trace.push(vCopy);

    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1]; // move down (add)
      } else {
        x = v[offset + k - 1] + 1; // move right (del)
      }

      let y = x - k;

      while (x < n && y < m && areEqual(a[x], b[y])) {
        x++;
        y++;
      }

      v[offset + k] = x;

      if (x >= n && y >= m) {
        return backtrackMyers(trace, a, b, d, k, offset, areEqual);
      }
    }
  }

  // Fallback if limit reached
  const fallback = [];
  for (const item of a) fallback.push({ type: "del", value: item });
  for (const item of b) fallback.push({ type: "add", value: item });
  return fallback;
}

function backtrackMyers(trace, a, b, d, k, offset, areEqual) {
  let x = trace[d][offset + k];
  let y = x - k;
  const ops = [];

  for (let step = d; step > 0; step--) {
    const vPrev = trace[step - 1];
    let prevK;
    let isDown;

    if (k === -step || (k !== step && vPrev[offset + k - 1] < vPrev[offset + k + 1])) {
      prevK = k + 1;
      isDown = true;
    } else {
      prevK = k - 1;
      isDown = false;
    }

    const prevX = vPrev[offset + prevK];
    const prevY = prevX - prevK;

    while (x > (isDown ? prevX : prevX + 1) && y > prevY) {
      ops.push({ type: "equal", value: a[x - 1] });
      x--;
      y--;
    }

    if (isDown) {
      ops.push({ type: "add", value: b[y - 1] });
      y--;
    } else {
      ops.push({ type: "del", value: a[x - 1] });
      x--;
    }

    k = prevK;
  }

  while (x > 0 && y > 0) {
    ops.push({ type: "equal", value: a[x - 1] });
    x--;
    y--;
  }

  return ops.reverse();
}

/**
 * Generic diffArrays function (compatible with existing LCS API, powered by Myers).
 */
function diffArrays(a, b, options = {}) {
  return myersDiff(a, b, options);
}

/**
 * Word-level diff highlighting between two lines.
 */
function inlineWordDiff(oldLine, newLine, options = {}) {
  const ops = myersDiff(toWordTokens(oldLine), toWordTokens(newLine), options);

  let leftHtml = "";
  let rightHtml = "";

  for (const op of ops) {
    const safe = escapeHtml(op.value);

    if (op.type === "equal") {
      leftHtml += safe;
      rightHtml += safe;
    } else if (op.type === "del") {
      leftHtml += `<span class="word-del">${safe}</span>`;
    } else {
      rightHtml += `<span class="word-add">${safe}</span>`;
    }
  }

  return { leftHtml, rightHtml };
}

/**
 * Sub-word character-level diff highlighting between two lines.
 */
function inlineCharDiff(oldLine, newLine, options = {}) {
  const ops = myersDiff(toCharTokens(oldLine), toCharTokens(newLine), options);

  let leftHtml = "";
  let rightHtml = "";

  for (const op of ops) {
    const safe = escapeHtml(op.value);

    if (op.type === "equal") {
      leftHtml += safe;
      rightHtml += safe;
    } else if (op.type === "del") {
      leftHtml += `<span class="char-del">${safe}</span>`;
    } else {
      rightHtml += `<span class="char-add">${safe}</span>`;
    }
  }

  return { leftHtml, rightHtml };
}

/**
 * Generates a standard Git Unified Diff (.patch) representation.
 */
function generateUnifiedPatch(originalText, modifiedText, options = {}) {
  const oldHeader = options.oldHeader || "--- a/original.txt";
  const newHeader = options.newHeader || "+++ b/modified.txt";
  const contextLines = typeof options.context === "number" ? options.context : 3;

  const oldLines = toLines(originalText);
  const newLines = toLines(modifiedText);

  const ops = myersDiff(oldLines, newLines, options);

  // Check if there are any differences
  const hasChanges = ops.some(op => op.type !== "equal");
  if (!hasChanges) {
    return `# No differences found\n`;
  }

  // Tag operations with 1-based original and modified line numbers
  let oldLineNum = 1;
  let newLineNum = 1;
  const taggedOps = ops.map(op => {
    const item = { ...op };
    if (op.type === "equal") {
      item.oldLine = oldLineNum++;
      item.newLine = newLineNum++;
    } else if (op.type === "del") {
      item.oldLine = oldLineNum++;
      item.newLine = null;
    } else if (op.type === "add") {
      item.oldLine = null;
      item.newLine = newLineNum++;
    }
    return item;
  });

  // Identify changed indices
  const changeIndices = [];
  taggedOps.forEach((op, index) => {
    if (op.type !== "equal") changeIndices.push(index);
  });

  if (changeIndices.length === 0) return "";

  // Group into hunks based on context distance
  const hunks = [];
  let currentHunk = [changeIndices[0]];

  for (let i = 1; i < changeIndices.length; i++) {
    const prev = changeIndices[i - 1];
    const curr = changeIndices[i];
    if (curr - prev <= 2 * contextLines) {
      currentHunk.push(curr);
    } else {
      hunks.push(currentHunk);
      currentHunk = [curr];
    }
  }
  hunks.push(currentHunk);

  // Build patch string
  let patch = `${oldHeader}\n${newHeader}\n`;

  for (const hunkChangeIndices of hunks) {
    const firstChange = hunkChangeIndices[0];
    const lastChange = hunkChangeIndices[hunkChangeIndices.length - 1];

    const startIndex = Math.max(0, firstChange - contextLines);
    const endIndex = Math.min(taggedOps.length - 1, lastChange + contextLines);

    let oldStart = 0;
    let oldCount = 0;
    let newStart = 0;
    let newCount = 0;

    const hunkOps = taggedOps.slice(startIndex, endIndex + 1);

    for (const op of hunkOps) {
      if (op.type === "equal") {
        if (oldStart === 0) oldStart = op.oldLine;
        if (newStart === 0) newStart = op.newLine;
        oldCount++;
        newCount++;
      } else if (op.type === "del") {
        if (oldStart === 0) oldStart = op.oldLine;
        oldCount++;
      } else if (op.type === "add") {
        if (newStart === 0) newStart = op.newLine;
        newCount++;
      }
    }

    if (oldStart === 0) oldStart = 1;
    if (newStart === 0) newStart = 1;

    patch += `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n`;

    for (const op of hunkOps) {
      if (op.type === "equal") {
        patch += ` ${op.value}\n`;
      } else if (op.type === "del") {
        patch += `-${op.value}\n`;
      } else if (op.type === "add") {
        patch += `+${op.value}\n`;
      }
    }
  }

  return patch;
}

(function (root) {
  const api = {
    diffArrays,
    myersDiff,
    toLines,
    toWordTokens,
    toCharTokens,
    normalizeToken,
    areTokensEqual,
    escapeHtml,
    inlineWordDiff,
    inlineCharDiff,
    generateUnifiedPatch,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.DiffEngine = api;
})(typeof self !== "undefined" ? self : this);
