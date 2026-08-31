/* ================================================================
   Unit Converter — script.js
   Core conversion engine, UI wiring, history, and keyboard shortcuts.
   No external dependencies beyond the browser APIs and Cradle tokens.
   ================================================================ */

/* ── Unit Data ──────────────────────────────────────────────────── */

const UNITS = {
  length: {
    label: "Length",
    base: "meter",
    units: {
      meter:      { label: "Meters",      abbr: "m",    toBase: 1 },
      kilometer:  { label: "Kilometers",  abbr: "km",   toBase: 1000 },
      centimeter: { label: "Centimeters", abbr: "cm",   toBase: 0.01 },
      millimeter: { label: "Millimeters", abbr: "mm",   toBase: 0.001 },
      mile:       { label: "Miles",       abbr: "mi",   toBase: 1609.344 },
      yard:       { label: "Yards",       abbr: "yd",   toBase: 0.9144 },
      foot:       { label: "Feet",        abbr: "ft",   toBase: 0.3048 },
      inch:       { label: "Inches",      abbr: "in",   toBase: 0.0254 },
      nauticalMile: { label: "Nautical Miles", abbr: "nmi", toBase: 1852 },
    },
  },
  weight: {
    label: "Weight",
    base: "kilogram",
    units: {
      kilogram:   { label: "Kilograms",   abbr: "kg",   toBase: 1 },
      gram:       { label: "Grams",       abbr: "g",    toBase: 0.001 },
      milligram:  { label: "Milligrams",  abbr: "mg",   toBase: 0.000001 },
      tonne:      { label: "Metric Tons", abbr: "t",    toBase: 1000 },
      pound:      { label: "Pounds",      abbr: "lb",   toBase: 0.45359237 },
      ounce:      { label: "Ounces",      abbr: "oz",   toBase: 0.028349523125 },
      stone:      { label: "Stone",       abbr: "st",   toBase: 6.35029318 },
    },
  },
  temperature: {
    label: "Temperature",
    base: null, // Special conversion — not ratio-based
    units: {
      celsius:    { label: "Celsius",    abbr: "°C" },
      fahrenheit: { label: "Fahrenheit", abbr: "°F" },
      kelvin:     { label: "Kelvin",     abbr: "K" },
    },
  },
  volume: {
    label: "Volume",
    base: "liter",
    units: {
      liter:       { label: "Liters",       abbr: "L",    toBase: 1 },
      milliliter:  { label: "Milliliters",  abbr: "mL",   toBase: 0.001 },
      cubicMeter:  { label: "Cubic Meters", abbr: "m³",   toBase: 1000 },
      gallon:      { label: "US Gallons",    abbr: "gal",  toBase: 3.785411784 },
      quart:       { label: "US Quarts",     abbr: "qt",   toBase: 0.946352946 },
      pint:        { label: "US Pints",      abbr: "pt",   toBase: 0.473176473 },
      cup:         { label: "US Cups",       abbr: "cup",  toBase: 0.2365882365 },
      tablespoon:  { label: "Tablespoons",   abbr: "tbsp", toBase: 0.01478676478125 },
      teaspoon:    { label: "Teaspoons",     abbr: "tsp",  toBase: 0.00492892159375 },
      fluidOunce:  { label: "Fluid Ounces",  abbr: "fl oz", toBase: 0.0295735295625 },
    },
  },
  speed: {
    label: "Speed",
    base: "meterPerSecond",
    units: {
      meterPerSecond: { label: "Meters/second",  abbr: "m/s",  toBase: 1 },
      kilometerPerHour: { label: "Kilometers/hour", abbr: "km/h", toBase: 0.277777778 },
      milePerHour:   { label: "Miles/hour",     abbr: "mph",  toBase: 0.44704 },
      knot:          { label: "Knots",           abbr: "kn",   toBase: 0.514444444 },
      footPerSecond: { label: "Feet/second",     abbr: "ft/s", toBase: 0.3048 },
    },
  },
  data: {
    label: "Data",
    base: "byte",
    units: {
      bit:      { label: "Bits",       abbr: "b",   toBase: 0.125 },
      byte:     { label: "Bytes",      abbr: "B",   toBase: 1 },
      kilobyte: { label: "Kilobytes",  abbr: "KB",  toBase: 1024 },
      megabyte: { label: "Megabytes",  abbr: "MB",  toBase: 1048576 },
      gigabyte: { label: "Gigabytes",  abbr: "GB",  toBase: 1073741824 },
      terabyte: { label: "Terabytes",  abbr: "TB",  toBase: 1099511627776 },
      petabyte: { label: "Petabytes",  abbr: "PB",  toBase: 1125899906842624 },
    },
  },
  area: {
    label: "Area",
    base: "squareMeter",
    units: {
      squareMeter:  { label: "Square Meters",  abbr: "m²",  toBase: 1 },
      squareKilometer: { label: "Square Kilometers", abbr: "km²", toBase: 1000000 },
      hectare:      { label: "Hectares",       abbr: "ha",  toBase: 10000 },
      acre:         { label: "Acres",          abbr: "ac",  toBase: 4046.8564224 },
      squareFoot:   { label: "Square Feet",    abbr: "ft²", toBase: 0.09290304 },
      squareInch:   { label: "Square Inches",  abbr: "in²", toBase: 0.00064516 },
      squareMile:   { label: "Square Miles",   abbr: "mi²", toBase: 2589988.110336 },
      squareYard:   { label: "Square Yards",   abbr: "yd²", toBase: 0.83612736 },
    },
  },
  time: {
    label: "Time",
    base: "second",
    units: {
      second:  { label: "Seconds",  abbr: "s",   toBase: 1 },
      minute:  { label: "Minutes",  abbr: "min", toBase: 60 },
      hour:    { label: "Hours",    abbr: "h",   toBase: 3600 },
      day:     { label: "Days",     abbr: "d",   toBase: 86400 },
      week:    { label: "Weeks",    abbr: "wk",  toBase: 604800 },
      month:   { label: "Months (30d)", abbr: "mo", toBase: 2592000 },
      year:    { label: "Years (365d)", abbr: "yr", toBase: 31536000 },
    },
  },
};

