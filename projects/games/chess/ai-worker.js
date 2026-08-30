importScripts("chessLogic.js");

const PIECE_VALUES = {
  pawn: 10,
  knight: 30,
  bishop: 30,
  rook: 50,
  queen: 90,
  king: 9000,
};

// Basic piece-square tables (PST) to encourage central control.
// The tables are defined from White's perspective. They are mirrored for Black.
const pstCenter = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 0, 2, 3, 3, 2, 0, 0],
  [0, 0, 2, 3, 3, 2, 0, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

let deadline = 0;
let cancelled = false;
let searching = false;
let searchId = 0;
let nodes = 0;

const DEFAULT_TIME_LIMIT = 5000;
const YIELD_INTERVAL = 500;

// --- Inbound message validation -------------------------------------------
// The search request comes from a same-origin dedicated worker URL, but we
// still verify the payload shape before acting on it (see #787).
const VALID_COLORS = new Set(["white", "black"]);

function isValidSquare(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    Number.isInteger(value.row) &&
    value.row >= 0 &&
    value.row <= 7 &&
    Number.isInteger(value.col) &&
    value.col >= 0 &&
    value.col <= 7
  );
}

function isValidBoard(board) {
  return (
    Array.isArray(board) &&
    board.length === 8 &&
    board.every(
      row =>
        Array.isArray(row) &&
        row.length === 8 &&
        row.every(
          square =>
            square === null ||
            (typeof square === "object" &&
              typeof square.type === "string" &&
              VALID_COLORS.has(square.color))
        )
    )
  );
}

function evaluateBoard(board, color) {
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];

      if (!piece) continue;

      let value = PIECE_VALUES[piece.type];

      if (piece.type !== "king" && piece.type !== "rook") {
        const pstRow = piece.color === WHITE ? r : 7 - r;
        value += pstCenter[pstRow][c];
      }

      if (piece.color === color) {
        score += value;
      } else {
        score -= value;
      }
    }
  }

  return score;
}

function shouldStop() {
  if (cancelled) {
    return "cancelled";
  }

  if (Date.now() >= deadline) {
    return "timeout";
  }

  return false;
}

