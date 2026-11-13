/**
 * Typing Speed Racer — main game logic
 * A typing speed test with a racing twist.
 */

// ─── Word Banks ────────────────────────────────────────────────────
const WORD_BANKS = {
  easy: [
    "the",
    "and",
    "for",
    "are",
    "but",
    "not",
    "you",
    "all",
    "can",
    "had",
    "her",
    "was",
    "one",
    "our",
    "out",
    "day",
    "get",
    "has",
    "him",
    "his",
    "how",
    "its",
    "may",
    "new",
    "now",
    "old",
    "see",
    "way",
    "who",
    "boy",
    "did",
    "let",
    "put",
    "say",
    "she",
    "too",
    "use",
    "big",
    "end",
    "far",
    "low",
    "run",
    "set",
    "try",
    "ask",
    "men",
    "own",
    "pin",
    "red",
    "six",
    "top",
    "war",
    "hot",
    "box",
    "car",
    "dog",
    "eye",
    "fan",
    "gun",
    "hat",
    "ice",
    "job",
    "key",
    "lip",
    "map",
    "net",
    "oil",
    "pen",
    "rat",
    "sun",
    "toy",
    "van",
    "win",
    "yes",
    "zip",
    "act",
    "age",
    "air",
    "arm",
    "bed",
  ],
  medium: [
    "about",
    "after",
    "again",
    "being",
    "below",
    "black",
    "bring",
    "carry",
    "clean",
    "close",
    "could",
    "dance",
    "early",
    "earth",
    "eight",
    "every",
    "found",
    "gave",
    "going",
    "green",
    "great",
    "house",
    "human",
    "image",
    "known",
    "large",
    "learn",
    "leave",
    "light",
    "might",
    "money",
    "month",
    "music",
    "night",
    "north",
    "often",
    "order",
    "other",
    "place",
    "plant",
    "point",
    "power",
    "press",
    "quick",
    "reach",
    "right",
    "river",
    "round",
    "shape",
    "should",
    "small",
    "sound",
    "south",
    "space",
    "speak",
    "start",
    "still",
    "stone",
    "story",
    "study",
    "table",
    "theme",
    "think",
    "today",
    "total",
    "track",
    "under",
    "until",
    "upper",
    "usual",
    "voice",
    "watch",
    "wheel",
    "world",
    "write",
    "young",
    "block",
    "brain",
    "cable",
    "charm",
  ],
  hard: [
    "absolute",
    "abstract",
    "accurate",
    "achieved",
    "acquired",
    "actively",
    "adequate",
    "advanced",
    "advocate",
    "affected",
    "alliance",
    "allowing",
    "ambition",
    "announce",
    "anything",
    "apparent",
    "approach",
    "approval",
    "argument",
    "artistic",
    "assembly",
    "assuming",
    "athletic",
    "attitude",
    "audience",
    "background",
    "balanced",
    "bankrupt",
    "bargained",
    "beautiful",
    "becoming",
    "behavior",
    "believed",
    "beneath",
    "birthday",
    "borrowed",
    "boundary",
    "breaking",
    "breeding",
    "bringing",
    "building",
    "business",
    "calendar",
    "campaign",
    "capacity",
    "category",
    "cautious",
    "chairman",
    "challenge",
    "champion",
    "changing",
    "chapters",
    "character",
    "chemical",
    "children",
    "choosing",
    "circular",
    "civilian",
    "classical",
    "climbing",
    "clinical",
    "coaching",
    "collapse",
    "combined",
    "comeback",
    "commerce",
    "communal",
    "compiler",
    "complete",
    "composed",
    "computer",
    "conclude",
    "concrete",
    "conflict",
    "congress",
    "conquest",
    "consider",
    "consumer",
  ],
};