/* ── Temperature Special Conversion ─────────────────────────────── */

const tempConvert = {
  "celsius→fahrenheit": v => v * 9 / 5 + 32,
  "celsius→kelvin":     v => v + 273.15,
  "fahrenheit→celsius": v => (v - 32) * 5 / 9,
  "fahrenheit→kelvin":  v => (v - 32) * 5 / 9 + 273.15,
  "kelvin→celsius":     v => v - 273.15,
  "kelvin→fahrenheit":  v => (v - 273.15) * 9 / 5 + 32,
  "celsius→celsius":    v => v,
  "fahrenheit→fahrenheit": v => v,
  "kelvin→kelvin":      v => v,
};

const tempFormula = {
  "celsius→fahrenheit": "°F = °C × 9/5 + 32",
  "celsius→kelvin":     "K = °C + 273.15",
  "fahrenheit→celsius": "°C = (°F − 32) × 5/9",
  "fahrenheit→kelvin":  "K = (°F − 32) × 5/9 + 273.15",
  "kelvin→celsius":     "°C = K − 273.15",
  "kelvin→fahrenheit":  "°F = (K − 273.15) × 9/5 + 32",
};

/* ── State ──────────────────────────────────────────────────────── */

let currentCategory = "length";
let history = loadHistory();
const MAX_HISTORY = 30;
let suppressFromInput = false;

/* ── DOM References ─────────────────────────────────────────────── */

const $fromValue = document.getElementById("fromValue");
const $toValue   = document.getElementById("toValue");
const $fromUnit  = document.getElementById("fromUnit");
const $toUnit    = document.getElementById("toUnit");
const $swapBtn   = document.getElementById("swapBtn");
const $copyBtn   = document.getElementById("copyBtn");
const $resetBtn  = document.getElementById("resetBtn");
const $formulaText = document.getElementById("formulaText");
const $historyList = document.getElementById("historyList");
const $historyCount = document.getElementById("historyCount");
const $tableSubtitle = document.getElementById("tableSubtitle");
const $refTableHead = document.getElementById("refTableHead");
const $refTableBody = document.getElementById("refTableBody");

/* ── Populate Selects ───────────────────────────────────────────── */

function populateSelects(category) {
  const cat = UNITS[category];
  const keys = Object.keys(cat.units);

  $fromUnit.innerHTML = "";
  $toUnit.innerHTML = "";

  keys.forEach((key, i) => {
    const u = cat.units[key];
    const optFrom = new Option(`${u.label} (${u.abbr})`, key);
    const optTo   = new Option(`${u.label} (${u.abbr})`, key);
    $fromUnit.add(optFrom);
    $toUnit.add(optTo);
  });

  // Default: first and second unit
  if (keys.length > 1) {
    $fromUnit.selectedIndex = 0;
    $toUnit.selectedIndex = 1;
  }
}

/* ── Conversion Engine ──────────────────────────────────────────── */

