const test = require("node:test");
const assert = require("node:assert/strict");
const { validateBoard, solveSudoku } = require("../projects/games/sudoku-solver/script.js");

const validBoard = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9]
];

test("valid board passes validation", () => {
  assert.equal(validateBoard(validBoard), true);
});

test("validation rejects incorrect row count", () => {
  const badBoard = validBoard.slice(0, 8);
  assert.throws(() => validateBoard(badBoard), /Board must have exactly 9 rows/);
});

test("validation rejects incorrect column count in row", () => {
  const badBoard = validBoard.map((row, i) => i === 0 ? row.slice(0, 8) : row);
  assert.throws(() => validateBoard(badBoard), /Row 1 must have exactly 9 columns/);
});

test("validation rejects invalid values/digits", () => {
  // Reject negative
  let badBoard = validBoard.map((row, i) => i === 0 ? [-1, ...row.slice(1)] : row);
  assert.throws(() => validateBoard(badBoard), /Invalid value -1/);

  // Reject > 9
  badBoard = validBoard.map((row, i) => i === 0 ? [10, ...row.slice(1)] : row);
  assert.throws(() => validateBoard(badBoard), /Invalid value 10/);

  // Reject float
  badBoard = validBoard.map((row, i) => i === 0 ? [5.5, ...row.slice(1)] : row);
  assert.throws(() => validateBoard(badBoard), /Invalid value 5.5/);

  // Reject NaN
  badBoard = validBoard.map((row, i) => i === 0 ? [NaN, ...row.slice(1)] : row);
  assert.throws(() => validateBoard(badBoard), /Invalid value NaN/);
});

test("validation rejects duplicates in rows", () => {
  const badBoard = validBoard.map((row, i) => i === 0 ? [5, 5, 0, 0, 7, 0, 0, 0, 0] : row);
  assert.throws(() => validateBoard(badBoard), /Row 1 has duplicate value 5/);
});

test("validation rejects duplicates in columns", () => {
  // Place 5 at Row 2 Col 1, and clear the pre-existing 5 in Row 2 Col 6 to avoid a row duplicate error.
  const badBoard = validBoard.map((row, i) => i === 1 ? [5, 0, 0, 1, 9, 0, 0, 0, 0] : row);
  assert.throws(() => validateBoard(badBoard), /Column 1 has duplicate value 5/);
});

test("validation rejects duplicates in subgrids", () => {
  // Place 3 in Row 2 Col 3 (index 2). This is in Box 1, which already contains 3 at Row 1 Col 2.
  // There are no duplicate rows/columns for 3.
  const badBoard = validBoard.map((row, i) => i === 1 ? [6, 0, 3, 1, 9, 5, 0, 0, 0] : row);
  assert.throws(() => validateBoard(badBoard), /Subgrid starting at row 1, column 1 has duplicate value 3/);
});

test("solveSudoku successfully solves a valid puzzle", () => {
  const solved = solveSudoku(validBoard);
  assert.equal(validateBoard(solved), true);
  // Verify no empty cells
  assert.ok(solved.every(row => row.every(cell => cell !== 0)));
});

test("solveSudoku throws error on unsolvable puzzle", () => {
  // A valid but unsolvable starting board
  const unsolvableBoard = [
    [1, 2, 3, 4, 5, 6, 7, 8, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 9],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ];
  assert.throws(() => solveSudoku(unsolvableBoard), /Puzzle is unsolvable/);
});
