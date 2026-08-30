/**
 * Typing Speed Racer — main game logic
 * A typing speed test with a racing twist.
 */

// ─── Word Banks ────────────────────────────────────────────────────
const WORD_BANKS = {
  easy: [
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
    'how', 'its', 'may', 'new', 'now', 'old', 'see', 'way', 'who', 'boy',
    'did', 'let', 'put', 'say', 'she', 'too', 'use', 'big', 'end', 'far',
    'low', 'run', 'set', 'try', 'ask', 'men', 'own', 'pin', 'red', 'six',
    'top', 'war', 'hot', 'box', 'car', 'dog', 'eye', 'fan', 'gun', 'hat',
    'ice', 'job', 'key', 'lip', 'map', 'net', 'oil', 'pen', 'rat', 'sun',
    'toy', 'van', 'win', 'yes', 'zip', 'act', 'age', 'air', 'arm', 'bed'
  ],
  medium: [
    'about', 'after', 'again', 'being', 'below', 'black', 'bring', 'carry',
    'clean', 'close', 'could', 'dance', 'early', 'earth', 'eight', 'every',
    'found', 'gave', 'going', 'green', 'great', 'house', 'human', 'image',
    'known', 'large', 'learn', 'leave', 'light', 'might', 'money', 'month',
    'music', 'night', 'north', 'often', 'order', 'other', 'place', 'plant',
    'point', 'power', 'press', 'quick', 'reach', 'right', 'river', 'round',
    'shape', 'should', 'small', 'sound', 'south', 'space', 'speak', 'start',
    'still', 'stone', 'story', 'study', 'table', 'theme', 'think', 'today',
    'total', 'track', 'under', 'until', 'upper', 'usual', 'voice', 'watch',
    'wheel', 'world', 'write', 'young', 'block', 'brain', 'cable', 'charm'
  ],
  hard: [
    'absolute', 'abstract', 'accurate', 'achieved', 'acquired', 'actively',
    'adequate', 'advanced', 'advocate', 'affected', 'alliance', 'allowing',
    'ambition', 'announce', 'anything', 'apparent', 'approach', 'approval',
    'argument', 'artistic', 'assembly', 'assuming', 'athletic', 'attitude',
    'audience', 'background', 'balanced', 'bankrupt', 'bargained', 'beautiful',
    'becoming', 'behavior', 'believed', 'beneath', 'birthday', 'borrowed',
    'boundary', 'breaking', 'breeding', 'bringing', 'building', 'business',
    'calendar', 'campaign', 'capacity', 'category', 'cautious', 'chairman',
    'challenge', 'champion', 'changing', 'chapters', 'character', 'chemical',
    'children', 'choosing', 'circular', 'civilian', 'classical', 'climbing',
    'clinical', 'coaching', 'collapse', 'combined', 'comeback', 'commerce',
    'communal', 'compiler', 'complete', 'composed', 'computer', 'conclude',
    'concrete', 'conflict', 'congress', 'conquest', 'consider', 'consumer'
  ]
}

// ─── DOM Elements ──────────────────────────────────────────────────
const startBtn = document.getElementById('startBtn')
const resetBtn = document.getElementById('resetBtn')
const timeLimit = document.getElementById('timeLimit')
const difficulty = document.getElementById('difficulty')
const statsBar = document.getElementById('statsBar')
const wordDisplay = document.getElementById('wordDisplay')
const inputArea = document.getElementById('inputArea')
const typeInput = document.getElementById('typeInput')
const resultsOverlay = document.getElementById('resultsOverlay')
const playAgainBtn = document.getElementById('playAgainBtn')
const closeResultsBtn = document.getElementById('closeResultsBtn')
const wpmEl = document.getElementById('wpmValue')
const bestWpmEl = document.getElementById('bestWpmValue')
const timeLeftEl = document.getElementById('timeLeft')
const correctCountEl = document.getElementById('correctCount')
const wrongCountEl = document.getElementById('wrongCount')
const accuracyEl = document.getElementById('accuracy')
const streakEl = document.getElementById('streak')
const progressBar = document.getElementById('progressBar')
const progressLabel = document.getElementById('progressLabel')
const playerCar = document.getElementById('playerCar')
const playerLane = document.getElementById('playerLane')
const opponentLane = document.getElementById('opponentLane')

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
  difficulty: 'medium',
  timerId: null,
  startTime: null,
  wpm: 0,
  bestWpm: parseInt(localStorage.getItem('cradle:typing-racer-best-wpm') || '0', 10),
  opponentPos: 0,
  opponentSpeed: 0
}