// ─── DOM Elements ──────────────────────────────────────────────────
const doc = typeof document !== "undefined" ? document : null;
const startBtn = doc?.getElementById("startBtn");
const resetBtn = doc?.getElementById("resetBtn");
const timeLimit = doc?.getElementById("timeLimit");
const difficulty = doc?.getElementById("difficulty");
const statsBar = doc?.getElementById("statsBar");
const wordDisplay = doc?.getElementById("wordDisplay");
const inputArea = doc?.getElementById("inputArea");
const typeInput = doc?.getElementById("typeInput");
const resultsOverlay = doc?.getElementById("resultsOverlay");
const playAgainBtn = doc?.getElementById("playAgainBtn");
const closeResultsBtn = doc?.getElementById("closeResultsBtn");
const wpmEl = doc?.getElementById("wpmValue");
const bestWpmEl = doc?.getElementById("bestWpmValue");
const timeLeftEl = doc?.getElementById("timeLeft");
const correctCountEl = doc?.getElementById("correctCount");
const wrongCountEl = doc?.getElementById("wrongCount");
const accuracyEl = doc?.getElementById("accuracy");
const streakEl = doc?.getElementById("streak");
const progressBar = doc?.getElementById("progressBar");
const progressLabel = doc?.getElementById("progressLabel");
const playerCar = doc?.getElementById("playerCar");
const playerLane = doc?.getElementById("playerLane");
const opponentLane = doc?.getElementById("opponentLane");

// ─── Game State ────────────────────────────────────────────────────
let state = {
  running: false,
  words: [],
  currentIndex: 0,
  typedWords: [],
  correctWords: 0,
  wrongWords: 0,
  streak: 0,
  bestStreak: 0,
  timeLimit: 60,
  timeLeft: 60,
  difficulty: "medium",
  timerId: null,
  startTime: null,
  wpm: 0,
  bestWpm: (function () {
    try {
      if (typeof localStorage === "undefined") return 0;
      const raw = localStorage.getItem("cradle:typing-racer-best-wpm");
      const parsed = parseInt(raw, 10);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 500
        ? parsed
        : 0;
    } catch (_) {
      return 0;
    }
  })(),
  opponentPos: 0,
  opponentSpeed: 0,
};

// ─── Utilities ─────────────────────────────────────────────────────
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateWords(count, selectedDifficulty = state.difficulty) {
  const bank = WORD_BANKS[selectedDifficulty] || WORD_BANKS.medium;
  const words = [];
  for (let i = 0; i < count; i++) {
    words.push(bank[Math.floor(Math.random() * bank.length)]);
  }
  return words;
}

function calculateCorrectCharacters(gameState = state) {
  if (
    !gameState ||
    !Array.isArray(gameState.typedWords) ||
    !Array.isArray(gameState.words)
  ) {
    return 0;
  }

  return gameState.typedWords.reduce((total, typedWord, index) => {
    const targetWord = gameState.words[index];

    if (typedWord === targetWord) {
      return total + targetWord.length;
    }

    return total;
  }, 0);
}

function calculateWpm(gameState = state) {
  if (!gameState || !gameState.startTime) return 0;

  const elapsedMinutes =
    (Date.now() - gameState.startTime) / 1000 / 60;

  if (elapsedMinutes <= 0) return 0;

  const correctCharacters = calculateCorrectCharacters(gameState);

  return Math.round(
    (correctCharacters / 5) / elapsedMinutes
  );
}

