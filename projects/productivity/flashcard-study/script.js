/* ================================================================
   Flashcard Studio — script.js
   Deck CRUD, card CRUD, flip-card study mode, session stats,
   localStorage persistence, import/export. No dependencies.
   ================================================================ */

/* ── State ──────────────────────────────────────────────────────── */

const STORAGE_KEY = "fc_studio_v1";
let data = loadData();
let currentDeckId = null;
let studyState = null; // { deckId, cardIds, index, known, unknown, isFlipped }

/* ── DOM Refs ───────────────────────────────────────────────────── */

const $deckGrid     = document.getElementById("deckGrid");
const $emptyState   = document.getElementById("emptyState");
const $deckSection  = document.getElementById("deckSection");
const $studyView    = document.getElementById("studyView");
const $sessionDone  = document.getElementById("sessionDone");

const $deckModal    = document.getElementById("deckModal");
const $cardModal    = document.getElementById("cardModal");
const $detailModal  = document.getElementById("detailModal");

const $deckForm     = document.getElementById("deckForm");
const $cardForm     = document.getElementById("cardForm");

const $flashcard    = document.getElementById("flashcard");
const $flashcardInner = document.getElementById("flashcardInner");

const $statDecks    = document.getElementById("statDecks");
const $statCards    = document.getElementById("statCards");
const $statMastered = document.getElementById("statMastered");
const $statSessions = document.getElementById("statSessions");

/* ── Persistence ────────────────────────────────────────────────── */

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { decks: [], sessions: 0 };
  } catch {
    return { decks: [], sessions: 0 };
  }
}

function saveData() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

/* ── Helpers ────────────────────────────────────────────────────── */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Render Dashboard ───────────────────────────────────────────── */

