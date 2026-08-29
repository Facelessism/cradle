/**
 * Cyberpunk Pixel Art Generator — main script
 * Canvas-based pixel art editor with neon cyberpunk theme.
 */

// ─── Cyberpunk Palette ─────────────────────────────────────────────
const CYBER_PALETTE = [
  '#000000', '#0d0d1a', '#1a1a2e', '#16213e', '#0f3460', '#1a508b', '#00b4d8', '#00ffff',
  '#ff00ff', '#ff0066', '#ff3366', '#ff6699', '#ff0044', '#cc00ff', '#9900ff', '#6600ff',
  '#ffff00', '#ffd000', '#ff9500', '#ff6600', '#ff3300', '#00ff00', '#33ff66', '#66ff99',
  '#ffffff', '#e0e0e0', '#b0b0b0', '#808080', '#505050', '#2d2d44', '#1a1a2e', '#0a0a14',
  '#ff1493', '#ff69b4', '#da70d6', '#ba55d3', '#9370db', '#7b68ee', '#00ced1', '#20b2aa',
  '#3cb371', '#2e8b57', '#00fa9a', '#00ff7f', '#adff2f', '#bdb76b', '#daa520', '#cd853f'
]

// ─── State ─────────────────────────────────────────────────────────
let gridSize = 16
let currentColor = '#ff00ff'
let currentTool = 'brush'
let brushSize = 1
let isDrawing = false
let layers = [{ id: 1, name: 'Layer 1', visible: true, data: null }]
let activeLayerIndex = 0
let layerIdCounter = 1

// Each layer data is a 2D array: layers[i].data[y][x] = color or null
let undoStack = []
let redoStack = []
const MAX_HISTORY = 50

let lineStart = null
let rectStart = null

// ─── DOM ───────────────────────────────────────────────────────────
const pixelCanvas = document.getElementById('pixelCanvas')
const gridOverlay = document.getElementById('gridOverlay')
const previewCanvas = document.getElementById('previewCanvas')
const ctx = pixelCanvas.getContext('2d')
const gridCtx = gridOverlay.getContext('2d')
const previewCtx = previewCanvas.getContext('2d')
const canvasWrapper = document.getElementById('canvasWrapper')
const paletteEl = document.getElementById('palette')
const layersListEl = document.getElementById('layersList')
const coordDisplay = document.getElementById('coordDisplay')
const zoomDisplay = document.getElementById('zoomDisplay')
const historyCountEl = document.getElementById('historyCount')

// ─── Canvas Sizing ─────────────────────────────────────────────────
function getCanvasSize() {
  const area = document.querySelector('.canvas-area')
  const maxW = area.clientWidth - 40
  const maxH = area.clientHeight - 60
  const size = Math.min(maxW, maxH, 560)
  return Math.max(size, 200)
}

function pixelSize() {
  return getCanvasSize() / gridSize
}

function initCanvas() {
  const size = getCanvasSize()
  const ps = pixelSize()

  for (const c of [pixelCanvas, gridOverlay, previewCanvas]) {
    c.width = size
    c.height = size
    c.style.width = size + 'px'
    c.style.height = size + 'px'
  }

  // Init layer data if needed
  for (const layer of layers) {
    if (!layer.data || layer.data.length !== gridSize) {
      layer.data = createEmptyGrid()
    }
  }

  renderGrid()
  renderCanvas()
}

function createEmptyGrid() {
  return Array.from({ length: gridSize }, () => Array(gridSize).fill(null))
}

// ─── Rendering ─────────────────────────────────────────────────────
function renderCanvas() {
  ctx.clearRect(0, 0, pixelCanvas.width, pixelCanvas.height)

  // Draw checker background
  const ps = pixelSize()
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#0a0a14' : '#0d0d1a'
      ctx.fillRect(x * ps, y * ps, ps, ps)
    }
  }

  // Draw layers bottom to top
  for (const layer of layers) {
    if (!layer.visible || !layer.data) continue
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (layer.data[y] && layer.data[y][x]) {
          ctx.fillStyle = layer.data[y][x]
          ctx.fillRect(x * ps, y * ps, ps, ps)
        }
      }
    }
  }
}

