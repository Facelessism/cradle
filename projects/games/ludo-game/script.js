const canvas = document.getElementById("ludoCanvas");
const ctx = canvas.getContext("2d");
const CELL_SIZE = 40; // 600 / 15

const statusElement = document.getElementById("status");
const turnLabel = document.getElementById("turnLabel");
const moveList = document.getElementById("moveList");
const moveCount = document.getElementById("moveCount");
const diceCube = document.getElementById("diceCube");

const COLORS = LudoEngine.COLORS;
const THEME = LudoEngine.THEME;
const GLOBAL_TRACK = LudoEngine.GLOBAL_TRACK;
const SAFE_ZONES = LudoEngine.SAFE_ZONES;
const VICTORY_PATHS = LudoEngine.VICTORY_PATHS;
const HOME_CENTERS = LudoEngine.HOME_CENTERS;

let currentPlayerIndex = 0;
let diceValue = null;
let isRolling = false;
let history = [];
let gameOver = false;
let hoveredToken = null;
let consecutiveSixes = 0;
let lastMovedToken = null;

let playerTypes = {
  red: "human",
  green: "bot",
  blue: "bot",
  yellow: "bot",
};

let state = {
  red: LudoEngine.createTokens("red", CELL_SIZE),
  green: LudoEngine.createTokens("green", CELL_SIZE),
  blue: LudoEngine.createTokens("blue", CELL_SIZE),
  yellow: LudoEngine.createTokens("yellow", CELL_SIZE),
};

// --- RENDERING ENGINE ---
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Board background
  ctx.fillStyle = THEME.boardBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Homes with subtle inner gradient
  const homes = [
    { color: "red", x: 0, y: 0 },
    { color: "green", x: 9, y: 0 },
    { color: "blue", x: 9, y: 9 },
    { color: "yellow", x: 0, y: 9 },
  ];
  homes.forEach(h => {
    let grd = ctx.createLinearGradient(
      h.x * CELL_SIZE,
      h.y * CELL_SIZE,
      (h.x + 6) * CELL_SIZE,
      (h.y + 6) * CELL_SIZE
    );
    grd.addColorStop(0, THEME[h.color]);
    grd.addColorStop(1, THEME[h.color + "Dark"]);
    ctx.fillStyle = grd;
    ctx.fillRect(
      h.x * CELL_SIZE,
      h.y * CELL_SIZE,
      6 * CELL_SIZE,
      6 * CELL_SIZE
    );
  });

  // Inner home boxes
  ctx.fillStyle = "#12122a";
  roundRect(
    1.2 * CELL_SIZE,
    1.2 * CELL_SIZE,
    3.6 * CELL_SIZE,
    3.6 * CELL_SIZE,
    10
  );
  ctx.fill();
  roundRect(
    10.2 * CELL_SIZE,
    1.2 * CELL_SIZE,
    3.6 * CELL_SIZE,
    3.6 * CELL_SIZE,
    10
  );
  ctx.fill();
  roundRect(
    10.2 * CELL_SIZE,
    10.2 * CELL_SIZE,
    3.6 * CELL_SIZE,
    3.6 * CELL_SIZE,
    10
  );
  ctx.fill();
  roundRect(
    1.2 * CELL_SIZE,
    10.2 * CELL_SIZE,
    3.6 * CELL_SIZE,
    3.6 * CELL_SIZE,
    10
  );
  ctx.fill();

  // Home slots
  COLORS.forEach(color => {
    HOME_CENTERS[color].forEach(([r, c]) => {
      ctx.beginPath();
      ctx.arc(
        c * CELL_SIZE + CELL_SIZE / 2,
        r * CELL_SIZE + CELL_SIZE / 2,
        12,
        0,
        2 * Math.PI
      );
      ctx.fillStyle = THEME[color + "Dark"];
      ctx.globalAlpha = 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = THEME[color];
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  });

  // Global Track
  ctx.lineWidth = 1;
  ctx.strokeStyle = THEME.border;
  GLOBAL_TRACK.forEach(([r, c]) => {
    let isSafe = SAFE_ZONES.some(z => z[0] === r && z[1] === c);
    ctx.fillStyle = isSafe ? THEME.safeZone : THEME.trackBg;

    if (r === 6 && c === 1) ctx.fillStyle = THEME.red;
    if (r === 1 && c === 8) ctx.fillStyle = THEME.green;
    if (r === 8 && c === 13) ctx.fillStyle = THEME.blue;
    if (r === 13 && c === 6) ctx.fillStyle = THEME.yellow;

    ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    ctx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);

    if (isSafe) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "18px Outfit";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        "★",
        c * CELL_SIZE + CELL_SIZE / 2,
        r * CELL_SIZE + CELL_SIZE / 2
      );
    }
  });

  // Victory Paths
  COLORS.forEach(color => {
    VICTORY_PATHS[color].forEach(([r, c], i) => {
      ctx.globalAlpha = 0.5 + i * 0.1;
      ctx.fillStyle = THEME[color];
      ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = THEME.border;
      ctx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });
  });

  // Center Triangles
  ctx.lineWidth = 1;
  ctx.strokeStyle = THEME.border;
  ctx.beginPath();
  ctx.moveTo(6 * CELL_SIZE, 9 * CELL_SIZE);
  ctx.lineTo(7.5 * CELL_SIZE, 7.5 * CELL_SIZE);
  ctx.lineTo(9 * CELL_SIZE, 9 * CELL_SIZE);
  ctx.closePath();
  ctx.fillStyle = THEME.yellow;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(9 * CELL_SIZE, 6 * CELL_SIZE);
  ctx.lineTo(7.5 * CELL_SIZE, 7.5 * CELL_SIZE);
  ctx.lineTo(6 * CELL_SIZE, 6 * CELL_SIZE);
  ctx.closePath();
  ctx.fillStyle = THEME.green;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6 * CELL_SIZE, 6 * CELL_SIZE);
  ctx.lineTo(7.5 * CELL_SIZE, 7.5 * CELL_SIZE);
  ctx.lineTo(6 * CELL_SIZE, 9 * CELL_SIZE);
  ctx.closePath();
  ctx.fillStyle = THEME.red;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(9 * CELL_SIZE, 6 * CELL_SIZE);
  ctx.lineTo(9 * CELL_SIZE, 9 * CELL_SIZE);
  ctx.lineTo(7.5 * CELL_SIZE, 7.5 * CELL_SIZE);
  ctx.closePath();
  ctx.fillStyle = THEME.blue;
  ctx.fill();
  ctx.stroke();
}

