
const boardElement = document.getElementById("board");
const playerCountElement = document.getElementById("playerCount");
const gridPresetElement = document.getElementById("gridPreset");
const gridCustomElement = document.getElementById("gridCustom");
const gridValueElement = document.getElementById("gridValue");
const currentPlayerElement = document.getElementById("currentPlayer");
const playerStatsElement = document.getElementById("playerStats");
const analyticsContainer = document.getElementById("analyticsContainer");
const gameModeElement = document.getElementById("gameMode");
const hintBtnElement = document.getElementById("hintBtn");
const difficultyElement = document.getElementById("difficulty");
const difficultyGroup = document.getElementById("difficultyGroup");
const themeToggle = document.getElementById("themeToggle");
const newGameButton = document.getElementById("newGame");

const COLORS = ["red", "blue", "green", "yellow"];

let boardSize = 8;
let state = {};
let matchHistory = [];

try {
  matchHistory =
    JSON.parse(
      localStorage.getItem("cradle_dot_game_history") ||
      localStorage.getItem("dotGameHistory") ||
      "[]"
    ) || [];
} catch {
  matchHistory = [];
}

function updateGridValue(size) {
  gridValueElement.textContent = `${size} × ${size}`;
}

function updateDifficultyVisibility() {
  difficultyGroup.style.display =
    gameModeElement.value === "pvai" ? "flex" : "none";
}

gameModeElement.addEventListener("change", () => {
  const previousMode = state.gameMode;

  if (
    state.isActive &&
    state.analytics &&
    state.analytics.moves > 0 &&
    previousMode !== gameModeElement.value
  ) {
    const confirmed = confirm(
      "Changing the game mode will reset the current match. Continue?"
    );

    if (!confirmed) {
      gameModeElement.value = previousMode;
      updateDifficultyVisibility();
      return;
    }
  }

  updateDifficultyVisibility();

  if (state.isActive) {
    startGame();
  }
});

gridPresetElement.addEventListener("change", event => {
  if (event.target.value === "custom") {
    gridCustomElement.style.display = "block";
    handleSizeChange(Number(gridCustomElement.value));
    return;
  }

  gridCustomElement.style.display = "none";
  handleSizeChange(Number(event.target.value));
});

gridCustomElement.addEventListener("input", event => {
  let value = Number(event.target.value);

  if (value < 2) value = 2;
  if (value > 12) value = 12;

  event.target.value = value;
  handleSizeChange(value);
});

function handleSizeChange(size) {
  if (!Number.isInteger(size) || size < 2 || size > 12) {
    return;
  }

  if (
    state.isActive &&
    state.analytics &&
    state.analytics.moves > 0
  ) {
    const confirmed = confirm(
      "Are you sure you want to change the board size and reset the active match?"
    );

    if (!confirmed) {
      restoreGridControls();
      return;
    }
  }

  boardSize = size;
  updateGridValue(size);

  if (state.isActive) {
    startGame();
  }
}

function restoreGridControls() {
  if ([3, 5, 8].includes(boardSize)) {
    gridPresetElement.value = boardSize;
    gridCustomElement.style.display = "none";
  } else {
    gridPresetElement.value = "custom";
    gridCustomElement.style.display = "block";
    gridCustomElement.value = boardSize;
  }

  updateGridValue(boardSize);
}

function renderBoard() {
  boardElement.innerHTML = "";
  boardElement.style.gridTemplateColumns =
    `repeat(${boardSize}, minmax(0, 1fr))`;

  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const data = state.board[row][col];
      const cell = document.createElement("button");

      cell.type = "button";
      cell.className =
        `cell${data.owner ? ` ${data.owner}` : ""}`;

      cell.textContent = data.dots || "";

      cell.setAttribute(
        "aria-label",
        `${data.owner || "Empty"} cell, ${data.dots} dots`
      );

      cell.addEventListener("click", () => {
        addDot(row, col);
      });

      boardElement.appendChild(cell);
    }
  }
}

function initTheme() {
  const savedTheme =
    localStorage.getItem("cradle_theme") ||
    localStorage.getItem("neuralforge_theme") ||
    localStorage.getItem("theme") ||
    "dark";

  setTheme(savedTheme);
}

function setTheme(theme) {
  const isLight = theme === "light";
  const html = document.documentElement;

  html.classList.toggle("light-theme", isLight);

  if (themeToggle) {
    themeToggle.innerHTML = isLight
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';

    themeToggle.setAttribute(
      "aria-label",
      isLight
        ? "Switch to dark theme"
        : "Switch to light theme"
    );
  }

  localStorage.setItem(
    "theme",
    isLight ? "light" : "dark"
  );

  localStorage.setItem(
    "cradle_theme",
    isLight ? "light" : "dark"
  );
}

