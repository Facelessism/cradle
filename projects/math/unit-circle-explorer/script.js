/**
 * Unit Circle Explorer — main script
 * Interactive unit circle with draggable angle and trig value display.
 */

// ─── Key Angles ────────────────────────────────────────────────────
const KEY_ANGLES = [
  { deg: 0, label: '0°' },
  { deg: 30, label: '30°' },
  { deg: 45, label: '45°' },
  { deg: 60, label: '60°' },
  { deg: 90, label: '90°' },
  { deg: 120, label: '120°' },
  { deg: 135, label: '135°' },
  { deg: 150, label: '150°' },
  { deg: 180, label: '180°' },
  { deg: 210, label: '210°' },
  { deg: 225, label: '225°' },
  { deg: 240, label: '240°' },
  { deg: 270, label: '270°' },
  { deg: 300, label: '300°' },
  { deg: 315, label: '315°' },
  { deg: 330, label: '330°' },
  { deg: 360, label: '360°' }
]

// ─── State ─────────────────────────────────────────────────────────
let angleDeg = 0
let isDragging = false
let showDegrees = true
let showReference = true
let showLabels = false

// ─── DOM ───────────────────────────────────────────────────────────
const canvas = document.getElementById('unitCircle')
const ctx = canvas.getContext('2d')
const angleDegEl = document.getElementById('angleDeg')
const angleRadEl = document.getElementById('angleRad')
const angleInput = document.getElementById('angleInput')
const angleSlider = document.getElementById('angleSlider')
const sinValue = document.getElementById('sinValue')
const cosValue = document.getElementById('cosValue')
const tanValue = document.getElementById('tanValue')
const cscValue = document.getElementById('cscValue')
const secValue = document.getElementById('secValue')
const cotValue = document.getElementById('cotValue')
const sinBar = document.getElementById('sinBar')
const cosBar = document.getElementById('cosBar')
const tanBar = document.getElementById('tanBar')
const coordX = document.getElementById('coordX')
const coordY = document.getElementById('coordY')
const anglesGrid = document.getElementById('anglesGrid')

// ─── Canvas Setup ──────────────────────────────────────────────────
const dpr = window.devicePixelRatio || 1

function resizeCanvas() {
  const panel = document.querySelector('.canvas-panel')
  const size = Math.min(panel.clientWidth - 40, panel.clientHeight - 60, 500)
  canvas.style.width = size + 'px'
  canvas.style.height = size + 'px'
  canvas.width = size * dpr
  canvas.height = size * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  render()
}

