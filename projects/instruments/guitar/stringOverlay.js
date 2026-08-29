(function () {
  const guitarEl = document.getElementById('guitar');
  const neckEl = document.getElementById('guitarNeck');
  const svg = document.getElementById('stringOverlay');
  const bridgePinsEl = document.getElementById('bridgePins');

  if (!guitarEl || !neckEl || !svg || !bridgePinsEl) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function getStringButtons() {
    return Array.from(document.querySelectorAll('#strings .string'));
  }

  function getBridgePins() {
    return Array.from(bridgePinsEl.querySelectorAll('span'));
  }

  function drawOverlay() {
    const stringButtons = getStringButtons();
    const bridgePins = getBridgePins();

    if (!stringButtons.length || !bridgePins.length) return;

    const guitarRect = guitarEl.getBoundingClientRect();
    const neckRect = neckEl.getBoundingClientRect();

    svg.setAttribute('viewBox', `0 0 ${guitarRect.width} ${guitarRect.height}`);
    svg.innerHTML = '';

    const startX = neckRect.right - guitarRect.left;

    stringButtons.forEach((btn, i) => {
      const pin = bridgePins[i];
      if (!pin) return;

      const btnRect = btn.getBoundingClientRect();
      const pinRect = pin.getBoundingClientRect();

      const startY = btnRect.top + btnRect.height / 2 - guitarRect.top;
      const endX = pinRect.left + pinRect.width / 2 - guitarRect.left;
      const endY = pinRect.top + pinRect.height / 2 - guitarRect.top;

      const style = getComputedStyle(btn);
      const strokeColor = style.getPropertyValue('--string-color').trim() || '#ddd';
      const strokeWidth = style.getPropertyValue('--string-width').trim() || '3px';

      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', startX);
      line.setAttribute('y1', startY);
      line.setAttribute('x2', endX);
      line.setAttribute('y2', endY);
      line.setAttribute('stroke', strokeColor);
      line.setAttribute('stroke-width', strokeWidth);
      line.dataset.stringIndex = String(i);

      if (btn.classList.contains('active')) {
        line.classList.add('active');
      }

      svg.appendChild(line);
    });
  }

  function syncActiveStates() {
    const stringButtons = getStringButtons();
    stringButtons.forEach((btn, i) => {
      const line = svg.querySelector(`line[data-string-index="${i}"]`);
      if (!line) return;
      line.classList.toggle('active', btn.classList.contains('active'));
    });
  }

  function init() {
    drawOverlay();

    const stringButtons = getStringButtons();
    if (stringButtons.length) {
      const observer = new MutationObserver(syncActiveStates);
      stringButtons.forEach((btn) => {
        observer.observe(btn, { attributes: true, attributeFilter: ['class'] });
      });
    }

    window.addEventListener('resize', drawOverlay);

    window.addEventListener('orientationchange', () => {
      setTimeout(drawOverlay, 150);
    });
    window.addEventListener('load', drawOverlay);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(drawOverlay).catch(() => {});
    }

    setTimeout(drawOverlay, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();