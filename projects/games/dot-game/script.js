const {
  createBoard,
  getCapacity,
  getRandomMove,
  getValidMoves,
  hasPieces,
} = DotGameEngine;
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

const COLORS = ["red", "blue", "green", "yellow"];

gameModeElement.addEventListener("change", e => {
  document.getElementById("difficultyGroup").style.display =
    e.target.value === "pvai" ? "flex" : "none";
});
document.getElementById("difficultyGroup").style.display =
  gameModeElement.value === "pvai" ? "flex" : "none";

let boardSize = 8;
let state = {};
let matchHistory = [];
try {
  matchHistory = JSON.parse(localStorage.getItem("cradle_dot_game_history") || localStorage.getItem("dotGameHistory")) || [];
} catch {
  matchHistory = [];
}
function updateGridValue(size) {
  gridValueElement.textContent = `${size} × ${size}`;
}

gridPresetElement.addEventListener("change", e => {
  if (e.target.value === "custom") {
    gridCustomElement.style.display = "inline-block";
    handleSizeChange(+gridCustomElement.value);
  } else {
    gridCustomElement.style.display = "none";
    handleSizeChange(+e.target.value);
  }
});

gridCustomElement.addEventListener("input", e => {
  let val = +e.target.value;
  if (val < 2) val = 2;
  if (val > 12) val = 12;
  handleSizeChange(val);
});

function handleSizeChange(size) {
  if (state.isActive && state.analytics && state.analytics.moves > 0) {
    if (
      !confirm(
        "Are you sure you want to change board size and reset the active match?"
      )
    ) {
      // Revert UI to match actual size
      if (boardSize === 3 || boardSize === 5 || boardSize === 8) {
        gridPresetElement.value = boardSize;
        gridCustomElement.style.display = "none";
      } else {
        gridPresetElement.value = "custom";
        gridCustomElement.style.display = "inline-block";
        gridCustomElement.value = boardSize;
      }
      return;
    }
  }
  boardSize = size;
  updateGridValue(size);
  if (state.isActive) {
    startGame();
  }
}




function renderBoard() {
  boardElement.innerHTML = "";
  boardElement.style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;

  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const data = state.board[row][col];

      const cell = document.createElement("button");
      cell.className = `cell ${data.owner || ""}`;
      cell.textContent = data.dots || "";
      cell.onclick = () => addDot(row, col);

      boardElement.appendChild(cell);
    }
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem("cradle_theme") || localStorage.getItem("neuralforge_theme") || "dark";
  setTheme(savedTheme);
}

function setTheme(theme) {
  const html = document.documentElement;
  const themeBtn = document.getElementById("themeToggle");

  if (theme === "light") {
    html.classList.add("light-theme");
    if (themeBtn)
      themeBtn.innerHTML = '<i class="fas fa-sun text-orange-400"></i>';
    localStorage.setItem("theme", "light");

    localStorage.setItem("cradle_theme", "light");
  } else {
    html.classList.remove("light-theme");
    if (themeBtn)
      themeBtn.innerHTML = '<i class="fas fa-moon text-yellow-400"></i>';
    localStorage.setItem("theme", "dark");
    localStorage.setItem("cradle_theme", "dark");
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.classList.contains("light-theme");
  setTheme(isLight ? "dark" : "light");
}

function clearHint() {
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const cellEl = boardElement.children[r * boardSize + c];
      if (cellEl) cellEl.classList.remove("hint");
    }
  }
}

function getBestMove(board, player, difficulty = "medium") {
  const validMoves = getValidMoves(board, player);

  if (validMoves.length === 0) {
    return null;
  }

  if (difficulty === "easy") {
    return getRandomMove(board, player);
  }

  // Score each valid move.
  const scoredMoves = validMoves.map(move => {
    const cell = board[move.r][move.c];
    const capacity = getCapacity(move.r, move.c, board.length);

    let score = 0;

    // Prefer moves that are close to exploding.
    if (cell.dots === capacity - 1) {
      score += 10;
    }

    // Prefer corners because they have the lowest capacity.
    if (
      (move.r === 0 || move.r === board.length - 1) &&
      (move.c === 0 || move.c === board.length - 1)
    ) {
      score += 5;
    }

    // Prefer edges.
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
      score,
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
      if (state.board[row][col].owner === player) count++;
    }
  }
  return count;
}

