/**
 * CSS Grid Generator — UI Controller
 * ────────────────────────────────────
 * Wires DOM events to the GridEngine, manages selection state,
 * renders the live preview, and handles export/copy actions.
 */
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // ── DOM References ──────────────────────────────────────────────────────
  const columnsCount = document.getElementById("columnsCount");
  const rowsCount = document.getElementById("rowsCount");
  const colSizeInput = document.getElementById("colSizeInput");
  const rowSizeInput = document.getElementById("rowSizeInput");
  const colGap = document.getElementById("colGap");
  const rowGap = document.getElementById("rowGap");
  const showLines = document.getElementById("showLines");
  const showAreas = document.getElementById("showAreas");
  const enableNamedLines = document.getElementById("enableNamedLines");
  const includeResponsiveCSS = document.getElementById("includeResponsiveCSS");

  const namedLinesCard = document.getElementById("namedLinesCard");
  const autoInferLinesBtn = document.getElementById("autoInferLinesBtn");
  const colLinesCount = document.getElementById("colLinesCount");
  const rowLinesCount = document.getElementById("rowLinesCount");
  const colLinesList = document.getElementById("colLinesList");
  const rowLinesList = document.getElementById("rowLinesList");

  const previewContainer = document.getElementById("previewContainer");
  const gridPreview = document.getElementById("gridPreview");
  const codeContent = document.getElementById("codeContent");
  const codeOutput = document.getElementById("codeOutput");
  const copyCodeBtn = document.getElementById("copyCodeBtn");
  const gridSizeLabel = document.getElementById("gridSizeLabel");
  const itemCountLabel = document.getElementById("itemCountLabel");
  const viewportLabel = document.getElementById("viewportLabel");

  const bpDesktopBtn = document.getElementById("bpDesktopBtn");
  const bpTabletBtn = document.getElementById("bpTabletBtn");
  const bpMobileBtn = document.getElementById("bpMobileBtn");
  const dragHintBanner = document.getElementById("dragHintBanner");

  const addItemBtn = document.getElementById("addItemBtn");
  const removeItemBtn = document.getElementById("removeItemBtn");
  const resetGridBtn = document.getElementById("resetGridBtn");

  const itemConfigCard = document.getElementById("itemConfigCard");
  const itemInfo = document.getElementById("itemInfo");
  const itemColStart = document.getElementById("itemColStart");
  const itemColEnd = document.getElementById("itemColEnd");
  const itemRowStart = document.getElementById("itemRowStart");
  const itemRowEnd = document.getElementById("itemRowEnd");
  const itemAreaName = document.getElementById("itemAreaName");
  const itemColor = document.getElementById("itemColor");

  const presetButtons = document.querySelectorAll(".btn-preset");
  const tabButtons = document.querySelectorAll(".tab-btn");
  const stepperButtons = document.querySelectorAll(".stepper-btn");

  // ── State ───────────────────────────────────────────────────────────────
  let items = [];
  let selectedIndex = -1;
  let activeTab = "css";
  let activeBreakpoint = "desktop"; // 'desktop' | 'tablet' | 'mobile'

  let namedColLines = [];
  let namedRowLines = [];

  let isDraggingCells = false;
  let dragStart = null;
  let dragCurrent = null;

  // ── Config helpers ──────────────────────────────────────────────────────
  function getConfig() {
    const cols = parseInt(columnsCount.value, 10) || 3;
    const rows = parseInt(rowsCount.value, 10) || 3;

    // Ensure named lines arrays have adequate length
    while (namedColLines.length <= cols) namedColLines.push("");
    while (namedRowLines.length <= rows) namedRowLines.push("");

    return {
      columns: cols,
      rows: rows,
      colSize: colSizeInput.value || "1fr 1fr 1fr",
      rowSize: rowSizeInput.value || "auto auto auto",
      colGap: colGap.value || "0px",
      rowGap: rowGap.value || "0px",
      showLines: showLines ? showLines.checked : true,
      showAreas: showAreas ? showAreas.checked : true,
      enableNamedLines: enableNamedLines ? enableNamedLines.checked : false,
      includeResponsiveCSS: includeResponsiveCSS
        ? includeResponsiveCSS.checked
        : true,
      namedColLines,
      namedRowLines,
    };
  }

  // ── Breakpoint Controller ───────────────────────────────────────────────
  function setBreakpoint(bp) {
    activeBreakpoint = bp;

    if (bpDesktopBtn) bpDesktopBtn.classList.toggle("active", bp === "desktop");
    if (bpTabletBtn) bpTabletBtn.classList.toggle("active", bp === "tablet");
    if (bpMobileBtn) bpMobileBtn.classList.toggle("active", bp === "mobile");

    if (previewContainer) {
      previewContainer.classList.toggle("viewport-tablet", bp === "tablet");
      previewContainer.classList.toggle("viewport-mobile", bp === "mobile");
    }

    if (viewportLabel) {
      if (bp === "mobile") viewportLabel.textContent = "375px (Mobile)";
      else if (bp === "tablet") viewportLabel.textContent = "768px (Tablet)";
      else viewportLabel.textContent = "100% (Desktop)";
    }

    render();
  }

  // ── Cell Drag Highlight ─────────────────────────────────────────────────
  function updateDragHighlight() {
    if (!dragStart || !dragCurrent) return;

    const rMin = Math.min(dragStart.row, dragCurrent.row);
    const rMax = Math.max(dragStart.row, dragCurrent.row);
    const cMin = Math.min(dragStart.col, dragCurrent.col);
    const cMax = Math.max(dragStart.col, dragCurrent.col);

    const slots = gridPreview.querySelectorAll(".grid-cell-slot");
    slots.forEach(slot => {
      const r = parseInt(slot.dataset.row, 10);
      const c = parseInt(slot.dataset.col, 10);
      const isSelected = r >= rMin && r <= rMax && c >= cMin && c <= cMax;
      slot.classList.toggle("cell-drag-selected", isSelected);
    });

    if (dragHintBanner) {
      dragHintBanner.innerHTML = `<span class="drag-hint-text">🎯 <strong>Selecting Area:</strong> Rows ${rMin}–${rMax}, Columns ${cMin}–${cMax} (${(rMax - rMin + 1) * (cMax - cMin + 1)} cells)</span>`;
    }
  }

  function clearDragHighlight() {
    const slots = gridPreview.querySelectorAll(".grid-cell-slot");
    slots.forEach(slot => slot.classList.remove("cell-drag-selected"));
    if (dragHintBanner) {
      dragHintBanner.innerHTML = `<span class="drag-hint-text">✨ <strong>Visual Drag-to-Merge:</strong> Click &amp; drag across grid cells to visually define named areas</span>`;
    }
  }

  // ── Rendering ───────────────────────────────────────────────────────────
  function render() {
    const config = getConfig();

    // Toggle Named Lines card visibility
    if (namedLinesCard) {
      namedLinesCard.style.display = config.enableNamedLines ? "block" : "none";
    }

    // Update badges
    if (gridSizeLabel) {
      gridSizeLabel.textContent = `${config.columns} × ${config.rows}`;
    }
    if (itemCountLabel) {
      itemCountLabel.textContent = `${items.length} item${items.length !== 1 ? "s" : ""}`;
    }

    // Setup grid preview
    gridPreview.innerHTML = "";
    gridPreview.style.display = "grid";

    // Handle responsive preview mode
    const isMobileResponsive =
      activeBreakpoint === "mobile" && config.includeResponsiveCSS;

    if (isMobileResponsive) {
      gridPreview.style.gridTemplateColumns = "1fr";
      gridPreview.style.gridTemplateRows = "auto";
      gridPreview.style.gap = `${config.rowGap} ${config.colGap}`;
    } else {
      if (config.enableNamedLines) {
        gridPreview.style.gridTemplateColumns =
          GridEngine.resolveColumnTemplateWithNames(
            config.columns,
            config.colSize,
            config.namedColLines
          );
        gridPreview.style.gridTemplateRows =
          GridEngine.resolveRowTemplateWithNames(
            config.rows,
            config.rowSize,
            config.namedRowLines
          );
      } else {
        gridPreview.style.gridTemplateColumns =
          GridEngine.resolveColumnTemplate(config.columns, config.colSize);
        gridPreview.style.gridTemplateRows = GridEngine.resolveRowTemplate(
          config.rows,
          config.rowSize
        );
      }
      gridPreview.style.gap = `${config.rowGap} ${config.colGap}`;
    }

    if (config.showAreas && !isMobileResponsive) {
      const areas = GridEngine.buildTemplateAreas(
        config.columns,
        config.rows,
        items
      );
      gridPreview.style.gridTemplateAreas = areas || "";
    } else {
      gridPreview.style.gridTemplateAreas = "";
    }

    // 1. Render interactive background cell slots for drag-to-merge
    if (!isMobileResponsive) {
      for (let r = 1; r <= config.rows; r++) {
        for (let c = 1; c <= config.columns; c++) {
          const slot = document.createElement("div");
          slot.className = "grid-cell-slot";
          slot.dataset.row = r;
          slot.dataset.col = c;
          slot.style.gridColumn = `${c} / ${c + 1}`;
          slot.style.gridRow = `${r} / ${r + 1}`;

          const coord = document.createElement("span");
          coord.className = "slot-coord";
          coord.textContent = `${r},${c}`;
          slot.appendChild(coord);

          gridPreview.appendChild(slot);
        }
      }
    }

    // 2. Render grid items
    items.forEach((item, idx) => {
      const el = document.createElement("div");
      el.className = "grid-item" + (idx === selectedIndex ? " selected" : "");
      el.dataset.index = idx;
      el.dataset.row = item.rowStart;
      el.dataset.col = item.colStart;

      if (isMobileResponsive) {
        el.style.gridColumn = "1 / -1";
        el.style.gridRow = "auto";
      } else if (!config.showAreas || !item.areaName) {
        el.style.gridColumn = `${item.colStart} / ${item.colEnd}`;
        el.style.gridRow = `${item.rowStart} / ${item.rowEnd}`;
      } else {
        el.style.gridArea = item.areaName;
      }
      el.style.background = item.color;

      const label = document.createElement("span");
      label.className = "item-label";
      label.textContent = item.areaName || `Item ${idx + 1}`;

      const range = document.createElement("span");
      range.className = "item-range";
      range.textContent = `${item.colStart}/${item.colEnd} · ${item.rowStart}/${item.rowEnd}`;

      el.appendChild(label);
      el.appendChild(range);

      el.addEventListener("click", e => {
        e.stopPropagation();
        selectItem(idx);
      });

      gridPreview.appendChild(el);
    });

    // 3. Render grid line markers
    if (config.showLines && !isMobileResponsive) {
      renderLineMarkers(config);
    }

    // 4. Render named lines list in sidebar
    if (config.enableNamedLines) {
      renderNamedLinesManager(config);
    }

    // 5. Render code output
    renderCode(config);
  }

  function renderLineMarkers(config) {
    const colCount = config.columns;
    const rowCount = config.rows;

    const colTemplate = GridEngine.resolveColumnTemplate(
      colCount,
      config.colSize
    );
    const rowTemplate = GridEngine.resolveRowTemplate(
      rowCount,
      config.rowSize
    );

    const colValues = parseTrackValues(colTemplate, colCount);
    let xOffset = 0;
    for (let i = 0; i <= colCount; i++) {
      const marker = document.createElement("span");
      marker.className = "grid-line-marker";

      const lineName =
        config.enableNamedLines && config.namedColLines[i]
          ? config.namedColLines[i]
          : "";
      marker.textContent = lineName ? `${i + 1} [${lineName}]` : i + 1;
      if (lineName) marker.classList.add("has-named-line");
      marker.style.top = "-20px";

      if (i === 0) {
        marker.style.left = "0px";
      } else if (i === colCount) {
        marker.style.right = "0px";
        marker.style.left = "auto";
      } else {
        marker.style.left = `${xOffset}px`;
      }

      if (i < colValues.length) {
        xOffset += colValues[i];
      }

      gridPreview.appendChild(marker);
    }

    const rowValues = parseTrackValues(rowTemplate, rowCount);
    let yOffset = 0;
    for (let i = 0; i <= rowCount; i++) {
      const marker = document.createElement("span");
      marker.className = "grid-line-marker";

      const lineName =
        config.enableNamedLines && config.namedRowLines[i]
          ? config.namedRowLines[i]
          : "";
      marker.textContent = lineName ? `${i + 1} [${lineName}]` : i + 1;
      if (lineName) marker.classList.add("has-named-line");
      marker.style.left = lineName ? "-60px" : "-16px";

      marker.style.top = `${yOffset}px`;
      if (i < rowValues.length) {
        yOffset += rowValues[i];
      }

      gridPreview.appendChild(marker);
    }
  }

  function renderNamedLinesManager(config) {
    if (colLinesCount) colLinesCount.textContent = config.columns + 1;
    if (rowLinesCount) rowLinesCount.textContent = config.rows + 1;

    if (colLinesList && colLinesList.children.length !== config.columns + 1) {
      colLinesList.innerHTML = "";
      for (let i = 0; i <= config.columns; i++) {
        const row = document.createElement("div");
        row.className = "named-line-row";

        const label = document.createElement("span");
        label.className = "named-line-label";
        label.textContent = `Line ${i + 1}`;

        const input = document.createElement("input");
        input.type = "text";
        input.className = "named-line-input";
        input.placeholder = i === 0 ? "e.g. main-start" : i === config.columns ? "e.g. main-end" : "";
        input.value = namedColLines[i] || "";
        input.dataset.lineIndex = i;

        input.addEventListener("input", () => {
          namedColLines[i] = input.value.trim();
          renderCode(getConfig());
        });

        row.appendChild(label);
        row.appendChild(input);
        colLinesList.appendChild(row);
      }
    }

    if (rowLinesList && rowLinesList.children.length !== config.rows + 1) {
      rowLinesList.innerHTML = "";
      for (let i = 0; i <= config.rows; i++) {
        const row = document.createElement("div");
        row.className = "named-line-row";

        const label = document.createElement("span");
        label.className = "named-line-label";
        label.textContent = `Line ${i + 1}`;

        const input = document.createElement("input");
        input.type = "text";
        input.className = "named-line-input";
        input.placeholder = i === 0 ? "e.g. header-start" : i === config.rows ? "e.g. footer-end" : "";
        input.value = namedRowLines[i] || "";
        input.dataset.lineIndex = i;

        input.addEventListener("input", () => {
          namedRowLines[i] = input.value.trim();
          renderCode(getConfig());
        });

        row.appendChild(label);
        row.appendChild(input);
        rowLinesList.appendChild(row);
      }
    }
  }

  function parseTrackValues(template, count) {
    const parts = (template || "").split(/\s+/).filter(Boolean);
    return parts.map(part => {
      if (part.endsWith("px")) return parseInt(part, 10);
      return 85;
    });
  }

  function renderCode(config) {
    const code = GridEngine.generateCode(activeTab, config, items);
    codeContent.textContent = code;
    highlightCode();
  }

  function highlightCode() {
    const raw = codeContent.textContent;
    if (!raw) return;

    let highlighted = raw
      .replace(
        /\/\*[\s\S]*?\*\//g,
        m => `<span style="color:#6a737d">${m}</span>`
      )
      .replace(
        /&lt;!--[\s\S]*?--&gt;/g,
        m => `<span style="color:#6a737d">${m}</span>`
      )
      .replace(/([\w-]+)(\s*:)/g, '<span style="color:#79c0ff">$1</span>$2')
      .replace(/:\s*([^;{}]+)/g, (m, val) => {
        const colored = val
          .replace(
            /(\d+\.?\d*)(px|fr|rem|em|%|vh|vw)/g,
            '<span style="color:#a5d6ff">$1$2</span>'
          )
          .replace(
            /(repeat|calc|minmax|auto|none)/g,
            '<span style="color:#d2a8ff">$1</span>'
          );
        return `: ${colored}`;
      })
      .replace(/(&lt;\/?)([\w-]+)/g, '$1<span style="color:#7ee787">$2</span>')
      .replace(/(\.[\w-]+)(\s*\{)/g, '<span style="color:#ffa657">$1</span>$2')
      .replace(/(\[[^\]]+\])/g, '<span style="color:#38bdf8;font-weight:700">$1</span>')
      .replace(/"([^"]+)"/g, '"<span style="color:#a5d6ff">$1</span>"');

    codeContent.innerHTML = highlighted;
  }

  // ── Drag-to-Merge Event Handlers ─────────────────────────────────────────
  function initDragToMerge() {
    if (!gridPreview) return;

    gridPreview.addEventListener("pointerdown", e => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const slot = e.target.closest(".grid-cell-slot, .grid-item");
      if (!slot) return;

      const r = parseInt(slot.dataset.row, 10);
      const c = parseInt(slot.dataset.col, 10);
      if (Number.isNaN(r) || Number.isNaN(c)) return;

      try {
        gridPreview.setPointerCapture(e.pointerId);
      } catch (_) {}

      isDraggingCells = true;
      dragStart = { row: r, col: c };
      dragCurrent = { row: r, col: c };
      updateDragHighlight();
    });

    gridPreview.addEventListener("pointermove", e => {
      if (!isDraggingCells) return;

      const elementUnder = document.elementFromPoint(e.clientX, e.clientY);
      const slot = elementUnder?.closest(".grid-cell-slot, .grid-item");
      if (!slot) return;

      const r = parseInt(slot.dataset.row, 10);
      const c = parseInt(slot.dataset.col, 10);
      if (!Number.isNaN(r) && !Number.isNaN(c)) {
        if (r !== dragCurrent.row || c !== dragCurrent.col) {
          dragCurrent = { row: r, col: c };
          updateDragHighlight();
        }
      }
    });

    const finishDrag = e => {
      if (!isDraggingCells) return;
      isDraggingCells = false;
      try {
        gridPreview.releasePointerCapture(e.pointerId);
      } catch (_) {}

      clearDragHighlight();

      if (dragStart && dragCurrent) {
        const rMin = Math.min(dragStart.row, dragCurrent.row);
        const rMax = Math.max(dragStart.row, dragCurrent.row);
        const cMin = Math.min(dragStart.col, dragCurrent.col);
        const cMax = Math.max(dragStart.col, dragCurrent.col);

        // Only create/merge if valid coordinates
        const areaName = GridEngine.autoAreaName(items.length);
        const color = GridEngine.nextColor(items.length);
        const newItem = GridEngine.mergeCellsToItem(
          rMin,
          cMin,
          rMax,
          cMax,
          areaName,
          color
        );

        // Remove any items that are completely covered by this new merge
        items = items.filter(it => {
          const fullyInside =
            it.rowStart >= newItem.rowStart &&
            it.rowEnd <= newItem.rowEnd &&
            it.colStart >= newItem.colStart &&
            it.colEnd <= newItem.colEnd;
          return !fullyInside;
        });

        items.push(newItem);
        if (showAreas) showAreas.checked = true;
        selectItem(items.length - 1);
        render();
      }

      dragStart = null;
      dragCurrent = null;
    };

    gridPreview.addEventListener("pointerup", finishDrag);
    gridPreview.addEventListener("pointercancel", finishDrag);
  }

  // ── Item Selection ──────────────────────────────────────────────────────
  function selectItem(idx) {
    if (idx < 0 || idx >= items.length) {
      deselectItem();
      return;
    }
    selectedIndex = idx;
    const item = items[idx];

    itemConfigCard.style.display = "";
    itemInfo.textContent = `Editing: ${item.areaName || `Item ${idx + 1}`}`;
    itemColStart.value = item.colStart;
    itemColEnd.value = item.colEnd;
    itemRowStart.value = item.rowStart;
    itemRowEnd.value = item.rowEnd;
    itemAreaName.value = item.areaName || "";
    itemColor.value = item.color;

    const config = getConfig();
    itemColEnd.max = config.columns + 1;
    itemRowEnd.max = config.rows + 1;

    render();
  }

  function deselectItem() {
    selectedIndex = -1;
    itemConfigCard.style.display = "none";
    render();
  }

  // ── Item Management ─────────────────────────────────────────────────────
  function addItem() {
    const config = getConfig();
    const areaName = GridEngine.autoAreaName(items.length);
    items.push({
      colStart: 1,
      colEnd: config.columns + 1,
      rowStart: items.length + 1,
      rowEnd: items.length + 2,
      areaName,
      color: GridEngine.nextColor(items.length),
    });
    selectItem(items.length - 1);
  }

  function removeItem() {
    if (selectedIndex < 0 || selectedIndex >= items.length) return;
    items.splice(selectedIndex, 1);
    selectedIndex = -1;
    itemConfigCard.style.display = "none";
    render();
  }

  function resetGrid() {
    items = [];
    selectedIndex = -1;
    namedColLines = [];
    namedRowLines = [];
    if (itemConfigCard) itemConfigCard.style.display = "none";
    columnsCount.value = 3;
    rowsCount.value = 3;
    colSizeInput.value = "1fr 1fr 1fr";
    rowSizeInput.value = "auto auto auto";
    colGap.value = "12px";
    rowGap.value = "12px";
    if (colLinesList) colLinesList.innerHTML = "";
    if (rowLinesList) rowLinesList.innerHTML = "";
    setBreakpoint("desktop");
  }

  function loadPreset(name) {
    const preset = GridEngine.PRESETS[name];
    if (!preset) return;

    items = preset.items.map(it => ({ ...it }));
    columnsCount.value = preset.columns;
    rowsCount.value = preset.rows;
    colSizeInput.value = preset.colSize;
    rowSizeInput.value = preset.rowSize;
    colGap.value = preset.colGap;
    rowGap.value = preset.rowGap;
    selectedIndex = -1;
    itemConfigCard.style.display = "none";

    // Auto infer named lines for preset
    const inferred = GridEngine.inferNamedLinesFromAreas(
      preset.columns,
      preset.rows,
      items
    );
    namedColLines = inferred.colLines;
    namedRowLines = inferred.rowLines;
    if (colLinesList) colLinesList.innerHTML = "";
    if (rowLinesList) rowLinesList.innerHTML = "";

    render();
  }

  // ── Copy to Clipboard ───────────────────────────────────────────────────
  function copyCode() {
    const config = getConfig();
    const code = GridEngine.generateCode(activeTab, config, items);
    navigator.clipboard.writeText(code).then(() => {
      copyCodeBtn.textContent = "✓";
      copyCodeBtn.classList.add("copied");
      setTimeout(() => {
        copyCodeBtn.textContent = "📋";
        copyCodeBtn.classList.remove("copied");
      }, 1500);
    });
  }

  // ── Event Bindings ──────────────────────────────────────────────────────

  // Config inputs
  [columnsCount, rowsCount, colSizeInput, rowSizeInput, colGap, rowGap].forEach(
    el => {
      el?.addEventListener("input", () => {
        if (colLinesList) colLinesList.innerHTML = "";
        if (rowLinesList) rowLinesList.innerHTML = "";
        render();
      });
    }
  );

  [showLines, showAreas, enableNamedLines, includeResponsiveCSS].forEach(
    el => {
      el?.addEventListener("change", render);
    }
  );

  // Stepper buttons
  stepperButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      const dir = parseInt(btn.dataset.dir, 10);
      const min = parseInt(target.min, 10) || 1;
      const max = parseInt(target.max, 10) || 12;
      let val = parseInt(target.value, 10) || 1;
      val = Math.max(min, Math.min(max, val + dir));
      target.value = val;
      if (colLinesList) colLinesList.innerHTML = "";
      if (rowLinesList) rowLinesList.innerHTML = "";
      target.dispatchEvent(new Event("input"));
    });
  });

  // Preset buttons
  presetButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      loadPreset(btn.dataset.preset);
    });
  });

  // Tab buttons
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeTab = btn.dataset.tab;
      render();
    });
  });

  // Breakpoint switcher buttons
  bpDesktopBtn?.addEventListener("click", () => setBreakpoint("desktop"));
  bpTabletBtn?.addEventListener("click", () => setBreakpoint("tablet"));
  bpMobileBtn?.addEventListener("click", () => setBreakpoint("mobile"));

  // Auto infer lines button
  autoInferLinesBtn?.addEventListener("click", () => {
    const config = getConfig();
    const inferred = GridEngine.inferNamedLinesFromAreas(
      config.columns,
      config.rows,
      items
    );
    namedColLines = inferred.colLines;
    namedRowLines = inferred.rowLines;
    if (enableNamedLines) enableNamedLines.checked = true;
    if (colLinesList) colLinesList.innerHTML = "";
    if (rowLinesList) rowLinesList.innerHTML = "";
    render();
  });

  // Item actions
  addItemBtn?.addEventListener("click", addItem);
  removeItemBtn?.addEventListener("click", removeItem);
  resetGridBtn?.addEventListener("click", resetGrid);

  // Item config inputs
  [
    itemColStart,
    itemColEnd,
    itemRowStart,
    itemRowEnd,
    itemAreaName,
    itemColor,
  ].forEach(el => {
    el?.addEventListener("input", () => {
      if (selectedIndex < 0 || selectedIndex >= items.length) return;
      items[selectedIndex] = {
        colStart: parseInt(itemColStart.value, 10) || 1,
        colEnd: parseInt(itemColEnd.value, 10) || 2,
        rowStart: parseInt(itemRowStart.value, 10) || 1,
        rowEnd: parseInt(itemRowEnd.value, 10) || 2,
        areaName: itemAreaName.value.trim(),
        color: itemColor.value,
      };
      itemInfo.textContent = `Editing: ${itemAreaName.value.trim() || `Item ${selectedIndex + 1}`}`;
      render();
    });
  });

  // Copy code
  copyCodeBtn?.addEventListener("click", copyCode);

  // Initialize Drag-to-Merge
  initDragToMerge();

  // ── Initial Render ──────────────────────────────────────────────────────
  render();
});
