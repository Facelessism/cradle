/* ==========================================================================
   CSS Shape Designer Core Application Engine
   ========================================================================== */

/**
 * Defensive guard: verify ShapeEngine loaded before script.js.
 *
 * index.html loads shapeEngine.js before script.js (classic scripts in
 * document order), so under normal circumstances ShapeEngine is defined
 * by the time this file runs. If shapeEngine.js failed to load (e.g.
 * 404, network error, file renamed), the next call to
 * ShapeEngine.generateClipPathCSS() would throw a cryptic
 * ReferenceError deep inside the render loop. We surface a clear
 * error message instead so the failure is easy to diagnose.
 *
 * See: https://github.com/Facelessism/cradle/issues/434
 */
if (typeof ShapeEngine === "undefined") {
  throw new Error(
    "[css-shape-designer] shapeEngine.js failed to load. " +
      'Ensure <script src="shapeEngine.js"></script> appears before ' +
      '<script src="script.js"></script> in index.html. ' +
      "See issue #434."
  );
}

// Load CSS sanitizer if available (shared utility)
const CssSanitizer =
  typeof window !== "undefined" && window.CradleSanitizeCss
    ? window.CradleSanitizeCss
    : (function () {
        try {
          return require("../../../src/components/ui/sanitizeCss.js");
        } catch (_) {
          return null;
        }
      })();

function sanitizeColorValue(value, fallback) {
  if (CssSanitizer && CssSanitizer.sanitizeHexColor) {
    return CssSanitizer.sanitizeHexColor(value, fallback);
  }
  return /^#[0-9A-Fa-f]{3,8}$/.test(value.trim()) ? value.trim() : fallback;
}

