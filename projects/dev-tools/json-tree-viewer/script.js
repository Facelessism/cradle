/**
 * JSON Tree Viewer — main script
 * Interactive JSON viewer with collapsible tree, search, and path copying.
 */

// ─── DOM ───────────────────────────────────────────────────────────
const jsonInput = document.getElementById('jsonInput')
const treeContainer = document.getElementById('treeContainer')
const inputStatus = document.getElementById('inputStatus')
const inputSize = document.getElementById('inputSize')
const searchInput = document.getElementById('searchInput')
const clearSearchBtn = document.getElementById('clearSearch')
const searchCount = document.getElementById('searchCount')
const toast = document.getElementById('toast')

const statType = document.getElementById('statType')
const statKeys = document.getElementById('statKeys')
const statDepth = document.getElementById('statDepth')
const statSize = document.getElementById('statSize')
const statPath = document.getElementById('statPath')

// ─── State ─────────────────────────────────────────────────────────
let parsedData = null
let selectedPath = ''
let searchMatches = []
let currentSearchIndex = -1
let collapsedPaths = new Set()

// ─── Sample Data ───────────────────────────────────────────────────
const SAMPLE_DATA = {
  "app": {
    "name": "Cradle",
    "version": "1.0.0",
    "description": "A curated archive of experiments",
    "repository": "https://github.com/example/cradle",
    "license": "MIT"
  },
  "features": [
    { "name": "JSON Tree Viewer", "category": "dev-tools", "status": "active" },
    { "name": "Typing Speed Racer", "category": "games", "status": "active" },
    { "name": "Pixel Art Generator", "category": "misc", "status": "active" }
  ],
  "config": {
    "theme": "dark",
    "language": "en",
    "notifications": true,
    "maxHistory": 50,
    "analytics": {
      "enabled": false,
      "provider": null,
      "sampleRate": 0.1
    }
  },
  "stats": {
    "totalProjects": 52,
    "categories": {
      "games": 10,
      "productivity": 8,
      "dev-tools": 6,
      "misc": 12,
      "aiml": 3,
      "math": 5,
      "editor": 4,
      "instruments": 2,
      "file-tools": 2
    },
    "lastUpdated": "2026-08-29T18:00:00Z",
    "contributors": null
  }
}

// ─── Parsing ───────────────────────────────────────────────────────
function tryParse() {
  const raw = jsonInput.value.trim()
  if (!raw) {
    parsedData = null
    setStatus('idle', 'Waiting for input')
    treeContainer.innerHTML = '<p class="tree-placeholder">Parse JSON to see the tree view</p>'
    clearStats()
    return
  }

  try {
    parsedData = JSON.parse(raw)
    setStatus('valid', '✓ Valid JSON')
    renderTree()
    updateStats()
  } catch (err) {
    parsedData = null
    setStatus('error', `✗ ${err.message.substring(0, 60)}`)
    treeContainer.innerHTML = `<p class="tree-placeholder" style="color:#ef4444">Parse error: ${escapeHtml(err.message)}</p>`
    clearStats()
  }
}

function setStatus(type, text) {
  inputStatus.className = `status-badge status-${type}`
  inputStatus.textContent = text
}