// Advance to the next player. Once every player has had an opening move,
// skip any player who has been eliminated (owns no cells).
function nextTurn() {
  const total = state.players.length;
  const openingDone = state.analytics.moves > total;
  for (let step = 1; step <= total; step++) {
    const idx = (state.currentPlayer + step) % total;
    if (!openingDone || countPlayerCells(state.players[idx]) > 0) {
      state.currentPlayer = idx;
      return;
    }
  }
  state.currentPlayer = (state.currentPlayer + 1) % total;
}

// Play the AI's move in Player-vs-AI mode. Setting isAiTurnProcessing lets
// addDot's "human click during AI turn" guard allow this move through.
function handleAiTurn() {
  if (!state.isActive) return;
  if (state.gameMode !== "pvai") return;
  if (state.players[state.currentPlayer] === COLORS[0]) return;

  state.isAiTurnProcessing = true;
  const move = getBestMove(
    state.board,
    state.players[state.currentPlayer],
    difficultyElement.value,
  );
  state.isAiTurnProcessing = false;

  if (move) addDot(move.row, move.col);
}

function addDot(row, col) {
  if (!state.isActive) return;

  const player = state.players[state.currentPlayer];
  if (
    state.gameMode === "pvai" &&
    player !== COLORS[0] &&
    !state.isAiTurnProcessing
  ) {
    return; // Prevent human click during AI turn
  }

  const cell = state.board[row][col];

  if (cell.owner && cell.owner !== player) return;

  clearHint();

  // Analytics: Record move
  state.analytics.moves++;
  const moveDuration = Date.now() - state.lastMoveTime;
  state.analytics.moveTimes[player].push(moveDuration);
  state.lastMoveTime = Date.now();

  cell.owner = player;
  cell.dots++;

  // Show the dot landing immediately, before any chain reaction plays out
  render(false);

  // Kick off the (possibly multi-step, async) chain reaction.
  // This never blocks the browser, no matter how long the chain runs.
  resolveBoardStep([{ row, col }], didExplode => {
    if (state.isActive) {
      checkGameOver();
    }

    if (state.isActive) {
      // If we strictly follow the prompt's "extra turn after box completion" mapped to "extra turn after explosion"
      if (didExplode) {
        // Player gets another turn
        currentPlayerElement.textContent =
          state.players[state.currentPlayer] + " (Extra Turn!)";
      } else {
        nextTurn();
      }
    }
    render();
  });
}



// Async, step-by-step chain reaction resolver.
// Instead of rescanning the WHOLE board every round (slow) and running
// fully synchronously (freezes the tab on long chains), this only
// re-checks cells adjacent to a recent explosion, and yields control
// back to the browser between each wave via setTimeout.
function resolveBoardStep(queue, onDone, explodedAny = false) {
  if (queue.length === 0) {
    onDone(explodedAny);
    return;
  }

  let next = [];

  for (const { row, col } of queue) {
    const cell = state.board[row][col];
    const capacity = getCapacity(row, col, boardSize);

    while (state.board[row][col].dots >= capacity) {
      const owner = state.board[row][col].owner;

      explode(row, col, owner);
      explodedAny = true;

      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nr = row + dr;
        const nc = col + dc;

        if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
          next.push({ row: nr, col: nc });
        }
      }
    }
  }

  // Show this wave of explosions before moving to the next one.
  // `false` = don't trigger AI turn / game-over side effects mid-chain.
  render(false);

  if (next.length > 0) {
    setTimeout(() => resolveBoardStep(next, onDone, explodedAny), 0);
  } else {
    onDone(explodedAny);
  }
}

function explode(row, col, owner) {
  const cell = state.board[row][col];
 const capacity = getCapacity(row, col, boardSize);

  cell.dots -= capacity;

  if (cell.dots <= 0) {
    cell.owner = null;
    cell.dots = 0;
  }

  state.analytics.totalExplosions++; // Analytics

  for (const [dr, dc] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const nr = row + dr;
    const nc = col + dc;

    if (nr < 0 || nc < 0 || nr >= boardSize || nc >= boardSize) continue;

    const neighbor = state.board[nr][nc];

    if (neighbor.owner !== owner && neighbor.owner !== null) {
      state.analytics.captures[owner]++;
    }

    neighbor.owner = owner;
    neighbor.dots++;
  }
}