function sanitizeImageUrlForCss(url) {
  if (CssSanitizer && CssSanitizer.sanitizeCssUrl) {
    return CssSanitizer.sanitizeCssUrl(url, "");
  }
  // Fallback: basic URL sanitization
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/["'\)\n\r;{}]/.test(trimmed)) return "";
  if (trimmed.includes(":")) {
    const scheme = trimmed.slice(0, trimmed.indexOf(":")).toLowerCase();
    if (
      !["https", "http"].includes(scheme) &&
      !/^data:image\//i.test(trimmed)
    ) {
      return "";
    }
  }
  return trimmed;
}

const state = {
  selectedShape: "polygon", // 'polygon' | 'blob' | 'circle' | 'ellipse'

  // Polygon State
  polygonVertices: [
    { x: 50, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ],
  selectedVertexIndex: -1,

  // Blob State (top-left, top-right, bottom-right, bottom-left) for Horiz and Vert
  blob: {
    tlh: 30,
    trh: 70,
    brh: 70,
    blh: 30,
    tlv: 30,
    trv: 30,
    brv: 70,
    blv: 70,
  },

  // Circle State
  circle: { cx: 50, cy: 50, r: 40 },

  // Ellipse State
  ellipse: { cx: 50, cy: 50, rx: 40, ry: 30 },

  // Styling & Exporters
  fillMode: "gradient", // 'solid' | 'gradient' | 'image'
  solidColor: "#818cf8",
  gradColor1: "#818cf8",
  gradColor2: "#6366f1",
  gradAngle: 135,
  imageUrl:
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80",
  shadowBlur: 20,
  shadowColor: "#818cf8",

  // Drag state
  isDragging: false,
  draggedIndex: -1, // -1 means none, or center/radius identifiers
  draggedPart: null, // 'center' | 'radius' | 'radiusX' | 'radiusY' for circles/ellipses

  // Active Tab
  activeTab: "css",
};

// Shape Presets
const PRESETS = {
  polygon: [
    {
      name: "Triangle",
      value: [
        { x: 50, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    },
    {
      name: "Square",
      value: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    },
    {
      name: "Pentagon",
      value: [
        { x: 50, y: 0 },
        { x: 100, y: 38 },
        { x: 81, y: 100 },
        { x: 19, y: 100 },
        { x: 0, y: 38 },
      ],
    },
    {
      name: "Hexagon",
      value: [
        { x: 50, y: 0 },
        { x: 100, y: 25 },
        { x: 100, y: 75 },
        { x: 50, y: 100 },
        { x: 0, y: 75 },
        { x: 0, y: 25 },
      ],
    },
    {
      name: "Star",
      value: [
        { x: 50, y: 0 },
        { x: 63, y: 38 },
        { x: 100, y: 38 },
        { x: 69, y: 59 },
        { x: 82, y: 100 },
        { x: 50, y: 75 },
        { x: 18, y: 100 },
        { x: 31, y: 59 },
        { x: 0, y: 38 },
        { x: 37, y: 38 },
      ],
    },
    {
      name: "Message",
      value: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 75 },
        { x: 75, y: 75 },
        { x: 75, y: 100 },
        { x: 50, y: 75 },
        { x: 0, y: 75 },
      ],
    },
    {
      name: "Arrow",
      value: [
        { x: 0, y: 30 },
        { x: 60, y: 30 },
        { x: 60, y: 0 },
        { x: 100, y: 50 },
        { x: 60, y: 100 },
        { x: 60, y: 70 },
        { x: 0, y: 70 },
      ],
    },
  ],
  blob: [
    {
      name: "Organic Blob",
      value: {
        tlh: 30,
        trh: 70,
        brh: 70,
        blh: 30,
        tlv: 30,
        trv: 30,
        brv: 70,
        blv: 70,
      },
    },
    {
      name: "Smooth Egg",
      value: {
        tlh: 50,
        trh: 50,
        brh: 40,
        blh: 40,
        tlv: 30,
        trv: 30,
        brv: 60,
        blv: 60,
      },
    },
    {
      name: "Bean Shape",
      value: {
        tlh: 40,
        trh: 80,
        brh: 30,
        blh: 70,
        tlv: 50,
        trv: 20,
        brv: 80,
        blv: 50,
      },
    },
    {
      name: "Soft Rounded",
      value: {
        tlh: 20,
        trh: 20,
        brh: 20,
        blh: 20,
        tlv: 20,
        trv: 20,
        brv: 20,
        blv: 20,
      },
    },
  ],
  circle: [
    { name: "Centered Circle", value: { cx: 50, cy: 50, r: 40 } },
    { name: "Small Corner", value: { cx: 20, cy: 20, r: 15 } },
  ],
  ellipse: [
    { name: "Wide Ellipse", value: { cx: 50, cy: 50, rx: 45, ry: 25 } },
    { name: "Tall Ellipse", value: { cx: 50, cy: 50, rx: 25, ry: 45 } },
  ],
};

// DOM References
const shapeBtns = document.querySelectorAll(".shape-btn");
const presetsContainer = document.getElementById("presets-container");
const canvasContainer = document.getElementById("editor-canvas");
const handlesContainer = document.getElementById("handles-container");
const shapePreview = document.getElementById("shape-preview");

// Vector outlines
const svgTracer = document.getElementById("svg-tracer");
const polyTrace = document.getElementById("svg-polygon-trace");
const circleTrace = document.getElementById("svg-circle-trace");
const ellipseTrace = document.getElementById("svg-ellipse-trace");

// Control Cards
const polyCard = document.getElementById("polygon-actions-card");
const blobCard = document.getElementById("blob-sliders-card");
const ellipseCard = document.getElementById("ellipse-sliders-card");

const btnAddVertex = document.getElementById("btn-add-vertex");
const btnDeleteVertex = document.getElementById("btn-delete-vertex");
const coordEditor = document.getElementById("coord-editor-row");
const vertexInputX = document.getElementById("vertex-x");
const vertexInputY = document.getElementById("vertex-y");

// Background customizers
const fillModeSelect = document.getElementById("fill-mode");
const fillSolidGroup = document.getElementById("fill-solid-group");
const fillGradientGroup = document.getElementById("fill-gradient-group");
const fillImageGroup = document.getElementById("fill-image-group");

const colorSolidPicker = document.getElementById("color-picker-solid");
const colorSolidText = document.getElementById("color-text-solid");
const colorGrad1Picker = document.getElementById("color-picker-grad1");
const colorGrad1Text = document.getElementById("color-text-grad1");
const colorGrad2Picker = document.getElementById("color-picker-grad2");
const colorGrad2Text = document.getElementById("color-text-grad2");
const gradAngleSlider = document.getElementById("grad-angle");
const gradAngleVal = document.getElementById("val-grad-angle");

const imageUrlInput = document.getElementById("image-url");
const shadowBlurSlider = document.getElementById("shadow-blur");
const shadowBlurVal = document.getElementById("val-shadow-blur");
const colorShadowPicker = document.getElementById("color-picker-shadow");
const colorShadowText = document.getElementById("color-text-shadow");

// Exporters
const tabBtns = document.querySelectorAll(".tab-btn");
const tabPanes = document.querySelectorAll(".tab-pane");
const codeCss = document.getElementById("code-output-css");
const codeHtml = document.getElementById("code-output-html");
const btnCopyCss = document.getElementById("btn-copy-css");
const btnCopyHtml = document.getElementById("btn-copy-html");
const toastContainer = document.getElementById("toast-container");

// Theme toggles
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

/* ===================== INITIALIZE ===================== */
function init() {
  initTheme();
  setupEventListeners();
  loadPresets();
  updatePanelsVisibility();
  updateCanvas();
}

function initTheme() {
  const currentTheme =
    localStorage.getItem("theme") ||
    (window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark");
  applyTheme(currentTheme);
}

function applyTheme(theme) {
  if (theme === "light") {
    document.documentElement.classList.add("light-theme");
    if (themeIcon) themeIcon.className = "fa-solid fa-sun";
  } else {
    document.documentElement.classList.remove("light-theme");
    if (themeIcon) themeIcon.className = "fa-solid fa-moon";
  }
  localStorage.setItem("theme", theme);
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const isLight = document.documentElement.classList.contains("light-theme");
    applyTheme(isLight ? "dark" : "light");
  });
}

function setupEventListeners() {
  // Shape Selector Buttons
  shapeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      shapeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.selectedShape = btn.dataset.shape;
      state.selectedVertexIndex = -1;
      updatePanelsVisibility();
      loadPresets();
      updateCanvas();
    });
  });

  // Exporter tabs
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document
        .getElementById(`tab-pane-${btn.dataset.tab}`)
        .classList.add("active");
      state.activeTab = btn.dataset.tab;
    });
  });

  // Canvas Double Click (for adding vertices in Polygon Mode)
  canvasContainer.addEventListener("dblclick", handleCanvasDoubleClick);

  // Polygon Vertex Actions
  btnAddVertex.addEventListener("click", addVertexAtCenter);
  btnDeleteVertex.addEventListener("click", deleteSelectedVertex);
  vertexInputX.addEventListener("input", handleVertexManualInput);
  vertexInputY.addEventListener("input", handleVertexManualInput);

  // Blob Sliders
  const blobSliders = [
    "blob-r-top-left-h",
    "blob-r-top-right-h",
    "blob-r-bottom-right-h",
    "blob-r-bottom-left-h",
    "blob-r-top-left-v",
    "blob-r-top-right-v",
    "blob-r-bottom-right-v",
    "blob-r-bottom-left-v",
  ];
  blobSliders.forEach(id => {
    document
      .getElementById(id)
      .addEventListener("input", handleBlobSliderInput);
  });

  // Circle & Ellipse Sliders
  document
    .getElementById("radius-r")
    .addEventListener("input", handleCircleSliderInput);
  document
    .getElementById("radius-rx")
    .addEventListener("input", handleCircleSliderInput);
  document
    .getElementById("radius-ry")
    .addEventListener("input", handleCircleSliderInput);
  document
    .getElementById("center-cx")
    .addEventListener("input", handleCircleSliderInput);
  document
    .getElementById("center-cy")
    .addEventListener("input", handleCircleSliderInput);

  // Styling customizers listeners
  fillModeSelect.addEventListener("change", e => {
    state.fillMode = e.target.value;
    fillSolidGroup.classList.toggle("hidden", state.fillMode !== "solid");
    fillGradientGroup.classList.toggle("hidden", state.fillMode !== "gradient");
    fillImageGroup.classList.toggle("hidden", state.fillMode !== "image");
    updateCanvas();
  });

  bindColorSync(colorSolidPicker, colorSolidText, "solidColor");
  bindColorSync(colorGrad1Picker, colorGrad1Text, "gradColor1");
  bindColorSync(colorGrad2Picker, colorGrad2Text, "gradColor2");
  bindColorSync(colorShadowPicker, colorShadowText, "shadowColor");

  gradAngleSlider.addEventListener("input", e => {
    state.gradAngle = parseInt(e.target.value);
    gradAngleVal.textContent = `${state.gradAngle}°`;
    updateCanvas();
  });

  imageUrlInput.addEventListener("input", e => {
    state.imageUrl = e.target.value;
    updateCanvas();
  });

  shadowBlurSlider.addEventListener("input", e => {
    state.shadowBlur = parseInt(e.target.value);
    shadowBlurVal.textContent = `${state.shadowBlur}px`;
    updateCanvas();
  });

  // Clipboard Copiers
  btnCopyCss.addEventListener("click", () =>
    copyToClipboard(codeCss.textContent, "CSS properties copied to clipboard!")
  );
  btnCopyHtml.addEventListener("click", () =>
    copyToClipboard(codeHtml.textContent, "HTML template copied to clipboard!")
  );

  // Global Drag listeners
  document.addEventListener("mousemove", handleDocumentMouseMove);
  document.addEventListener("touchmove", handleDocumentMouseMove, {
    passive: false,
  });
  document.addEventListener("mouseup", handleDocumentMouseUp);
  document.addEventListener("touchend", handleDocumentMouseUp);
}

