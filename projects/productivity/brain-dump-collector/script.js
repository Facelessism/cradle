const STORAGE_KEY = "cradle:brain-dump-collector";

const CATEGORY_RULES = [
  {
    name: "Work",
    keywords: [
      "work",
      "client",
      "meeting",
      "email",
      "project",
      "deadline",
      "task",
      "bug",
      "fix",
      "deploy",
      "code",
      "review",
    ],
  },
  {
    name: "Study",
    keywords: [
      "study",
      "learn",
      "assignment",
      "exam",
      "class",
      "course",
      "notes",
      "research",
      "practice",
      "interview",
    ],
  },
  {
    name: "Ideas",
    keywords: [
      "idea",
      "build",
      "create",
      "startup",
      "feature",
      "design",
      "brainstorm",
      "experiment",
      "prototype",
    ],
  },
  {
    name: "Health",
    keywords: [
      "health",
      "gym",
      "walk",
      "doctor",
      "sleep",
      "water",
      "medicine",
      "exercise",
      "meal",
    ],
  },
  {
    name: "Finance",
    keywords: [
      "money",
      "bill",
      "budget",
      "pay",
      "fee",
      "invoice",
      "bank",
      "salary",
      "expense",
    ],
  },
  {
    name: "Errands",
    keywords: [
      "buy",
      "shop",
      "call",
      "send",
      "pick",
      "book",
      "clean",
      "visit",
      "renew",
    ],
  },
  {
    name: "Personal",
    keywords: [
      "family",
      "friend",
      "home",
      "birthday",
      "plan",
      "travel",
      "personal",
    ],
  },
];

const state = {
  notes: [],
  sortNewestFirst: true,
};

const elements = {
  captureForm: document.getElementById("captureForm"),
  thoughtInput: document.getElementById("thoughtInput"),
  categoryOverride: document.getElementById("categoryOverride"),
  searchInput: document.getElementById("searchInput"),
  filterCategory: document.getElementById("filterCategory"),
  statusFilter: document.getElementById("statusFilter"),
  sampleBtn: document.getElementById("sampleBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importFile: document.getElementById("importFile"),
  clearBtn: document.getElementById("clearBtn"),
  sortBtn: document.getElementById("sortBtn"),
  board: document.getElementById("board"),
  focusList: document.getElementById("focusList"),
  categorySummary: document.getElementById("categorySummary"),
  resultMeta: document.getElementById("resultMeta"),
  template: document.getElementById("noteTemplate"),
  counts: {
    total: document.getElementById("totalCount"),
    open: document.getElementById("openCount"),
    done: document.getElementById("doneCount"),
    category: document.getElementById("categoryCount"),
  },
};

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
  state.notes = loadNotes();

  elements.captureForm.addEventListener("submit", handleCapture);
  elements.searchInput.addEventListener("input", render);
  elements.filterCategory.addEventListener("change", render);
  elements.statusFilter.addEventListener("change", render);
  elements.sampleBtn.addEventListener("click", loadSampleThoughts);
  elements.exportBtn.addEventListener("click", exportNotes);
  elements.importFile.addEventListener("change", importNotes);
  elements.clearBtn.addEventListener("click", clearAllNotes);
  elements.sortBtn.addEventListener("click", toggleSortOrder);

  elements.thoughtInput.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      elements.captureForm.requestSubmit();
    }
  });

  render();
}

function handleCapture(event) {
  event.preventDefault();

  const rawText = elements.thoughtInput.value.trim();
  if (!rawText) return;

  const overrideCategory = elements.categoryOverride.value;
  const lines = rawText
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);

  const createdAt = new Date().toISOString();
  const newNotes = lines.map(text => {
    const category = overrideCategory || detectCategory(text);
    return {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : `note-${Date.now()}-${Math.random()}`,
      text,
      category,
      tags: extractTags(text, category),
      createdAt,
      updatedAt: createdAt,
      done: false,
      pinned: false,
    };
  });

  state.notes = [...newNotes, ...state.notes];
  persistNotes();
  elements.captureForm.reset();
  elements.thoughtInput.focus();
  render();
}

function detectCategory(text) {
  if (typeof BrainDumpEngine !== "undefined" && BrainDumpEngine.autoCategorize) {
    return BrainDumpEngine.autoCategorize(text);
  }
  const normalized = text.toLowerCase();
  const scores = CATEGORY_RULES.map(rule => {
    const score = rule.keywords.reduce((total, keyword) => {
      return total + (normalized.includes(keyword) ? 1 : 0);
    }, 0);
    return { name: rule.name, score };
  }).sort((a, b) => b.score - a.score);

  return scores[0].score > 0 ? scores[0].name : "Later";
}

