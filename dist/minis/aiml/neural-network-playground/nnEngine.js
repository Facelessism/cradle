// --- NEURAL NETWORK CORE ENGINE & MATHEMATICAL MATRIX PRIMITIVES ---
const Activations = {
  relu: { fn: x => Math.max(0, x), deriv: x => (x > 0 ? 1 : 0) },
  sigmoid: {
    fn: x => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))),
    deriv: x => {
      const s = 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
      return s * (1 - s);
    },
  },
  tanh: { fn: x => Math.tanh(x), deriv: x => 1 - Math.tanh(x) ** 2 },
  leaky_relu: {
    fn: x => (x > 0 ? x : 0.01 * x),
    deriv: x => (x > 0 ? 1 : 0.01),
  },
};

function generateDataset(type, n, noise) {
  const pts = [];
  const nr = noise / 100;
  const rand = () => (Math.random() - 0.5) * 2 * nr;
  switch (type) {
    case "circle":
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random();
        const inner = r < 0.5;
        const rad = inner ? Math.random() * 0.35 : 0.55 + Math.random() * 0.4;
        pts.push([
          Math.cos(a) * rad + rand(),
          Math.sin(a) * rad + rand(),
          inner ? 1 : 0,
        ]);
      }
      break;
    case "xor":
      for (let i = 0; i < n; i++) {
        const x = (Math.random() - 0.5) * 2;
        const y = (Math.random() - 0.5) * 2;
        pts.push([x + rand(), y + rand(), x * y > 0 ? 1 : 0]);
      }
      break;
    case "spiral":
      for (let i = 0; i < n; i++) {
        const c = i % 2;
        const t = (i / n) * 3 * Math.PI + c * Math.PI;
        const r = (t / (3 * Math.PI)) * 0.8 + 0.1;
        pts.push([r * Math.cos(t) + rand(), r * Math.sin(t) + rand(), c]);
      }
      break;
    case "gaussian":
      for (let i = 0; i < n; i++) {
        const c = i % 2;
        const cx = c ? -0.4 : 0.4;
        const cy = c ? -0.4 : 0.4;
        pts.push([
          cx + (Math.random() - 0.5) * 0.6 + rand(),
          cy + (Math.random() - 0.5) * 0.6 + rand(),
          c,
        ]);
      }
      break;
    case "moon":
      for (let i = 0; i < n; i++) {
        const c = i % 2;
        const a = Math.random() * Math.PI;
        if (c === 0) {
          pts.push([Math.cos(a) + rand(), Math.sin(a) + rand() - 0.2, 0]);
        } else {
          pts.push([
            1 - Math.cos(a) + rand(),
            1 - Math.sin(a) - 0.5 + rand(),
            1,
          ]);
        }
      }
      break;
    default:
      return generateDataset("circle", n, noise);
  }

  return normalizeDataset(pts);
}

function normalizeDataset(pts) {
  if (!pts || pts.length === 0) return [];
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  pts.forEach(p => {
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  });
  const rx = maxX - minX || 1;
  const ry = maxY - minY || 1;
  return pts.map(p => [
    ((p[0] - minX) / rx) * 2 - 1,
    ((p[1] - minY) / ry) * 2 - 1,
    p[2],
  ]);
}

class NeuralNetwork {
  constructor(layers, activationName = "relu", lr = 0.01) {
    this.layers = layers;
    this.activationName = activationName;
    this.activation = Activations[activationName] || Activations.relu;
    this.lr = lr;
    this.weights = [];
    this.biases = [];
    this.initWeights();
  }

  initWeights() {
    this.weights = [];
    this.biases = [];
    for (let i = 0; i < this.layers.length - 1; i++) {
      const fanIn = this.layers[i];
      const fanOut = this.layers[i + 1];
      const scale = Math.sqrt(2 / fanIn);
      const w = [];
      for (let j = 0; j < fanOut; j++) {
        const row = [];
        for (let k = 0; k < fanIn; k++) {
          row.push((Math.random() * 2 - 1) * scale);
        }
        w.push(row);
      }
      this.weights.push(w);
      this.biases.push(new Array(fanOut).fill(0));
    }
  }

  forward(input) {
    const zs = [];
    const as = [input.slice()];
    let a = input.slice();
    for (let l = 0; l < this.weights.length; l++) {
      const z = [];
      const w = this.weights[l];
      const b = this.biases[l];
      for (let j = 0; j < w.length; j++) {
        let sum = b[j];
        for (let k = 0; k < a.length; k++) sum += w[j][k] * a[k];
        z.push(sum);
      }
      zs.push(z);
      const isLast = l === this.weights.length - 1;
      a = z.map(v =>
        isLast ? Activations.sigmoid.fn(v) : this.activation.fn(v)
      );
      as.push(a);
    }
    return { zs, as, output: a };
  }

  predict(input) {
    return this.forward(input).output[0];
  }

  train(inputs, targets, batchSize) {
    let totalLoss = 0;
    let correct = 0;
    const indices = Array.from({ length: inputs.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const bs = batchSize > 0 ? batchSize : inputs.length;

    for (let bStart = 0; bStart < indices.length; bStart += bs) {
      const bEnd = Math.min(bStart + bs, indices.length);
      const dW = this.weights.map(w =>
        w.map(row => new Array(row.length).fill(0))
      );
      const dB = this.biases.map(b => new Array(b.length).fill(0));
      const batchLen = bEnd - bStart;

      for (let bi = bStart; bi < bEnd; bi++) {
        const idx = indices[bi];
        const x = inputs[idx];
        const t = targets[idx];
        const { zs, as } = this.forward(x);
        const out = as[as.length - 1][0];

        const clipped = Math.max(1e-7, Math.min(1 - 1e-7, out));
        totalLoss += -(t * Math.log(clipped) + (1 - t) * Math.log(1 - clipped));
        correct += (out >= 0.5 ? 1 : 0) === t ? 1 : 0;

        const deltas = [];
        let delta = [out - t];
        deltas.unshift(delta);

        for (let l = this.weights.length - 2; l >= 0; l--) {
          const newDelta = [];
          for (let j = 0; j < this.weights[l].length; j++) {
            let err = 0;
            for (let k = 0; k < this.weights[l + 1].length; k++) {
              err += this.weights[l + 1][k][j] * deltas[0][k];
            }
            newDelta.push(err * this.activation.deriv(zs[l][j]));
          }
          deltas.unshift(newDelta);
        }

        for (let l = 0; l < this.weights.length; l++) {
          for (let j = 0; j < this.weights[l].length; j++) {
            for (let k = 0; k < this.weights[l][j].length; k++) {
              dW[l][j][k] += deltas[l][j] * as[l][k];
            }
            dB[l][j] += deltas[l][j];
          }
        }
      }

      for (let l = 0; l < this.weights.length; l++) {
        for (let j = 0; j < this.weights[l].length; j++) {
          for (let k = 0; k < this.weights[l][j].length; k++) {
            this.weights[l][j][k] -= (this.lr * dW[l][j][k]) / batchLen;
          }
          this.biases[l][j] -= (this.lr * dB[l][j]) / batchLen;
        }
      }
    }

    return {
      loss: totalLoss / inputs.length,
      accuracy: correct / inputs.length,
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    Activations,
    generateDataset,
    normalizeDataset,
    NeuralNetwork,
  };
}
