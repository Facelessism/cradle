const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const turnLabel = document.getElementById("turnLabel");
const moveList = document.getElementById("moveList");
const moveCount = document.getElementById("moveCount");
const whiteCaptures = document.getElementById("whiteCaptures");
const blackCaptures = document.getElementById("blackCaptures");

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const SYMBOLS = {
  white: {
    king: "&#9812;",
    queen: "&#9813;",
    rook: "&#9814;",
    bishop: "&#9815;",
    knight: "&#9816;",
    pawn: "&#9817;",
  },
  black: {
    king: "&#9818;",
    queen: "&#9819;",
    rook: "&#9820;",
    bishop: "&#9821;",
    knight: "&#9822;",
    pawn: "&#9823;",
  },
};
const PIECE_LETTER = {
  king: "K",
  queen: "Q",
  rook: "R",
  bishop: "B",
  knight: "N",
  pawn: "",
};

let board = [];
let turn = WHITE;
let selected = null;
let legalTargets = [];
let history = [];
let redoStack = [];
let capturedByWhite = [];
let capturedByBlack = [];
let flipped = false;
let gameOver = false;
let enPassantTarget = null;
let halfMoveClock = 0;
let fullMoveNumber = 1;
let aiWorker = null;
let isComputerThinking = false;
let pendingPromotion = null;

function squareName(row, col) {
  return `${FILES[col]}${8 - row}`;
}

function orderedSquares() {
  const squares = [];
  const rows = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  rows.forEach(row => cols.forEach(col => squares.push({ row, col })));
  return squares;
}

function render() {
  boardElement.innerHTML = "";
  const legalKeys = new Set(
    legalTargets.map(move => `${move.to.row},${move.to.col}`)
  );
  const captureKeys = new Set(
    legalTargets
      .filter(move => move.capture || move.enPassant)
      .map(move => `${move.to.row},${move.to.col}`)
  );
  const checkedKing = findKing(board, turn);
  const turnInCheck =
    checkedKing &&
    isSquareAttacked(board, checkedKing.row, checkedKing.col, other(turn));

  orderedSquares().forEach(({ row, col }) => {
    const square = document.createElement("button");
    const piece = board[row][col];
    square.type = "button";
    square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
    square.dataset.row = row;
    square.dataset.col = col;
    square.setAttribute("role", "gridcell");
    square.setAttribute("aria-label", squareName(row, col));

    if (selected && selected.row === row && selected.col === col)
      square.classList.add("selected");
    if (legalKeys.has(`${row},${col}`)) square.classList.add("legal");
    if (captureKeys.has(`${row},${col}`)) square.classList.add("capture");
    if (turnInCheck && checkedKing.row === row && checkedKing.col === col)
      square.classList.add("check");

    if (piece) {
      const pieceNode = document.createElement("span");
      pieceNode.className = `piece ${piece.color}`;
      pieceNode.innerHTML = SYMBOLS[piece.color][piece.type];
      square.appendChild(pieceNode);
    }

    square.addEventListener("click", () => handleSquareClick(row, col));
    boardElement.appendChild(square);
  });

  updatePanels();
}

