/* ==========================================================================
   Matrix Lab Core Application Controller
   ========================================================================== */

const engine = window.MatrixEngine;
const storage = window.MatrixStorage;

const state = {
  selectedOp: "add",
  rowsA: 3,
  colsA: 3,
  rowsB: 3,
  colsB: 3,
  matrixA: [],
  matrixB: [],
  resultMatrix: [],

  // Stepper timeline
  steps: [],
  currentStep: -1,
  isPlaying: false,
  playTimer: null,
  speed: 1000, // ms per step

  originalA: [],
  originalB: [],
};

// DOM References
const rowsASelect = document.getElementById("rows-a");
const colsASelect = document.getElementById("cols-a");
const rowsBSelect = document.getElementById("rows-b");
const colsBSelect = document.getElementById("cols-b");

const gridA = document.getElementById("grid-a");
const gridB = document.getElementById("grid-b");
const gridResult = document.getElementById("grid-result");

const cardB = document.getElementById("card-matrix-b");
const cardResult = document.getElementById("card-matrix-result");
const mathOperator = document.getElementById("math-operator");
const resultTitle = document.getElementById("result-title");

const explanationText = document.getElementById("explanation-text");
const mathScratchpad = document.getElementById("math-scratchpad");

const btnPrev = document.getElementById("btn-prev");
const btnPlay = document.getElementById("btn-play");
const btnNext = document.getElementById("btn-next");
const btnResetPlay = document.getElementById("btn-reset-play");
const playIcon = document.getElementById("play-icon");
const speedSlider = document.getElementById("speed-slider");
const speedDisplay = document.getElementById("speed-display");
const stepCounter = document.getElementById("step-counter");
const stepProgressFill = document.getElementById("step-progress-fill");

const presetSelect = document.getElementById("preset-select");
const btnRandom = document.getElementById("btn-random");
const btnIdentity = document.getElementById("btn-identity");
const btnClear = document.getElementById("btn-clear");

const btnExportLatex = document.getElementById("btn-export-latex");
const latexModal = document.getElementById("latex-modal");
const latexOutput = document.getElementById("latex-output");
const modalClose = document.getElementById("modal-close");
const btnCopyLatex = document.getElementById("btn-copy-latex");

// Theme Toggle DOM references
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

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

function formatNum(n) {
  if (n === null || n === undefined) return "";
  if (Math.abs(n) < 1e-9) return "0";
  if (Number.isInteger(n)) return n.toString();
  return Number(n.toFixed(2)).toString();
}

function createEmptyMatrix(r, c, val = 0) {
  return Array.from({ length: r }, () => Array(c).fill(val));
}

function init() {
  initTheme();
  setupEventListeners();
  updateOpUI();
  rebuildGrids();
}

function setupEventListeners() {
  document.querySelectorAll(".op-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      const op = e.currentTarget.dataset.op;
      if (op) {
        setOperation(op);
      }
    });
  });

  if (rowsASelect) rowsASelect.addEventListener("change", onDimensionsChange);
  if (colsASelect) colsASelect.addEventListener("change", onDimensionsChange);
  if (rowsBSelect) rowsBSelect.addEventListener("change", onDimensionsChange);
  if (colsBSelect) colsBSelect.addEventListener("change", onDimensionsChange);

  if (presetSelect) {
    presetSelect.addEventListener("change", e => {
      const presetKey = e.target.value;
      if (!presetKey) return;
      const presetMatrix = storage ? storage.getPreset(presetKey) : null;
      if (presetMatrix) {
        loadMatrixAData(presetMatrix);
      }
    });
  }

  if (btnRandom) btnRandom.addEventListener("click", fillRandom);
  if (btnIdentity) btnIdentity.addEventListener("click", fillIdentity);
  if (btnClear) btnClear.addEventListener("click", clearAll);

  if (btnPrev) btnPrev.addEventListener("click", prevStep);
  if (btnNext) btnNext.addEventListener("click", nextStep);
  if (btnPlay) btnPlay.addEventListener("click", togglePlay);
  if (btnResetPlay) btnResetPlay.addEventListener("click", resetStepper);

  if (speedSlider) {
    speedSlider.addEventListener("input", e => {
      state.speed = parseInt(e.target.value, 10);
      if (speedDisplay) {
        speedDisplay.textContent = `${(state.speed / 1000).toFixed(1)}s / step`;
      }
      if (state.isPlaying) {
        pauseAnimation();
        startAnimation();
      }
    });
  }

  if (btnExportLatex) {
    btnExportLatex.addEventListener("click", openLatexModal);
  }
  if (modalClose) {
    modalClose.addEventListener("click", closeLatexModal);
  }
  if (btnCopyLatex) {
    btnCopyLatex.addEventListener("click", copyLatexToClipboard);
  }
}