function renderGrid() {
  gridCtx.clearRect(0, 0, gridOverlay.width, gridOverlay.height)
  const ps = pixelSize()
  gridCtx.strokeStyle = 'rgba(0, 255, 255, 0.08)'
  gridCtx.lineWidth = 0.5

  for (let i = 0; i <= gridSize; i++) {
    gridCtx.beginPath()
    gridCtx.moveTo(i * ps, 0)
    gridCtx.lineTo(i * ps, gridOverlay.height)
    gridCtx.stroke()
    gridCtx.beginPath()
    gridCtx.moveTo(0, i * ps)
    gridCtx.lineTo(gridOverlay.width, i * ps)
    gridCtx.stroke()
  }
}

function clearPreview() {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height)
}

// ─── Palette ───────────────────────────────────────────────────────
function renderPalette() {
  paletteEl.innerHTML = ''
  for (const color of CYBER_PALETTE) {
    const el = document.createElement('div')
    el.className = 'palette-color' + (color === currentColor ? ' active' : '')
    el.style.background = color
    el.addEventListener('click', () => selectColor(color))
    paletteEl.appendChild(el)
  }
}

function selectColor(color) {
  currentColor = color
  document.getElementById('customColor').value = color
  document.getElementById('colorHex').textContent = color
  renderPalette()
}

// ─── Layers UI ─────────────────────────────────────────────────────
function renderLayers() {
  layersListEl.innerHTML = ''
  layers.forEach((layer, i) => {
    const el = document.createElement('div')
    el.className = 'layer-item' + (i === activeLayerIndex ? ' active' : '')
    el.innerHTML = `
      <button class="layer-visibility" data-idx="${i}">${layer.visible ? '👁️' : '🚫'}</button>
      <span class="layer-name">${layer.name}</span>
    `
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('layer-visibility')) {
        layer.visible = !layer.visible
        renderLayers()
        renderCanvas()
        return
      }
      activeLayerIndex = i
      renderLayers()
    })
    layersListEl.appendChild(el)
  })
}

// ─── History ───────────────────────────────────────────────────────
function saveState() {
  const snapshot = layers.map(l => ({
    ...l,
    data: l.data ? l.data.map(row => [...row]) : null
  }))
  undoStack.push({ layers: snapshot, activeLayerIndex })
  if (undoStack.length > MAX_HISTORY) undoStack.shift()
  redoStack = []
  updateHistoryCount()
}

function undo() {
  if (undoStack.length === 0) return
  const currentSnapshot = layers.map(l => ({
    ...l,
    data: l.data ? l.data.map(row => [...row]) : null
  }))
  redoStack.push({ layers: currentSnapshot, activeLayerIndex })

  const prev = undoStack.pop()
  layers = prev.layers
  activeLayerIndex = prev.activeLayerIndex
  renderLayers()
  renderCanvas()
  updateHistoryCount()
}

function redo() {
  if (redoStack.length === 0) return
  const currentSnapshot = layers.map(l => ({
    ...l,
    data: l.data ? l.data.map(row => [...row]) : null
  }))
  undoStack.push({ layers: currentSnapshot, activeLayerIndex })

  const next = redoStack.pop()
  layers = next.layers
  activeLayerIndex = next.activeLayerIndex
  renderLayers()
  renderCanvas()
  updateHistoryCount()
}

function updateHistoryCount() {
  historyCountEl.textContent = `${undoStack.length} steps`
}

// ─── Drawing ───────────────────────────────────────────────────────
function getGridPos(e) {
  const rect = pixelCanvas.getBoundingClientRect()
  const ps = pixelSize()
  const x = Math.floor((e.clientX - rect.left) / ps)
  const y = Math.floor((e.clientY - rect.top) / ps)
  return { x: Math.max(0, Math.min(x, gridSize - 1)), y: Math.max(0, Math.min(y, gridSize - 1)) }
}

function setPixel(x, y, color) {
  const layer = layers[activeLayerIndex]
  if (!layer || !layer.data) return
  const size = Math.floor(brushSize)
  const offset = Math.floor(size / 2)
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const px = x - offset + dx
      const py = y - offset + dy
      if (px >= 0 && px < gridSize && py >= 0 && py < gridSize) {
        layer.data[py][px] = color
      }
    }
  }
}