function updatePanels() {
  turnLabel.textContent = turn === WHITE ? "White" : "Black";
  whiteCaptures.innerHTML = capturedByWhite.length
    ? capturedByWhite.map(piece => SYMBOLS[piece.color][piece.type]).join(" ")
    : "None";
  blackCaptures.innerHTML = capturedByBlack.length
    ? capturedByBlack.map(piece => SYMBOLS[piece.color][piece.type]).join(" ")
    : "None";
  moveCount.textContent = history.length;

  let moveHtml = "";
  for (let i = 0; i < history.length; i += 2) {
    const whiteMove = history[i].notation;
    const blackMove = history[i + 1] ? history[i + 1].notation : "";

    moveHtml += `<li>`;
    moveHtml += `<span class="move-item ${i === history.length - 1 ? "active-move" : ""}">${whiteMove}</span>`;
    if (blackMove) {
      moveHtml += ` <span class="move-item ${i + 1 === history.length - 1 ? "active-move" : ""}">${blackMove}</span>`;
    }
    moveHtml += `</li>`;
  }
  moveList.innerHTML = moveHtml;

  const undoBtn = document.getElementById("undoMove");
  const redoBtn = document.getElementById("redoMove");
  if (undoBtn) undoBtn.disabled = history.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function handleSquareClick(row, col) {
  if (gameOver || isComputerThinking) return;
  const piece = board[row][col];

  if (selected) {
    const chosenMove = legalTargets.find(
      move => move.to.row === row && move.to.col === col
    );
    if (chosenMove) {
      makeMove(chosenMove);
      return;
    }
  }

  if (piece && piece.color === turn) {
    selected = { row, col };
    legalTargets = getLegalMoves(board, row, col, turn, enPassantTarget);
    setStatus(
      `${capitalize(turn)} selected ${piece.type} on ${squareName(row, col)}.`
    );
  } else {
    selected = null;
    legalTargets = [];
    setStatus(`${capitalize(turn)} to move.`);
  }

  render();
}

function makeMove(move) {
  const movingPiece = board[move.from.row][move.from.col];
  const isPromotion =
    movingPiece.type === "pawn" && (move.to.row === 0 || move.to.row === 7);

  // If this is a promotion and no piece has been chosen yet, show the modal
  if (isPromotion && !move.promoteTo) {
    showPromotionModal(move);
    return;
  }

  completeMove(move, movingPiece);
}

function showPromotionModal(move) {
  const modal = document.getElementById("promotionModal");
  const options = document.getElementById("promotionOptions");
  const movingPiece = board[move.from.row][move.from.col];
  const color = movingPiece.color;

  // Set the correct piece symbols based on the moving side's color
  const pieces = [
    { type: "queen", symbol: color === WHITE ? "♛" : "♕" },
    { type: "rook", symbol: color === WHITE ? "♜" : "♖" },
    { type: "bishop", symbol: color === WHITE ? "♝" : "♗" },
    { type: "knight", symbol: color === WHITE ? "♞" : "♘" },
  ];

  options.innerHTML = pieces
    .map(
      p =>
        `<button type="button" data-piece="${p.type}" aria-label="Promote to ${p.type}" style="color:${color === WHITE ? "#ffffff" : "#111827"}; background:${color === WHITE ? "#444" : "#ddd"};">${p.symbol}</button>`
    )
    .join("");

  // Store the pending move
  pendingPromotion = move;

  // Wire button clicks
  options.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => selectPromotion(btn.dataset.piece));
  });

  modal.classList.remove("hidden");
}

function hidePromotionModal() {
  const modal = document.getElementById("promotionModal");
  modal.classList.add("hidden");
}

function selectPromotion(pieceType) {
  hidePromotionModal();
  if (!pendingPromotion) return;

  pendingPromotion.promoteTo = pieceType;
  const move = pendingPromotion;
  pendingPromotion = null;

  // Re-enter makeMove with the promotion choice
  completeMove(move, board[move.from.row][move.from.col]);
}

function completeMove(move, movingPiece) {
  const previous = {
    board: cloneBoard(board),
    turn,
    capturedByWhite: capturedByWhite.map(piece => ({ ...piece })),
    capturedByBlack: capturedByBlack.map(piece => ({ ...piece })),
    enPassantTarget: enPassantTarget ? { ...enPassantTarget } : null,
    halfMoveClock,
    fullMoveNumber,
    notation: buildNotation(move),
  };

  const captured = move.enPassant
    ? board[move.from.row][move.to.col]
    : board[move.to.row][move.to.col];

  const wasCapture = Boolean(captured);
  const wasPawnMove = movingPiece.type === "pawn";

  applyMove(board, move, move.promoteTo);

  if (captured) {
    (movingPiece.color === WHITE ? capturedByWhite : capturedByBlack).push(
      captured
    );
  }

  enPassantTarget = null;
  if (
    movingPiece.type === "pawn" &&
    Math.abs(move.to.row - move.from.row) === 2
  ) {
    enPassantTarget = {
      row: (move.from.row + move.to.row) / 2,
      col: move.from.col,
      pawnRow: move.to.row,
      pawnCol: move.to.col,
    };
  }

  // Update half-move clock (resets on capture or pawn move, increments otherwise)
  if (wasCapture || wasPawnMove) {
    halfMoveClock = 0;
  } else {
    halfMoveClock++;
  }

  // Full-move number increments after Black's move
  if (turn === BLACK) {
    fullMoveNumber++;
  }

  // Promotion notation suffix
  if (move.promoteTo) {
    previous.notation += "=" + move.promoteTo.charAt(0).toUpperCase();
    if (move.promoteTo === "knight") {
      previous.notation = previous.notation.slice(0, -1) + "N";
    }
  }

  turn = other(turn);
  selected = null;
  legalTargets = [];
  previous.notation += stateSuffix();
  history.push(previous);
  redoStack = [];

  updateGameState();
  render();
}

