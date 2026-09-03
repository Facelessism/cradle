// Shared 2048 rules live in this module so the game logic can be tested
// independently from the UI and reused in future enhancements.
(function (root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.__2048Logic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createInitialState(size = 4, random = Math.random) {
    if (typeof size === "function") {
      random = size;
      size = 4;
    }

    const board = Array.from(
      { length: size },
      () => Array(size).fill(0)
    );

    const state = {
      board,
      score: 0,
      bestScore: 0,
      won: false,
      over: false,
      moved: false,
      size,
    };

    addRandomTile(state, random);
    addRandomTile(state, random);

    return state;
  }

  function addRandomTile(state, random = Math.random) {
    const emptyCells = [];

    state.board.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        if (value === 0) {
          emptyCells.push({
            row: rowIndex,
            col: columnIndex,
          });
        }
      });
    });

    if (!emptyCells.length) {
      return false;
    }

    const target =
      emptyCells[Math.floor(random() * emptyCells.length)];

    state.board[target.row][target.col] =
      random() < 0.9 ? 2 : 4;

    return true;
  }

  function cloneBoard(board) {
    return board.map(row => [...row]);
  }

  /**
   * Collapse one line toward its beginning.
   *
   * Tiles are processed from the side they are moving toward.
   * Each pair can merge at most once during a move.
   *
   * Examples:
   *   [2, 2, 2, 0] -> [4, 2, 0, 0]
   *   [2, 2, 2, 2] -> [4, 4, 0, 0]
   *   [4, 4, 4, 4] -> [8, 8, 0, 0]
   */
  function collapseLine(line, size = line.length) {
    const compacted = line.filter(value => value !== 0);
    const result = [];
    let scoreGain = 0;

    for (let index = 0; index < compacted.length; index += 1) {
      const current = compacted[index];
      const next = compacted[index + 1];

      if (current === next) {
        const mergedValue = current * 2;

        result.push(mergedValue);
        scoreGain += mergedValue;

        // Consume both source tiles. The newly-created tile
        // cannot merge again during the same move.
        index += 1;
      } else {
        result.push(current);
      }
    }

    while (result.length < size) {
      result.push(0);
    }

    return {
      line: result,
      scoreGain,
    };
  }

  /**
   * Move the board in a deterministic order.
   *
   * Every row or column is processed independently using the
   * same collapse rules, ensuring movement and scoring remain
   * consistent across all four directions.
   */
  function moveBoard(board, direction) {
    const rows = board.length;
    const cols = board[0].length;

    const nextBoard = Array.from(
      { length: rows },
      () => Array(cols).fill(0)
    );

    let scoreGain = 0;
    let moved = false;

    function processLine(sourceLine, originalLine) {
      const {
        line,
        scoreGain: lineScore,
      } = collapseLine(sourceLine, sourceLine.length);

      scoreGain += lineScore;

      if (line.join(",") !== originalLine.join(",")) {
        moved = true;
      }

      return line;
    }

    if (direction === "left" || direction === "right") {
      for (let row = 0; row < rows; row += 1) {
        const originalLine = [...board[row]];

        const sourceLine =
          direction === "left"
            ? [...originalLine]
            : [...originalLine].reverse();

        const collapsed = processLine(
          sourceLine,
          originalLine
        );

        const targetLine =
          direction === "left"
            ? collapsed
            : [...collapsed].reverse();

        nextBoard[row] = targetLine;
      }

      return {
        board: nextBoard,
        scoreGain,
        moved,
      };
    }

    for (let col = 0; col < cols; col += 1) {
      const originalLine = board.map(row => row[col]);

      const sourceLine =
        direction === "up"
          ? [...originalLine]
          : [...originalLine].reverse();

      const collapsed = processLine(
        sourceLine,
        originalLine
      );

      const targetLine =
        direction === "up"
          ? collapsed
          : [...collapsed].reverse();

      targetLine.forEach((value, row) => {
        nextBoard[row][col] = value;
      });
    }

    return {
      board: nextBoard,
      scoreGain,
      moved,
    };
  }

  function moveGameState(
    state,
    direction,
    random = Math.random
  ) {
    const next = {
      board: cloneBoard(state.board),
      score: state.score,
      bestScore: state.bestScore,
      won: state.won,
      over: state.over,
      moved: false,
      size: state.size || state.board.length,
    };

    const {
      board: movedBoard,
      scoreGain,
      moved,
    } = moveBoard(next.board, direction);

    next.board = movedBoard;

    // Every merge contributes its value exactly once.
    next.score += scoreGain;
    next.bestScore = Math.max(
      next.bestScore,
      next.score
    );
    next.moved = moved;

    // A new tile is added only after a successful move.
    if (moved) {
      addRandomTile(next, random);
    }

    next.won = hasWon(next.board);
    next.over = !canMove(next.board);

    return next;
  }

  function hasWon(board) {
    return board.some(row =>
      row.some(value => value >= 2048)
    );
  }

  function canMove(board) {
    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board[row].length; col += 1) {
        const value = board[row][col];

        if (value === 0) {
          return true;
        }

        const right = board[row][col + 1];
        const down = board[row + 1]?.[col];

        if (right === value || down === value) {
          return true;
        }
      }
    }

    return false;
  }

  return {
    createInitialState,
    addRandomTile,
    moveGameState,
    hasWon,
    canMove,
  };
});