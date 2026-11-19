/* ============================================================
   NEURAL NETWORK PLAYGROUND — UI & CANVAS CONTROLLER
   Integrates with nnEngine.js for matrix calculations
   ============================================================ */

// ── APP STATE ────────────────────────────────────────────────
const state = {
  dataset: "circle",
  noise: 15,
  numPoints: 200,
  hiddenLayers: [6, 4],
  learningRate: 0.01,
  activationName: "relu",
  batchSize: 16,
  regularization: 0,
  speed: 50,
  training: false,
  epoch: 0,
  lossHistory: [],
  accHistory: [],
  layerGradients: [],
  data: [],
  customData: [],
  net: null,
  worker: null,
  animId: null,
  showData: true,
  showWeights: true,
  showContour: true,
  backpropPulse: 0,
};

// ── ARCHITECTURE PRESETS ─────────────────────────────────────
const ARCHITECTURE_PRESETS = {
  default: [6, 4],
  shallow: [2],
  deep: [4, 4, 4, 4],
  pyramid: [10, 6, 3],
  wide: [12, 8],
};

// ── DOM REFS ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const boundaryCanvas = $("boundaryCanvas");
const networkCanvas = $("networkCanvas");
const lossCanvas = $("lossCanvas");
const bCtx = boundaryCanvas ? boundaryCanvas.getContext("2d") : null;
const nCtx = networkCanvas ? networkCanvas.getContext("2d") : null;
const lCtx = lossCanvas ? lossCanvas.getContext("2d") : null;

// ── INITIALIZATION ───────────────────────────────────────────
function initNetwork() {
  const layers = [2, ...state.hiddenLayers, 1];
  state.net = new NeuralNetwork(
    layers,
    state.activationName,
    state.learningRate,
    state.regularization
  );

  if (state.worker) {
    state.worker.postMessage({
      type: "INIT_NETWORK",
      payload: {
        layers,
        activationName: state.activationName,
        lr: state.learningRate,
        regularization: state.regularization,
        weights: state.net.weights,
        biases: state.net.biases,
      },
    });
  }

  state.epoch = 0;
  state.lossHistory = [];
  state.accHistory = [];
  state.layerGradients = new Array(layers.length - 1).fill(0);
  updateStats(0, "—", "—");
  updateArchitectureSummary();
}

function initData() {
  if (state.dataset === "custom") {
    state.data = state.customData.map(p => [...p]);
  } else {
    state.data = generateDataset(state.dataset, state.numPoints, state.noise);
  }

  if (state.worker) {
    state.worker.postMessage({
      type: "INIT_DATA",
      payload: {
        datasetType: state.dataset,
        numPoints: state.numPoints,
        noise: state.noise,
        customData: state.customData,
        points: state.data,
      },
    });
  }
}