function convert(value, fromKey, toKey, category) {
  const cat = UNITS[category];
  if (category === "temperature") {
    const fn = tempConvert[`${fromKey}→${toKey}`];
    return fn ? fn(value) : NaN;
  }
  const fromBase = cat.units[fromKey].toBase;
  const toBase   = cat.units[toKey].toBase;
  return value * fromBase / toBase;
}

function getFormula(fromKey, toKey, category) {
  if (category === "temperature") {
    return tempFormula[`${fromKey}→${toKey}`] || "—";
  }
  const cat = UNITS[category];
  const fromUnit = cat.units[fromKey];
  const toUnit   = cat.units[toKey];
  const factor   = fromUnit.toBase / toUnit.toBase;
  return `1 ${fromUnit.abbr} = ${formatNumber(factor)} ${toUnit.abbr}`;
}

/* ── Formatting ─────────────────────────────────────────────────── */

function formatNumber(n) {
  if (n === 0) return "0";
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toLocaleString("en-US");
  if (Math.abs(n) >= 1e15 || (Math.abs(n) < 1e-6 && n !== 0)) {
    return n.toExponential(6);
  }
  // Round to avoid floating-point noise
  const rounded = parseFloat(n.toPrecision(10));
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function formatResult(value) {
  if (isNaN(value) || !isFinite(value)) return "";
  if (Number.isInteger(value) && Math.abs(value) < 1e15) {
    return value.toLocaleString("en-US");
  }
  if (Math.abs(value) >= 1e15 || (Math.abs(value) < 1e-6 && value !== 0)) {
    return value.toExponential(6);
  }
  const rounded = parseFloat(value.toPrecision(10));
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

/* ── Perform Conversion ─────────────────────────────────────────── */

function performConversion() {
  const raw = $fromValue.value.trim();
  if (raw === "") {
    $toValue.value = "";
    $formulaText.textContent = "Enter a value to see the conversion.";
    return;
  }

  const value = parseFloat(raw);
  if (isNaN(value)) {
    $toValue.value = "Invalid number";
    return;
  }

  const fromKey = $fromUnit.value;
  const toKey   = $toUnit.value;
  const result  = convert(value, fromKey, toKey, currentCategory);

  suppressFromInput = true;
  $toValue.value = formatResult(result);
  suppressFromInput = false;

  $formulaText.textContent = getFormula(fromKey, toKey, currentCategory);

  // Add to history (debounced — only after a brief pause)
  clearTimeout(performConversion._timer);
  performConversion._timer = setTimeout(() => {
    addToHistory(value, fromKey, result, toKey);
  }, 600);
}

/* ── Reference Table ────────────────────────────────────────────── */

function renderRefTable(category) {
  const cat = UNITS[category];
  $tableSubtitle.textContent = `${cat.label} conversions`;
  const keys = Object.keys(cat.units);

  // Show up to 5 common units
  const displayKeys = keys.slice(0, 5);

  // Header
  $refTableHead.innerHTML = "";
  const headerRow = document.createElement("tr");
  displayKeys.forEach(k => {
    const th = document.createElement("th");
    th.textContent = `${cat.units[k].label} (${cat.units[k].abbr})`;
    headerRow.appendChild(th);
  });
  $refTableHead.appendChild(headerRow);

  // Body: each row is "1 unitX = ? unitY"
  $refTableBody.innerHTML = "";
  displayKeys.forEach((fromKey, rowIdx) => {
    const tr = document.createElement("tr");
    displayKeys.forEach((toKey) => {
      const td = document.createElement("td");
      if (fromKey === toKey) {
        td.textContent = "1";
        td.classList.add("table-diagonal");
      } else {
        const val = convert(1, fromKey, toKey, category);
        td.textContent = formatNumber(val);
      }
      td.title = `${cat.units[fromKey].abbr} → ${cat.units[toKey].abbr}`;
      tr.appendChild(td);
    });
    $refTableBody.appendChild(tr);
  });
}

/* ── History ────────────────────────────────────────────────────── */

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem("uc_history")) || [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem("uc_history", JSON.stringify(history));
  } catch {
    // Storage full or blocked — silently ignore
  }
}

function addToHistory(fromVal, fromKey, toVal, toKey) {
  const cat = UNITS[currentCategory];
  const entry = {
    category: currentCategory,
    fromVal,
    fromUnit: fromKey,
    fromLabel: cat.units[fromKey].abbr,
    toVal,
    toUnit: toKey,
    toLabel: cat.units[toKey].abbr,
    timestamp: Date.now(),
  };

  // Avoid duplicate consecutive entries
  if (history.length > 0) {
    const last = history[0];
    if (
      last.category === entry.category &&
      last.fromUnit === entry.fromUnit &&
      last.toUnit === entry.toUnit &&
      last.fromVal === entry.fromVal
    ) {
      return;
    }
  }

  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  saveHistory();
  renderHistory();
}

