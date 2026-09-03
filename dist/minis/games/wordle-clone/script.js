/* =========================
   Wordle Configuration
========================= */

const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 6;

/*
  You can expand this list later.
  Keep all words exactly 5 letters.
*/

const WORDS = [
    "CRANE",
    "PLANT",
    "LIGHT",
    "HOUSE",
    "WORLD",
    "APPLE",
    "TRAIN",
    "BRAVE",
    "SMILE",
    "GRAPE",
    "MOUSE",
    "STONE",
    "WATER",
    "HEART",
    "CLOUD",
    "SPACE",
    "GREEN",
    "CHAIR",
    "BRAIN",
    "DREAM"
];


/* =========================
   Game State
========================= */

let answer = "";
let currentGuess = "";
let currentRow = 0;

let gameOver = false;


/* =========================
   DOM Elements
========================= */

const rows = document.querySelectorAll(".row");

const message = document.getElementById("message");

const attemptCounter =
    document.getElementById("attemptCounter");

const gameStatus =
    document.getElementById("gameStatus");

const restartBtn =
    document.getElementById("restartBtn");

const themeBtn =
    document.getElementById("themeBtn");

const keyboardButtons =
    document.querySelectorAll(".keyboard button");


/* =========================
   Start Game
========================= */

function startGame() {

    answer =
        WORDS[Math.floor(Math.random() * WORDS.length)];

    currentGuess = "";
    currentRow = 0;
    gameOver = false;

    message.textContent = "";

    gameStatus.textContent = "Playing";

    attemptCounter.textContent =
        `0 / ${MAX_ATTEMPTS}`;

    clearBoard();

    resetKeyboard();
}


/* =========================
   Clear Board
========================= */

function clearBoard() {

    document.querySelectorAll(".tile").forEach(tile => {

        tile.textContent = "";

        tile.className = "tile";

    });
}


/* =========================
   Reset Keyboard
========================= */

function resetKeyboard() {

    keyboardButtons.forEach(button => {

        button.classList.remove(
            "correct",
            "present",
            "absent"
        );

    });
}


/* =========================
   Add Letter
========================= */

function addLetter(letter) {

    if (gameOver) return;

    if (currentGuess.length >= WORD_LENGTH) {
        return;
    }

    currentGuess += letter;

    const tiles = rows[currentRow].querySelectorAll(".tile");

    const index = currentGuess.length - 1;

    tiles[index].textContent = letter;

    tiles[index].classList.add("filled");
}


/* =========================
   Remove Letter
========================= */

function removeLetter() {

    if (gameOver) return;

    if (currentGuess.length === 0) {
        return;
    }

    const index = currentGuess.length - 1;

    const tiles =
        rows[currentRow].querySelectorAll(".tile");

    tiles[index].textContent = "";

    tiles[index].classList.remove("filled");

    currentGuess =
        currentGuess.slice(0, -1);
}


/* =========================
   Submit Guess
========================= */

function submitGuess() {

    if (gameOver) return;

    if (currentGuess.length !== WORD_LENGTH) {

        showMessage(
            "Enter a five-letter word."
        );

        return;
    }

    evaluateGuess();

    currentRow++;

    attemptCounter.textContent =
        `${currentRow} / ${MAX_ATTEMPTS}`;

    if (currentGuess === answer) {

        endGame(true);

        return;
    }

    if (currentRow === MAX_ATTEMPTS) {

        endGame(false);

        return;
    }

    currentGuess = "";
}


/* =========================
   Evaluate Guess
========================= */

function evaluateGuess() {

    const tiles =
        rows[currentRow].querySelectorAll(".tile");

    const letters =
        answer.split("");

    const guess =
        currentGuess.split("");

    const result =
        Array(WORD_LENGTH).fill("absent");


    /*
      First pass:
      Find exact matches.
    */

    guess.forEach((letter, index) => {

        if (letter === letters[index]) {

            result[index] = "correct";

            letters[index] = null;
        }

    });


    /*
      Second pass:
      Find letters in wrong positions.
    */

    guess.forEach((letter, index) => {

        if (result[index] === "correct") {
            return;
        }

        const foundIndex =
            letters.indexOf(letter);

        if (foundIndex !== -1) {

            result[index] = "present";

            letters[foundIndex] = null;
        }

    });


    /*
      Apply tile results.
    */

    result.forEach((status, index) => {

        setTimeout(() => {

            tiles[index].classList.remove("filled");

            tiles[index].classList.add(status);

            updateKeyboard(
                guess[index],
                status
            );

        }, index * 100);

    });
}


/* =========================
   Keyboard Status
========================= */

function updateKeyboard(letter, status) {

    const button =
        document.querySelector(
            `[data-key="${letter}"]`
        );

    if (!button) return;


    /*
      Never downgrade a better result.
  
      correct > present > absent
    */

    if (
        button.classList.contains("correct")
    ) {
        return;
    }

    if (
        button.classList.contains("present") &&
        status === "absent"
    ) {
        return;
    }

    button.classList.remove(
        "correct",
        "present",
        "absent"
    );

    button.classList.add(status);
}


/* =========================
   End Game
========================= */

function endGame(won) {

    gameOver = true;

    if (won) {

        gameStatus.textContent = "Won";

        showMessage(
            `Nice! You found "${answer}".`
        );

    } else {

        gameStatus.textContent = "Game Over";

        showMessage(
            `The word was "${answer}".`
        );

    }

}


/* =========================
   Message Helper
========================= */

function showMessage(text) {

    message.textContent = text;

    setTimeout(() => {

        if (!gameOver) {
            message.textContent = "";
        }

    }, 2000);
}


/* =========================
   Keyboard Click
========================= */

keyboardButtons.forEach(button => {

    button.addEventListener("click", () => {

        const key =
            button.dataset.key;

        handleKey(key);

    });

});


/* =========================
   Physical Keyboard
========================= */

document.addEventListener(
    "keydown",
    event => {

        let key =
            event.key.toUpperCase();

        if (key === "BACKSPACE") {

            removeLetter();

            return;
        }

        if (key === "ENTER") {

            submitGuess();

            return;
        }

        if (/^[A-Z]$/.test(key)) {

            addLetter(key);

        }

    }
);


/* =========================
   Handle Keyboard Input
========================= */

function handleKey(key) {

    if (key === "ENTER") {

        submitGuess();

        return;
    }

    if (key === "BACKSPACE") {

        removeLetter();

        return;
    }

    if (/^[A-Z]$/.test(key)) {

        addLetter(key);

    }
}


/* =========================
   Restart
========================= */

restartBtn.addEventListener(
    "click",
    startGame
);


/* =========================
   Theme Toggle
========================= */

themeBtn.addEventListener(
    "click",
    () => {

        document.body.classList.toggle("dark");

        const isDark =
            document.body.classList.contains("dark");

        localStorage.setItem(
            "cradle-wordle-theme",
            isDark ? "dark" : "light"
        );

    }
);


/* =========================
   Load Saved Theme
========================= */

const savedTheme =
    localStorage.getItem(
        "cradle-wordle-theme"
    );

if (savedTheme === "dark") {

    document.body.classList.add("dark");

}


/* =========================
   Initialize
========================= */

startGame();