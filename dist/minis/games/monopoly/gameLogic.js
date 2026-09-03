function cellGridArea(i) {
  if (i >= 0 && i <= 10) {
    return { col: 11 - i, row: 11 };
  } else if (i > 10 && i <= 20) {
    return { col: 1, row: 11 - (i - 10) };
  } else if (i > 20 && i <= 30) {
    return { col: 1 + (i - 20), row: 1 };
  } else {
    return { col: 11, row: 1 + (i - 30) };
  }
}

function computeRent(space, owner, diceSum, owners, board) {
  if (space.type === "property") {
    return space.rent;
  }

  if (space.type === "railroad") {
    const count = board.filter(
      (s) => s.type === "railroad" && owners[s.i] === owner.id
    ).length;

    return [0, 25, 50, 100, 200][count];
  }

  if (space.type === "utility") {
    const count = board.filter(
      (s) => s.type === "utility" && owners[s.i] === owner.id
    ).length;

    return diceSum * (count === 2 ? 10 : 4);
  }

  return 0;
}

module.exports = {
  cellGridArea,
  computeRent,
};