// ─── Utilities ─────────────────────────────────────────────────────
function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateWords(count) {
  const bank = WORD_BANKS[state.difficulty]
  const words = []
  for (let i = 0; i < count; i++) {
    words.push(bank[Math.floor(Math.random() * bank.length)])
  }
  return words
}

function calculateWpm() {
  if (!state.startTime) return 0
  const elapsed = (Date.now() - state.startTime) / 1000 / 60
  if (elapsed <= 0) return 0
  return Math.round(state.correctWords / elapsed)
}

function getRank(wpm) {
  if (wpm >= 100) return { text: '🏆 Formula 1 Legend — 100+ WPM!', color: '#f59e0b', bg: '#f59e0b20' }
  if (wpm >= 80) return { text: '🥇 NASCAR Champion — 80+ WPM!', color: '#10b981', bg: '#10b98120' }
  if (wpm >= 60) return { text: '🥈 Pro Racer — 60+ WPM!', color: '#6366f1', bg: '#6366f120' }
  if (wpm >= 40) return { text: '🥉 Road Racer — 40+ WPM!', color: '#06b6d4', bg: '#06b6d420' }
  if (wpm >= 20) return { text: '🚗 Sunday Driver — 20+ WPM', color: '#94a3b8', bg: '#94a3b820' }
  return { text: '🐌 Learning to Drive — Keep practicing!', color: '#ef4444', bg: '#ef444420' }
}

function getOpponentSpeed(difficulty) {
  const speeds = { easy: 0.3, medium: 0.6, hard: 0.9 }
  return speeds[difficulty] || 0.6
}

// ─── Render ────────────────────────────────────────────────────────
function renderWords() {
  const html = state.words.map((word, i) => {
    let cls = 'word'
    if (i < state.currentIndex) {
      cls += state.typedWords[i] === word ? ' word--correct' : ' word--wrong'
    } else if (i === state.currentIndex) {
      cls += ' word--current'
    } else {
      cls += ' word--pending'
    }
    return `<span class="${cls}">${word}</span>`
  }).join(' ')
  wordDisplay.innerHTML = html
}

function updateStats() {
  const wpm = calculateWpm()
  state.wpm = wpm
  wpmEl.textContent = wpm

  const totalAttempted = state.correctWords + state.wrongWords
  const acc = totalAttempted > 0 ? Math.round((state.correctWords / totalAttempted) * 100) : 100
  correctCountEl.textContent = state.correctWords
  wrongCountEl.textContent = state.wrongWords
  accuracyEl.textContent = acc + '%'
  streakEl.textContent = state.streak
  timeLeftEl.textContent = state.timeLeft + 's'

  // Time warning
  if (state.timeLeft <= 10) {
    timeLeftEl.classList.add('time-warning')
  } else {
    timeLeftEl.classList.remove('time-warning')
  }

  // Progress & car position
  const progress = Math.min((state.currentIndex / state.words.length) * 100, 100)
  progressBar.style.width = progress + '%'
  progressLabel.textContent = Math.round(progress) + '%'

  const carLeft = Math.min(progress * 0.85, 85)
  playerCar.style.left = carLeft + '%'

  // Opponent car
  state.opponentPos = Math.min(state.opponentPos, 90)
  const opponentCar = opponentLane.querySelector('.car-icon')
  if (opponentCar) opponentCar.style.left = state.opponentPos + '%'
}

function addWordBatch() {
  state.words.push(...generateWords(30))
}

// ─── Game Flow ─────────────────────────────────────────────────────
function startGame() {
  state = {
    ...state,
    running: true,
    words: generateWords(60),
    currentIndex: 0,
    typedWords: [],
    correctWords: 0,
    wrongWords: 0,
    streak: 0,
    bestStreak: 0,
    timeLimit: parseInt(timeLimit.value, 10),
    timeLeft: parseInt(timeLimit.value, 10),
    difficulty: difficulty.value,
    timerId: null,
    startTime: Date.now(),
    wpm: 0,
    opponentPos: 0,
    opponentSpeed: getOpponentSpeed(difficulty.value)
  }

  startBtn.hidden = true
  resetBtn.hidden = false
  statsBar.hidden = false
  inputArea.hidden = false
  resultsOverlay.hidden = true
  typeInput.value = ''
  typeInput.focus()

  renderWords()
  updateStats()

  state.timerId = setInterval(tick, 1000)
}

