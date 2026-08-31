/* ================================================================
   Typing Speed Test — script.js
   Timer, WPM/accuracy calculation, difficulty texts, grade system,
   history with localStorage. Zero dependencies.
   ================================================================ */

/* ── Text Banks ─────────────────────────────────────────────────── */

const TEXTS = {
  easy: [
    "the cat sat on the mat and looked at the sun",
    "a big red dog ran fast in the green park",
    "she went to the store to buy some bread and milk",
    "the sun is hot and the sky is blue today",
    "he likes to run and jump and play all day long",
    "we had fun at the park with our friends and family",
    "the fish swam in the deep blue ocean all morning",
    "my mom made a cake for my birthday party today",
    "the birds sing sweet songs in the tall old trees",
    "i love to read books and drink hot cocoa at night",
  ],
  medium: [
    "The quick brown fox jumps over the lazy dog near the river bank. Early morning mist hung low over the meadow as dewdrops sparkled on each blade of grass.",
    "Programming is the art of telling another human being what one wants the computer to do. Every great developer you know got there by solving problems they were unqualified to solve.",
    "The library was a sanctuary of quiet contemplation, where the scent of aged paper mingled with the soft hum of turning pages. Scholars gathered here to chase knowledge.",
    "Technology has revolutionized every aspect of modern life, from how we communicate with distant friends to how we navigate bustling city streets using satellite positioning.",
    "The ocean waves crashed against the rocky shoreline with thunderous force, sending spray high into the evening air as seabirds circled overhead searching for fish.",
    "Creative writing demands patience, observation, and an unwavering commitment to crafting sentences that resonate with readers across generations and cultural boundaries.",
    "The garden bloomed with vibrant colors each spring, drawing bees and butterflies from miles around. Roses, tulips, and lavender swayed gently in the warm breeze.",
    "Scientific discovery often begins with a simple question: why does this happen? Curiosity drives researchers to explore the unknown and challenge established assumptions.",
  ],
  hard: [
    "Quantum entanglement, a phenomenon Einstein famously derided as \"spooky action at a distance,\" describes how particles become correlated such that the quantum state of one instantaneously influences the state of another regardless of the spatial separation between them.",
    "The socioeconomic implications of artificial intelligence extend far beyond mere automation of repetitive tasks; they encompass fundamental restructuring of labor markets, ethical frameworks for algorithmic decision-making, and the philosophical question of machine consciousness.",
    "Despite meticulous planning and rigorous contingency protocols, the expedition encountered unforeseen complications when atmospheric conditions deteriorated rapidly, rendering navigation instruments unreliable and forcing the team to reassess their strategic approach.",
    "The juxtaposition of Renaissance architectural grandeur with contemporary minimalist design principles creates a compelling dialogue between historical craftsmanship and modern functional aesthetics that challenges conventional notions of spatial harmony.",
    "Neuroplasticity, the brain's remarkable capacity to reorganize neural pathways in response to new experiences, learning, and environmental stimuli, fundamentally challenges the longstanding assumption that cognitive architecture becomes fixed after early developmental periods.",
    "Cryptographic hash functions serve as the backbone of digital security infrastructure, transforming arbitrary-length inputs into fixed-length outputs through one-way mathematical operations that are computationally infeasible to reverse.",
  ],
  code: [
    "const fibonacci = (n) => n <= 1 ? n : fibonacci(n - 1) + fibonacci(n - 2);",
    "function mergeSort(arr) { if (arr.length <= 1) return arr; const mid = Math.floor(arr.length / 2); return merge(mergeSort(arr.slice(0, mid)), mergeSort(arr.slice(mid))); }",
    "class LinkedList { constructor() { this.head = null; this.size = 0; } prepend(value) { const node = { value, next: this.head }; this.head = node; this.size++; } }",
    "async function fetchData(url) { const response = await fetch(url); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }",
    "const debounce = (fn, delay) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; };",
    "export const createReducer = (initial, handlers) => (state = initial, action) => { const handler = handlers[action.type]; return handler ? handler(state, action) : state; };",
    "const deepClone = (obj) => JSON.parse(JSON.stringify(obj)); const memoize = (fn) => { const cache = new Map(); return (...args) => cache.get(JSON.stringify(args)) ?? cache.set(JSON.stringify(args), fn(...args)).get(JSON.stringify(args)); };",
    "function binarySearch(arr, target) { let lo = 0, hi = arr.length - 1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] === target) return mid; arr[mid] < target ? lo = mid + 1 : hi = mid - 1; } return -1; }",
  ],
};

/* ── State ──────────────────────────────────────────────────────── */