function toggleTheme() {
  const isLight =
    document.documentElement.classList.contains("light-theme");

  setTheme(isLight ? "dark" : "light");
}

if (themeToggle) {
  themeToggle.addEventListener("click", toggleTheme);
}

function clearHint() {
  Array.from(boardElement.children).forEach(cell => {
    cell.classList.remove("hint");
  });
}

function getBestMove(
  board,
  player,
  difficulty = "medium"
) {
  const validMoves = getValidMoves(board, player);

  if (validMoves.length === 0) {
    return null;
  }

  if (difficulty === "easy") {
    return getRandomMove(board, player);
  }

  const scoredMoves = validMoves.map(move => {
    const cell = board[move.r][move.c];
    const capacity = getCapacity(
      move.r,
      move.c,
      board.length
    );

    let score = 0;

    if (cell.dots === capacity - 1) {
      score += 10;
    }

    if (
      (move.r === 0 ||
        move.r === board.length - 1) &&
      (move.c === 0 ||
        move.c === board.length - 1)
    ) {
      score += 5;
    }

    if (
      move.r === 0 ||
      move.r === board.length - 1 ||
      move.c === 0 ||
      move.c === board.length - 1
    ) {
      score += 2;
    }

    return {
      move,
      score
    };
  });

  const maxScore = Math.max(
    ...scoredMoves.map(item => item.score)
  );

  const bestMoves = scoredMoves
    .filter(item => item.score === maxScore)
    .map(item => item.move);

  return bestMoves[
    Math.floor(Math.random() * bestMoves.length)
  ];
}

function countPlayerCells(player) {
  let count = 0;

  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (
        state.board[row][col].owner === player
      ) {
        count++;
      }
    }
  }

  return count;
}

function nextTurn() {
  const totalPlayers = state.players.length;
  const openingComplete =
    state.analytics.moves > totalPlayers;

  for (
    let step = 1;
    step <= totalPlayers;
    step++
  ) {
    const nextIndex =
      (state.currentPlayer + step) %
      totalPlayers;

    if (
      !openingComplete ||
      countPlayerCells(
        state.players[nextIndex]
      ) > 0
    ) {
      state.currentPlayer = nextIndex;
      return;
    }
  }

  state.currentPlayer =
    (state.currentPlayer + 1) %
    totalPlayers;
}

function handleAiTurn() {
  if (!state.isActive) return;
  if (state.gameMode !== "pvai") return;

  const player =
    state.players[state.currentPlayer];

  if (player === COLORS[0]) return;

  state.isAiTurnProcessing = true;

  const move = getBestMove(
    state.board,
    player,
    difficultyElement.value
  );

  if (move) {
    addDot(move.r, move.c);
  }

  state.isAiTurnProcessing = false;
}

function addDot(row, col) {
  if (!state.isActive) return;

  if (
    row < 0 ||
    row >= boardSize ||
    col < 0 ||
    col >= boardSize
  ) {
    return;
  }

  const player =
    state.players[state.currentPlayer];

  if (
    state.gameMode === "pvai" &&
    player !== COLORS[0] &&
    !state.isAiTurnProcessing
  ) {
    return;
  }

  const cell = state.board[row][col];

  if (
    cell.owner &&
    cell.owner !== player
  ) {
    return;
  }

  clearHint();

  state.analytics.moves++;

  const moveDuration =
    Date.now() - state.lastMoveTime;

  state.analytics.moveTimes[player].push(
    moveDuration
  );

  state.lastMoveTime = Date.now();

  cell.owner = player;
  cell.dots++;

  render(false);

  resolveBoardStep(
    [{ row, col }],
    didExplode => {
      if (state.isActive) {
        checkGameOver();
      }

      if (!state.isActive) {
        render();
        return;
      }

      state.extraTurn = didExplode;

      if (!didExplode) {
        nextTurn();
      }

      render();
    }
  );
}

function resolveBoardStep(
  queue,
  onDone,
  explodedAny = false
) {
  if (queue.length === 0) {
    onDone(explodedAny);
    return;
  }

  const next = [];

  for (const { row, col } of queue) {
    const cell = state.board[row][col];

    const capacity = getCapacity(
      row,
      col,
      boardSize
    );

    while (cell.dots >= capacity) {
      const owner = cell.owner;

      explode(row, col, owner);
      explodedAny = true;

      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      ]) {
        const nextRow = row + dr;
        const nextCol = col + dc;

        if (
          nextRow >= 0 &&
          nextRow < boardSize &&
          nextCol >= 0 &&
          nextCol < boardSize
        ) {
          next.push({
            row: nextRow,
            col: nextCol
          });
        }
      }
    }
  }

  render(false);

  if (next.length > 0) {
    setTimeout(() => {
      resolveBoardStep(
        next,
        onDone,
        explodedAny
      );
    }, 0);
  } else {
    onDone(explodedAny);
  }
}

