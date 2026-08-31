/* ================================================================
   Password Generator — script.js
   Cryptographically secure generation, strength analysis, entropy
   calculation, batch mode, and history. Zero dependencies.
   ================================================================ */

/* ── Character Sets ─────────────────────────────────────────────── */

const CHARS = {
  upper:    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower:    "abcdefghijklmnopqrstuvwxyz",
  digits:   "0123456789",
  symbols:  "!@#$%^&*_+-=|;:',.<>?/~`",
  brackets: "{}[]()<>/\\",
};

const AMBIGUOUS_CHARS = "Il1O0o";

/* ── State ──────────────────────────────────────────────────────── */

const HISTORY_KEY = "pwgen_history_v1";
let history = loadHistory();
let lastPassword = "";

/* ── DOM Refs ───────────────────────────────────────────────────── */

const $passwordOutput = document.getElementById("passwordOutput");
const $strengthBar    = document.getElementById("strengthBar");
const $strengthLabel  = document.getElementById("strengthLabel");
const $entropyLabel   = document.getElementById("entropyLabel");
const $lengthSlider   = document.getElementById("lengthSlider");
const $lengthValue    = document.getElementById("lengthValue");
const $batchSlider    = document.getElementById("batchSlider");
const $batchValue     = document.getElementById("batchValue");
const $batchSection   = document.getElementById("batchSection");
const $batchList      = document.getElementById("batchList");
const $historyList    = document.getElementById("historyList");

/* ── Secure Random Helpers ──────────────────────────────────────── */