function recalculateStreak(typedWords, targetWords) {
  if (!Array.isArray(typedWords) || !Array.isArray(targetWords)) return 0;
  let streak = 0;
  for (let i = typedWords.length - 1; i >= 0; i--) {
    if (typedWords[i] === targetWords[i]) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function stepBackWord(gameState = state) {
  if (
    !gameState ||
    !gameState.running ||
    gameState.currentIndex <= 0 ||
    !Array.isArray(gameState.typedWords) ||
    gameState.typedWords.length === 0
  ) {
    return null;
  }

  gameState.currentIndex--;
  const prevWord = gameState.typedWords.pop();
  const targetWord = gameState.words[gameState.currentIndex];

  if (prevWord === targetWord) {
    gameState.correctWords = Math.max(0, (gameState.correctWords || 0) - 1);
  } else {
    gameState.wrongWords = Math.max(0, (gameState.wrongWords || 0) - 1);
  }

  gameState.streak = recalculateStreak(gameState.typedWords, gameState.words);

  return prevWord;
}

function handleBackspace(e) {
  if (!state.running) return;
  if (!typeInput) return;

  if (typeInput.value === "" && state.currentIndex > 0) {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    const restored = stepBackWord(state);
    if (restored !== null && restored !== undefined) {
      typeInput.value = restored;
      if (typeof typeInput.setSelectionRange === "function") {
        typeInput.setSelectionRange(restored.length, restored.length);
      }
      const currentWord = state.words[state.currentIndex];
      const partialMatch = currentWord && currentWord.startsWith(restored);
      typeInput.className = partialMatch
        ? "type-input correct"
        : "type-input wrong";
      renderWords();
      updateStats();
    }
  }
}

function getRank(wpm) {
  if (wpm >= 100)
    return {
      text: "🏆 Formula 1 Legend — 100+ WPM!",
      color: "#f59e0b",
      bg: "#f59e0b20",
    };
  if (wpm >= 80)
    return {
      text: "🥇 NASCAR Champion — 80+ WPM!",
      color: "#10b981",
      bg: "#10b98120",
    };
  if (wpm >= 60)
    return {
      text: "🥈 Pro Racer — 60+ WPM!",
      color: "#6366f1",
      bg: "#6366f120",
    };
  if (wpm >= 40)
    return {
      text: "🥉 Road Racer — 40+ WPM!",
      color: "#06b6d4",
      bg: "#06b6d420",
    };
  if (wpm >= 20)
    return {
      text: "🚗 Sunday Driver — 20+ WPM",
      color: "#94a3b8",
      bg: "#94a3b820",
    };
  return {
    text: "🐌 Learning to Drive — Keep practicing!",
    color: "#ef4444",
    bg: "#ef444420",
  };
}

function getOpponentSpeed(diff) {
  const speeds = { easy: 0.3, medium: 0.6, hard: 0.9 };
  return speeds[diff] || 0.6;
}

// ─── Render ────────────────────────────────────────────────────────
function renderWords() {
  if (!wordDisplay) return;
  const html = state.words
    .map((word, i) => {
      let cls = "word";
      if (i < state.currentIndex) {
        cls += state.typedWords[i] === word ? " word--correct" : " word--wrong";
      } else if (i === state.currentIndex) {
        cls += " word--current";
      } else {
        cls += " word--pending";
      }
      return `<span class="${cls}">${word}</span>`;
    })
    .join(" ");
  wordDisplay.innerHTML = html;
}

function updateStats() {
  const wpm = calculateWpm();
  state.wpm = wpm;
  if (wpmEl) wpmEl.textContent = wpm;

  const totalAttempted = state.correctWords + state.wrongWords;
  const acc =
    totalAttempted > 0
      ? Math.round((state.correctWords / totalAttempted) * 100)
      : 0;
  if (correctCountEl) correctCountEl.textContent = state.correctWords;
  if (wrongCountEl) wrongCountEl.textContent = state.wrongWords;
  if (accuracyEl) accuracyEl.textContent = acc + "%";
  if (streakEl) streakEl.textContent = state.streak;
  if (timeLeftEl) {
    timeLeftEl.textContent = state.timeLeft + "s";
    // Time warning
    if (state.timeLeft <= 10) {
      timeLeftEl.classList.add("time-warning");
    } else {
      timeLeftEl.classList.remove("time-warning");
    }
  }

  // Progress & car position
  const progress =
    state.words.length > 0
      ? Math.min((state.currentIndex / state.words.length) * 100, 100)
      : 0;
  if (progressBar) progressBar.style.width = progress + "%";
  if (progressLabel) progressLabel.textContent = Math.round(progress) + "%";

  const carLeft = Math.min(progress * 0.85, 85);
  if (playerCar) playerCar.style.left = carLeft + "%";

  // Opponent car
  state.opponentPos = Math.min(state.opponentPos, 90);
  const opponentCar = opponentLane
    ? opponentLane.querySelector(".car-icon")
    : null;
  if (opponentCar) opponentCar.style.left = state.opponentPos + "%";
}

function addWordBatch() {
  state.words.push(...generateWords(30));
}

// ─── Game Flow ─────────────────────────────────────────────────────
function startGame() {
  state = {
    ...state,
    running: true,
    difficulty: difficulty?.value || "medium",
    words: generateWords(60, difficulty?.value || "medium"),
    currentIndex: 0,
    typedWords: [],
    correctWords: 0,
    wrongWords: 0,
    streak: 0,
    bestStreak: 0,
    timeLimit: parseInt(timeLimit?.value || "60", 10),
    timeLeft: parseInt(timeLimit?.value || "60", 10),
    
    timerId: null,
    startTime: Date.now(),
    wpm: 0,
    opponentPos: 0,
    opponentSpeed: getOpponentSpeed(difficulty?.value || "medium"),
  };

  if (startBtn) startBtn.hidden = true;
  if (resetBtn) resetBtn.hidden = false;
  if (statsBar) statsBar.hidden = false;
  if (inputArea) inputArea.hidden = false;
  if (resultsOverlay) resultsOverlay.hidden = true;
  if (typeInput) {
    typeInput.value = "";
    typeInput.focus();
  }

  renderWords();
  updateStats();

  state.timerId = setInterval(tick, 1000);
}

function tick() {
  if (!state.running) return;

  state.timeLeft--;
  if (timeLeftEl) timeLeftEl.textContent = state.timeLeft + "s";

  // Move opponent
  state.opponentPos += state.opponentSpeed * (0.8 + Math.random() * 0.4);

  // If opponent finishes, slow it down
  if (state.opponentPos >= 88) {
    state.opponentPos = 88;
    state.opponentSpeed = 0.05;
  }

  updateStats();

  if (state.timeLeft <= 0) {
    endGame();
  }
}

function endGame() {
  state.running = false;
  clearInterval(state.timerId);

  const wpm = calculateWpm();
  const totalAttempted = state.correctWords + state.wrongWords;
  const acc =
    totalAttempted > 0
      ? Math.round((state.correctWords / totalAttempted) * 100)
      : 0;
  const rank = getRank(wpm);

  // Update best (bounded between 0 and 500 wpm)
  if (Number.isFinite(wpm) && wpm >= 0 && wpm <= 500 && wpm > state.bestWpm) {
    state.bestWpm = wpm;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("cradle:typing-racer-best-wpm", wpm.toString());
      }
    } catch (_) {}
    if (bestWpmEl) bestWpmEl.textContent = wpm;
  }

  // Show results
  const currentDoc = typeof document !== "undefined" ? document : null;
  const finalWpm = currentDoc?.getElementById("finalWpm");
  if (finalWpm) finalWpm.textContent = wpm;
  const finalAccuracy = currentDoc?.getElementById("finalAccuracy");
  if (finalAccuracy) finalAccuracy.textContent = acc;
  const finalWords = currentDoc?.getElementById("finalWords");
  if (finalWords) finalWords.textContent = state.correctWords;
  const finalStreak = currentDoc?.getElementById("finalStreak");
  if (finalStreak) finalStreak.textContent = state.bestStreak;

  const rankEl = currentDoc?.getElementById("resultRank");
  if (rankEl) {
    rankEl.textContent = rank.text;
    rankEl.style.background = rank.bg;
    rankEl.style.color = rank.color;
  }

  // Did the player win?
  const playerWon =
    state.opponentPos < (playerCar ? parseFloat(playerCar.style.left) || 0 : 0);
  const resultTitle = currentDoc?.getElementById("resultTitle");
  if (resultTitle)
    resultTitle.textContent = playerWon ? "🏆 You Won!" : "🏁 Race Complete!";

  if (resultsOverlay) resultsOverlay.hidden = false;
  if (inputArea) inputArea.hidden = true;
}