function updateStats(epoch, loss, acc) {
  const epochEl = $("epochCount");
  const lossEl = $("lossValue");
  const accEl = $("accuracyValue");
  const chartLossEl = $("chartLossVal");
  const chartAccEl = $("chartAccVal");
  const gradientEl = $("gradientValue");

  if (epochEl) epochEl.textContent = epoch;
  if (lossEl) {
    lossEl.textContent = typeof loss === "number" ? loss.toFixed(4) : loss;
  }
  if (accEl) {
    accEl.textContent =
      typeof acc === "number" ? (acc * 100).toFixed(1) + "%" : acc;
  }
  if (chartLossEl) {
    chartLossEl.textContent =
      typeof loss === "number" ? loss.toFixed(4) : loss;
  }
  if (chartAccEl) {
    chartAccEl.textContent =
      typeof acc === "number" ? (acc * 100).toFixed(1) + "%" : acc;
  }

  // Vanishing Gradient Diagnostics
  if (gradientEl) {
    if (state.layerGradients && state.layerGradients.length > 0) {
      const g0 = state.layerGradients[0];
      if (g0 < 1e-4 && state.hiddenLayers.length >= 3) {
        gradientEl.textContent = "Vanishing (Weak)";
        gradientEl.style.color = "var(--danger)";
        const diagGrad = $("diagGradientVal");
        if (diagGrad) {
          diagGrad.textContent =
            "⚠️ Vanishing Gradients: Early layer gradients near zero! Try ReLU/LeakyReLU.";
          diagGrad.style.color = "var(--danger)";
        }
      } else if (g0 > 5) {
        gradientEl.textContent = "Exploding";
        gradientEl.style.color = "var(--danger)";
      } else {
        gradientEl.textContent = "Optimal";
        gradientEl.style.color = "var(--success)";
        const diagGrad = $("diagGradientVal");
        if (diagGrad) {
          diagGrad.textContent = "Flow: Normal (Healthy backpropagation)";
          diagGrad.style.color = "var(--accent-primary)";
        }
      }
    } else {
      gradientEl.textContent = "Optimal";
      gradientEl.style.color = "var(--success)";
    }
  }

  // Model Capacity & Overfitting/Underfitting Dynamics
  const diagCap = $("diagCapacityVal");
  if (diagCap) {
    const totalParams = computeTotalParameters([
      2,
      ...state.hiddenLayers,
      1,
    ]);
    if (
      typeof acc === "number" &&
      acc > 0.98 &&
      state.noise >= 15 &&
      totalParams > 50
    ) {
      diagCap.textContent =
        "Overfitting Dynamics: Network boundary fitting noise points";
      diagCap.style.color = "var(--warning)";
    } else if (
      epoch > 80 &&
      typeof acc === "number" &&
      acc < 0.7 &&
      (state.dataset === "spiral" || state.dataset === "xor") &&
      totalParams < 20
    ) {
      diagCap.textContent =
        "Underfitting Dynamics: Linear boundary cannot separate non-linear pattern";
      diagCap.style.color = "var(--warning)";
    } else {
      diagCap.textContent =
        totalParams > 50
          ? "High Capacity (Expressive)"
          : totalParams < 20
            ? "Low Capacity (Shallow)"
            : "Balanced Capacity";
      diagCap.style.color = "var(--accent-primary)";
    }
  }

  // Activation & Non-Linearity Description
  const diagAct = $("diagActivationVal");
  if (diagAct) {
    const nameMap = {
      relu: "ReLU (Piecewise-linear, robust gradients)",
      sigmoid: "Sigmoid (Smooth, vulnerable to vanishing gradients)",
      tanh: "Tanh (Zero-centered, smooth S-curve)",
      leaky_relu: "Leaky ReLU (No dead neurons for negative inputs)",
    };
    diagAct.textContent = nameMap[state.activationName] || state.activationName;
  }
}

function updateArchitectureSummary() {
  const summaryEl = $("architectureSummary");
  const badgeEl = $("paramCountBadge");
  const layers = [2, ...state.hiddenLayers, 1];
  const totalParams = computeTotalParameters(layers);

  if (summaryEl) {
    summaryEl.textContent = `Topology: ${layers.join(" → ")}`;
  }
  if (badgeEl) {
    badgeEl.textContent = `${totalParams} params`;
  }
}

// ── EXPORT STATUS HELPERS ────────────────────────────────────
function showExportError(message) {
  const statusEl = $("exportStatus");
  const msgEl = $("exportStatusMessage");
  if (msgEl) msgEl.textContent = message;
  if (statusEl) statusEl.style.display = "flex";
}

function hideExportError() {
  const statusEl = $("exportStatus");
  if (statusEl) statusEl.style.display = "none";
}

