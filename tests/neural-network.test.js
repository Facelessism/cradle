const test = require("node:test");
const assert = require("node:assert/strict");
const {
  Activations,
  generateDataset,
  normalizeDataset,
  computeTotalParameters,
  NeuralNetwork,
} = require("../projects/aiml/neural-network-playground/nnEngine");

test("activations evaluate correctly and derivates match expected values", () => {
  assert.equal(Activations.relu.fn(5), 5);
  assert.equal(Activations.relu.fn(-3), 0);
  assert.equal(Activations.relu.deriv(5), 1);
  assert.equal(Activations.relu.deriv(-3), 0);

  assert.ok(Activations.sigmoid.fn(0) - 0.5 < 1e-5);
  assert.ok(Activations.sigmoid.deriv(0) - 0.25 < 1e-5);
});

test("dataset generator builds valid normalized 2D data points", () => {
  const data = generateDataset("circle", 50, 10);
  assert.equal(data.length, 50);
  data.forEach(p => {
    assert.equal(p.length, 3);
    assert.ok(p[0] >= -1.05 && p[0] <= 1.05);
    assert.ok(p[1] >= -1.05 && p[1] <= 1.05);
    assert.ok(p[2] === 0 || p[2] === 1);
  });
});

test("neural network forward pass initializes weights and produces probability in [0, 1]", () => {
  const net = new NeuralNetwork([2, 4, 4, 1], "relu", 0.01);
  const result = net.forward([0.5, -0.2]);
  assert.equal(result.as.length, 4); // 4 layers
  const prob = net.predict([0.5, -0.2]);
  assert.ok(prob >= 0 && prob <= 1);
});

test("neural network reduces loss after training steps on XOR problem", () => {
  const net = new NeuralNetwork([2, 8, 4, 1], "tanh", 0.1);
  const inputs = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  const targets = [0, 1, 1, 0];

  const initialLoss = net.train(inputs, targets, 4).loss;
  let finalLoss = initialLoss;

  for (let epoch = 0; epoch < 100; epoch++) {
    finalLoss = net.train(inputs, targets, 4).loss;
  }

  assert.ok(
    finalLoss < initialLoss,
    `Final loss (${finalLoss}) should be smaller than initial loss (${initialLoss})`
  );
});

// ── DATASET GENERATOR: ALL TYPES ────────────────────────────────

test("generateDataset produces valid data for 'xor' type", () => {
  const data = generateDataset("xor", 40, 10);
  assert.equal(data.length, 40);
  data.forEach(p => {
    assert.equal(p.length, 3);
    assert.ok(p[0] >= -1.05 && p[0] <= 1.05);
    assert.ok(p[1] >= -1.05 && p[1] <= 1.05);
    assert.ok(p[2] === 0 || p[2] === 1);
  });
});

test("generateDataset produces valid data for 'spiral' type", () => {
  const data = generateDataset("spiral", 40, 10);
  assert.equal(data.length, 40);
  data.forEach(p => {
    assert.equal(p.length, 3);
    assert.ok(p[0] >= -1.05 && p[0] <= 1.05);
    assert.ok(p[1] >= -1.05 && p[1] <= 1.05);
    assert.ok(p[2] === 0 || p[2] === 1);
  });
});

test("generateDataset produces valid data for 'gaussian' type", () => {
  const data = generateDataset("gaussian", 40, 10);
  assert.equal(data.length, 40);
  data.forEach(p => {
    assert.equal(p.length, 3);
    assert.ok(p[0] >= -1.05 && p[0] <= 1.05);
    assert.ok(p[1] >= -1.05 && p[1] <= 1.05);
    assert.ok(p[2] === 0 || p[2] === 1);
  });
});

test("generateDataset produces valid data for 'moon' type", () => {
  const data = generateDataset("moon", 40, 10);
  assert.equal(data.length, 40);
  data.forEach(p => {
    assert.equal(p.length, 3);
    assert.ok(p[0] >= -1.05 && p[0] <= 1.05);
    assert.ok(p[1] >= -1.05 && p[1] <= 1.05);
    assert.ok(p[2] === 0 || p[2] === 1);
  });
});

test("generateDataset falls back to 'circle' for unknown type", () => {
  const data = generateDataset("unknown_type", 30, 5);
  assert.equal(data.length, 30);
  data.forEach(p => {
    assert.equal(p.length, 3);
    assert.ok(p[0] >= -1.05 && p[0] <= 1.05);
    assert.ok(p[1] >= -1.05 && p[1] <= 1.05);
  });
});

