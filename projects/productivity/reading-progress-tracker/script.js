/**
 * Reading Progress Tracker — UI Script
 * Handles all DOM interactions, state persistence via localStorage,
 * and wires the pure tracker-logic.js module into the UI.
 */

"use strict";

// ──────────────────────────────────────────────────────────────────────────────
// State
// ──────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = "cradle_reading_tracker_v1";

let state = {
  books: [],
  sessions: [],
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.books = Array.isArray(parsed.books) ? parsed.books : [];
      state.sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    }
  } catch (e) {
    console.warn("[ReadingTracker] Failed to load state:", e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("[ReadingTracker] Failed to save state:", e);
  }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const ui = {
  booksGrid: $("books-grid"),
  emptyLibrary: $("empty-library"),
  sessionsList: $("sessions-list"),
  emptySessions: $("empty-sessions"),

  // stats dashboard
  valTotalBooks: $("val-total-books"),
  valCompleted: $("val-completed"),
  valReading: $("val-reading"),
  valPages: $("val-pages"),
  valHours: $("val-hours"),
  valStreak: $("val-streak"),

  // analytics
  monthlyChart: $("monthly-chart"),
  genreList: $("genre-list"),
  avgSpeed: $("avg-speed"),
  longestStreak: $("longest-streak"),
  completionRate: $("completion-rate"),

  // tabs
  tabBtns: document.querySelectorAll(".tab-btn"),
  tabPanels: {
    library: $("panel-library"),
    sessions: $("panel-sessions"),
    history: $("panel-history"),
  },

  // filter bar
  filterStatus: $("filter-status"),
  filterGenre: $("filter-genre"),
  searchBooks: $("search-books"),

  // book modal
  bookModal: $("book-modal"),
  bookModalTitle: $("book-modal-title"),
  bookForm: $("book-form"),
  bookId: $("book-id"),
  bookTitle: $("book-title"),
  bookAuthor: $("book-author"),
  bookTotalPages: $("book-total-pages"),
  bookCurrentPage: $("book-current-page"),
  bookGenre: $("book-genre"),
  bookStatus: $("book-status"),
  bookNotes: $("book-notes"),
  btnDeleteBook: $("btn-delete-book"),

  // session modal
  sessionModal: $("session-modal"),
  sessionForm: $("session-form"),
  sessionId: $("session-id"),
  sessionBook: $("session-book"),
  sessionDate: $("session-date"),
  sessionDuration: $("session-duration"),
  sessionStartPage: $("session-start-page"),
  sessionEndPage: $("session-end-page"),
  sessionNotes: $("session-notes"),
  btnDeleteSession: $("btn-delete-session"),

  // detail modal
  detailModal: $("detail-modal"),
  detailBookTitle: $("detail-book-title"),
  detailContent: $("detail-content"),

  // export
  btnExportMenu: $("btn-export-menu"),
  exportDropdown: $("export-dropdown-content"),
  btnExportJson: $("btn-export-json"),
  importJsonFile: $("import-json-file"),
};

// ──────────────────────────────────────────────────────────────────────────────
// Rendering
// ──────────────────────────────────────────────────────────────────────────────
function render() {
  renderStats();
  renderLibrary();
  renderSessions();
  renderAnalytics();
  populateBookSelects();
  populateGenreFilter();
}

function renderStats() {
  const stats = calculateReadingStats(state.books, state.sessions);
  ui.valTotalBooks.textContent = stats.totalBooks;
  ui.valCompleted.textContent = stats.completedBooks;
  ui.valReading.textContent = stats.currentlyReading;
  ui.valPages.textContent = stats.totalPagesRead.toLocaleString();
  ui.valHours.textContent = `${stats.totalHours}h`;
  ui.valStreak.textContent = stats.currentStreak;
}

function getBadgeClass(status) {
  if (status === "completed") return "badge-completed";
  if (status === "reading") return "badge-reading";
  return "badge-want";
}

function getBadgeLabel(status) {
  if (status === "completed") return "✅ Completed";
  if (status === "reading") return "📖 Reading";
  return "🔖 Want to Read";
}

function renderLibrary() {
  const status = ui.filterStatus.value;
  const genre = ui.filterGenre.value;
  const query = ui.searchBooks.value.trim().toLowerCase();

  let filtered = state.books.filter(b => {
    if (status !== "all" && b.status !== status) return false;
    if (genre !== "all" && b.genre !== genre) return false;
    if (
      query &&
      !b.title.toLowerCase().includes(query) &&
      !(b.author || "").toLowerCase().includes(query)
    )
      return false;
    return true;
  });

  if (filtered.length === 0) {
    ui.booksGrid.innerHTML = "";
    ui.emptyLibrary.hidden = false;
  } else {
    ui.emptyLibrary.hidden = true;
    ui.booksGrid.innerHTML = filtered.map(book => bookCardHTML(book)).join("");

    // Attach event listeners for card clicks
    ui.booksGrid.querySelectorAll(".book-card").forEach(card => {
      card.addEventListener("click", e => {
        if (e.target.closest(".action-btn")) return; // handled separately
        openDetailModal(card.dataset.id);
      });
    });
    ui.booksGrid.querySelectorAll(".action-edit-book").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        openBookModal(btn.dataset.id);
      });
    });
    ui.booksGrid.querySelectorAll(".action-log-session").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        openSessionModal(null, btn.dataset.id);
      });
    });
  }
}