// ── RENDERING: 2D DECISION BOUNDARY CONTOUR HEATMAP ───────────
function drawBoundary() {
  const c = boundaryCanvas;
  const ctx = bCtx;
  if (!c || !ctx) return;
  const w = c.width;
  const h = c.height;
  const res = 3;
  const imgData = ctx.createImageData(w, h);

  if (state.net) {
    for (let py = 0; py < h; py += res) {
      for (let px = 0; px < w; px += res) {
        const x = (px / w) * 2 - 1;
        const y = (py / h) * 2 - 1;
        const pred = state.net.predict([x, y]);

        let r, g, b, a;
        const diff = pred - 0.5;
        const absDiff = Math.abs(diff);

        // Highlight Decision Boundary Isoline (|pred - 0.5| < 0.035)
        if (state.showContour && absDiff < 0.035) {
          r = 255;
          g = 255;
          b = 255;
          a = 255;
        } else if (diff < 0) {
          // Class 0: Cool Cyan/Deep Navy
          const intensity = Math.min(1, absDiff * 2);
          r = Math.floor(15 + (1 - intensity) * 35);
          g = Math.floor(60 + intensity * 125);
          b = Math.floor(110 + intensity * 145);
          a = 230;
        } else {
          // Class 1: Warm Crimson/Rose
          const intensity = Math.min(1, diff * 2);
          r = Math.floor(110 + intensity * 135);
          g = Math.floor(40 + (1 - intensity) * 30);
          b = Math.floor(45 + (1 - intensity) * 30);
          a = 230;
        }

        for (let dy = 0; dy < res && py + dy < h; dy++) {
          for (let dx = 0; dx < res && px + dx < w; dx++) {
            const idx = ((py + dy) * w + (px + dx)) * 4;
            imgData.data[idx] = r;
            imgData.data[idx + 1] = g;
            imgData.data[idx + 2] = b;
            imgData.data[idx + 3] = a;
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // Draw Data Points with Classification Accents
  if (state.showData && state.data && state.data.length) {
    state.data.forEach(([x, y, label]) => {
      const px = ((x + 1) / 2) * w;
      const py = ((y + 1) / 2) * h;

      let isMisclassified = false;
      if (state.net) {
        const pred = state.net.predict([x, y]);
        const predictedClass = pred >= 0.5 ? 1 : 0;
        isMisclassified = predictedClass !== label;
      }

      // Misclassified point warning halo
      if (isMisclassified) {
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 183, 77, 0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(px, py, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = label === 1 ? "#ef5350" : "#4fc3f7";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }
}

// ── RENDERING: NETWORK GRAPH & BACKPROP PULSE ─────────────────
function drawNetwork() {
  const c = networkCanvas;
  const ctx = nCtx;
  if (!c || !ctx) return;
  const w = c.width;
  const h = c.height;
  ctx.clearRect(0, 0, w, h);

  if (!state.net) return;
  const layers = state.net.layers;
  const numLayers = layers.length;
  const padX = 60;
  const padY = 32;
  const layerSpacing = (w - padX * 2) / (numLayers - 1);

  const positions = [];
  for (let l = 0; l < numLayers; l++) {
    const n = layers[l];
    const x = padX + l * layerSpacing;
    const neuronSpacing = Math.min(36, (h - padY * 2) / (n + 1));
    const startY = h / 2 - ((n - 1) * neuronSpacing) / 2;
    const layerPos = [];
    for (let i = 0; i < n; i++) {
      layerPos.push({ x, y: startY + i * neuronSpacing });
    }
    positions.push(layerPos);
  }

  // Draw Synaptic Connections with Weight Magnitude & Backprop Glow
  if (state.showWeights) {
    for (let l = 0; l < state.net.weights.length; l++) {
      const wt = state.net.weights[l];
      const gradMag =
        state.layerGradients && state.layerGradients[l]
          ? Math.min(1, state.layerGradients[l] * 2)
          : 0;

      for (let j = 0; j < wt.length; j++) {
        for (let k = 0; k < wt[j].length; k++) {
          const v = wt[j][k];
          const absV = Math.min(Math.abs(v), 3) / 3;
          const from = positions[l][k];
          const to = positions[l + 1][j];

          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);

          if (state.training && gradMag > 0.1) {
            // Backprop pulse effect along connections
            const pulse =
              (Math.sin(state.backpropPulse + l * 0.8) + 1) * 0.5;
            ctx.strokeStyle =
              v > 0
                ? `rgba(79, 195, 247, ${0.15 + absV * 0.6 + pulse * 0.25})`
                : `rgba(239, 83, 80, ${0.15 + absV * 0.6 + pulse * 0.25})`;
            ctx.lineWidth = 0.5 + absV * 2.5 + pulse * 1.2;
          } else {
            ctx.strokeStyle =
              v > 0
                ? `rgba(79, 195, 247, ${0.12 + absV * 0.7})`
                : `rgba(239, 83, 80, ${0.12 + absV * 0.7})`;
            ctx.lineWidth = 0.5 + absV * 2.5;
          }

          ctx.stroke();
        }
      }
    }
  }

  // Layer Labels & Neuron Nodes
  const labels = [
    `Input (${layers[0]})`,
    ...state.hiddenLayers.map((n, i) => `H${i + 1} (${n})`),
    `Output (${layers[numLayers - 1]})`,
  ];

  for (let l = 0; l < numLayers; l++) {
    ctx.fillStyle = "rgba(139, 157, 195, 0.85)";
    ctx.font = "600 10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(labels[l], positions[l][0].x, padY - 12);

    for (let i = 0; i < layers[l]; i++) {
      const { x, y } = positions[l][i];
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 16);
      grad.addColorStop(0, "rgba(79, 195, 247, 0.18)");
      grad.addColorStop(1, "rgba(79, 195, 247, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - 16, y - 16, 32, 32);

      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle =
        l === 0 ? "#1a3a5c" : l === numLayers - 1 ? "#3a1a2c" : "#1a2a3c";
      ctx.fill();
      ctx.strokeStyle =
        l === 0 ? "#4fc3f7" : l === numLayers - 1 ? "#ef5350" : "#7c4dff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  if (state.training) {
    state.backpropPulse = (state.backpropPulse + 0.15) % (Math.PI * 2);
  }
}

// ── RENDERING: REAL-TIME DUAL LOSS & ACCURACY CURVES ──────────
function drawLossChart() {
  const c = lossCanvas;
  const ctx = lCtx;
  if (!c || !ctx) return;
  const w = c.width;
  const h = c.height;
  ctx.clearRect(0, 0, w, h);

  const hist = state.lossHistory;
  const accHist = state.accHistory;

  if (hist.length < 2) {
    ctx.fillStyle = "rgba(139, 157, 195, 0.4)";
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Training loss and accuracy curves will appear here...",
      w / 2,
      h / 2
    );
    return;
  }

  const pad = { top: 20, right: 55, bottom: 25, left: 55 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const maxLoss = Math.max(...hist, 0.01);
  const minLoss = 0;

  // Gridlines and Left Axis (Loss) Ticks
  ctx.strokeStyle = "rgba(42, 53, 80, 0.5)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();

    // Left Y-axis (Loss)
    ctx.fillStyle = "#f59e0b";
    ctx.font = "10px JetBrains Mono, monospace";
    ctx.textAlign = "right";
    const lossTick = (maxLoss - (maxLoss / 4) * i).toFixed(3);
    ctx.fillText(lossTick, pad.left - 6, y + 3);

    // Right Y-axis (Accuracy %)
    ctx.fillStyle = "#10b981";
    ctx.textAlign = "left";
    const accTick = `${Math.round(100 - i * 25)}%`;
    ctx.fillText(accTick, w - pad.right + 6, y + 3);
  }

  // 1. Plot Loss Curve (Amber)
  const lossGradient = ctx.createLinearGradient(
    pad.left,
    pad.top,
    pad.left,
    pad.top + plotH
  );
  lossGradient.addColorStop(0, "rgba(245, 158, 11, 0.22)");
  lossGradient.addColorStop(1, "rgba(245, 158, 11, 0)");

  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + plotH);
  for (let i = 0; i < hist.length; i++) {
    const x = pad.left + (i / (hist.length - 1)) * plotW;
    const y =
      pad.top + (1 - (hist[i] - minLoss) / (maxLoss - minLoss)) * plotH;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(pad.left + plotW, pad.top + plotH);
  ctx.closePath();
  ctx.fillStyle = lossGradient;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < hist.length; i++) {
    const x = pad.left + (i / (hist.length - 1)) * plotW;
    const y =
      pad.top + (1 - (hist[i] - minLoss) / (maxLoss - minLoss)) * plotH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // 2. Plot Accuracy Curve (Emerald)
  if (accHist.length >= 2) {
    const accGradient = ctx.createLinearGradient(
      pad.left,
      pad.top,
      pad.left,
      pad.top + plotH
    );
    accGradient.addColorStop(0, "rgba(16, 185, 129, 0.18)");
    accGradient.addColorStop(1, "rgba(16, 185, 129, 0)");

    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + plotH);
    for (let i = 0; i < accHist.length; i++) {
      const x = pad.left + (i / (accHist.length - 1)) * plotW;
      const y = pad.top + (1 - accHist[i]) * plotH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(pad.left + plotW, pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = accGradient;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < accHist.length; i++) {
      const x = pad.left + (i / (accHist.length - 1)) * plotW;
      const y = pad.top + (1 - accHist[i]) * plotH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  // Bottom Center Label: Epochs
  ctx.fillStyle = "rgba(139, 157, 195, 0.6)";
  ctx.font = "10px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Epochs", w / 2, h - 4);
}

function renderAll() {
  drawBoundary();
  drawNetwork();
  drawLossChart();
}

// ── ARIA LIVE REGION HELPER ──────────────────────────────────
function announceTrainingStatus(message) {
  const el = document.getElementById("training-status");
  if (!el) return;
  el.textContent = "";
  if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
    window.setTimeout(() => {
      el.textContent = message;
    }, 50);
  } else {
    el.textContent = message;
  }
}

function trainStep() {
  if (!state.training) return;

  if (!state.worker) {
    trainStepOnMainThread();
    return;
  }

  state.worker.postMessage({
    type: "TRAIN_STEP",
    payload: {
      speed: state.speed,
      batchSize: state.batchSize,
    },
  });
}

function trainStepOnMainThread() {
  if (!state.net || state.data.length === 0) {
    pauseTraining();
    announceTrainingStatus(
      "Training stopped because the network or dataset is not ready."
    );
    return;
  }

  const inputs = state.data.map(point => [point[0], point[1]]);
  const targets = state.data.map(point => point[2]);
  const steps = Math.min(Math.max(state.speed, 1), 5);
  let lastLoss = 0;
  let lastAccuracy = 0;

  for (let step = 0; step < steps; step++) {
    const result = state.net.train(inputs, targets, state.batchSize);
    lastLoss = result.loss;
    lastAccuracy = result.accuracy;
    state.layerGradients = result.layerGradients || [];
    state.epoch += 1;
  }

  if (
    state.lossHistory.length === 0 ||
    state.epoch % Math.max(1, Math.floor(state.speed / 5)) === 0
  ) {
    state.lossHistory.push(lastLoss);
    state.accHistory.push(lastAccuracy);
    if (state.lossHistory.length > 500) {
      state.lossHistory.shift();
      state.accHistory.shift();
    }
  }

  updateStats(state.epoch, lastLoss, lastAccuracy);
  renderAll();

  if (state.training) {
    state.animId = requestAnimationFrame(trainStep);
  }
}

function startTraining() {
  if (state.training) return;
  if (!state.net) initNetwork();
  if (state.data.length === 0) initData();
  state.training = true;
  $("btnTrain").disabled = true;
  $("btnPause").disabled = false;
  if (document.body && document.body.classList) {
    document.body.classList.add("training-active");
  }
  hideExportError();

  announceTrainingStatus(
    state.worker
      ? "Training started."
      : "Training started in compatibility mode. Web Workers are unavailable."
  );
  trainStep();
}

function pauseTraining() {
  state.training = false;
  if (state.animId) cancelAnimationFrame(state.animId);
  $("btnTrain").disabled = false;
  $("btnPause").disabled = true;
  $("btnTrain").innerHTML = '<i class="fas fa-play"></i> Resume';
  if (document.body && document.body.classList) {
    document.body.classList.remove("training-active");
  }
  announceTrainingStatus(`Training paused at epoch ${state.epoch}.`);
}

function resetAll() {
  pauseTraining();
  $("btnTrain").innerHTML = '<i class="fas fa-play"></i> Train';
  initNetwork();
  renderAll();
  hideExportError();

  announceTrainingStatus("Training reset.");
}

// ── DYNAMIC LAYER UI & PRESETS ────────────────────────────────
function renderLayerUI() {
  const container = $("layerNeurons");
  const countNumEl = $("layerCountNum");
  if (!container) return;

  container.innerHTML = "";
  if (countNumEl) countNumEl.textContent = state.hiddenLayers.length;

  state.hiddenLayers.forEach((n, i) => {
    const row = document.createElement("div");
    row.className = "layer-row";
    row.innerHTML = `
      <span class="layer-label">Hidden ${i + 1}</span>
      <button type="button" class="btn-layer-step btn-step-down" title="Decrease neurons" aria-label="Decrease neurons in hidden layer ${i + 1}">-</button>
      <input type="range" min="1" max="16" value="${n}" data-layer="${i}" aria-label="Neurons count for hidden layer ${i + 1}">
      <button type="button" class="btn-layer-step btn-step-up" title="Increase neurons" aria-label="Increase neurons in hidden layer ${i + 1}">+</button>
      <span class="neuron-count">${n}</span>
      <button type="button" class="btn-layer-delete" title="Delete layer ${i + 1}" aria-label="Delete hidden layer ${i + 1}">
        <i aria-hidden="true" class="fas fa-trash-alt"></i>
      </button>
    `;

    const inputEl = row.querySelector("input");
    const countEl = row.querySelector(".neuron-count");
    const btnDown = row.querySelector(".btn-step-down");
    const btnUp = row.querySelector(".btn-step-up");
    const btnDel = row.querySelector(".btn-layer-delete");

    if (inputEl) {
      inputEl.addEventListener("input", e => {
        const val = parseInt(e.target.value);
        state.hiddenLayers[i] = val;
        if (countEl) countEl.textContent = val;
        updateArchitectureSummary();
        resetAll();
      });
    }

    if (btnDown && inputEl) {
      btnDown.addEventListener("click", () => {
        if (state.hiddenLayers[i] > 1) {
          state.hiddenLayers[i]--;
          inputEl.value = state.hiddenLayers[i];
          if (countEl) countEl.textContent = state.hiddenLayers[i];
          updateArchitectureSummary();
          resetAll();
        }
      });
    }

    if (btnUp && inputEl) {
      btnUp.addEventListener("click", () => {
        if (state.hiddenLayers[i] < 16) {
          state.hiddenLayers[i]++;
          inputEl.value = state.hiddenLayers[i];
          if (countEl) countEl.textContent = state.hiddenLayers[i];
          updateArchitectureSummary();
          resetAll();
        }
      });
    }

    if (btnDel) {
      btnDel.addEventListener("click", () => {
        if (state.hiddenLayers.length > 1) {
          state.hiddenLayers.splice(i, 1);
          renderLayerUI();
          resetAll();
        }
      });
    }

    container.appendChild(row);
  });

  updateArchitectureSummary();
}

function applyPreset(presetKey) {
  if (ARCHITECTURE_PRESETS[presetKey]) {
    state.hiddenLayers = [...ARCHITECTURE_PRESETS[presetKey]];
    document.querySelectorAll(".preset-chip").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.preset === presetKey);
    });
    renderLayerUI();
    resetAll();
  }
}

function createTrainingWorker() {
  if (typeof Worker === "undefined") return null;

  try {
    return new Worker("nnWorker.js");
  } catch (error) {
    console.warn(
      "Neural network worker could not be created; using main-thread training.",
      error
    );
    return null;
  }
}

function syncWorkerState() {
  if (!state.worker) return;

  const layers = [2, ...state.hiddenLayers, 1];
  state.worker.postMessage({
    type: "INIT_NETWORK",
    payload: {
      layers,
      activationName: state.activationName,
      lr: state.learningRate,
      regularization: state.regularization,
      weights: state.net ? state.net.weights : undefined,
      biases: state.net ? state.net.biases : undefined,
    },
  });
  state.worker.postMessage({
    type: "INIT_DATA",
    payload: {
      datasetType: state.dataset,
      numPoints: state.numPoints,
      noise: state.noise,
      customData: state.customData,
      points: state.data,
    },
  });
}

let nnWorkerRetryCount = 0;
let nnWorkerRetryTimer = null;
const MAX_NN_WORKER_RETRIES = 3;
const NN_WORKER_INITIAL_DELAY = 500;

function handleWorkerError(event) {
  const message = event && event.message ? event.message : "unknown error";
  console.error("Neural network worker error:", message);

  if (state.worker) {
    try {
      state.worker.terminate();
    } catch (error) {
      console.warn("Failed to terminate the neural network worker.", error);
    }
    state.worker = null;
  }

  if (!state.net) initNetwork();
  if (!state.training) return;

  if (state.animId) {
    cancelAnimationFrame(state.animId);
    state.animId = null;
  }
  announceTrainingStatus(
    "Worker failed. Continuing training on the main thread."
  );
  trainStep();

  if (nnWorkerRetryCount < MAX_NN_WORKER_RETRIES) {
    const delay = Math.min(
      NN_WORKER_INITIAL_DELAY * Math.pow(2, nnWorkerRetryCount),
      4000
    );
    nnWorkerRetryCount++;
    if (nnWorkerRetryTimer) clearTimeout(nnWorkerRetryTimer);
    nnWorkerRetryTimer = setTimeout(() => {
      nnWorkerRetryTimer = null;
      if (state.training && !state.worker) {
        state.worker = createTrainingWorker();
        if (state.worker) {
          setupEvents();
          syncWorkerState();
        }
      }
    }, delay);
  }
}

function setupEvents() {
  state.worker = createTrainingWorker();

  if (state.worker) {
    state.worker.onmessage = e => {
      const { type, payload } = e.data;

      switch (type) {
        case "NETWORK_INITED":
          break;

        case "DATA_INITED":
          break;

        case "TRAIN_STEP_COMPLETE": {
          const { loss, accuracy, epochs, weights, biases, layerGradients } =
            payload;

          state.epoch += epochs;
          if (
            state.lossHistory.length === 0 ||
            state.epoch % Math.max(1, Math.floor(state.speed / 5)) === 0
          ) {
            state.lossHistory.push(loss);
            state.accHistory.push(accuracy);
            if (state.lossHistory.length > 500) {
              state.lossHistory.shift();
              state.accHistory.shift();
            }
          }

          if (Array.isArray(layerGradients)) {
            state.layerGradients = layerGradients;
          }

          updateStats(state.epoch, loss, accuracy);

          // Synchronize weights back to main thread for rendering
          if (state.net) {
            state.net.weights = weights;
            state.net.biases = biases;
          } else {
            const layers = [2, ...state.hiddenLayers, 1];
            state.net = new NeuralNetwork(
              layers,
              state.activationName,
              state.learningRate,
              state.regularization
            );
            state.net.weights = weights;
            state.net.biases = biases;
          }

          renderAll();
          if (state.training) {
            state.animId = requestAnimationFrame(trainStep);
          }
          break;
        }
      }
    };
    state.worker.onerror = handleWorkerError;
    syncWorkerState();
  } else {
    announceTrainingStatus(
      "Web Workers are unavailable. Training will run on the main thread at a reduced rate."
    );
  }

  $("btnTrain").addEventListener("click", startTraining);
  $("btnPause").addEventListener("click", pauseTraining);
  $("btnReset").addEventListener("click", resetAll);

  $("speedSlider").addEventListener("input", e => {
    state.speed = parseInt(e.target.value);
    $("speedLabel").textContent = state.speed + " steps/frame";
  });

  // Layer add/remove handlers
  $("btnAddLayer").addEventListener("click", () => {
    if (state.hiddenLayers.length < 6) {
      state.hiddenLayers.push(4);
      renderLayerUI();
      resetAll();
    }
  });

  $("btnRemoveLayer").addEventListener("click", () => {
    if (state.hiddenLayers.length > 1) {
      state.hiddenLayers.pop();
      renderLayerUI();
      resetAll();
    }
  });

  // Preset architecture buttons
  document.querySelectorAll(".preset-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      applyPreset(btn.dataset.preset);
    });
  });

  $("learningRate").addEventListener("change", e => {
    state.learningRate = parseFloat(e.target.value);
    if (state.worker) {
      state.worker.postMessage({
        type: "UPDATE_PARAMS",
        payload: { lr: state.learningRate },
      });
    }
    if (state.net) state.net.lr = state.learningRate;
  });

  $("activation").addEventListener("change", e => {
    state.activationName = e.target.value;
    resetAll();
  });

  $("batchSize").addEventListener("change", e => {
    state.batchSize = parseInt(e.target.value);
  });

  const regSelect = $("regularization");
  if (regSelect) {
    regSelect.addEventListener("change", e => {
      state.regularization = parseFloat(e.target.value);
      if (state.worker) {
        state.worker.postMessage({
          type: "UPDATE_PARAMS",
          payload: { regularization: state.regularization },
        });
      }
      if (state.net) state.net.regularization = state.regularization;
    });
  }

  $("showDataToggle").addEventListener("change", e => {
    state.showData = e.target.checked;
    drawBoundary();
  });

  const contourToggle = $("showContourToggle");
  if (contourToggle) {
    contourToggle.addEventListener("change", e => {
      state.showContour = e.target.checked;
      drawBoundary();
    });
  }

  $("showWeightsToggle").addEventListener("change", e => {
    state.showWeights = e.target.checked;
    drawNetwork();
  });

  // ── DATASET SELECTION ────────────────────────────────────────
  document.querySelectorAll("[data-dataset]").forEach(btn => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-dataset]")
        .forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const dataset = btn.dataset.dataset;
      state.dataset = dataset;

      if (dataset === "custom") {
        $("csvFileInput").click();
        return;
      }

      $("csvErrorContainer").style.display = "none";
      $("csvSuccessContainer").style.display = "none";

      initData();
      resetAll();
    });
  });

  // ── NOISE & POINTS SLIDERS ──────────────────────────────────
  $("noiseSlider").addEventListener("input", e => {
    state.noise = parseInt(e.target.value);
    $("noiseLabel").textContent = state.noise + "%";
  });

  $("pointsSlider").addEventListener("input", e => {
    state.numPoints = parseInt(e.target.value);
    $("pointsLabel").textContent = state.numPoints;
  });

  $("btnRegenData").addEventListener("click", () => {
    initData();
    resetAll();
  });

  // ── CSV UPLOAD & PARSING ────────────────────────────────────
  $("csvFileInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    $("csvErrorContainer").style.display = "none";
    $("csvSuccessContainer").style.display = "none";

    if (!file.name.endsWith(".csv")) {
      $("csvErrorMessage").textContent = "Please upload a .csv file.";
      $("csvErrorContainer").style.display = "flex";
      return;
    }

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const text = evt.target.result;
        const rows = text
          .split(/\r?\n/)
          .map(r => r.trim())
          .filter(r => r.length > 0);

        if (rows.length === 0) {
          throw new Error("CSV file is empty.");
        }

        const startIdx = isNaN(parseFloat(rows[0].split(",")[0])) ? 1 : 0;
        const data = [];

        for (let i = startIdx; i < rows.length; i++) {
          const cols = rows[i]
            .split(",")
            .map(c => parseFloat(c.trim()))
            .filter(c => !isNaN(c));

          if (cols.length < 3) {
            throw new Error(
              `Row ${i + 1}: expected at least 3 columns (x, y, label), found ${cols.length}.`
            );
          }

          const [x, y, label] = cols;
          if (label !== 0 && label !== 1) {
            throw new Error(
              `Row ${i + 1}: label must be 0 or 1, got ${label}.`
            );
          }
          data.push([x, y, label]);
        }

        if (data.length === 0) {
          throw new Error("No valid data rows found in CSV.");
        }

        state.customData = normalizeDataset(data);
        state.dataset = "custom";

        document
          .querySelectorAll("[data-dataset]")
          .forEach(b => b.classList.remove("active"));
        $("btnCustomDataset").classList.add("active");

        $("csvSuccessMessage").textContent =
          `Loaded ${state.customData.length} points from CSV.`;
        $("csvSuccessContainer").style.display = "flex";

        initData();
        resetAll();
      } catch (err) {
        $("csvErrorMessage").textContent = err.message;
        $("csvErrorContainer").style.display = "flex";
      }
    };
    reader.readAsText(file);
  });

  // ── EXPORT JS ────────────────────────────────────────────────
  function exportJS() {
    if (!state.net || state.epoch === 0) {
      showExportError("Train a model before exporting.");
      return;
    }

    const net = state.net;
    const weightsJSON = JSON.stringify(net.weights);
    const biasesJSON = JSON.stringify(net.biases);
    const layersJSON = JSON.stringify(net.layers);

    const code = `// Neural Network Playground — Exported Model (JavaScript)
// Generated on ${new Date().toISOString()}
// Architecture: [${net.layers.join(", ")}] | Activation: ${net.activationName} | LR: ${net.lr}

const ACTIVATIONS = {
  relu: x => Math.max(0, x),
  sigmoid: x => 1 / (1 + Math.exp(-x)),
  tanh: x => Math.tanh(x),
  leaky_relu: x => (x > 0 ? x : 0.01 * x),
};

const WEIGHTS = ${weightsJSON};
const BIASES = ${biasesJSON};
const LAYERS = ${layersJSON};
const ACTIVATION = "${net.activationName}";

function predict(input) {
  let a = input.slice();
  for (let l = 0; l < WEIGHTS.length; l++) {
    const z = [];
    for (let j = 0; j < WEIGHTS[l].length; j++) {
      let sum = BIASES[l][j];
      for (let k = 0; k < a.length; k++) sum += WEIGHTS[l][j][k] * a[k];
      z.push(sum);
    }
    const isLast = l === WEIGHTS.length - 1;
    a = z.map(v =>
      isLast ? 1 / (1 + Math.exp(-v)) : ACTIVATIONS[ACTIVATION](v)
    );
  }
  return a[0];
}

// Example usage:
// console.log(predict([0.5, -0.3]));  // returns probability in [0, 1]
`;

    downloadFile(code, "neural-network-model.js", "application/javascript");
  }

  // ── EXPORT PYTHON ────────────────────────────────────────────
  function exportPy() {
    if (!state.net || state.epoch === 0) {
      showExportError("Train a model before exporting.");
      return;
    }

    const net = state.net;

    const formatMatrix = m =>
      "[" +
      m
        .map(row => "[" + row.map(v => v.toFixed(8)).join(", ") + "]")
        .join(",\n    ") +
      "]";

    const weightsPy = net.weights.map(formatMatrix).join(",\n    ");
    const biasesPy = net.biases
      .map(b => "[" + b.map(v => v.toFixed(8)).join(", ") + "]")
      .join(",\n    ");

    const pyActivation = {
      relu: "lambda x: max(0, x)",
      sigmoid: "lambda x: 1 / (1 + math.exp(-x))",
      tanh: "lambda x: math.tanh(x)",
      leaky_relu: "lambda x: x if x > 0 else 0.01 * x",
    };

    const code = `# Neural Network Playground — Exported Model (Python)
# Generated on ${new Date().toISOString()}
# Architecture: [${net.layers.join(", ")}] | Activation: ${net.activationName} | LR: ${net.lr}

import math

WEIGHTS = [
    ${weightsPy}
]

BIASES = [
    ${biasesPy}
]

ACTIVATION = ${pyActivation[net.activationName] || pyActivation.relu}


def predict(inputs):
    """Forward pass through the network."""
    a = list(inputs)
    for l in range(len(WEIGHTS)):
        z = []
        for j in range(len(WEIGHTS[l])):
            s = BIASES[l][j]
            for k in range(len(a)):
                s += WEIGHTS[l][j][k] * a[k]
            z.append(s)
        is_last = l == len(WEIGHTS) - 1
        if is_last:
            a = [1 / (1 + math.exp(-v)) for v in z]
        else:
            a = [ACTIVATION(v) for v in z]
    return a[0]


# Example usage:
# print(predict([0.5, -0.3]))  # returns probability in [0, 1]
`;

    downloadFile(code, "neural_network_model.py", "text/x-python");
  }

  // ── DOWNLOAD HELPER ──────────────────────────────────────────
  function downloadFile(content, filename, mimeType) {
    if (typeof document === "undefined" || typeof URL === "undefined") return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── EXPORT BUTTON WIRING ─────────────────────────────────────
  $("btnExportJS").addEventListener("click", exportJS);
  $("btnExportPy").addEventListener("click", exportPy);
}

// ── INITIALIZATION ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderLayerUI();
  initData();
  initNetwork();
  renderAll();
  setupEvents();
});
