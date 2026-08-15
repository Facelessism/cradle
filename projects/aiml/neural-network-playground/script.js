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
  speed: 50,
  training: false,
  epoch: 0,
  lossHistory: [],
  data: [],
  customData: [],
  net: null,
  animId: null,
  showData: true,
  showWeights: true,
};

// ── DOM REFS ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const boundaryCanvas = $("boundaryCanvas");
const networkCanvas = $("networkCanvas");
const lossCanvas = $("lossCanvas");
const bCtx = boundaryCanvas.getContext("2d");
const nCtx = networkCanvas.getContext("2d");
const lCtx = lossCanvas.getContext("2d");

// ── INITIALIZATION ───────────────────────────────────────────
function initNetwork() {
  const layers = [2, ...state.hiddenLayers, 1];
  state.net = new NeuralNetwork(
    layers,
    state.activationName,
    state.learningRate
  );
  state.epoch = 0;
  state.lossHistory = [];
  updateStats(0, "—", "—");
}

function initData() {
  if (state.dataset === "custom") {
    state.data = state.customData.map(p => [...p]);
  } else {
    state.data = generateDataset(state.dataset, state.numPoints, state.noise);
  }
}

function updateStats(epoch, loss, acc) {
  $("epochCount").textContent = epoch;
  $("lossValue").textContent =
    typeof loss === "number" ? loss.toFixed(4) : loss;
  $("accuracyValue").textContent =
    typeof acc === "number" ? (acc * 100).toFixed(1) + "%" : acc;
}