function renderDashboard() {
  let totalCards = 0;
  let mastered = 0;
  data.decks.forEach(d => {
    totalCards += d.cards.length;
    mastered += d.cards.filter(c => c.mastery >= 3).length;
  });

  $statDecks.textContent = data.decks.length;
  $statCards.textContent = totalCards;
  $statMastered.textContent = mastered;
  $statSessions.textContent = data.sessions;

  $deckGrid.innerHTML = "";

  if (data.decks.length === 0) {
    $emptyState.style.display = "";
    $deckGrid.appendChild($emptyState);
    return;
  }
  $emptyState.style.display = "none";

  data.decks.forEach(deck => {
    const card = document.createElement("div");
    card.className = "deck-card";
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open deck: ${deck.name}`);

    const masteredCount = deck.cards.filter(c => c.mastery >= 3).length;
    const pct = deck.cards.length > 0 ? Math.round((masteredCount / deck.cards.length) * 100) : 0;

    card.innerHTML = `
      <div class="deck-card-header">
        <h3 class="deck-card-title">${escapeHtml(deck.name)}</h3>
        <span class="deck-card-count">${deck.cards.length} cards</span>
      </div>
      ${deck.description ? `<p class="deck-card-desc">${escapeHtml(deck.description)}</p>` : ""}
      <div class="deck-card-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        <span class="progress-label">${pct}% mastered</span>
      </div>
      <div class="deck-card-actions">
        <button class="deck-action-btn open" data-action="open" title="Open deck">
          <i class="fa-solid fa-folder-open"></i>
        </button>
        <button class="deck-action-btn study" data-action="study" title="Start study" ${deck.cards.length === 0 ? "disabled" : ""}>
          <i class="fa-solid fa-play"></i>
        </button>
      </div>
    `;

    card.addEventListener("click", (e) => {
      const action = e.target.closest("[data-action]");
      if (!action) return;
      if (action.dataset.action === "open") openDeckDetail(deck.id);
      if (action.dataset.action === "study") startStudy(deck.id);
    });

    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDeckDetail(deck.id);
      }
    });

    $deckGrid.appendChild(card);
  });
}

/* ── Deck CRUD ──────────────────────────────────────────────────── */

function openDeckModal(deckId) {
  const title = document.getElementById("deckModalTitle");
  const nameInput = document.getElementById("deckName");
  const descInput = document.getElementById("deckDesc");

  if (deckId) {
    const deck = data.decks.find(d => d.id === deckId);
    title.textContent = "Edit Deck";
    nameInput.value = deck.name;
    descInput.value = deck.description || "";
    $deckForm.dataset.editId = deckId;
  } else {
    title.textContent = "New Deck";
    nameInput.value = "";
    descInput.value = "";
    delete $deckForm.dataset.editId;
  }

  $deckModal.classList.remove("hidden");
  nameInput.focus();
}

function closeDeckModal() {
  $deckModal.classList.add("hidden");
  $deckForm.reset();
}

$deckForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("deckName").value.trim();
  const desc = document.getElementById("deckDesc").value.trim();
  if (!name) return;

  if ($deckForm.dataset.editId) {
    const deck = data.decks.find(d => d.id === $deckForm.dataset.editId);
    deck.name = name;
    deck.description = desc;
  } else {
    data.decks.push({ id: uid(), name, description: desc, cards: [], createdAt: Date.now() });
  }
  saveData();
  closeDeckModal();
  renderDashboard();
});

function deleteDeck(deckId) {
  if (!confirm("Delete this deck and all its cards?")) return;
  data.decks = data.decks.filter(d => d.id !== deckId);
  saveData();
  renderDashboard();
}

/* ── Card CRUD ──────────────────────────────────────────────────── */

function openCardModal(deckId, cardId) {
  const title = document.getElementById("cardModalTitle");
  const frontInput = document.getElementById("cardFrontInput");
  const backInput = document.getElementById("cardBackInput");

  if (cardId) {
    const deck = data.decks.find(d => d.id === deckId);
    const card = deck.cards.find(c => c.id === cardId);
    title.textContent = "Edit Card";
    frontInput.value = card.front;
    backInput.value = card.back;
    $cardForm.dataset.deckId = deckId;
    $cardForm.dataset.editId = cardId;
  } else {
    title.textContent = "Add Card";
    frontInput.value = "";
    backInput.value = "";
    $cardForm.dataset.deckId = deckId;
    delete $cardForm.dataset.editId;
  }

  $cardModal.classList.remove("hidden");
  frontInput.focus();
}

function closeCardModal() {
  $cardModal.classList.add("hidden");
  $cardForm.reset();
}

$cardForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const deckId = $cardForm.dataset.deckId;
  const front = document.getElementById("cardFrontInput").value.trim();
  const back = document.getElementById("cardBackInput").value.trim();
  if (!front || !back) return;

  const deck = data.decks.find(d => d.id === deckId);

  if ($cardForm.dataset.editId) {
    const card = deck.cards.find(c => c.id === $cardForm.dataset.editId);
    card.front = front;
    card.back = back;
  } else {
    deck.cards.push({ id: uid(), front, back, mastery: 0, lastReviewed: null });
  }

  saveData();
  closeCardModal();
  openDeckDetail(deckId); // refresh the detail view
  renderDashboard();
});

function deleteCard(deckId, cardId) {
  const deck = data.decks.find(d => d.id === deckId);
  deck.cards = deck.cards.filter(c => c.id !== cardId);
  saveData();
  openDeckDetail(deckId);
  renderDashboard();
}

/* ── Deck Detail View ───────────────────────────────────────────── */

function openDeckDetail(deckId) {
  currentDeckId = deckId;
  const deck = data.decks.find(d => d.id === deckId);

  document.getElementById("detailModalTitle").textContent = deck.name;

  const cardList = document.getElementById("cardList");
  cardList.innerHTML = "";

  if (deck.cards.length === 0) {
    cardList.innerHTML = '<p class="empty-state">No cards yet. Add one above!</p>';
  } else {
    deck.cards.forEach((card, idx) => {
      const item = document.createElement("div");
      item.className = "card-list-item";
      const masteryDots = "●".repeat(Math.min(card.mastery, 5)) + "○".repeat(Math.max(0, 5 - card.mastery));
      item.innerHTML = `
        <div class="card-list-num">${idx + 1}</div>
        <div class="card-list-content">
          <div class="card-list-front">${escapeHtml(card.front)}</div>
          <div class="card-list-back">${escapeHtml(card.back)}</div>
          <div class="card-list-mastery" title="Mastery: ${card.mastery}/5">${masteryDots}</div>
        </div>
        <div class="card-list-actions">
          <button class="card-list-btn" data-action="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="card-list-btn danger" data-action="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      `;
      item.querySelector("[data-action='edit']").addEventListener("click", () => openCardModal(deckId, card.id));
      item.querySelector("[data-action='delete']").addEventListener("click", () => deleteCard(deckId, card.id));
      cardList.appendChild(item);
    });
  }

  $detailModal.classList.remove("hidden");
}

/* ── Study Mode ─────────────────────────────────────────────────── */

function startStudy(deckId) {
  const deck = data.decks.find(d => d.id === deckId);
  if (deck.cards.length === 0) return;

  const cardIds = shuffle(deck.cards.map(c => c.id));

  studyState = {
    deckId,
    cardIds,
    index: 0,
    known: [],
    unknown: [],
    isFlipped: false,
  };

  $deckSection.classList.add("hidden");
  $studyView.classList.remove("hidden");
  $sessionDone.classList.add("hidden");
  document.getElementById("flashcard").parentElement.style.display = "";
  document.querySelector(".study-actions").classList.remove("hidden");

  document.getElementById("studyDeckName").textContent = deck.name;
  showStudyCard();
}

function showStudyCard() {
  if (!studyState) return;
  const deck = data.decks.find(d => d.id === studyState.deckId);
  const card = deck.cards.find(c => c.id === studyState.cardIds[studyState.index]);

  document.getElementById("cardFront").textContent = card.front;
  document.getElementById("cardBack").textContent = card.back;
  document.getElementById("studyProgress").textContent =
    `Card ${studyState.index + 1} of ${studyState.cardIds.length}`;
  document.getElementById("scoreKnown").textContent = `${studyState.known.length} ✓`;
  document.getElementById("scoreUnknown").textContent = `${studyState.unknown.length} ✗`;

  studyState.isFlipped = false;
  $flashcardInner.classList.remove("flipped");
}

function flipCard() {
  if (!studyState) return;
  studyState.isFlipped = !studyState.isFlipped;
  $flashcardInner.classList.toggle("flipped", studyState.isFlipped);
}

function markKnown() {
  if (!studyState || !studyState.isFlipped) return;
  const deck = data.decks.find(d => d.id === studyState.deckId);
  const card = deck.cards.find(c => c.id === studyState.cardIds[studyState.index]);
  card.mastery = Math.min(card.mastery + 1, 5);
  card.lastReviewed = Date.now();
  studyState.known.push(card.id);
  advanceStudy();
}

function markDontKnow() {
  if (!studyState || !studyState.isFlipped) return;
  const deck = data.decks.find(d => d.id === studyState.deckId);
  const card = deck.cards.find(c => c.id === studyState.cardIds[studyState.index]);
  card.mastery = Math.max(card.mastery - 1, 0);
  card.lastReviewed = Date.now();
  studyState.unknown.push(card.id);
  advanceStudy();
}

function advanceStudy() {
  saveData();
  studyState.index++;

  if (studyState.index >= studyState.cardIds.length) {
    finishStudy();
    return;
  }
  showStudyCard();
}

function finishStudy() {
  data.sessions++;
  saveData();

  document.getElementById("flashcard").parentElement.style.display = "none";
  document.querySelector(".study-actions").classList.add("hidden");
  $sessionDone.classList.remove("hidden");

  const total = studyState.known.length + studyState.unknown.length;
  document.getElementById("summaryKnown").textContent = studyState.known.length;
  document.getElementById("summaryUnknown").textContent = studyState.unknown.length;
  document.getElementById("summaryAccuracy").textContent =
    `${total > 0 ? Math.round((studyState.known.length / total) * 100) : 0}%`;
}

function exitStudy() {
  studyState = null;
  $studyView.classList.add("hidden");
  $deckSection.classList.remove("hidden");
  renderDashboard();
}

/* ── Import / Export ────────────────────────────────────────────── */

function exportDecks() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `flashcards-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importDecks(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported.decks && Array.isArray(imported.decks)) {
        data.decks.push(...imported.decks);
        if (imported.sessions) data.sessions += imported.sessions;
        saveData();
        renderDashboard();
      } else {
        alert("Invalid flashcard file format.");
      }
    } catch {
      alert("Could not parse the import file.");
    }
  };
  reader.readAsText(file);
}

