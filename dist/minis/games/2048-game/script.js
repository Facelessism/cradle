const logic = window.__2048Logic;
const { createInitialState, moveGameState } = logic || {};

const boardElement = document.getElementById("board");
const scoreElement = document.getElementById("scoreValue");
const bestScoreElement = document.getElementById("bestScoreValue");
const statusElement = document.getElementById("status");
const restartButton = document.getElementById("restartBtn");
const gridSizeSelect = document.getElementById("gridSize");

const undoButton = document.getElementById('undoBtn');
const themeSelect = document.getElementById('themeSelect');

let currentSize = 4;
let state = null;
let undoManager = window.GameUndoManager ? window.GameUndoManager.createUndoManager(10) : null;

function initGame() {
  if (gridSizeSelect) {
    currentSize = parseInt(gridSizeSelect.value, 10);
  }
  
  if (undoManager) {
    undoManager.clear();
  }

  // Try loading saved state
  const saved = loadGameState(currentSize);
  if (saved) {
    state = saved;
  } else {
    state = createInitialState(currentSize);
  }

  // Load best score
  state.bestScore = getBestScore(currentSize);

  // Update board grid layout
  boardElement.style.gridTemplateColumns = `repeat(${currentSize}, 1fr)`;

  renderBoard();
}

function renderBoard() {
  boardElement.innerHTML = "";

  state.board.forEach(row => {
    row.forEach(value => {
      const tile = document.createElement("div");
      tile.className = `tile ${value ? `tile--${value}` : "tile--empty"}`;
      tile.textContent = value || "";
      boardElement.appendChild(tile);
    });
  });

  scoreElement.textContent = state.score;
  saveBestScore(state.size, state.score);
  state.bestScore = getBestScore(state.size);
  bestScoreElement.textContent = state.bestScore;

  if (undoButton && undoManager) {
    undoButton.disabled = !undoManager.getCanUndo();
  }

  if (state.won) {
    statusElement.textContent =
      "You reached 2048. Keep going or restart for a fresh run.";
  } else if (state.over) {
    statusElement.textContent = "No moves left. Press restart to play again.";
  } else {
    statusElement.textContent = "Use the arrow keys to move the tiles.";
  }
}

function handleMove(direction) {
  if (undoManager) {
    undoManager.pushState(state);
  }

  const nextState = moveGameState(state, direction);

  if (!nextState.moved) {
    if (undoManager) undoManager.undo(); // Pop if no move occurred
    return;
  }

  state = nextState;
  saveGameState(state.size, state);
  saveBestScore(state.size, state.score);
  renderBoard();
}

function handleUndo() {
  if (!undoManager || !undoManager.getCanUndo()) return;
  state = undoManager.undo(state);
  saveGameState(state.size, state);
  renderBoard();
}

function restartGame() {
  if (undoManager) undoManager.clear();
  clearGameState(currentSize);
  state = createInitialState(currentSize);
  renderBoard();
}

function handleKeydown(event) {
  const map = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
  };

  const direction = map[event.key];
  if (!direction) {
    return;
  }

  event.preventDefault();
  handleMove(direction);
}


restartButton.addEventListener("click", restartGame);
document.addEventListener("keydown", handleKeydown);

initGame();
