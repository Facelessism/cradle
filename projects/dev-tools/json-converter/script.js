/**
 * JSON Converter — UI Orchestration
 *
 * Wires together the textarea, syntax-highlighting layer,
 * format toggles, action buttons, and error panel.
 */

/* ------------------------------------------------------------------ */
/* DOM References                                                     */
/* ------------------------------------------------------------------ */

const jsonInput = document.getElementById('jsonInput');
const highlightLayer = document.getElementById('highlightLayer');
const outputContent = document.getElementById('outputContent');
const outputLabel = document.getElementById('outputLabel');

const errorPanel = document.getElementById('errorPanel');
const errorLine = document.getElementById('errorLine');
const errorMsg = document.getElementById('errorMsg');
const errorBadge = document.getElementById('errorBadge');

const formatBtns = document.querySelectorAll('.format-btn');
const formatBtn = document.getElementById('formatBtn');
const minifyBtn = document.getElementById('minifyBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');

/* ------------------------------------------------------------------ */
/* State                                                              */
/* ------------------------------------------------------------------ */

let currentFormat = 'yaml';
let lastValidJSON = null;

/* ------------------------------------------------------------------ */
/* Scroll Synchronization                                             */
/* ------------------------------------------------------------------ */

jsonInput.addEventListener('scroll', () => {
  highlightLayer.scrollTop = jsonInput.scrollTop;
  highlightLayer.scrollLeft = jsonInput.scrollLeft;
});

/* ------------------------------------------------------------------ */
/* Input & Syntax Highlighting                                        */
/* ------------------------------------------------------------------ */

jsonInput.addEventListener('input', onInput);

jsonInput.addEventListener('input', syncHighlight);

function syncHighlight() {
  const text = jsonInput.value;

  if (!text) {
    highlightLayer.innerHTML = '';
    return;
  }

  try {
    JSON.parse(text);

    // Valid JSON gets syntax highlighting.
    highlightLayer.innerHTML = highlightJSON(text);
  } catch {
    // Invalid JSON is shown as plain escaped text.
    // This keeps the highlighting layer aligned with the textarea.
    highlightLayer.textContent = text;
  }
}

/* ------------------------------------------------------------------ */
/* Core Conversion Pipeline                                           */
/* ------------------------------------------------------------------ */

function onInput() {
  const text = jsonInput.value.trim();

  // Empty input.
  if (!text) {
    hideError();

    lastValidJSON = null;

    outputContent.innerHTML =
      '<span class="empty-hint">Converted output appears here…</span>';

    outputLabel.textContent = 'Output';

    return;
  }

  const result = parseJSON(text);

  // Invalid JSON.
  if (!result.valid) {
    showError(result.error);

    lastValidJSON = null;

    outputContent.textContent = '';
    outputLabel.textContent = 'Output';

    return;
  }

  // Valid JSON.
  hideError();

  lastValidJSON = result.value;

  renderOutput(result.value);

  highlightLayer.innerHTML = highlightJSON(text);
}

/* ------------------------------------------------------------------ */
/* Output Rendering                                                   */
/* ------------------------------------------------------------------ */

function renderOutput(obj) {
  let outputText;

  switch (currentFormat) {
    case 'csv':
      outputText = toCsv(obj);
      outputLabel.textContent = 'Output — CSV';
      break;

    case 'xml':
      outputText = toXml(obj);
      outputLabel.textContent = 'Output — XML';
      break;

    case 'yaml':
    default:
      outputText = toYaml(obj).trimStart();
      outputLabel.textContent = 'Output — YAML';
      break;
  }

  outputContent.textContent = outputText || ' ';
}

/* ------------------------------------------------------------------ */
/* Format Toggle                                                      */
/* ------------------------------------------------------------------ */

formatBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    formatBtns.forEach(button => {
      button.classList.remove('active');
    });

    btn.classList.add('active');

    currentFormat = btn.dataset.format;

    if (lastValidJSON !== null) {
      renderOutput(lastValidJSON);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Format / Pretty Print                                               */
/* ------------------------------------------------------------------ */

formatBtn.addEventListener('click', () => {
  const text = jsonInput.value;

  if (!text) {
    return;
  }

  const formatted = formatJSON(text);

  if (formatted !== text) {
    jsonInput.value = formatted;

    syncHighlight();
    onInput();
  }
});

/* ------------------------------------------------------------------ */
/* Minify                                                             */
/* ------------------------------------------------------------------ */

minifyBtn.addEventListener('click', () => {
  const text = jsonInput.value;

  if (!text) {
    return;
  }

  const minified = minifyJSON(text);

  if (minified !== text) {
    jsonInput.value = minified;

    syncHighlight();
    onInput();
  }
});

/* ------------------------------------------------------------------ */
/* Copy to Clipboard                                                  */
/* ------------------------------------------------------------------ */

copyBtn.addEventListener('click', async () => {
  const text = outputContent.textContent;

  if (
    !text ||
    text === 'Converted output appears here…'
  ) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied!');
  } catch {
    // Fallback for browsers without Clipboard API support.
    const textarea = document.createElement('textarea');

    textarea.value = text;
    document.body.appendChild(textarea);

    textarea.select();
    document.execCommand('copy');

    document.body.removeChild(textarea);

    showToast('Copied!');
  }
});

/* ------------------------------------------------------------------ */
/* Download                                                           */
/* ------------------------------------------------------------------ */

downloadBtn.addEventListener('click', () => {
  const text = outputContent.textContent;

  if (
    !text ||
    text === 'Converted output appears here…'
  ) {
    return;
  }

  const extensionMap = {
    yaml: 'yaml',
    csv: 'csv',
    xml: 'xml'
  };

  const mimeTypeMap = {
    yaml: 'text/yaml',
    csv: 'text/csv',
    xml: 'application/xml'
  };

  const extension =
    extensionMap[currentFormat] || 'txt';

  const mimeType =
    mimeTypeMap[currentFormat] || 'text/plain';

  const blob = new Blob([text], {
    type: mimeType
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');

  link.href = url;
  link.download = `output.${extension}`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  showToast('Downloaded!');
});

/* ------------------------------------------------------------------ */
/* Error Display                                                      */
/* ------------------------------------------------------------------ */

/**
 * Display a JSON parsing error in the UI.
 *
 * The parser provides:
 *   - message
 *   - line
 *   - column
 */
function showError(error) {
  errorLine.textContent =
    `Line ${error.line}, Column ${error.column}:`;

  errorMsg.textContent = error.message;

  errorPanel.classList.add('visible');
  errorBadge.classList.add('visible');
}

/**
 * Hide the JSON parsing error UI.
 */
function hideError() {
  errorPanel.classList.remove('visible');
  errorBadge.classList.remove('visible');
}

/* ------------------------------------------------------------------ */
/* Toast Notification                                                 */
/* ------------------------------------------------------------------ */

let toastTimer = null;

function showToast(message) {
  const existingToast =
    document.querySelector('.toast');

  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');

  toast.className = 'toast';
  toast.textContent = message;

  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1e293b',
    color: '#e2e8f0',
    padding: '10px 24px',
    borderRadius: '12px',
    border: '1px solid #334155',
    fontSize: '14px',
    zIndex: '999',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
    opacity: '0',
    transition: 'opacity 0.2s'
  });

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
  });

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.style.opacity = '0';

    setTimeout(() => {
      toast.remove();
    }, 200);
  }, 1800);
}

/* ------------------------------------------------------------------ */
/* Keyboard Shortcut: Tab                                             */
/* ------------------------------------------------------------------ */

jsonInput.addEventListener('keydown', event => {
  if (event.key !== 'Tab') {
    return;
  }

  event.preventDefault();

  const start = jsonInput.selectionStart;
  const end = jsonInput.selectionEnd;

  jsonInput.value =
    jsonInput.value.slice(0, start) +
    '  ' +
    jsonInput.value.slice(end);

  jsonInput.selectionStart =
    jsonInput.selectionEnd =
      start + 2;

  // Re-run validation, highlighting, and conversion.
  jsonInput.dispatchEvent(
    new Event('input')
  );
});

/* ------------------------------------------------------------------ */
/* Initial Sample Data                                                */
/* ------------------------------------------------------------------ */

const sampleJSON = JSON.stringify(
  {
    name: 'Alice',
    age: 30,
    isActive: true,
    hobbies: [
      'reading',
      'cycling',
      'photography'
    ],
    address: {
      city: 'San Francisco',
      zip: '94105'
    }
  },
  null,
  2
);

jsonInput.value = sampleJSON;

syncHighlight();
onInput();