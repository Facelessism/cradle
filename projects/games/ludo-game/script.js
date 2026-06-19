const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const turnLabel = document.getElementById("turnLabel");
const moveList = document.getElementById("moveList");
const moveCount = document.getElementById("moveCount");
const diceValueElement = document.getElementById("diceValue");

const COLORS = ["red", "green", "yellow", "blue"];

const TRACK = [
    [6,1],[6,2],[6,3],[6,4],[6,5],
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
    [0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
    [6,9],[6,10],[6,11],[6,12],
    [7,12],[7,11],[7,10],[7,9],
    [8,8],[9,8],[10,8],[11,8],[12,8],
    [12,7],[12,6],[11,6],[10,6],[9,6],[8,6],
    [7,5],[7,4],[7,3],[7,2],[7,1],[7,0],
    [6,0],[5,0],[4,0],[3,0],[2,0],[1,0],
    [1,1],[2,1],[3,1]
];

const START_INDEX = {
    red: 0,
    green: 13,
    yellow: 26,
    blue: 39
};

const HOME_CELLS = {
    red: [
        [1,1],[1,3],[3,1],[3,3]
    ],
    green: [
        [1,9],[1,11],[3,9],[3,11]
    ],
    yellow: [
        [9,1],[9,3],[11,1],[11,3]
    ],
    blue: [
        [9,9],[9,11],[11,9],[11,11]
    ]
};

let currentPlayer = 0;
let diceValue = null;
let history = [];
let gameOver = false;

const state = {
    red: createTokens("red"),
    green: createTokens("green"),
    yellow: createTokens("yellow"),
    blue: createTokens("blue")
};

function createTokens(color) {
    return Array.from({ length: 4 }, (_, id) => ({
        id,
        color,
        position: -1,
        finished: false
    }));
}

function renderBoard() {
    boardElement.innerHTML = "";

    for (let row = 0; row < 13; row++) {
        for (let col = 0; col < 13; col++) {

            const cell = document.createElement("div");

            cell.classList.add("cell");

            if (row <= 4 && col <= 4) {
                cell.classList.add("red-home");
            }
            else if (row <= 4 && col >= 8) {
                cell.classList.add("green-home");
            }
            else if (row >= 8 && col <= 4) {
                cell.classList.add("yellow-home");
            }
            else if (row >= 8 && col >= 8) {
                cell.classList.add("blue-home");
            }

            if (row === 6 || col === 6) {
                cell.classList.add("track");
            }

            cell.dataset.row = row;
            cell.dataset.col = col;

            boardElement.appendChild(cell);
        }
    }

    renderTokens();
}

function renderTokens() {

    COLORS.forEach(color => {

        state[color].forEach(token => {

            let row;
            let col;

            if (token.position === -1) {

                [row, col] =
                    HOME_CELLS[color][token.id];

            } else {

                const trackPosition =
                    TRACK[token.position];

                if (!trackPosition) return;

                [row, col] = trackPosition;
            }

            const cell = document.querySelector(
                `[data-row="${row}"][data-col="${col}"]`
            );

            if (!cell) return;

            const piece =
                document.createElement("div");

            piece.className =
                `token ${color}`;

            piece.title =
                `${capitalize(color)} Token ${token.id + 1}`;

            piece.addEventListener(
                "click",
                () => handleTokenClick(
                    color,
                    token.id
                )
            );

            cell.appendChild(piece);

        });

    });

}

function rollDice() {

    if (gameOver) return;

    if (diceValue !== null) {
        setStatus("Move a token first.");
        return;
    }

    diceValue =
        Math.floor(Math.random() * 6) + 1;

    diceValueElement.textContent =
        diceValue;

    setStatus(
        `${capitalize(
            COLORS[currentPlayer]
        )} rolled ${diceValue}`
    );

}

function handleTokenClick(color, tokenId) {

    if (gameOver) return;

    if (COLORS[currentPlayer] !== color) {
        return;
    }

    if (diceValue === null) {
        setStatus("Roll the dice first.");
        return;
    }

    const token =
        state[color][tokenId];

    if (token.finished) {
        return;
    }

    if (token.position === -1) {

        if (diceValue !== 6) {

            setStatus(
                "Need a 6 to leave base."
            );

            return;
        }

        token.position =
            START_INDEX[color];

        history.unshift(
            `${capitalize(color)} Token ${
                token.id + 1
            } entered the board`
        );

    } else {

        token.position += diceValue;

        if (
            token.position >=
            TRACK.length - 1
        ) {

            token.position =
                TRACK.length - 1;

            token.finished = true;

            history.unshift(
                `${capitalize(color)} Token ${
                    token.id + 1
                } reached home`
            );

        } else {

            history.unshift(
                `${capitalize(color)} Token ${
                    token.id + 1
                } moved ${diceValue} spaces`
            );

        }

    }

    if (checkWinner(color)) {

        gameOver = true;

        setStatus(
            `${capitalize(color)} wins!`
        );

        render();
        return;
    }

    nextTurn();
    render();

}

function nextTurn() {

    if (diceValue !== 6) {

        currentPlayer =
            (currentPlayer + 1) %
            COLORS.length;

    }

    diceValue = null;

    diceValueElement.textContent = "🎲";

    turnLabel.textContent =
        capitalize(
            COLORS[currentPlayer]
        );

    moveCount.textContent =
        history.length;

    setStatus(
        `${capitalize(
            COLORS[currentPlayer]
        )}'s turn`
    );

}

function checkWinner(color) {

    return state[color].every(
        token => token.finished
    );

}

function renderHistory() {

    moveList.innerHTML =
        history
            .map(
                move => `<li>${move}</li>`
            )
            .join("");

}

function render() {

    renderBoard();
    renderHistory();

}

function setStatus(text) {

    statusElement.textContent =
        text;

}

function capitalize(text) {

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );

}

function newGame() {

    COLORS.forEach(color => {

        state[color] =
            createTokens(color);

    });

    currentPlayer = 0;
    diceValue = null;
    history = [];
    gameOver = false;

    turnLabel.textContent = "Red";
    moveCount.textContent = "0";
    diceValueElement.textContent = "🎲";

    setStatus("Red's turn");

    render();

}

document
    .getElementById("rollDice")
    .addEventListener(
        "click",
        rollDice
    );

document
    .getElementById("newGame")
    .addEventListener(
        "click",
        newGame
    );

document
    .getElementById("backHome")
    .addEventListener(
        "click",
        () => {
            window.location.href = "/";
        }
    );

newGame();