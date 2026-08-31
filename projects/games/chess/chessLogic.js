const WHITE = "white";
const BLACK = "black";

function createPiece(type, color) {
  return { type, color, moved: false };
}

function startPosition() {
  const empty = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank = [
    "rook",
    "knight",
    "bishop",
    "queen",
    "king",
    "bishop",
    "knight",
    "rook",
  ];

  for (let col = 0; col < 8; col++) {
    empty[0][col] = createPiece(backRank[col], BLACK);
    empty[1][col] = createPiece("pawn", BLACK);
    empty[6][col] = createPiece("pawn", WHITE);
    empty[7][col] = createPiece(backRank[col], WHITE);
  }

  return empty;
}

function cloneBoard(source) {
  return source.map(row => row.map(piece => (piece ? { ...piece } : null)));
}

function inside(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function other(color) {
  return color === WHITE ? BLACK : WHITE;
}

function getLegalMoves(position, row, col, color, epTarget) {
  return getPseudoMoves(position, row, col, epTarget).filter(move => {
    const copy = cloneBoard(position);
    applyMove(copy, move);
    const king = findKing(copy, color);
    return king && !isSquareAttacked(copy, king.row, king.col, other(color));
  });
}

function getAllLegalMoves(position, color, epTarget) {
  const moves = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = position[row][col];
      if (piece && piece.color === color) {
        moves.push(...getLegalMoves(position, row, col, color, epTarget));
      }
    }
  }
  return moves;
}

function getPseudoMoves(position, row, col, epTarget) {
  const piece = position[row][col];
  if (!piece) return [];

  if (piece.type === "pawn")
    return pawnMoves(position, row, col, piece, epTarget);
  if (piece.type === "knight")
    return stepMoves(position, row, col, piece, [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ]);
  if (piece.type === "king") return kingMoves(position, row, col, piece);
  if (piece.type === "bishop")
    return slideMoves(position, row, col, piece, [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]);
  if (piece.type === "rook")
    return slideMoves(position, row, col, piece, [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]);
  if (piece.type === "queen")
    return slideMoves(position, row, col, piece, [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]);
  return [];
}

function pawnMoves(position, row, col, piece, epTarget) {
  const moves = [];
  const dir = piece.color === WHITE ? -1 : 1;
  const start = piece.color === WHITE ? 6 : 1;
  const one = row + dir;
  const two = row + dir * 2;

  if (inside(one, col) && !position[one][col]) {
    moves.push(move(row, col, one, col));
    if (row === start && !position[two][col])
      moves.push(move(row, col, two, col));
  }

  [-1, 1].forEach(offset => {
    const targetCol = col + offset;
    if (!inside(one, targetCol)) return;

    const target = position[one][targetCol];
    if (target && target.color !== piece.color) {
      moves.push(move(row, col, one, targetCol, { capture: true }));
    }

    if (epTarget && epTarget.row === one && epTarget.col === targetCol) {
      moves.push(
        move(row, col, one, targetCol, { enPassant: true, capture: true })
      );
    }
  });

  return moves;
}

function stepMoves(position, row, col, piece, offsets) {
  return offsets.reduce((moves, [dr, dc]) => {
    const targetRow = row + dr;
    const targetCol = col + dc;
    if (!inside(targetRow, targetCol)) return moves;

    const target = position[targetRow][targetCol];
    if (!target || target.color !== piece.color) {
      moves.push(
        move(row, col, targetRow, targetCol, { capture: Boolean(target) })
      );
    }
    return moves;
  }, []);
}

function slideMoves(position, row, col, piece, directions) {
  const moves = [];
  directions.forEach(([dr, dc]) => {
    let targetRow = row + dr;
    let targetCol = col + dc;

    while (inside(targetRow, targetCol)) {
      const target = position[targetRow][targetCol];
      if (!target) {
        moves.push(move(row, col, targetRow, targetCol));
      } else {
        if (target.color !== piece.color)
          moves.push(move(row, col, targetRow, targetCol, { capture: true }));
        break;
      }
      targetRow += dr;
      targetCol += dc;
    }
  });
  return moves;
}

function kingMoves(position, row, col, piece) {
  const moves = stepMoves(position, row, col, piece, [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ]);
  if (piece.moved || isSquareAttacked(position, row, col, other(piece.color)))
    return moves;

  const rank = piece.color === WHITE ? 7 : 0;
  addCastle(position, moves, rank, 4, 7, 6, 5, piece.color);
  addCastle(position, moves, rank, 4, 0, 2, 3, piece.color);
  return moves;
}