function buildNotation(move) {
  const piece = board[move.from.row][move.from.col];
  if (move.castle) return move.to.col === 6 ? "O-O" : "O-O-O";

  const capture = move.capture || move.enPassant ? "x" : "";
  const prefix =
    piece.type === "pawn" && capture
      ? FILES[move.from.col]
      : PIECE_LETTER[piece.type];
  return `${prefix}${capture}${squareName(move.to.row, move.to.col)}`;
}

function stateSuffix() {
  const king = findKing(board, turn);
  if (!king || !isSquareAttacked(board, king.row, king.col, other(turn)))
    return "";
  return getAllLegalMoves(board, turn, enPassantTarget).length ? "+" : "#";
}

function updateGameState() {
  const king = findKing(board, turn);
  const inCheck =
    king && isSquareAttacked(board, king.row, king.col, other(turn));
  const moves = getAllLegalMoves(board, turn, enPassantTarget);

  if (!moves.length && inCheck) {
    gameOver = true;
    setStatus(`Checkmate. ${capitalize(other(turn))} wins.`);
    return;
  }

  if (!moves.length) {
    gameOver = true;
    setStatus("Stalemate. The game is drawn.");
    return;
  }

  setStatus(
    inCheck
      ? `${capitalize(turn)} is in check.`
      : `${capitalize(turn)} to move.`
  );
  checkTriggerAI();
}

function checkTriggerAI() {
  const mode = document.getElementById("gameMode").value;
  if (mode === "computer" && turn === BLACK && !gameOver) {
    triggerAI();
  }
}

function triggerAI() {
  isComputerThinking = true;
  const currentStatus = statusElement.textContent;
  setStatus(currentStatus + " Computer is thinking...");

  if (!aiWorker) {
    aiWorker = new Worker("ai-worker.js");
    aiWorker.onmessage = function (e) {
      isComputerThinking = false;
      const bestMove = e.data;
      if (bestMove) {
        makeMove(bestMove);
      }
    };
    aiWorker.onerror = function () {
      isComputerThinking = false;
      setStatus("AI error. Switching to manual mode.");
      document.getElementById("gameMode").value = "human";
    };
  }

  const depth = parseInt(document.getElementById("aiDifficulty").value, 10);
  aiWorker.postMessage({
    board: board,
    color: turn,
    depth: depth,
    enPassantTarget: enPassantTarget,
  });
}

function cancelAI() {
  if (aiWorker) {
    aiWorker.terminate();
    aiWorker = null;
  }
  isComputerThinking = false;
}

function undoMove() {
  cancelAI();
  const isComputerMode =
    document.getElementById("gameMode").value === "computer";

  let previous = history.pop();
  if (!previous) {
    setStatus("No moves to undo.");
    return;
  }

  let currentState = {
    board: cloneBoard(board),
    turn,
    capturedByWhite: capturedByWhite.map(piece => ({ ...piece })),
    capturedByBlack: capturedByBlack.map(piece => ({ ...piece })),
    enPassantTarget: enPassantTarget ? { ...enPassantTarget } : null,
    halfMoveClock,
    fullMoveNumber,
    notation: previous.notation,
  };
  redoStack.push(currentState);

  board = cloneBoard(previous.board);
  turn = previous.turn;
  capturedByWhite = previous.capturedByWhite.map(piece => ({ ...piece }));
  capturedByBlack = previous.capturedByBlack.map(piece => ({ ...piece }));
  enPassantTarget = previous.enPassantTarget
    ? { ...previous.enPassantTarget }
    : null;
  halfMoveClock = previous.halfMoveClock;
  fullMoveNumber = previous.fullMoveNumber;

  if (isComputerMode && turn === BLACK && history.length > 0) {
    previous = history.pop();

    currentState = {
      board: cloneBoard(board),
      turn,
      capturedByWhite: capturedByWhite.map(piece => ({ ...piece })),
      capturedByBlack: capturedByBlack.map(piece => ({ ...piece })),
      enPassantTarget: enPassantTarget ? { ...enPassantTarget } : null,
      halfMoveClock,
      fullMoveNumber,
      notation: previous.notation,
    };
    redoStack.push(currentState);

    board = cloneBoard(previous.board);
    turn = previous.turn;
    capturedByWhite = previous.capturedByWhite.map(piece => ({ ...piece }));
    capturedByBlack = previous.capturedByBlack.map(piece => ({ ...piece }));
    enPassantTarget = previous.enPassantTarget
      ? { ...previous.enPassantTarget }
      : null;
    halfMoveClock = previous.halfMoveClock;
    fullMoveNumber = previous.fullMoveNumber;
  }

  selected = null;
  legalTargets = [];
  gameOver = false;
  updateGameState();
  render();
}

