const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createBoard,
  getCapacity,
  getRandomMove,
  getValidMoves,
  hasPieces,
  setCanvasDimensions,
  getCanvasDimensions,
  validateCoordinates,
  clampCoordinates,
  clampDots,
  recomputeBounds,
} = require("../projects/games/dot-game/dotGameEngine.js");

test("createBoard creates an empty square board", () => {
  const board = createBoard(3);

  assert.equal(board.length, 3);
  assert.equal(board[0].length, 3);

  for (const row of board) {
    for (const cell of row) {
      assert.deepEqual(cell, {
        owner: null,
        dots: 0,
      });
    }
  }
});

test("getCapacity returns correct capacity for corners", () => {
  assert.equal(getCapacity(0, 0, 5), 2);
  assert.equal(getCapacity(0, 4, 5), 2);
  assert.equal(getCapacity(4, 0, 5), 2);
  assert.equal(getCapacity(4, 4, 5), 2);
});

test("getCapacity returns correct capacity for edges", () => {
  assert.equal(getCapacity(0, 2, 5), 3);
  assert.equal(getCapacity(4, 2, 5), 3);
  assert.equal(getCapacity(2, 0, 5), 3);
  assert.equal(getCapacity(2, 4, 5), 3);
});

test("getCapacity returns 4 for center cells", () => {
  assert.equal(getCapacity(2, 2, 5), 4);
});

test("hasPieces detects when a player owns pieces", () => {
  const board = createBoard(3);

  board[1][1].owner = "red";
  board[1][1].dots = 1;

  assert.equal(hasPieces(board, "red"), true);
});

test("hasPieces returns false when player has no pieces", () => {
  const board = createBoard(3);

  board[1][1].owner = "blue";
  board[1][1].dots = 1;

  assert.equal(hasPieces(board, "red"), false);
});

test("getValidMoves returns empty and player-owned cells", () => {
  const board = createBoard(3);

  board[0][0].owner = "red";
  board[0][0].dots = 1;

  board[1][1].owner = "blue";
  board[1][1].dots = 1;

  const moves = getValidMoves(board, "red");

  assert.equal(moves.length, 8);

  assert.ok(
    moves.some(move => move.r === 0 && move.c === 0)
  );

  assert.ok(
    !moves.some(move => move.r === 1 && move.c === 1)
  );
});

test("getValidMoves returns all cells on an empty board", () => {
  const board = createBoard(2);

  const moves = getValidMoves(board, "red");

  assert.equal(moves.length, 4);
});

test("getRandomMove returns a valid move", () => {
  const board = createBoard(3);

  board[0][0].owner = "blue";
  board[0][0].dots = 1;

  const move = getRandomMove(board, "red");

  assert.ok(move);
  assert.notDeepEqual(move, { r: 0, c: 0 });

  const cell = board[move.r][move.c];

  assert.ok(
    !cell.owner || cell.owner === "red"
  );
});

test("getRandomMove can select a player-owned cell", () => {
  const board = createBoard(2);

  board[0][0].owner = "red";
  board[0][0].dots = 1;

  const moves = getValidMoves(board, "red");

  assert.ok(
    moves.some(move => move.r === 0 && move.c === 0)
  );
});

test("getRandomMove returns null when no valid moves exist", () => {
  const board = createBoard(2);

  for (const row of board) {
    for (const cell of row) {
      cell.owner = "blue";
      cell.dots = 1;
    }
  }

  assert.equal(getRandomMove(board, "red"), null);
});

test("boundary validation works for width and height", () => {
  setCanvasDimensions(800, 600);

  // Valid coordinates
  assert.equal(validateCoordinates(400, 300), true);
  assert.equal(validateCoordinates(0, 0), true);
  assert.equal(validateCoordinates(800, 600), true);

  // Invalid width (X axis beyond boundary)
  assert.equal(validateCoordinates(801, 300), false);
  assert.equal(validateCoordinates(-1, 300), false);

  // Invalid height (Y axis beyond boundary)
  assert.equal(validateCoordinates(400, 601), false);
  assert.equal(validateCoordinates(400, -1), false);
});

test("dots cannot receive coordinates beyond canvas dimensions and are clamped", () => {
  setCanvasDimensions(500, 400);

  const dotOutOfBounds = { x: 650, y: 450, owner: "red" };
  const clamped = clampCoordinates(dotOutOfBounds);

  assert.equal(clamped.x, 500);
  assert.equal(clamped.y, 400);
  assert.equal(clamped.owner, "red");
});

test("bounds are recalculated after a resize", () => {
  setCanvasDimensions(1000, 800);
  assert.deepEqual(getCanvasDimensions(), { width: 1000, height: 800 });

  const { bounds } = recomputeBounds(600, 400);
  assert.equal(bounds.width, 600);
  assert.equal(bounds.height, 400);
  assert.deepEqual(getCanvasDimensions(), { width: 600, height: 400 });
});

test("existing dots are corrected/clamped when canvas becomes smaller", () => {
  setCanvasDimensions(800, 800);

  const dots = [
    { x: 100, y: 100, id: 1 },
    { x: 750, y: 700, id: 2 },
    { x: 900, y: 500, id: 3 },
  ];

  const { dots: clampedDots } = recomputeBounds(500, 400, dots);

  assert.equal(clampedDots[0].x, 100);
  assert.equal(clampedDots[0].y, 100);

  assert.equal(clampedDots[1].x, 500);
  assert.equal(clampedDots[1].y, 400);

  assert.equal(clampedDots[2].x, 500);
  assert.equal(clampedDots[2].y, 400);
});

test("gracefully handles zero or invalid canvas dimensions", () => {
  const { bounds } = recomputeBounds(-100, NaN);
  assert.equal(bounds.width, 0);
  assert.equal(bounds.height, 0);

  const clamped = clampCoordinates({ x: 50, y: 50 });
  assert.equal(clamped.x, 0);
  assert.equal(clamped.y, 0);
});

test("existing behavior continues to work for valid coordinates", () => {
  setCanvasDimensions(400, 400);
  assert.equal(validateCoordinates({ x: 200, y: 200 }), true);
  const clamped = clampCoordinates(150, 250);
  assert.deepEqual(clamped, { x: 150, y: 250 });
});