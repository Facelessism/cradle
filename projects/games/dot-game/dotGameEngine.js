function createBoard(size) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({
      owner: null,
      dots: 0,
    }))
  );
}

function getCapacity(row, col, boardSize) {
  const last = boardSize - 1;

  const edges =
    (row === 0) +
    (row === last) +
    (col === 0) +
    (col === last);

  return edges === 2 ? 2 : edges === 1 ? 3 : 4;
}

function hasPieces(board, player) {
  return board.some(row =>
    row.some(cell => cell.owner === player)
  );
}

function getRandomMove(board, player) {
  const validMoves = [];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const cell = board[row][col];

      if (!cell.owner || cell.owner === player) {
        validMoves.push({
          r: row,
          c: col,
        });
      }
    }
  }

  if (validMoves.length === 0) {
    return null;
  }

  return validMoves[Math.floor(Math.random() * validMoves.length)];
}

function getValidMoves(board, player) {
  const validMoves = [];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const cell = board[row][col];

      if (!cell.owner || cell.owner === player) {
        validMoves.push({
          r: row,
          c: col,
        });
      }
    }
  }

  return validMoves;
}

(function (root) {
  const api = {
    createBoard,
    getCapacity,
    hasPieces,
    getRandomMove,
    getValidMoves,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.DotGameEngine = api;
})(typeof self !== "undefined" ? self : this);