function bindColorSync(picker, text, stateKey) {
  picker.addEventListener("input", e => {
    const safe = sanitizeColorValue(e.target.value, null);
    if (safe !== null) {
      state[stateKey] = safe;
      text.value = safe;
      updateCanvas();
    }
  });
  text.addEventListener("input", e => {
    const safe = sanitizeColorValue(e.target.value, null);
    if (safe !== null) {
      state[stateKey] = safe;
      picker.value = safe;
      updateCanvas();
    }
  });
}

/* ===================== CONTROLS PANEL & PRESETS ===================== */
function updatePanelsVisibility() {
  polyCard.classList.toggle("hidden", state.selectedShape !== "polygon");
  blobCard.classList.toggle("hidden", state.selectedShape !== "blob");

  const isCircleOrEllipse =
    state.selectedShape === "circle" || state.selectedShape === "ellipse";
  ellipseCard.classList.toggle("hidden", !isCircleOrEllipse);
  document
    .getElementById("circle-radii-sliders")
    .classList.toggle("hidden", state.selectedShape !== "circle");
  document
    .getElementById("ellipse-radii-sliders")
    .classList.toggle("hidden", state.selectedShape !== "ellipse");
}

function loadPresets() {
  presetsContainer.innerHTML = "";
  const list = PRESETS[state.selectedShape];
  list.forEach((preset, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `preset-btn ${index === 0 ? "active" : ""}`;
    btn.textContent = preset.name;
    btn.addEventListener("click", () => {
      presetsContainer
        .querySelectorAll(".preset-btn")
        .forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadPresetValue(preset.value);
    });
    presetsContainer.appendChild(btn);
  });

  // Load first preset by default
  if (list.length > 0) {
    loadPresetValue(list[0].value);
  }
}

