/**
 * CSS Grid Generator — UI Controller
 * ────────────────────────────────────
 * Wires DOM events to the GridEngine, manages selection state,
 * renders the live preview, and handles export/copy actions.
 */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // ── DOM References ──────────────────────────────────────────────────────
  const columnsCount = document.getElementById('columnsCount');
  const rowsCount = document.getElementById('rowsCount');
  const colSizeInput = document.getElementById('colSizeInput');
  const rowSizeInput = document.getElementById('rowSizeInput');
  const colGap = document.getElementById('colGap');
  const rowGap = document.getElementById('rowGap');
  const showLines = document.getElementById('showLines');
  const showAreas = document.getElementById('showAreas');

  const gridPreview = document.getElementById('gridPreview');
  const codeContent = document.getElementById('codeContent');
  const codeOutput = document.getElementById('codeOutput');
  const copyCodeBtn = document.getElementById('copyCodeBtn');
  const gridSizeLabel = document.getElementById('gridSizeLabel');
  const itemCountLabel = document.getElementById('itemCountLabel');

  const addItemBtn = document.getElementById('addItemBtn');
  const removeItemBtn = document.getElementById('removeItemBtn');
  const resetGridBtn = document.getElementById('resetGridBtn');

  const itemConfigCard = document.getElementById('itemConfigCard');
  const itemInfo = document.getElementById('itemInfo');
  const itemColStart = document.getElementById('itemColStart');
  const itemColEnd = document.getElementById('itemColEnd');
  const itemRowStart = document.getElementById('itemRowStart');
  const itemRowEnd = document.getElementById('itemRowEnd');
  const itemAreaName = document.getElementById('itemAreaName');
  const itemColor = document.getElementById('itemColor');

  const presetButtons = document.querySelectorAll('.btn-preset');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const stepperButtons = document.querySelectorAll('.stepper-btn');

  // ── State ───────────────────────────────────────────────────────────────
  let items = [];
  let selectedIndex = -1;
  let activeTab = 'css';

  // ── Config helpers ──────────────────────────────────────────────────────
  function getConfig() {
    return {
      columns: parseInt(columnsCount.value, 10) || 3,
      rows: parseInt(rowsCount.value, 10) || 3,
      colSize: colSizeInput.value || '1fr 1fr 1fr',
      rowSize: rowSizeInput.value || 'auto auto auto',
      colGap: colGap.value || '0px',
      rowGap: rowGap.value || '0px',
      showLines: showLines.checked,
      showAreas: showAreas.checked,
    };
  }

  // ── Rendering ───────────────────────────────────────────────────────────
  function render() {
    const config = getConfig();

    // Update badges
    gridSizeLabel.textContent = `${config.columns} × ${config.rows}`;
    itemCountLabel.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

    // Render grid preview
    gridPreview.innerHTML = '';
    gridPreview.style.display = 'grid';
    gridPreview.style.gridTemplateColumns =
      GridEngine.resolveColumnTemplate(config.columns, config.colSize);
    gridPreview.style.gridTemplateRows =
      GridEngine.resolveRowTemplate(config.rows, config.rowSize);
    gridPreview.style.gap = `${config.rowGap} ${config.colGap}`;

    if (config.showAreas) {
      const areas = GridEngine.buildTemplateAreas(config.columns, config.rows, items);
      if (areas) {
        gridPreview.style.gridTemplateAreas = areas;
      } else {
        gridPreview.style.gridTemplateAreas = '';
      }
    } else {
      gridPreview.style.gridTemplateAreas = '';
    }

    // Render grid items
    items.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'grid-item' + (idx === selectedIndex ? ' selected' : '');
      el.dataset.index = idx;

      if (!config.showAreas || !item.areaName) {
        el.style.gridColumn = `${item.colStart} / ${item.colEnd}`;
        el.style.gridRow = `${item.rowStart} / ${item.rowEnd}`;
      } else {
        el.style.gridArea = item.areaName;
      }
      el.style.background = item.color;

      const label = document.createElement('span');
      label.className = 'item-label';
      label.textContent = item.areaName || `Item ${idx + 1}`;

      const range = document.createElement('span');
      range.className = 'item-range';
      range.textContent = `${item.colStart}/${item.colEnd} · ${item.rowStart}/${item.rowEnd}`;

      el.appendChild(label);
      el.appendChild(range);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectItem(idx);
      });

      gridPreview.appendChild(el);
    });

    // Render grid line markers if enabled
    if (config.showLines) {
      renderLineMarkers(config);
    }

    // Render code output
    renderCode(config);
  }

  function renderLineMarkers(config) {
    const container = gridPreview.getBoundingClientRect();
    if (!container.width) return;

    const colTemplate = GridEngine.resolveColumnTemplate(config.columns, config.colSize);
    const rowTemplate = GridEngine.resolveRowTemplate(config.rows, config.rowSize);

    // Column line markers along top
    const colValues = parseTrackValues(colTemplate, config.columns);
    let xOffset = 0;
    for (let i = 0; i <= config.columns; i++) {
      const marker = document.createElement('span');
      marker.className = 'grid-line-marker';
      marker.textContent = i + 1;
      marker.style.top = '-16px';

      if (i === 0) {
        marker.style.left = '0px';
      } else if (i === config.columns) {
        marker.style.right = '0px';
        marker.style.left = 'auto';
      } else {
        marker.style.left = `${xOffset}px`;
      }

      if (i < colValues.length) {
        xOffset += colValues[i];
      }

      gridPreview.appendChild(marker);
    }

    // Row line markers along left
    const rowValues = parseTrackValues(rowTemplate, config.rows);
    let yOffset = 0;
    for (let i = 0; i <= config.rows; i++) {
      const marker = document.createElement('span');
      marker.className = 'grid-line-marker';
      marker.textContent = i + 1;
      marker.style.left = '-14px';

      if (i < rowValues.length) {
        marker.style.top = `${yOffset}px`;
        yOffset += rowValues[i];
      } else {
        marker.style.top = `${yOffset}px`;
      }

      gridPreview.appendChild(marker);
    }
  }

  /**
   * Parse track list into approximate pixel values for line marker positioning.
   * Falls back to 60px per track for fr/percentage values.
   */
  function parseTrackValues(template, count) {
    const parts = template.split(/\s+/);
    return parts.map((part) => {
      if (part.endsWith('px')) return parseInt(part, 10);
      return 80; // default approx for fr / auto
    });
  }

  function renderCode(config) {
    const code = GridEngine.generateCode(activeTab, config, items);
    codeContent.textContent = code;
    // Apply basic syntax highlighting
    highlightCode();
  }

  function highlightCode() {
    const raw = codeContent.textContent;
    if (!raw) return;

    let highlighted = raw
      // CSS comments
      .replace(/\/\*[\s\S]*?\*\//g, (m) => `<span style="color:#6a737d">${m}</span>`)
      // HTML comments
      .replace(/&lt;!--[\s\S]*?--&gt;/g, (m) => `<span style="color:#6a737d">${m}</span>`)
      // CSS properties
      .replace(/([\w-]+)(\s*:)/g, '<span style="color:#79c0ff">$1</span>$2')
      // CSS values with units
      .replace(/:\s*([^;{}]+)/g, (m, val) => {
        const colored = val
          .replace(/(\d+\.?\d*)(px|fr|rem|em|%|vh|vw)/g,
            '<span style="color:#a5d6ff">$1$2</span>')
          .replace(/(repeat|calc|minmax|auto|none)/g,
            '<span style="color:#d2a8ff">$1</span>');
        return `: ${colored}`;
      })
      // HTML tags
      .replace(/(&lt;\/?)([\w-]+)/g, '$1<span style="color:#7ee787">$2</span>')
      // CSS class selectors
      .replace(/(\.[\w-]+)(\s*\{)/g, '<span style="color:#ffa657">$1</span>$2')
      // Grid area names in quotes
      .replace(/"([^"]+)"/g, '"<span style="color:#a5d6ff">$1</span>"');

    codeContent.innerHTML = highlighted;
  }

  // ── Item Selection ──────────────────────────────────────────────────────
  function selectItem(idx) {
    if (idx < 0 || idx >= items.length) {
      deselectItem();
      return;
    }
    selectedIndex = idx;
    const item = items[idx];

    itemConfigCard.style.display = '';
    itemInfo.textContent = `Editing: ${item.areaName || `Item ${idx + 1}`}`;
    itemColStart.value = item.colStart;
    itemColEnd.value = item.colEnd;
    itemRowStart.value = item.rowStart;
    itemRowEnd.value = item.rowEnd;
    itemAreaName.value = item.areaName || '';
    itemColor.value = item.color;

    // Update max values based on grid config
    const config = getConfig();
    itemColEnd.max = config.columns + 1;
    itemRowEnd.max = config.rows + 1;

    render();
  }

  function deselectItem() {
    selectedIndex = -1;
    itemConfigCard.style.display = 'none';
    render();
  }

  // ── Item Management ─────────────────────────────────────────────────────
  function addItem() {
    const config = getConfig();
    items.push({
      colStart: 1,
      colEnd: config.columns + 1,
      rowStart: items.length + 1,
      rowEnd: items.length + 2,
      areaName: '',
      color: GridEngine.nextColor(items.length),
    });
    selectItem(items.length - 1);
  }

  function removeItem() {
    if (selectedIndex < 0 || selectedIndex >= items.length) return;
    items.splice(selectedIndex, 1);
    selectedIndex = -1;
    itemConfigCard.style.display = 'none';
    render();
  }

  function resetGrid() {
    items = [];
    selectedIndex = -1;
    itemConfigCard.style.display = 'none';
    columnsCount.value = 3;
    rowsCount.value = 3;
    colSizeInput.value = '1fr 1fr 1fr';
    rowSizeInput.value = 'auto auto auto';
    colGap.value = '12px';
    rowGap.value = '12px';
    render();
  }

  function loadPreset(name) {
    const preset = GridEngine.PRESETS[name];
    if (!preset) return;

    items = preset.items.map((it) => ({ ...it }));
    columnsCount.value = preset.columns;
    rowsCount.value = preset.rows;
    colSizeInput.value = preset.colSize;
    rowSizeInput.value = preset.rowSize;
    colGap.value = preset.colGap;
    rowGap.value = preset.rowGap;
    selectedIndex = -1;
    itemConfigCard.style.display = 'none';
    render();
  }

  // ── Copy to Clipboard ───────────────────────────────────────────────────
  function copyCode() {
    const config = getConfig();
    const code = GridEngine.generateCode(activeTab, config, items);
    navigator.clipboard.writeText(code).then(() => {
      copyCodeBtn.textContent = '✓';
      copyCodeBtn.classList.add('copied');
      setTimeout(() => {
        copyCodeBtn.textContent = '📋';
        copyCodeBtn.classList.remove('copied');
      }, 1500);
    });
  }

  // ── Event Bindings ──────────────────────────────────────────────────────

  // Config inputs
  [columnsCount, rowsCount, colSizeInput, rowSizeInput, colGap, rowGap].forEach((el) => {
    el.addEventListener('input', render);
  });

  [showLines, showAreas].forEach((el) => {
    el.addEventListener('change', render);
  });

  // Stepper buttons
  stepperButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      const dir = parseInt(btn.dataset.dir, 10);
      const min = parseInt(target.min, 10) || 1;
      const max = parseInt(target.max, 10) || 12;
      let val = parseInt(target.value, 10) || 1;
      val = Math.max(min, Math.min(max, val + dir));
      target.value = val;
      target.dispatchEvent(new Event('input'));
    });
  });

  // Preset buttons
  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      loadPreset(btn.dataset.preset);
    });
  });

  // Tab buttons
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      render();
    });
  });

  // Item actions
  addItemBtn.addEventListener('click', addItem);
  removeItemBtn.addEventListener('click', removeItem);
  resetGridBtn.addEventListener('click', resetGrid);

  // Item config inputs
  [itemColStart, itemColEnd, itemRowStart, itemRowEnd, itemAreaName, itemColor].forEach((el) => {
    el.addEventListener('input', () => {
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

  // Click preview background to deselect
  gridPreview.addEventListener('click', () => {
    deselectItem();
  });

  // Copy code
  copyCodeBtn.addEventListener('click', copyCode);

  // ── Initial Render ──────────────────────────────────────────────────────
  render();
});
