const isBrowser = typeof document !== "undefined";

const boardElement =
    isBrowser ? document.getElementById("board") : null;

const difficultySelect =
    isBrowser ? document.getElementById("difficulty") : null;

const newGameButton =
    isBrowser ? document.getElementById("newGame") : null;

const solveButton =
    isBrowser ? document.getElementById("solveBtn") : null;

const hintButton =
    isBrowser ? document.getElementById("hintBtn") : null;

const resetButton =
    isBrowser ? document.getElementById("resetBtn") : null;

const timerElement =
    isBrowser ? document.getElementById("timer") : null;

const messageElement =
    isBrowser ? document.getElementById("message") : null;

const headerStatus =
    isBrowser ? document.getElementById("headerStatus") : null;

const filledStat =
    isBrowser ? document.getElementById("filledStat") : null;

const hintStat =
    isBrowser ? document.getElementById("hintStat") : null;

const difficultyStat =
    isBrowser ? document.getElementById("difficultyStat") : null;

const difficultyDisplay =
    isBrowser ? document.getElementById("difficultyDisplay") : null;

const filledDisplay =
    isBrowser ? document.getElementById("filledDisplay") : null;

const puzzleState =
    isBrowser ? document.getElementById("puzzleState") : null;

const numberButtons =
    isBrowser ? document.querySelectorAll(".number-pad button") : [];


/* =========================================
   GAME STATE
========================================= */

let puzzle = [];

let solution = [];

let currentBoard = [];

let selectedCell = null;

let hintsUsed = 0;

let seconds = 0;

let timerInterval = null;

let gameStarted = false;


/* =========================================
   DIFFICULTY
========================================= */

const difficultySettings = {

    easy: {
        removed: 35
    },

    medium: {
        removed: 48
    },

    hard: {
        removed: 56
    }

};


/* =========================================
   START GAME
========================================= */

function startNewGame() {

    stopTimer();

    seconds = 0;

    hintsUsed = 0;

    selectedCell = null;

    gameStarted = true;

    updateTimer();

    const difficulty =
        difficultySelect.value;

    const generated =
        generatePuzzle(
            difficulty
        );

    puzzle = generated.puzzle;

    solution = generated.solution;

    currentBoard =
        puzzle.map(row => [...row]);

    renderBoard();

    updateStats();

    updateStatus(
        "New puzzle generated."
    );

    startTimer();

}


/* =========================================
   GENERATE PUZZLE
========================================= */

function generatePuzzle(difficulty) {

    const solved =
        createSolvedBoard();

    const puzzleBoard =
        solved.map(row => [...row]);

    const removeCount =
        difficultySettings[difficulty].removed;

    let removed = 0;

    while (removed < removeCount) {

        const row =
            Math.floor(Math.random() * 9);

        const col =
            Math.floor(Math.random() * 9);

        if (puzzleBoard[row][col] !== 0) {

            puzzleBoard[row][col] = 0;

            removed++;

        }

    }

    return {
        puzzle: puzzleBoard,
        solution: solved
    };

}


/* =========================================
   CREATE SOLVED BOARD
========================================= */

function createSolvedBoard() {

    const board =
        Array.from(
            { length: 9 },
            () => Array(9).fill(0)
        );

    fillBoard(board);

    return board;

}


/* =========================================
   SOLVER / GENERATOR
========================================= */

function fillBoard(board) {

    const empty =
        findEmptyCell(board);

    if (!empty) {
        return true;
    }

    const [row, col] = empty;

    const numbers =
        shuffledNumbers();

    for (const number of numbers) {

        if (
            isValidMove(
                board,
                row,
                col,
                number
            )
        ) {

            board[row][col] = number;

            if (fillBoard(board)) {
                return true;
            }

            board[row][col] = 0;

        }

    }

    return false;

}


/* =========================================
   FIND EMPTY CELL
========================================= */

function findEmptyCell(board) {

    for (let row = 0; row < 9; row++) {

        for (let col = 0; col < 9; col++) {

            if (board[row][col] === 0) {
                return [row, col];
            }

        }

    }

    return null;

}


/* =========================================
   VALIDATE MOVE
========================================= */

