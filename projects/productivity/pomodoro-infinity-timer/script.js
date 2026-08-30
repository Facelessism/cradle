/**
 * Pomodoro Infinity Timer — main script
 * A beautiful Pomodoro timer with infinity loop visual and session tracking.
 */

// ─── State ─────────────────────────────────────────────────────────
const STORAGE_KEY = 'cradle:pomodoro-infinity'

let config = {
  focusTime: 25,
  shortBreak: 5,
  longBreak: 15,
  sessionsBeforeLong: 4,
  autoStart: true,
  soundEnabled: true,
  ambientSound: 'none',
  volume: 50
}

let state = {
  mode: 'focus', // focus | short | long
  running: false,
  paused: false,
  timeLeft: 25 * 60,
  totalTime: 25 * 60,
  currentSession: 1,
  streak: 0,
  todayMinutes: 0,
  todaySessions: 0,
  bestStreak: 0,
  log: []
}

let timerId = null
let ambientNode = null
let ambientGain = null
let audioCtx = null

// ─── DOM ───────────────────────────────────────────────────────────
const timerMinutes = document.getElementById('timerMinutes')
const timerSeconds = document.getElementById('timerSeconds')
const timerDisplay = document.getElementById('timerDisplay')
const timerLabel = document.getElementById('timerLabel')
const startBtn = document.getElementById('startBtn')
const pauseBtn = document.getElementById('pauseBtn')
const resetBtn = document.getElementById('resetBtn')
const skipBtn = document.getElementById('skipBtn')
const sessionDots = document.getElementById('sessionDots')
const sessionText = document.getElementById('sessionText')
const infinityPath = document.getElementById('infinityPath')
const infinityDot = document.getElementById('infinityDot')
const infinityContainer = document.getElementById('infinityContainer')
const logList = document.getElementById('logList')

// ─── Init ──────────────────────────────────────────────────────────
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    if (saved.config) config = { ...config, ...saved.config }
    if (saved.state && isToday(saved.state.savedAt)) {
      state = { ...state, ...saved.state }
    }
  } catch (e) { /* ignore */ }
}

