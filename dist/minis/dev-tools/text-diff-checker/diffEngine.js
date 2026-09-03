"use strict";

/**
 * Generic LCS diff over an array of tokens.
 * Returns an array of:
 * { type: "equal" | "add" | "del", value }
 */
function diffArrays(a, b) {
  const n = a.length;
  const m = b.length;

  const dp = Array.from(
    { length: n + 1 },
    () => new Uint32Array(m + 1)
  );

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", value: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "del", value: a[i] });
      i++;
    } else {
      ops.push({ type: "add", value: b[j] });
      j++;
    }
  }

  while (i < n) {
    ops.push({ type: "del", value: a[i] });
    i++;
  }

  while (j < m) {
    ops.push({ type: "add", value: b[j] });
    j++;
  }

  return ops;
}

function toLines(text) {
  return text.length === 0 ? [] : text.split("\n");
}

function toWordTokens(text) {
  if (text.length === 0) return [];
  return text.match(/\S+|\s+/g) || [];
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineWordDiff(oldLine, newLine) {
  const ops = diffArrays(
    toWordTokens(oldLine),
    toWordTokens(newLine)
  );

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

(function (root) {
  const api = {
    diffArrays,
    toLines,
    toWordTokens,
    escapeHtml,
    inlineWordDiff,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.DiffEngine = api;
})(typeof self !== "undefined" ? self : this);
