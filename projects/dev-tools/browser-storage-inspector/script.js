const engine = window.StorageEngine;
const exporter = window.StorageExporter;

const storageState = {
  local: [],
  session: [],
  cookies: [],
  indexed: [],
  indexedDatabases: [],
  activeTab: "local",
  typeFilter: "all",
  selectedDb: "",
  selectedStore: "",
};

const elements = {
  searchInput: document.getElementById("searchInput"),
  typeFilterSelect: document.getElementById("typeFilterSelect"),
  refreshBtn: document.getElementById("refreshBtn"),
  seedBtn: document.getElementById("seedBtn"),
  exportUnifiedJsonBtn: document.getElementById("exportUnifiedJsonBtn"),
  exportUnifiedCsvBtn: document.getElementById("exportUnifiedCsvBtn"),
  exportJsonBtn: document.getElementById("exportJsonBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  importBtn: document.getElementById("importBtn"),
  importFileInput: document.getElementById("importFileInput"),
  statusMessage: document.getElementById("statusMessage"),

  // Quota Dashboard elements
  quota: {
    dashboard: document.getElementById("quotaDashboard"),
    statusPill: document.getElementById("quotaStatusPill"),
    meta: document.getElementById("quotaMeta"),
    percent: document.getElementById("quotaPercent"),
    progressBar: document.getElementById("quotaProgressBar"),
    progressFill: document.getElementById("quotaProgressFill"),
    usedVal: document.getElementById("quotaUsedVal"),
    remainingVal: document.getElementById("quotaRemainingVal"),
    totalVal: document.getElementById("quotaTotalVal"),
    healthVal: document.getElementById("quotaHealthVal"),
  },

  // IndexedDB controls
  indexed: {
    loadBtn: document.getElementById("loadIndexedBtn"),
    deleteDbBtn: document.getElementById("deleteDbBtn"),
    dbSelect: document.getElementById("dbSelect"),
    storeSelect: document.getElementById("storeSelect"),
    hint: document.getElementById("indexedHint"),
  },

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

  if (elements.refreshBtn)
    elements.refreshBtn.addEventListener("click", refreshAll);
  if (elements.seedBtn)
    elements.seedBtn.addEventListener("click", seedDemoData);

  // Unified exports
  if (elements.exportUnifiedJsonBtn) {
    elements.exportUnifiedJsonBtn.addEventListener("click", exportUnifiedJSON);
  }
  if (elements.exportUnifiedCsvBtn) {
    elements.exportUnifiedCsvBtn.addEventListener("click", exportUnifiedCSV);
  }

  // Active store exports
  if (elements.exportJsonBtn)
    elements.exportJsonBtn.addEventListener("click", exportActiveJSON);
  if (elements.exportCsvBtn)
    elements.exportCsvBtn.addEventListener("click", exportActiveCSV);

  // Import trigger
  if (elements.importBtn && elements.importFileInput) {
    elements.importBtn.addEventListener("click", () =>
      elements.importFileInput.click()
    );
    elements.importFileInput.addEventListener("change", handleImportFile);
  }

  // IndexedDB controls
  if (elements.indexed.loadBtn) {
    elements.indexed.loadBtn.addEventListener("click", loadIndexedDBData);
  }
  if (elements.indexed.deleteDbBtn) {
    elements.indexed.deleteDbBtn.addEventListener("click", deleteSelectedDb);
  }
  if (elements.indexed.dbSelect) {
    elements.indexed.dbSelect.addEventListener("change", e => {
      storageState.selectedDb = e.target.value;
      updateStoreSelectDropdown();
      renderAll();
    });
  }
  if (elements.indexed.storeSelect) {
    elements.indexed.storeSelect.addEventListener("change", e => {
      storageState.selectedStore = e.target.value;
      renderAll();
    });
  }

  if (elements.searchInput)
    elements.searchInput.addEventListener("input", renderAll);
  if (elements.typeFilterSelect) {
    elements.typeFilterSelect.addEventListener("change", e => {
      storageState.typeFilter = e.target.value;
      renderAll();
    });
  }

  refreshAll();
}

async function refreshAll() {
  if (engine) {
    const localData = engine.readWebStorage("localStorage");
    const sessionData = engine.readWebStorage("sessionStorage");
    const cookieData = engine.readCookies();

    storageState.local = localData.items;
    storageState.session = sessionData.items;
    storageState.cookies = cookieData.items;

    // Load IndexedDB asynchronously
    await loadIndexedDBData();

    // Update Storage Quota Usage Dashboard
    await updateQuotaDashboard();
  }
  renderAll();
  setStatus("Storage and quota metrics refreshed.");
}

async function updateQuotaDashboard() {
  if (!engine || !engine.getStorageQuotaEstimate) return;
  const q = elements.quota;
  if (!q.dashboard) return;

  const estimate = await engine.getStorageQuotaEstimate();

  if (estimate.supported) {
    const pct = estimate.percentUsed;
    if (q.progressBar) {
      q.progressBar.setAttribute("aria-valuenow", String(pct));
    }
    if (q.progressFill) {
      q.progressFill.style.width = `${Math.max(1, pct)}%`;
      q.progressFill.classList.remove("warning", "danger");
      if (pct >= 90) {
        q.progressFill.classList.add("danger");
      } else if (pct >= 70) {
        q.progressFill.classList.add("warning");
      }
    }

    if (q.percent) q.percent.textContent = `${pct}%`;
    if (q.statusPill) {
      q.statusPill.textContent =
        pct >= 90 ? "Critical" : pct >= 70 ? "Elevated" : "Optimal";
    }
    if (q.usedVal) q.usedVal.textContent = estimate.formattedUsage;
    if (q.remainingVal) q.remainingVal.textContent = estimate.formattedRemaining;
    if (q.totalVal) q.totalVal.textContent = estimate.formattedQuota;

    if (q.healthVal) {
      q.healthVal.className = "stat-value";
      if (pct >= 90) {
        q.healthVal.classList.add("health-critical");
        q.healthVal.textContent = "Critical (>90%)";
      } else if (pct >= 70) {
        q.healthVal.classList.add("health-warning");
        q.healthVal.textContent = "Elevated (>70%)";
      } else {
        q.healthVal.classList.add("health-optimal");
        q.healthVal.textContent = "Optimal (<70%)";
      }
    }

    if (q.meta) {
      q.meta.textContent = `Using ${estimate.formattedUsage} of ${estimate.formattedQuota} allocated origin quota.`;
    }
  } else {
    if (q.percent) q.percent.textContent = "N/A";
    if (q.statusPill) q.statusPill.textContent = "Unmetered";
    if (q.usedVal) q.usedVal.textContent = "Unmetered";
    if (q.remainingVal) q.remainingVal.textContent = "Unmetered";
    if (q.totalVal) q.totalVal.textContent = "Unmetered";
    if (q.healthVal) {
      q.healthVal.className = "stat-value";
      q.healthVal.textContent = "Available";
    }
    if (q.meta) {
      q.meta.textContent =
        "Storage quota estimation is unavailable in this environment.";
    }
    if (q.progressFill) q.progressFill.style.width = "0%";
  }
}

async function loadIndexedDBData() {
  if (!engine || !engine.readAllIndexedDB) return;
  try {
    const idbData = await engine.readAllIndexedDB();
    storageState.indexed = idbData.items || [];
    storageState.indexedDatabases = idbData.databases || [];

    updateDbSelectDropdown();
    updateStoreSelectDropdown();
  } catch (err) {
    console.warn("Failed to inspect IndexedDB:", err);
  }
}

function updateDbSelectDropdown() {
  const dbSelect = elements.indexed.dbSelect;
  if (!dbSelect) return;

  const currentVal = storageState.selectedDb || dbSelect.value;
  dbSelect.innerHTML = '<option value="">All Databases</option>';

  storageState.indexedDatabases.forEach(db => {
    const opt = document.createElement("option");
    opt.value = db.name;
    opt.textContent = db.name;
    if (db.name === currentVal) opt.selected = true;
    dbSelect.appendChild(opt);
  });
}

function updateStoreSelectDropdown() {
  const storeSelect = elements.indexed.storeSelect;
  if (!storeSelect) return;

  const currentVal = storageState.selectedStore || storeSelect.value;
  storeSelect.innerHTML = '<option value="">All Object Stores</option>';

  const activeDbName = storageState.selectedDb;
  const targetDb = storageState.indexedDatabases.find(
    d => d.name === activeDbName
  );

  if (targetDb && targetDb.stores) {
    Object.keys(targetDb.stores).forEach(sName => {
      const opt = document.createElement("option");
      opt.value = sName;
      opt.textContent = sName;
      if (sName === currentVal) opt.selected = true;
      storeSelect.appendChild(opt);
    });
  } else if (!activeDbName) {
    const allStores = new Set();
    storageState.indexedDatabases.forEach(db => {
      if (db.stores) Object.keys(db.stores).forEach(s => allStores.add(s));
    });
    allStores.forEach(sName => {
      const opt = document.createElement("option");
      opt.value = sName;
      opt.textContent = sName;
      if (sName === currentVal) opt.selected = true;
      storeSelect.appendChild(opt);
    });
  }
}

function setStatus(msg) {
  if (elements.statusMessage) {
    elements.statusMessage.textContent = msg;
  }
}

function showPanel(panelId) {
  storageState.activeTab = panelId;
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

  const filteredLocal = engine
    ? engine.filterItems(storageState.local, query, typeFilter)
    : storageState.local;
  const filteredSession = engine
    ? engine.filterItems(storageState.session, query, typeFilter)
    : storageState.session;
  const filteredCookies = engine
    ? engine.filterItems(storageState.cookies, query, typeFilter)
    : storageState.cookies;

  let indexedList = storageState.indexed;
  if (storageState.selectedDb) {
    indexedList = indexedList.filter(
      item => item.db === storageState.selectedDb
    );
  }
  if (storageState.selectedStore) {
    indexedList = indexedList.filter(
      item => item.store === storageState.selectedStore
    );
  }
  const filteredIndexed = engine
    ? engine.filterItems(indexedList, query, typeFilter)
    : indexedList;

  if (elements.counts.local)
    elements.counts.local.textContent = storageState.local.length;
  if (elements.counts.session)
    elements.counts.session.textContent = storageState.session.length;
  if (elements.counts.cookies)
    elements.counts.cookies.textContent = storageState.cookies.length;
  if (elements.counts.indexed)
    elements.counts.indexed.textContent = storageState.indexed.length;

  renderRows(elements.rows.local, filteredLocal, "local");
  renderRows(elements.rows.session, filteredSession, "session");
  renderRows(elements.rows.cookies, filteredCookies, "cookies");
  renderIndexedRows(elements.rows.indexed, filteredIndexed);
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
      deleteBtn.addEventListener("click", () =>
        deleteItem(storeType, item.key)
      );
    }

    container.appendChild(tr);
  });
}