function saveState() {
  const toSave = {
    config,
    state: { ...state, savedAt: new Date().toISOString() }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
}

function isToday(isoStr) {
  if (!isoStr) return false
  const d = new Date(isoStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function init() {
  loadState()
  applyConfig()
  renderSessionDots()
  renderStats()
  renderLog()
  updateDisplay()
  updateInfinity(0)

  // Apply saved settings to inputs
  document.getElementById('focusTime').value = config.focusTime
  document.getElementById('shortBreak').value = config.shortBreak
  document.getElementById('longBreak').value = config.longBreak
  document.getElementById('sessionsBeforeLong').value = config.sessionsBeforeLong
  document.getElementById('autoStart').checked = config.autoStart
  document.getElementById('soundEnabled').checked = config.soundEnabled
  document.getElementById('ambientSound').value = config.ambientSound
  document.getElementById('volume').value = config.volume

  setMode(state.mode)
}

function applyConfig() {
  state.timeLeft = getModeTime(state.mode) * 60
  state.totalTime = state.timeLeft
}

function getModeTime(mode) {
  if (mode === 'focus') return config.focusTime
  if (mode === 'short') return config.shortBreak
  return config.longBreak
}

// ─── Display ───────────────────────────────────────────────────────
function updateDisplay() {
  const mins = Math.floor(state.timeLeft / 60)
  const secs = state.timeLeft % 60
  timerMinutes.textContent = String(mins).padStart(2, '0')
  timerSeconds.textContent = String(secs).padStart(2, '0')
  document.title = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} — Pomodoro Infinity`

  // Infinity progress
  const progress = state.totalTime > 0 ? 1 - (state.timeLeft / state.totalTime) : 0
  updateInfinity(progress)
}

function updateInfinity(progress) {
  const totalLen = 400
  const offset = totalLen - (progress * totalLen)
  infinityPath.style.strokeDashoffset = offset

  // Move dot along path
  if (progress > 0) {
    infinityDot.setAttribute('opacity', '1')
    const path = infinityPath
    const len = path.getTotalLength()
    const point = path.getPointAtLength(progress * len)
    infinityDot.setAttribute('cx', point.x)
    infinityDot.setAttribute('cy', point.y)
  } else {
    infinityDot.setAttribute('opacity', '0')
  }
}

// ─── Timer ─────────────────────────────────────────────────────────
function startTimer() {
  if (state.running && !state.paused) return

  if (!state.paused) {
    state.totalTime = state.timeLeft
  }

  state.running = true
  state.paused = false

  startBtn.hidden = true
  pauseBtn.hidden = false
  timerDisplay.classList.remove('paused')

  timerId = setInterval(tick, 1000)
  startAmbient()
}

function pauseTimer() {
  state.paused = true
  clearInterval(timerId)
  timerDisplay.classList.add('paused')
  startBtn.hidden = false
  startBtn.textContent = '▶ Resume'
  pauseBtn.hidden = true
  stopAmbient()
}

function resetTimer() {
  clearInterval(timerId)
  state.running = false
  state.paused = false
  state.timeLeft = getModeTime(state.mode) * 60
  state.totalTime = state.timeLeft

  startBtn.hidden = false
  startBtn.textContent = '▶ Start'
  pauseBtn.hidden = true
  timerDisplay.classList.remove('paused')

  updateDisplay()
  updateInfinity(0)
  stopAmbient()
  saveState()
}

function skipSession() {
  clearInterval(timerId)
  state.running = false
  state.paused = false
  stopAmbient()
  completeSession()
}

function tick() {
  if (state.timeLeft <= 0) {
    clearInterval(timerId)
    state.running = false
    stopAmbient()
    completeSession()
    return
  }

  state.timeLeft--
  updateDisplay()
}

function completeSession() {
  const mode = state.mode
  const duration = getModeTime(mode)

  // Log it
  state.log.unshift({
    type: mode,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    duration
  })

  if (mode === 'focus') {
    state.todaySessions++
    state.todayMinutes += duration
    state.streak++
    if (state.streak > state.bestStreak) state.bestStreak = state.streak

    // Sound
    if (config.soundEnabled) playNotification('complete')

    // Determine next mode
    if (state.streak % config.sessionsBeforeLong === 0) {
      setMode('long')
    } else {
      setMode('short')
    }
  } else {
    // Break done → back to focus
    if (config.soundEnabled) playNotification('break')
    setMode('focus')
    state.currentSession = Math.min(state.currentSession + 1, config.sessionsBeforeLong + 1)
  }

  renderSessionDots()
  renderStats()
  renderLog()
  saveState()

  // Auto start
  if (config.autoStart) {
    setTimeout(() => startTimer(), 1500)
  } else {
    startBtn.hidden = false
    startBtn.textContent = '▶ Start'
    pauseBtn.hidden = true
  }
}

// ─── Mode ──────────────────────────────────────────────────────────
function setMode(mode) {
  state.mode = mode
  state.timeLeft = getModeTime(mode) * 60
  state.totalTime = state.timeLeft

  // Update tabs
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode)
  })

  // Update colors
  infinityContainer.className = `infinity-container mode-${mode}`

  // Labels
  const labels = { focus: 'Focus Time', short: 'Short Break', long: 'Long Break' }
  timerLabel.textContent = labels[mode]

  startBtn.textContent = '▶ Start'
  startBtn.hidden = false
  pauseBtn.hidden = true
  timerDisplay.classList.remove('paused')

  updateDisplay()
  updateInfinity(0)
}

// ─── Session Dots ──────────────────────────────────────────────────
function renderSessionDots() {
  sessionDots.innerHTML = ''
  for (let i = 1; i <= config.sessionsBeforeLong; i++) {
    const dot = document.createElement('div')
    dot.className = 'session-dot'
    if (i < state.streak % config.sessionsBeforeLong + 1) {
      dot.classList.add('filled')
    }
    sessionDots.appendChild(dot)
  }
  sessionText.textContent = `Session ${state.streak % config.sessionsBeforeLong + 1} of ${config.sessionsBeforeLong}`
}

// ─── Stats ─────────────────────────────────────────────────────────
function renderStats() {
  document.getElementById('statStreak').textContent = state.streak
  const hours = Math.floor(state.todayMinutes / 60)
  const mins = state.todayMinutes % 60
  document.getElementById('statTotal').textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  document.getElementById('statSessions').textContent = state.todaySessions
  document.getElementById('statBest').textContent = state.bestStreak
}

// ─── Log ───────────────────────────────────────────────────────────
function renderLog() {
  if (state.log.length === 0) {
    logList.innerHTML = '<p class="log-empty">No sessions yet today. Start your first focus!</p>'
    return
  }

  logList.innerHTML = state.log.map(entry => `
    <div class="log-entry">
      <span class="log-type ${entry.type}">${entry.type === 'focus' ? '🎯' : entry.type === 'short' ? '☕' : '🌿'} ${entry.type}</span>
      <span>${entry.duration} min</span>
      <span class="log-time">${entry.time}</span>
    </div>
  `).join('')
}

// ─── Sound ─────────────────────────────────────────────────────────
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

function playNotification(type) {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'complete') {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15) // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3) // G5
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    } else {
      osc.frequency.setValueAtTime(783.99, ctx.currentTime) // G5
      osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.15) // C5
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    }
  } catch (e) { /* ignore */ }
}

// ─── Ambient Sound (Web Audio noise generator) ─────────────────────
function startAmbient() {
  stopAmbient()
  if (config.ambientSound === 'none') return

  try {
    const ctx = getAudioCtx()
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    // Generate noise based on type
    for (let i = 0; i < bufferSize; i++) {
      if (config.ambientSound === 'rain' || config.ambientSound === 'waves') {
        data[i] = (Math.random() * 2 - 1) * 0.3
      } else if (config.ambientSound === 'forest') {
        data[i] = (Math.random() * 2 - 1) * 0.15 + Math.sin(i * 0.001) * 0.1
      } else if (config.ambientSound === 'cafe') {
        data[i] = (Math.random() * 2 - 1) * 0.2 + (Math.random() > 0.99 ? (Math.random() - 0.5) * 0.4 : 0)
      } else if (config.ambientSound === 'fire') {
        data[i] = (Math.random() * 2 - 1) * 0.2 + (Math.random() > 0.98 ? (Math.random() - 0.5) * 0.5 : 0)
      }
    }

    ambientNode = ctx.createBufferSource()
    ambientNode.buffer = buffer
    ambientNode.loop = true

    ambientGain = ctx.createGain()
    ambientGain.gain.value = config.volume / 100 * 0.3

    // Low-pass filter for warmth
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = config.ambientSound === 'rain' ? 800 : config.ambientSound === 'cafe' ? 2000 : 600

    ambientNode.connect(filter)
    filter.connect(ambientGain)
    ambientGain.connect(ctx.destination)
    ambientNode.start()
  } catch (e) { /* ignore */ }
}

function stopAmbient() {
  try {
    if (ambientNode) { ambientNode.stop(); ambientNode = null }
  } catch (e) { /* ignore */ }
}

// ─── Event Listeners ───────────────────────────────────────────────
startBtn.addEventListener('click', startTimer)
pauseBtn.addEventListener('click', pauseTimer)
resetBtn.addEventListener('click', resetTimer)
skipBtn.addEventListener('click', skipSession)

// Mode tabs
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (state.running && !state.paused) return // Don't switch while running
    setMode(tab.dataset.mode)
    renderSessionDots()
  })
})

// Settings
document.getElementById('focusTime').addEventListener('change', (e) => {
  config.focusTime = parseInt(e.target.value, 10) || 25
  if (state.mode === 'focus' && !state.running) applyConfig()
  updateDisplay()
  saveState()
})

document.getElementById('shortBreak').addEventListener('change', (e) => {
  config.shortBreak = parseInt(e.target.value, 10) || 5
  if (state.mode === 'short' && !state.running) applyConfig()
  updateDisplay()
  saveState()
})

document.getElementById('longBreak').addEventListener('change', (e) => {
  config.longBreak = parseInt(e.target.value, 10) || 15
  if (state.mode === 'long' && !state.running) applyConfig()
  updateDisplay()
  saveState()
})

document.getElementById('sessionsBeforeLong').addEventListener('change', (e) => {
  config.sessionsBeforeLong = parseInt(e.target.value, 10) || 4
  renderSessionDots()
  saveState()
})

document.getElementById('autoStart').addEventListener('change', (e) => {
  config.autoStart = e.target.checked
  saveState()
})

document.getElementById('soundEnabled').addEventListener('change', (e) => {
  config.soundEnabled = e.target.checked
  saveState()
})

document.getElementById('ambientSound').addEventListener('change', (e) => {
  config.ambientSound = e.target.value
  if (state.running) startAmbient()
  saveState()
})

document.getElementById('volume').addEventListener('input', (e) => {
  config.volume = parseInt(e.target.value, 10)
  if (ambientGain) ambientGain.gain.value = config.volume / 100 * 0.3
  saveState()
})

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
  if (e.code === 'Space') { e.preventDefault(); state.running ? pauseTimer() : startTimer() }
  if (e.key === 'r') resetTimer()
  if (e.key === 's') skipSession()
})

// ─── Start ─────────────────────────────────────────────────────────
init()