function redoMove() {
  cancelAI();
  const isComputerMode =
    document.getElementById("gameMode").value === "computer";

  let next = redoStack.pop();
  if (!next) return;

  let previous = {
    board: cloneBoard(board),
    turn,
    capturedByWhite: capturedByWhite.map(piece => ({ ...piece })),
    capturedByBlack: capturedByBlack.map(piece => ({ ...piece })),
    enPassantTarget: enPassantTarget ? { ...enPassantTarget } : null,
    halfMoveClock,
    fullMoveNumber,
    notation: next.notation,
  };
  history.push(previous);

  board = cloneBoard(next.board);
  turn = next.turn;
  capturedByWhite = next.capturedByWhite.map(piece => ({ ...piece }));
  capturedByBlack = next.capturedByBlack.map(piece => ({ ...piece }));
  enPassantTarget = next.enPassantTarget ? { ...next.enPassantTarget } : null;
  halfMoveClock = next.halfMoveClock;
  fullMoveNumber = next.fullMoveNumber;

  if (isComputerMode && turn === BLACK && redoStack.length > 0) {
    next = redoStack.pop();

    previous = {
      board: cloneBoard(board),
      turn,
      capturedByWhite: capturedByWhite.map(piece => ({ ...piece })),
      capturedByBlack: capturedByBlack.map(piece => ({ ...piece })),
      enPassantTarget: enPassantTarget ? { ...enPassantTarget } : null,
      halfMoveClock,
      fullMoveNumber,
      notation: next.notation,
    };
    history.push(previous);

    board = cloneBoard(next.board);
    turn = next.turn;
    capturedByWhite = next.capturedByWhite.map(piece => ({ ...piece }));
    capturedByBlack = next.capturedByBlack.map(piece => ({ ...piece }));
    enPassantTarget = next.enPassantTarget ? { ...next.enPassantTarget } : null;
    halfMoveClock = next.halfMoveClock;
    fullMoveNumber = next.fullMoveNumber;
  }

  selected = null;
  legalTargets = [];
  gameOver = false;
  updateGameState();
  render();
}

function generatePGN() {
  let pgn = "";
  for (let i = 0; i < history.length; i += 2) {
    const turnNum = Math.floor(i / 2) + 1;
    const whiteMove = history[i].notation;
    const blackMove = history[i + 1] ? history[i + 1].notation : "";
    pgn += `${turnNum}. ${whiteMove} ${blackMove} `.trim() + " ";
  }

  let result = "*";
  if (gameOver) {
    const statusText = statusElement.textContent;
    if (statusText.includes("White wins")) result = "1-0";
    else if (statusText.includes("Black wins")) result = "0-1";
    else result = "1/2-1/2";
  }

  return pgn.trim() + " " + result;
}

