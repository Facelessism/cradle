const test = require("node:test");

const assert = require("node:assert/strict");

const {
  WHITE,
  BLACK,
  createPiece,
  startPosition,
  cloneBoard,
  getLegalMoves,
  getAllLegalMoves,
  applyMove,
  findKing,
  isSquareAttacked,
} = require("../projects/games/chess/chessLogic");

/* ──── Helper: create a board from a FEN-like position string ─────── */

// Uses only the board position part (rank 0 = black back rank).

function boardFromRanks(ranks) {
  const charToType = {
    p: "pawn",
    r: "rook",
    n: "knight",
    b: "bishop",
    q: "queen",
    k: "king",
  };

  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  ranks.forEach((rowStr, r) => {
    let c = 0;

    for (const ch of rowStr) {
      if (/[1-8]/.test(ch)) {
        c += parseInt(ch, 10);
        continue;
      }

      const color = ch === ch.toUpperCase() ? WHITE : BLACK;

      board[r][c] = {
        type: charToType[ch.toLowerCase()],
        color,
        moved: false,
      };

      c++;
    }
  });

  return board;
}

test("starts with a standard chess layout", () => {
  const board = startPosition();

  assert.equal(board.length, 8);
  assert.equal(board[0].length, 8);

  // Check black pieces on rank 0
  assert.equal(board[0][0].type, "rook");
  assert.equal(board[0][0].color, BLACK);
  assert.equal(board[0][4].type, "king");
  assert.equal(board[0][4].color, BLACK);

  // Check white pieces on rank 7
  assert.equal(board[7][4].type, "king");
  assert.equal(board[7][4].color, WHITE);
});

test("detects king position", () => {
  const board = startPosition();

  const whiteKing = findKing(board, WHITE);
  assert.deepStrictEqual(whiteKing, { row: 7, col: 4 });

  const blackKing = findKing(board, BLACK);
  assert.deepStrictEqual(blackKing, { row: 0, col: 4 });
});

test("pawn has two legal moves at starting rank and one after moving", () => {
  const board = startPosition();

  // White pawn at (6, 4) i.e. e2
  const moves = getLegalMoves(board, 6, 4, WHITE, null);

  assert.equal(moves.length, 2); // e3, e4

  // Make move e2e3
  const move = moves.find(m => m.to.row === 5 && m.to.col === 4);

  assert.ok(move);

  applyMove(board, move);

  // Pawn at e3 should only have 1 move forward (e4) if path is clear
  const newMoves = getLegalMoves(board, 5, 4, WHITE, null);

  assert.equal(newMoves.length, 1);
});

test("detects checkmate scenario", () => {
  // Create an empty board
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  board[0][4] = createPiece("king", BLACK);
  board[7][4] = createPiece("king", WHITE);

  // Black king at (0,0). Covered by White Queen at (0,1).
  // White King at (1,2) protecting the Queen.
  const customBoard = Array.from({ length: 8 }, () => Array(8).fill(null));

  customBoard[0][0] = createPiece("king", BLACK);
  customBoard[0][1] = createPiece("queen", WHITE);
  customBoard[1][2] = createPiece("king", WHITE);

  const kingPos = findKing(customBoard, BLACK);

  const inCheck = isSquareAttacked(
    customBoard,
    kingPos.row,
    kingPos.col,
    WHITE
  );

  assert.equal(inCheck, true);

  const blackMoves = getAllLegalMoves(customBoard, BLACK, null);

  assert.equal(blackMoves.length, 0); // Checkmate!
});

/* ──── Pawn Promotion Tests ───────────────────────────────────────── */

test("applyMove promotes pawn to queen by default", () => {
  const board = boardFromRanks([
    "........", // rank 8
    "........", // rank 7
    "........",
    "........",
    "........",
    "........",
    "PPPPPPPP", // rank 2 (row 6)
    "........", // rank 1
  ]);

  // White pawn at row 1 (rank 2), col 0 → row 0 (rank 1)
  board[1][0] = createPiece("pawn", WHITE);

  const move = {
    from: { row: 1, col: 0 },
    to: { row: 0, col: 0 },
  };

  applyMove(board, move);

  const promoted = board[0][0];

  assert.equal(promoted.type, "queen");
  assert.equal(promoted.color, WHITE);
  assert.equal(promoted.moved, true);
  assert.equal(board[1][0], null); // original square cleared
});

test("applyMove promotes pawn to knight with promoteTo parameter", () => {
  const board = boardFromRanks([
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
    "PPPPPPPP",
    "........",
  ]);

  board[1][1] = createPiece("pawn", WHITE);

  const move = {
    from: { row: 1, col: 1 },
    to: { row: 0, col: 1 },
  };

  applyMove(board, move, "knight");

  assert.equal(board[0][1].type, "knight");
  assert.equal(board[0][1].color, WHITE);
});

test("applyMove promotes pawn to rook with promoteTo parameter", () => {
  const board = boardFromRanks([
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
    "PPPPPPPP",
    "........",
  ]);

  board[1][2] = createPiece("pawn", WHITE);

  const move = {
    from: { row: 1, col: 2 },
    to: { row: 0, col: 2 },
  };

  applyMove(board, move, "rook");

  assert.equal(board[0][2].type, "rook");
});

test("applyMove promotes pawn to bishop with promoteTo parameter", () => {
  const board = boardFromRanks([
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
    "PPPPPPPP",
    "........",
  ]);

  board[1][3] = createPiece("pawn", WHITE);

  const move = {
    from: { row: 1, col: 3 },
    to: { row: 0, col: 3 },
  };

  applyMove(board, move, "bishop");

  assert.equal(board[0][3].type, "bishop");
});

test("applyMove promotes black pawn to queen by default", () => {
  const board = boardFromRanks([
    "........",
    "pppppppp",
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
  ]);

  // Black pawn at row 6 (rank 7), col 0 → row 7 (rank 8)
  board[6][0] = createPiece("pawn", BLACK);

  const move = {
    from: { row: 6, col: 0 },
    to: { row: 7, col: 0 },
  };

  applyMove(board, move);

  assert.equal(board[7][0].type, "queen");
  assert.equal(board[7][0].color, BLACK);
  assert.equal(board[6][0], null);
});

test("applyMove promotes black pawn to knight", () => {
  const board = boardFromRanks([
    "........",
    "pppppppp",
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
  ]);

  board[6][7] = createPiece("pawn", BLACK);

  const move = {
    from: { row: 6, col: 7 },
    to: { row: 7, col: 7 },
  };

  applyMove(board, move, "knight");

  assert.equal(board[7][7].type, "knight");
  assert.equal(board[7][7].color, BLACK);
});

test("applyMove does not promote a non-pawn piece", () => {
  const board = boardFromRanks([
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
    "........",
  ]);

  board[1][0] = createPiece("queen", WHITE);
  board[0][0] = createPiece("king", BLACK);

  const move = {
    from: { row: 1, col: 0 },
    to: { row: 0, col: 0 },
    capture: true,
  };

  applyMove(board, move, "knight"); // promoteTo should be ignored for non-pawn

  assert.equal(board[0][0].type, "queen"); // stays queen, not converted to knight
  assert.equal(board[0][0].color, WHITE);
});