const HISTORY_KEY = "ts_history_v1";
let difficulty = "easy";
let duration = 30;
let timer = null;
let timeLeft = 0;
let testActive = false;
let testStarted = false;
let currentText = "";
let charIndex = 0;
let errorCount = 0;
let totalKeystrokes = 0;
let startTime = null;
let history = loadHistory();

/* ── DOM Refs ───────────────────────────────────────────────────── */

const $textDisplay    = document.getElementById("textDisplay");
const $typingInput    = document.getElementById("typingInput");
const $statWpm        = document.getElementById("statWpm");
const $statAccuracy   = document.getElementById("statAccuracy");
const $statTime       = document.getElementById("statTime");
const $statErrors     = document.getElementById("statErrors");
const $statusIndicator = document.getElementById("statusIndicator");
const $resultsSection = document.getElementById("resultsSection");
const $historyList    = document.getElementById("historyList");

/* ── Text Selection ─────────────────────────────────────────────── */

function getRandomText() {
  const bank = TEXTS[difficulty];
  return bank[Math.floor(Math.random() * bank.length)];
}

function renderText() {
  currentText = getRandomText();
  $textDisplay.innerHTML = "";
  currentText.split("").forEach((ch, i) => {
    const span = document.createElement("span");
    span.className = "char";
    span.textContent = ch;
    span.dataset.index = i;
    if (ch === " ") span.classList.add("space");
    $textDisplay.appendChild(span);
  });
}

/* ── Timer ──────────────────────────────────────────────────────── */

function startTimer() {
  if (timer) return;
  testActive = true;
  testStarted = true;
  startTime = Date.now();
  setStatus("typing", "Typing...");
  $typingInput.disabled = false;

  timer = setInterval(() => {
    timeLeft--;
    $statTime.textContent = `${timeLeft}s`;

    if (timeLeft <= 0) {
      finishTest();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

/* ── WPM & Accuracy ─────────────────────────────────────────────── */

function calculateWPM() {
  const elapsed = (Date.now() - startTime) / 1000;
  if (elapsed <= 0) return 0;
  const wordsTyped = charIndex / 5; // standard: 1 word = 5 chars
  return Math.round((wordsTyped / elapsed) * 60);
}

function calculateRawWPM() {
  const elapsed = (Date.now() - startTime) / 1000;
  if (elapsed <= 0) return 0;
  const wordsTyped = totalKeystrokes / 5;
  return Math.round((wordsTyped / elapsed) * 60);
}

function calculateAccuracy() {
  if (totalKeystrokes === 0) return 100;
  const correct = totalKeystrokes - errorCount;
  return Math.max(0, Math.round((correct / totalKeystrokes) * 100));
}

function updateLiveStats() {
  $statWpm.textContent = calculateWPM();
  $statAccuracy.textContent = `${calculateAccuracy()}%`;
  $statErrors.textContent = errorCount;
}

/* ── Input Handler ──────────────────────────────────────────────── */

function handleInput(e) {
  if (!testActive && !testStarted) {
    startTimer();
  }
  if (!testActive) return;

  const inputVal = $typingInput.value;
  const inputLen = inputVal.length;
  const prevCharIndex = charIndex;
  charIndex = inputLen;
  totalKeystrokes = inputLen;

  // Count errors: compare each typed char to the expected char
  errorCount = 0;
  for (let i = 0; i < inputLen; i++) {
    if (inputVal[i] !== currentText[i]) {
      errorCount++;
    }
  }

  // Update char highlighting
  const spans = $textDisplay.querySelectorAll(".char");
  spans.forEach((span, i) => {
    span.classList.remove("correct", "incorrect", "cursor");
    if (i < inputLen) {
      if (inputVal[i] === currentText[i]) {
        span.classList.add("correct");
      } else {
        span.classList.add("incorrect");
      }
    } else if (i === inputLen) {
      span.classList.add("cursor");
    }
  });

  updateLiveStats();

  // Check if user typed all characters
  if (inputLen >= currentText.length) {
    finishTest();
  }
}

/* ── Finish & Results ───────────────────────────────────────────── */

function finishTest() {
  stopTimer();
  testActive = false;
  $typingInput.disabled = true;
  setStatus("done", "Complete!");

  const wpm = calculateWPM();
  const rawWpm = calculateRawWPM();
  const accuracy = calculateAccuracy();
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const chars = charIndex;
  const grade = getGrade(wpm, accuracy);

  document.getElementById("resultWpm").textContent = wpm;
  document.getElementById("resultAccuracy").textContent = `${accuracy}%`;
  document.getElementById("resultChars").textContent = chars;
  document.getElementById("resultErrors").textContent = errorCount;
  document.getElementById("resultTime").textContent = `${elapsed}s`;
  document.getElementById("resultRawWpm").textContent = rawWpm;

  const $grade = document.getElementById("resultsGrade");
  $grade.innerHTML = `<span class="grade-badge grade-${grade.level}">${grade.emoji} ${grade.label}</span>`;
  $grade.className = "results-grade";

  $resultsSection.classList.remove("hidden");
  $resultsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });

  // Save to history
  saveHistory({ wpm, rawWpm, accuracy, chars, errors: errorCount, time: elapsed, difficulty, grade: grade.label, timestamp: Date.now() });
  renderHistory();
}

function getGrade(wpm, accuracy) {
  const score = wpm * (accuracy / 100);
  if (score >= 80 && accuracy >= 95) return { level: "s", emoji: "🏆", label: "Typing Master" };
  if (score >= 60 && accuracy >= 90) return { level: "a", emoji: "⭐", label: "Excellent" };
  if (score >= 45 && accuracy >= 85) return { level: "b", emoji: "👍", label: "Good" };
  if (score >= 30 && accuracy >= 75) return { level: "c", emoji: "📝", label: "Average" };
  if (score >= 15) return { level: "d", emoji: "🔧", label: "Needs Practice" };
  return { level: "f", emoji: "📚", label: "Keep Trying" };
}

/* ── Status Indicator ───────────────────────────────────────────── */

function setStatus(state, text) {
  $statusIndicator.className = "status-indicator";
  if (state === "typing") $statusIndicator.classList.add("active");
  else if (state === "done") $statusIndicator.classList.add("done");
  else if (state === "paused") $statusIndicator.classList.add("paused");
  $statusIndicator.lastChild.textContent = ` ${text}`;
}

/* ── Restart ────────────────────────────────────────────────────── */

function restart() {
  stopTimer();
  testActive = false;
  testStarted = false;
  timeLeft = duration;
  charIndex = 0;
  errorCount = 0;
  totalKeystrokes = 0;
  startTime = null;

  $typingInput.value = "";
  $typingInput.disabled = false;
  $resultsSection.classList.add("hidden");
  $statWpm.textContent = "0";
  $statAccuracy.textContent = "100%";
  $statTime.textContent = `${timeLeft}s`;
  $statErrors.textContent = "0";
  setStatus("ready", "Ready");

  renderText();
  $typingInput.focus();
}

/* ── History ────────────────────────────────────────────────────── */

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}

function saveHistory(entry) {
  history.unshift(entry);
  if (history.length > 20) history.length = 20;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* */ }
}