function updateInputSize() {
  const bytes = new Blob([jsonInput.value]).size
  inputSize.textContent = formatBytes(bytes)
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── Stats ─────────────────────────────────────────────────────────
function updateStats() {
  if (!parsedData) return clearStats()

  const type = Array.isArray(parsedData) ? 'Array' : typeof parsedData === 'object' ? 'Object' : typeof parsedData
  statType.textContent = type
  statKeys.textContent = countKeys(parsedData).toLocaleString()
  statDepth.textContent = getDepth(parsedData)
  statSize.textContent = formatBytes(new Blob([JSON.stringify(parsedData)]).size)
  statPath.textContent = '$'
  selectedPath = '$'
}

function clearStats() {
  statType.textContent = '—'
  statKeys.textContent = '0'
  statDepth.textContent = '0'
  statSize.textContent = '0 B'
  statPath.textContent = '—'
}

function countKeys(obj) {
  if (obj === null || typeof obj !== 'object') return 0
  let count = Array.isArray(obj) ? obj.length : Object.keys(obj).length
  const values = Array.isArray(obj) ? obj : Object.values(obj)
  for (const v of values) count += countKeys(v)
  return count
}

function getDepth(obj, depth = 0) {
  if (obj === null || typeof obj !== 'object') return depth
  let max = depth
  const values = Array.isArray(obj) ? obj : Object.values(obj)
  for (const v of values) {
    max = Math.max(max, getDepth(v, depth + 1))
  }
  return max
}

// ─── Tree Rendering ────────────────────────────────────────────────
function renderTree() {
  treeContainer.innerHTML = ''
  const fragment = document.createDocumentFragment()
  renderNode(fragment, parsedData, '', '$', false, 0)
  treeContainer.appendChild(fragment)
}

function renderNode(parent, data, key, path, isArray, depth) {
  if (data === null || typeof data !== 'object') {
    // Leaf node
    const line = createLeafLine(key, data, path, isArray)
    parent.appendChild(line)
    return
  }

  const entries = Array.isArray(data) ? data.map((v, i) => [i, v]) : Object.entries(data)
  const count = entries.length
  const isCollapsed = collapsedPaths.has(path)
  const openBracket = isArray ? '[' : '{'
  const closeBracket = isArray ? ']' : '}'

  // Node line with toggle
  const container = document.createElement('div')
  container.className = 'tree-node'
  container.style.paddingLeft = `${depth * 1.2}rem`

  const line = document.createElement('div')
  line.className = 'tree-line'
  line.dataset.path = path

  const toggle = document.createElement('span')
  toggle.className = 'tree-toggle' + (isCollapsed ? ' collapsed' : '')
  toggle.textContent = '▼'
  toggle.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleNode(path)
  })

  line.appendChild(toggle)

  if (key !== '' && key !== undefined) {
    const keySpan = document.createElement('span')
    if (isArray) {
      keySpan.className = 'tree-index'
      keySpan.textContent = key
    } else {
      keySpan.className = 'tree-key'
      keySpan.textContent = `"${key}"`
    }
    line.appendChild(keySpan)

    const colon = document.createElement('span')
    colon.className = 'tree-colon'
    colon.textContent = ': '
    line.appendChild(colon)
  }

  const bracketOpen = document.createElement('span')
  bracketOpen.className = 'tree-bracket'
  bracketOpen.textContent = openBracket
  line.appendChild(bracketOpen)

  if (isCollapsed) {
    const ellipsis = document.createElement('span')
    ellipsis.className = 'tree-ellipsis'
    ellipsis.textContent = ` ${count} items `
    ellipsis.addEventListener('click', () => toggleNode(path))
    line.appendChild(ellipsis)

    const bracketClose = document.createElement('span')
    bracketClose.className = 'tree-bracket'
    bracketClose.textContent = closeBracket
    line.appendChild(bracketClose)
  } else {
    const countSpan = document.createElement('span')
    countSpan.className = 'tree-count'
    countSpan.textContent = ` (${count})`
    line.appendChild(countSpan)
  }

  line.addEventListener('click', () => selectPath(path))
  container.appendChild(line)

  // Children
  if (!isCollapsed) {
    for (const [k, v] of entries) {
      const childPath = isArray ? `${path}[${k}]` : `${path}.${k}`
      renderNode(container, v, k, childPath, isArray, depth + 1)
    }

    const closeLine = document.createElement('div')
    closeLine.style.paddingLeft = `${depth * 1.2}rem`
    closeLine.innerHTML = `<span class="tree-toggle leaf">▼</span><span class="tree-bracket">${closeBracket}</span>`
    container.appendChild(closeLine)
  }

  parent.appendChild(container)
}

