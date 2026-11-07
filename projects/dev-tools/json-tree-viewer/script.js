/**
 * JSON Tree Viewer — main script
 * Interactive JSON viewer with collapsible tree, search, and path copying.
 */

// ─── DOM ───────────────────────────────────────────────────────────
const jsonInput = document.getElementById("jsonInput");
const treeContainer = document.getElementById("treeContainer");
const inputStatus = document.getElementById("inputStatus");
const inputSize = document.getElementById("inputSize");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearch");
const searchCount = document.getElementById("searchCount");
const toast = document.getElementById("toast");

// JSONPath Query Evaluator & Interactive Node Search Elements
const jsonPathInput = document.getElementById("jsonPathInput");
const clearJsonPathBtn = document.getElementById("clearJsonPath");
const jsonPathBadge = document.getElementById("jsonPathBadge");
const jsonPathNav = document.getElementById("jsonPathNav");
const prevMatchBtn = document.getElementById("prevMatchBtn");
const nextMatchBtn = document.getElementById("nextMatchBtn");
const matchIndexDisplay = document.getElementById("matchIndexDisplay");
const presetChips = document.querySelectorAll(".preset-chip");

// Interactive Hover Tooltip Elements
const treeHoverTooltip = document.getElementById("treeHoverTooltip");
const tooltipCodePath = document.getElementById("tooltipCodePath");
const tooltipCopyCodeBtn = document.getElementById("tooltipCopyCodeBtn");
const tooltipCopyJsonPathBtn = document.getElementById("tooltipCopyJsonPathBtn");
const tooltipCopySubtreeBtn = document.getElementById("tooltipCopySubtreeBtn");

const statType = document.getElementById("statType");
const statKeys = document.getElementById("statKeys");
const statDepth = document.getElementById("statDepth");
const statSize = document.getElementById("statSize");
const statPath = document.getElementById("statPath");

// ─── State ─────────────────────────────────────────────────────────
let parsedData = null;
let selectedPath = "";
let searchMatches = [];
let currentSearchIndex = -1;
let collapsedPaths = new Set();

let jsonPathQuery = "";
let jsonPathMatches = [];
let currentJsonPathIndex = -1;
let hoveredNodePath = "";
let tooltipHideTimer = null;
let jsonPathDebounceTimer = null;

// ─── Sample Data ───────────────────────────────────────────────────
const SAMPLE_DATA = {
  app: {
    name: "Cradle",
    version: "1.0.0",
    description: "A curated archive of experiments",
    repository: "https://github.com/example/cradle",
    license: "MIT",
  },
  features: [
    { name: "JSON Tree Viewer", category: "dev-tools", status: "active" },
    { name: "Typing Speed Racer", category: "games", status: "active" },
    { name: "Pixel Art Generator", category: "misc", status: "active" },
  ],
  config: {
    theme: "dark",
    language: "en",
    notifications: true,
    maxHistory: 50,
    analytics: {
      enabled: false,
      provider: null,
      sampleRate: 0.1,
    },
  },
  stats: {
    totalProjects: 52,
    categories: {
      games: 10,
      productivity: 8,
      "dev-tools": 6,
      misc: 12,
      aiml: 3,
      math: 5,
      editor: 4,
      instruments: 2,
      "file-tools": 2,
    },
    lastUpdated: "2026-08-29T18:00:00Z",
    contributors: null,
  },
};