function setStatus(text) {
  statusElement.textContent = text;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function newGame() {
  cancelAI();
  board = startPosition();
  turn = WHITE;
  selected = null;
  legalTargets = [];
  history = [];
  redoStack = [];
  capturedByWhite = [];
  capturedByBlack = [];
  enPassantTarget = null;
  halfMoveClock = 0;
  fullMoveNumber = 1;
  gameOver = false;
  pendingPromotion = null;
  setStatus("White to move.");
  render();
  checkTriggerAI();
}

document.getElementById("newGame").addEventListener("click", newGame);
document.getElementById("undoMove").addEventListener("click", undoMove);
document.getElementById("redoMove").addEventListener("click", redoMove);
document.getElementById("copyPGN").addEventListener("click", () => {
  const pgn = generatePGN();
  navigator.clipboard
    .writeText(pgn)
    .then(() => {
      const btn = document.getElementById("copyPGN");
      const originalText = btn.innerHTML;
      btn.innerHTML = `<span aria-hidden="true">✅</span> Copied!`;
      setTimeout(() => (btn.innerHTML = originalText), 2000);
    })
    .catch(() => {
      setStatus("Failed to copy PGN.");
    });
});
document.getElementById("flipBoard").addEventListener("click", () => {
  flipped = !flipped;
  render();
});
document.getElementById("gameMode").addEventListener("change", e => {
  const aiDiff = document.getElementById("aiDifficulty");
  if (e.target.value === "computer") {
    aiDiff.classList.remove("hidden");
  } else {
    aiDiff.classList.add("hidden");
  }
  checkTriggerAI();
});

function boardToFEN() {
  // Board position
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    let rowStr = "";
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) {
        empty++;
      } else {
        if (empty > 0) {
          rowStr += empty;
          empty = 0;
        }
        let char = piece.type === "knight" ? "n" : piece.type.charAt(0);
        rowStr +=
          piece.color === WHITE ? char.toUpperCase() : char.toLowerCase();
      }
    }
    if (empty > 0) rowStr += empty;
    rows.push(rowStr);
  }

  // Active color
  const turnChar = turn === WHITE ? "w" : "b";

  // Castling rights
  let castling = "";
  const whiteKing = board[7][4];
  if (whiteKing && whiteKing.type === "king" && !whiteKing.moved) {
    const wrKing = board[7][7];
    if (wrKing && wrKing.type === "rook" && !wrKing.moved) castling += "K";
    const wrQueen = board[7][0];
    if (wrQueen && wrQueen.type === "rook" && !wrQueen.moved) castling += "Q";
  }
  const blackKing = board[0][4];
  if (blackKing && blackKing.type === "king" && !blackKing.moved) {
    const brKing = board[0][7];
    if (brKing && brKing.type === "rook" && !brKing.moved) castling += "k";
    const brQueen = board[0][0];
    if (brQueen && brQueen.type === "rook" && !brQueen.moved) castling += "q";
  }
  if (castling === "") castling = "-";

  // En passant target square
  let epStr = "-";
  if (enPassantTarget) {
    epStr = squareName(enPassantTarget.row, enPassantTarget.col);
  }

  return `${rows.join("/")} ${turnChar} ${castling} ${epStr} ${halfMoveClock} ${fullMoveNumber}`;
}