function extractTags(text, category) {
  const hashTags = Array.from(text.matchAll(/#([\w-]+)/g)).map(match =>
    match[1].toLowerCase()
  );
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 4)
    .slice(0, 4);

  return Array.from(
    new Set([category.toLowerCase(), ...hashTags, ...words])
  ).slice(0, 6);
}

function render() {
  const filteredNotes = getFilteredNotes();
  const groupedNotes = groupNotes(filteredNotes);

  renderCategoryFilters();
  renderStats();
  renderFocusList();
  renderCategorySummary();
  renderBoard(groupedNotes, filteredNotes.length);
}

function getFilteredNotes() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const category = elements.filterCategory.value;
  const status = elements.statusFilter.value;

  return state.notes
    .filter(note => {
      const searchableText =
        `${note.text} ${note.category} ${note.tags.join(" ")}`.toLowerCase();
      const matchesQuery = !query || searchableText.includes(query);
      const matchesCategory = !category || note.category === category;
      const matchesStatus =
        status === "all" ||
        (status === "open" && !note.done) ||
        (status === "done" && note.done) ||
        (status === "pinned" && note.pinned);

      return matchesQuery && matchesCategory && matchesStatus;
    })
    .sort(sortNotes);
}

function sortNotes(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  return state.sortNewestFirst ? bTime - aTime : aTime - bTime;
}

function groupNotes(notes) {
  return notes.reduce((groups, note) => {
    if (!groups[note.category]) groups[note.category] = [];
    groups[note.category].push(note);
    return groups;
  }, {});
}

function renderBoard(groupedNotes, filteredCount) {
  elements.board.innerHTML = "";
  elements.resultMeta.textContent = `${filteredCount} of ${state.notes.length} thoughts shown`;

  if (!filteredCount) {
    elements.board.innerHTML = `
      <div class="empty-state">
        No thoughts match the current filters. Capture a thought or clear your search.
      </div>
    `;
    return;
  }

  Object.entries(groupedNotes)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([category, notes]) => {
      const column = document.createElement("section");
      column.className = "group-column";
      column.innerHTML = `
        <div class="group-header">
          <h3>${escapeHtml(category)}</h3>
          <span>${notes.length} thought${notes.length === 1 ? "" : "s"}</span>
        </div>
        <div class="note-list"></div>
      `;

      const list = column.querySelector(".note-list");
      notes.forEach(note => list.appendChild(createNoteCard(note)));
      elements.board.appendChild(column);
    });
}