function loadPresetValue(val) {
  state.selectedVertexIndex = -1;
  if (btnDeleteVertex) btnDeleteVertex.disabled = true;
  if (coordEditor) coordEditor.classList.add("hidden");
  const op = state.selectedShape;

  if (op === "polygon") {
    state.polygonVertices = val.map(pt => ({ ...pt }));
  } else if (op === "blob") {
    state.blob = { ...val };
    syncSlidersFromBlobState();
  } else if (op === "circle") {
    state.circle = { ...val };
    syncSlidersFromCircleState();
  } else if (op === "ellipse") {
    state.ellipse = { ...val };
    syncSlidersFromCircleState();
  }
  updateCanvas();
}

function setElValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setElText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function syncSlidersFromBlobState() {
  setElValue("blob-r-top-left-h", state.blob.tlh);
  setElValue("blob-r-top-right-h", state.blob.trh);
  setElValue("blob-r-bottom-right-h", state.blob.brh);
  setElValue("blob-r-bottom-left-h", state.blob.blh);

  setElValue("blob-r-top-left-v", state.blob.tlv);
  setElValue("blob-r-top-right-v", state.blob.trv);
  setElValue("blob-r-bottom-right-v", state.blob.brv);
  setElValue("blob-r-bottom-left-v", state.blob.blv);

  updateBlobLabels();
}

function syncSlidersFromCircleState() {
  if (state[state.selectedShape]) {
    setElValue("center-cx", state[state.selectedShape].cx);
    setElValue("center-cy", state[state.selectedShape].cy);
  }

  setElValue("radius-r", state.circle.r);
  setElValue("radius-rx", state.ellipse.rx);
  setElValue("radius-ry", state.ellipse.ry);

  updateCircleLabels();
}

function updateBlobLabels() {
  setElText("val-top-left-h", `${state.blob.tlh}%`);
  setElText("val-top-right-h", `${state.blob.trh}%`);
  setElText("val-bottom-right-h", `${state.blob.brh}%`);
  setElText("val-bottom-left-h", `${state.blob.blh}%`);

  setElText("val-top-left-v", `${state.blob.tlv}%`);
  setElText("val-top-right-v", `${state.blob.trv}%`);
  setElText("val-bottom-right-v", `${state.blob.brv}%`);
  setElText("val-bottom-left-v", `${state.blob.blv}%`);
}