function createLeafLine(key, value, path, isArray) {
  const line = document.createElement('div')
  line.className = 'tree-line'
  line.dataset.path = path
  line.style.paddingLeft = `0.3rem`

  const leafToggle = document.createElement('span')
  leafToggle.className = 'tree-toggle leaf'
  leafToggle.textContent = '▼'
  line.appendChild(leafToggle)

  if (key !== '' && key !== undefined) {
    const keySpan = document.createElement('span')
    if (isArray) {
      keySpan.className = 'tree-index'
      keySpan.textContent = key
    } else {
      keySpan.className = 'tree-key'
      keySpan.textContent = `"${key}"`
    }
    line.appendChild(keySpan)

    const colon = document.createElement('span')
    colon.className = 'tree-colon'
    colon.textContent = ': '
    line.appendChild(colon)
  }

  const valSpan = document.createElement('span')
  if (value === null) {
    valSpan.className = 'tree-value-null'
    valSpan.textContent = 'null'
  } else if (typeof value === 'string') {
    valSpan.className = 'tree-value-string'
    valSpan.textContent = `"${value}"`
  } else if (typeof value === 'number') {
    valSpan.className = 'tree-value-number'
    valSpan.textContent = String(value)
  } else if (typeof value === 'boolean') {
    valSpan.className = 'tree-value-boolean'
    valSpan.textContent = String(value)
  }
  line.appendChild(valSpan)

  line.addEventListener('click', () => selectPath(path))
  return line
}

// ─── Toggle / Select ──────────────────────────────────────────────
function toggleNode(path) {
  if (collapsedPaths.has(path)) {
    collapsedPaths.delete(path)
  } else {
    collapsedPaths.add(path)
  }
  renderTree()
  highlightSearch()
}

function selectPath(path) {
  selectedPath = path
  statPath.textContent = path

  // Highlight selected
  document.querySelectorAll('.tree-line.selected').forEach(el => el.classList.remove('selected'))
  const line = document.querySelector(`.tree-line[data-path="${CSS.escape(path)}"]`)
  if (line) line.classList.add('selected')
}

// ─── Search ────────────────────────────────────────────────────────
function searchTree(query) {
  if (!query || !parsedData) {
    searchMatches = []
    searchCount.hidden = true
    clearSearchHighlights()
    return
  }

  searchMatches = []
  findMatches(parsedData, '$', query.toLowerCase())

  if (searchMatches.length > 0) {
    currentSearchIndex = 0
    searchCount.textContent = `${searchMatches.length} found`
    searchCount.hidden = false
    highlightSearch()

    // Expand all ancestors of first match
    expandPathTo(searchMatches[0])
    renderTree()
    highlightSearch()
  } else {
    searchCount.textContent = '0 found'
    searchCount.hidden = false
    clearSearchHighlights()
  }
}

function findMatches(data, path, query) {
  if (data === null || typeof data !== 'object') {
    if (String(data).toLowerCase().includes(query)) {
      searchMatches.push(path)
    }
    return
  }

  const entries = Array.isArray(data) ? data.map((v, i) => [i, v]) : Object.entries(data)
  for (const [k, v] of entries) {
    const childPath = isArray(data) ? `${path}[${k}]` : `${path}.${k}`
    // Check key
    if (String(k).toLowerCase().includes(query)) {
      searchMatches.push(childPath)
    }
    findMatches(v, childPath, query)
  }
}

function isArray(obj) {
  return Array.isArray(obj)
}

function expandPathTo(path) {
  // Parse path and collapse everything except ancestors
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
  let current = '$'
  for (let i = 1; i < parts.length; i++) {
    collapsedPaths.delete(current)
    current += '.' + parts[i]
  }
  collapsedPaths.delete(path)
}

function highlightSearch() {
  clearSearchHighlights()
  if (searchMatches.length === 0) return

  for (const matchPath of searchMatches) {
    const line = document.querySelector(`.tree-line[data-path="${CSS.escape(matchPath)}"]`)
    if (line) {
      line.style.background = 'rgba(245, 158, 11, 0.15)'
    }
  }
}