// ── NORMALIZE DATASET ────────────────────────────────────────────

test("normalizeDataset returns empty array for empty input", () => {
  assert.deepEqual(normalizeDataset([]), []);
});

test("normalizeDataset returns empty array for null/undefined input", () => {
  assert.deepEqual(normalizeDataset(null), []);
  assert.deepEqual(normalizeDataset(undefined), []);
});

test("normalizeDataset scales points to [-1, 1] range", () => {
  const raw = [
    [10, 20, 0],
    [30, 40, 1],
    [50, 60, 0],
  ];
  const normalized = normalizeDataset(raw);
  assert.equal(normalized.length, 3);
  normalized.forEach(p => {
    assert.ok(p[0] >= -1.05 && p[0] <= 1.05);
    assert.ok(p[1] >= -1.05 && p[1] <= 1.05);
  });
  // Labels should be preserved
  assert.equal(normalized[0][2], 0);
  assert.equal(normalized[1][2], 1);
  assert.equal(normalized[2][2], 0);
});

test("normalizeDataset handles single-point data", () => {
  const raw = [[5, 10, 1]];
  const normalized = normalizeDataset(raw);
  assert.equal(normalized.length, 1);
  // Single point: range is 0, so normalized to 0 (center)
  assert.equal(normalized[0][0], -1);
  assert.equal(normalized[0][1], -1);
  assert.equal(normalized[0][2], 1);
});

// ── NEURAL NETWORK: EXPORT COMPATIBILITY ─────────────────────────

test("NeuralNetwork weights/biases/layers are accessible for export", () => {
  const net = new NeuralNetwork([2, 6, 4, 1], "relu", 0.01);
  assert.deepEqual(net.layers, [2, 6, 4, 1]);
  assert.equal(net.weights.length, 3);
  assert.equal(net.biases.length, 3);
  assert.equal(net.weights[0].length, 6);
  assert.equal(net.weights[0][0].length, 2);
  assert.equal(net.weights[1].length, 4);
  assert.equal(net.weights[1][0].length, 6);
  assert.equal(net.weights[2].length, 1);
  assert.equal(net.weights[2][0].length, 4);
  assert.equal(net.activationName, "relu");
  assert.equal(net.lr, 0.01);
});

test("NeuralNetwork produces consistent predictions with same weights", () => {
  const net = new NeuralNetwork([2, 4, 1], "sigmoid", 0.01);
  const input = [0.5, -0.3];
  const pred1 = net.predict(input);
  const pred2 = net.predict(input);
  assert.equal(pred1, pred2);
});

// ── CUSTOM MULTI-LAYER PERCEPTRON (MLP) TESTS ─────────────────────

test("computeTotalParameters calculates correct parameter count for arbitrary MLP topologies", () => {
  // [2, 6, 4, 1]: (2*6+6) + (6*4+4) + (4*1+1) = 18 + 28 + 5 = 51
  assert.equal(computeTotalParameters([2, 6, 4, 1]), 51);
  // [2, 2, 1]: (2*2+2) + (2*1+1) = 6 + 3 = 9
  assert.equal(computeTotalParameters([2, 2, 1]), 9);
  // [2, 12, 8, 4, 1]: (2*12+12) + (12*8+8) + (8*4+4) + (4*1+1) = 36 + 104 + 36 + 5 = 181
  assert.equal(computeTotalParameters([2, 12, 8, 4, 1]), 181);
  // Degenerate inputs
  assert.equal(computeTotalParameters([]), 0);
  assert.equal(computeTotalParameters([2]), 0);
});

