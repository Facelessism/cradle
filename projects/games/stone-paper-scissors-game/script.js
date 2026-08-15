const emojis = {
  rock: "🪨",
  paper: "📄",
  scissors: "✂️",
  lizard: "🦎",
  spock: "🖖",
};
const choicesList = ["rock", "paper", "scissors"];

let playerScore = 0;
let computerScore = 0;
let streak = 0;
let gameMode = 1;
let targetWins = 1;
let playerTournamentWins = 0;
let computerTournamentWins = 0;

let currentRulesMode = "classic";
let gestureStats = { rock: 0, paper: 0, scissors: 0, lizard: 0, spock: 0 };
let totalRounds = 0;

const choiceBtns = document.querySelectorAll(".choice-btn");
const playerPickEl = document.getElementById("playerPick");
const computerPickEl = document.getElementById("computerPick");
const resultText = document.getElementById("resultText");
const playerScoreEl = document.getElementById("playerScore");
const computerScoreEl = document.getElementById("computerScore");
const streakEl = document.getElementById("streakCount");
const resetBtn = document.getElementById("resetBtn");
const battleArena = document.getElementById("battleArena");
const confettiContainer = document.getElementById("confettiContainer");
const modeBtns = document.querySelectorAll(".mode-btn");
const playerTallyEl = document.getElementById("playerTally");
const computerTallyEl = document.getElementById("computerTally");
const victoryModal = document.getElementById("victoryModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const playAgainBtn = document.getElementById("playAgainBtn");

const rulesModeSelect = document.getElementById("rulesMode");
if (rulesModeSelect) {
  rulesModeSelect.addEventListener("change", e => {
    currentRulesMode = e.target.value;
    updateModeUI();
  });
}

function updateModeUI() {
  const isLizardSpock = currentRulesMode === "lizard-spock";
  choicesList.length = 0;

  const lizardBtn = document.getElementById("lizardBtn");
  const spockBtn = document.getElementById("spockBtn");

  if (isLizardSpock) {
    choicesList.push("rock", "paper", "scissors", "lizard", "spock");
    if (lizardBtn) lizardBtn.style.display = "inline-flex";
    if (spockBtn) spockBtn.style.display = "inline-flex";
    document
      .querySelectorAll(".lizard-stat")
      .forEach(el => (el.style.display = "block"));
    document
      .querySelectorAll(".spock-stat")
      .forEach(el => (el.style.display = "block"));
    document
      .querySelectorAll(".lizard-how")
      .forEach(el => (el.style.display = "block"));
    document
      .querySelectorAll(".spock-how")
      .forEach(el => (el.style.display = "block"));
  } else {
    choicesList.push("rock", "paper", "scissors");
    if (lizardBtn) lizardBtn.style.display = "none";
    if (spockBtn) spockBtn.style.display = "none";
    document
      .querySelectorAll(".lizard-stat")
      .forEach(el => (el.style.display = "none"));
    document
      .querySelectorAll(".spock-stat")
      .forEach(el => (el.style.display = "none"));
    document
      .querySelectorAll(".lizard-how")
      .forEach(el => (el.style.display = "none"));
    document
      .querySelectorAll(".spock-how")
      .forEach(el => (el.style.display = "none"));
  }
  resetTournament();
}

function recordGesture(choice) {
  if (gestureStats[choice] !== undefined) {
    gestureStats[choice]++;
    totalRounds++;
    updateStatsUI();
  }
}

function updateStatsUI() {
  if (totalRounds === 0) return;
  ["rock", "paper", "scissors", "lizard", "spock"].forEach(key => {
    const el = document.getElementById(key + "Pct");
    if (el) {
      const pct = ((gestureStats[key] / totalRounds) * 100).toFixed(0);
      el.textContent = `${pct}%`;
    }
  });
}

function resetStats() {
  gestureStats = { rock: 0, paper: 0, scissors: 0, lizard: 0, spock: 0 };
  totalRounds = 0;
  ["rock", "paper", "scissors", "lizard", "spock"].forEach(key => {
    const el = document.getElementById(key + "Pct");
    if (el) el.textContent = "0%";
  });
}

modeBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    modeBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    gameMode = parseInt(btn.getAttribute("data-mode"));
    targetWins = Math.ceil(gameMode / 2);
    resetTournament();
  });
});

function renderTally() {
  if (gameMode === 1) {
    if (playerTallyEl) playerTallyEl.innerHTML = "";
    if (computerTallyEl) computerTallyEl.innerHTML = "";
    return;
  }

  if (playerTallyEl) playerTallyEl.innerHTML = "";
  if (computerTallyEl) computerTallyEl.innerHTML = "";

  for (let i = 0; i < targetWins; i++) {
    const pDot = document.createElement("div");
    pDot.classList.add("dot");
    if (i < playerTournamentWins) pDot.classList.add("won");
    if (playerTallyEl) playerTallyEl.appendChild(pDot);

    const cDot = document.createElement("div");
    cDot.classList.add("dot");
    if (i < computerTournamentWins) cDot.classList.add("won");
    if (computerTallyEl) computerTallyEl.appendChild(cDot);
  }
}