function bookCardHTML(book) {
  const prog = calculateBookProgress(book);
  const est = estimateCompletionDate(book, state.sessions);
  const fillClass = prog.isCompleted ? "completed" : "";
  const badgeClass = getBadgeClass(book.status);
  const badgeLabel = getBadgeLabel(book.status);

  let estHtml = "";
  if (est.status === "in-progress" && est.estimatedDate) {
    estHtml = `<span class="est-date">🏁 ~${est.estimatedDate}</span>`;
  } else if (est.status === "completed") {
    estHtml = `<span class="est-date" style="color:#34d399;">🎉 Finished!</span>`;
  }

  return `
    <div class="book-card" data-id="${book.id}" tabindex="0" role="button" aria-label="View details for ${escapeHtml(book.title)}">
      <div class="book-card-header">
        <div class="book-title-group">
          <div class="book-card-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</div>
          ${book.author ? `<div class="book-card-author">by ${escapeHtml(book.author)}</div>` : ""}
        </div>
        <div class="book-card-actions">
          <button class="action-btn action-log-session" data-id="${book.id}" title="Log session" aria-label="Log session for ${escapeHtml(book.title)}">📝</button>
          <button class="action-btn action-edit-book" data-id="${book.id}" title="Edit book" aria-label="Edit ${escapeHtml(book.title)}">✏️</button>
        </div>
      </div>

      <div>
        <span class="status-badge ${badgeClass}">${badgeLabel}</span>
      </div>

      <div class="progress-section">
        <div class="progress-label-row">
          <span>Page ${prog.currentPage} of ${prog.totalPages}</span>
          <span>${prog.percentage}%</span>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill ${fillClass}" style="width: ${prog.percentage}%"></div>
        </div>
      </div>

      <div class="book-card-meta">
        ${book.genre ? `<span class="book-card-genre">${escapeHtml(book.genre)}</span>` : "<span></span>"}
        ${estHtml}
      </div>
    </div>`;
}

function renderSessions() {
  const sorted = [...state.sessions].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  if (sorted.length === 0) {
    ui.sessionsList.innerHTML = "";
    ui.emptySessions.hidden = false;
  } else {
    ui.emptySessions.hidden = true;
    ui.sessionsList.innerHTML = sorted.map(s => sessionRowHTML(s)).join("");

    ui.sessionsList.querySelectorAll(".session-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => openSessionModal(btn.dataset.id));
    });
  }
}

