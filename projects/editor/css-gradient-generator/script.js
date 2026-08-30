document.addEventListener('DOMContentLoaded', () => {
  /* ── DOM refs ── */
  const typeButtons = document.querySelectorAll('.btn-type');
  const angleCard = document.getElementById('angleCard');
  const angleSlider = document.getElementById('angleSlider');
  const angleInput = document.getElementById('angleInput');
  const anglePresets = document.querySelectorAll('.btn-angle');
  const stopsContainer = document.getElementById('stopsContainer');
  const addStopBtn = document.getElementById('addStopBtn');
  const presetGrid = document.getElementById('presetGrid');
  const previewBox = document.getElementById('previewBox');
  const codeBlock = document.getElementById('codeBlock');
  const copyBtn = document.getElementById('copyBtn');
  const randomizeBtn = document.getElementById('randomizeBtn');
  const toast = document.getElementById('toast');

  /* ── State ── */
  let gradientType = 'linear';
  let angle = 135;
  let stops = [
    { color: '#6366f1', pos: 0 },
    { color: '#ec4899', pos: 50 },
    { color: '#f59e0b', pos: 100 },
  ];

  /* ── Presets ── */
  const PRESETS = [
    { stops: [{ color: '#6366f1', pos: 0 }, { color: '#ec4899', pos: 100 }], angle: 135 },
    { stops: [{ color: '#0ea5e9', pos: 0 }, { color: '#8b5cf6', pos: 100 }], angle: 135 },
    { stops: [{ color: '#10b981', pos: 0 }, { color: '#06b6d4', pos: 100 }], angle: 90 },
    { stops: [{ color: '#f43f5e', pos: 0 }, { color: '#f97316', pos: 100 }], angle: 45 },
    { stops: [{ color: '#1e1b4b', pos: 0 }, { color: '#7c3aed', pos: 50 }, { color: '#c084fc', pos: 100 }], angle: 135 },
    { stops: [{ color: '#0f172a', pos: 0 }, { color: '#1e40af', pos: 50 }, { color: '#38bdf8', pos: 100 }], angle: 180 },
    { stops: [{ color: '#dc2626', pos: 0 }, { color: '#facc15', pos: 50 }, { color: '#16a34a', pos: 100 }], angle: 90 },
    { stops: [{ color: '#fbbf24', pos: 0 }, { color: '#f97316', pos: 100 }], angle: 45 },
    { stops: [{ color: '#a855f7', pos: 0 }, { color: '#ec4899', pos: 100 }], angle: 135 },
    { stops: [{ color: '#334155', pos: 0 }, { color: '#0f172a', pos: 100 }], angle: 180 },
    { stops: [{ color: '#34d399', pos: 0 }, { color: '#3b82f6', pos: 50 }, { color: '#8b5cf6', pos: 100 }], angle: 135 },
    { stops: [{ color: '#fb923c', pos: 0 }, { color: '#f43f5e', pos: 100 }], angle: 90 },
  ];

  /* ── Utility ── */
  function randomHex() {
    return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  }

  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 1800);
  }

  /* ── CSS generation ── */
  function buildGradientCSS(forPreview) {
    const sorted = [...stops].sort((a, b) => a.pos - b.pos);
    const stopsStr = sorted.map(s => `${s.color} ${s.pos}%`).join(', ');

    if (gradientType === 'linear') {
      return `linear-gradient(${angle}deg, ${stopsStr})`;
    }
    if (gradientType === 'radial') {
      return `radial-gradient(circle, ${stopsStr})`;
    }
    return `conic-gradient(from ${angle}deg, ${stopsStr})`;
  }

  function buildCSSOutput() {
    const grad = buildGradientCSS();
    return `.gradient {\n  background: ${grad};\n}`;
  }

  /* ── Render stops UI ── */
  function renderStops() {
    stopsContainer.innerHTML = stops
      .map(
        (s, i) => `
        <div class="stop-row" data-index="${i}">
          <input type="color" value="${s.color}" data-field="color" data-index="${i}" />
          <div class="stop-pos-group">
            <input type="number" class="stop-pos" value="${s.pos}" min="0" max="100"
                   data-field="pos" data-index="${i}" />
            <span class="stop-pos-unit">%</span>
          </div>
          ${stops.length > 2 ? `<button class="stop-remove" data-index="${i}" title="Remove">✕</button>` : ''}
        </div>`
      )
      .join('');

    /* Bind events */
    stopsContainer.querySelectorAll('input[type="color"]').forEach((el) => {
      el.addEventListener('input', (e) => {
        stops[parseInt(e.target.dataset.index)].color = e.target.value;
        update();
      });
    });

    stopsContainer.querySelectorAll('.stop-pos').forEach((el) => {
      el.addEventListener('input', (e) => {
        const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
        stops[parseInt(e.target.dataset.index)].pos = v;
        update();
      });
    });

    stopsContainer.querySelectorAll('.stop-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        stops.splice(parseInt(btn.dataset.index), 1);
        renderStops();
        update();
      });
    });
  }

  /* ── Render presets ── */
  function renderPresets() {
    presetGrid.innerHTML = PRESETS.map((p, i) => {
      const sorted = [...p.stops].sort((a, b) => a.pos - b.pos);
      const grad = `linear-gradient(${p.angle}deg, ${sorted.map(s => `${s.color} ${s.pos}%`).join(', ')})`;
      return `<div class="preset-swatch" data-index="${i}" style="background:${grad}" title="Preset ${i + 1}"></div>`;
    }).join('');

    presetGrid.querySelectorAll('.preset-swatch').forEach((el) => {
      el.addEventListener('click', () => {
        const p = PRESETS[parseInt(el.dataset.index)];
        stops = p.stops.map((s) => ({ ...s }));
        angle = p.angle;
        angleSlider.value = angle;
        angleInput.value = angle;
        renderStops();
        update();
        showToast('Preset applied!');
      });
    });
  }

  /* ── Main update ── */
  function update() {
    const grad = buildGradientCSS();
    previewBox.style.background = grad;
    codeBlock.textContent = buildCSSOutput();
  }

  /* ── Events ── */

  /* Type */
  typeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      typeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      gradientType = btn.dataset.type;
      angleCard.style.display = gradientType === 'radial' ? 'none' : '';
      update();
    });
  });

  /* Angle */
  angleSlider.addEventListener('input', (e) => {
    angle = parseInt(e.target.value);
    angleInput.value = angle;
    anglePresets.forEach((b) => b.classList.toggle('active', parseInt(b.dataset.angle) === angle));
    update();
  });

  angleInput.addEventListener('input', (e) => {
    angle = Math.min(360, Math.max(0, parseInt(e.target.value) || 0));
    angleSlider.value = angle;
    anglePresets.forEach((b) => b.classList.toggle('active', parseInt(b.dataset.angle) === angle));
    update();
  });

  anglePresets.forEach((btn) => {
    btn.addEventListener('click', () => {
      angle = parseInt(btn.dataset.angle);
      angleSlider.value = angle;
      angleInput.value = angle;
      anglePresets.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      update();
    });
  });

  /* Add stop */
  addStopBtn.addEventListener('click', () => {
    const lastPos = stops[stops.length - 1].pos;
    const newPos = Math.min(100, lastPos + 10);
    stops.push({ color: randomHex(), pos: newPos });
    renderStops();
    update();
  });

  /* Copy */
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(codeBlock.textContent);
      copyBtn.classList.add('copied');
      copyBtn.textContent = '✓ Copied';
      showToast('Copied to clipboard!');
      setTimeout(() => { copyBtn.classList.remove('copied'); copyBtn.textContent = '📋 Copy'; }, 2000);
    } catch {
      showToast('Copy failed — select manually');
    }
  });

  /* Randomize */
  randomizeBtn.addEventListener('click', () => {
    const count = 2 + Math.floor(Math.random() * 3);
    stops = Array.from({ length: count }, (_, i) => ({
      color: randomHex(),
      pos: Math.round((i / (count - 1)) * 100),
    }));
    angle = Math.floor(Math.random() * 360);
    angleSlider.value = angle;
    angleInput.value = angle;
    renderStops();
    update();
    showToast('Random gradient!');
  });

  /* ── Init ── */
  renderPresets();
  renderStops();
  update();
});
