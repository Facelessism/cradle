/**
 * Text Difference Checker
 * Vanilla JS, dependency-free LCS-based diff engine.
 * Supports side-by-side comparison in Line mode and Word mode.
 */
const {
  diffArrays,
  toLines,
  toWordTokens,
  escapeHtml,
  inlineWordDiff,
} = DiffEngine;

(() => {
  "use strict";

  // ---------- DOM ----------

  const originalEl = document.getElementById("originalText");
  const modifiedEl = document.getElementById("modifiedText");
  const compareBtn = document.getElementById("compareBtn");
  const swapBtn = document.getElementById("swapBtn");
  const clearBtn = document.getElementById("clearBtn");
  const lineModeBtn = document.getElementById("lineModeBtn");
  const wordModeBtn = document.getElementById("wordModeBtn");
  const leftPane = document.getElementById("leftPane");
  const rightPane = document.getElementById("rightPane");
  const diffOutput = document.getElementById("diffOutput");
  const statsBar = document.getElementById("statsBar");
  const emptyState = document.getElementById("emptyState");
  const statAdd = document.getElementById("statAdd");
  const statDel = document.getElementById("statDel");
  const statMod = document.getElementById("statMod");

  let mode = "line"; // 'line' | 'word'


  // ---------- Row rendering helpers ----------
  function makeRow(lineNum, html, cls) {
    const numHtml = lineNum === null ? "" : lineNum;
    return `<div class="diff-line ${cls}"><span class="line-num">${numHtml}</span><span class="line-content">${html}</span></div>`;
  }

  const EMPTY_ROW = `<div class="diff-line empty"><span class="line-num"></span><span class="line-content"></span></div>`;

  // ---------- Main diff + render ----------
  function compare() {
    const originalText = originalEl.value;
    const modifiedText = modifiedEl.value;

    if (originalText.trim() === "" && modifiedText.trim() === "") {
      diffOutput.hidden = true;
      statsBar.hidden = true;
      emptyState.hidden = false;
      return;
    }

    const lineOps = diffArrays(toLines(originalText), toLines(modifiedText));

    // Pair up adjacent del/add runs so we can treat them as "modified" lines
    // when in word mode (gives inline word-level highlighting).
    const rows = [];
    let leftLineNum = 1;
    let rightLineNum = 1;
    let additions = 0, deletions = 0, modifications = 0;

    let idx = 0;
    while (idx < lineOps.length) {
      const op = lineOps[idx];

      if (op.type === "equal") {
        rows.push({ type: "equal", left: op.value, right: op.value, leftNum: leftLineNum++, rightNum: rightLineNum++ });
        idx++;
        continue;
      }

      // Collect a contiguous run of del/add ops (a "change block")
      const dels = [];
      const adds = [];
      while (idx < lineOps.length && (lineOps[idx].type === "del" || lineOps[idx].type === "add")) {
        if (lineOps[idx].type === "del") dels.push(lineOps[idx].value);
        else adds.push(lineOps[idx].value);
        idx++;
      }

      const pairCount = Math.min(dels.length, adds.length);

      if (mode === "word" && pairCount > 0) {
        // Treat paired del/add lines as modifications with inline word diff
        for (let k = 0; k < pairCount; k++) {
          rows.push({
            type: "mod",
            left: dels[k],
            right: adds[k],
            leftNum: leftLineNum++,
            rightNum: rightLineNum++,
          });
          modifications++;
        }
      } else {
        // Line mode (or no pairing possible): render all dels then all adds
        for (let k = 0; k < pairCount; k++) {
          rows.push({ type: "del", left: dels[k], right: null, leftNum: leftLineNum++, rightNum: null });
          rows.push({ type: "add", left: null, right: adds[k], leftNum: null, rightNum: rightLineNum++ });
          deletions++;
          additions++;
        }
      }

      for (let k = pairCount; k < dels.length; k++) {
        rows.push({ type: "del", left: dels[k], right: null, leftNum: leftLineNum++, rightNum: null });
        deletions++;
      }
      for (let k = pairCount; k < adds.length; k++) {
        rows.push({ type: "add", left: null, right: adds[k], leftNum: null, rightNum: rightLineNum++ });
        additions++;
      }
    }

    // Build HTML
    let leftHtml = "";
    let rightHtml = "";

    for (const row of rows) {
      if (row.type === "equal") {
        const safe = escapeHtml(row.left);
        leftHtml += makeRow(row.leftNum, safe, "");
        rightHtml += makeRow(row.rightNum, safe, "");
      } else if (row.type === "del") {
        leftHtml += makeRow(row.leftNum, escapeHtml(row.left), "del");
        rightHtml += EMPTY_ROW;
      } else if (row.type === "add") {
        leftHtml += EMPTY_ROW;
        rightHtml += makeRow(row.rightNum, escapeHtml(row.right), "add");
      } else if (row.type === "mod") {
        const { leftHtml: l, rightHtml: r } = inlineWordDiff(row.left, row.right);
        leftHtml += makeRow(row.leftNum, l, "mod");
        rightHtml += makeRow(row.rightNum, r, "mod");
      }
    }

    leftPane.innerHTML = leftHtml;
    rightPane.innerHTML = rightHtml;

    statAdd.textContent = additions;
    statDel.textContent = deletions;
    statMod.textContent = modifications;

    diffOutput.hidden = false;
    statsBar.hidden = false;
    emptyState.hidden = true;
  }

  // ---------- Event wiring ----------
  function setMode(newMode) {
    mode = newMode;
    lineModeBtn.classList.toggle("active", mode === "line");
    wordModeBtn.classList.toggle("active", mode === "word");
    lineModeBtn.setAttribute("aria-selected", mode === "line");
    wordModeBtn.setAttribute("aria-selected", mode === "word");
    if (!diffOutput.hidden) compare();
  }

  compareBtn.addEventListener("click", compare);

  swapBtn.addEventListener("click", () => {
    const tmp = originalEl.value;
    originalEl.value = modifiedEl.value;
    modifiedEl.value = tmp;
    if (!diffOutput.hidden) compare();
  });

  clearBtn.addEventListener("click", () => {
    originalEl.value = "";
    modifiedEl.value = "";
    diffOutput.hidden = true;
    statsBar.hidden = true;
    emptyState.hidden = false;
  });

  lineModeBtn.addEventListener("click", () => setMode("line"));
  wordModeBtn.addEventListener("click", () => setMode("word"));

  // Compare with Ctrl/Cmd + Enter from either textarea
  [originalEl, modifiedEl].forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        compare();
      }
    });
  });
})();