function sessionRowHTML(s) {
  const book = state.books.find(b => b.id === s.bookId);
  const bookName = book ? escapeHtml(book.title) : "(Deleted book)";
  const pages = parseInt(s.pagesRead, 10) || 0;
  const mins = parseInt(s.durationMinutes, 10) || 0;
  const metaParts = [s.date];
  if (mins) metaParts.push(`${mins} min`);
  if (s.notes) metaParts.push(escapeHtml(s.notes).substring(0, 50));

  return `
    <div class="session-row">
      <div>
        <div class="session-book-name">${bookName}</div>
        <div class="session-meta">${metaParts.join(" · ")}</div>
      </div>
      <div class="session-pages-badge">+${pages} pages</div>
      <div class="session-actions">
        <button class="action-btn session-edit-btn" data-id="${s.id}" title="Edit session" aria-label="Edit session">✏️</button>
      </div>
    </div>`;
}

function renderAnalytics() {
  const stats = calculateReadingStats(state.books, state.sessions);

  // Monthly chart
  const months = Object.keys(stats.monthlyPages).sort();
  if (months.length === 0) {
    ui.monthlyChart.innerHTML =
      '<div class="chart-empty">No session data yet.</div>';
  } else {
    const maxVal = Math.max(...months.map(m => stats.monthlyPages[m]), 1);
    const bars = months
      .map(m => {
        const val = stats.monthlyPages[m];
        const heightPct = (val / maxVal) * 100;
        const label = m.substring(5); // MM
        return `
            <div class="bar-group">
              <div class="bar-column" style="height: ${heightPct}%" data-value="${val}"></div>
              <div class="bar-label">${label}</div>
            </div>`;
      })
      .join("");
    ui.monthlyChart.innerHTML = bars;
  }

  // Genre breakdown
  const genres = Object.entries(stats.genreBreakdown).sort(
    (a, b) => b[1] - a[1]
  );
  if (genres.length === 0) {
    ui.genreList.innerHTML =
      '<div class="chart-empty">No books added yet.</div>';
  } else {
    const maxGenre = Math.max(...genres.map(g => g[1]), 1);
    ui.genreList.innerHTML = genres
      .map(
        ([name, count]) => `
            <div class="genre-row">
              <div class="genre-name">${escapeHtml(name)}</div>
              <div class="genre-bar-track">
                <div class="genre-bar-fill" style="width:${(count / maxGenre) * 100}%"></div>
              </div>
              <div class="genre-count">${count}</div>
            </div>`
      )
      .join("");
  }

  // Speed stats
  ui.avgSpeed.textContent = stats.averageSpeedPagesPerHour
    ? `${stats.averageSpeedPagesPerHour} pp/h`
    : "—";
  ui.longestStreak.textContent = `${stats.longestStreak} day${stats.longestStreak !== 1 ? "s" : ""}`;
  const rate =
    stats.totalBooks > 0
      ? `${Math.round((stats.completedBooks / stats.totalBooks) * 100)}%`
      : "—";
  ui.completionRate.textContent = rate;
}

function populateGenreFilter() {
  const genres = [
    ...new Set(state.books.map(b => b.genre).filter(Boolean)),
  ].sort();
  const current = ui.filterGenre.value;
  ui.filterGenre.innerHTML =
    '<option value="all">All Genres</option>' +
    genres
      .map(
        g =>
          `<option value="${escapeHtml(g)}" ${current === g ? "selected" : ""}>${escapeHtml(g)}</option>`
      )
      .join("");
  if (genres.includes(current)) ui.filterGenre.value = current;
}

function populateBookSelects() {
  const opts = state.books
    .map(b => `<option value="${b.id}">${escapeHtml(b.title)}</option>`)
    .join("");
  ui.sessionBook.innerHTML = '<option value="">Select a book…</option>' + opts;
}

// ──────────────────────────────────────────────────────────────────────────────
// Book Modal
// ──────────────────────────────────────────────────────────────────────────────
function openBookModal(bookId = null) {
  const book = bookId ? state.books.find(b => b.id === bookId) : null;
  ui.bookModalTitle.textContent = book ? "Edit Book" : "Add Book";
  ui.bookId.value = book ? book.id : "";
  ui.bookTitle.value = book ? book.title : "";
  ui.bookAuthor.value = book ? book.author || "" : "";
  ui.bookTotalPages.value = book ? book.totalPages : "";
  ui.bookCurrentPage.value = book ? book.currentPage : "0";
  ui.bookGenre.value = book ? book.genre || "" : "";
  ui.bookStatus.value = book ? book.status : "want-to-read";
  ui.bookNotes.value = book ? book.notes || "" : "";
  ui.btnDeleteBook.hidden = !book;
  ui.bookModal.hidden = false;
  ui.bookTitle.focus();
}

