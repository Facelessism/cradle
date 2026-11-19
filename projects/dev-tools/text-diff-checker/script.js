/**
 * Text Difference Checker
 * Synchronized Side-by-Side Split View, Character-Level Myers Highlighting,
 * Configurable Ignore Rules & Git Unified Patch (.patch) Export.
 */

const {
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
} = DiffEngine;

(() => {
  "use strict";

  // ---------- DOM Elements ----------
  const originalEl = document.getElementById("originalText");
  const modifiedEl = document.getElementById("modifiedText");
  const compareBtn = document.getElementById("compareBtn");
  const swapBtn = document.getElementById("swapBtn");
  const clearBtn = document.getElementById("clearBtn");
  const copyPatchBtn = document.getElementById("copyPatchBtn");
  const downloadPatchBtn = document.getElementById("downloadPatchBtn");

  const lineModeBtn = document.getElementById("lineModeBtn");
  const wordModeBtn = document.getElementById("wordModeBtn");
  const charModeBtn = document.getElementById("charModeBtn");

  const splitViewBtn = document.getElementById("splitViewBtn");
  const unifiedViewBtn = document.getElementById("unifiedViewBtn");

  const chkIgnoreWhitespace = document.getElementById("chkIgnoreWhitespace");
  const chkIgnoreCase = document.getElementById("chkIgnoreCase");
  const chkTrimEndings = document.getElementById("chkTrimEndings");
  const chkCollapseContext = document.getElementById("chkCollapseContext");

  const diffOutput = document.getElementById("diffOutput");
  const unifiedDiffOutput = document.getElementById("unifiedDiffOutput");
  const leftPane = document.getElementById("leftPane");
  const rightPane = document.getElementById("rightPane");
  const unifiedPane = document.getElementById("unifiedPane");

  const statsBar = document.getElementById("statsBar");
  const emptyState = document.getElementById("emptyState");
  const statAdd = document.getElementById("statAdd");
  const statDel = document.getElementById("statDel");
  const statMod = document.getElementById("statMod");
  const statHunks = document.getElementById("statHunks");

  // ---------- State ----------
  let diffMode = "char"; // 'line' | 'word' | 'char'
  let viewMode = "split"; // 'split' | 'unified'
  const expandedCollapseBlocks = new Set();

  const EMPTY_ROW = `<div class="diff-line empty"><span class="line-num"></span><span class="line-content"></span></div>`;

  // ---------- Synchronized Scrolling ----------
  let isSyncing = false;
  function syncScroll(source, target) {
    if (isSyncing || !source || !target) return;
    isSyncing = true;
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
    requestAnimationFrame(() => {
      isSyncing = false;
    });
  }

  if (leftPane && rightPane) {
    leftPane.addEventListener("scroll", () => syncScroll(leftPane, rightPane));
    rightPane.addEventListener("scroll", () => syncScroll(rightPane, leftPane));
  }

  // ---------- Diff Options ----------
  function getDiffOptions() {
    return {
      ignoreWhitespace: chkIgnoreWhitespace ? chkIgnoreWhitespace.checked : false,
      ignoreCase: chkIgnoreCase ? chkIgnoreCase.checked : false,
      trimLineEndings: chkTrimEndings ? chkTrimEndings.checked : true,
      collapseContext: chkCollapseContext ? chkCollapseContext.checked : true,
    };
  }

  // ---------- Main Comparison Controller ----------
  function compare() {
    const originalText = originalEl.value;
    const modifiedText = modifiedEl.value;

    if (originalText.trim() === "" && modifiedText.trim() === "") {
      if (diffOutput) diffOutput.hidden = true;
      if (unifiedDiffOutput) unifiedDiffOutput.hidden = true;
      if (statsBar) statsBar.hidden = true;
      if (emptyState) emptyState.hidden = false;
      if (copyPatchBtn) copyPatchBtn.disabled = true;
      if (downloadPatchBtn) downloadPatchBtn.disabled = true;
      return;
    }

    const options = getDiffOptions();
    const oldLines = toLines(originalText);
    const newLines = toLines(modifiedText);

    const lineOps = myersDiff(oldLines, newLines, options);

    // Group adjacent del/add ops into paired rows
    const { rows, additions, deletions, modifications, hunksCount } = processLineOps(
      lineOps,
      diffMode,
      options
    );

    // Render Split View
    renderSplitView(rows, options);

    // Render Unified View
    renderUnifiedView(rows, options);

    // Update Stats
    if (statAdd) statAdd.textContent = additions;
    if (statDel) statDel.textContent = deletions;
    if (statMod) statMod.textContent = modifications;
    if (statHunks) statHunks.textContent = hunksCount;

    // Toggle visibility based on viewMode
    if (diffOutput) diffOutput.hidden = viewMode !== "split";
    if (unifiedDiffOutput) unifiedDiffOutput.hidden = viewMode !== "unified";
    if (statsBar) statsBar.hidden = false;
    if (emptyState) emptyState.hidden = true;

    if (copyPatchBtn) copyPatchBtn.disabled = false;
    if (downloadPatchBtn) downloadPatchBtn.disabled = false;
  }

  // ---------- Process Line Operations ----------
  function processLineOps(lineOps, mode, options) {
    const rows = [];
    let leftLineNum = 1;
    let rightLineNum = 1;
    let additions = 0;
    let deletions = 0;
    let modifications = 0;
    let hunksCount = 0;

    let idx = 0;
    let inChangeHunk = false;

    while (idx < lineOps.length) {
      const op = lineOps[idx];

      if (op.type === "equal") {
        inChangeHunk = false;
        rows.push({
          type: "equal",
          left: op.value,
          right: op.value,
          leftNum: leftLineNum++,
          rightNum: rightLineNum++,
        });
        idx++;
        continue;
      }

      if (!inChangeHunk) {
        hunksCount++;
        inChangeHunk = true;
      }

      // Collect contiguous run of del/add ops
      const dels = [];
      const adds = [];
      while (
        idx < lineOps.length &&
        (lineOps[idx].type === "del" || lineOps[idx].type === "add")
      ) {
        if (lineOps[idx].type === "del") dels.push(lineOps[idx].value);
        else adds.push(lineOps[idx].value);
        idx++;
      }

      const pairCount = Math.min(dels.length, adds.length);

      if ((mode === "char" || mode === "word") && pairCount > 0) {
        // Paired lines are treated as modified with inline diffs
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
        // Line mode: render all deletions then all additions
        for (let k = 0; k < pairCount; k++) {
          rows.push({
            type: "del",
            left: dels[k],
            right: null,
            leftNum: leftLineNum++,
            rightNum: null,
          });
          rows.push({
            type: "add",
            left: null,
            right: adds[k],
            leftNum: null,
            rightNum: rightLineNum++,
          });
          deletions++;
          additions++;
        }
      }

      for (let k = pairCount; k < dels.length; k++) {
        rows.push({
          type: "del",
          left: dels[k],
          right: null,
          leftNum: leftLineNum++,
          rightNum: null,
        });
        deletions++;
      }
      for (let k = pairCount; k < adds.length; k++) {
        rows.push({
          type: "add",
          left: null,
          right: adds[k],
          leftNum: null,
          rightNum: rightLineNum++,
        });
        additions++;
      }
    }

    return { rows, additions, deletions, modifications, hunksCount };
  }

  // ---------- Split View Renderer ----------
  function renderSplitView(rows, options) {
    if (!leftPane || !rightPane) return;

    const collapseContext = options.collapseContext;
    const collapseThreshold = 6;
    const contextSize = 2;

    let leftHtml = "";
    let rightHtml = "";

    let i = 0;
    while (i < rows.length) {
      // Check if we have a collapsible run of equal rows
      if (collapseContext && rows[i].type === "equal") {
        let runStart = i;
        while (i < rows.length && rows[i].type === "equal") {
          i++;
        }
        let runLen = i - runStart;

        // Determine if this run can be collapsed
        if (runLen >= collapseThreshold) {
          const blockId = `split-block-${runStart}`;
          const isExpanded = expandedCollapseBlocks.has(blockId);

          if (!isExpanded) {
            // Render head context rows
            for (let c = runStart; c < runStart + contextSize; c++) {
              const r = rows[c];
              const safe = escapeHtml(r.left);
              leftHtml += makeSplitRow(r.leftNum, safe, "");
              rightHtml += makeSplitRow(r.rightNum, safe, "");
            }

            // Render expander row
            const hiddenCount = runLen - contextSize * 2;
            if (hiddenCount > 0) {
              const collapseRow = `<div class="diff-collapse-row" data-block-id="${blockId}" role="button" tabindex="0" title="Click to expand unchanged lines"><span class="collapse-icon">↕</span> Show ${hiddenCount} unchanged lines</div>`;
              leftHtml += collapseRow;
              rightHtml += collapseRow;
            }

            // Render tail context rows
            for (let c = i - contextSize; c < i; c++) {
              const r = rows[c];
              const safe = escapeHtml(r.left);
              leftHtml += makeSplitRow(r.leftNum, safe, "");
              rightHtml += makeSplitRow(r.rightNum, safe, "");
            }
            continue;
          }
        }

        // Render full run if not collapsed or already expanded
        for (let c = runStart; c < i; c++) {
          const r = rows[c];
          const safe = escapeHtml(r.left);
          leftHtml += makeSplitRow(r.leftNum, safe, "");
          rightHtml += makeSplitRow(r.rightNum, safe, "");
        }
        continue;
      }

      const row = rows[i];
      if (row.type === "equal") {
        const safe = escapeHtml(row.left);
        leftHtml += makeSplitRow(row.leftNum, safe, "");
        rightHtml += makeSplitRow(row.rightNum, safe, "");
      } else if (row.type === "del") {
        leftHtml += makeSplitRow(row.leftNum, escapeHtml(row.left), "del");
        rightHtml += EMPTY_ROW;
      } else if (row.type === "add") {
        leftHtml += EMPTY_ROW;
        rightHtml += makeSplitRow(row.rightNum, escapeHtml(row.right), "add");
      } else if (row.type === "mod") {
        let l, r;
        if (diffMode === "char") {
          const res = inlineCharDiff(row.left, row.right, options);
          l = res.leftHtml;
          r = res.rightHtml;
        } else {
          const res = inlineWordDiff(row.left, row.right, options);
          l = res.leftHtml;
          r = res.rightHtml;
        }
        leftHtml += makeSplitRow(row.leftNum, l, "mod");
        rightHtml += makeSplitRow(row.rightNum, r, "mod");
      }
      i++;
    }

    leftPane.innerHTML = leftHtml;
    rightPane.innerHTML = rightHtml;

    attachCollapseClickHandlers(leftPane);
    attachCollapseClickHandlers(rightPane);
  }

  function makeSplitRow(lineNum, html, cls) {
    const numHtml = lineNum === null ? "" : lineNum;
    return `<div class="diff-line ${cls}"><span class="line-num">${numHtml}</span><span class="line-content">${html}</span></div>`;
  }

  // ---------- Unified View Renderer ----------
  function renderUnifiedView(rows, options) {
    if (!unifiedPane) return;

    const collapseContext = options.collapseContext;
    const collapseThreshold = 6;
    const contextSize = 2;

    let html = "";
    let i = 0;

    while (i < rows.length) {
      if (collapseContext && rows[i].type === "equal") {
        let runStart = i;
        while (i < rows.length && rows[i].type === "equal") {
          i++;
        }
        let runLen = i - runStart;

        if (runLen >= collapseThreshold) {
          const blockId = `unified-block-${runStart}`;
          const isExpanded = expandedCollapseBlocks.has(blockId);

          if (!isExpanded) {
            for (let c = runStart; c < runStart + contextSize; c++) {
              const r = rows[c];
              html += makeUnifiedRow(r.leftNum, r.rightNum, " ", escapeHtml(r.left), "");
            }

            const hiddenCount = runLen - contextSize * 2;
            if (hiddenCount > 0) {
              html += `<div class="diff-collapse-row" data-block-id="${blockId}" role="button" tabindex="0" title="Click to expand unchanged lines"><span class="collapse-icon">↕</span> Show ${hiddenCount} unchanged lines</div>`;
            }

            for (let c = i - contextSize; c < i; c++) {
              const r = rows[c];
              html += makeUnifiedRow(r.leftNum, r.rightNum, " ", escapeHtml(r.left), "");
            }
            continue;
          }
        }

        for (let c = runStart; c < i; c++) {
          const r = rows[c];
          html += makeUnifiedRow(r.leftNum, r.rightNum, " ", escapeHtml(r.left), "");
        }
        continue;
      }

      const row = rows[i];
      if (row.type === "equal") {
        html += makeUnifiedRow(row.leftNum, row.rightNum, " ", escapeHtml(row.left), "");
      } else if (row.type === "del") {
        html += makeUnifiedRow(row.leftNum, "", "-", escapeHtml(row.left), "del");
      } else if (row.type === "add") {
        html += makeUnifiedRow("", row.rightNum, "+", escapeHtml(row.right), "add");
      } else if (row.type === "mod") {
        let l, r;
        if (diffMode === "char") {
          const res = inlineCharDiff(row.left, row.right, options);
          l = res.leftHtml;
          r = res.rightHtml;
        } else {
          const res = inlineWordDiff(row.left, row.right, options);
          l = res.leftHtml;
          r = res.rightHtml;
        }
        html += makeUnifiedRow(row.leftNum, "", "-", l, "mod-del");
        html += makeUnifiedRow("", row.rightNum, "+", r, "mod-add");
      }
      i++;
    }

    unifiedPane.innerHTML = html;
    attachCollapseClickHandlers(unifiedPane);
  }

  function makeUnifiedRow(oldNum, newNum, marker, contentHtml, cls) {
    return `<div class="unified-line ${cls}"><span class="line-num-old">${oldNum}</span><span class="line-num-new">${newNum}</span><span class="line-marker">${marker}</span><span class="line-content">${contentHtml}</span></div>`;
  }

  // ---------- Context Collapse Event Handler ----------
  function attachCollapseClickHandlers(container) {
    if (!container) return;
    const expanders = container.querySelectorAll(".diff-collapse-row");
    expanders.forEach(el => {
      const blockId = el.getAttribute("data-block-id");
      if (!blockId) return;

      const triggerExpand = () => {
        expandedCollapseBlocks.add(blockId);
        compare();
      };

      el.addEventListener("click", triggerExpand);
      el.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          triggerExpand();
        }
      });
    });
  }

  // ---------- Mode & View Setting ----------
  function setDiffMode(newMode) {
    diffMode = newMode;
    if (lineModeBtn) {
      lineModeBtn.classList.toggle("active", diffMode === "line");
      lineModeBtn.setAttribute("aria-selected", diffMode === "line");
    }
    if (wordModeBtn) {
      wordModeBtn.classList.toggle("active", diffMode === "word");
      wordModeBtn.setAttribute("aria-selected", diffMode === "word");
    }
    if (charModeBtn) {
      charModeBtn.classList.toggle("active", diffMode === "char");
      charModeBtn.setAttribute("aria-selected", diffMode === "char");
    }
    compare();
  }

  function setViewLayout(newView) {
    viewMode = newView;
    if (splitViewBtn) {
      splitViewBtn.classList.toggle("active", viewMode === "split");
      splitViewBtn.setAttribute("aria-selected", viewMode === "split");
    }
    if (unifiedViewBtn) {
      unifiedViewBtn.classList.toggle("active", viewMode === "unified");
      unifiedViewBtn.setAttribute("aria-selected", viewMode === "unified");
    }

    if (diffOutput) diffOutput.hidden = viewMode !== "split";
    if (unifiedDiffOutput) unifiedDiffOutput.hidden = viewMode !== "unified";
  }

  // ---------- Export Unified Patch (.patch) ----------
  function getPatchContent() {
    const options = getDiffOptions();
    return generateUnifiedPatch(originalEl.value, modifiedEl.value, options);
  }

  if (copyPatchBtn) {
    copyPatchBtn.addEventListener("click", async () => {
      const patch = getPatchContent();
      try {
        await navigator.clipboard.writeText(patch);
        const originalText = copyPatchBtn.textContent;
        copyPatchBtn.textContent = "✓ Copied!";
        copyPatchBtn.classList.add("btn-copied");
        setTimeout(() => {
          copyPatchBtn.textContent = originalText;
          copyPatchBtn.classList.remove("btn-copied");
        }, 2000);
      } catch (err) {
        console.error("Clipboard copy failed:", err);
      }
    });
  }

  if (downloadPatchBtn) {
    downloadPatchBtn.addEventListener("click", () => {
      const patch = getPatchContent();
      const blob = new Blob([patch], { type: "text/x-diff;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "diff.patch";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // ---------- Event Wiring ----------
  if (compareBtn) compareBtn.addEventListener("click", compare);

  if (swapBtn) {
    swapBtn.addEventListener("click", () => {
      const tmp = originalEl.value;
      originalEl.value = modifiedEl.value;
      modifiedEl.value = tmp;
      compare();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      originalEl.value = "";
      modifiedEl.value = "";
      expandedCollapseBlocks.clear();
      if (diffOutput) diffOutput.hidden = true;
      if (unifiedDiffOutput) unifiedDiffOutput.hidden = true;
      if (statsBar) statsBar.hidden = true;
      if (emptyState) emptyState.hidden = false;
      if (copyPatchBtn) copyPatchBtn.disabled = true;
      if (downloadPatchBtn) downloadPatchBtn.disabled = true;
    });
  }

  if (lineModeBtn) lineModeBtn.addEventListener("click", () => setDiffMode("line"));
  if (wordModeBtn) wordModeBtn.addEventListener("click", () => setDiffMode("word"));
  if (charModeBtn) charModeBtn.addEventListener("click", () => setDiffMode("char"));

  if (splitViewBtn) splitViewBtn.addEventListener("click", () => setViewLayout("split"));
  if (unifiedViewBtn) unifiedViewBtn.addEventListener("click", () => setViewLayout("unified"));

  [chkIgnoreWhitespace, chkIgnoreCase, chkTrimEndings, chkCollapseContext].forEach(chk => {
    if (chk) {
      chk.addEventListener("change", () => {
        expandedCollapseBlocks.clear();
        compare();
      });
    }
  });

  // Keyboard Shortcuts: Ctrl/Cmd + Enter to compare, Ctrl/Cmd + Shift + S to swap
  window.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      compare();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "S" || e.key === "s")) {
      e.preventDefault();
      if (swapBtn) swapBtn.click();
    }
  });
})();