function floodFill(startX, startY, fillColor) {
  const layer = layers[activeLayerIndex]
  if (!layer || !layer.data) return
  const targetColor = layer.data[startY][startX]
  if (targetColor === fillColor) return

  const stack = [[startX, startY]]
  const visited = new Set()

  while (stack.length > 0) {
    const [x, y] = stack.pop()
    const key = `${x},${y}`
    if (visited.has(key)) continue
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue
    if (layer.data[y][x] !== targetColor) continue

    visited.add(key)
    layer.data[y][x] = fillColor

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
}

function drawLine(x0, y0, x1, y1, color) {
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  while (true) {
    setPixel(x0, y0, color)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 < dx) { err += dx; y0 += sy }
  }
}

function drawRect(x0, y0, x1, y1, color) {
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1)
  const minY = Math.min(y0, y1), maxY = Math.max(y0, y1)
  for (let x = minX; x <= maxX; x++) {
    setPixel(x, minY, color)
    setPixel(x, maxY, color)
  }
  for (let y = minY; y <= maxY; y++) {
    setPixel(minX, y, color)
    setPixel(maxX, y, color)
  }
}

// ─── Effects ───────────────────────────────────────────────────────
function applyNeonGlow() {
  saveState()
  const layer = layers[activeLayerIndex]
  if (!layer || !layer.data) return
  const copy = layer.data.map(r => [...r])

  for (let y = 1; y < gridSize - 1; y++) {
    for (let x = 1; x < gridSize - 1; x++) {
      if (copy[y][x]) {
        // Spread glow to neighbors
        const glow = adjustBrightness(copy[y][x], 40)
        for (const [dy, dx] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const ny = y + dy, nx = x + dx
          if (copy[ny][nx] === null && layer.data[ny][nx] === null) {
            layer.data[ny][nx] = glow
          }
        }
      }
    }
  }
  renderCanvas()
}

function applyScanlines() {
  saveState()
  const layer = layers[activeLayerIndex]
  if (!layer || !layer.data) return

  for (let y = 0; y < gridSize; y++) {
    if (y % 2 === 0) continue
    for (let x = 0; x < gridSize; x++) {
      if (layer.data[y][x]) {
        layer.data[y][x] = adjustBrightness(layer.data[y][x], -40)
      }
    }
  }
  renderCanvas()
}

function applyGlitch() {
  saveState()
  const layer = layers[activeLayerIndex]
  if (!layer || !layer.data) return
  const copy = layer.data.map(r => [...r])

  for (let i = 0; i < 5; i++) {
    const y = Math.floor(Math.random() * gridSize)
    const h = Math.floor(Math.random() * 3) + 1
    const offset = Math.floor(Math.random() * 6) - 3
    for (let dy = 0; dy < h && y + dy < gridSize; dy++) {
      for (let x = 0; x < gridSize; x++) {
        const srcX = (x + offset + gridSize) % gridSize
        layer.data[y + dy][x] = copy[y + dy][srcX]
      }
    }
  }
  renderCanvas()
}

function applyMirrorX() {
  saveState()
  const layer = layers[activeLayerIndex]
  if (!layer || !layer.data) return
  const half = Math.floor(gridSize / 2)

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < half; x++) {
      layer.data[y][gridSize - 1 - x] = layer.data[y][x]
    }
  }
  renderCanvas()
}