// ─── Parsing ───────────────────────────────────────────────────────
function tryParse() {
  const raw = jsonInput ? jsonInput.value.trim() : "";
  if (!raw) {
    parsedData = null;
    setStatus("idle", "Waiting for input");
    if (treeContainer)
      treeContainer.innerHTML =
        '<p class="tree-placeholder">Parse JSON to see the tree view</p>';
    clearStats();
    return;
  }

  try {
    parsedData = JSON.parse(raw);
    setStatus("valid", "✓ Valid JSON");
    renderTree();
    updateStats();
    if (jsonPathInput && jsonPathInput.value.trim()) {
      executeJsonPath(jsonPathInput.value);
    }
  } catch (err) {
    parsedData = null;
    setStatus("error", `✗ ${err.message.substring(0, 60)}`);
    if (treeContainer)
      treeContainer.innerHTML = `<p class="tree-placeholder" style="color:#ef4444">Parse error: ${escapeHtml(err.message)}</p>`;
    clearStats();
    if (jsonPathBadge) {
      setJsonPathStatus("idle", "Waiting for valid JSON");
    }
    clearJsonPathHighlights();
    jsonPathMatches = [];
    currentJsonPathIndex = -1;
    if (jsonPathNav) jsonPathNav.hidden = true;
  }
}

function setStatus(type, text) {
  if (inputStatus) {
    inputStatus.className = `status-badge status-${type}`;
    inputStatus.textContent = text;
  }
}