function yieldToWorker() {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

async function minimax(
  board,
  depth,
  alpha,
  beta,
  isMaximizing,
  color,
  currentSearchId
) {
  const stopReason = shouldStop();

  if (stopReason) {
    return {
      value: 0,
      stopped: true,
      reason: stopReason,
    };
  }

  if (currentSearchId !== searchId) {
    return {
      value: 0,
      stopped: true,
      reason: "cancelled",
    };
  }

  nodes++;

  if (nodes % YIELD_INTERVAL === 0) {
    await yieldToWorker();

    const yieldStopReason = shouldStop();

    if (yieldStopReason) {
      return {
        value: 0,
        stopped: true,
        reason: yieldStopReason,
      };
    }
  }

  if (depth === 0) {
    return {
      value: evaluateBoard(board, color),
      stopped: false,
      reason: null,
    };
  }

  const turnColor = isMaximizing ? color : other(color);
  const moves = getAllLegalMoves(board, turnColor, null);

  if (moves.length === 0) {
    const king = findKing(board, turnColor);

    if (king && isSquareAttacked(board, king.row, king.col, other(turnColor))) {
      return {
        value: isMaximizing ? -Infinity : Infinity,
        stopped: false,
        reason: null,
      };
    }

    return {
      value: 0,
      stopped: false,
      reason: null,
    };
  }

  if (isMaximizing) {
    let maxEval = -Infinity;

    for (const move of moves) {
      const stopReasonBeforeMove = shouldStop();

      if (stopReasonBeforeMove) {
        return {
          value: 0,
          stopped: true,
          reason: stopReasonBeforeMove,
        };
      }

      const copy = cloneBoard(board);
      applyMove(copy, move);

      const result = await minimax(
        copy,
        depth - 1,
        alpha,
        beta,
        false,
        color,
        currentSearchId
      );

      if (result.stopped) {
        return result;
      }

      maxEval = Math.max(maxEval, result.value);
      alpha = Math.max(alpha, result.value);

      if (beta <= alpha) {
        break;
      }
    }

    return {
      value: maxEval,
      stopped: false,
      reason: null,
    };
  }

  let minEval = Infinity;

  for (const move of moves) {
    const stopReasonBeforeMove = shouldStop();

    if (stopReasonBeforeMove) {
      return {
        value: 0,
        stopped: true,
        reason: stopReasonBeforeMove,
      };
    }

    const copy = cloneBoard(board);
    applyMove(copy, move);

    const result = await minimax(
      copy,
      depth - 1,
      alpha,
      beta,
      true,
      color,
      currentSearchId
    );

    if (result.stopped) {
      return result;
    }

    minEval = Math.min(minEval, result.value);
    beta = Math.min(beta, result.value);

    if (beta <= alpha) {
      break;
    }
  }

  return {
    value: minEval,
    stopped: false,
    reason: null,
  };
}

async function searchBestMove(
  board,
  color,
  maxDepth,
  enPassantTarget,
  timeLimit,
  currentSearchId
) {
  deadline = Date.now() + timeLimit;
  cancelled = false;
  searching = true;
  nodes = 0;

  const moves = getAllLegalMoves(board, color, enPassantTarget);

  if (moves.length === 0) {
    searching = false;

    postMessage({
      type: "complete",
      move: null,
      depth: 0,
      nodes,
    });

    return;
  }

  moves.sort(() => Math.random() - 0.5);

  let bestMove = null;
  let bestValue = -Infinity;
  let completedDepth = 0;

  // Iterative deepening ensures that a valid move is available even
  // when the time limit expires during a deeper search.
  for (let depth = 1; depth <= maxDepth; depth++) {
    const stopReason = shouldStop();

    if (stopReason) {
      break;
    }

    let depthBestMove = null;
    let depthBestValue = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    for (let i = 0; i < moves.length; i++) {
      const currentStopReason = shouldStop();

      if (currentStopReason) {
        searching = false;

        postMessage({
          type: currentStopReason,
          move: bestMove,
          depth: completedDepth,
          nodes,
        });

        return;
      }

      const move = moves[i];
      const copy = cloneBoard(board);
      applyMove(copy, move);

      const result = await minimax(
        copy,
        depth - 1,
        alpha,
        beta,
        false,
        color,
        currentSearchId
      );

      if (result.stopped) {
        searching = false;

        postMessage({
          type: result.reason,
          move: bestMove,
          depth: completedDepth,
          nodes,
        });

        return;
      }

      if (result.value > depthBestValue) {
        depthBestValue = result.value;
        depthBestMove = move;
      }

      alpha = Math.max(alpha, result.value);

      postMessage({
        type: "progress",
        depth,
        maxDepth,
        completed: i + 1,
        total: moves.length,
        nodes,
      });

      if (nodes % YIELD_INTERVAL === 0) {
        await yieldToWorker();
      }
    }

    // Only accept a depth result when the entire depth completed.
    if (depthBestMove) {
      bestMove = depthBestMove;
      bestValue = depthBestValue;
      completedDepth = depth;

      postMessage({
        type: "depthComplete",
        depth,
        maxDepth,
        move: bestMove,
        score: bestValue,
        nodes,
      });
    }
  }

  searching = false;

  const finalStopReason = shouldStop();

  if (finalStopReason === "cancelled") {
    postMessage({
      type: "cancelled",
      move: bestMove,
      depth: completedDepth,
      nodes,
    });
    return;
  }

  if (finalStopReason === "timeout") {
    postMessage({
      type: "timeout",
      move: bestMove,
      depth: completedDepth,
      nodes,
    });
    return;
  }

  postMessage({
    type: "complete",
    move: bestMove,
    depth: completedDepth,
    nodes,
  });
}

onmessage = function (event) {
  const data = event.data || {};

  // Cancellation is now actually handled because the search periodically
  // yields back to the worker event loop.
  if (data.type === "cancel") {
    cancelled = true;
    searchId++;

    postMessage({
      type: "cancelled",
      move: null,
      depth: 0,
      nodes,
    });

    return;
  }

  if (data.type !== "search") {
    return;
  }

  if (searching) {
    cancelled = true;
    searchId++;
  }

  const currentSearchId = ++searchId;

  const {
    board,
    color,
    depth = 3,
    enPassantTarget = null,
    timeLimit = DEFAULT_TIME_LIMIT,
  } = data;

  if (!isValidBoard(board)) {
    postMessage({
      type: "error",
      message: "Invalid board data.",
    });
    return;
  }

  if (!VALID_COLORS.has(color)) {
    postMessage({
      type: "error",
      message: "Invalid player color.",
    });
    return;
  }

  if (
    enPassantTarget !== null &&
    enPassantTarget !== undefined &&
    !isValidSquare(enPassantTarget)
  ) {
    postMessage({
      type: "error",
      message: "Invalid en passant target.",
    });
    return;
  }

  const parsedDepth = Number.parseInt(depth, 10);
  const parsedTimeLimit = Number.parseInt(timeLimit, 10);

  if (!Number.isInteger(parsedDepth) || parsedDepth < 1) {
    postMessage({
      type: "error",
      message: "Invalid search depth.",
    });
    return;
  }

  if (!Number.isInteger(parsedTimeLimit) || parsedTimeLimit < 1) {
    postMessage({
      type: "error",
      message: "Invalid time limit.",
    });
    return;
  }

  searchBestMove(
    board,
    color,
    parsedDepth,
    enPassantTarget,
    parsedTimeLimit,
    currentSearchId
  ).catch(error => {
    searching = false;

    postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  });
};