function setOperation(op) {
  state.selectedOp = op;
  document.querySelectorAll(".op-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.op === op);
  });

  if (op === "add") {
    state.rowsB = state.rowsA;
    state.colsB = state.colsA;
  } else if (op === "multiply") {
    state.rowsB = state.colsA;
  } else if (["determinant", "inverse", "lu", "qr", "eigen"].includes(op)) {
    state.colsA = state.rowsA;
    if (colsASelect) colsASelect.value = state.rowsA;
  }

  updateOpUI();
  rebuildGrids();
}

function updateOpUI() {
  const op = state.selectedOp;
  const isUnary = ["determinant", "inverse", "transpose", "lu", "qr", "eigen"].includes(op);

  if (cardB) cardB.style.display = isUnary ? "none" : "block";

  if (mathOperator) {
    const iconMap = {
      add: '<i class="fa-solid fa-plus"></i>',
      multiply: '<i class="fa-solid fa-times"></i>',
      determinant: '<strong>det(A)</strong>',
      inverse: '<strong>A<sup>-1</sup></strong>',
      transpose: '<strong>A<sup>T</sup></strong>',
      lu: '<strong>A = L·U</strong>',
      qr: '<strong>A = Q·R</strong>',
      eigen: '<strong>λ I</strong>'
    };
    mathOperator.innerHTML = iconMap[op] || '=';
  }

  if (resultTitle) {
    const titleMap = {
      lu: "Decomposed Result L & U",
      qr: "Decomposed Result Q & R",
      eigen: "Eigenvalues Spectrum λ",
      determinant: "Determinant Scalar",
      inverse: "Inverse Matrix A⁻¹",
      transpose: "Transposed Matrix Aᵀ"
    };
    resultTitle.textContent = titleMap[op] || "Result Matrix C";
  }

  if (rowsBSelect) {
    if (op === "add") {
      rowsBSelect.value = state.rowsA;
      rowsBSelect.disabled = true;
    } else if (op === "multiply") {
      rowsBSelect.value = state.colsA;
      rowsBSelect.disabled = true;
    } else {
      rowsBSelect.disabled = false;
    }
  }
}

function onDimensionsChange() {
  state.rowsA = parseInt(rowsASelect.value, 10);
  state.colsA = parseInt(colsASelect.value, 10);

  if (state.selectedOp === "add") {
    state.rowsB = state.rowsA;
    state.colsB = state.colsA;
    if (rowsBSelect) rowsBSelect.value = state.rowsB;
    if (colsBSelect) colsBSelect.value = state.colsB;
  } else if (state.selectedOp === "multiply") {
    state.rowsB = state.colsA;
    state.colsB = parseInt(colsBSelect.value, 10);
    if (rowsBSelect) rowsBSelect.value = state.rowsB;
  } else if (["determinant", "inverse", "lu", "qr", "eigen"].includes(state.selectedOp)) {
    state.colsA = state.rowsA;
    if (colsASelect) colsASelect.value = state.rowsA;
  } else {
    state.rowsB = parseInt(rowsBSelect.value, 10);
    state.colsB = parseInt(colsBSelect.value, 10);
  }

  updateOpUI();
  rebuildGrids();
}

