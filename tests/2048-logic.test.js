const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createInitialState,
  moveGameState,
  hasWon,
  canMove,
} = require("../projects/games/2048-game/logic");

test("merges tiles to the left and awards score", () => {
  const state = {
    board: [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    score: 0,
    won: false,
    over: false,
    moved: false,
  };

  const next = moveGameState(state, "left", () => 0.5);

  assert.deepStrictEqual(next.board[0], [4, 0, 0, 0]);
  assert.equal(next.score, 4);
  assert.equal(next.moved, true);
});

test("does not merge the same tile twice in one move", () => {
  const state = {
    board: [
      [2, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    score: 0,
    won: false,
    over: false,
    moved: false,
  };

  const next = moveGameState(state, "left", () => 0.5);

  assert.deepStrictEqual(next.board[0], [4, 2, 0, 0]);
  assert.equal(next.score, 4);
});

test("merges four identical tiles deterministically", () => {
  const state = {
    board: [
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    score: 0,
    won: false,
    over: false,
    moved: false,
  };

  const next = moveGameState(state, "left", () => 0.5);

  assert.deepStrictEqual(next.board[0], [4, 4, 0, 0]);
  assert.equal(next.score, 8);
});

test("handles separated matching tiles at the boundary", () => {
  const state = {
    board: [
      [2, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    score: 0,
    won: false,
    over: false,
    moved: false,
  };

  const next = moveGameState(state, "left", () => 0.5);

  assert.deepStrictEqual(next.board[0], [4, 0, 0, 0]);
  assert.equal(next.score, 4);
});

test("handles simultaneous merges and scores each merge once", () => {
  const state = {
    board: [
      [2, 2, 4, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    score: 0,
    won: false,
    over: false,
    moved: false,
  };

  const next = moveGameState(state, "left", () => 0.5);

  assert.deepStrictEqual(next.board[0], [4, 8, 0, 0]);
  assert.equal(next.score, 12);
});

test("merges four identical tiles to the right deterministically", () => {
  const state = {
    board: [
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    score: 0,
    won: false,
    over: false,
    moved: false,
  };

  const next = moveGameState(state, "right", () => 0.5);

  assert.deepStrictEqual(next.board[0], [0, 0, 4, 4]);
  assert.equal(next.score, 8);
});

test("merges four identical tiles upward deterministically", () => {
  const state = {
    board: [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [2, 0, 0, 0],
    ],
    score: 0,
    won: false,
    over: false,
    moved: false,
  };

  const next = moveGameState(state, "up", () => 0.5);

  assert.deepStrictEqual(
    next.board.map(row => row[0]),
    [4, 4, 0, 0]
  );

  assert.equal(next.score, 8);
});

test("merges four identical tiles downward deterministically", () => {
  const state = {
    board: [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [2, 0, 0, 0],
    ],
    score: 0,
    won: false,
    over: false,
    moved: false,
  };

  const next = moveGameState(state, "down", () => 0.5);

  assert.deepStrictEqual(
    next.board.map(row => row[0]),
    [0, 0, 4, 4]
  );

  assert.equal(next.score, 8);
});

test("preserves existing score and adds only merge score", () => {
  const state = {
    board: [
      [4, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    score: 100,
    won: false,
    over: false,
    moved: false,
  };

  const next = moveGameState(state, "left", () => 0.5);

  assert.deepStrictEqual(next.board[0], [8, 0, 0, 0]);
  assert.equal(next.score, 108);
});

test("does not change score when no merge occurs", () => {
  const state = {
    board: [
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    score: 50,
    won: false,
    over: false,
    moved: false,
  };

  const next = moveGameState(state, "left", () => 0.5);

  assert.deepStrictEqual(next.board[0], [2, 4, 8, 16]);
  assert.equal(next.score, 50);
  assert.equal(next.moved, false);
});

test("handles a boundary merge after empty spaces", () => {
  const state = {
    board: [
      [0, 2, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    score: 0,
    won: false,
    over: false,
    moved: false,
  };

  const next = moveGameState(state, "left", () => 0.5);

  assert.deepStrictEqual(next.board[0], [4, 0, 0, 0]);
  assert.equal(next.score, 4);
});

test("does not merge newly created tiles again", () => {
  const state = {
    board: [
      [4, 4, 4, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    score: 0,
    won: false,
    over: false,
    moved: false,
  };

  const next = moveGameState(state, "left", () => 0.5);

  assert.deepStrictEqual(next.board[0], [8, 4, 0, 0]);
  assert.equal(next.score, 8);
});

test("detects a winning tile", () => {
  const board = [
    [2048, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  assert.equal(hasWon(board), true);
});

test("detects game over when no moves remain", () => {
  const board = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ];

  assert.equal(canMove(board), false);
});

test("creates a fresh game state with two starting tiles", () => {
  const state = createInitialState(() => 0.1);
  const filledCells = state.board.flat().filter(Boolean).length;

  assert.equal(filledCells, 2);
});