function updateInputSize() {
  if (!jsonInput || !inputSize) return;
  const bytes = new Blob([jsonInput.value]).size;
  inputSize.textContent = formatBytes(bytes);
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Stats ─────────────────────────────────────────────────────────
function updateStats() {
  if (!parsedData) return clearStats();

  const type = Array.isArray(parsedData)
    ? "Array"
    : typeof parsedData === "object"
      ? "Object"
      : typeof parsedData;
  statType.textContent = type;
  statKeys.textContent = countKeys(parsedData).toLocaleString();
  statDepth.textContent = getDepth(parsedData);
  statSize.textContent = formatBytes(
    new Blob([JSON.stringify(parsedData)]).size
  );
  statPath.textContent = "$";
  selectedPath = "$";
}

function clearStats() {
  statType.textContent = "—";
  statKeys.textContent = "0";
  statDepth.textContent = "0";
  statSize.textContent = "0 B";
  statPath.textContent = "—";
}

const MAX_TREE_DEPTH = 100;

function countKeys(obj, depth = 0, maxDepth = MAX_TREE_DEPTH, seen = new Set()) {
  if (depth >= maxDepth) return 0;
  if (obj === null || typeof obj !== "object") return 0;
  if (seen.has(obj)) return 0;
  seen.add(obj);

  let count = Array.isArray(obj) ? obj.length : Object.keys(obj).length;
  const values = Array.isArray(obj) ? obj : Object.values(obj);
  for (const v of values) count += countKeys(v, depth + 1, maxDepth, seen);
  return count;
}

function getDepth(obj, depth = 0, maxDepth = MAX_TREE_DEPTH, seen = new Set()) {
  if (depth >= maxDepth) return depth;
  if (obj === null || typeof obj !== "object") return depth;
  if (seen.has(obj)) return depth;
  seen.add(obj);

  let max = depth;
  const values = Array.isArray(obj) ? obj : Object.values(obj);
  for (const v of values) {
    max = Math.max(max, getDepth(v, depth + 1, maxDepth, seen));
  }
  return max;
}

// ─── Tree Rendering ────────────────────────────────────────────────
function renderTree() {
  treeContainer.innerHTML = "";
  const fragment = document.createDocumentFragment();
  renderNode(fragment, parsedData, "", "$", false, 0);
  treeContainer.appendChild(fragment);
  highlightSearch();
  applyJsonPathHighlights();
}

function attachLineHoverAndQuickActions(line, path) {
  // Quick copy buttons on the line
  const quickActions = document.createElement("span");
  quickActions.className = "tree-line-quick";

  const copyPathBtn = document.createElement("span");
  copyPathBtn.className = "quick-btn";
  copyPathBtn.title = "Copy code path (data...)";
  copyPathBtn.textContent = "📋";
  copyPathBtn.addEventListener("click", e => {
    e.stopPropagation();
    const engine =
      window.JsonPathEngine ||
      (typeof JsonPathEngine !== "undefined" ? JsonPathEngine : null);
    const codePath = engine
      ? engine.formatPathForCode(path, "data")
      : path.replace(/^\$/, "data");
    copyToClipboard(codePath, "Code path");
  });

  const copyJsonBtn = document.createElement("span");
  copyJsonBtn.className = "quick-btn";
  copyJsonBtn.title = "Copy subtree JSON";
  copyJsonBtn.textContent = "📦";
  copyJsonBtn.addEventListener("click", e => {
    e.stopPropagation();
    const engine =
      window.JsonPathEngine ||
      (typeof JsonPathEngine !== "undefined" ? JsonPathEngine : null);
    const subtree = engine ? engine.getValueByPath(parsedData, path) : null;
    const text =
      typeof subtree === "object"
        ? JSON.stringify(subtree, null, 2)
        : String(subtree);
    copyToClipboard(text, "Subtree JSON");
  });

  quickActions.appendChild(copyPathBtn);
  quickActions.appendChild(copyJsonBtn);
  line.appendChild(quickActions);

  // Hover interactions for rich tooltip
  line.addEventListener("mouseenter", () => {
    showNodeTooltip(path, line);
  });
  line.addEventListener("mouseleave", () => {
    scheduleHideTooltip();
  });
}

function renderNode(
  parent,
  data,
  key,
  path,
  isArray,
  depth,
  maxDepth = MAX_TREE_DEPTH,
  seen = new Set()
) {
  if (depth >= maxDepth) {
    const line = createLeafLine(key, "[Depth limit reached]", path, isArray);
    parent.appendChild(line);
    return;
  }

  if (data === null || typeof data !== "object") {
    // Leaf node
    const line = createLeafLine(key, data, path, isArray);
    parent.appendChild(line);
    return;
  }

  if (seen.has(data)) {
    const line = createLeafLine(key, "[Circular reference]", path, isArray);
    parent.appendChild(line);
    return;
  }
  seen.add(data);

  const entries = Array.isArray(data)
    ? data.map((v, i) => [i, v])
    : Object.entries(data);
  const count = entries.length;
  const isCollapsed = collapsedPaths.has(path);
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  // Node line with toggle
  const container = document.createElement("div");
  container.className = "tree-node";
  container.style.paddingLeft = `${depth * 1.2}rem`;

  const line = document.createElement("div");
  line.className = "tree-line";
  line.dataset.path = path;

  const toggle = document.createElement("span");
  toggle.className = "tree-toggle" + (isCollapsed ? " collapsed" : "");
  toggle.textContent = "▼";
  toggle.addEventListener("click", e => {
    e.stopPropagation();
    toggleNode(path);
  });

  line.appendChild(toggle);

  if (key !== "" && key !== undefined) {
    const keySpan = document.createElement("span");
    if (isArray) {
      keySpan.className = "tree-index";
      keySpan.textContent = key;
    } else {
      keySpan.className = "tree-key";
      keySpan.textContent = `"${key}"`;
    }
    line.appendChild(keySpan);

    const colon = document.createElement("span");
    colon.className = "tree-colon";
    colon.textContent = ": ";
    line.appendChild(colon);
  }

  const bracketOpen = document.createElement("span");
  bracketOpen.className = "tree-bracket";
  bracketOpen.textContent = openBracket;
  line.appendChild(bracketOpen);

  if (isCollapsed) {
    const ellipsis = document.createElement("span");
    ellipsis.className = "tree-ellipsis";
    ellipsis.textContent = ` ${count} items `;
    ellipsis.addEventListener("click", () => toggleNode(path));
    line.appendChild(ellipsis);

    const bracketClose = document.createElement("span");
    bracketClose.className = "tree-bracket";
    bracketClose.textContent = closeBracket;
    line.appendChild(bracketClose);
  } else {
    const countSpan = document.createElement("span");
    countSpan.className = "tree-count";
    countSpan.textContent = ` (${count})`;
    line.appendChild(countSpan);
  }

  attachLineHoverAndQuickActions(line, path);
  line.addEventListener("click", () => selectPath(path));
  container.appendChild(line);

  // Children
  if (!isCollapsed) {
    for (const [k, v] of entries) {
      const childPath = isArray ? `${path}[${k}]` : `${path}.${k}`;
      renderNode(container, v, k, childPath, isArray, depth + 1, maxDepth, seen);
    }

    const closeLine = document.createElement("div");
    closeLine.style.paddingLeft = `${depth * 1.2}rem`;
    closeLine.innerHTML = `<span class="tree-toggle leaf">▼</span><span class="tree-bracket">${closeBracket}</span>`;
    container.appendChild(closeLine);
  }

  parent.appendChild(container);
}

function createLeafLine(key, value, path, isArray) {
  const line = document.createElement("div");
  line.className = "tree-line";
  line.dataset.path = path;
  line.style.paddingLeft = `0.3rem`;

  const leafToggle = document.createElement("span");
  leafToggle.className = "tree-toggle leaf";
  leafToggle.textContent = "▼";
  line.appendChild(leafToggle);

  if (key !== "" && key !== undefined) {
    const keySpan = document.createElement("span");
    if (isArray) {
      keySpan.className = "tree-index";
      keySpan.textContent = key;
    } else {
      keySpan.className = "tree-key";
      keySpan.textContent = `"${key}"`;
    }
    line.appendChild(keySpan);

    const colon = document.createElement("span");
    colon.className = "tree-colon";
    colon.textContent = ": ";
    line.appendChild(colon);
  }

  const valSpan = document.createElement("span");
  if (value === null) {
    valSpan.className = "tree-value-null";
    valSpan.textContent = "null";
  } else if (typeof value === "string") {
    valSpan.className = "tree-value-string";
    valSpan.textContent = `"${value}"`;
  } else if (typeof value === "number") {
    valSpan.className = "tree-value-number";
    valSpan.textContent = String(value);
  } else if (typeof value === "boolean") {
    valSpan.className = "tree-value-boolean";
    valSpan.textContent = String(value);
  }
  line.appendChild(valSpan);

  attachLineHoverAndQuickActions(line, path);
  line.addEventListener("click", () => selectPath(path));
  return line;
}

// ─── Toggle / Select ──────────────────────────────────────────────
function toggleNode(path) {
  if (collapsedPaths.has(path)) {
    collapsedPaths.delete(path);
  } else {
    collapsedPaths.add(path);
  }
  renderTree();
  highlightSearch();
}

function selectPath(path) {
  selectedPath = path;
  statPath.textContent = path;

  // Highlight selected
  document
    .querySelectorAll(".tree-line.selected")
    .forEach(el => el.classList.remove("selected"));
  const line = document.querySelector(
    `.tree-line[data-path="${CSS.escape(path)}"]`
  );
  if (line) line.classList.add("selected");
}

// ─── Search ────────────────────────────────────────────────────────
function searchTree(query) {
  if (!query || !parsedData) {
    searchMatches = [];
    searchCount.hidden = true;
    clearSearchHighlights();
    return;
  }

  searchMatches = [];
  findMatches(parsedData, "$", query.toLowerCase());

  if (searchMatches.length > 0) {
    currentSearchIndex = 0;
    searchCount.textContent = `${searchMatches.length} found`;
    searchCount.hidden = false;
    highlightSearch();

    // Expand all ancestors of first match
    expandPathTo(searchMatches[0]);
    renderTree();
    highlightSearch();
  } else {
    searchCount.textContent = "0 found";
    searchCount.hidden = false;
    clearSearchHighlights();
  }
}

function findMatches(
  data,
  path,
  query,
  depth = 0,
  maxDepth = MAX_TREE_DEPTH,
  seen = new Set()
) {
  if (depth >= maxDepth) return;
  if (data === null || typeof data !== "object") {
    if (String(data).toLowerCase().includes(query)) {
      searchMatches.push(path);
    }
    return;
  }

  if (seen.has(data)) return;
  seen.add(data);

  const entries = Array.isArray(data)
    ? data.map((v, i) => [i, v])
    : Object.entries(data);
  for (const [k, v] of entries) {
    const childPath = isArray(data) ? `${path}[${k}]` : `${path}.${k}`;
    // Check key
    if (String(k).toLowerCase().includes(query)) {
      searchMatches.push(childPath);
    }
    findMatches(v, childPath, query, depth + 1, maxDepth, seen);
  }
}

function isArray(obj) {
  return Array.isArray(obj);
}

function expandPathTo(path) {
  const engine =
    window.JsonPathEngine ||
    (typeof JsonPathEngine !== "undefined" ? JsonPathEngine : null);
  if (engine && typeof engine.getAncestorPaths === "function") {
    const ancestors = engine.getAncestorPaths(path);
    for (const anc of ancestors) {
      collapsedPaths.delete(anc);
    }
  } else {
    // Fallback ancestor resolution
    const parts = path
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .filter(Boolean);
    let current = "$";
    for (let i = 1; i < parts.length; i++) {
      collapsedPaths.delete(current);
      current += "." + parts[i];
    }
  }
  collapsedPaths.delete(path);
}

function highlightSearch() {
  clearSearchHighlights();
  if (searchMatches.length === 0) return;

  for (const matchPath of searchMatches) {
    const line = document.querySelector(
      `.tree-line[data-path="${CSS.escape(matchPath)}"]`
    );
    if (line) {
      line.style.background = "rgba(245, 158, 11, 0.15)";
    }
  }
}

function clearSearchHighlights() {
  document.querySelectorAll(".tree-line").forEach(el => {
    el.style.background = "";
  });
}

// ─── JSONPath Query Evaluator ──────────────────────────────────────
function executeJsonPath(query) {
  if (!jsonPathInput) return;
  const raw = query !== undefined ? query : jsonPathInput.value;
  jsonPathQuery = raw.trim();

  if (clearJsonPathBtn) {
    clearJsonPathBtn.hidden = jsonPathQuery === "";
  }

  if (!parsedData) {
    setJsonPathStatus("idle", "Waiting for valid JSON");
    clearJsonPathHighlights();
    jsonPathMatches = [];
    currentJsonPathIndex = -1;
    if (jsonPathNav) jsonPathNav.hidden = true;
    return;
  }

  if (!jsonPathQuery) {
    setJsonPathStatus("idle", "Ready");
    jsonPathInput.classList.remove("input-error");
    clearJsonPathHighlights();
    jsonPathMatches = [];
    currentJsonPathIndex = -1;
    if (jsonPathNav) jsonPathNav.hidden = true;
    return;
  }

  const engine =
    window.JsonPathEngine ||
    (typeof JsonPathEngine !== "undefined" ? JsonPathEngine : null);
  if (!engine) {
    setJsonPathStatus("error", "JSONPath engine not loaded");
    return;
  }

  const result = engine.evaluateJsonPath(parsedData, jsonPathQuery);

  if (!result.isValid) {
    jsonPathInput.classList.add("input-error");
    setJsonPathStatus("error", `✗ ${result.error}`);
    clearJsonPathHighlights();
    jsonPathMatches = [];
    currentJsonPathIndex = -1;
    if (jsonPathNav) jsonPathNav.hidden = true;
    return;
  }

  jsonPathInput.classList.remove("input-error");
  jsonPathMatches = result.matches || [];

  if (jsonPathMatches.length === 0) {
    setJsonPathStatus("warning", "0 matches");
    clearJsonPathHighlights();
    currentJsonPathIndex = -1;
    if (jsonPathNav) jsonPathNav.hidden = true;
    return;
  }

  // Valid matches found
  const count = jsonPathMatches.length;
  setJsonPathStatus(
    "success",
    `✓ ${count} ${count === 1 ? "match" : "matches"}`
  );
  currentJsonPathIndex = 0;

  if (jsonPathNav) {
    jsonPathNav.hidden = false;
    updateJsonPathNavDisplay();
  }

  // Expand ancestors of ALL matches so they are rendered in the DOM
  for (const match of jsonPathMatches) {
    const ancestors = engine.getAncestorPaths(match.path);
    for (const anc of ancestors) {
      collapsedPaths.delete(anc);
    }
  }

  renderTree();
  applyJsonPathHighlights();
  scrollToJsonPathMatch(currentJsonPathIndex);
}

function setJsonPathStatus(type, text) {
  if (jsonPathBadge) {
    jsonPathBadge.className = `jsonpath-badge badge-${type}`;
    jsonPathBadge.textContent = text;
    jsonPathBadge.title = text;
  }
}

function applyJsonPathHighlights() {
  clearJsonPathHighlights();
  if (jsonPathMatches.length === 0) return;

  for (let i = 0; i < jsonPathMatches.length; i++) {
    const match = jsonPathMatches[i];
    const line = document.querySelector(
      `.tree-line[data-path="${CSS.escape(match.path)}"]`
    );
    if (line) {
      line.classList.add("jsonpath-match");
      if (i === currentJsonPathIndex) {
        line.classList.add("jsonpath-active-match");
      }
    }
  }
}

function clearJsonPathHighlights() {
  document
    .querySelectorAll(
      ".tree-line.jsonpath-match, .tree-line.jsonpath-active-match"
    )
    .forEach(el => {
      el.classList.remove("jsonpath-match", "jsonpath-active-match");
    });
}

function updateJsonPathNavDisplay() {
  if (matchIndexDisplay && jsonPathMatches.length > 0) {
    matchIndexDisplay.textContent = `${currentJsonPathIndex + 1}/${jsonPathMatches.length}`;
  }
}

function nextJsonPathMatch() {
  if (jsonPathMatches.length === 0) return;
  currentJsonPathIndex = (currentJsonPathIndex + 1) % jsonPathMatches.length;
  updateJsonPathNavDisplay();
  applyJsonPathHighlights();
  scrollToJsonPathMatch(currentJsonPathIndex);
}

function prevJsonPathMatch() {
  if (jsonPathMatches.length === 0) return;
  currentJsonPathIndex =
    (currentJsonPathIndex - 1 + jsonPathMatches.length) %
    jsonPathMatches.length;
  updateJsonPathNavDisplay();
  applyJsonPathHighlights();
  scrollToJsonPathMatch(currentJsonPathIndex);
}

function scrollToJsonPathMatch(index) {
  if (index < 0 || index >= jsonPathMatches.length) return;
  const match = jsonPathMatches[index];
  const line = document.querySelector(
    `.tree-line[data-path="${CSS.escape(match.path)}"]`
  );
  if (line) {
    line.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

// ─── Interactive Hover Tooltip ─────────────────────────────────────
function showNodeTooltip(path, targetElement) {
  if (!treeHoverTooltip || !path) return;
  clearTimeout(tooltipHideTimer);
  hoveredNodePath = path;

  const engine =
    window.JsonPathEngine ||
    (typeof JsonPathEngine !== "undefined" ? JsonPathEngine : null);
  const codePath = engine
    ? engine.formatPathForCode(path, "data")
    : path.replace(/^\$/, "data");

  if (tooltipCodePath) {
    tooltipCodePath.textContent = codePath;
  }

  const rect = targetElement.getBoundingClientRect();
  const tooltipWidth = 340;
  const tooltipHeight = 70;

  let top = rect.top - tooltipHeight - 6;
  let left = rect.left + 40;

  if (top < 10) {
    top = rect.bottom + 6;
  }

  if (left + tooltipWidth > window.innerWidth - 10) {
    left = Math.max(10, window.innerWidth - tooltipWidth - 10);
  }

  treeHoverTooltip.style.top = `${top}px`;
  treeHoverTooltip.style.left = `${left}px`;
  treeHoverTooltip.hidden = false;
  treeHoverTooltip.setAttribute("aria-hidden", "false");
}

function scheduleHideTooltip() {
  clearTimeout(tooltipHideTimer);
  tooltipHideTimer = setTimeout(() => {
    if (treeHoverTooltip) {
      treeHoverTooltip.hidden = true;
      treeHoverTooltip.setAttribute("aria-hidden", "true");
    }
  }, 200);
}

// ─── Expand / Collapse All ─────────────────────────────────────────
function expandAll() {
  collapsedPaths.clear();
  renderTree();
  highlightSearch();
}

function collapseAll() {
  if (!parsedData) return;
  collapseRecursive(parsedData, "$");
  renderTree();
}

function collapseRecursive(
  data,
  path,
  depth = 0,
  maxDepth = MAX_TREE_DEPTH,
  seen = new Set()
) {
  if (depth >= maxDepth) return;
  if (data === null || typeof data !== "object") return;
  if (seen.has(data)) return;
  seen.add(data);

  collapsedPaths.add(path);
  const entries = Array.isArray(data)
    ? data.map((v, i) => [i, v])
    : Object.entries(data);
  for (const [k, v] of entries) {
    const childPath = isArray(data) ? `${path}[${k}]` : `${path}.${k}`;
    collapseRecursive(v, childPath, depth + 1, maxDepth, seen);
  }
}

// ─── Copy ──────────────────────────────────────────────────────────
function copyToClipboard(text, label) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showToast(`${label} copied!`);
    })
    .catch(() => {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast(`${label} copied!`);
    });
}

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 2000);
}