function rebuildGrids() {
  state.matrixA = createEmptyMatrix(state.rowsA, state.colsA, 1);
  state.matrixB = createEmptyMatrix(state.rowsB, state.colsB, 1);

  renderMatrixGrid(gridA, state.rowsA, state.colsA, "a", state.matrixA);
  const isUnary = ["determinant", "inverse", "transpose", "lu", "qr", "eigen"].includes(state.selectedOp);
  if (!isUnary) {
    renderMatrixGrid(gridB, state.rowsB, state.colsB, "b", state.matrixB);
  }

  computeAndBuildTimeline();
}

function loadMatrixAData(data) {
  state.rowsA = data.length;
  state.colsA = data[0].length;
  if (rowsASelect) rowsASelect.value = state.rowsA;
  if (colsASelect) colsASelect.value = state.colsA;
  state.matrixA = data.map(r => r.slice());

  if (["determinant", "inverse", "lu", "qr", "eigen"].includes(state.selectedOp)) {
    state.colsA = state.rowsA;
    if (colsASelect) colsASelect.value = state.rowsA;
  }

  updateOpUI();
  renderMatrixGrid(gridA, state.rowsA, state.colsA, "a", state.matrixA);
  computeAndBuildTimeline();
}

function renderMatrixGrid(container, rows, cols, prefix, matrix) {
  if (!container) return;
  container.innerHTML = "";
  container.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      input.className = "matrix-cell-input";
      input.value = matrix[r][c];
      input.dataset.row = r;
      input.dataset.col = c;
      input.dataset.matrix = prefix;

      input.addEventListener("input", e => {
        const val = parseFloat(e.target.value) || 0;
        if (prefix === "a") state.matrixA[r][c] = val;
        else if (prefix === "b") state.matrixB[r][c] = val;
        computeAndBuildTimeline();
      });

      container.appendChild(input);
    }
  }
}

function computeAndBuildTimeline() {
  pauseAnimation();
  state.steps = [];
  state.currentStep = -1;

  try {
    if (state.selectedOp === "add") {
      buildAddTimeline();
    } else if (state.selectedOp === "multiply") {
      buildMultiplyTimeline();
    } else if (state.selectedOp === "determinant") {
      buildDeterminantTimeline();
    } else if (state.selectedOp === "inverse") {
      buildInverseTimeline();
    } else if (state.selectedOp === "transpose") {
      buildTransposeTimeline();
    } else if (state.selectedOp === "lu") {
      buildLUTimeline();
    } else if (state.selectedOp === "qr") {
      buildQRTimeline();
    } else if (state.selectedOp === "eigen") {
      buildEigenTimeline();
    }
  } catch (err) {
    state.steps = [{
      text: `Error: ${err.message}`,
      scratchpad: "Execution failed for selected operation.",
      result: [["N/A"]]
    }];
  }

  updateStepUI();
}

function buildAddTimeline() {
  const r = state.rowsA;
  const c = state.colsA;
  const result = createEmptyMatrix(r, c, 0);

  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const valA = state.matrixA[i][j];
      const valB = state.matrixB[i][j];
      const sum = valA + valB;
      result[i][j] = sum;

      state.steps.push({
        text: `Add position [${i+1}, ${j+1}]: ${valA} + ${valB} = ${sum}`,
        scratchpad: `C[${i+1}][${j+1}] = A[${i+1}][${j+1}] + B[${i+1}][${j+1}] = ${valA} + ${valB} = ${sum}`,
        result: JSON.parse(JSON.stringify(result)),
        activeA: [[i, j]],
        activeB: [[i, j]],
        activeC: [[i, j]]
      });
    }
  }
}

function buildMultiplyTimeline() {
  const rA = state.rowsA;
  const cA = state.colsA;
  const cB = state.colsB;
  const result = createEmptyMatrix(rA, cB, 0);

  for (let i = 0; i < rA; i++) {
    for (let j = 0; j < cB; j++) {
      let sum = 0;
      let exprTerms = [];
      let activeA = [];
      let activeB = [];

      for (let k = 0; k < cA; k++) {
        const valA = state.matrixA[i][k];
        const valB = state.matrixB[k][j];
        sum += valA * valB;
        exprTerms.push(`(${valA} × ${valB})`);
        activeA.push([i, k]);
        activeB.push([k, j]);
      }

      result[i][j] = Math.abs(sum) < 1e-12 ? 0 : sum;

      state.steps.push({
        text: `Dot product for C[${i+1}, ${j+1}]: Row ${i+1} of A · Column ${j+1} of B = ${result[i][j]}`,
        scratchpad: `C[${i+1}][${j+1}] = ${exprTerms.join(" + ")} = ${result[i][j]}`,
        result: JSON.parse(JSON.stringify(result)),
        activeA,
        activeB,
        activeC: [[i, j]]
      });
    }
  }
}

