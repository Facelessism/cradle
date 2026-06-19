const boardElement = document.getElementById("board");
const playerCountElement = document.getElementById("playerCount");
const gridSizeElement = document.getElementById("gridSize");
const gridValueElement = document.getElementById("gridValue");
const currentPlayerElement = document.getElementById("currentPlayer");
const playerStatsElement = document.getElementById("playerStats");

const COLORS = ["red", "blue", "green", "yellow"];

let boardSize = 15;
let state = {};

gridSizeElement.addEventListener("input", () => {
    boardSize = +gridSizeElement.value;
    gridValueElement.textContent = `${boardSize} × ${boardSize}`;
});

const createBoard = size =>
    Array.from({ length: size }, () =>
        Array.from({ length: size }, () => ({
            owner: null,
            dots: 0
        }))
    );

function getCapacity(row, col) {
    const last = boardSize - 1;

    const edges =
        (row === 0) +
        (row === last) +
        (col === 0) +
        (col === last);

    return edges === 2 ? 2 : edges === 1 ? 3 : 4;
}

function renderBoard() {
    boardElement.innerHTML = "";
    boardElement.style.gridTemplateColumns = `repeat(${boardSize}, 28px)`;

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

function addDot(row, col) {
    const player = state.players[state.currentPlayer];
    const cell = state.board[row][col];

    if (cell.owner && cell.owner !== player) return;

    cell.owner = player;
    cell.dots++;

    resolveBoard();
    nextTurn();
    render();
}

function resolveBoard() {
    let changed = true;

    while (changed) {
        changed = false;

        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const cell = state.board[row][col];

                if (cell.dots >= getCapacity(row, col)) {
                    explode(row, col, cell.owner);
                    changed = true;
                }
            }
        }
    }
}

function explode(row, col, owner) {
    state.board[row][col] = {
        owner: null,
        dots: 0
    };

    for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
    ]) {
        const nr = row + dr;
        const nc = col + dc;

        if (
            nr < 0 ||
            nc < 0 ||
            nr >= boardSize ||
            nc >= boardSize
        ) continue;

        state.board[nr][nc].owner = owner;
        state.board[nr][nc].dots++;
    }
}

function nextTurn() {
    state.currentPlayer =
        (state.currentPlayer + 1) %
        state.players.length;
}

function renderStats() {
    playerStatsElement.innerHTML = "";

    state.players.forEach(player => {
        const count = state.board.flat().filter(
            cell => cell.owner === player
        ).length;

        const div = document.createElement("div");

        div.className = `player-card ${player}`;
        div.textContent = `${player.toUpperCase()} : ${count}`;

        playerStatsElement.appendChild(div);
    });
}

function render() {
    currentPlayerElement.textContent =
        state.players[state.currentPlayer];

    renderBoard();
    renderStats();
}

function startGame() {
    const count = +playerCountElement.value;

    state = {
        currentPlayer: 0,
        players: COLORS.slice(0, count),
        board: createBoard(boardSize)
    };

    render();
}

document
    .getElementById("newGame")
    .addEventListener("click", startGame);

startGame();