function secureRandom(max) {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

function secureShuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandom(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/* ── Password Generation ────────────────────────────────────────── */

function getCharPool() {
  let pool = "";
  if (document.getElementById("chkUpper").checked)   pool += CHARS.upper;
  if (document.getElementById("chkLower").checked)   pool += CHARS.lower;
  if (document.getElementById("chkDigits").checked)  pool += CHARS.digits;
  if (document.getElementById("chkSymbols").checked)  pool += CHARS.symbols;
  if (document.getElementById("chkBrackets").checked) pool += CHARS.brackets;
  if (!document.getElementById("chkAmbiguous").checked) {
    pool = pool.split("").filter(c => !AMBIGUOUS_CHARS.includes(c)).join("");
  }
  return pool;
}

function hasSequential(password, minLen) {
  const seqs = [
    "abcdefghijklmnopqrstuvwxyz",
    "0123456789",
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm",
  ];
  const lower = password.toLowerCase();
  for (const seq of seqs) {
    for (let i = 0; i <= seq.length - minLen; i++) {
      const fragment = seq.substring(i, i + minLen);
      if (lower.includes(fragment)) return true;
      // Check reverse
      const rev = fragment.split("").reverse().join("");
      if (lower.includes(rev)) return true;
    }
  }
  return false;
}

function hasRepeats(password, maxRepeat) {
  for (let i = 0; i <= password.length - maxRepeat; i++) {
    const ch = password[i];
    let count = 1;
    for (let j = i + 1; j < i + maxRepeat && j < password.length; j++) {
      if (password[j] === ch) count++;
    }
    if (count >= maxRepeat) return true;
  }
  return false;
}

function generatePassword(length, maxAttempts) {
  const pool = getCharPool();
  if (pool.length === 0) return "";

  const noRepeats = document.getElementById("chkNoRepeats").checked;
  const noSequential = document.getElementById("chkNoSequential").checked;
  const memorable = document.getElementById("chkMemorable").checked;
  const attempts = maxAttempts || 500;

  for (let attempt = 0; attempt < attempts; attempt++) {
    let password;

    if (memorable) {
      password = generateMemorable(length, pool);
    } else {
      const chars = [];
      for (let i = 0; i < length; i++) {
        chars.push(pool[secureRandom(pool.length)]);
      }
      password = chars.join("");
    }

    // Validate constraints
    if (noRepeats && hasRepeats(password, 3)) continue;
    if (noSequential && hasSequential(password, 4)) continue;

    // Ensure at least one char from each enabled set
    if (!ensureDiversity(password, length)) continue;

    return password;
  }

  // Fallback: return whatever we got without full validation
  const chars = [];
  for (let i = 0; i < length; i++) {
    chars.push(pool[secureRandom(pool.length)]);
  }
  return chars.join("");
}

function generateMemorable(length, pool) {
  // Use word-like pattern: consonant-vowel alternating for readability
  const consonants = pool.split("").filter(c => /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/.test(c));
  const vowels = pool.split("").filter(c => /[aeiouAEIOU]/.test(c));
  const digits = pool.split("").filter(c => /\d/.test(c));
  const specials = pool.split("").filter(c => /[^a-zA-Z0-9]/.test(c));

  const parts = [];
  for (let i = 0; i < length; i++) {
    if (consonants.length > 0 && vowels.length > 0) {
      parts.push(i % 2 === 0 ? consonants[secureRandom(consonants.length)] : vowels[secureRandom(vowels.length)]);
    } else if (pool.length > 0) {
      parts.push(pool[secureRandom(pool.length)]);
    }
  }

  // Insert some digits and specials if available
  if (digits.length > 0 && length >= 6) {
    const pos = secureRandom(Math.max(1, length - 2)) + 1;
    parts[pos] = digits[secureRandom(digits.length)];
  }
  if (specials.length > 0 && length >= 8) {
    const pos = secureRandom(Math.max(1, length - 2)) + 1;
    if (parts[pos] !== undefined) {
      parts[pos] = specials[secureRandom(specials.length)];
    }
  }

  return parts.join("");
}

function ensureDiversity(password, length) {
  const sets = [];
  if (document.getElementById("chkUpper").checked)   sets.push(/[A-Z]/);
  if (document.getElementById("chkLower").checked)   sets.push(/[a-z]/);
  if (document.getElementById("chkDigits").checked)  sets.push(/\d/);
  if (document.getElementById("chkSymbols").checked)  sets.push(/[^a-zA-Z0-9]/);
  if (document.getElementById("chkBrackets").checked) sets.push(/[\[\]{}<>()\/\\]/);

  return sets.every(regex => regex.test(password));
}

/* ── Strength Analysis ──────────────────────────────────────────── */

function calculateEntropy(password, poolSize) {
  if (password.length === 0 || poolSize <= 1) return 0;
  return Math.floor(password.length * Math.log2(poolSize));
}

function analyzeStrength(password) {
  const poolSize = getCharPool().length;
  const entropy = calculateEntropy(password, poolSize);

  let score = 0;
  let label = "";
  let level = "";

  // Entropy-based scoring
  if (entropy >= 128) { score = 100; label = "Very Strong"; level = "very-strong"; }
  else if (entropy >= 80) { score = 80; label = "Strong"; level = "strong"; }
  else if (entropy >= 60) { score = 65; label = "Good"; level = "good"; }
  else if (entropy >= 40) { score = 45; label = "Fair"; level = "fair"; }
  else if (entropy >= 25) { score = 25; label = "Weak"; level = "weak"; }
  else { score = 10; label = "Very Weak"; level = "very-weak"; }

  // Penalties
  if (password.length < 8) score = Math.max(score - 15, 0);
  if (hasSequential(password, 5)) score = Math.max(score - 10, 0);
  if (hasRepeats(password, 4)) score = Math.max(score - 10, 0);

  // Bonuses
  const uniqueRatio = new Set(password).size / password.length;
  if (uniqueRatio > 0.85) score = Math.min(score + 5, 100);

  // Recalculate label after penalties
  if (score >= 90) { label = "Very Strong"; level = "very-strong"; }
  else if (score >= 70) { label = "Strong"; level = "strong"; }
  else if (score >= 50) { label = "Good"; level = "good"; }
  else if (score >= 30) { label = "Fair"; level = "fair"; }
  else if (score >= 15) { label = "Weak"; level = "weak"; }
  else { label = "Very Weak"; level = "very-weak"; }

  return { score, label, level, entropy };
}

function updateStrengthDisplay(password) {
  const strength = analyzeStrength(password);
  $strengthBar.style.width = `${strength.score}%`;
  $strengthBar.className = `strength-bar ${strength.level}`;
  $strengthLabel.textContent = strength.label;
  $strengthLabel.className = `strength-label ${strength.level}`;
  $entropyLabel.textContent = `${strength.entropy} bits of entropy`;
}

/* ── Time-to-Crack Estimate ─────────────────────────────────────── */

function estimateCrackTime(entropy) {
  // Assume 10 billion guesses/second (modern GPU cluster)
  const guessesPerSecond = 1e10;
  const totalGuesses = Math.pow(2, entropy);
  const seconds = totalGuesses / guessesPerSecond / 2; // average case

  if (seconds < 1) return "instantly";
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 86400 * 365) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 86400 * 365 * 1000) return `${Math.round(seconds / (86400 * 365))} years`;
  if (seconds < 86400 * 365 * 1e6) return `${Math.round(seconds / (86400 * 365 * 1000))}K years`;
  if (seconds < 86400 * 365 * 1e9) return `${Math.round(seconds / (86400 * 365 * 1e6))}M years`;
  return "centuries+";
}