function updateCircleLabels() {
  const shape = state.selectedShape;
  if (state[shape]) {
    setElText("val-center-cx", `${state[shape].cx}%`);
    setElText("val-center-cy", `${state[shape].cy}%`);
  }
  setElText("val-radius-r", `${state.circle.r}%`);
  setElText("val-radius-rx", `${state.ellipse.rx}%`);
  setElText("val-radius-ry", `${state.ellipse.ry}%`);
}

function handleBlobSliderInput(e) {
  const keyMap = {
    "blob-r-top-left-h": "tlh",
    "blob-r-top-right-h": "trh",
    "blob-r-bottom-right-h": "brh",
    "blob-r-bottom-left-h": "blh",
    "blob-r-top-left-v": "tlv",
    "blob-r-top-right-v": "trv",
    "blob-r-bottom-right-v": "brv",
    "blob-r-bottom-left-v": "blv",
  };
  const val = parseInt(e.target.value);
  state.blob[keyMap[e.target.id]] = val;
  updateBlobLabels();
  updateCanvas();
}

function handleCircleSliderInput(e) {
  const val = parseInt(e.target.value);
  const shape = state.selectedShape;

  if (e.target.id === "center-cx") state[shape].cx = val;
  else if (e.target.id === "center-cy") state[shape].cy = val;
  else if (e.target.id === "radius-r") state.circle.r = val;
  else if (e.target.id === "radius-rx") state.ellipse.rx = val;
  else if (e.target.id === "radius-ry") state.ellipse.ry = val;

  updateCircleLabels();
  updateCanvas();
}

/* ===================== CANVAS UPDATE & RENDER SHAPE ===================== */
function updateCanvas() {
  renderPreviewElement();
  renderTracerOutlines();
  renderHandles();
  updateExporters();
}

function renderPreviewElement() {
  // Apply Background style — sanitize all user-controlled values
  let bgValue = "";
  if (state.fillMode === "solid") {
    const safeColor = sanitizeColorValue(state.solidColor, "#6366f1");
    bgValue = safeColor;
  } else if (state.fillMode === "gradient") {
    const safeColor1 = sanitizeColorValue(state.gradColor1, "#6366f1");
    const safeColor2 = sanitizeColorValue(state.gradColor2, "#a78bfa");
    const safeAngle = Math.min(
      360,
      Math.max(0, parseInt(state.gradAngle) || 0)
    );
    bgValue = `linear-gradient(${safeAngle}deg, ${safeColor1}, ${safeColor2})`;
  } else if (state.fillMode === "image") {
    const safeUrl = sanitizeImageUrlForCss(state.imageUrl);
    if (safeUrl) {
      bgValue = `url("${safeUrl}") center/cover`;
    } else {
      bgValue = "#6366f1";
    }
  }
  // Use sanitizeInlineStyle to ensure background value is safe, or set via property allowlist
  if (CssSanitizer && CssSanitizer.sanitizeCssValue) {
    const safeBg = CssSanitizer.sanitizeCssValue(bgValue, null);
    shapePreview.style.background = safeBg !== null ? safeBg : "#6366f1";
  } else {
    shapePreview.style.background = bgValue;
  }

  // Apply Glow filter shadow — sanitize blur and color
  const safeBlur = Math.min(50, Math.max(0, parseInt(state.shadowBlur) || 0));
  const safeShadowColor = sanitizeColorValue(state.shadowColor, "#6366f1");
  const filterValue = `drop-shadow(0 0 ${safeBlur}px ${safeShadowColor})`;
  if (CssSanitizer && CssSanitizer.sanitizeCssValue) {
    const safeFilter = CssSanitizer.sanitizeCssValue(filterValue, null);
    shapePreview.style.filter = safeFilter !== null ? safeFilter : "none";
  } else {
    shapePreview.style.filter = filterValue;
  }

  // Apply Clip-path or Border-radius shape via ShapeEngine
  const shapeData = {
    vertices: state.polygonVertices,
    blob: state.blob,
    circle: state.circle,
    ellipse: state.ellipse,
  };
  const cssRule = ShapeEngine.generateClipPathCSS(
    state.selectedShape,
    shapeData
  );
  if (cssRule.startsWith("border-radius:")) {
    shapePreview.style.borderRadius = cssRule
      .replace("border-radius: ", "")
      .replace(";", "");
    shapePreview.style.clipPath = "none";
  } else {
    shapePreview.style.clipPath = cssRule
      .replace("clip-path: ", "")
      .replace(";", "");
    shapePreview.style.borderRadius = "0";
  }
}