function isValidMove(
    board,
    row,
    col,
    number
) {

    for (let x = 0; x < 9; x++) {

        if (
            board[row][x] === number &&
            x !== col
        ) {
            return false;
        }

    }

    for (let x = 0; x < 9; x++) {

        if (
            board[x][col] === number &&
            x !== row
        ) {
            return false;
        }

    }

    const startRow =
        row - (row % 3);

    const startCol =
        col - (col % 3);

    for (
        let r = startRow;
        r < startRow + 3;
        r++
    ) {

        for (
            let c = startCol;
            c < startCol + 3;
            c++
        ) {

            if (
                board[r][c] === number &&
                (r !== row || c !== col)
            ) {
                return false;
            }

        }

    }

    return true;

}


/* =========================================
   SHUFFLE NUMBERS
========================================= */

function shuffledNumbers() {

    const numbers =
        [1, 2, 3, 4, 5, 6, 7, 8, 9];

    for (
        let i = numbers.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            numbers[i],
            numbers[j]
        ] = [
                numbers[j],
                numbers[i]
            ];

    }

    return numbers;

}


/* =========================================
   RENDER BOARD
========================================= */

function renderBoard() {

    boardElement.innerHTML = "";

    for (let row = 0; row < 9; row++) {

        for (let col = 0; col < 9; col++) {

            const cell =
                document.createElement("button");

            cell.className = "cell";

            cell.type = "button";

            cell.dataset.row = row;
            cell.dataset.col = col;

            const value =
                currentBoard[row][col];

            const original =
                puzzle[row][col];

            if (value !== 0) {

                cell.textContent = value;

            }

            if (original !== 0) {

                cell.classList.add(
                    "fixed"
                );

            } else if (value !== 0) {

                cell.classList.add(
                    "user-input"
                );

            }

            cell.addEventListener(
                "click",
                () => selectCell(row, col)
            );

            boardElement.appendChild(cell);

        }

    }

}


/* =========================================
   SELECT CELL
========================================= */

function selectCell(row, col) {

    selectedCell = {
        row,
        col
    };

    updateCellHighlights();

}


/* =========================================
   HIGHLIGHT CELLS
========================================= */

function updateCellHighlights() {

    const cells =
        document.querySelectorAll(
            ".cell"
        );

    cells.forEach(cell => {

        cell.classList.remove(
            "selected",
            "related",
            "same-number"
        );

    });

    if (!selectedCell) {
        return;
    }

    const {
        row,
        col
    } = selectedCell;

    const selectedValue =
        currentBoard[row][col];

    cells.forEach(cell => {

        const r =
            Number(cell.dataset.row);

        const c =
            Number(cell.dataset.col);

        if (r === row && c === col) {

            cell.classList.add(
                "selected"
            );

            return;

        }

        if (
            r === row ||
            c === col ||
            (
                Math.floor(r / 3) ===
                Math.floor(row / 3) &&
                Math.floor(c / 3) ===
                Math.floor(col / 3)
            )
        ) {

            cell.classList.add(
                "related"
            );

        }

        if (
            selectedValue !== 0 &&
            currentBoard[r][c] ===
            selectedValue
        ) {

            cell.classList.add(
                "same-number"
            );

        }

    });

}


/* =========================================
   ENTER NUMBER
========================================= */

function enterNumber(number) {

    if (!selectedCell) {

        updateStatus(
            "Select a cell first."
        );

        return;

    }

    const {
        row,
        col
    } = selectedCell;

    // Fixed cells cannot be changed

    if (puzzle[row][col] !== 0) {

        updateStatus(
            "That number is part of the puzzle."
        );

        return;

    }


    // Erase

    if (number === 0) {

        currentBoard[row][col] = 0;

        renderBoard();

        selectCell(row, col);

        updateStats();

        updateStatus(
            "Cell cleared."
        );

        return;

    }


    // Check move

    if (
        !isValidMove(
            currentBoard,
            row,
            col,
            number
        )
    ) {

        markError(
            row,
            col
        );

        updateStatus(
            "That number conflicts with this row, column, or box."
        );

        return;

    }


    currentBoard[row][col] =
        number;

    renderBoard();

    selectCell(row, col);

    updateStats();

    checkCompletion();

}


/* =========================================
   ERROR
========================================= */