function adjustBrightness(hex, amount) {
  let r = parseInt(hex.slice(1, 3), 16)
  let g = parseInt(hex.slice(3, 5), 16)
  let b = parseInt(hex.slice(5, 7), 16)
  r = Math.max(0, Math.min(255, r + amount))
  g = Math.max(0, Math.min(255, g + amount))
  b = Math.max(0, Math.min(255, b + amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ─── Export / Import ───────────────────────────────────────────────
function exportPng() {
  // Render to a temporary canvas at 1:1 pixel scale
  const scale = Math.max(1, Math.floor(512 / gridSize))
  const expCanvas = document.createElement('canvas')
  expCanvas.width = gridSize * scale
  expCanvas.height = gridSize * scale
  const expCtx = expCanvas.getContext('2d')

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      let color = null
      for (const layer of layers) {
        if (layer.visible && layer.data && layer.data[y] && layer.data[y][x]) {
          color = layer.data[y][x]
        }
      }
      if (color) {
        expCtx.fillStyle = color
        expCtx.fillRect(x * scale, y * scale, scale, scale)
      }
    }
  }

  const link = document.createElement('a')
  link.download = `cyberpunk-art-${gridSize}x${gridSize}.png`
  link.href = expCanvas.toDataURL('image/png')
  link.click()
}

function exportJson() {
  const data = {
    gridSize,
    layers: layers.map(l => ({
      name: l.name,
      visible: l.visible,
      data: l.data
    }))
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.download = `cyberpunk-art-${gridSize}x${gridSize}.json`
  link.href = URL.createObjectURL(blob)
  link.click()
}

function importJson(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      gridSize = data.gridSize || 16
      document.getElementById('gridSize').value = gridSize
      layers = data.layers.map((l, i) => ({
        id: i + 1,
        name: l.name,
        visible: l.visible,
        data: l.data
      }))
      activeLayerIndex = 0
      layerIdCounter = layers.length + 1
      initCanvas()
      renderLayers()
    } catch (err) {
      alert('Invalid JSON file')
    }
  }
  reader.readAsText(file)
}

// ─── Event Handlers ────────────────────────────────────────────────
pixelCanvas.addEventListener('mousedown', (e) => {
  if (!layers[activeLayerIndex]?.visible) return
  const { x, y } = getGridPos(e)
  isDrawing = true

  if (currentTool === 'brush') {
    saveState()
    setPixel(x, y, currentColor)
    renderCanvas()
  } else if (currentTool === 'eraser') {
    saveState()
    setPixel(x, y, null)
    renderCanvas()
  } else if (currentTool === 'fill') {
    saveState()
    floodFill(x, y, currentColor)
    renderCanvas()
  } else if (currentTool === 'eyedropper') {
    const color = getColorAt(x, y)
    if (color) selectColor(color)
  } else if (currentTool === 'line') {
    lineStart = { x, y }
    saveState()
  } else if (currentTool === 'rect') {
    rectStart = { x, y }
    saveState()
  }
})

pixelCanvas.addEventListener('mousemove', (e) => {
  const { x, y } = getGridPos(e)
  coordDisplay.textContent = `X: ${x}, Y: ${y}`

  if (!isDrawing) return

  if (currentTool === 'brush') {
    setPixel(x, y, currentColor)
    renderCanvas()
  } else if (currentTool === 'eraser') {
    setPixel(x, y, null)
    renderCanvas()
  } else if (currentTool === 'line' && lineStart) {
    clearPreview()
    previewCtx.strokeStyle = currentColor
    previewCtx.lineWidth = pixelSize()
    previewCtx.lineCap = 'square'
    previewCtx.beginPath()
    previewCtx.moveTo(lineStart.x * pixelSize() + pixelSize() / 2, lineStart.y * pixelSize() + pixelSize() / 2)
    previewCtx.lineTo(x * pixelSize() + pixelSize() / 2, y * pixelSize() + pixelSize() / 2)
    previewCtx.stroke()
  } else if (currentTool === 'rect' && rectStart) {
    clearPreview()
    previewCtx.strokeStyle = currentColor
    previewCtx.lineWidth = pixelSize()
    const minX = Math.min(rectStart.x, x) * pixelSize()
    const minY = Math.min(rectStart.y, y) * pixelSize()
    const w = (Math.abs(x - rectStart.x) + 1) * pixelSize()
    const h = (Math.abs(y - rectStart.y) + 1) * pixelSize()
    previewCtx.strokeRect(minX, minY, w, h)
  }
})

pixelCanvas.addEventListener('mouseup', (e) => {
  if (!isDrawing) return
  const { x, y } = getGridPos(e)

  if (currentTool === 'line' && lineStart) {
    drawLine(lineStart.x, lineStart.y, x, y, currentColor)
    lineStart = null
    clearPreview()
    renderCanvas()
  } else if (currentTool === 'rect' && rectStart) {
    drawRect(rectStart.x, rectStart.y, x, y, currentColor)
    rectStart = null
    clearPreview()
    renderCanvas()
  }

  isDrawing = false
})