function renderHistory() {
  if (history.length === 0) {
    $historyList.innerHTML = '<p class="empty-state">No tests yet. Start typing!</p>';
    return;
  }
  $historyList.innerHTML = "";
  history.forEach((h, idx) => {
    const item = document.createElement("div");
    item.className = "history-item";
    const timeStr = new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    item.innerHTML = `
      <div class="history-main">
        <strong>${h.wpm} WPM</strong> · ${h.accuracy}% accuracy · ${h.difficulty}
      </div>
      <div class="history-meta">${h.time}s · ${h.errors} errors · ${timeStr}</div>
      <button class="history-del" data-idx="${idx}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
    `;
    item.querySelector(".history-del").addEventListener("click", () => {
      history.splice(idx, 1);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* */ }
      renderHistory();
    });
    $historyList.appendChild(item);
  });
}

function clearHistory() {
  if (history.length === 0) return;
  if (!confirm("Clear all test history?")) return;
  history = [];
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* */ }
  renderHistory();
}

/* ── Event Listeners ────────────────────────────────────────────── */

// Difficulty buttons
document.querySelectorAll(".diff-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    difficulty = btn.dataset.difficulty;
    restart();
  });
});

// Duration buttons
document.querySelectorAll(".time-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".time-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    duration = parseInt(btn.dataset.seconds, 10);
    restart();
  });
});

// Typing input
$typingInput.addEventListener("input", handleInput);

// Prevent paste
$typingInput.addEventListener("paste", (e) => e.preventDefault());

// Restart buttons
document.getElementById("btnRestart").addEventListener("click", restart);
document.getElementById("btnTryAgain").addEventListener("click", restart);

// Clear history
document.getElementById("btnClearHistory").addEventListener("click", clearHistory);

// Keyboard shortcut: Escape to restart
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    restart();
  }
});

/* ── Init ───────────────────────────────────────────────────────── */

timeLeft = duration;
$statTime.textContent = `${timeLeft}s`;
renderText();
renderHistory();