function markError(row, col) {

    const cell =
        document.querySelector(
            `.cell[data-row="${row}"][data-col="${col}"]`
        );

    if (!cell) {
        return;
    }

    cell.classList.add("error");

    setTimeout(() => {

        cell.classList.remove(
            "error"
        );

    }, 500);

}


/* =========================================
   HINT
========================================= */

function giveHint() {

    if (!selectedCell) {

        // Find random empty cell

        const emptyCells = [];

        for (
            let row = 0;
            row < 9;
            row++
        ) {

            for (
                let col = 0;
                col < 9;
                col++
            ) {

                if (
                    puzzle[row][col] === 0 &&
                    currentBoard[row][col] === 0
                ) {

                    emptyCells.push({
                        row,
                        col
                    });

                }

            }

        }

        if (emptyCells.length === 0) {

            updateStatus(
                "No empty cells available."
            );

            return;

        }

        selectedCell =
            emptyCells[
            Math.floor(
                Math.random() *
                emptyCells.length
            )
            ];

    }


    const {
        row,
        col
    } = selectedCell;


    if (puzzle[row][col] !== 0) {

        updateStatus(
            "Select an empty cell for a hint."
        );

        return;

    }


    currentBoard[row][col] =
        solution[row][col];

    hintsUsed++;

    renderBoard();

    const cell =
        document.querySelector(
            `.cell[data-row="${row}"][data-col="${col}"]`
        );

    if (cell) {

        cell.classList.add(
            "hint"
        );

    }

    selectCell(row, col);

    updateStats();

    updateStatus(
        "Hint added."
    );

    checkCompletion();

}


/* =========================================
   VALIDATION LOGIC
========================================= */

function validateBoard(board) {
    if (!Array.isArray(board) || board.length !== 9) {
        throw new Error("Board must have exactly 9 rows.");
    }
    for (let r = 0; r < 9; r++) {
        const row = board[r];
        if (!Array.isArray(row) || row.length !== 9) {
            throw new Error(`Row ${r + 1} must have exactly 9 columns.`);
        }
        for (let c = 0; c < 9; c++) {
            const val = row[c];
            if (!Number.isInteger(val) || val < 0 || val > 9) {
                throw new Error(`Invalid value ${val} at row ${r + 1}, column ${c + 1}.`);
            }
        }
    }

    // Check duplicate rows
    for (let r = 0; r < 9; r++) {
        const seen = new Set();
        for (let c = 0; c < 9; c++) {
            const val = board[r][c];
            if (val !== 0) {
                if (seen.has(val)) {
                    throw new Error(`Row ${r + 1} has duplicate value ${val}.`);
                }
                seen.add(val);
            }
        }
    }

    // Check duplicate columns
    for (let c = 0; c < 9; c++) {
        const seen = new Set();
        for (let r = 0; r < 9; r++) {
            const val = board[r][c];
            if (val !== 0) {
                if (seen.has(val)) {
                    throw new Error(`Column ${c + 1} has duplicate value ${val}.`);
                }
                seen.add(val);
            }
        }
    }

    // Check duplicate 3x3 subgrids
    for (let boxRow = 0; boxRow < 3; boxRow++) {
        for (let boxCol = 0; boxCol < 3; boxCol++) {
            const seen = new Set();
            const startRow = boxRow * 3;
            const startCol = boxCol * 3;
            for (let r = startRow; r < startRow + 3; r++) {
                for (let c = startCol; c < startCol + 3; c++) {
                    const val = board[r][c];
                    if (val !== 0) {
                        if (seen.has(val)) {
                            throw new Error(`Subgrid starting at row ${startRow + 1}, column ${startCol + 1} has duplicate value ${val}.`);
                        }
                        seen.add(val);
                    }
                }
            }
        }
    }

    return true;
}

function solveSudoku(board) {
    validateBoard(board);
    const boardCopy = board.map(row => [...row]);
    const solved = fillBoard(boardCopy);
    if (!solved) {
        throw new Error("Puzzle is unsolvable.");
    }
    return boardCopy;
}


/* =========================================
   SOLVE
========================================= */