// ─── Format / Minify ──────────────────────────────────────────────
function formatJson() {
  if (!jsonInput) return;
  try {
    const data = JSON.parse(jsonInput.value);
    jsonInput.value = JSON.stringify(data, null, 2);
    tryParse();
    showToast("Formatted!");
  } catch (e) {
    showToast("Invalid JSON");
  }
}

function minifyJson() {
  if (!jsonInput) return;
  try {
    const data = JSON.parse(jsonInput.value);
    jsonInput.value = JSON.stringify(data);
    tryParse();
    showToast("Minified!");
  } catch (e) {
    showToast("Invalid JSON");
  }
}

// ─── Event Listeners ───────────────────────────────────────────────
let parseTimeout = null;
jsonInput?.addEventListener("input", () => {
  updateInputSize();
  clearTimeout(parseTimeout);
  parseTimeout = setTimeout(tryParse, 300);
});

searchInput?.addEventListener("input", () => {
  if (!searchInput) return;
  if (clearSearchBtn) clearSearchBtn.hidden = searchInput.value === "";
  searchTree(searchInput.value);
});

clearSearchBtn?.addEventListener("click", () => {
  if (searchInput) searchInput.value = "";
  clearSearchBtn.hidden = true;
  searchMatches = [];
  if (searchCount) searchCount.hidden = true;
  clearSearchHighlights();
});