/* ── History ────────────────────────────────────────────────────── */

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}

function saveHistory(entry) {
  history.unshift(entry);
  if (history.length > 15) history.length = 15;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* */ }
}

function renderHistory() {
  if (history.length === 0) {
    $historyList.innerHTML = '<p class="empty-state">No passwords generated yet.</p>';
    return;
  }
  $historyList.innerHTML = "";
  history.forEach((h, idx) => {
    const item = document.createElement("div");
    item.className = "history-item";
    const timeStr = new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const masked = h.password.substring(0, 6) + "•••";
    item.innerHTML = `
      <div class="history-main">
        <span class="history-pw" title="${h.password}">${escapeHtml(masked)}</span>
        <span class="history-meta-inline">${h.length} chars · ${h.strength}</span>
      </div>
      <span class="history-meta">${timeStr}</span>
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
  history = [];
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* */ }
  renderHistory();
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

/* ── Copy to Clipboard ──────────────────────────────────────────── */

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showCopied();
  }).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showCopied();
  });
}

function showCopied() {
  const btn = document.getElementById("btnCopy");
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-check"></i>';
  setTimeout(() => { btn.innerHTML = orig; }, 1200);
}

/* ── Main Actions ───────────────────────────────────────────────── */

function generate() {
  const length = parseInt($lengthSlider.value, 10);
  const batchCount = parseInt($batchSlider.value, 10);
  const pool = getCharPool();

  if (pool.length === 0) {
    $passwordOutput.textContent = "Select at least one character set";
    $passwordOutput.style.color = "var(--danger)";
    return;
  }

  $passwordOutput.style.color = "";

  if (batchCount === 1) {
    const pw = generatePassword(length);
    lastPassword = pw;
    $passwordOutput.textContent = pw;
    updateStrengthDisplay(pw);

    $batchSection.classList.add("hidden");

    saveHistory({ password: pw, length, strength: analyzeStrength(pw).label, timestamp: Date.now() });
  } else {
    const passwords = [];
    for (let i = 0; i < batchCount; i++) {
      passwords.push(generatePassword(length));
    }
    lastPassword = passwords[0];
    $passwordOutput.textContent = passwords[0];
    updateStrengthDisplay(passwords[0]);

    $batchSection.classList.remove("hidden");
    $batchList.innerHTML = "";
    passwords.forEach(pw => {
      const row = document.createElement("div");
      row.className = "batch-item";
      const s = analyzeStrength(pw);
      row.innerHTML = `
        <span class="batch-pw" title="${escapeHtml(pw)}">${escapeHtml(pw)}</span>
        <span class="batch-strength ${s.level}">${s.label}</span>
        <button class="batch-copy" title="Copy"><i class="fa-regular fa-copy"></i></button>
      `;
      row.querySelector(".batch-copy").addEventListener("click", () => copyToClipboard(pw));
      $batchList.appendChild(row);
    });

    saveHistory({ password: `${batchCount} passwords generated`, length, strength: `batch ×${batchCount}`, timestamp: Date.now() });
  }

  renderHistory();
}

/* ── Event Listeners ────────────────────────────────────────────── */

$lengthSlider.addEventListener("input", () => {
  $lengthValue.textContent = $lengthSlider.value;
});

$batchSlider.addEventListener("input", () => {
  $batchValue.textContent = $batchSlider.value;
});

document.getElementById("btnGenerate").addEventListener("click", generate);
document.getElementById("btnRefresh").addEventListener("click", generate);

document.getElementById("btnCopy").addEventListener("click", () => {
  if (lastPassword) copyToClipboard(lastPassword);
});

document.getElementById("btnCopyAll").addEventListener("click", () => {
  const pws = [...$batchList.querySelectorAll(".batch-pw")].map(el => el.textContent);
  copyToClipboard(pws.join("\n"));
});

document.getElementById("btnClearHistory").addEventListener("click", clearHistory);

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Space = regenerate (when not in an input)
  if (e.key === " " && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
    e.preventDefault();
    generate();
  }
  // Ctrl+C when not selecting text = copy last password
  if (e.key === "c" && e.ctrlKey && !window.getSelection().toString()) {
    e.preventDefault();
    if (lastPassword) copyToClipboard(lastPassword);
  }
});

/* ── Init ───────────────────────────────────────────────────────── */

renderHistory();