function explode(row, col, owner) {
  const cell = state.board[row][col];

  const capacity = getCapacity(
    row,
    col,
    boardSize
  );

  cell.dots -= capacity;

  if (cell.dots <= 0) {
    cell.owner = null;
    cell.dots = 0;
  }

  state.analytics.totalExplosions++;

  for (const [dr, dc] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ]) {
    const nextRow = row + dr;
    const nextCol = col + dc;

    if (
      nextRow < 0 ||
      nextCol < 0 ||
      nextRow >= boardSize ||
      nextCol >= boardSize
    ) {
      continue;
    }

    const neighbor =
      state.board[nextRow][nextCol];

    if (
      neighbor.owner &&
      neighbor.owner !== owner
    ) {
      state.analytics.captures[owner]++;
    }

    neighbor.owner = owner;
    neighbor.dots++;
  }
}

function checkGameOver() {
  if (
    state.analytics.moves <=
    state.players.length
  ) {
    return;
  }

  const activePlayers = new Set();

  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const owner =
        state.board[row][col].owner;

      if (owner) {
        activePlayers.add(owner);
      }
    }
  }

  if (activePlayers.size <= 1) {
    state.isActive = false;

    state.winner =
      activePlayers.size === 1
        ? [...activePlayers][0]
        : "draw";

    saveMatchHistory();
    renderAnalytics();
  }
}

function renderStats() {
  playerStatsElement.innerHTML = "";

  state.players.forEach(player => {
    const count = state.board
      .flat()
      .filter(cell => cell.owner === player)
      .length;

    const card =
      document.createElement("div");

    card.className =
      `player-card ${player}`;

    card.textContent =
      `${player.toUpperCase()} : ${count}`;

    if (
      !state.isActive &&
      state.winner === player
    ) {
      card.setAttribute(
        "data-winner",
        "true"
      );
    }

    playerStatsElement.appendChild(card);
  });
}

function render(triggerAiTurn = true) {
  if (state.isActive) {
    const player =
      state.players[state.currentPlayer];

    currentPlayerElement.textContent =
      state.extraTurn
        ? `${player} (Extra Turn!)`
        : player;

    if (
      triggerAiTurn &&
      state.gameMode === "pvai" &&
      player !== COLORS[0]
    ) {
      setTimeout(handleAiTurn, 250);
    }
  } else {
    currentPlayerElement.textContent =
      state.winner === "draw"
        ? "Draw!"
        : `${state.winner.toUpperCase()} Wins!`;
  }

  renderBoard();
  renderStats();

  if (
    hintBtnElement &&
    state.isActive &&
    !(
      state.gameMode === "pvai" &&
      state.players[state.currentPlayer] !== COLORS[0]
    )
  ) {
    hintBtnElement.disabled = false;
  } else if (hintBtnElement) {
    hintBtnElement.disabled = true;
  }
}

function startGame() {
  const playerCount =
    Number(playerCountElement.value);

  const players =
    COLORS.slice(0, playerCount);

  const moveTimes = {};
  const captures = {};

  players.forEach(player => {
    moveTimes[player] = [];
    captures[player] = 0;
  });

  state = {
    isActive: true,
    winner: null,
    currentPlayer: 0,
    players,
    board: createBoard(boardSize),
    lastMoveTime: Date.now(),
    gameMode: gameModeElement.value,
    isAiTurnProcessing: false,
    extraTurn: false,
    analytics: {
      moves: 0,
      moveTimes,
      totalExplosions: 0,
      captures,
      gridSize: `${boardSize}x${boardSize}`
    }
  };

  restoreGridControls();
  render();
}

function saveMatchHistory() {
  const historyEntry = {
    date: new Date().toLocaleString(),
    gridSize: state.analytics.gridSize,
    players: state.players.length,
    winner: state.winner,
    moves: state.analytics.moves,
    explosions:
      state.analytics.totalExplosions,
    stats: {}
  };

  state.players.forEach(player => {
    const times =
      state.analytics.moveTimes[player];

    const averageTime = times.length
      ? (
          times.reduce(
            (sum, time) => sum + time,
            0
          ) /
          times.length /
          1000
        ).toFixed(1)
      : "0.0";

    historyEntry.stats[player] = {
      captures:
        state.analytics.captures[player],
      avgMoveTime: averageTime
    };
  });

  matchHistory.unshift(historyEntry);

  if (matchHistory.length > 10) {
    matchHistory.pop();
  }

  localStorage.setItem(
    "cradle_dot_game_history",
    JSON.stringify(matchHistory)
  );
}

