/**
 * Visualizer Engine - Calculations and Canvas Rendering Utilities
 */
(function (exports) {
  /**
   * Calculates peak amplitude value from time domain / frequency byte array.
   * @param {Uint8Array} dataArray
   * @returns {number} Peak value between 0 and 1
   */
  function calculatePeakLevel(dataArray) {
    if (!dataArray || dataArray.length === 0) return 0;
    let max = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const val = Math.abs(dataArray[i] - 128);
      if (val > max) max = val;
    }
    return Math.min(1, max / 128);
  }

  /**
   * Converts frequency bin data into logarithmically grouped frequency bands.
   * @param {Uint8Array} freqData
   * @param {number} numBands
   * @returns {number[]} Array of normalized band amplitudes [0, 1]
   */
  function calculateFrequencyBands(freqData, numBands = 16) {
    if (!freqData || freqData.length === 0) return new Array(numBands).fill(0);

    const bands = new Array(numBands).fill(0);
    const binCount = freqData.length;
    const logFactor = Math.pow(binCount, 1 / numBands);

    let startBin = 0;
    for (let i = 0; i < numBands; i++) {
      const endBin = Math.min(binCount, Math.floor(Math.pow(logFactor, i + 1)));
      let sum = 0;
      let count = 0;

      for (let j = startBin; j < endBin; j++) {
        sum += freqData[j];
        count++;
      }

      bands[i] = count > 0 ? (sum / count) / 255 : 0;
      startBin = endBin;
    }

    return bands;
  }

  /**
   * Computes radial coordinates for 360-degree radial visualizer bars.
   * @param {number} index
   * @param {number} total
   * @param {number} radius
   * @param {number} amplitude
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @returns {Object} Start and End coordinates
   */
  function calculateRadialBar(index, total, radius, amplitude, cx, cy) {
    const angle = (index / total) * Math.PI * 2;
    const startX = cx + Math.cos(angle) * radius;
    const startY = cy + Math.sin(angle) * radius;
    const endX = cx + Math.cos(angle) * (radius + amplitude);
    const endY = cy + Math.sin(angle) * (radius + amplitude);

    return { startX, startY, endX, endY, angle };
  }

  exports.calculatePeakLevel = calculatePeakLevel;
  exports.calculateFrequencyBands = calculateFrequencyBands;
  exports.calculateRadialBar = calculateRadialBar;
})(typeof exports === "undefined" ? (window.VisualizerEngine = {}) : exports);