function createNoteCard(note) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  card.classList.toggle("done", note.done);
  card.classList.toggle("pinned", note.pinned);

  card.querySelector(".note-category").textContent = note.category;
  card.querySelector(".note-time").textContent = formatRelativeTime(
    note.createdAt
  );
  card.querySelector(".note-text").textContent = note.text;
  card.querySelector(".note-tags").innerHTML = note.tags
    .map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`)
    .join("");

  card.querySelector('[data-action="pin"]').textContent = note.pinned
    ? "Unpin"
    : "Pin";
  card.querySelector('[data-action="done"]').textContent = note.done
    ? "Reopen"
    : "Done";

  card
    .querySelector('[data-action="pin"]')
    .addEventListener("click", () => toggleNote(note.id, "pinned"));
  card
    .querySelector('[data-action="done"]')
    .addEventListener("click", () => toggleNote(note.id, "done"));
  card
    .querySelector('[data-action="edit"]')
    .addEventListener("click", () => editNote(note.id));
  card
    .querySelector('[data-action="delete"]')
    .addEventListener("click", () => deleteNote(note.id));

  return card;
}

function renderCategoryFilters() {
  const categories = getCategories();
  const currentValue = elements.filterCategory.value;
  elements.filterCategory.innerHTML = '<option value="">All groups</option>';

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.filterCategory.appendChild(option);
  });

  elements.filterCategory.value = categories.includes(currentValue)
    ? currentValue
    : "";
}

function renderStats() {
  const categories = getCategories();
  elements.counts.total.textContent = state.notes.length;
  elements.counts.open.textContent = state.notes.filter(
    note => !note.done
  ).length;
  elements.counts.done.textContent = state.notes.filter(
    note => note.done
  ).length;
  elements.counts.category.textContent = categories.length;
}

function renderFocusList() {
  const focusNotes = state.notes
    .filter(note => !note.done)
    .sort(sortNotes)
    .slice(0, 4);

  elements.focusList.innerHTML = focusNotes.length
    ? focusNotes
        .map(
          note => `
          <div class="focus-item">
            <strong>${escapeHtml(note.text)}</strong>
            <small>${escapeHtml(note.category)} - ${formatRelativeTime(note.createdAt)}</small>
          </div>
        `
        )
        .join("")
    : '<div class="empty-state">Your focus queue is clear.</div>';
}

function renderCategorySummary() {
  const totals = state.notes.reduce((summary, note) => {
    summary[note.category] = (summary[note.category] || 0) + 1;
    return summary;
  }, {});

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  elements.categorySummary.innerHTML = entries.length
    ? entries
        .map(
          ([category, count]) => `
          <div class="category-pill">
            <strong>${escapeHtml(category)}</strong>
            <span>${count} captured thought${count === 1 ? "" : "s"}</span>
          </div>
        `
        )
        .join("")
    : '<div class="empty-state">Categories will appear after you capture thoughts.</div>';
}

function toggleNote(id, field) {
  state.notes = state.notes.map(note => {
    if (note.id !== id) return note;
    return {
      ...note,
      [field]: !note[field],
      updatedAt: new Date().toISOString(),
    };
  });
  persistNotes();
  render();
}

function editNote(id) {
  const note = state.notes.find(item => item.id === id);
  if (!note) return;

  const nextText = window.prompt("Edit thought", note.text);
  if (nextText === null) return;

  const trimmedText = nextText.trim();
  if (!trimmedText) return;

  const nextCategory = window.prompt("Edit category", note.category);
  const category =
    nextCategory && nextCategory.trim()
      ? titleCase(nextCategory.trim())
      : detectCategory(trimmedText);

  state.notes = state.notes.map(item => {
    if (item.id !== id) return item;
    return {
      ...item,
      text: trimmedText,
      category,
      tags: extractTags(trimmedText, category),
      updatedAt: new Date().toISOString(),
    };
  });

  persistNotes();
  render();
}

function deleteNote(id) {
  state.notes = state.notes.filter(note => note.id !== id);
  persistNotes();
  render();
}

function clearAllNotes() {
  if (!state.notes.length) return;
  state.notes = [];
  persistNotes();
  render();
}

function toggleSortOrder() {
  state.sortNewestFirst = !state.sortNewestFirst;
  elements.sortBtn.textContent = state.sortNewestFirst
    ? "Newest First"
    : "Oldest First";
  render();
}

function loadSampleThoughts() {
  elements.thoughtInput.value = [
    "Fix dashboard CSS bug before pushing the PR",
    "Research interview questions for full stack students",
    "Buy sticky notes and marker pens after class",
    "Idea: build a habit tracker with streak insights",
    "Drink more water during long coding sessions",
  ].join("\n");
  elements.categoryOverride.value = "";
  elements.thoughtInput.focus();
}

function exportNotes() {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: "Brain Dump Collector",
    notes: state.notes,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "brain-dump-collector-export.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function importNotes(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const importedNotes = Array.isArray(parsed.notes) ? parsed.notes : parsed;
      if (!Array.isArray(importedNotes)) throw new Error("Invalid notes file.");

      state.notes = importedNotes
        .filter(note => note.text)
        .map(note => ({
          id:
            note.id ||
            (crypto.randomUUID
              ? crypto.randomUUID()
              : `note-${Date.now()}-${Math.random()}`),
          text: String(note.text),
          category: note.category || detectCategory(note.text),
          tags: Array.isArray(note.tags)
            ? note.tags
            : extractTags(
                note.text,
                note.category || detectCategory(note.text)
              ),
          createdAt: note.createdAt || new Date().toISOString(),
          updatedAt: note.updatedAt || new Date().toISOString(),
          done: Boolean(note.done),
          pinned: Boolean(note.pinned),
        }));

      persistNotes();
      render();
    } catch (error) {
      showAlert("Could not import this JSON file.");
    } finally {
      elements.importFile.value = "";
    }
  };
  reader.readAsText(file);
}

function getCategories() {
  return Array.from(new Set(state.notes.map(note => note.category))).sort(
    (a, b) => a.localeCompare(b)
  );
}

function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

function persistNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
}

function formatRelativeTime(timestamp) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function titleCase(value) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function escapeHtml(str) {
  return CradleEscape.escapeHtml(str);
}

let alertTimeout;
function showAlert(message) {
  const container = document.getElementById("alertContainer");
  const messageEl = document.getElementById("alertMessage");
  if (container && messageEl) {
    messageEl.textContent = message;
    container.style.display = "flex";
    clearTimeout(alertTimeout);
    alertTimeout = setTimeout(() => {
      container.style.display = "none";
    }, 5000);
  }
}