function renderIndexedRows(container, items) {
  if (!container) return;
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<tr><td colspan="4" class="empty-cell">No IndexedDB records found.</td></tr>`;
    return;
  }

  items.forEach(item => {
    const tr = document.createElement("tr");
    const valPreview =
      typeof item.value === "object"
        ? JSON.stringify(item.value)
        : String(item.value);

    tr.innerHTML = `
      <td><strong>${escapeHtml(item.db)}</strong> / <em>${escapeHtml(item.store)}</em></td>
      <td><strong>${escapeHtml(String(item.key))}</strong></td>
      <td><code class="val-preview">${escapeHtml(valPreview)}</code></td>
      <td>
        <button class="btn-sm danger" data-delete-idb-key="${escapeHtml(String(item.key))}" data-db="${escapeHtml(item.db)}" data-store="${escapeHtml(item.store)}">Delete</button>
      </td>
    `;

    const deleteBtn = tr.querySelector("[data-delete-idb-key]");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () =>
        deleteIndexedItem(item.db, item.store, item.key)
      );
    }

    container.appendChild(tr);
  });
}

function escapeHtml(str) {
  if (
    typeof CradleEscape !== "undefined" &&
    typeof CradleEscape.escapeHtml === "function"
  ) {
    return CradleEscape.escapeHtml(str);
  }
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function deleteIndexedItem(dbName, storeName, key) {
  if (typeof indexedDB === "undefined") return;
  const req = indexedDB.open(dbName);
  req.onsuccess = () => {
    const db = req.result;
    try {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => {
        db.close();
        refreshAll();
        setStatus(
          `Deleted IndexedDB record '${key}' from ${dbName}/${storeName}.`
        );
      };
    } catch (err) {
      db.close();
      setStatus(`Failed to delete record: ${err.message}`);
    }
  };
}

function deleteSelectedDb() {
  const dbName =
    storageState.selectedDb ||
    (elements.indexed.dbSelect && elements.indexed.dbSelect.value);
  if (!dbName) {
    setStatus("Please select a specific database to delete.");
    return;
  }

  if (typeof indexedDB === "undefined") return;
  const req = indexedDB.deleteDatabase(dbName);
  req.onsuccess = () => {
    storageState.selectedDb = "";
    refreshAll();
    setStatus(`Database '${dbName}' was successfully deleted.`);
  };
  req.onerror = () => {
    setStatus(`Failed to delete database '${dbName}'.`);
  };
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

  if (storeType === "indexed") {
    saveIndexedRecord(key, value);
    form.reset();
    return;
  }

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

function saveIndexedRecord(key, valueStr) {
  const dbName =
    storageState.selectedDb ||
    (elements.indexed.dbSelect && elements.indexed.dbSelect.value) ||
    "CradleDB";
  const storeName =
    storageState.selectedStore ||
    (elements.indexed.storeSelect && elements.indexed.storeSelect.value) ||
    "custom_store";

  let parsedVal = valueStr;
  try {
    parsedVal = JSON.parse(valueStr);
  } catch {
    // Keep as string
  }

  if (typeof indexedDB === "undefined") {
    setStatus("IndexedDB is unavailable in this environment.");
    return;
  }

  const openReq = indexedDB.open(dbName);
  openReq.onsuccess = () => {
    const db = openReq.result;
    if (!db.objectStoreNames.contains(storeName)) {
      const newVersion = db.version + 1;
      db.close();
      const upgradeReq = indexedDB.open(dbName, newVersion);
      upgradeReq.onupgradeneeded = ev => {
        ev.target.result.createObjectStore(storeName);
      };
      upgradeReq.onsuccess = () => {
        writeRecord(upgradeReq.result, storeName, key, parsedVal);
      };
    } else {
      writeRecord(db, storeName, key, parsedVal);
    }
  };
}

function writeRecord(db, storeName, key, value) {
  try {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    if (key) {
      store.put(value, key);
    } else {
      store.put(value);
    }
    tx.oncomplete = () => {
      db.close();
      refreshAll();
      setStatus(`Saved record to IndexedDB: ${storeName}`);
    };
  } catch (err) {
    db.close();
    setStatus(`Failed to write IndexedDB record: ${err.message}`);
  }
}

function seedDemoData() {
  localStorage.setItem(
    "cradle_theme",
    JSON.stringify({ mode: "dark", accent: "#3b82f6" })
  );
  localStorage.setItem("cradle_user_id", "usr_94812");
  localStorage.setItem("cradle_visited", "true");

  sessionStorage.setItem(
    "draft_note",
    "Exploring matrix engine and ASCII exporters in Cradle."
  );
  sessionStorage.setItem("tab_id", "tab_482");

  document.cookie = "demo_session=active_771; path=/";
  document.cookie = "preference_locale=en-US; path=/";

  // Seed sample record into IndexedDB CradleDB
  saveIndexedRecord("sample_meta", '{"app":"Cradle","author":"Facelessism"}');

  refreshAll();
  setStatus("Demo storage items seeded successfully across all stores.");
}

/* ── Unified JSON Export ── */
function exportUnifiedJSON() {
  if (!exporter || !exporter.exportUnifiedJSON) {
    setStatus("Export failed: Unified exporter is unavailable.");
    return;
  }

  try {
    const storesData = {
      localStorage: storageState.local,
      sessionStorage: storageState.session,
      cookies: storageState.cookies,
      indexedDB: storageState.indexed,
      indexedDatabases: storageState.indexedDatabases,
    };
    const payload = exporter.exportUnifiedJSON(storesData);
    downloadFile(
      "cradle-unified-storage-backup.json",
      payload,
      "application/json"
    );
    setStatus(
      "Unified JSON backup downloaded (LocalStorage, SessionStorage, Cookies & IndexedDB)."
    );
  } catch (error) {
    console.error("Unified export error:", error);
    setStatus(`Unified export failed: ${error.message}`);
  }
}

/* ── Unified CSV Export ── */
function exportUnifiedCSV() {
  if (!exporter || !exporter.exportUnifiedCSV) {
    setStatus("Export failed: Unified CSV exporter is unavailable.");
    return;
  }

  try {
    const storesData = {
      localStorage: storageState.local,
      sessionStorage: storageState.session,
      cookies: storageState.cookies,
      indexedDB: storageState.indexed,
    };
    const payload = exporter.exportUnifiedCSV(storesData);
    downloadFile("cradle-unified-storage-backup.csv", payload, "text/csv");
    setStatus("Unified CSV backup table downloaded.");
  } catch (error) {
    console.error("Unified CSV error:", error);
    setStatus(`Unified CSV failed: ${error.message}`);
  }
}

/* ── Active Store JSON Export ── */
function exportActiveJSON() {
  if (!exporter) return;
  const storeType = storageState.activeTab;
  let items = [];
  if (storeType === "local") items = storageState.local;
  else if (storeType === "session") items = storageState.session;
  else if (storeType === "cookies") items = storageState.cookies;
  else if (storeType === "indexed") items = storageState.indexed;

  try {
    const payload = exporter.exportToJSON(items, storeType);
    downloadFile(`storage-export-${storeType}.json`, payload, "application/json");
    setStatus(`Exported JSON for ${storeType}.`);
  } catch (error) {
    setStatus(`Export failed: ${error.message}`);
  }
}

/* ── Active Store CSV Export ── */
function exportActiveCSV() {
  if (!exporter) return;
  const storeType = storageState.activeTab;
  let items = [];
  if (storeType === "local") items = storageState.local;
  else if (storeType === "session") items = storageState.session;
  else if (storeType === "cookies") items = storageState.cookies;
  else if (storeType === "indexed") items = storageState.indexed;

  try {
    const payload = exporter.exportToCSV(items);
    downloadFile(`storage-export-${storeType}.csv`, payload, "text/csv");
    setStatus(`Exported CSV for ${storeType}.`);
  } catch (error) {
    setStatus(`Export failed: ${error.message}`);
  }
}

/* ── Unified Import Handler ── */
async function handleImportFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const reader = new FileReader();
    reader.onload = async e => {
      const content = e.target.result;
      const validation = exporter.validateUnifiedImport(content);

      if (!validation.valid) {
        setStatus(`Import failed: ${validation.error}`);
        return;
      }

      setStatus(`Restoring backup (${validation.stats.totalItems} items)...`);
      const res = await exporter.restoreUnifiedStorage(validation.data, {
        overwrite: true,
      });

      if (res.success) {
        setStatus(
          `Successfully restored ${res.restored.total} items (${res.restored.localStorage} LocalStorage, ${res.restored.sessionStorage} SessionStorage, ${res.restored.indexedDB} IndexedDB).`
        );
      } else {
        setStatus(
          `Restored with warnings: ${res.errors.join("; ") || "Some items were skipped."}`
        );
      }

      // Reset file input so same file can be re-imported
      event.target.value = "";
      refreshAll();
    };

    reader.readAsText(file);
  } catch (error) {
    setStatus(`Failed to read backup file: ${error.message}`);
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