function addCastle(
  position,
  moves,
  rank,
  kingCol,
  rookCol,
  targetCol,
  passCol,
  color
) {
  const rook = position[rank][rookCol];
  const between = rookCol === 7 ? [5, 6] : [1, 2, 3];
  if (!rook || rook.type !== "rook" || rook.color !== color || rook.moved)
    return;
  if (between.some(col => position[rank][col])) return;
  if (
    isSquareAttacked(position, rank, passCol, other(color)) ||
    isSquareAttacked(position, rank, targetCol, other(color))
  )
    return;
  moves.push(
    move(rank, kingCol, rank, targetCol, {
      castle: rookCol === 7 ? "king" : "queen",
    })
  );
}

function move(fromRow, fromCol, toRow, toCol, extras = {}) {
  return {
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
    ...extras,
  };
}

function applyMove(position, chosenMove, promoteTo) {
  const piece = position[chosenMove.from.row][chosenMove.from.col];
  position[chosenMove.from.row][chosenMove.from.col] = null;

  if (chosenMove.enPassant) {
    position[chosenMove.from.row][chosenMove.to.col] = null;
  }

  if (chosenMove.castle) {
    const rank = chosenMove.from.row;
    if (chosenMove.castle === "king") {
      position[rank][5] = position[rank][7];
      position[rank][7] = null;
      position[rank][5].moved = true;
    } else {
      position[rank][3] = position[rank][0];
      position[rank][0] = null;
      position[rank][3].moved = true;
    }
  }

  let newPiece = { ...piece, moved: true };
  if (
    piece.type === "pawn" &&
    (chosenMove.to.row === 0 || chosenMove.to.row === 7)
  ) {
    newPiece.type = promoteTo || "queen";
  }

  position[chosenMove.to.row][chosenMove.to.col] = newPiece;
}

function findKing(position, color) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = position[row][col];
      if (piece && piece.type === "king" && piece.color === color)
        return { row, col };
    }
  }
  return null;
}

function isSquareAttacked(position, row, col, byColor) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = position[r][c];
      if (!piece || piece.color !== byColor) continue;
      if (attacksSquare(position, r, c, row, col)) return true;
    }
  }
  return false;
}

function attacksSquare(position, fromRow, fromCol, targetRow, targetCol) {
  const piece = position[fromRow][fromCol];
  const dr = targetRow - fromRow;
  const dc = targetCol - fromCol;

  if (piece.type === "pawn") {
    const dir = piece.color === WHITE ? -1 : 1;
    return dr === dir && Math.abs(dc) === 1;
  }

  if (piece.type === "knight") {
    return (
      (Math.abs(dr) === 2 && Math.abs(dc) === 1) ||
      (Math.abs(dr) === 1 && Math.abs(dc) === 2)
    );
  }

  if (piece.type === "king") {
    return Math.max(Math.abs(dr), Math.abs(dc)) === 1;
  }

  const diagonal = Math.abs(dr) === Math.abs(dc);
  const straight = dr === 0 || dc === 0;
  if (piece.type === "bishop" && !diagonal) return false;
  if (piece.type === "rook" && !straight) return false;
  if (piece.type === "queen" && !diagonal && !straight) return false;

  const stepRow = Math.sign(dr);
  const stepCol = Math.sign(dc);
  let row = fromRow + stepRow;
  let col = fromCol + stepCol;
  while (row !== targetRow || col !== targetCol) {
    if (position[row][col]) return false;
    row += stepRow;
    col += stepCol;
  }
  return true;
}

/**
 * Detect prototype-pollution keys (`__proto__`, `constructor`, `prototype`)
 * anywhere in an acyclic object graph. Worker messages are structured-cloned
 * and acyclic, so recursion is bounded. Used by both the page and the worker
 * at the message boundary to reject poisoned payloads before any state merge.
 */
function hasDangerousKeys(value) {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some(hasDangerousKeys);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "string" && /^(?:__proto__|constructor|prototype)$/.test(key)) {
      return true;
    }
    const child = value[key];
    if (typeof child === "object" && child !== null && hasDangerousKeys(child)) {
      return true;
    }
  }
  return false;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    WHITE,
    BLACK,
    createPiece,
    startPosition,
    cloneBoard,
    inside,
    other,
    getLegalMoves,
    getAllLegalMoves,
    getPseudoMoves,
    applyMove,
    findKing,
    isSquareAttacked,
    hasDangerousKeys,
  };
}