document.getElementById("expandAll")?.addEventListener("click", expandAll);
document.getElementById("collapseAll")?.addEventListener("click", collapseAll);
document.getElementById("formatBtn")?.addEventListener("click", formatJson);
document.getElementById("minifyBtn")?.addEventListener("click", minifyJson);
document.getElementById("clearBtn")?.addEventListener("click", () => {
  if (jsonInput) jsonInput.value = "";
  parsedData = null;
  if (treeContainer)
    treeContainer.innerHTML =
      '<p class="tree-placeholder">Parse JSON to see the tree view</p>';
  setStatus("idle", "Waiting for input");
  clearStats();
  updateInputSize();
});

document.getElementById("copyPath")?.addEventListener("click", () => {
  if (selectedPath) copyToClipboard(selectedPath, "Path");
});

document.getElementById("copyJson")?.addEventListener("click", () => {
  if (parsedData) copyToClipboard(JSON.stringify(parsedData, null, 2), "JSON");
});

statPath?.addEventListener("click", () => {
  if (selectedPath && selectedPath !== "$")
    copyToClipboard(selectedPath, "Path");
});

document.getElementById("loadSample")?.addEventListener("click", () => {
  if (jsonInput) jsonInput.value = JSON.stringify(SAMPLE_DATA, null, 2);
  updateInputSize();
  tryParse();
  showToast("Sample loaded!");
});