function tick() {
  if (!state.running) return

  state.timeLeft--
  timeLeftEl.textContent = state.timeLeft + 's'

  // Move opponent
  state.opponentPos += state.opponentSpeed * (0.8 + Math.random() * 0.4)

  // If opponent finishes, slow it down
  if (state.opponentPos >= 88) {
    state.opponentPos = 88
    state.opponentSpeed = 0.05
  }

  updateStats()

  if (state.timeLeft <= 0) {
    endGame()
  }
}

function endGame() {
  state.running = false
  clearInterval(state.timerId)

  const wpm = calculateWpm()
  const totalAttempted = state.correctWords + state.wrongWords
  const acc = totalAttempted > 0 ? Math.round((state.correctWords / totalAttempted) * 100) : 100
  const rank = getRank(wpm)

  // Update best
  if (wpm > state.bestWpm) {
    state.bestWpm = wpm
    localStorage.setItem('cradle:typing-racer-best-wpm', wpm.toString())
    bestWpmEl.textContent = wpm
  }

  // Show results
  document.getElementById('finalWpm').textContent = wpm
  document.getElementById('finalAccuracy').textContent = acc
  document.getElementById('finalWords').textContent = state.correctWords
  document.getElementById('finalStreak').textContent = state.bestStreak

  const rankEl = document.getElementById('resultRank')
  rankEl.textContent = rank.text
  rankEl.style.background = rank.bg
  rankEl.style.color = rank.color

  // Did the player win?
  const playerWon = state.opponentPos < (parseFloat(playerCar.style.left) || 0)
  document.getElementById('resultTitle').textContent = playerWon ? '🏆 You Won!' : '🏁 Race Complete!'

  resultsOverlay.hidden = false

  inputArea.hidden = true
}

function resetGame() {
  state.running = false
  clearInterval(state.timerId)

  startBtn.hidden = false
  resetBtn.hidden = true
  statsBar.hidden = true
  inputArea.hidden = true
  resultsOverlay.hidden = true

  wordDisplay.innerHTML = '<p class="placeholder-text">Press <strong>Start Race</strong> to begin typing!</p>'

  progressBar.style.width = '0%'
  progressLabel.textContent = '0%'
  playerCar.style.left = '0%'

  const opponentCar = opponentLane.querySelector('.car-icon')
  if (opponentCar) opponentCar.style.left = '0%'

  wpmEl.textContent = '0'
}

// ─── Input Handling ────────────────────────────────────────────────
typeInput.addEventListener('input', (e) => {
  if (!state.running) return

  const val = typeInput.value
  const currentWord = state.words[state.currentIndex]

  // Space = word submitted
  if (val.endsWith(' ')) {
    const typed = val.trim()
    state.typedWords.push(typed)

    if (typed === currentWord) {
      state.correctWords++
      state.streak++
      if (state.streak > state.bestStreak) state.bestStreak = state.streak

      // Boost on streaks
      if (state.streak > 0 && state.streak % 5 === 0) {
        state.opponentPos = Math.max(0, state.opponentPos - 3)
        playerCar.classList.add('boost-glow')
        setTimeout(() => playerCar.classList.remove('boost-glow'), 500)
      }
      if (state.streak > 0 && state.streak % 10 === 0) {
        streakEl.classList.add('streak-flash')
        setTimeout(() => streakEl.classList.remove('streak-flash'), 300)
      }
    } else {
      state.wrongWords++
      state.streak = 0
    }

    state.currentIndex++
    typeInput.value = ''
    typeInput.className = 'type-input'

    // Add more words if running low
    if (state.currentIndex >= state.words.length - 15) {
      addWordBatch()
    }

    renderWords()
    updateStats()
  } else {
    // Live feedback
    const partialMatch = currentWord.startsWith(val)
    typeInput.className = partialMatch ? 'type-input correct' : 'type-input wrong'
  }
})

// Prevent form submission
typeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
  }
})

// ─── Event Listeners ───────────────────────────────────────────────
startBtn.addEventListener('click', startGame)
resetBtn.addEventListener('click', resetGame)
playAgainBtn.addEventListener('click', () => {
  resultsOverlay.hidden = true
  startGame()
})
closeResultsBtn.addEventListener('click', () => {
  resultsOverlay.hidden = true
  resetGame()
})

// ─── Init ──────────────────────────────────────────────────────────
bestWpmEl.textContent = state.bestWpm
