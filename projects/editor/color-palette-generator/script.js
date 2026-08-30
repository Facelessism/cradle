document.addEventListener('DOMContentLoaded', () => {
  /* ------------------------------------------------------------------ */
  /*  DOM References                                                     */
  /* ------------------------------------------------------------------ */
  const baseColorInput = document.getElementById('baseColor');
  const hexInput = document.getElementById('hexInput');
  const randomBtn = document.getElementById('randomBtn');
  const harmonyButtons = document.querySelectorAll('.btn-harmony');
  const paletteGrid = document.getElementById('paletteGrid');
  const regenerateBtn = document.getElementById('regenerateBtn');
  const contrastBg = document.getElementById('contrastBg');
  const contrastFg = document.getElementById('contrastFg');
  const useFromPaletteBtn = document.getElementById('useFromPalette');
  const contrastResults = document.getElementById('contrastResults');
  const contrastPreview = document.getElementById('contrastPreview');
  const exportTabs = document.querySelectorAll('.btn-tab');
  const exportCode = document.getElementById('exportCode');
  const copyExport = document.getElementById('copyExport');

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */
  let currentHex = '#38bdf8';
  let currentMode = 'complementary';
  let currentFormat = 'css';
  let palette = [];
  let lockedIndices = new Set();
  let contrastUseMode = 'fg'; // toggles between fg and bg when clicking palette swatch

  /* ------------------------------------------------------------------ */
  /*  Color Utility Functions                                            */
  /* ------------------------------------------------------------------ */

  /** Parse hex to { r, g, b } 0-255 */
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16),
    };
  }

  /** RGB to hex */
  function rgbToHex(r, g, b) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return (
      '#' +
      [clamp(r), clamp(g), clamp(b)]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  /** RGB to HSL  { h: 0-360, s: 0-100, l: 0-100 } */
  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  /** HSL to RGB */
  function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  /** Relative luminance for WCAG 2.x */
  function luminance(r, g, b) {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  /** Contrast ratio between two hex colors */
  function contrastRatio(hex1, hex2) {
    const c1 = hexToRgb(hex1);
    const c2 = hexToRgb(hex2);
    const l1 = luminance(c1.r, c1.g, c1.b);
    const l2 = luminance(c2.r, c2.g, c2.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /** Random hex color */
  function randomHex() {
    return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  }

  /* ------------------------------------------------------------------ */
  /*  Palette Generation                                                 */
  /* ------------------------------------------------------------------ */

  function generatePalette(hex, mode) {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const colors = [];

    const hslToHex = (h, s, l) => {
      h = ((h % 360) + 360) % 360;
      const c = hslToRgb(h, s, l);
      return rgbToHex(c.r, c.g, c.b);
    };

    switch (mode) {
      case 'complementary':
        colors.push(hex);
        colors.push(hslToHex(hsl.h + 180, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h, Math.max(hsl.s - 20, 10), Math.min(hsl.l + 20, 90)));
        colors.push(hslToHex(hsl.h + 180, Math.max(hsl.s - 20, 10), Math.min(hsl.l + 20, 90)));
        colors.push(hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 25, 10)));
        break;

      case 'analogous':
        for (let i = -2; i <= 2; i++) {
          colors.push(hslToHex(hsl.h + i * 30, hsl.s, hsl.l));
        }
        break;

      case 'triadic':
        colors.push(hex);
        colors.push(hslToHex(hsl.h + 120, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h + 240, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h + 120, Math.max(hsl.s - 15, 10), Math.min(hsl.l + 15, 90)));
        colors.push(hslToHex(hsl.h + 240, Math.max(hsl.s - 15, 10), Math.min(hsl.l + 15, 90)));
        break;

      case 'split-complementary':
        colors.push(hex);
        colors.push(hslToHex(hsl.h + 150, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h + 210, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h + 150, Math.max(hsl.s - 20, 10), Math.min(hsl.l + 20, 90)));
        colors.push(hslToHex(hsl.h + 210, Math.max(hsl.s - 20, 10), Math.min(hsl.l + 20, 90)));
        break;

      case 'tetradic':
        colors.push(hex);
        colors.push(hslToHex(hsl.h + 90, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h + 180, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h + 270, hsl.s, hsl.l));
        colors.push(hslToHex(hsl.h + 45, Math.max(hsl.s - 20, 10), Math.min(hsl.l + 15, 90)));
        break;

      case 'monochromatic':
        colors.push(hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 30, 8)));
        colors.push(hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 15, 12)));
        colors.push(hex);
        colors.push(hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 15, 88)));
        colors.push(hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 30, 92)));
        break;

      default:
        colors.push(hex);
    }

    return colors;
  }

  /* ------------------------------------------------------------------ */
  /*  Render Palette                                                     */
  /* ------------------------------------------------------------------ */

  function renderPalette() {
    const newColors = generatePalette(currentHex, currentMode);
    // Merge locked colors
    palette = newColors.map((c, i) => {
      if (lockedIndices.has(i) && palette[i]) return palette[i];
      return c;
    });

    paletteGrid.innerHTML = palette
      .map((color, idx) => {
        const rgb = hexToRgb(color);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const isLocked = lockedIndices.has(idx);
        return `
          <div class="swatch" data-index="${idx}">
            <div class="swatch-color" style="background:${color}">
              <button class="swatch-lock ${isLocked ? 'locked' : ''}"
                      data-index="${idx}"
                      title="${isLocked ? 'Unlock' : 'Lock'} color">
                ${isLocked ? '🔒' : '🔓'}
              </button>
            </div>
            <div class="swatch-info">
              <div class="swatch-hex">${color.toUpperCase()}</div>
              <div class="swatch-rgb">rgb(${rgb.r}, ${rgb.g}, ${rgb.b})</div>
            </div>
          </div>`;
      })
      .join('');

    // Bind lock buttons
    document.querySelectorAll('.swatch-lock').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        if (lockedIndices.has(idx)) lockedIndices.delete(idx);
        else lockedIndices.add(idx);
        renderPalette();
      });
    });

    // Click swatch to use in contrast checker (alternating fg/bg)
    document.querySelectorAll('.swatch').forEach((swatch) => {
      swatch.addEventListener('click', (e) => {
        if (e.target.closest('.swatch-lock')) return;
        const idx = parseInt(swatch.dataset.index, 10);
        const color = palette[idx];
        if (contrastUseMode === 'fg') {
          contrastFg.value = color;
          contrastUseMode = 'bg';
        } else {
          contrastBg.value = color;
          contrastUseMode = 'fg';
        }
        runContrastCheck();
        showToast(`Applied ${color.toUpperCase()} as ${contrastUseMode === 'fg' ? 'background' : 'foreground'}`);
      });
    });

    updateExport();
  }

  /* ------------------------------------------------------------------ */
  /*  Contrast Checker                                                   */
  /* ------------------------------------------------------------------ */

  function runContrastCheck() {
    const bg = contrastBg.value;
    const fg = contrastFg.value;
    const ratio = contrastRatio(bg, fg);

    const aaLarge = ratio >= 3;
    const aa = ratio >= 4.5;
    const aaa = ratio >= 7;

    contrastResults.innerHTML = `
      <div class="contrast-ratio">${ratio.toFixed(2)}:1</div>
      <div class="contrast-badges">
        <span class="${aa ? 'badge-pass' : 'badge-fail'}">AA Normal ${aa ? '✓' : '✗'}</span>
        <span class="${aaLarge ? 'badge-pass' : 'badge-fail'}">AA Large ${aaLarge ? '✓' : '✗'}</span>
        <span class="${aaa ? 'badge-pass' : 'badge-fail'}">AAA ${aaa ? '✓' : '✗'}</span>
      </div>`;

    contrastPreview.style.background = bg;
    contrastPreview.style.color = fg;
  }

  /* ------------------------------------------------------------------ */
  /*  Export Generation                                                  */
  /* ------------------------------------------------------------------ */

  function updateExport() {
    const names = palette.map((_, i) => `color-${i + 1}`);
    let code = '';

    switch (currentFormat) {
      case 'css':
        code = ':root {\n';
        palette.forEach((c, i) => {
          code += `  --${names[i]}: ${c};\n`;
        });
        code += '}';
        break;

      case 'tailwind':
        code = `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        palette: {\n`;
        palette.forEach((c, i) => {
          code += `          '${(i + 1) * 100}': '${c}',\n`;
        });
        code += `        },\n      },\n    },\n  },\n};`;
        break;

      case 'json':
        const obj = {};
        palette.forEach((c, i) => {
          const rgb = hexToRgb(c);
          const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
          obj[names[i]] = {
            hex: c,
            rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
            hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
          };
        });
        code = JSON.stringify(obj, null, 2);
        break;

      case 'scss':
        palette.forEach((c, i) => {
          code += `$${names[i]}: ${c};\n`;
        });
        code += '\n$palette: (\n';
        palette.forEach((c, i) => {
          code += `  '${names[i]}': $${names[i]}${i < palette.length - 1 ? ',' : ''}\n`;
        });
        code += ');';
        break;
    }

    exportCode.textContent = code;
  }

  /* ------------------------------------------------------------------ */
  /*  Toast                                                              */
  /* ------------------------------------------------------------------ */

  let toastEl = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('visible');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('visible'), 1800);
  }

  /* ------------------------------------------------------------------ */
  /*  Event Bindings                                                     */
  /* ------------------------------------------------------------------ */

  // Base color picker
  baseColorInput.addEventListener('input', (e) => {
    currentHex = e.target.value;
    hexInput.value = currentHex.replace('#', '');
    renderPalette();
  });

  // Hex text input
  hexInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/[^0-9a-fA-F]/g, '').substring(0, 6);
    e.target.value = val;
    if (val.length === 6) {
      currentHex = '#' + val;
      baseColorInput.value = currentHex;
      renderPalette();
    }
  });

  // Random button
  randomBtn.addEventListener('click', () => {
    currentHex = randomHex();
    baseColorInput.value = currentHex;
    hexInput.value = currentHex.replace('#', '');
    renderPalette();
    showToast('Random palette generated!');
  });

  // Harmony mode buttons
  harmonyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      harmonyButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      lockedIndices.clear();
      renderPalette();
    });
  });

  // Regenerate
  regenerateBtn.addEventListener('click', () => {
    lockedIndices.clear();
    renderPalette();
    showToast('Palette regenerated!');
  });

  // Contrast checker inputs
  contrastBg.addEventListener('input', runContrastCheck);
  contrastFg.addEventListener('input', runContrastCheck);

  useFromPaletteBtn.addEventListener('click', () => {
    if (palette.length >= 2) {
      contrastBg.value = palette[0];
      contrastFg.value = palette[1];
      runContrastCheck();
      showToast('Loaded first two palette colors');
    }
  });

  // Export format tabs
  exportTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      exportTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentFormat = tab.dataset.format;
      updateExport();
    });
  });

  // Copy export
  copyExport.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(exportCode.textContent);
      copyExport.classList.add('copied');
      copyExport.textContent = '✓ Copied';
      showToast('Copied to clipboard!');
      setTimeout(() => {
        copyExport.classList.remove('copied');
        copyExport.textContent = '📋 Copy';
      }, 2000);
    } catch {
      showToast('Failed to copy — try selecting manually');
    }
  });

  /* ------------------------------------------------------------------ */
  /*  Init                                                               */
  /* ------------------------------------------------------------------ */
  renderPalette();
  runContrastCheck();
});