function resetTournament() {
  playerTournamentWins = 0;
  computerTournamentWins = 0;
  renderTally();
  resetBtn.click();
}

choiceBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const playerChoice = btn.getAttribute("data-choice");
    startCountdown(playerChoice);
  });
});

function triggerShake() {
  playerPickEl.classList.remove("shake");
  computerPickEl.classList.remove("shake");
  void playerPickEl.offsetWidth; // trigger reflow
  playerPickEl.classList.add("shake");
  computerPickEl.classList.add("shake");
}

function startCountdown(playerChoice) {
  toggleButtons(true);
  battleArena.classList.remove("win-glow", "lose-glow");
  playerPickEl.textContent = "🤔";
  computerPickEl.textContent = "🤔";

  const steps = ["ROCK...", "PAPER...", "SCISSORS...", "SHOOT!"];
  let i = 0;

  resultText.textContent = steps[i];
  triggerShake();

  const interval = setInterval(() => {
    i++;
    if (i < steps.length) {
      resultText.textContent = steps[i];
      if (i < 3) triggerShake();
    } else {
      clearInterval(interval);
      playerPickEl.classList.remove("shake");
      computerPickEl.classList.remove("shake");
      const computerChoice = getComputerChoice();
      playGame(playerChoice, computerChoice);
    }
  }, 400);
}

function getComputerChoice() {
  return choicesList[Math.floor(Math.random() * choicesList.length)];
}

function playGame(player, computer) {
  playerPickEl.textContent = emojis[player];
  computerPickEl.textContent = emojis[computer];
  playerPickEl.classList.add("pop");
  computerPickEl.classList.add("pop");
  setTimeout(() => {
    playerPickEl.classList.remove("pop");
    computerPickEl.classList.remove("pop");
  }, 400);

  recordGesture(player);
  const result = determineWinner(player, computer);

  if (result.outcome === "tie") {
    resultText.textContent = "🤝 " + result.message;
    streak = 0;
  } else if (result.outcome === "player") {
    resultText.textContent = "🎉 " + result.message;
    playerScore++;
    playerTournamentWins++;
    streak++;
    playerScoreEl.textContent = playerScore;
    battleArena.classList.add("win-glow");
    if (gameMode === 1) launchConfetti();
  } else {
    resultText.textContent = "💥 " + result.message;
    computerScore++;
    computerTournamentWins++;
    streak = 0;
    computerScoreEl.textContent = computerScore;
    battleArena.classList.add("lose-glow");
    document.body.classList.add("shake");
    setTimeout(() => document.body.classList.remove("shake"), 400);
  }

  streakEl.textContent = streak;
  renderTally();

  if (gameMode > 1) {
    if (playerTournamentWins >= targetWins) {
      setTimeout(() => showVictoryModal("Player"), 500);
    } else if (computerTournamentWins >= targetWins) {
      setTimeout(() => showVictoryModal("Computer"), 500);
    } else {
      toggleButtons(false);
    }
  } else {
    toggleButtons(false);
  }
}

function toggleButtons(disabled) {
  choiceBtns.forEach(btn => (btn.disabled = disabled));
}

resetBtn.addEventListener("click", () => {
  playerScore = 0;
  computerScore = 0;
  streak = 0;
  playerTournamentWins = 0;
  computerTournamentWins = 0;
  resetStats();
  renderTally();
  playerScoreEl.textContent = 0;
  computerScoreEl.textContent = 0;
  streakEl.textContent = 0;
  playerPickEl.textContent = "❓";
  computerPickEl.textContent = "❓";
  resultText.textContent = "Choose your weapon!";
  battleArena.classList.remove("win-glow", "lose-glow");
});

function showVictoryModal(winner) {
  victoryModal.classList.remove("hidden");
  if (winner === "Player") {
    modalTitle.textContent = "Tournament Complete";
    modalMessage.textContent = "You defeated the machine!";
    modalTitle.style.color = "#00f5ff";
    modalTitle.style.textShadow = "0 0 10px rgba(0, 245, 255, 0.4)";
    launchConfetti();
  } else {
    modalTitle.textContent = "Defeat";
    modalMessage.textContent = "The machine wins this time.";
    modalTitle.style.color = "#ff2e88";
    modalTitle.style.textShadow = "0 0 10px rgba(255, 46, 136, 0.4)";
  }
}

playAgainBtn.addEventListener("click", () => {
  victoryModal.classList.add("hidden");
  resetTournament();
  toggleButtons(false);
});

function launchConfetti() {
  const colors = ["#00f5ff", "#ff2e88", "#ffd23f"];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement("div");
    piece.classList.add("confetti-piece");
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.width = piece.style.height = Math.random() * 6 + 6 + "px";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = Math.random() * 1.5 + 1.5 + "s";
    confettiContainer.appendChild(piece);
    setTimeout(() => piece.remove(), 3000);
  }
}