function renderHistory() {
  $historyCount.textContent = `${history.length} ${history.length === 1 ? "entry" : "entries"}`;

  if (history.length === 0) {
    $historyList.innerHTML = '<p class="history-empty">No conversions yet. Start converting!</p>';
    return;
  }

  $historyList.innerHTML = "";
  history.forEach((entry, idx) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const main = document.createElement("div");
    main.className = "history-main";
    main.innerHTML = `<strong>${formatNumber(entry.fromVal)}</strong> ${entry.fromLabel} → <strong>${formatNumber(entry.toVal)}</strong> ${entry.toLabel}`;

    const meta = document.createElement("div");
    meta.className = "history-meta";
    const catLabel = UNITS[entry.category] ? UNITS[entry.category].label : entry.category;
    meta.textContent = `${catLabel} · ${timeAgo(entry.timestamp)}`;

    const del = document.createElement("button");
    del.className = "history-del";
    del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    del.title = "Remove";
    del.addEventListener("click", () => {
      history.splice(idx, 1);
      saveHistory();
      renderHistory();
    });

    item.appendChild(main);
    item.appendChild(meta);
    item.appendChild(del);
    $historyList.appendChild(item);
  });
}

function clearHistory() {
  if (history.length === 0) return;
  history = [];
  saveHistory();
  renderHistory();
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const sec  = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

/* ── Category Switch ────────────────────────────────────────────── */

function switchCategory(category) {
  currentCategory = category;

  document.querySelectorAll(".cat-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.category === category);
  });

  populateSelects(category);
  $fromValue.value = "";
  $toValue.value = "";
  $formulaText.textContent = `Select units and enter a value to convert.`;

  renderRefTable(category);
}

/* ── Swap Units ─────────────────────────────────────────────────── */

function swapUnits() {
  const tmpKey  = $fromUnit.value;
  const tmpVal  = $fromValue.value;

  $fromUnit.value = $toUnit.value;
  $toUnit.value   = tmpKey;

  // Move result to input
  if ($toValue.value !== "" && $toValue.value !== "Invalid number") {
    $fromValue.value = $toValue.value.replace(/,/g, "");
  }

  performConversion();
}

/* ── Copy Result ────────────────────────────────────────────────── */

function copyResult() {
  const val = $toValue.value;
  if (!val || val === "Invalid number") return;

  navigator.clipboard.writeText(val).then(() => {
    const orig = $copyBtn.innerHTML;
    $copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    setTimeout(() => { $copyBtn.innerHTML = orig; }, 1200);
  }).catch(() => {
    // Clipboard API not available — try fallback
    const ta = document.createElement("textarea");
    ta.value = val;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  });
}

/* ── Reset ──────────────────────────────────────────────────────── */

function resetConverter() {
  $fromValue.value = "";
  $toValue.value = "";
  $fromValue.focus();
  $formulaText.textContent = `Select units and enter a value to convert.`;
}

/* ── Event Listeners ────────────────────────────────────────────── */

// Category tabs
document.getElementById("categoryTabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".cat-tab");
  if (tab) switchCategory(tab.dataset.category);
});

// Live conversion on input
$fromValue.addEventListener("input", performConversion);

// Unit change triggers re-conversion
$fromUnit.addEventListener("change", performConversion);
$toUnit.addEventListener("change", performConversion);

// Swap
$swapBtn.addEventListener("click", swapUnits);

// Copy
$copyBtn.addEventListener("click", copyResult);

// Reset
$resetBtn.addEventListener("click", resetConverter);

// Clear history
document.getElementById("btn-clear-history").addEventListener("click", () => {
  if (history.length === 0) return;
  if (confirm("Clear all conversion history?")) clearHistory();
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Ignore if user is typing in an input
  const tag = document.activeElement.tagName;
  const isInput = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";

  // S = swap (when not in input)
  if (e.key === "s" && !isInput && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    swapUnits();
    return;
  }

  // Escape = reset
  if (e.key === "Escape") {
    e.preventDefault();
    resetConverter();
    return;
  }

  // Ctrl+Shift+C = copy result
  if (e.key === "C" && e.ctrlKey && e.shiftKey) {
    e.preventDefault();
    copyResult();
  }
});

/* ── Initialise ─────────────────────────────────────────────────── */

(function init() {
  switchCategory("length");
  renderHistory();
})();