function renderAnalytics() {
  if (matchHistory.length === 0) {
    analyticsContainer.innerHTML =
      '<p class="empty-state">No completed games yet.</p>';
    return;
  }

  analyticsContainer.innerHTML = "";

  matchHistory.forEach(match => {
    const card =
      document.createElement("div");

    card.className =
      "analytics-card";

    const title =
      document.createElement("h3");

    title.textContent =
      `Match on ${match.date} (${match.gridSize})`;

    card.appendChild(title);

    const statsGrid =
      document.createElement("div");

    statsGrid.className =
      "stats-grid";

    addStat(
      statsGrid,
      "Winner",
      match.winner
    );

    addStat(
      statsGrid,
      "Total Moves",
      match.moves
    );

    addStat(
      statsGrid,
      "Total Explosions",
      match.explosions
    );

    card.appendChild(statsGrid);

    const captureHeading =
      document.createElement("h4");

    captureHeading.textContent =
      "Captures per Player";

    card.appendChild(captureHeading);

    card.appendChild(
      createChart(
        match.stats,
        "captures"
      )
    );

    const timeHeading =
      document.createElement("h4");

    timeHeading.textContent =
      "Avg Move Time (s)";

    card.appendChild(timeHeading);

    card.appendChild(
      createChart(
        match.stats,
        "avgMoveTime"
      )
    );

    analyticsContainer.appendChild(card);
  });
}

function addStat(
  container,
  label,
  value
) {
  const item =
    document.createElement("div");

  item.className =
    "stat-item";

  const labelElement =
    document.createElement("span");

  labelElement.className =
    "stat-label";

  labelElement.textContent =
    label;

  const valueElement =
    document.createElement("span");

  valueElement.className =
    "stat-val";

  valueElement.textContent =
    value;

  item.appendChild(labelElement);
  item.appendChild(valueElement);

  container.appendChild(item);
}

function createChart(stats, property) {
  const container =
    document.createElement("div");

  const values =
    Object.values(stats).map(
      data => Number(data[property]) || 0
    );

  const maxValue =
    Math.max(...values, 0);

  Object.entries(stats).forEach(
    ([player, data]) => {
      const value =
        Number(data[property]) || 0;

      const percentage =
        maxValue > 0
          ? (value / maxValue) * 100
          : 0;

      const row =
        document.createElement("div");

      row.className =
        "chart-bar";

      const label =
        document.createElement("div");

      label.className =
        `chart-label ${player}`;

      label.textContent =
        player;

      const background =
        document.createElement("div");

      background.className =
        "chart-bar-bg";

      const fill =
        document.createElement("div");

      fill.className =
        `chart-bar-fill ${player}`;

      fill.style.width =
        `${percentage}%`;

      background.appendChild(fill);

      const valueElement =
        document.createElement("div");

      valueElement.className =
        "chart-value";

      valueElement.textContent =
        property === "avgMoveTime"
          ? `${value}s`
          : value;

      row.appendChild(label);
      row.appendChild(background);
      row.appendChild(valueElement);

      container.appendChild(row);
    }
  );

  return container;
}

newGameButton.addEventListener(
  "click",
  () => {
    if (
      state.isActive &&
      state.analytics &&
      state.analytics.moves > 0
    ) {
      if (
        !confirm(
          "Are you sure you want to start a new game?"
        )
      ) {
        return;
      }
    }

    startGame();
  }
);

if (hintBtnElement) {
  hintBtnElement.addEventListener(
    "click",
    () => {
      if (!state.isActive) return;

      const player =
        state.players[state.currentPlayer];

      if (
        state.gameMode === "pvai" &&
        player !== COLORS[0]
      ) {
        return;
      }

      clearHint();

      const bestMove = getBestMove(
        state.board,
        player,
        difficultyElement.value
      );

      if (!bestMove) return;

      const index =
        bestMove.r * boardSize +
        bestMove.c;

      const cell =
        boardElement.children[index];

      if (cell) {
        cell.classList.add("hint");
      }
    }
  );
}

updateDifficultyVisibility();
initTheme();
renderAnalytics();
startGame();

window.testExtreme = function() {
  state.board = createBoard(boardSize);

  const row =
    Math.floor(boardSize / 2);

  const col =
    Math.floor(boardSize / 2);

  state.board[row][col].owner = "red";
  state.board[row][col].dots = 10;

  console.log(
    "Before:",
    state.board[row][col]
  );

  render();

  resolveBoardStep(
    [{ row, col }],
    () => {
      console.log(
        "After:",
        state.board[row][col]
      );

      render();
    }
  );
};