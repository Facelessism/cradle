const engine = window.StorageEngine;
const exporter = window.StorageExporter;

const storageState = {
  local: [],
  session: [],
  cookies: [],
  indexed: [],
  typeFilter: "all"
};

const elements = {
  searchInput: document.getElementById("searchInput"),
  typeFilterSelect: document.getElementById("typeFilterSelect"),
  refreshBtn: document.getElementById("refreshBtn"),
  seedBtn: document.getElementById("seedBtn"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  statusMessage: document.getElementById("statusMessage"),
  counts: {
    local: document.getElementById("localCount"),
    session: document.getElementById("sessionCount"),
    cookies: document.getElementById("cookieCount"),
    indexed: document.getElementById("indexedCount"),
  },
  rows: {
    local: document.getElementById("localRows"),
    session: document.getElementById("sessionRows"),
    cookies: document.getElementById("cookieRows"),
    indexed: document.getElementById("indexedRows"),
  },
};

document.addEventListener("DOMContentLoaded", initializeInspector);

function initializeInspector() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => showPanel(tab.dataset.panel));
  });

  document.querySelectorAll("[data-form]").forEach(form => {
    form.addEventListener("submit", handleFormSubmit);
  });

  document.querySelectorAll("[data-clear]").forEach(button => {
    button.addEventListener("click", () => clearStorage(button.dataset.clear));
  });

  if (elements.refreshBtn) elements.refreshBtn.addEventListener("click", refreshAll);
  if (elements.seedBtn) elements.seedBtn.addEventListener("click", seedDemoData);
  if (elements.exportJsonBtn) elements.exportJsonBtn.addEventListener("click", exportJSON);
  if (elements.exportCsvBtn) elements.exportCsvBtn.addEventListener("click", exportCSV);

  if (elements.searchInput) elements.searchInput.addEventListener("input", renderAll);
  if (elements.typeFilterSelect) {
    elements.typeFilterSelect.addEventListener("change", e => {
      storageState.typeFilter = e.target.value;
      renderAll();
    });
  }

  refreshAll();
}

function refreshAll() {
  if (engine) {
    const localData = engine.readWebStorage("localStorage");
    const sessionData = engine.readWebStorage("sessionStorage");
    const cookieData = engine.readCookies();

    storageState.local = localData.items;
    storageState.session = sessionData.items;
    storageState.cookies = cookieData.items;
  }
  renderAll();
  setStatus("Storage data refreshed.");
}

function setStatus(msg) {
  if (elements.statusMessage) {
    elements.statusMessage.textContent = msg;
  }
}

function showPanel(panelId) {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.panel === panelId);
  });
  document.querySelectorAll(".panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === panelId);
  });
}

function renderAll() {
  const query = elements.searchInput ? elements.searchInput.value : "";
  const typeFilter = storageState.typeFilter;

  const filteredLocal = engine ? engine.filterItems(storageState.local, query, typeFilter) : storageState.local;
  const filteredSession = engine ? engine.filterItems(storageState.session, query, typeFilter) : storageState.session;
  const filteredCookies = engine ? engine.filterItems(storageState.cookies, query, typeFilter) : storageState.cookies;

  if (elements.counts.local) elements.counts.local.textContent = storageState.local.length;
  if (elements.counts.session) elements.counts.session.textContent = storageState.session.length;
  if (elements.counts.cookies) elements.counts.cookies.textContent = storageState.cookies.length;

  renderRows(elements.rows.local, filteredLocal, "local");
  renderRows(elements.rows.session, filteredSession, "session");
  renderRows(elements.rows.cookies, filteredCookies, "cookies");
}

function renderRows(container, items, storeType) {
  if (!container) return;
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<tr><td colspan="5" class="empty-cell">No items found.</td></tr>`;
    return;
  }

  items.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(item.key)}</strong></td>
      <td><span class="badge badge-${item.type || "string"}">${item.type || "string"}</span></td>
      <td><small>${item.formattedBytes || "0 B"}</small></td>
      <td><code class="val-preview">${escapeHtml(String(item.value))}</code></td>
      <td>
        <button class="btn-sm danger" data-delete-key="${escapeHtml(item.key)}" data-store="${storeType}">Delete</button>
      </td>
    `;

    const deleteBtn = tr.querySelector("[data-delete-key]");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => deleteItem(storeType, item.key));
    }

    container.appendChild(tr);
  });
}

function escapeHtml(str) {
  return CradleEscape.escapeHtml(str);
}

function deleteItem(storeType, key) {
  if (storeType === "local") {
    localStorage.removeItem(key);
  } else if (storeType === "session") {
    sessionStorage.removeItem(key);
  } else if (storeType === "cookies") {
    document.cookie = `${encodeURIComponent(key)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
  refreshAll();
  setStatus(`Deleted entry '${key}' from ${storeType}.`);
}

function clearStorage(storeType) {
  if (storeType === "local") {
    localStorage.clear();
  } else if (storeType === "session") {
    sessionStorage.clear();
  } else if (storeType === "cookies") {
    document.cookie.split(";").forEach(c => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos) : c;
      document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  }
  refreshAll();
  setStatus(`Cleared ${storeType} storage.`);
}

function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const storeType = form.dataset.form;
  const formData = new FormData(form);
  const key = formData.get("key");
  const value = formData.get("value");

  if (!key || value === null) return;

  if (storeType === "local") {
    localStorage.setItem(key, value);
  } else if (storeType === "session") {
    sessionStorage.setItem(key, value);
  } else if (storeType === "cookies") {
    const maxAge = formData.get("maxAge") || 86400;
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/`;
  }

  form.reset();
  refreshAll();
  setStatus(`Saved entry '${key}' to ${storeType}.`);
}

function seedDemoData() {
  localStorage.setItem("cradle_theme", JSON.stringify({ mode: "dark", accent: "#3b82f6" }));
  localStorage.setItem("cradle_user_id", "usr_94812");
  localStorage.setItem("cradle_visited", "true");

  sessionStorage.setItem("draft_note", "Exploring matrix engine and ASCII exporters in Cradle.");
  sessionStorage.setItem("tab_id", "tab_482");

  document.cookie = "demo_session=active_771; path=/";
  document.cookie = "preference_locale=en-US; path=/";

  refreshAll();
  setStatus("Demo storage items seeded successfully.");
}

function exportJSON() {
  if (!exporter) {
    setStatus("Export failed: Storage exporter is unavailable.");
    return;
  }

  try {
    const payload = exporter.exportToJSON(storageState.local, "localStorage");
    downloadFile("storage-export.json", payload, "application/json");
    setStatus("JSON export downloaded successfully.");
  } catch (error) {
    console.error("JSON export error:", error);
    setStatus(`JSON export failed: ${error.message || "Unable to create export."}`);
  }
}

function exportCSV() {
  if (!exporter) {
    setStatus("Export failed: Storage exporter is unavailable.");
    return;
  }

  try {
    const payload = exporter.exportToCSV(storageState.local);
    downloadFile("storage-export.csv", payload, "text/csv");
    setStatus("CSV export downloaded successfully.");
  } catch (error) {
    console.error("CSV export error:", error);
    setStatus(`CSV export failed: ${error.message || "Unable to create export."}`);
  }
}

function downloadFile(filename, content, mimeType) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("File download error:", error);
    throw new Error("Unable to download the exported file.");
  }
}