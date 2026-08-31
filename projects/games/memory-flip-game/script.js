// ---------------------------------------------------------
// Setup
// ---------------------------------------------------------

const SYMBOLS = [
  "🍀",
  "🍄",
  "🍁",
  "🌵",
  "🌸",
  "🌙",
  "⭐",
  "☀️",
  "⚡",
  "❄️",
  "🔥",
  "🌊",
  "🍉",
  "🍋",
  "🍒",
  "🍇",
  "🦊",
  "🐼",
  "🐢",
  "🐙",
  "🦋",
  "🐝",
  "🐳",
  "🦄",
  "🎈",
  "🎲",
  "🎯",
  "🎧",
  "🧩",
  "🔑",
  "💎",
  "🚀",
];

const homeScreen = document.getElementById("homeScreen");
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");
const navStats = document.getElementById("navStats");
const board = document.getElementById("board");
const flipCountEl = document.getElementById("flipCount");
const matchCountEl = document.getElementById("matchCount");
const finalFlipsEl = document.getElementById("finalFlips");

const gameModeSelect = document.getElementById("gameMode");
const flipsCountStat = document.getElementById("flipsCountStat");
const flipsLimitStat = document.getElementById("flipsLimitStat");
const flipsLeftEl = document.getElementById("flipsLeft");
const bestStandardEl = document.getElementById("bestStandard");
const bestChallengeEl = document.getElementById("bestChallenge");
const resultLabel = document.getElementById("resultLabel");
const resultTitle = document.getElementById("resultTitle");
const newRecordMsg = document.getElementById("newRecordMsg");

let flippedCards = [];
let matchedPairs = 0;
let flipCount = 0;
let flipsLeft = 50;
let currentMode = "standard";
const MAX_FLIPS_CHALLENGE = 50;
let boardLocked = false;

function updateHighScoreDisplays() {
  const stdScore = getHighScore("standard");
  const chgScore = getHighScore("challenge");
  if (bestStandardEl)
    bestStandardEl.textContent = stdScore !== null ? stdScore : "--";
  if (bestChallengeEl)
    bestChallengeEl.textContent = chgScore !== null ? chgScore : "--";
}

// ---------------------------------------------------------
// Screen switching
// ---------------------------------------------------------

function showScreen(screen) {
  homeScreen.hidden = screen !== "home";
  gameScreen.hidden = screen !== "game";
  resultScreen.hidden = screen !== "result";
  navStats.hidden = screen !== "game";
}

// ---------------------------------------------------------
// Game setup
// ---------------------------------------------------------

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildDeck() {
  const deck = shuffle([...SYMBOLS, ...SYMBOLS]);
  return deck.map((symbol, index) => ({ id: index, symbol }));
}

function startGame() {
  flippedCards = [];
  matchedPairs = 0;
  flipCount = 0;
  flipsLeft = MAX_FLIPS_CHALLENGE;
  boardLocked = false;

  if (gameModeSelect) {
    currentMode = gameModeSelect.value;
  }

  if (currentMode === "challenge") {
    if (flipsLimitStat) flipsLimitStat.hidden = false;
    if (flipsCountStat) flipsCountStat.hidden = true;
    if (flipsLeftEl) flipsLeftEl.textContent = flipsLeft;
  } else {
    if (flipsLimitStat) flipsLimitStat.hidden = true;
    if (flipsCountStat) flipsCountStat.hidden = false;
    flipCountEl.textContent = "0";
  }

  matchCountEl.textContent = "0 / " + SYMBOLS.length;

  board.innerHTML = "";
  const deck = buildDeck();

  deck.forEach(cardData => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = cardData.id;
    card.dataset.symbol = cardData.symbol;

    card.innerHTML = `
      <div class="card__inner">
        <div class="card__face card__face--back"></div>
        <div class="card__face card__face--front">${cardData.symbol}</div>
      </div>
    `;

    card.addEventListener("click", () => onCardClick(card));
    board.appendChild(card);
  });

  showScreen("game");
}

// ---------------------------------------------------------
// Game logic
// ---------------------------------------------------------

function onCardClick(card) {
  if (boardLocked) return;
  if (
    card.classList.contains("is-flipped") ||
    card.classList.contains("is-matched")
  )
    return;
  if (flippedCards.length === 2) return;
  if (currentMode === "challenge" && flipsLeft <= 0) return;

  card.classList.add("is-flipped");
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    if (currentMode === "challenge") {
      flipsLeft--;
      if (flipsLeftEl) flipsLeftEl.textContent = flipsLeft;
    } else {
      flipCount++;
      flipCountEl.textContent = flipCount;
    }
    checkForMatch();
  }
}

function checkForMatch() {
  const [first, second] = flippedCards;
  const isMatch = first.dataset.symbol === second.dataset.symbol;

  if (isMatch) {
    first.classList.add("is-matched");
    second.classList.add("is-matched");
    flippedCards = [];
    matchedPairs++;
    matchCountEl.textContent = `${matchedPairs} / ${SYMBOLS.length}`;

    if (matchedPairs === SYMBOLS.length) {
      setTimeout(() => endGame(true), 500);
    } else if (currentMode === "challenge" && flipsLeft <= 0) {
      setTimeout(() => endGame(false), 500);
    }
  } else {
    boardLocked = true;
    first.classList.add("is-mismatch");
    second.classList.add("is-mismatch");

    setTimeout(() => {
      first.classList.remove("is-flipped", "is-mismatch");
      second.classList.remove("is-flipped", "is-mismatch");
      flippedCards = [];
      boardLocked = false;

      if (
        currentMode === "challenge" &&
        flipsLeft <= 0 &&
        matchedPairs < SYMBOLS.length
      ) {
        endGame(false);
      }
    }, 700);
  }
}

function endGame(victory) {
  if (newRecordMsg) newRecordMsg.hidden = true;

  if (victory) {
    if (resultLabel) resultLabel.textContent = "Board cleared";
    if (currentMode === "standard") {
      if (finalFlipsEl) finalFlipsEl.textContent = flipCount;
      if (resultTitle)
        resultTitle.innerHTML = `Solved in <span id="finalFlips">${flipCount}</span> flips`;
      if (resultCopy)
        resultCopy.textContent = "Every pair found. Great memory!";
      const isNew = saveHighScore(flipCount, "standard");
      if (newRecordMsg && isNew) newRecordMsg.hidden = false;
    } else {
      const spent = MAX_FLIPS_CHALLENGE - flipsLeft;
      if (finalFlipsEl) finalFlipsEl.textContent = spent;
      if (resultTitle)
        resultTitle.innerHTML = `Solved in <span id="finalFlips">${spent}</span> flips`;
      if (resultCopy)
        resultCopy.textContent = "Every pair found in challenge mode!";
      const isNew = saveHighScore(spent, "challenge");
      if (newRecordMsg && isNew) newRecordMsg.hidden = false;
    }
  } else {
    if (resultLabel) resultLabel.textContent = "Game Over";
    if (resultTitle) resultTitle.innerHTML = "Out of Flips!";
    if (resultCopy)
      resultCopy.textContent =
        "You ran out of flips in Challenge Mode. Try again!";
  }

  showScreen("result");
  updateHighScoreDisplays();
}

// ---------------------------------------------------------
// Events
// ---------------------------------------------------------

document.getElementById("startBtn")?.addEventListener("click", startGame);
document.getElementById("restartBtn")?.addEventListener("click", startGame);
document.getElementById("playAgainBtn")?.addEventListener("click", startGame);

// Initialize High Scores on load
updateHighScoreDisplays();