function buildDeterminantTimeline() {
  const det = engine.determinant(state.matrixA);
  state.steps.push({
    text: `Determinant of Matrix A computed via Gaussian LU expansion.`,
    scratchpad: `det(A) = ${det}`,
    result: [[det]]
  });
}

function buildInverseTimeline() {
  const inv = engine.inverse(state.matrixA);
  state.steps.push({
    text: `Inverse of Matrix A calculated via Gauss-Jordan elimination.`,
    scratchpad: `A⁻¹ · A = I`,
    result: inv
  });
}

function buildTransposeTimeline() {
  const transp = engine.transpose(state.matrixA);
  state.steps.push({
    text: `Transposed matrix by swapping rows and columns.`,
    scratchpad: `Aᵀ[i][j] = A[j][i]`,
    result: transp
  });
}

function buildLUTimeline() {
  const decomp = engine.luDecomposition(state.matrixA);
  state.steps.push({
    text: `LU Decomposition complete: A = L · U`,
    scratchpad: `L = Lower Triangular, U = Upper Triangular`,
    result: decomp.U
  });
}

function buildQRTimeline() {
  const decomp = engine.qrDecomposition(state.matrixA);
  state.steps.push({
    text: `QR Decomposition complete via Gram-Schmidt Orthogonalization.`,
    scratchpad: `Q = Orthogonal Matrix, R = Upper Triangular Matrix`,
    result: decomp.R
  });
}

function buildEigenTimeline() {
  const evs = engine.eigenvalues(state.matrixA);
  const formatted = evs.map((ev, idx) => [
    `λ${idx + 1}`,
    ev.imag !== 0 ? `${ev.real} ± ${Math.abs(ev.imag)}i` : `${ev.real}`
  ]);
  state.steps.push({
    text: `Calculated Characteristic Polynomial Eigenvalues for Matrix A.`,
    scratchpad: `det(A - λI) = 0`,
    result: formatted
  });
}

function updateStepUI() {
  if (!state.steps.length) {
    if (explanationText) explanationText.textContent = "No calculation steps available.";
    if (mathScratchpad) mathScratchpad.textContent = "";
    if (gridResult) gridResult.innerHTML = "";
    return;
  }

  const step = state.currentStep >= 0 ? state.steps[state.currentStep] : state.steps[state.steps.length - 1];

  if (explanationText) explanationText.textContent = step.text;
  if (mathScratchpad) mathScratchpad.textContent = step.scratchpad;

  renderResultGrid(step.result);

  if (stepCounter) {
    const displayIndex = state.currentStep >= 0 ? state.currentStep + 1 : state.steps.length;
    stepCounter.textContent = `Step ${displayIndex} / ${state.steps.length}`;
  }

  if (stepProgressFill) {
    const percent = state.steps.length > 0
      ? ((state.currentStep >= 0 ? state.currentStep + 1 : state.steps.length) / state.steps.length) * 100
      : 0;
    stepProgressFill.style.width = `${percent}%`;
  }

  if (btnPrev) btnPrev.disabled = state.currentStep <= 0;
  if (btnNext) btnNext.disabled = state.currentStep >= state.steps.length - 1;
}

function renderResultGrid(resultMatrix) {
  if (!gridResult || !resultMatrix) return;
  gridResult.innerHTML = "";

  const rows = resultMatrix.length;
  const cols = resultMatrix[0].length;
  gridResult.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.className = "matrix-cell-result";
      cell.textContent = formatNum(resultMatrix[r][c]);
      gridResult.appendChild(cell);
    }
  }
}