function drawTokens() {
  COLORS.forEach(color => {
    state[color].forEach(token => {
      if (token.finished) return;

      if (token.animProgress < 1) {
        token.animProgress += 0.05;
        if (token.animProgress > 1) token.animProgress = 1;

        let p = token.animProgress;
        let ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;

        token.currentX = token.startX + (token.targetX - token.startX) * ease;
        token.currentY = token.startY + (token.targetY - token.startY) * ease;
        token.zOffset = Math.sin(p * Math.PI) * 15;
      }

      let isHovered = hoveredToken === token;
      let canMove =
        isHovered &&
        LudoEngine.isValidMove(token, COLORS[currentPlayerIndex], diceValue);
      let tx = token.currentX;
      let ty = token.currentY - token.zOffset;

      if (canMove) {
        ctx.shadowColor = THEME[color];
        ctx.shadowBlur = 20;
      }

      ctx.beginPath();
      ctx.ellipse(tx, token.currentY + 2, 10, 4, 0, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(tx, ty, 14, 0, 2 * Math.PI);
      ctx.fillStyle = "#eee";
      ctx.fill();
      ctx.strokeStyle = THEME[color + "Dark"];
      ctx.lineWidth = 2;
      ctx.stroke();

      let grd = ctx.createRadialGradient(tx - 3, ty - 4, 2, tx, ty, 11);
      grd.addColorStop(0, "#fff");
      grd.addColorStop(0.3, THEME[color]);
      grd.addColorStop(1, THEME[color + "Dark"]);
      ctx.beginPath();
      ctx.arc(tx, ty, 11, 0, 2 * Math.PI);
      ctx.fillStyle = grd;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(tx - 3, ty - 4, 4, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fill();

      ctx.shadowBlur = 0;
    });
  });
}

function renderLoop() {
  drawBoard();
  drawTokens();
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

// --- GAME LOGIC CONTROLLER ---
function animateTokenTo(token) {
  let coords = LudoEngine.getTokenCoordinate(token, CELL_SIZE);
  if (!coords) return;

  token.startX = token.currentX;
  token.startY = token.currentY;
  token.targetX = coords.x;
  token.targetY = coords.y;
  token.animProgress = 0;
}

function rollDice() {
  if (gameOver || diceValue !== null || isRolling) return;

  isRolling = true;
  diceCube.classList.add("rolling");

  setTimeout(() => {
    diceValue = Math.floor(Math.random() * 6) + 1;
    diceCube.classList.remove("rolling");
    diceCube.className = `cube show-${diceValue}`;

    isRolling = false;
    setStatus(`${capitalize(COLORS[currentPlayerIndex])} rolled ${diceValue}`);

    if (diceValue === 6) {
      consecutiveSixes++;
      if (consecutiveSixes === 3) {
        if (lastMovedToken) {
          lastMovedToken.position = -1;
          lastMovedToken.isVictoryPath = false;
          lastMovedToken.finished = false;
          animateTokenTo(lastMovedToken);
        }
        history.unshift(
          `${capitalize(COLORS[currentPlayerIndex])} penalized for three 6s`
        );
        setTimeout(nextTurn, 1000);
        return;
      }
    } else {
      consecutiveSixes = 0;
    }

    saveGame();
    checkAutoTurn();
  }, 1000);
}

function checkAutoTurn() {
  let validMoves = state[COLORS[currentPlayerIndex]].filter(t =>
    LudoEngine.isValidMove(t, COLORS[currentPlayerIndex], diceValue)
  );
  if (validMoves.length === 0) {
    setTimeout(nextTurn, 1000);
  } else if (playerTypes[COLORS[currentPlayerIndex]] === "bot") {
    setTimeout(() => executeAITurn(validMoves), 800);
  }
}

function executeAITurn(validMoves) {
  if (validMoves.length === 0) return;
  const bestMove = LudoBot.selectBestMove(validMoves, diceValue, state);
  if (bestMove) {
    executeMove(bestMove);
  }
}

function handleCaptures(token) {
  const capturedTokens = LudoEngine.checkCaptures(token, state);
  capturedTokens.forEach(cap => {
    animateTokenTo(cap);
    history.unshift(
      `${capitalize(token.color)} captured ${capitalize(cap.color)}!`
    );
  });
  return capturedTokens.length > 0;
}

function executeMove(token) {
  const isHomeSpawn = token.position === -1;
  const nextState = LudoEngine.getNextPositionState(token, diceValue);

  token.position = nextState.position;
  token.isVictoryPath = nextState.isVictoryPath;
  token.finished = nextState.finished;
  lastMovedToken = token;

  let didCapture = false;

  if (isHomeSpawn) {
    history.unshift(
      `${capitalize(token.color)} Token ${token.id + 1} entered board`
    );
  } else if (token.finished) {
    history.unshift(
      `${capitalize(token.color)} Token ${token.id + 1} reached center`
    );
  } else {
    didCapture = handleCaptures(token);
  }

  animateTokenTo(token);

  if (LudoEngine.checkWinner(state, token.color)) {
    gameOver = true;
    setStatus(`${capitalize(token.color)} wins!`);
    localStorage.removeItem("cradle_ludo_save");
    localStorage.removeItem("ludoSave");
    return;
  }

  if (didCapture) {
    history.unshift(
      `${capitalize(COLORS[currentPlayerIndex])} awarded bonus roll for capture`
    );
  }

  if (diceValue !== 6 && !token.finished && !didCapture) {
    setTimeout(nextTurn, 600);
  } else {
    setTimeout(() => {
      diceValue = null;
      setStatus(`${capitalize(COLORS[currentPlayerIndex])} gets another turn`);
      saveGame();
      if (playerTypes[COLORS[currentPlayerIndex]] === "bot") {
        setTimeout(rollDice, 800);
      }
    }, 600);
  }
}

function nextTurn() {
  consecutiveSixes = 0;
  lastMovedToken = null;
  currentPlayerIndex = (currentPlayerIndex + 1) % COLORS.length;
  diceValue = null;
  diceCube.className = "cube";
  turnLabel.textContent = capitalize(COLORS[currentPlayerIndex]);
  moveCount.textContent = history.length;
  setStatus(`${capitalize(COLORS[currentPlayerIndex])}'s turn`);
  updatePlayerIndicators();
  renderHistory();

  saveGame();

  if (playerTypes[COLORS[currentPlayerIndex]] === "bot") {
    setTimeout(rollDice, 800);
  }
}

function updatePlayerIndicators() {
  document.querySelectorAll(".player-row").forEach(row => {
    row.classList.toggle(
      "active",
      row.dataset.color === COLORS[currentPlayerIndex]
    );
  });
}

function renderHistory() {
  moveList.innerHTML = history.map(m => `<li>${m}</li>`).join("");
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function setStatus(text) {
  statusElement.textContent = text;
}

function newGame() {
  COLORS.forEach(color => {
    state[color] = LudoEngine.createTokens(color, CELL_SIZE);
  });
  currentPlayerIndex = 0;
  diceValue = null;
  history = [];
  gameOver = false;
  diceCube.className = "cube";
  turnLabel.textContent = "Red";
  moveCount.textContent = "0";
  setStatus("Red's turn");
  updatePlayerIndicators();
  renderHistory();

  saveGame();

  if (playerTypes[COLORS[currentPlayerIndex]] === "bot") {
    setTimeout(rollDice, 800);
  }
}

// Interactivity
canvas.addEventListener("mousemove", e => {
  if (gameOver || isRolling) {
    hoveredToken = null;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  hoveredToken = null;
  const activeColor = COLORS[currentPlayerIndex];

  for (let token of state[activeColor]) {
    let dx = x - token.currentX;
    let dy = y - token.currentY;
    if (dx * dx + dy * dy <= 196) {
      hoveredToken = token;
      break;
    }
  }
});

canvas.addEventListener("click", () => {
  if (
    hoveredToken &&
    LudoEngine.isValidMove(hoveredToken, COLORS[currentPlayerIndex], diceValue)
  ) {
    executeMove(hoveredToken);
    hoveredToken = null;
  }
});

document.getElementById("rollDice").addEventListener("click", () => {
  if (playerTypes[COLORS[currentPlayerIndex]] === "human") {
    rollDice();
  }
});

const setupModal = document.getElementById("setupModal");
document.getElementById("newGame").addEventListener("click", () => {
  setupModal.classList.remove("hidden");
});

document.getElementById("closeModalBtn").addEventListener("click", () => {
  setupModal.classList.add("hidden");
});

document.getElementById("startGameBtn").addEventListener("click", () => {
  playerTypes.red = document.getElementById("select-red").value;
  playerTypes.green = document.getElementById("select-green").value;
  playerTypes.blue = document.getElementById("select-blue").value;
  playerTypes.yellow = document.getElementById("select-yellow").value;

  document.getElementById("icon-red").textContent =
    playerTypes.red === "human" ? "👤" : "🤖";
  document.getElementById("icon-green").textContent =
    playerTypes.green === "human" ? "👤" : "🤖";
  document.getElementById("icon-blue").textContent =
    playerTypes.blue === "human" ? "👤" : "🤖";
  document.getElementById("icon-yellow").textContent =
    playerTypes.yellow === "human" ? "👤" : "🤖";

  setupModal.classList.add("hidden");
  newGame();
});

// Save/Load System
function saveGame() {
  const saveData = {
    state: state,
    history: history,
    currentPlayerIndex: currentPlayerIndex,
    diceValue: diceValue,
    playerTypes: playerTypes,
  };
  localStorage.setItem("cradle_ludo_save", JSON.stringify(saveData));
}

function loadGame(saveData) {
  state = saveData.state;
  history = saveData.history;
  currentPlayerIndex = saveData.currentPlayerIndex;
  diceValue = saveData.diceValue;
  playerTypes = saveData.playerTypes || playerTypes;

  COLORS.forEach(color => {
    state[color].forEach(token => {
      token.animProgress = 1;
      token.zOffset = 0;
      let coords = LudoEngine.getTokenCoordinate(token, CELL_SIZE);
      if (coords) {
        token.currentX = coords.x;
        token.currentY = coords.y;
        token.targetX = coords.x;
        token.targetY = coords.y;
        token.startX = coords.x;
        token.startY = coords.y;
      }
    });
  });

  if (diceValue !== null) {
    diceCube.className = `cube show-${diceValue}`;
    setStatus(`${capitalize(COLORS[currentPlayerIndex])} rolled ${diceValue}`);
  } else {
    diceCube.className = "cube";
    setStatus(`${capitalize(COLORS[currentPlayerIndex])}'s turn`);
  }

  turnLabel.textContent = capitalize(COLORS[currentPlayerIndex]);
  moveCount.textContent = history.length;

  updatePlayerIndicators();
  renderHistory();

  document.getElementById("icon-red").textContent =
    playerTypes.red === "human" ? "👤" : "🤖";
  document.getElementById("icon-green").textContent =
    playerTypes.green === "human" ? "👤" : "🤖";
  document.getElementById("icon-blue").textContent =
    playerTypes.blue === "human" ? "👤" : "🤖";
  document.getElementById("icon-yellow").textContent =
    playerTypes.yellow === "human" ? "👤" : "🤖";

  if (diceValue !== null) {
    checkAutoTurn();
  } else if (playerTypes[COLORS[currentPlayerIndex]] === "bot") {
    setTimeout(rollDice, 800);
  }
}

// Initial Load Logic
const savedDataString = localStorage.getItem("cradle_ludo_save") || localStorage.getItem("ludoSave");
const resumeModal = document.getElementById("resumeModal");

if (savedDataString) {
  resumeModal.classList.remove("hidden");
} else {
  setupModal.classList.remove("hidden");
}

document.getElementById("resumeGameBtn").addEventListener("click", () => {
  resumeModal.classList.add("hidden");
  try {
    const savedData = JSON.parse(savedDataString);
    loadGame(savedData);
  } catch (e) {
    console.error("Failed to load save data", e);
    setupModal.classList.remove("hidden");
  }
});

document.getElementById("startFreshBtn").addEventListener("click", () => {
  resumeModal.classList.add("hidden");
  localStorage.removeItem("cradle_ludo_save");
  localStorage.removeItem("ludoSave");
  setupModal.classList.remove("hidden");
});
