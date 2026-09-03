/**
 * 2048 Game Undo Manager
 * Manages move history stack, board state snapshots, and rollback logic.
 */
(function (exports) {
  function createUndoManager(maxUndoSteps = 10) {
    const stack = [];

    /**
     * Saves a snapshot of the current board state and score before a move.
     * @param {Object} state - Game state object
     */
    function pushState(state) {
      if (!state || !Array.isArray(state.board)) return;

      const snapshot = {
        board: state.board.map(row => [...row]),
        score: state.score,
        won: state.won,
        over: state.over,
        size: state.size
      };

      stack.push(snapshot);
      if (stack.length > maxUndoSteps) {
        stack.shift();
      }
    }

    /**
     * Pops and restores the previous board state.
     * @param {Object} currentState - Current active state object to mutate/restore
     * @returns {Object|null} Restored state snapshot or null if stack empty
     */
    function undo(currentState) {
      if (stack.length === 0) return null;

      const previous = stack.pop();
      if (currentState) {
        currentState.board = previous.board.map(row => [...row]);
        currentState.score = previous.score;
        currentState.won = previous.won;
        currentState.over = previous.over;
      }
      return previous;
    }

    /**
     * Clears all history in the stack.
     */
    function clear() {
      stack.length = 0;
    }

    /**
     * Returns count of available undo steps.
     * @returns {number}
     */
    function getCanUndo() {
      return stack.length > 0;
    }

    function getHistoryCount() {
      return stack.length;
    }

    return {
      pushState,
      undo,
      clear,
      getCanUndo,
      getHistoryCount
    };
  }

  exports.createUndoManager = createUndoManager;
})(typeof exports === "undefined" ? (window.GameUndoManager = {}) : exports);
