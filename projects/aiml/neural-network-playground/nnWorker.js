/* ============================================================
   NEURAL NETWORK WORKER
   Handles compute-intensive NN operations off the main thread
   ============================================================ */
importScripts('nnEngine.js');
let net = null;
let dataset = [];
let targets = [];
self.onmessage = function(e) {
  const { type, payload } = e.data;
  switch (type) {
    case 'INIT_NETWORK': {
      const { layers, activationName, lr } = payload;
      net = new NeuralNetwork(layers, activationName, lr);
      self.postMessage({ type: 'NETWORK_INITED' });
      break;
    }
    case 'INIT_DATA': {
      const { datasetType, numPoints, noise, customData } = payload;
      if (datasetType === 'custom') {
        dataset = customData.map(p => [...p]);
      } else {
        dataset = generateDataset(datasetType, numPoints, noise);
      }
      
      // Split into inputs and targets
      const inputs = dataset.map(d => [d[0], d[1]]);
      targets = dataset.map(d => d[2]);
      
      self.postMessage({ type: 'DATA_INITED', count: dataset.length });
      break;
    }
    case 'TRAIN_STEP': {
      if (!net || dataset.length === 0) return;
      const inputs = dataset.map(d => [d[0], d[1]]);
      const { speed, batchSize } = payload;
      
      let totalEpochs = 0;
      let lastLoss = 0;
      let lastAcc = 0;
      for (let s = 0; s < speed; s++) {
        const result = net.train(inputs, targets, batchSize);
        lastLoss = result.loss;
        lastAcc = result.accuracy;
        totalEpochs++;
      }
      self.postMessage({ 
        type: 'TRAIN_STEP_COMPLETE', 
        payload: { 
          loss: lastLoss, 
          accuracy: lastAcc, 
          epochs: totalEpochs,
          weights: net.weights,
          biases: net.biases
        } 
      });
      break;
    }
    case 'PREDICT_GRID': {
      if (!net) return;
      const { width, height, res } = payload;
      const predictions = [];
      for (let py = 0; py < height; py += res) {
        for (let px = 0; px < width; px += res) {
          const x = (px / width) * 2 - 1;
          const y = (py / height) * 2 - 1;
          predictions.push(net.predict([x, y]));
        }
      }
      self.postMessage({ type: 'GRID_PREDICTIONS', payload: predictions });
      break;
    }
    case 'UPDATE_PARAMS': {
      if (net && payload.lr !== undefined) {
        net.lr = payload.lr;
      }
      break;
    }
  }
};