function prevStep() {
  if (state.currentStep > 0) {
    state.currentStep--;
    updateStepUI();
  }
}

function nextStep() {
  if (state.currentStep < state.steps.length - 1) {
    state.currentStep++;
    updateStepUI();
  } else {
    pauseAnimation();
  }
}

function togglePlay() {
  if (state.isPlaying) {
    pauseAnimation();
  } else {
    if (state.currentStep >= state.steps.length - 1) {
      state.currentStep = 0;
    }
    startAnimation();
  }
}

function startAnimation() {
  state.isPlaying = true;
  if (playIcon) playIcon.className = "fa-solid fa-pause";
  state.playTimer = setInterval(() => {
    nextStep();
  }, state.speed);
}

function pauseAnimation() {
  state.isPlaying = false;
  if (playIcon) playIcon.className = "fa-solid fa-play";
  if (state.playTimer) {
    clearInterval(state.playTimer);
    state.playTimer = null;
  }
}

function resetStepper() {
  pauseAnimation();
  state.currentStep = 0;
  updateStepUI();
}

function fillRandom() {
  for (let r = 0; r < state.rowsA; r++) {
    for (let c = 0; c < state.colsA; c++) {
      state.matrixA[r][c] = Math.floor(Math.random() * 19) - 9;
    }
  }
  for (let r = 0; r < state.rowsB; r++) {
    for (let c = 0; c < state.colsB; c++) {
      state.matrixB[r][c] = Math.floor(Math.random() * 19) - 9;
    }
  }
  renderMatrixGrid(gridA, state.rowsA, state.colsA, "a", state.matrixA);
  const isUnary = ["determinant", "inverse", "transpose", "lu", "qr", "eigen"].includes(state.selectedOp);
  if (!isUnary) {
    renderMatrixGrid(gridB, state.rowsB, state.colsB, "b", state.matrixB);
  }
  computeAndBuildTimeline();
}

function fillIdentity() {
  state.matrixA = engine ? engine.createIdentity(state.rowsA) : createEmptyMatrix(state.rowsA, state.colsA, 0);
  state.matrixB = engine ? engine.createIdentity(state.rowsB) : createEmptyMatrix(state.rowsB, state.colsB, 0);
  renderMatrixGrid(gridA, state.rowsA, state.colsA, "a", state.matrixA);
  const isUnary = ["determinant", "inverse", "transpose", "lu", "qr", "eigen"].includes(state.selectedOp);
  if (!isUnary) {
    renderMatrixGrid(gridB, state.rowsB, state.colsB, "b", state.matrixB);
  }
  computeAndBuildTimeline();
}

function clearAll() {
  state.matrixA = createEmptyMatrix(state.rowsA, state.colsA, 0);
  state.matrixB = createEmptyMatrix(state.rowsB, state.colsB, 0);
  renderMatrixGrid(gridA, state.rowsA, state.colsA, "a", state.matrixA);
  const isUnary = ["determinant", "inverse", "transpose", "lu", "qr", "eigen"].includes(state.selectedOp);
  if (!isUnary) {
    renderMatrixGrid(gridB, state.rowsB, state.colsB, "b", state.matrixB);
  }
  computeAndBuildTimeline();
}

function openLatexModal() {
  if (!latexModal || !latexOutput) return;
  const tex = storage ? storage.toLaTeX(state.matrixA) : "";
  latexOutput.value = tex;
  latexModal.classList.remove("hidden");
  latexModal.setAttribute("aria-hidden", "false");
}

function closeLatexModal() {
  if (!latexModal) return;
  latexModal.classList.add("hidden");
  latexModal.setAttribute("aria-hidden", "true");
}

function copyLatexToClipboard() {
  if (!latexOutput) return;
  latexOutput.select();
  navigator.clipboard.writeText(latexOutput.value).then(() => {
    if (btnCopyLatex) {
      btnCopyLatex.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
      setTimeout(() => {
        btnCopyLatex.innerHTML = '<i class="fa-solid fa-copy"></i> Copy to Clipboard';
      }, 2000);
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
