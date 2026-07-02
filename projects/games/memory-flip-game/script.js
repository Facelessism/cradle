// ---------------------------------------------------------
// Setup
// ---------------------------------------------------------

const SYMBOLS = [
  "🍀","🍄","🍁","🌵","🌸","🌙","⭐","☀️",
  "⚡","❄️","🔥","🌊","🍉","🍋","🍒","🍇",
  "🦊","🐼","🐢","🐙","🦋","🐝","🐳","🦄",
  "🎈","🎲","🎯","🎧","🧩","🔑","💎","🚀"
];

const homeScreen = document.getElementById("homeScreen");
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");
const navStats = document.getElementById("navStats");
const board = document.getElementById("board");
const flipCountEl = document.getElementById("flipCount");
const matchCountEl = document.getElementById("matchCount");
const finalFlipsEl = document.getElementById("finalFlips");

let flippedCards = [];
let matchedPairs = 0;
let flipCount = 0;
let boardLocked = false;

// ---------------------------------------------------------
// Screen switching
// ---------------------------------------------------------

function showScreen(screen){
  homeScreen.hidden = screen !== "home";
  gameScreen.hidden = screen !== "game";
  resultScreen.hidden = screen !== "result";
  navStats.hidden = screen !== "game";
}

// ---------------------------------------------------------
// Game setup
// ---------------------------------------------------------

function shuffle(array){
  for (let i = array.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildDeck(){
  const deck = shuffle([...SYMBOLS, ...SYMBOLS]);
  return deck.map((symbol, index) => ({ id: index, symbol }));
}

function startGame(){
  flippedCards = [];
  matchedPairs = 0;
  flipCount = 0;
  boardLocked = false;
  flipCountEl.textContent = "0";
  matchCountEl.textContent = "0 / 32";

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

function onCardClick(card){
  if (boardLocked) return;
  if (card.classList.contains("is-flipped") || card.classList.contains("is-matched")) return;
  if (flippedCards.length === 2) return;

  card.classList.add("is-flipped");
  flippedCards.push(card);

  if (flippedCards.length === 2){
    flipCount++;
    flipCountEl.textContent = flipCount;
    checkForMatch();
  }
}

function checkForMatch(){
  const [first, second] = flippedCards;
  const isMatch = first.dataset.symbol === second.dataset.symbol;

  if (isMatch){
    first.classList.add("is-matched");
    second.classList.add("is-matched");
    flippedCards = [];
    matchedPairs++;
    matchCountEl.textContent = `${matchedPairs} / 32`;

    if (matchedPairs === SYMBOLS.length){
      setTimeout(endGame, 500);
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
    }, 700);
  }
}

function endGame(){
  finalFlipsEl.textContent = flipCount;
  showScreen("result");
}

// ---------------------------------------------------------
// Events
// ---------------------------------------------------------

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("restartBtn").addEventListener("click", startGame);
document.getElementById("playAgainBtn").addEventListener("click", startGame);
