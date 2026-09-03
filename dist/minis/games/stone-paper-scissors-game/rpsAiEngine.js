/**
 * RPS AI Engine - Markov Chain Pattern Prediction for Adaptive Opponent Bot
 */
(function (exports) {
  const CHOICES_CLASSIC = ["rock", "paper", "scissors"];
  const CHOICES_EXTENDED = ["rock", "paper", "scissors", "lizard", "spock"];

  /**
   * Initializes a Markov transition matrix for choices.
   * @param {string[]} choices
   * @returns {Object} Transition matrix map
   */
  function createTransitionMatrix(choices = CHOICES_CLASSIC) {
    const matrix = {};
    choices.forEach(prev => {
      matrix[prev] = {};
      choices.forEach(next => {
        matrix[prev][next] = 1; // Laplace smoothing default count
      });
    });
    return matrix;
  }

  function createAiModel(choices = CHOICES_CLASSIC) {
    let history = [];
    let matrix = createTransitionMatrix(choices);

    /**
     * Records player's choice and updates transition frequencies.
     * @param {string} playerChoice
     */
    function recordMove(playerChoice) {
      if (history.length > 0) {
        const prevMove = history[history.length - 1];
        if (matrix[prevMove] && typeof matrix[prevMove][playerChoice] === "number") {
          matrix[prevMove][playerChoice] += 1;
        }
      }
      history.push(playerChoice);
    }

    /**
     * Predicts player's likely next move based on their last move.
     * @returns {string} Predicted move symbol
     */
    function predictNextPlayerMove() {
      if (history.length === 0) {
        return choices[Math.floor(Math.random() * choices.length)];
      }

      const lastMove = history[history.length - 1];
      const transitions = matrix[lastMove] || {};

      let bestChoice = choices[0];
      let maxCount = -1;

      Object.entries(transitions).forEach(([choice, count]) => {
        if (count > maxCount) {
          maxCount = count;
          bestChoice = choice;
        }
      });

      return bestChoice;
    }

    /**
     * Selects counter choice to beat predicted move.
     * @param {Object} rules - Rules mapping
     * @returns {string} Optimal counter choice
     */
    function getOptimalCounter(rules) {
      const predictedMove = predictNextPlayerMove();
      const candidateCounters = [];

      Object.entries(rules).forEach(([choice, data]) => {
        if (data.beats && data.beats.includes(predictedMove)) {
          candidateCounters.push(choice);
        }
      });

      if (candidateCounters.length === 0) {
        return choices[Math.floor(Math.random() * choices.length)];
      }

      return candidateCounters[Math.floor(Math.random() * candidateCounters.length)];
    }

    function reset() {
      history = [];
      matrix = createTransitionMatrix(choices);
    }

    return {
      recordMove,
      predictNextPlayerMove,
      getOptimalCounter,
      reset
    };
  }

  exports.createAiModel = createAiModel;
  exports.createTransitionMatrix = createTransitionMatrix;
})(typeof exports === "undefined" ? (window.RpsAiEngine = {}) : exports);