function resetGame() {
  state.running = false;
  clearInterval(state.timerId);

  if (startBtn) startBtn.hidden = false;
  if (resetBtn) resetBtn.hidden = true;
  if (statsBar) statsBar.hidden = true;
  if (inputArea) inputArea.hidden = true;
  if (resultsOverlay) resultsOverlay.hidden = true;

  if (wordDisplay)
    wordDisplay.innerHTML =
      '<p class="placeholder-text">Press <strong>Start Race</strong> to begin typing!</p>';

  if (progressBar) progressBar.style.width = "0%";
  if (progressLabel) progressLabel.textContent = "0%";
  if (playerCar) playerCar.style.left = "0%";

  const opponentCar = opponentLane
    ? opponentLane.querySelector(".car-icon")
    : null;
  if (opponentCar) opponentCar.style.left = "0%";

  if (wpmEl) wpmEl.textContent = "0";
}

// ─── Input Handling ────────────────────────────────────────────────
typeInput?.addEventListener("input", e => {
  if (!state.running) return;

  const val = typeInput.value;
  const currentWord = state.words[state.currentIndex];

  // Space = word submitted
  if (val.endsWith(" ")) {
    const typed = val.trim();
    if (!typed) {
      typeInput.value = "";
      return;
    }

    state.typedWords.push(typed);

    if (typed === currentWord) {
      state.correctWords++;
      state.streak++;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;

      // Boost on streaks
      if (state.streak > 0 && state.streak % 5 === 0) {
        state.opponentPos = Math.max(0, state.opponentPos - 3);
        if (playerCar) playerCar.classList.add("boost-glow");
        setTimeout(
          () => playerCar && playerCar.classList.remove("boost-glow"),
          500
        );
      }
      if (state.streak > 0 && state.streak % 10 === 0) {
        if (streakEl) streakEl.classList.add("streak-flash");
        setTimeout(
          () => streakEl && streakEl.classList.remove("streak-flash"),
          300
        );
      }
    } else {
      state.wrongWords++;
      state.streak = 0;
    }

    state.currentIndex++;
    typeInput.value = "";
    typeInput.className = "type-input";

    // Add more words if running low
    if (state.currentIndex >= state.words.length - 15) {
      addWordBatch();
    }

    renderWords();
    updateStats();
  } else {
    // Live feedback
    const partialMatch = currentWord && currentWord.startsWith(val);
    typeInput.className = partialMatch
      ? "type-input correct"
      : "type-input wrong";
  }
});

// Prevent form submission and handle word-boundary backspacing
typeInput?.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
  } else if (e.key === "Backspace") {
    handleBackspace(e);
  }
});

// ─── Event Listeners ───────────────────────────────────────────────
startBtn?.addEventListener("click", startGame);
resetBtn?.addEventListener("click", resetGame);
playAgainBtn?.addEventListener("click", () => {
  if (resultsOverlay) resultsOverlay.hidden = true;
  startGame();
});
closeResultsBtn?.addEventListener("click", () => {
  if (resultsOverlay) resultsOverlay.hidden = true;
  resetGame();
});

// ─── Init ──────────────────────────────────────────────────────────
if (bestWpmEl) bestWpmEl.textContent = state.bestWpm;

// ─── Exports for Testing ───────────────────────────────────────────
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    WORD_BANKS,
    calculateCorrectCharacters,
    calculateWpm,
    recalculateStreak,
    stepBackWord,
    handleBackspace,
    getRank,
    getOpponentSpeed,
    state,
  };
}