/* ── Event Listeners ────────────────────────────────────────────── */

// New deck
document.getElementById("btn-new-deck").addEventListener("click", () => openDeckModal(null));
document.getElementById("deckModalClose").addEventListener("click", closeDeckModal);
$deckModal.addEventListener("click", (e) => { if (e.target === $deckModal) closeDeckModal(); });

// Card modal
document.getElementById("cardModalClose").addEventListener("click", closeCardModal);
$cardModal.addEventListener("click", (e) => { if (e.target === $cardModal) closeCardModal(); });

// Detail modal
document.getElementById("detailModalClose").addEventListener("click", () => {
  $detailModal.classList.add("hidden");
  renderDashboard();
});
$detailModal.addEventListener("click", (e) => { if (e.target === $detailModal) {
  $detailModal.classList.add("hidden");
  renderDashboard();
}});

// Detail actions
document.getElementById("btn-add-card").addEventListener("click", () => openCardModal(currentDeckId, null));
document.getElementById("btn-start-study").addEventListener("click", () => {
  $detailModal.classList.add("hidden");
  startStudy(currentDeckId);
});
document.getElementById("btn-delete-deck").addEventListener("click", () => {
  $detailModal.classList.add("hidden");
  deleteDeck(currentDeckId);
});

// Study controls
$flashcard.addEventListener("click", flipCard);
document.getElementById("btn-flip").addEventListener("click", flipCard);
document.getElementById("btn-know").addEventListener("click", markKnown);
document.getElementById("btn-dont-know").addEventListener("click", markDontKnow);
document.getElementById("btn-back").addEventListener("click", exitStudy);
document.getElementById("btn-study-again").addEventListener("click", () => startStudy(studyState.deckId));
document.getElementById("btn-session-back").addEventListener("click", exitStudy);

// Keyboard shortcuts for study
document.addEventListener("keydown", (e) => {
  if (!$studyView.classList.contains("hidden") && studyState) {
    if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); flipCard(); }
    if (e.key === "ArrowRight" || e.key === "k") markKnown();
    if (e.key === "ArrowLeft" || e.key === "j") markDontKnow();
  }
});

// Import / Export
document.getElementById("btn-export").addEventListener("click", exportDecks);
document.getElementById("btn-import").addEventListener("click", () => document.getElementById("fileImport").click());
document.getElementById("fileImport").addEventListener("change", (e) => {
  if (e.target.files[0]) importDecks(e.target.files[0]);
  e.target.value = "";
});

/* ── Init ───────────────────────────────────────────────────────── */

renderDashboard();