// ── RENDERING: DECISION BOUNDARY ─────────────────────────────
function drawBoundary() {
  const c = boundaryCanvas;
  const ctx = bCtx;
  const w = c.width;
  const h = c.height;
  const res = 3;
  const imgData = ctx.createImageData(w, h);

  for (let py = 0; py < h; py += res) {
    for (let px = 0; px < w; px += res) {
      const x = (px / w) * 2 - 1;
      const y = (py / h) * 2 - 1;
      const pred = state.net ? state.net.predict([x, y]) : 0.5;

      const r = Math.floor(30 + pred * 180);
      const g = Math.floor(40 + (1 - Math.abs(pred - 0.5) * 2) * 30);
      const b = Math.floor(30 + (1 - pred) * 180);
      const a = 180;

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

  if (state.showData && state.data.length) {
    state.data.forEach(([x, y, label]) => {
      const px = ((x + 1) / 2) * w;
      const py = ((y + 1) / 2) * h;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = label === 1 ? "#ef5350" : "#4fc3f7";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }
}

// ── RENDERING: NETWORK GRAPH ─────────────────────────────────
function drawNetwork() {
  const c = networkCanvas;
  const ctx = nCtx;
  const w = c.width;
  const h = c.height;
  ctx.clearRect(0, 0, w, h);

  if (!state.net) return;
  const layers = state.net.layers;
  const numLayers = layers.length;
  const padX = 60;
  const padY = 30;
  const layerSpacing = (w - padX * 2) / (numLayers - 1);

  const positions = [];
  for (let l = 0; l < numLayers; l++) {
    const n = layers[l];
    const x = padX + l * layerSpacing;
    const neuronSpacing = Math.min(40, (h - padY * 2) / (n + 1));
    const startY = h / 2 - ((n - 1) * neuronSpacing) / 2;
    const layerPos = [];
    for (let i = 0; i < n; i++) {
      layerPos.push({ x, y: startY + i * neuronSpacing });
    }
    positions.push(layerPos);
  }

  if (state.showWeights) {
    for (let l = 0; l < state.net.weights.length; l++) {
      const wt = state.net.weights[l];
      for (let j = 0; j < wt.length; j++) {
        for (let k = 0; k < wt[j].length; k++) {
          const v = wt[j][k];
          const absV = Math.min(Math.abs(v), 3) / 3;
          const from = positions[l][k];
          const to = positions[l + 1][j];
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.strokeStyle =
            v > 0
              ? `rgba(79,195,247,${0.1 + absV * 0.7})`
              : `rgba(239,83,80,${0.1 + absV * 0.7})`;
          ctx.lineWidth = 0.5 + absV * 2.5;
          ctx.stroke();
        }
      }
    }
  }

  const labels = [
    "Input",
    ...state.hiddenLayers.map((_, i) => `Hidden ${i + 1}`),
    "Output",
  ];
  for (let l = 0; l < numLayers; l++) {
    ctx.fillStyle = "rgba(139,157,195,0.7)";
    ctx.font = "500 10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(labels[l], positions[l][0].x, padY - 10);

    for (let i = 0; i < layers[l]; i++) {
      const { x, y } = positions[l][i];
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 16);
      grad.addColorStop(0, "rgba(79,195,247,0.15)");
      grad.addColorStop(1, "rgba(79,195,247,0)");
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
}

// ── RENDERING: LOSS CHART ────────────────────────────────────
function drawLossChart() {
  const c = lossCanvas;
  const ctx = lCtx;
  const w = c.width;
  const h = c.height;
  ctx.clearRect(0, 0, w, h);

  const hist = state.lossHistory;
  if (hist.length < 2) {
    ctx.fillStyle = "rgba(139,157,195,0.3)";
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Training loss will appear here...", w / 2, h / 2);
    return;
  }

  const pad = { top: 15, right: 20, bottom: 25, left: 50 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const maxLoss = Math.max(...hist, 0.01);
  const minLoss = 0;

  ctx.strokeStyle = "rgba(42,53,80,0.5)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(139,157,195,0.5)";
    ctx.font = "10px JetBrains Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText((maxLoss - (maxLoss / 4) * i).toFixed(3), pad.left - 6, y + 3);
  }

  const gradient = ctx.createLinearGradient(
    pad.left,
    pad.top,
    pad.left,
    pad.top + plotH
  );
  gradient.addColorStop(0, "rgba(255,183,77,0.3)");
  gradient.addColorStop(1, "rgba(255,183,77,0)");

  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + plotH);
  for (let i = 0; i < hist.length; i++) {
    const x = pad.left + (i / (hist.length - 1)) * plotW;
    const y = pad.top + (1 - (hist[i] - minLoss) / (maxLoss - minLoss)) * plotH;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(pad.left + plotW, pad.top + plotH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < hist.length; i++) {
    const x = pad.left + (i / (hist.length - 1)) * plotW;
    const y = pad.top + (1 - (hist[i] - minLoss) / (maxLoss - minLoss)) * plotH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#ffb74d";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(139,157,195,0.5)";
  ctx.font = "10px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Epoch", w / 2, h - 4);
}

function renderAll() {
  drawBoundary();
  drawNetwork();
  drawLossChart();
}

function trainStep() {
  if (!state.training || !state.net) return;

  const inputs = state.data.map(d => [d[0], d[1]]);
  const targets = state.data.map(d => d[2]);

  for (let s = 0; s < state.speed; s++) {
    const { loss, accuracy } = state.net.train(
      inputs,
      targets,
      state.batchSize
    );
    state.epoch++;
    if (
      state.epoch % Math.max(1, Math.floor(state.speed / 5)) === 0 ||
      state.lossHistory.length === 0
    ) {
      state.lossHistory.push(loss);
      if (state.lossHistory.length > 500) state.lossHistory.shift();
    }
    updateStats(state.epoch, loss, accuracy);
  }

  renderAll();
  state.animId = requestAnimationFrame(trainStep);
}

function startTraining() {
  if (state.training) return;
  if (!state.net) initNetwork();
  state.training = true;
  $("btnTrain").disabled = true;
  $("btnPause").disabled = false;
  document.body.classList.add("training-active");
  hideExportError();
  trainStep();
}

function pauseTraining() {
  state.training = false;
  if (state.animId) cancelAnimationFrame(state.animId);
  $("btnTrain").disabled = false;
  $("btnPause").disabled = true;
  $("btnTrain").innerHTML = '<i class="fas fa-play"></i> Resume';
  document.body.classList.remove("training-active");
}

function resetAll() {
  pauseTraining();
  $("btnTrain").innerHTML = '<i class="fas fa-play"></i> Train';
  initNetwork();
  renderAll();
  hideExportError();
}

function renderLayerUI() {
  const container = $("layerNeurons");
  container.innerHTML = "";
  state.hiddenLayers.forEach((n, i) => {
    const row = document.createElement("div");
    row.className = "layer-row";
    row.innerHTML = `
      <span class="layer-label">Layer ${i + 1}</span>
      <input type="range" min="1" max="12" value="${n}" data-layer="${i}">
      <span class="neuron-count">${n}</span>
    `;
    row.querySelector("input").addEventListener("input", e => {
      const val = parseInt(e.target.value);
      state.hiddenLayers[i] = val;
      row.querySelector(".neuron-count").textContent = val;
      resetAll();
    });
    container.appendChild(row);
  });
}

function setupEvents() {
  $("btnTrain").addEventListener("click", startTraining);
  $("btnPause").addEventListener("click", pauseTraining);
  $("btnReset").addEventListener("click", resetAll);

  $("speedSlider").addEventListener("input", e => {
    state.speed = parseInt(e.target.value);
    $("speedLabel").textContent = state.speed + " steps/frame";
  });

  // Layer add/remove handlers
  $("btnAddLayer").addEventListener("click", () => {
    if (state.hiddenLayers.length < 4) {
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

  $("learningRate").addEventListener("change", e => {
    state.learningRate = parseFloat(e.target.value);
    if (state.net) state.net.lr = state.learningRate;
  });

  $("activation").addEventListener("change", e => {
    state.activationName = e.target.value;
    resetAll();
  });

  $("batchSize").addEventListener("change", e => {
    state.batchSize = parseInt(e.target.value);
  });

  $("showDataToggle").addEventListener("change", e => {
    state.showData = e.target.checked;
    drawBoundary();
  });

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

        // Skip header row if it contains non-numeric first value
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

  // ── EXPORT HELPERS ────────────────────────────────────────────
  function showExportError(message) {
    $("exportStatusMessage").textContent = message;
    $("exportStatus").style.display = "flex";
  }

  function hideExportError() {
    $("exportStatus").style.display = "none";
  }

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
// console.log(predict([0.5, -0.3]));  // returns probability
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
# print(predict([0.5, -0.3]))  # returns probability
`;

    downloadFile(code, "neural_network_model.py", "text/x-python");
  }

  // ── DOWNLOAD HELPER ──────────────────────────────────────────
  function downloadFile(content, filename, mimeType) {
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
