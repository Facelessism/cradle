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

let activeCanvasWidth = 0;
let activeCanvasHeight = 0;

function setCanvasDimensions(width, height) {
  const safeWidth = typeof width === "number" && !isNaN(width) && width >= 0 ? width : 0;
  const safeHeight = typeof height === "number" && !isNaN(height) && height >= 0 ? height : 0;

  activeCanvasWidth = safeWidth;
  activeCanvasHeight = safeHeight;

  return {
    width: safeWidth,
    height: safeHeight,
    minX: 0,
    maxX: safeWidth,
    minY: 0,
    maxY: safeHeight,
  };
}

function getCanvasDimensions() {
  return {
    width: activeCanvasWidth,
    height: activeCanvasHeight,
  };
}

function validateCoordinates(x, y, width = activeCanvasWidth, height = activeCanvasHeight) {
  let posX = x;
  let posY = y;

  if (typeof x === "object" && x !== null) {
    const obj = x;
    width = typeof y === "number" ? y : width;
    height = typeof arguments[2] === "number" ? arguments[2] : height;

    if (typeof obj.x === "number") posX = obj.x;
    else if (typeof obj.col === "number") posX = obj.col;
    else if (typeof obj.c === "number") posX = obj.c;

    if (typeof obj.y === "number") posY = obj.y;
    else if (typeof obj.row === "number") posY = obj.row;
    else if (typeof obj.r === "number") posY = obj.r;
  }

  const safeWidth = typeof width === "number" && !isNaN(width) && width >= 0 ? width : 0;
  const safeHeight = typeof height === "number" && !isNaN(height) && height >= 0 ? height : 0;

  if (typeof posX !== "number" || isNaN(posX) || typeof posY !== "number" || isNaN(posY)) {
    return false;
  }

  return posX >= 0 && posX <= safeWidth && posY >= 0 && posY <= safeHeight;
}

function clampCoordinates(x, y, width = activeCanvasWidth, height = activeCanvasHeight) {
  let isObj = false;
  let originalObj = null;
  let posX = x;
  let posY = y;

  if (typeof x === "object" && x !== null) {
    isObj = true;
    originalObj = x;
    width = typeof y === "number" ? y : width;
    height = typeof arguments[2] === "number" ? arguments[2] : height;

    if (typeof x.x === "number") posX = x.x;
    else if (typeof x.col === "number") posX = x.col;
    else if (typeof x.c === "number") posX = x.c;

    if (typeof x.y === "number") posY = x.y;
    else if (typeof x.row === "number") posY = x.row;
    else if (typeof x.r === "number") posY = x.r;
  }

  const safeWidth = typeof width === "number" && !isNaN(width) && width >= 0 ? width : 0;
  const safeHeight = typeof height === "number" && !isNaN(height) && height >= 0 ? height : 0;

  let clampedX = typeof posX === "number" && !isNaN(posX) ? posX : 0;
  let clampedY = typeof posY === "number" && !isNaN(posY) ? posY : 0;

  clampedX = Math.max(0, Math.min(safeWidth, clampedX));
  clampedY = Math.max(0, Math.min(safeHeight, clampedY));

  if (isObj) {
    const res = { ...originalObj };
    if ("x" in originalObj || (!("col" in originalObj) && !("c" in originalObj))) res.x = clampedX;
    if ("y" in originalObj || (!("row" in originalObj) && !("r" in originalObj))) res.y = clampedY;
    if ("col" in originalObj) res.col = clampedX;
    if ("row" in originalObj) res.row = clampedY;
    if ("c" in originalObj) res.c = clampedX;
    if ("r" in originalObj) res.r = clampedY;
    return res;
  }

  return { x: clampedX, y: clampedY };
}

function clampDots(dots, width = activeCanvasWidth, height = activeCanvasHeight) {
  if (!Array.isArray(dots)) return [];
  return dots.map(dot => clampCoordinates(dot, width, height));
}

function recomputeBounds(width, height, dots = null) {
  const bounds = setCanvasDimensions(width, height);
  if (Array.isArray(dots)) {
    const clampedDots = clampDots(dots, bounds.width, bounds.height);
    return { bounds, dots: clampedDots };
  }
  return { bounds };
}

(function (root) {
  const api = {
    createBoard,
    getCapacity,
    hasPieces,
    getRandomMove,
    getValidMoves,
    setCanvasDimensions,
    getCanvasDimensions,
    validateCoordinates,
    clampCoordinates,
    clampDots,
    recomputeBounds,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.DotGameEngine = api;
})(typeof self !== "undefined" ? self : this);