function solvePuzzle() {
    try {
        validateBoard(currentBoard);

        const boardCopy = currentBoard.map(row => [...row]);
        if (fillBoard(boardCopy)) {
            currentBoard = boardCopy;
            renderBoard();
            updateStats();
            if (puzzleState) {
                puzzleState.textContent = "Solved";
            }
            updateStatus("Puzzle solved!");
            stopTimer();
        } else {
            updateStatus("Puzzle is unsolvable.");
        }
    } catch (error) {
        updateStatus(error.message || "Invalid board input.");
    }
}


/* =========================================
   RESET
========================================= */

function resetPuzzle() {

    currentBoard =
        puzzle.map(row => [...row]);

    selectedCell = null;

    hintsUsed = 0;

    renderBoard();

    updateStats();

    updateStatus(
        "Puzzle reset."
    );

    if (puzzleState) {
        puzzleState.textContent =
            "In Progress";
    }

}


/* =========================================
   CHECK COMPLETION
========================================= */

function checkCompletion() {

    for (let row = 0; row < 9; row++) {

        for (let col = 0; col < 9; col++) {

            if (
                currentBoard[row][col] === 0
            ) {

                return false;

            }

        }

    }


    for (let row = 0; row < 9; row++) {

        for (let col = 0; col < 9; col++) {

            if (
                currentBoard[row][col] !==
                solution[row][col]
            ) {

                return false;

            }

        }

    }


    if (puzzleState) {
        puzzleState.textContent =
            "Completed";
    }

    if (headerStatus) {
        headerStatus.textContent =
            "Puzzle Complete";
    }

    updateStatus(
        "🎉 Congratulations! Puzzle completed."
    );

    stopTimer();

    return true;

}


/* =========================================
   UPDATE STATS
========================================= */

function updateStats() {

    let filled = 0;

    for (let row = 0; row < 9; row++) {

        for (let col = 0; col < 9; col++) {

            if (
                currentBoard[row][col] !== 0
            ) {

                filled++;

            }

        }

    }

    if (isBrowser) {
        const difficulty =
            capitalize(
                difficultySelect.value
            );

        if (difficultyStat) {
            difficultyStat.textContent = difficulty;
        }

        if (difficultyDisplay) {
            difficultyDisplay.textContent = difficulty;
        }

        if (filledStat) {
            filledStat.textContent = filled;
        }

        if (filledDisplay) {
            filledDisplay.textContent = `${filled} / 81`;
        }

        if (hintStat) {
            hintStat.textContent = hintsUsed;
        }
    }

}


/* =========================================
   STATUS MESSAGE
========================================= */

function updateStatus(message) {

    if (isBrowser) {
        if (messageElement) {
            messageElement.textContent = message;
        }

        if (headerStatus) {
            headerStatus.textContent = message;
        }
    }

}


/* =========================================
   TIMER
========================================= */

function startTimer() {

    stopTimer();

    timerInterval =
        setInterval(() => {

            seconds++;

            updateTimer();

        }, 1000);

}

function stopTimer() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );

        timerInterval = null;

    }

}

function updateTimer() {

    const minutes =
        Math.floor(
            seconds / 60
        );

    const secs =
        seconds % 60;

    if (timerElement) {
        timerElement.textContent =
            `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

}


/* =========================================
   CAPITALIZE
========================================= */

function capitalize(value) {

    return value.charAt(0).toUpperCase() +
        value.slice(1);

}


/* =========================================
   SETUP AND INITIALIZATION
========================================= */

if (isBrowser) {
    numberButtons.forEach(button => {
        button.addEventListener("click", () => {
            const number = Number(button.dataset.number);
            enterNumber(number);
        });
    });

    document.addEventListener("keydown", event => {
        const key = event.key;
        if (/^[1-9]$/.test(key)) {
            enterNumber(Number(key));
        }
        if (key === "Backspace" || key === "Delete" || key === "0") {
            enterNumber(0);
        }
    });

    newGameButton.addEventListener("click", startNewGame);
    solveButton.addEventListener("click", solvePuzzle);
    hintButton.addEventListener("click", giveHint);
    resetButton.addEventListener("click", resetPuzzle);
    difficultySelect.addEventListener("change", () => {
        startNewGame();
    });

    startNewGame();
}


/* =========================================
   MODULE EXPORTS
========================================= */

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        isValidMove,
        fillBoard,
        validateBoard,
        solveSudoku,
    };
}