function renderTracerOutlines() {
  const op = state.selectedShape;
  polyTrace.classList.add("hidden");
  circleTrace.classList.add("hidden");
  ellipseTrace.classList.add("hidden");

  if (op === "polygon") {
    const pointsStr = state.polygonVertices
      .map(v => `${v.x}%,${v.y}%`)
      .join(" ");
    polyTrace.setAttribute("points", pointsStr);
    polyTrace.classList.remove("hidden");
  } else if (op === "circle") {
    const c = state.circle;
    circleTrace.setAttribute("cx", `${c.cx}%`);
    circleTrace.setAttribute("cy", `${c.cy}%`);
    circleTrace.setAttribute("r", `${c.r}%`);
    circleTrace.classList.remove("hidden");
  } else if (op === "ellipse") {
    const el = state.ellipse;
    ellipseTrace.setAttribute("cx", `${el.cx}%`);
    ellipseTrace.setAttribute("cy", `${el.cy}%`);
    ellipseTrace.setAttribute("rx", `${el.rx}%`);
    ellipseTrace.setAttribute("ry", `${el.ry}%`);
    ellipseTrace.classList.remove("hidden");
  }
}

/* ===================== RENDER DRAGGABLE HANDLES ===================== */
function renderHandles() {
  handlesContainer.innerHTML = "";
  const op = state.selectedShape;

  if (op === "polygon") {
    state.polygonVertices.forEach((v, index) => {
      createHandle(v.x, v.y, index);
    });
  } else if (op === "blob") {
    const b = state.blob;
    // 8 edge handles
    createHandle(b.tlh, 0, "tlh", "Horizontal Morph");
    createHandle(100 - b.trh, 0, "trh", "Horizontal Morph");
    createHandle(100 - b.brh, 100, "brh", "Horizontal Morph");
    createHandle(b.blh, 100, "blh", "Horizontal Morph");

    createHandle(0, b.tlv, "tlv", "Vertical Morph");
    createHandle(100, b.trv, "trv", "Vertical Morph");
    createHandle(100, 100 - b.brv, "brv", "Vertical Morph");
    createHandle(0, 100 - b.blv, "blv", "Vertical Morph");
  } else if (op === "circle") {
    const c = state.circle;
    createHandle(c.cx, c.cy, "center", "Center Position");
    createHandle(c.cx + c.r, c.cy, "radius", "Adjust Radius");
  } else if (op === "ellipse") {
    const el = state.ellipse;
    createHandle(el.cx, el.cy, "center", "Center Position");
    createHandle(el.cx + el.rx, el.cy, "radiusX", "Adjust Width Radius");
    createHandle(el.cx, el.cy + el.ry, "radiusY", "Adjust Height Radius");
  }
}

function createHandle(x, y, identifier, tooltip = "Drag to Morph") {
  const handle = document.createElement("div");
  handle.className = "shape-handle";
  handle.style.left = `${x}%`;
  handle.style.top = `${y}%`;
  handle.setAttribute("title", tooltip);
  handle.setAttribute("data-id", identifier);

  if (
    state.selectedShape === "polygon" &&
    identifier === state.selectedVertexIndex
  ) {
    handle.classList.add("active");
  }

  // Double click handle to delete (Polygon only)
  handle.addEventListener("dblclick", e => {
    e.stopPropagation();
    if (state.selectedShape === "polygon") {
      deleteVertex(parseInt(identifier));
    }
  });

  // Start dragging
  const startDrag = e => {
    e.preventDefault();
    state.isDragging = true;

    if (state.selectedShape === "polygon") {
      state.selectedVertexIndex = parseInt(identifier);
      btnDeleteVertex.disabled = false;
      coordEditor.classList.remove("hidden");
      syncVertexCoordinatesDisplay();

      // Re-render handles to show active glow
      renderHandles();
    } else if (
      state.selectedShape === "circle" ||
      state.selectedShape === "ellipse"
    ) {
      state.draggedPart = identifier;
    } else {
      state.draggedIndex = identifier; // String keys for blob
    }
  };

  handle.addEventListener("mousedown", startDrag);
  handle.addEventListener("touchstart", startDrag, { passive: false });

  handlesContainer.appendChild(handle);
}