// Keyboard shortcuts
document.addEventListener("keydown", e => {
  if (e.target === jsonInput) return;

  // JSONPath navigation with Enter / Shift+Enter when focused on jsonPathInput
  if (e.target === jsonPathInput) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        prevJsonPathMatch();
      } else {
        nextJsonPathMatch();
      }
      return;
    }
    if (e.key === "Escape") {
      jsonPathInput.value = "";
      jsonPathInput.blur();
      if (clearJsonPathBtn) clearJsonPathBtn.hidden = true;
      executeJsonPath("");
      return;
    }
  }

  if (e.ctrlKey && e.key === "f") {
    e.preventDefault();
    searchInput?.focus();
  }
  if (
    (e.ctrlKey && e.key === "j") ||
    (e.ctrlKey && e.shiftKey && (e.key === "F" || e.key === "f"))
  ) {
    e.preventDefault();
    jsonPathInput?.focus();
    jsonPathInput?.select();
  }
  if (e.key === "Escape") {
    if (searchInput) {
      searchInput.value = "";
      searchInput.blur();
    }
    if (clearSearchBtn) clearSearchBtn.hidden = true;
    clearSearchHighlights();
    scheduleHideTooltip();
  }
});

// JSONPath input listener with debounce
jsonPathInput?.addEventListener("input", () => {
  if (clearJsonPathBtn) clearJsonPathBtn.hidden = jsonPathInput.value === "";
  clearTimeout(jsonPathDebounceTimer);
  jsonPathDebounceTimer = setTimeout(() => {
    executeJsonPath(jsonPathInput.value);
  }, 150);
});

