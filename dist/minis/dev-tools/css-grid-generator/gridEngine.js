/**
 * CSS Grid Generator — Core Engine
 * ─────────────────────────────────
 * Pure logic for generating CSS Grid styles and code output.
 * Separated from the DOM layer for clarity and testability.
 */
const GridEngine = (() => {
  'use strict';

  /**
   * Default item color palette used when adding new items.
   */
  const ITEM_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
    '#84cc16', '#6366f1', '#14b8a6', '#e11d48',
  ];

  /**
   * Preset layout configurations.
   */
  const PRESETS = {
    'holy-grail': {
      columns: 3,
      rows: 3,
      colSize: '1fr 2fr 1fr',
      rowSize: 'auto 1fr auto',
      colGap: '0px',
      rowGap: '0px',
      items: [
        { colStart: 1, colEnd: 4, rowStart: 1, rowEnd: 2, areaName: 'header', color: '#3b82f6' },
        { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3, areaName: 'nav', color: '#10b981' },
        { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3, areaName: 'main', color: '#8b5cf6' },
        { colStart: 3, colEnd: 4, rowStart: 2, rowEnd: 3, areaName: 'aside', color: '#f59e0b' },
        { colStart: 1, colEnd: 4, rowStart: 3, rowEnd: 4, areaName: 'footer', color: '#ef4444' },
      ],
    },
    sidebar: {
      columns: 4,
      rows: 3,
      colSize: '220px 1fr 1fr 1fr',
      rowSize: 'auto 1fr auto',
      colGap: '10px',
      rowGap: '10px',
      items: [
        { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 4, areaName: 'sidebar', color: '#10b981' },
        { colStart: 2, colEnd: 5, rowStart: 1, rowEnd: 2, areaName: 'topbar', color: '#3b82f6' },
        { colStart: 2, colEnd: 5, rowStart: 2, rowEnd: 3, areaName: 'content', color: '#8b5cf6' },
        { colStart: 2, colEnd: 5, rowStart: 3, rowEnd: 4, areaName: 'footer', color: '#f59e0b' },
      ],
    },
    cards: {
      columns: 3,
      rows: 2,
      colSize: '1fr 1fr 1fr',
      rowSize: '1fr 1fr',
      colGap: '16px',
      rowGap: '16px',
      items: [
        { colStart: 1, colEnd: 2, rowStart: 1, rowEnd: 2, areaName: 'card-1', color: '#3b82f6' },
        { colStart: 2, colEnd: 3, rowStart: 1, rowEnd: 2, areaName: 'card-2', color: '#10b981' },
        { colStart: 3, colEnd: 4, rowStart: 1, rowEnd: 2, areaName: 'card-3', color: '#f59e0b' },
        { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3, areaName: 'card-4', color: '#ef4444' },
        { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3, areaName: 'card-5', color: '#8b5cf6' },
        { colStart: 3, colEnd: 4, rowStart: 2, rowEnd: 3, areaName: 'card-6', color: '#ec4899' },
      ],
    },
    dashboard: {
      columns: 6,
      rows: 4,
      colSize: 'repeat(6, 1fr)',
      rowSize: 'auto 200px 1fr 1fr',
      colGap: '10px',
      rowGap: '10px',
      items: [
        { colStart: 1, colEnd: 7, rowStart: 1, rowEnd: 2, areaName: 'header', color: '#3b82f6' },
        { colStart: 1, colEnd: 3, rowStart: 2, rowEnd: 3, areaName: 'stats-1', color: '#10b981' },
        { colStart: 3, colEnd: 5, rowStart: 2, rowEnd: 3, areaName: 'stats-2', color: '#f59e0b' },
        { colStart: 5, colEnd: 7, rowStart: 2, rowEnd: 3, areaName: 'stats-3', color: '#ef4444' },
        { colStart: 1, colEnd: 5, rowStart: 3, rowEnd: 5, areaName: 'main-chart', color: '#8b5cf6' },
        { colStart: 5, colEnd: 7, rowStart: 3, rowEnd: 5, areaName: 'sidebar', color: '#ec4899' },
      ],
    },
    gallery: {
      columns: 4,
      rows: 3,
      colSize: 'repeat(4, 1fr)',
      rowSize: '200px 200px 200px',
      colGap: '8px',
      rowGap: '8px',
      items: [
        { colStart: 1, colEnd: 3, rowStart: 1, rowEnd: 2, areaName: 'hero', color: '#3b82f6' },
        { colStart: 3, colEnd: 4, rowStart: 1, rowEnd: 2, areaName: 'img-1', color: '#10b981' },
        { colStart: 4, colEnd: 5, rowStart: 1, rowEnd: 2, areaName: 'img-2', color: '#f59e0b' },
        { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3, areaName: 'img-3', color: '#ef4444' },
        { colStart: 2, colEnd: 4, rowStart: 2, rowEnd: 3, areaName: 'wide', color: '#8b5cf6' },
        { colStart: 4, colEnd: 5, rowStart: 2, rowEnd: 4, areaName: 'tall', color: '#ec4899' },
        { colStart: 1, colEnd: 2, rowStart: 3, rowEnd: 4, areaName: 'img-4', color: '#06b6d4' },
        { colStart: 2, colEnd: 4, rowStart: 3, rowEnd: 4, areaName: 'footer-bar', color: '#f97316' },
      ],
    },
    blog: {
      columns: 3,
      rows: 3,
      colSize: '1fr 2fr 1fr',
      rowSize: 'auto 1fr auto',
      colGap: '16px',
      rowGap: '16px',
      items: [
        { colStart: 1, colEnd: 4, rowStart: 1, rowEnd: 2, areaName: 'header', color: '#3b82f6' },
        { colStart: 1, colEnd: 2, rowStart: 2, rowEnd: 3, areaName: 'toc', color: '#10b981' },
        { colStart: 2, colEnd: 3, rowStart: 2, rowEnd: 3, areaName: 'article', color: '#8b5cf6' },
        { colStart: 3, colEnd: 4, rowStart: 2, rowEnd: 3, areaName: 'related', color: '#f59e0b' },
        { colStart: 1, colEnd: 4, rowStart: 3, rowEnd: 4, areaName: 'footer', color: '#ef4444' },
      ],
    },
  };

  /**
   * Generate CSS grid-template-columns value from an item count and sizing string.
   * @param {number} count - Number of columns
   * @param {string} sizeStr - Column sizing string (e.g. "1fr 1fr 1fr")
   * @returns {string}
   */
  function resolveColumnTemplate(count, sizeStr) {
    const parts = sizeStr.trim().split(/\s+/);
    if (parts.length >= count) return parts.slice(0, count).join(' ');
    if (parts.length > 0) return `repeat(${count}, ${parts[0]})`;
    return `repeat(${count}, 1fr)`;
  }

  /**
   * Generate CSS grid-template-rows value from an item count and sizing string.
   * @param {number} count - Number of rows
   * @param {string} sizeStr - Row sizing string
   * @returns {string}
   */
  function resolveRowTemplate(count, sizeStr) {
    const parts = sizeStr.trim().split(/\s+/);
    if (parts.length >= count) return parts.slice(0, count).join(' ');
    if (parts.length > 0) return `repeat(${count}, ${parts[0]})`;
    return `repeat(${count}, auto)`;
  }

  /**
   * Build the CSS `grid-area` or `grid-column`/`grid-row` string for an item.
   * @param {object} item - The grid item
   * @returns {object} { styleString, areaName }
   */
  function buildItemStyle(item) {
    const cols = `grid-column: ${item.colStart} / ${item.colEnd};`;
    const rows = `grid-row: ${item.rowStart} / ${item.rowEnd};`;
    const area = item.areaName ? `grid-area: ${item.areaName};` : '';
    return { cols, rows, area };
  }

  /**
   * Build grid-template-areas string from items.
   * @param {number} cols
   * @param {number} rows
   * @param {Array} items
   * @returns {string|null}
   */
  function buildTemplateAreas(cols, rows, items) {
    const allNamed = items.every((it) => it.areaName && it.areaName.trim() !== '');
    if (!allNamed || items.length === 0) return null;

    const grid = Array.from({ length: rows }, () => Array(cols).fill('.'));
    items.forEach((item) => {
      for (let r = item.rowStart - 1; r < item.rowEnd - 1 && r < rows; r++) {
        for (let c = item.colStart - 1; c < item.colEnd - 1 && c < cols; c++) {
          grid[r][c] = item.areaName.replace(/\s+/g, '-');
        }
      }
    });

    return grid.map((row) => `"${row.join(' ')}"`).join('\n    ');
  }

  /**
   * Generate full CSS code string for the grid.
   * @param {object} config
   * @param {Array} items
   * @returns {string}
   */
  function generateCSS(config, items) {
    const { columns, rows, colSize, rowSize, colGap, rowGap, showAreas } = config;
    const colTemplate = resolveColumnTemplate(columns, colSize);
    const rowTemplate = resolveRowTemplate(rows, rowSize);

    let css = `.grid-container {\n`;
    css += `  display: grid;\n`;
    css += `  grid-template-columns: ${colTemplate};\n`;
    css += `  grid-template-rows: ${rowTemplate};\n`;
    css += `  gap: ${rowGap} ${colGap};\n`;

    if (showAreas) {
      const areas = buildTemplateAreas(columns, rows, items);
      if (areas) {
        css += `  grid-template-areas:\n    ${areas};\n`;
      }
    }

    css += `}\n`;

    items.forEach((item, idx) => {
      const name = item.areaName || `item-${idx + 1}`;
      css += `\n.${name} {\n`;
      if (showAreas && item.areaName) {
        css += `  grid-area: ${item.areaName};\n`;
      } else {
        css += `  grid-column: ${item.colStart} / ${item.colEnd};\n`;
        css += `  grid-row: ${item.rowStart} / ${item.rowEnd};\n`;
      }
      css += `  background: ${item.color};\n`;
      css += `  border-radius: 8px;\n`;
      css += `  padding: 16px;\n`;
      css += `  color: white;\n`;
      css += `  font-weight: 600;\n`;
      css += `}\n`;
    });

    return css;
  }

  /**
   * Generate HTML markup for the grid.
   * @param {Array} items
   * @param {boolean} useAreas
   * @returns {string}
   */
  function generateHTML(items, useAreas) {
    let html = `<div class="grid-container">\n`;
    items.forEach((item, idx) => {
      const cls = item.areaName || `item-${idx + 1}`;
      const label = item.areaName || `Item ${idx + 1}`;
      html += `  <div class="${cls}">${escapeHtmlStr(label)}</div>\n`;
    });
    html += `</div>`;
    return html;
  }

  /**
   * Internal escape helper (avoids dependency on CradleEscape for engine purity).
   */
  function escapeHtmlStr(val) {
    if (typeof CradleEscape !== 'undefined' && CradleEscape.escapeHtml) {
      return CradleEscape.escapeHtml(val);
    }
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Generate the combined code output based on the active tab.
   * @param {string} tab - 'css' | 'html' | 'both'
   * @param {object} config
   * @param {Array} items
   * @returns {string}
   */
  function generateCode(tab, config, items) {
    const css = generateCSS(config, items);
    const html = generateHTML(items, config.showAreas);

    switch (tab) {
      case 'css':
        return css;
      case 'html':
        return html;
      case 'both':
        return `<!-- HTML -->\n${html}\n\n/* CSS */\n${css}`;
      default:
        return css;
    }
  }

  /**
   * Get the next color from the palette based on current items count.
   */
  function nextColor(itemsCount) {
    return ITEM_COLORS[itemsCount % ITEM_COLORS.length];
  }

  /**
   * Auto-generate an area name for a new item.
   */
  function autoAreaName(itemsCount) {
    const names = [
      'header', 'sidebar', 'main', 'footer', 'hero',
      'nav', 'content', 'aside', 'widget', 'banner',
      'panel', 'card',
    ];
    if (itemsCount < names.length) return names[itemsCount];
    return `area-${itemsCount + 1}`;
  }

  return {
    PRESETS,
    ITEM_COLORS,
    resolveColumnTemplate,
    resolveRowTemplate,
    buildItemStyle,
    buildTemplateAreas,
    generateCSS,
    generateHTML,
    generateCode,
    nextColor,
    autoAreaName,
  };
})();