/* ===================== DRAG AND DROP RUNTIME LOOPS ===================== */
function handleDocumentMouseMove(e) {
  if (!state.isDragging) return;
  e.preventDefault();

  const rect = handlesContainer.getBoundingClientRect();

  // Resolve client cursor position (touch vs mouse)
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  // Convert pixel offsets to percentages bounded inside 0-100
  let px = ((clientX - rect.left) / rect.width) * 100;
  let py = ((clientY - rect.top) / rect.height) * 100;

  px = Math.max(0, Math.min(100, Math.round(px)));
  py = Math.max(0, Math.min(100, Math.round(py)));

  const op = state.selectedShape;

  if (op === "polygon" && state.selectedVertexIndex !== -1) {
    state.polygonVertices[state.selectedVertexIndex].x = px;
    state.polygonVertices[state.selectedVertexIndex].y = py;
    syncVertexCoordinatesDisplay();
  } else if (op === "blob" && state.draggedIndex !== -1) {
    const key = state.draggedIndex;

    // Horizontal edge sliders
    if (key === "tlh") state.blob.tlh = px;
    else if (key === "trh") state.blob.trh = 100 - px;
    else if (key === "brh") state.blob.brh = 100 - px;
    else if (key === "blh") state.blob.blh = px;
    // Vertical edge sliders
    else if (key === "tlv") state.blob.tlv = py;
    else if (key === "trv") state.blob.trv = py;
    else if (key === "brv") state.blob.brv = 100 - py;
    else if (key === "blv") state.blob.blv = 100 - py;

    syncSlidersFromBlobState();
  } else if ((op === "circle" || op === "ellipse") && state.draggedPart) {
    const part = state.draggedPart;
    const target = state[op];

    if (part === "center") {
      target.cx = px;
      target.cy = py;
    } else if (part === "radius") {
      target.r = Math.max(
        5,
        Math.min(50, Math.round(Math.abs(px - target.cx)))
      );
    } else if (part === "radiusX") {
      target.rx = Math.max(
        5,
        Math.min(50, Math.round(Math.abs(px - target.cx)))
      );
    } else if (part === "radiusY") {
      target.ry = Math.max(
        5,
        Math.min(50, Math.round(Math.abs(py - target.cy)))
      );
    }

    syncSlidersFromCircleState();
  }

  updateCanvas();
}

function handleDocumentMouseUp() {
  if (state.isDragging) {
    state.isDragging = false;
    state.draggedIndex = -1;
    state.draggedPart = null;
  }
}

/* ===================== POLYGON HANDLERS ===================== */
function syncVertexCoordinatesDisplay() {
  if (state.selectedVertexIndex !== -1) {
    const v = state.polygonVertices[state.selectedVertexIndex];
    vertexInputX.value = v.x;
    vertexInputY.value = v.y;
  }
}

function handleVertexManualInput() {
  if (state.selectedVertexIndex !== -1) {
    const x = Math.max(0, Math.min(100, parseInt(vertexInputX.value) || 0));
    const y = Math.max(0, Math.min(100, parseInt(vertexInputY.value) || 0));

    state.polygonVertices[state.selectedVertexIndex].x = x;
    state.polygonVertices[state.selectedVertexIndex].y = y;

    updateCanvas();
  }
}

function addVertexAtCenter() {
  const newPt = { x: 50, y: 50 };
  state.polygonVertices.push(newPt);
  state.selectedVertexIndex = state.polygonVertices.length - 1;

  btnDeleteVertex.disabled = false;
  coordEditor.classList.remove("hidden");
  syncVertexCoordinatesDisplay();

  updateCanvas();
}

function deleteSelectedVertex() {
  if (state.selectedVertexIndex !== -1) {
    deleteVertex(state.selectedVertexIndex);
  }
}

function deleteVertex(index) {
  if (state.polygonVertices.length <= 3) {
    showToast("A polygon must have at least 3 vertices!");
    return;
  }

  state.polygonVertices.splice(index, 1);
  state.selectedVertexIndex = -1;
  btnDeleteVertex.disabled = true;
  coordEditor.classList.add("hidden");

  updateCanvas();
}

