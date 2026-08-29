const test = require("node:test");
const assert = require("node:assert/strict");

const {
  cellGridArea,
  computeRent,
} = require("../projects/games/monopoly/gameLogic");

test("GO is positioned at the bottom-right corner", () => {
  assert.deepStrictEqual(cellGridArea(0), {
    col: 11,
    row: 11,
  });
});

test("Jail is positioned at the bottom-left corner", () => {
  assert.deepStrictEqual(cellGridArea(10), {
    col: 1,
    row: 11,
  });
});

test("returns base rent for a property", () => {
  const property = {
    type: "property",
    rent: 20,
  };

  assert.equal(
    computeRent(property, {}, 0, {}, []),
    20
  );
});

test("returns correct railroad rent for one owned railroad", () => {
  const owner = { id: 0 };

  const board = [
    {
      i: 5,
      type: "railroad",
    },
  ];

  const owners = {
    5: 0,
  };

  assert.equal(
    computeRent(board[0], owner, 0, owners, board),
    25
  );
});

test("returns correct utility rent when both utilities are owned", () => {
  const owner = { id: 0 };

  const board = [
    {
      i: 12,
      type: "utility",
    },
    {
      i: 28,
      type: "utility",
    },
  ];

  const owners = {
    12: 0,
    28: 0,
  };

  assert.equal(
    computeRent(board[0], owner, 7, owners, board),
    70
  );
});

test("player names are rendered as text instead of HTML", () => {
  const source = require("fs").readFileSync(
    require.resolve("../projects/games/monopoly/script.js"),
    "utf8"
  );

  assert.doesNotMatch(source, /innerHTML\\s*=.*\\$\\{p\\.name\\}/);
  assert.match(source, /createTextNode\(p\.name\)/);
});