// ─── Rendering ─────────────────────────────────────────────────────
function render() {
  const w = canvas.width / dpr
  const h = canvas.height / dpr
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(cx, cy) * 0.85

  ctx.clearRect(0, 0, w, h)

  // Background
  ctx.fillStyle = '#080810'
  ctx.fillRect(0, 0, w, h)

  // Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
  ctx.lineWidth = 1
  for (let i = -4; i <= 4; i++) {
    const x = cx + (i / 4) * r
    const y = cy + (i / 4) * r
    ctx.beginPath(); ctx.moveTo(x, cy - r); ctx.lineTo(x, cy + r); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx - r, y); ctx.lineTo(cx + r, y); ctx.stroke()
  }

  // Axes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(cx - r - 20, cy); ctx.lineTo(cx + r + 20, cy); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx, cy - r - 20); ctx.lineTo(cx, cy + r + 20); ctx.stroke()

  // Axis labels
  ctx.fillStyle = '#64748b'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('1', cx + r + 12, cy + 4)
  ctx.fillText('-1', cx - r - 12, cy + 4)
  ctx.fillText('1', cx + 12, cy - r - 8)
  ctx.fillText('-1', cx + 12, cy + r + 16)

  // Unit circle
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)'
  ctx.lineWidth = 2
  ctx.stroke()

  const angleRad = (angleDeg * Math.PI) / 180
  const x = Math.cos(angleRad)
  const y = -Math.sin(angleRad) // Canvas y is inverted

  const px = cx + x * r
  const py = cy + y * r

  // Reference angle triangle
  if (showReference && angleDeg % 180 !== 0 && angleDeg % 90 !== 0) {
    // Reference angle to x-axis
    const refAngle = getRefAngle(angleDeg)
    const refRad = (refAngle * Math.PI) / 180

    // Horizontal line (cos)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = '#3b82f640'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(px, cy)
    ctx.stroke()

    // Vertical line (sin)
    ctx.strokeStyle = '#ef444440'
    ctx.beginPath()
    ctx.moveTo(px, cy)
    ctx.lineTo(px, py)
    ctx.stroke()

    ctx.setLineDash([])
  }

  // Sin line (vertical)
  ctx.strokeStyle = '#ef4444'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(px, cy)
  ctx.lineTo(px, py)
  ctx.stroke()

  // Cos line (horizontal)
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(px, cy)
  ctx.stroke()

  // Angle arc
  ctx.beginPath()
  const arcR = r * 0.2
  if (angleDeg > 0) {
    ctx.arc(cx, cy, arcR, 0, -angleRad, true)
    ctx.strokeStyle = '#a855f780'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // Angle label on arc
  if (angleDeg > 5 && angleDeg < 355) {
    const labelAngle = angleRad / 2
    const lx = cx + Math.cos(-labelAngle) * (arcR + 14)
    const ly = cy + Math.sin(-labelAngle) * (arcR + 14)
    ctx.fillStyle = '#a855f7'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(showDegrees ? `${Math.round(angleDeg)}°` : `${angleRad.toFixed(2)}r`, lx, ly + 4)
  }

  // Radius line
  ctx.strokeStyle = '#ffffff40'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(px, py)
  ctx.stroke()

  // Point on circle
  ctx.beginPath()
  ctx.arc(px, py, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2.5
  ctx.stroke()

  // Glow on point
  ctx.beginPath()
  ctx.arc(px, py, 14, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
  ctx.fill()

  // Key angle labels
  if (showLabels) {
    for (const ka of KEY_ANGLES) {
      if (ka.deg === 0 || ka.deg === 360) continue
      const kaRad = (ka.deg * Math.PI) / 180
      const kx = cx + Math.cos(-kaRad) * (r + 16)
      const ky = cy + Math.sin(-kaRad) * (r + 16)
      ctx.fillStyle = '#64748b'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(ka.label, kx, ky + 3)

      // Small dot
      const dx = cx + Math.cos(-kaRad) * r
      const dy = cy + Math.sin(-kaRad) * r
      ctx.beginPath()
      ctx.arc(dx, dy, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = '#64748b'
      ctx.fill()
    }
  }

  // Origin dot
  ctx.beginPath()
  ctx.arc(cx, cy, 3, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
}

// ─── Trig Calculations ─────────────────────────────────────────────
function updateValues() {
  const rad = (angleDeg * Math.PI) / 180
  const sin = Math.sin(rad)
  const cos = Math.cos(rad)
  const tan = Math.abs(cos) > 1e-10 ? Math.tan(rad) : null
  const csc = Math.abs(sin) > 1e-10 ? 1 / sin : null
  const sec = Math.abs(cos) > 1e-10 ? 1 / cos : null
  const cot = Math.abs(sin) > 1e-10 ? cos / sin : null

  angleDegEl.textContent = `${angleDeg.toFixed(1)}°`
  angleRadEl.textContent = `${rad.toFixed(4)} rad`
  angleInput.value = Math.round(angleDeg)
  angleSlider.value = angleDeg

  sinValue.textContent = sin.toFixed(4)
  cosValue.textContent = cos.toFixed(4)
  tanValue.textContent = tan !== null ? tan.toFixed(4) : '∞'
  cscValue.textContent = csc !== null ? csc.toFixed(4) : '—'
  secValue.textContent = sec !== null ? sec.toFixed(4) : '—'
  cotValue.textContent = cot !== null ? cot.toFixed(4) : '—'

  coordX.textContent = cos.toFixed(4)
  coordY.textContent = sin.toFixed(4)

  // Update bars (centered at 50%)
  const barScale = 45
  updateBar(sinBar, sin * barScale)
  updateBar(cosBar, cos * barScale)
  if (tan !== null) {
    updateBar(tanBar, Math.max(-1, Math.min(1, tan)) * barScale)
  } else {
    tanBar.style.width = '0'
  }

  // Quadrant
  updateQuadrant()

  // Active angle button
  document.querySelectorAll('.angle-btn').forEach(btn => {
    const deg = parseFloat(btn.dataset.deg)
    btn.classList.toggle('active', Math.abs(deg - angleDeg) < 0.5 || Math.abs(deg - angleDeg + 360) < 0.5)
  })
}

function updateBar(bar, offset) {
  const center = 50
  if (offset >= 0) {
    bar.style.left = center + '%'
    bar.style.width = Math.min(offset, 50) + '%'
  } else {
    bar.style.left = (center + offset) + '%'
    bar.style.width = Math.min(-offset, 50) + '%'
  }
}

function updateQuadrant() {
  const cells = ['q1', 'q2', 'q3', 'q4']
  cells.forEach(id => document.getElementById(id).classList.remove('q-active'))

  let q
  if (angleDeg >= 0 && angleDeg < 90) q = 'q1'
  else if (angleDeg >= 90 && angleDeg < 180) q = 'q2'
  else if (angleDeg >= 180 && angleDeg < 270) q = 'q3'
  else if (angleDeg >= 270 && angleDeg < 360) q = 'q4'
  else q = 'q1'

  document.getElementById(q).classList.add('q-active')

  const activeCell = document.querySelector('.q-active')
  const qNum = { q1: 'I', q2: 'II', q3: 'III', q4: 'IV' }
  document.getElementById('q-active').textContent = qNum[q]
  document.getElementById('q-active').classList.add('q-active')
}

function getRefAngle(deg) {
  const normalized = deg % 360
  if (normalized <= 90) return normalized
  if (normalized <= 180) return 180 - normalized
  if (normalized <= 270) return normalized - 180
  return 360 - normalized
}

// ─── Angle Setting ─────────────────────────────────────────────────
function setAngle(deg) {
  angleDeg = ((deg % 360) + 360) % 360
  updateValues()
  render()
}

// ─── Canvas Interaction ────────────────────────────────────────────
function getAngleFromEvent(e) {
  const rect = canvas.getBoundingClientRect()
  const w = rect.width
  const h = rect.height
  const cx = w / 2
  const cy = h / 2
  const x = e.clientX - rect.left - cx
  const y = -(e.clientY - rect.top - cy)
  let deg = (Math.atan2(y, x) * 180) / Math.PI
  if (deg < 0) deg += 360
  return deg
}

canvas.addEventListener('mousedown', (e) => {
  isDragging = true
  setAngle(getAngleFromEvent(e))
})

canvas.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  setAngle(getAngleFromEvent(e))
})

window.addEventListener('mouseup', () => {
  isDragging = false
})

// Touch support
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault()
  isDragging = true
  setAngle(getAngleFromEvent(e.touches[0]))
})

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault()
  if (!isDragging) return
  setAngle(getAngleFromEvent(e.touches[0]))
})