function handleCanvasDoubleClick(e) {
  if (state.selectedShape !== "polygon") return;
  e.preventDefault();

  const rect = handlesContainer.getBoundingClientRect();
  let px = ((e.clientX - rect.left) / rect.width) * 100;
  let py = ((e.clientY - rect.top) / rect.height) * 100;

  px = Math.max(0, Math.min(100, Math.round(px)));
  py = Math.max(0, Math.min(100, Math.round(py)));

  // Insert vertex at nearest edge segment
  const vertices = state.polygonVertices;
  let nearestSegmentIndex = 0;
  let minDistance = Infinity;

  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];

    const dist = getDistanceToSegment(px, py, p1.x, p1.y, p2.x, p2.y);
    if (dist < minDistance) {
      minDistance = dist;
      nearestSegmentIndex = i;
    }
  }

  // Insert point right after the segment anchor i
  state.polygonVertices.splice(nearestSegmentIndex + 1, 0, { x: px, y: py });
  state.selectedVertexIndex = nearestSegmentIndex + 1;

  btnDeleteVertex.disabled = false;
  coordEditor.classList.remove("hidden");
  syncVertexCoordinatesDisplay();

  updateCanvas();
}

// Math vector helper for finding nearest polygon edge
function getDistanceToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);

  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);

  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

/* ===================== CODE EXPORTERS AND COMPILER ===================== */
function updateExporters() {
  const shape = state.selectedShape;
  let cssValue = "";

  // Format Background styling — sanitize all user-controlled values
  let fillBgCss = "";
  if (state.fillMode === "solid") {
    const safeColor = sanitizeColorValue(state.solidColor, "#6366f1");
    fillBgCss = `background: ${safeColor};`;
  } else if (state.fillMode === "gradient") {
    const safeColor1 = sanitizeColorValue(state.gradColor1, "#6366f1");
    const safeColor2 = sanitizeColorValue(state.gradColor2, "#a78bfa");
    const safeAngle = Math.min(
      360,
      Math.max(0, parseInt(state.gradAngle) || 0)
    );
    fillBgCss = `background: linear-gradient(${safeAngle}deg, ${safeColor1}, ${safeColor2});`;
  } else if (state.fillMode === "image") {
    const safeUrl = sanitizeImageUrlForCss(state.imageUrl);
    if (safeUrl) {
      fillBgCss = `background: url("${safeUrl}") center/cover;`;
    } else {
      fillBgCss = `background: #6366f1;`;
    }
  }

  // Glow drop shadow filter property — sanitize
  const safeBlur = Math.min(50, Math.max(0, parseInt(state.shadowBlur) || 0));
  const safeShadowColor = sanitizeColorValue(state.shadowColor, "#6366f1");
  const glowCss = `filter: drop-shadow(0 0 ${safeBlur}px ${safeShadowColor});`;

  // Shape geometry CSS
  if (shape === "polygon") {
    const pointsStr = state.polygonVertices
      .map(v => `${v.x}% ${v.y}%`)
      .join(", ");
    cssValue = `clip-path: polygon(${pointsStr});\n${fillBgCss}\n${glowCss}`;
  } else if (shape === "blob") {
    const b = state.blob;
    const radiusStr = `${b.tlh}% ${100 - b.trh}% ${100 - b.brh}% ${b.blh}% / ${b.tlv}% ${b.trv}% ${100 - b.brv}% ${100 - b.blv}%`;
    cssValue = `border-radius: ${radiusStr};\n${fillBgCss}\n${glowCss}`;
  } else if (shape === "circle") {
    const c = state.circle;
    cssValue = `clip-path: circle(${c.r}% at ${c.cx}% ${c.cy}%);\n${fillBgCss}\n${glowCss}`;
  } else if (shape === "ellipse") {
    const el = state.ellipse;
    cssValue = `clip-path: ellipse(${el.rx}% ${el.ry}% at ${el.cx}% ${el.cy}%);\n${fillBgCss}\n${glowCss}`;
  }

  codeCss.textContent = cssValue;

  // Format HTML layout code
  codeHtml.textContent = `<div class="custom-shape" style="${cssValue.replace(/\n/g, " ")}"></div>`;
}

function copyToClipboard(text, msg) {
  navigator.clipboard.writeText(text).then(
    () => showToast(msg),
    err => console.error("Clipboard copy failed:", err)
  );
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--theme-accent);"></i> ${message}`;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation =
      "slideToastUp 0.3s cubic-bezier(0.22, 1, 0.36, 1) reverse";
    toast.addEventListener("animationend", () => {
      toast.remove();
    });
  }, 2200);
}

// Start application
document.addEventListener("DOMContentLoaded", init);