function loadFEN(fenString) {
  try {
    const parts = fenString.trim().split(/\s+/);
    const position = parts[0];
    const activeColor = parts[1] || "w";
    const castlingPart = parts[2] || "-";
    const epPart = parts[3] || "-";
    const halfMove = parts[4] || "0";
    const fullMove = parts[5] || "1";

    const rows = position.split("/");
    if (rows.length !== 8) throw new Error("Invalid FEN row count");

    const newBoard = Array.from({ length: 8 }, () => Array(8).fill(null));
    const charToType = {
      p: "pawn",
      r: "rook",
      n: "knight",
      b: "bishop",
      q: "queen",
      k: "king",
    };

    for (let r = 0; r < 8; r++) {
      let c = 0;
      const rowStr = rows[r];
      for (let i = 0; i < rowStr.length; i++) {
        const char = rowStr[i];
        if (/[1-8]/.test(char)) {
          c += parseInt(char, 10);
        } else {
          const color = char === char.toUpperCase() ? WHITE : BLACK;
          const type = charToType[char.toLowerCase()];
          if (!type) throw new Error("Invalid FEN character: " + char);
          newBoard[r][c] = { type, color, moved: false };
          c++;
        }
      }
      if (c !== 8) throw new Error(`Row ${r} has ${c} columns instead of 8`);
    }

    // Set moved state for kings and rooks based on castling rights
    const canCastle = castlingPart !== "-";
    // White king
    if (newBoard[7][4] && newBoard[7][4].type === "king") {
      newBoard[7][4].moved = true;
    }
    // White rooks
    if (newBoard[7][0] && newBoard[7][0].type === "rook")
      newBoard[7][0].moved = true;
    if (newBoard[7][7] && newBoard[7][7].type === "rook")
      newBoard[7][7].moved = true;
    // Black king
    if (newBoard[0][4] && newBoard[0][4].type === "king") {
      newBoard[0][4].moved = true;
    }
    // Black rooks
    if (newBoard[0][0] && newBoard[0][0].type === "rook")
      newBoard[0][0].moved = true;
    if (newBoard[0][7] && newBoard[0][7].type === "rook")
      newBoard[0][7].moved = true;

    // Unmark pieces that still have castling rights
    if (canCastle) {
      if (
        castlingPart.includes("K") &&
        newBoard[7][7] &&
        newBoard[7][7].type === "rook" &&
        newBoard[7][7].color === WHITE
      ) {
        newBoard[7][7].moved = false;
        if (
          newBoard[7][4] &&
          newBoard[7][4].type === "king" &&
          newBoard[7][4].color === WHITE
        )
          newBoard[7][4].moved = false;
      }
      if (
        castlingPart.includes("Q") &&
        newBoard[7][0] &&
        newBoard[7][0].type === "rook" &&
        newBoard[7][0].color === WHITE
      ) {
        newBoard[7][0].moved = false;
        if (
          newBoard[7][4] &&
          newBoard[7][4].type === "king" &&
          newBoard[7][4].color === WHITE
        )
          newBoard[7][4].moved = false;
      }
      if (
        castlingPart.includes("k") &&
        newBoard[0][7] &&
        newBoard[0][7].type === "rook" &&
        newBoard[0][7].color === BLACK
      ) {
        newBoard[0][7].moved = false;
        if (
          newBoard[0][4] &&
          newBoard[0][4].type === "king" &&
          newBoard[0][4].color === BLACK
        )
          newBoard[0][4].moved = false;
      }
      if (
        castlingPart.includes("q") &&
        newBoard[0][0] &&
        newBoard[0][0].type === "rook" &&
        newBoard[0][0].color === BLACK
      ) {
        newBoard[0][0].moved = false;
        if (
          newBoard[0][4] &&
          newBoard[0][4].type === "king" &&
          newBoard[0][4].color === BLACK
        )
          newBoard[0][4].moved = false;
      }
    }

    // Parse en passant target
    let newEpTarget = null;
    if (epPart !== "-") {
      const epCol = FILES.indexOf(epPart[0]);
      const epRow = 8 - parseInt(epPart[1], 10);
      if (epCol >= 0 && epRow >= 0 && epRow < 8) {
        newEpTarget = {
          row: epRow,
          col: epCol,
          pawnRow: activeColor === "w" ? epRow + 1 : epRow - 1,
          pawnCol: epCol,
        };
      }
    }

    cancelAI();
    board = newBoard;
    turn = activeColor === "w" ? WHITE : BLACK;
    selected = null;
    legalTargets = [];
    history = [];
    redoStack = [];
    capturedByWhite = [];
    capturedByBlack = [];
    enPassantTarget = newEpTarget;
    halfMoveClock = parseInt(halfMove, 10);
    fullMoveNumber = parseInt(fullMove, 10);
    gameOver = false;
    pendingPromotion = null;
    setStatus(`${capitalize(turn)} to move from custom FEN position.`);
    render();
    checkTriggerAI();
    return true;
  } catch (e) {
    setStatus("Error loading FEN: " + e.message);
    return false;
  }
}

const loadFENBtn = document.getElementById("loadFEN");
if (loadFENBtn) {
  loadFENBtn.addEventListener("click", () => {
    const input = document.getElementById("fenInput").value;
    if (input) {
      loadFEN(input);
    } else {
      setStatus("Please enter a FEN string.");
    }
  });
}

const copyFENBtn = document.getElementById("copyFEN");
if (copyFENBtn) {
  copyFENBtn.addEventListener("click", () => {
    const fen = boardToFEN();
    document.getElementById("fenInput").value = fen;
    navigator.clipboard
      .writeText(fen)
      .then(() => {
        const originalText = copyFENBtn.innerHTML;
        copyFENBtn.innerHTML = `Copied!`;
        setTimeout(() => (copyFENBtn.innerHTML = originalText), 2000);
      })
      .catch(() => {
        setStatus("Failed to copy FEN.");
      });
  });
}

newGame();