function closeBookModal() {
  ui.bookModal.hidden = true;
  ui.bookForm.reset();
}

function saveBook(e) {
  e.preventDefault();
  const title = ui.bookTitle.value.trim();
  if (!title) {
    ui.bookTitle.focus();
    return;
  }
  const totalPages = Math.max(1, parseInt(ui.bookTotalPages.value, 10) || 1);
  const currentPage = Math.min(
    totalPages,
    Math.max(0, parseInt(ui.bookCurrentPage.value, 10) || 0)
  );
  const status =
    ui.bookStatus.value ||
    (currentPage >= totalPages
      ? "completed"
      : currentPage > 0
        ? "reading"
        : "want-to-read");

  if (ui.bookId.value) {
    const idx = state.books.findIndex(b => b.id === ui.bookId.value);
    if (idx !== -1) {
      state.books[idx] = {
        ...state.books[idx],
        title,
        totalPages,
        currentPage,
        status,
        author: ui.bookAuthor.value.trim(),
        genre: ui.bookGenre.value || "",
        notes: ui.bookNotes.value.trim(),
      };
    }
  } else {
    state.books.push({
      id: generateId(),
      title,
      totalPages,
      currentPage,
      status,
      author: ui.bookAuthor.value.trim(),
      genre: ui.bookGenre.value || "",
      notes: ui.bookNotes.value.trim(),
      createdAt: new Date().toISOString(),
    });
  }

  saveState();
  closeBookModal();
  render();
}

function deleteBook() {
  const id = ui.bookId.value;
  if (!id) return;
  if (!confirm("Delete this book and all its sessions? This cannot be undone."))
    return;
  state.books = state.books.filter(b => b.id !== id);
  state.sessions = state.sessions.filter(s => s.bookId !== id);
  saveState();
  closeBookModal();
  render();
}

// ──────────────────────────────────────────────────────────────────────────────
// Session Modal
// ──────────────────────────────────────────────────────────────────────────────
function openSessionModal(sessionId = null, preselectedBookId = null) {
  const session = sessionId
    ? state.sessions.find(s => s.id === sessionId)
    : null;
  ui.sessionId.value = session ? session.id : "";
  ui.sessionBook.value = session ? session.bookId : preselectedBookId || "";
  ui.sessionDate.value = session ? session.date : todayISO();
  ui.sessionDuration.value = session ? session.durationMinutes || "" : "";
  ui.sessionStartPage.value = session ? session.startPage || "" : "";
  ui.sessionEndPage.value = session ? session.endPage || "" : "";
  ui.sessionNotes.value = session ? session.notes || "" : "";
  ui.btnDeleteSession.hidden = !session;
  ui.sessionModal.hidden = false;
  ui.sessionBook.focus();
}

function closeSessionModal() {
  ui.sessionModal.hidden = true;
  ui.sessionForm.reset();
}

function saveSession(e) {
  e.preventDefault();
  const bookId = ui.sessionBook.value;
  const date = ui.sessionDate.value;
  if (!bookId || !date) return;

  const startPage = parseInt(ui.sessionStartPage.value, 10) || 0;
  const endPage = parseInt(ui.sessionEndPage.value, 10) || 0;
  const pagesRead = Math.max(0, endPage - startPage);

  const sessionData = {
    bookId,
    date,
    durationMinutes: parseInt(ui.sessionDuration.value, 10) || 0,
    startPage,
    endPage,
    pagesRead,
    notes: ui.sessionNotes.value.trim(),
  };

  if (ui.sessionId.value) {
    const idx = state.sessions.findIndex(s => s.id === ui.sessionId.value);
    if (idx !== -1)
      state.sessions[idx] = { ...state.sessions[idx], ...sessionData };
  } else {
    state.sessions.push({
      id: generateId(),
      ...sessionData,
      createdAt: new Date().toISOString(),
    });

    // Update book's currentPage if endPage is further
    const bookIdx = state.books.findIndex(b => b.id === bookId);
    if (bookIdx !== -1 && endPage > state.books[bookIdx].currentPage) {
      state.books[bookIdx].currentPage = Math.min(
        state.books[bookIdx].totalPages,
        endPage
      );
      if (state.books[bookIdx].currentPage >= state.books[bookIdx].totalPages) {
        state.books[bookIdx].status = "completed";
      } else if (state.books[bookIdx].status === "want-to-read") {
        state.books[bookIdx].status = "reading";
      }
    }
  }

  saveState();
  closeSessionModal();
  render();
}