pixelCanvas.addEventListener('mouseleave', () => {
  isDrawing = false
  lineStart = null
  rectStart = null
  clearPreview()
})

// Tool buttons
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    currentTool = btn.dataset.tool
  })
})

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
  const key = e.key.toLowerCase()
  if (key === 'b') selectTool('brush')
  else if (key === 'e') selectTool('eraser')
  else if (key === 'f') selectTool('fill')
  else if (key === 'i') selectTool('eyedropper')
  else if (key === 'l') selectTool('line')
  else if (key === 'r') selectTool('rect')
  else if (e.ctrlKey && key === 'z') { e.preventDefault(); undo() }
  else if (e.ctrlKey && key === 'y') { e.preventDefault(); redo() }
})

function selectTool(tool) {
  currentTool = tool
  document.querySelectorAll('.tool-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool)
  })
}

function getColorAt(x, y) {
  for (let i = layers.length - 1; i >= 0; i--) {
    if (layers[i].visible && layers[i].data && layers[i].data[y] && layers[i].data[y][x]) {
      return layers[i].data[y][x]
    }
  }
  return null
}

// Brush size
document.getElementById('brushSize').addEventListener('input', (e) => {
  brushSize = parseInt(e.target.value, 10)
  document.getElementById('brushSizeLabel').textContent = brushSize + 'px'
})

// Grid size
document.getElementById('applySize').addEventListener('click', () => {
  const newSize = parseInt(document.getElementById('gridSize').value, 10)
  if (newSize !== gridSize) {
    saveState()
    gridSize = newSize
    layers = [{ id: 1, name: 'Layer 1', visible: true, data: createEmptyGrid() }]
    activeLayerIndex = 0
    layerIdCounter = 1
    initCanvas()
    renderLayers()
  }
})

// Custom color
document.getElementById('customColor').addEventListener('input', (e) => {
  selectColor(e.target.value)
})

// Layers
document.getElementById('addLayer').addEventListener('click', () => {
  saveState()
  layerIdCounter++
  layers.push({
    id: layerIdCounter,
    name: `Layer ${layerIdCounter}`,
    visible: true,
    data: createEmptyGrid()
  })
  activeLayerIndex = layers.length - 1
  renderLayers()
})

document.getElementById('mergeLayers').addEventListener('click', () => {
  if (activeLayerIndex <= 0) return
  saveState()
  const upper = layers[activeLayerIndex]
  const lower = layers[activeLayerIndex - 1]
  if (upper.data && lower.data) {
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (upper.data[y][x]) lower.data[y][x] = upper.data[y][x]
      }
    }
  }
  layers.splice(activeLayerIndex, 1)
  activeLayerIndex = activeLayerIndex - 1
  renderLayers()
  renderCanvas()
})

// Effects
document.getElementById('effectGlow').addEventListener('click', applyNeonGlow)
document.getElementById('effectScanlines').addEventListener('click', applyScanlines)
document.getElementById('effectGlitch').addEventListener('click', applyGlitch)
document.getElementById('effectMirror').addEventListener('click', applyMirrorX)

// History
document.getElementById('undoBtn').addEventListener('click', undo)
document.getElementById('redoBtn').addEventListener('click', redo)

// Export / Import
document.getElementById('exportPng').addEventListener('click', exportPng)
document.getElementById('exportJson').addEventListener('click', exportJson)
document.getElementById('importJson').addEventListener('click', () => {
  document.getElementById('fileInput').click()
})
document.getElementById('fileInput').addEventListener('change', (e) => {
  if (e.target.files[0]) importJson(e.target.files[0])
})
document.getElementById('clearCanvas').addEventListener('click', () => {
  if (confirm('Clear entire canvas?')) {
    saveState()
    for (const layer of layers) {
      layer.data = createEmptyGrid()
    }
    renderCanvas()
  }
})

// ─── Init ──────────────────────────────────────────────────────────
renderPalette()
renderLayers()
initCanvas()
updateHistoryCount()

window.addEventListener('resize', () => {
  initCanvas()
})