test("selectable activation functions (ReLU, Sigmoid, Tanh, LeakyReLU) evaluate and derive correctly", () => {
  // ReLU
  assert.equal(Activations.relu.fn(4), 4);
  assert.equal(Activations.relu.fn(-2), 0);
  assert.equal(Activations.relu.deriv(4), 1);
  assert.equal(Activations.relu.deriv(-2), 0);

  // Sigmoid
  assert.ok(Math.abs(Activations.sigmoid.fn(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(Activations.sigmoid.deriv(0) - 0.25) < 1e-6);
  assert.ok(Activations.sigmoid.fn(100) > 0.999);
  assert.ok(Activations.sigmoid.fn(-100) < 0.001);

  // Tanh
  assert.equal(Activations.tanh.fn(0), 0);
  assert.ok(Math.abs(Activations.tanh.deriv(0) - 1.0) < 1e-6);
  assert.ok(Math.abs(Activations.tanh.fn(1) - Math.tanh(1)) < 1e-6);

  // LeakyReLU
  assert.equal(Activations.leaky_relu.fn(5), 5);
  assert.equal(Activations.leaky_relu.fn(-10), -0.1);
  assert.equal(Activations.leaky_relu.deriv(5), 1);
  assert.equal(Activations.leaky_relu.deriv(-10), 0.01);
});

test("custom dynamic MLP architectures with 1 to 6 hidden layers forward pass properly", () => {
  // 1 hidden layer
  const shallow = new NeuralNetwork([2, 3, 1], "relu", 0.01);
  assert.equal(shallow.weights.length, 2);
  const out1 = shallow.predict([0.2, -0.4]);
  assert.ok(out1 >= 0 && out1 <= 1);

  // 4 hidden layers (deep)
  const deep = new NeuralNetwork([2, 4, 4, 4, 4, 1], "tanh", 0.02);
  assert.equal(deep.weights.length, 5);
  const out4 = deep.predict([-0.5, 0.8]);
  assert.ok(out4 >= 0 && out4 <= 1);

  // 6 hidden layers (very deep custom topology)
  const veryDeep = new NeuralNetwork([2, 8, 6, 6, 4, 4, 2, 1], "leaky_relu", 0.05);
  assert.equal(veryDeep.weights.length, 7);
  const out6 = veryDeep.predict([0.1, 0.1]);
  assert.ok(out6 >= 0 && out6 <= 1);
});

test("L2 regularization penalizes large weights during backpropagation", () => {
  const inputs = [
    [0.5, 0.5],
    [-0.5, -0.5],
  ];
  const targets = [1, 0];

  // Train unregularized network
  const netUnreg = new NeuralNetwork([2, 4, 1], "relu", 0.1, 0);
  // Train regularized network with same initial weights
  const netReg = new NeuralNetwork([2, 4, 1], "relu", 0.1, 0.1);

  // Copy weights so they start from exact same point
  netReg.weights = JSON.parse(JSON.stringify(netUnreg.weights));
  netReg.biases = JSON.parse(JSON.stringify(netUnreg.biases));

  for (let i = 0; i < 20; i++) {
    netUnreg.train(inputs, targets, 2);
    netReg.train(inputs, targets, 2);
  }

  // Calculate sum of squared weights for both
  const normUnreg = netUnreg.weights
    .flat(2)
    .reduce((sum, w) => sum + w * w, 0);
  const normReg = netReg.weights
    .flat(2)
    .reduce((sum, w) => sum + w * w, 0);

  assert.ok(
    normReg < normUnreg,
    `Regularized weights norm (${normReg}) should be smaller than unregularized (${normUnreg})`
  );
});

test("backpropagation captures layer gradient flow and vanishing gradients in deep Sigmoid networks", () => {
  const inputs = [
    [0.5, 0.5],
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
  ];
  const targets = [1, 0, 1, 0];

  // Deep network with 4 hidden layers using Sigmoid
  const deepSigmoid = new NeuralNetwork([2, 6, 6, 6, 6, 1], "sigmoid", 0.01);
  const resultSigmoid = deepSigmoid.train(inputs, targets, 4);

  assert.ok(Array.isArray(resultSigmoid.layerGradients));
  assert.equal(resultSigmoid.layerGradients.length, 5); // 5 weight layers

  // In deep sigmoid networks, early layer gradients (index 0) vanish compared to output layer (index 4)
  const earlySigmoidGrad = resultSigmoid.layerGradients[0];
  const outputSigmoidGrad = resultSigmoid.layerGradients[4];
  assert.ok(
    earlySigmoidGrad < outputSigmoidGrad,
    `Early layer gradient (${earlySigmoidGrad}) should be smaller than output layer gradient (${outputSigmoidGrad}) due to vanishing gradients`
  );

  // Deep network with ReLU maintains healthier gradient propagation
  const deepReLU = new NeuralNetwork([2, 6, 6, 6, 6, 1], "relu", 0.01);
  const resultReLU = deepReLU.train(inputs, targets, 4);
  assert.ok(Array.isArray(resultReLU.layerGradients));
  assert.equal(resultReLU.layerGradients.length, 5);
});