function checkGameOver() {
  // Only check if everyone has had at least one turn
  if (state.analytics.moves <= state.players.length) return;

  const activePlayers = new Set();
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (state.board[row][col].owner) {
        activePlayers.add(state.board[row][col].owner);
      }
    }
  }

  if (activePlayers.size <= 1) {
    state.isActive = false;
    state.winner =
      activePlayers.size === 1 ? Array.from(activePlayers)[0] : "draw";
    saveMatchHistory();
    renderAnalytics();
  }
}


function renderStats() {
  playerStatsElement.innerHTML = "";

  state.players.forEach(player => {
    const count = state.board
      .flat()
      .filter(cell => cell.owner === player).length;

    const div = document.createElement("div");
    div.className = `player-card ${player}`;

    if (!state.isActive && state.winner === player) {
      div.textContent = `${player.toUpperCase()} : ${count}`;
    } else {
      div.textContent = `${player.toUpperCase()} : ${count}`;
    }

    playerStatsElement.appendChild(div);
  });
}

// `triggerAiTurn` defaults to true. Pass false for intermediate renders
// during a chain reaction, so the AI turn / game-over logic only ever
// fires once, from the final render after the chain fully resolves.
function render(triggerAiTurn = true) {
  if (state.isActive) {
    if (!currentPlayerElement.textContent.includes("Extra Turn!")) {
      currentPlayerElement.textContent = state.players[state.currentPlayer];
    } else {
      // Update the text but keep the Extra Turn suffix
      currentPlayerElement.textContent =
        state.players[state.currentPlayer] + " (Extra Turn!)";
    }

    // Trigger AI turn if needed
    if (
      triggerAiTurn &&
      state.gameMode === "pvai" &&
      state.players[state.currentPlayer] !== COLORS[0]
    ) {
      // Wait slightly so render happens before AI blocking
      setTimeout(handleAiTurn, 50);
    }
  } else {
    currentPlayerElement.textContent =
      state.winner === "draw" ? "Draw!" : `${state.winner.toUpperCase()} Wins!`;
  }

  renderBoard();
  renderStats();

  if (
    state.isActive &&
    state.gameMode === "pvai" &&
    state.players[state.currentPlayer] !== COLORS[0]
  ) {
    hintBtnElement.disabled = true;
  } else if (state.isActive) {
    hintBtnElement.disabled = false;
  } else {
    hintBtnElement.disabled = true;
  }
}

function startGame() {
  const count = +playerCountElement.value;
  const players = COLORS.slice(0, count);

  let moveTimes = {};
  let captures = {};
  players.forEach(p => {
    moveTimes[p] = [];
    captures[p] = 0;
  });

  state = {
    isActive: true,
    winner: null,
    currentPlayer: 0,
    players: players,
    board: createBoard(boardSize),
    lastMoveTime: Date.now(),
    gameMode: gameModeElement.value,
    isAiTurnProcessing: false,
    analytics: {
      moves: 0,
      moveTimes: moveTimes,
      totalExplosions: 0,
      captures: captures,
      gridSize: `${boardSize}x${boardSize}`,
    },
  };

  // Set UI dropdown correctly
  if (boardSize === 3 || boardSize === 5 || boardSize === 8) {
    gridPresetElement.value = boardSize;
    gridCustomElement.style.display = "none";
  } else {
    gridPresetElement.value = "custom";
    gridCustomElement.style.display = "inline-block";
    gridCustomElement.value = boardSize;
  }
  updateGridValue(boardSize);

  render();
}

function saveMatchHistory() {
  const pCount = state.players.length;
  const historyEntry = {
    date: new Date().toLocaleString(),
    gridSize: state.analytics.gridSize,
    players: pCount,
    winner: state.winner,
    moves: state.analytics.moves,
    explosions: state.analytics.totalExplosions,
    stats: {},
  };

  state.players.forEach(p => {
    const times = state.analytics.moveTimes[p];
    const avgTime = times.length
      ? (times.reduce((a, b) => a + b, 0) / times.length / 1000).toFixed(1)
      : 0;

    historyEntry.stats[p] = {
      captures: state.analytics.captures[p],
      avgMoveTime: avgTime,
    };
  });

  matchHistory.unshift(historyEntry); // Add to beginning
  if (matchHistory.length > 10) matchHistory.pop(); // Keep last 10

  localStorage.setItem("cradle_dot_game_history", JSON.stringify(matchHistory));
}