clearJsonPathBtn?.addEventListener("click", () => {
  if (jsonPathInput) {
    jsonPathInput.value = "";
    jsonPathInput.classList.remove("input-error");
  }
  clearJsonPathBtn.hidden = true;
  executeJsonPath("");
});

prevMatchBtn?.addEventListener("click", prevJsonPathMatch);
nextMatchBtn?.addEventListener("click", nextJsonPathMatch);

presetChips.forEach(chip => {
  chip.addEventListener("click", () => {
    const query = chip.dataset.query;
    if (jsonPathInput && query) {
      jsonPathInput.value = query;
      if (clearJsonPathBtn) clearJsonPathBtn.hidden = false;
      executeJsonPath(query);
    }
  });
});

// Hover tooltip action buttons
tooltipCopyCodeBtn?.addEventListener("click", () => {
  if (!hoveredNodePath) return;
  const engine =
    window.JsonPathEngine ||
    (typeof JsonPathEngine !== "undefined" ? JsonPathEngine : null);
  const codePath = engine
    ? engine.formatPathForCode(hoveredNodePath, "data")
    : hoveredNodePath.replace(/^\$/, "data");
  copyToClipboard(codePath, "Code path");
  scheduleHideTooltip();
});

tooltipCopyJsonPathBtn?.addEventListener("click", () => {
  if (!hoveredNodePath) return;
  copyToClipboard(hoveredNodePath, "JSONPath");
  scheduleHideTooltip();
});

tooltipCopySubtreeBtn?.addEventListener("click", () => {
  if (!hoveredNodePath || !parsedData) return;
  const engine =
    window.JsonPathEngine ||
    (typeof JsonPathEngine !== "undefined" ? JsonPathEngine : null);
  const subtree = engine
    ? engine.getValueByPath(parsedData, hoveredNodePath)
    : null;
  const text =
    typeof subtree === "object"
      ? JSON.stringify(subtree, null, 2)
      : String(subtree);
  copyToClipboard(text, "Subtree JSON");
  scheduleHideTooltip();
});

treeHoverTooltip?.addEventListener("mouseenter", () => {
  clearTimeout(tooltipHideTimer);
});

treeHoverTooltip?.addEventListener("mouseleave", () => {
  scheduleHideTooltip();
});

// ─── Init ──────────────────────────────────────────────────────────
updateInputSize();