canvas.addEventListener('touchend', () => {
  isDragging = false
})

// Input controls
angleInput.addEventListener('change', () => {
  setAngle(parseFloat(angleInput.value) || 0)
})

angleSlider.addEventListener('input', () => {
  setAngle(parseFloat(angleSlider.value))
})

// Toggle controls
document.getElementById('showDegrees').addEventListener('change', (e) => {
  showDegrees = e.target.checked
  updateValues()
  render()
})

document.getElementById('showReference').addEventListener('change', (e) => {
  showReference = e.target.checked
  render()
})

document.getElementById('showLabels').addEventListener('change', (e) => {
  showLabels = e.target.checked
  render()
})

// Snap to key angle
document.getElementById('snapToKey').addEventListener('click', () => {
  let closest = KEY_ANGLES[0]
  let minDiff = 360
  for (const ka of KEY_ANGLES) {
    const diff = Math.abs(ka.deg - angleDeg)
    if (diff < minDiff) { minDiff = diff; closest = ka }
  }
  setAngle(closest.deg)
})

// Keyboard
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return
  if (e.key === 'ArrowRight') setAngle(angleDeg + (e.shiftKey ? 15 : 5))
  if (e.key === 'ArrowLeft') setAngle(angleDeg - (e.shiftKey ? 15 : 5))
})

// ─── Key Angles Grid ──────────────────────────────────────────────
function renderAnglesGrid() {
  anglesGrid.innerHTML = ''
  const displayAngles = KEY_ANGLES.filter(a => a.deg < 360)
  for (const ka of displayAngles) {
    const btn = document.createElement('button')
    btn.className = 'angle-btn'
    btn.dataset.deg = ka.deg
    btn.textContent = ka.label
    btn.addEventListener('click', () => setAngle(ka.deg))
    anglesGrid.appendChild(btn)
  }
}

// ─── Init ──────────────────────────────────────────────────────────
renderAnglesGrid()
window.addEventListener('resize', resizeCanvas)
resizeCanvas()
updateValues()