function renderAnalytics() {
  if (matchHistory.length === 0) {
    analyticsContainer.innerHTML =
      '<p class="empty-state">No completed games yet.</p>';
    return;
  }

  analyticsContainer.innerHTML = "";

  matchHistory.forEach((match, idx) => {
    const card = document.createElement("div");
    card.className = "analytics-card";

    card.innerHTML = `
            <h3>Match on ${match.date} (${match.gridSize})</h3>
            <div class="stats-grid">
                <div class="stat-item"><span class="stat-label">Winner</span><span class="stat-val" style="color: ${match.winner === "draw" ? "inherit" : match.winner}">${match.winner}</span></div>
                <div class="stat-item"><span class="stat-label">Total Moves</span><span class="stat-val">${match.moves}</span></div>
                <div class="stat-item"><span class="stat-label">Total Explosions</span><span class="stat-val">${match.explosions}</span></div>
            </div>
            <h4>Captures per Player</h4>
        `;

    const chartCont = document.createElement("div");
    let maxCap = 0;
    for (const p in match.stats) {
      if (match.stats[p].captures > maxCap) maxCap = match.stats[p].captures;
    }

    for (const p in match.stats) {
      const data = match.stats[p];
      const pct = maxCap > 0 ? (data.captures / maxCap) * 100 : 0;

      const bar = document.createElement("div");
      bar.className = "chart-bar";
      bar.innerHTML = `
                <div class="chart-label" style="color: ${p}">${p}</div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill" style="width: ${pct}%; background-color: ${p}"></div>
                </div>
                <div class="chart-value">${data.captures}</div>
            `;
      chartCont.appendChild(bar);
    }

    card.appendChild(chartCont);

    const timeHeader = document.createElement("h4");
    timeHeader.textContent = "Avg Move Time (s)";
    card.appendChild(timeHeader);

    const timeCont = document.createElement("div");
    let maxTime = 0;
    for (const p in match.stats) {
      if (parseFloat(match.stats[p].avgMoveTime) > maxTime)
        maxTime = parseFloat(match.stats[p].avgMoveTime);
    }

    for (const p in match.stats) {
      const data = match.stats[p];
      const pct = maxTime > 0 ? (data.avgMoveTime / maxTime) * 100 : 0;

      const bar = document.createElement("div");
      bar.className = "chart-bar";
      bar.innerHTML = `
                <div class="chart-label" style="color: ${p}">${p}</div>
                <div class="chart-bar-bg">
                    <div class="chart-bar-fill" style="width: ${pct}%; background-color: ${p}"></div>
                </div>
                <div class="chart-value">${data.avgMoveTime}s</div>
            `;
      timeCont.appendChild(bar);
    }

    card.appendChild(timeCont);

    analyticsContainer.appendChild(card);
  });
}

document.getElementById("newGame").addEventListener("click", () => {
  if (state.isActive && state.analytics && state.analytics.moves > 0) {
    if (!confirm("Are you sure you want to start a new game?")) return;
  }
  startGame();
});

if (hintBtnElement) {
  hintBtnElement.addEventListener("click", () => {
    if (!state.isActive) return;
    const player = state.players[state.currentPlayer];
    if (state.gameMode === "pvai" && player !== COLORS[0]) return; // Not human's turn

    clearHint();
   const bestMove = getBestMove(state.board,player,difficultyElement.value);
    if (bestMove) {
      const cellIdx = bestMove.r * boardSize + bestMove.c;
      const cellEl = boardElement.children[cellIdx];
      if (cellEl) cellEl.classList.add("hint");
    }
  });
}

renderAnalytics();
startGame();

//Testing Explosion
window.testExtreme = function () {
  // Reset board
  state.board = createBoard(boardSize);

  // Center cell with many dots
  const row = Math.floor(boardSize / 2);
  const col = Math.floor(boardSize / 2);

  state.board[row][col].owner = "red";
  state.board[row][col].dots = 10;

  console.log("Before:", state.board[row][col]);

  render();

  resolveBoardStep([{ row, col }], () => {
    console.log("After:", state.board[row][col]);
    render();
  });
};