function deleteSession() {
  const id = ui.sessionId.value;
  if (!id) return;
  if (!confirm("Delete this session? This cannot be undone.")) return;
  state.sessions = state.sessions.filter(s => s.id !== id);
  saveState();
  closeSessionModal();
  render();
}

// ──────────────────────────────────────────────────────────────────────────────
// Detail Modal
// ──────────────────────────────────────────────────────────────────────────────
function openDetailModal(bookId) {
  const book = state.books.find(b => b.id === bookId);
  if (!book) return;

  const prog = calculateBookProgress(book);
  const est = estimateCompletionDate(book, state.sessions);
  const bookSessions = state.sessions
    .filter(s => s.bookId === bookId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  ui.detailBookTitle.textContent = book.title;

  let estStr = "—";
  if (est.status === "completed") estStr = "🎉 Completed!";
  else if (est.estimatedDate)
    estStr = `${est.estimatedDate} (~${est.daysRemaining} days)`;

  const sessionsHtml =
    bookSessions.length === 0
      ? '<div style="color:var(--text-muted);font-size:0.82rem;">No sessions logged yet.</div>'
      : bookSessions
          .map(
            s => `
            <div class="detail-session-item">
              <span class="detail-session-date">${s.date}</span>
              <span>${s.durationMinutes ? s.durationMinutes + " min · " : ""}${s.notes ? escapeHtml(s.notes).substring(0, 40) : ""}</span>
              <span class="detail-session-pages">+${s.pagesRead || 0} pp</span>
            </div>`
          )
          .join("");

  ui.detailContent.innerHTML = `
      <div class="detail-progress-section">
        <div class="detail-progress-big">${prog.percentage}%</div>
        <div class="detail-progress-sub">Page ${prog.currentPage} of ${prog.totalPages} · ${prog.remainingPages} pages remaining</div>
        <div class="detail-bar-track">
          <div class="detail-bar-fill" style="width:${prog.percentage}%"></div>
        </div>
      </div>
      <div class="detail-meta-grid">
        <div class="detail-meta-item"><div class="detail-meta-key">Author</div><div class="detail-meta-val">${escapeHtml(book.author || "—")}</div></div>
        <div class="detail-meta-item"><div class="detail-meta-key">Genre</div><div class="detail-meta-val">${escapeHtml(book.genre || "—")}</div></div>
        <div class="detail-meta-item"><div class="detail-meta-key">Status</div><div class="detail-meta-val">${getBadgeLabel(book.status)}</div></div>
        <div class="detail-meta-item"><div class="detail-meta-key">Est. Finish</div><div class="detail-meta-val" style="font-size:0.82rem">${estStr}</div></div>
        <div class="detail-meta-item"><div class="detail-meta-key">Avg Velocity</div><div class="detail-meta-val">${est.dailyVelocity || "—"} pp/day</div></div>
        <div class="detail-meta-item"><div class="detail-meta-key">Sessions</div><div class="detail-meta-val">${bookSessions.length}</div></div>
      </div>
      ${book.notes ? `<p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:1rem;">${escapeHtml(book.notes)}</p>` : ""}
      <div class="detail-sessions-title">Recent Sessions</div>
      <div class="detail-session-list">${sessionsHtml}</div>
      <div class="detail-modal-actions">
        <button class="btn btn-secondary" id="detail-log-session-btn">📝 Log Session</button>
        <button class="btn btn-primary" id="detail-edit-book-btn">✏️ Edit Book</button>
      </div>`;

  $("detail-log-session-btn").addEventListener("click", () => {
    ui.detailModal.hidden = true;
    openSessionModal(null, bookId);
  });
  $("detail-edit-book-btn").addEventListener("click", () => {
    ui.detailModal.hidden = true;
    openBookModal(bookId);
  });

  ui.detailModal.hidden = false;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab Navigation
// ──────────────────────────────────────────────────────────────────────────────
function switchTab(tabName) {
  ui.tabBtns.forEach(btn => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active);
  });
  Object.entries(ui.tabPanels).forEach(([name, panel]) => {
    panel.hidden = name !== tabName;
  });
  if (tabName === "history") renderAnalytics();
}

// ──────────────────────────────────────────────────────────────────────────────
// Export / Import
// ──────────────────────────────────────────────────────────────────────────────
function exportJSON() {
  const content = exportTrackerData(state.books, state.sessions);
  downloadFile(
    content,
    `reading-tracker-export-${todayISO()}.json`,
    "application/json"
  );
}

function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = importTrackerData(e.target.result);
      if (
        !confirm(
          `Import ${imported.books.length} books and ${imported.sessions.length} sessions? This will replace all current data.`
        )
      )
        return;
      state.books = imported.books;
      state.sessions = imported.sessions;
      saveState();
      render();
    } catch (err) {
      showAlert(`Import failed: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────────────────────────────────────
// Utility
// ──────────────────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function escapeHtml(str) {
  return CradleEscape.escapeHtml(str);
}

// ──────────────────────────────────────────────────────────────────────────────
// Event Wiring
// ──────────────────────────────────────────────────────────────────────────────
function initEvents() {
  // Header buttons
  $("btn-add-book").addEventListener("click", () => openBookModal());
  $("btn-add-book-empty").addEventListener("click", () => openBookModal());
  $("btn-log-session").addEventListener("click", () => openSessionModal());

  // Book modal
  ui.bookForm.addEventListener("submit", saveBook);
  $("btn-cancel-book").addEventListener("click", closeBookModal);
  $("book-modal-close").addEventListener("click", closeBookModal);
  ui.btnDeleteBook.addEventListener("click", deleteBook);
  ui.bookModal.addEventListener("click", e => {
    if (e.target === ui.bookModal) closeBookModal();
  });

  // Session modal
  ui.sessionForm.addEventListener("submit", saveSession);
  $("btn-cancel-session").addEventListener("click", closeSessionModal);
  $("session-modal-close").addEventListener("click", closeSessionModal);
  ui.btnDeleteSession.addEventListener("click", deleteSession);
  ui.sessionModal.addEventListener("click", e => {
    if (e.target === ui.sessionModal) closeSessionModal();
  });

  // Detail modal
  $("detail-modal-close").addEventListener("click", () => {
    ui.detailModal.hidden = true;
  });
  ui.detailModal.addEventListener("click", e => {
    if (e.target === ui.detailModal) ui.detailModal.hidden = true;
  });

  // Tabs
  ui.tabBtns.forEach(btn =>
    btn.addEventListener("click", () => switchTab(btn.dataset.tab))
  );

  // Filters
  ui.filterStatus.addEventListener("change", renderLibrary);
  ui.filterGenre.addEventListener("change", renderLibrary);
  ui.searchBooks.addEventListener("input", renderLibrary);

  // Export / Import
  ui.btnExportMenu.addEventListener("click", e => {
    e.stopPropagation();
    ui.exportDropdown.hidden = !ui.exportDropdown.hidden;
  });
  document.addEventListener("click", () => {
    ui.exportDropdown.hidden = true;
  });
  ui.btnExportJson.addEventListener("click", () => {
    exportJSON();
    ui.exportDropdown.hidden = true;
  });
  ui.importJsonFile.addEventListener("change", e => {
    importJSON(e.target.files[0]);
    e.target.value = "";
  });

  // Keyboard: close modals on Escape
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" || e.key === "Esc") {
      if (!ui.bookModal.hidden) closeBookModal();
      if (!ui.sessionModal.hidden) closeSessionModal();
      if (!ui.detailModal.hidden) ui.detailModal.hidden = true;
    }
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────────────────────────────────────
(function init() {
  loadState();
  initEvents();
  render();
})();

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