function clearSearchHighlights() {
  document.querySelectorAll('.tree-line').forEach(el => {
    el.style.background = ''
  })
}

// ─── Expand / Collapse All ─────────────────────────────────────────
function expandAll() {
  collapsedPaths.clear()
  renderTree()
  highlightSearch()
}

function collapseAll() {
  if (!parsedData) return
  collapseRecursive(parsedData, '$')
  renderTree()
}

function collapseRecursive(data, path) {
  if (data === null || typeof data !== 'object') return
  collapsedPaths.add(path)
  const entries = Array.isArray(data) ? data.map((v, i) => [i, v]) : Object.entries(data)
  for (const [k, v] of entries) {
    const childPath = isArray(data) ? `${path}[${k}]` : `${path}.${k}`
    collapseRecursive(v, childPath)
  }
}

// ─── Copy ──────────────────────────────────────────────────────────
function copyToClipboard(text, label) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`${label} copied!`)
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    showToast(`${label} copied!`)
  })
}

function showToast(msg) {
  toast.textContent = msg
  toast.hidden = false
  clearTimeout(toast._timer)
  toast._timer = setTimeout(() => { toast.hidden = true }, 2000)
}

// ─── Format / Minify ──────────────────────────────────────────────
function formatJson() {
  try {
    const data = JSON.parse(jsonInput.value)
    jsonInput.value = JSON.stringify(data, null, 2)
    tryParse()
    showToast('Formatted!')
  } catch (e) {
    showToast('Invalid JSON')
  }
}

function minifyJson() {
  try {
    const data = JSON.parse(jsonInput.value)
    jsonInput.value = JSON.stringify(data)
    tryParse()
    showToast('Minified!')
  } catch (e) {
    showToast('Invalid JSON')
  }
}

// ─── Event Listeners ───────────────────────────────────────────────
let parseTimeout = null
jsonInput.addEventListener('input', () => {
  updateInputSize()
  clearTimeout(parseTimeout)
  parseTimeout = setTimeout(tryParse, 300)
})

searchInput.addEventListener('input', () => {
  clearSearchBtn.hidden = searchInput.value === ''
  searchTree(searchInput.value)
})

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = ''
  clearSearchBtn.hidden = true
  searchMatches = []
  searchCount.hidden = true
  clearSearchHighlights()
})

document.getElementById('expandAll').addEventListener('click', expandAll)
document.getElementById('collapseAll').addEventListener('click', collapseAll)
document.getElementById('formatBtn').addEventListener('click', formatJson)
document.getElementById('minifyBtn').addEventListener('click', minifyJson)
document.getElementById('clearBtn').addEventListener('click', () => {
  jsonInput.value = ''
  parsedData = null
  treeContainer.innerHTML = '<p class="tree-placeholder">Parse JSON to see the tree view</p>'
  setStatus('idle', 'Waiting for input')
  clearStats()
  updateInputSize()
})

document.getElementById('copyPath').addEventListener('click', () => {
  if (selectedPath) copyToClipboard(selectedPath, 'Path')
})

document.getElementById('copyJson').addEventListener('click', () => {
  if (parsedData) copyToClipboard(JSON.stringify(parsedData, null, 2), 'JSON')
})

statPath.addEventListener('click', () => {
  if (selectedPath && selectedPath !== '$') copyToClipboard(selectedPath, 'Path')
})

document.getElementById('loadSample').addEventListener('click', () => {
  jsonInput.value = JSON.stringify(SAMPLE_DATA, null, 2)
  updateInputSize()
  tryParse()
  showToast('Sample loaded!')
})

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target === jsonInput) return
  if (e.ctrlKey && e.key === 'f') {
    e.preventDefault()
    searchInput.focus()
  }
  if (e.key === 'Escape') {
    searchInput.value = ''
    searchInput.blur()
    clearSearchBtn.hidden = true
    clearSearchHighlights()
  }
})

// ─── Init ──────────────────────────────────────────────────────────
updateInputSize()
