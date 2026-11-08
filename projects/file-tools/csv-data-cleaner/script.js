"use strict";

const csvInput = document.getElementById("csvInput");
const fileInput = document.getElementById("fileInput");
const cleanBtn = document.getElementById("cleanBtn");
const loadSampleBtn = document.getElementById("loadSampleBtn");
const downloadBtn = document.getElementById("downloadBtn");
const downloadJsonBtn = document.getElementById("downloadJsonBtn");
const copyJsonBtn = document.getElementById("copyJsonBtn");
const imputeBtn = document.getElementById("imputeBtn");
const imputeStrategySelect = document.getElementById("imputeStrategySelect");
const normalizeBtn = document.getElementById("normalizeBtn");
const dedupeBtn = document.getElementById("dedupeBtn");
const message = document.getElementById("message");
const tableWrap = document.getElementById("tableWrap");
const previewMeta = document.getElementById("previewMeta");
const columnProfilesWrap = document.getElementById("columnProfilesWrap");

const statNodes = {
  beforeRows: document.getElementById("beforeRows"),
  afterRows: document.getElementById("afterRows"),
  duplicatesRemoved: document.getElementById("duplicatesRemoved"),
  emptyRowsRemoved: document.getElementById("emptyRowsRemoved"),
  missingValues: document.getElementById("missingValues"),
  anomaliesDetected: document.getElementById("anomaliesDetected"),
};

const sampleCsv = `Name, JoinedDate, Department, Salary, IsActive
Asha Rao, 2023-01-15, Engineering, 85000, true
Vikram Shah, 2023-02-20, Design, 72000, true
  Mira Sen  , 2023-03-12, Marketing   Operations, 68000, false
Asha Rao, 2023-01-15, Engineering, 85000, true
Dev Patel, 2023-04-05, Engineering, 920000, yes
Kavita Roy, 2023-05-18, Design, 76000, true
Rohan Das, 2023-06-22, Marketing, , false
Ananya Nair, invalid-date, Engineering, 88000, yes
,,,
Sanjay Gupta, 2023-07-30, Engineering, 91000, 1`;

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ACCEPTED_FILE_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
]);

let cleanedDataset = null;
let currentSummary = null;

function setMessage(text, type = "info") {
  if (!message) return;

  message.textContent = text;
  message.dataset.type = type;
}

function validateCsvFile(file) {
  if (!file) {
    return {
      valid: false,
      message: "Please select a CSV file.",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      message: "The CSV file is too large. Maximum file size is 5 MB.",
    };
  }

  const fileName = String(file.name || "").toLowerCase();
  const isCsvExtension = fileName.endsWith(".csv");

  /*
   * Browsers and operating systems do not always provide
   * a reliable MIME type for CSV files. Therefore, accept
   * an empty MIME type when the file has a .csv extension.
   */
  const isAcceptedMime = !file.type || ACCEPTED_FILE_TYPES.has(file.type);

  if (!isCsvExtension || !isAcceptedMime) {
    return {
      valid: false,
      message: "Invalid file type. Please select a CSV file.",
    };
  }

  return {
    valid: true,
    message: "",
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function updateStats(summary) {
  if (!summary) return;

  if (statNodes.beforeRows) {
    statNodes.beforeRows.textContent = summary.beforeRows ?? 0;
  }

  if (statNodes.afterRows) {
    statNodes.afterRows.textContent = summary.afterRows ?? 0;
  }

  if (statNodes.duplicatesRemoved) {
    statNodes.duplicatesRemoved.textContent = summary.duplicateRowsRemoved ?? 0;
  }

  if (statNodes.emptyRowsRemoved) {
    statNodes.emptyRowsRemoved.textContent = summary.emptyRowsRemoved ?? 0;
  }

  if (statNodes.missingValues) {
    statNodes.missingValues.textContent = summary.missingValueCount ?? 0;
  }

  if (statNodes.anomaliesDetected) {
    statNodes.anomaliesDetected.textContent = summary.anomaliesCount ?? 0;
  }
}

function renderProfiles(profiles, anomalies = []) {
  if (!columnProfilesWrap) return;

  if (!profiles || profiles.length === 0) {
    columnProfilesWrap.innerHTML = `<div class="empty-state">No column profiles available.</div>`;
    return;
  }

  // Count anomalies per column
  const anomalyCountPerCol = new Map();
  anomalies.forEach(a => {
    anomalyCountPerCol.set(a.columnIndex, (anomalyCountPerCol.get(a.columnIndex) || 0) + 1);
  });

  const cardsHtml = profiles.map(profile => {
    const colIdx = profile.columnIndex;
    const typeClass = (profile.inferredType || "string").toLowerCase();
    const anomalyCount = anomalyCountPerCol.get(colIdx) || 0;
    const fillWidth = Math.max(0, 100 - profile.missingPct);
    const hasMissingClass = profile.missingCount > 0 ? " has-missing" : "";

    let statsHtml = "";
    if (profile.inferredType === "Numeric" && profile.stats) {
      statsHtml = `
        <div class="profile-stats-list">
          <span>Min: <strong>${profile.stats.min ?? "—"}</strong></span>
          <span>Max: <strong>${profile.stats.max ?? "—"}</strong></span>
          <span>Mean: <strong>${profile.stats.mean ?? "—"}</strong></span>
          <span>Median: <strong>${profile.stats.median ?? "—"}</strong></span>
        </div>
      `;
    } else {
      statsHtml = `
        <div class="profile-stats-list">
          <span>Distinct: <strong>${profile.uniqueCount}</strong></span>
          <span>Non-empty: <strong>${profile.nonBlankCount}</strong></span>
          <span>Total: <strong>${profile.totalCount}</strong></span>
          <span>Missing: <strong>${profile.missingCount}</strong></span>
        </div>
      `;
    }

    const anomalyTag = anomalyCount > 0
      ? `<span class="profile-anomaly-tag has-anomalies">⚠️ ${anomalyCount} anomaly${anomalyCount > 1 ? "ies" : ""} flagged</span>`
      : `<span class="profile-anomaly-tag clean">✓ Clean</span>`;

    return `
      <article class="profile-card" aria-label="Profile for column ${escapeHtml(profile.header)}">
        <div class="profile-card-header">
          <span class="profile-col-name" title="${escapeHtml(profile.header)}">${escapeHtml(profile.header)}</span>
          <span class="type-badge ${typeClass}">${escapeHtml(profile.inferredType)}</span>
        </div>

        <div class="profile-meter-wrap">
          <div class="profile-meter-labels">
            <span>Completeness</span>
            <span>${Math.round(fillWidth)}% (${profile.missingCount} missing)</span>
          </div>
          <div class="profile-meter-bar">
            <div class="profile-meter-fill${hasMissingClass}" style="width: ${fillWidth}%"></div>
          </div>
        </div>

        ${statsHtml}

        <div>
          ${anomalyTag}
        </div>
      </article>
    `;
  }).join("");

  columnProfilesWrap.innerHTML = cardsHtml;
}

function renderTable(dataset, missingValues = [], anomalies = [], profiles = []) {
  if (!tableWrap || !previewMeta) return;

  if (!dataset || !dataset.headers || !dataset.headers.length) {
    tableWrap.innerHTML = `<div class="empty-state">No headers found.</div>`;
    previewMeta.textContent = "No preview available.";
    return;
  }

  const missingKeys = new Set(
    missingValues.map(item => `${item.rowIndex}:${item.columnIndex}`)
  );

  // Map of "row:col" to anomaly
  const anomalyMap = new Map();
  anomalies.forEach(item => {
    anomalyMap.set(`${item.rowIndex}:${item.columnIndex}`, item);
  });

  const profileMap = new Map();
  profiles.forEach(p => {
    profileMap.set(p.columnIndex, p);
  });

  const visibleRows = dataset.rows.slice(0, 50);

  const rowsHtml = visibleRows
    .map(
      (row, rowIndex) => `
        <tr>
          ${dataset.headers
            .map((_, columnIndex) => {
              const key = `${rowIndex}:${columnIndex}`;
              const isMissing = missingKeys.has(key);
              const anomaly = anomalyMap.get(key);

              let cellClass = "";
              let titleAttr = "";

              if (isMissing) {
                cellClass = ' class="missing"';
                titleAttr = ' title="Missing value"';
              } else if (anomaly) {
                if (anomaly.type === "outlier") {
                  cellClass = ' class="anomaly-outlier"';
                } else if (anomaly.type === "whitespace") {
                  cellClass = ' class="anomaly-whitespace"';
                } else if (anomaly.type === "mixed_format") {
                  cellClass = ' class="anomaly-mixed"';
                }
                titleAttr = ` title="${escapeHtml(anomaly.description)}"`;
              }

              return `<td${cellClass}${titleAttr}>${escapeHtml(
                row[columnIndex] ?? ""
              )}</td>`;
            })
            .join("")}
        </tr>
      `
    )
    .join("");

  const emptyRowsMessage = `
    <tr>
      <td colspan="${dataset.headers.length}">
        No data rows found.
      </td>
    </tr>
  `;

  const headersHtml = dataset.headers.map((header, colIdx) => {
    const prof = profileMap.get(colIdx);
    const typeLabel = prof ? prof.inferredType : "String";
    const typeClass = typeLabel.toLowerCase();

    return `
      <th>
        <div class="th-content">
          <span>${escapeHtml(header)}</span>
          <span class="type-badge ${typeClass}">${escapeHtml(typeLabel)}</span>
        </div>
      </th>
    `;
  }).join("");

  tableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          ${headersHtml}
        </tr>
      </thead>

      <tbody>
        ${rowsHtml || emptyRowsMessage}
      </tbody>
    </table>
  `;

  const displayedRows = Math.min(dataset.rows.length, 50);
  previewMeta.textContent = `Showing ${displayedRows} of ${dataset.rows.length} rows (${dataset.headers.length} columns, ${anomalies.length} anomalies flagged).`;
}

function cleanCsv() {
  try {
    if (!csvInput) {
      throw new Error("CSV input field was not found.");
    }

    const input = csvInput.value.trim();

    if (!input) {
      cleanedDataset = null;
      currentSummary = null;

      if (tableWrap) {
        tableWrap.innerHTML = `<div class="empty-state">Paste or upload CSV data first.</div>`;
      }

      if (columnProfilesWrap) {
        columnProfilesWrap.innerHTML = `<div class="empty-state">Paste or upload CSV data first.</div>`;
      }

      if (previewMeta) {
        previewMeta.textContent = "No preview available.";
      }

      setMessage("Paste or upload CSV data first.", "error");
      return;
    }

    if (
      typeof CsvCleaner === "undefined" ||
      typeof CsvCleaner.analyzeCsv !== "function"
    ) {
      throw new Error("CSV cleaner engine is unavailable.");
    }

    const result = CsvCleaner.analyzeCsv(input);

    cleanedDataset = result.dataset;
    currentSummary = result.summary;

    updateStats(result.summary);
    renderProfiles(result.summary.profiles, result.summary.anomalies);
    renderTable(
      result.dataset,
      result.summary.missingValues,
      result.summary.anomalies,
      result.summary.profiles
    );

    if (result.summary.warnings && result.summary.warnings.length > 0) {
      const remainingCount = result.summary.warnings.length - 1;
      const extraText =
        remainingCount > 0 ? ` (and ${remainingCount} more)` : "";

      setMessage(
        `CSV analyzed & cleaned with warnings: ${result.summary.warnings[0]}${extraText}`,
        "success"
      );
    } else {
      const anomalyNote = result.summary.anomaliesCount > 0
        ? ` (${result.summary.anomaliesCount} anomalies flagged)`
        : "";
      setMessage(`CSV cleaned & profiled successfully${anomalyNote}.`, "success");
    }
  } catch (error) {
    cleanedDataset = null;
    currentSummary = null;
    setMessage(error?.message || "Unable to clean CSV.", "error");
  }
}

// =========================================================
// ONE-CLICK BATCH TRANSFORMATIONS & EXPORT
// =========================================================

function applyImputation() {
  if (!cleanedDataset) {
    cleanCsv();
  }
  if (!cleanedDataset) return;

  const strategy = (imputeStrategySelect && imputeStrategySelect.value) || "auto";
  const result = CsvCleaner.imputeMissingValues(cleanedDataset, { strategy });

  cleanedDataset = result.dataset;
  if (csvInput) {
    csvInput.value = CsvCleaner.exportCsv(cleanedDataset);
  }

  cleanCsv();
  setMessage(
    `Imputed ${result.imputedCount} missing cell(s) using '${strategy}' strategy.`,
    "success"
  );
}

function applyNormalization() {
  if (!cleanedDataset) {
    cleanCsv();
  }
  if (!cleanedDataset) return;

  const result = CsvCleaner.normalizeTextCells(cleanedDataset);

  cleanedDataset = result.dataset;
  if (csvInput) {
    csvInput.value = CsvCleaner.exportCsv(cleanedDataset);
  }

  cleanCsv();
  setMessage(
    `Normalized text in ${result.modifiedCount} cell(s) (whitespace collapsed & trimmed).`,
    "success"
  );
}

function applyDeduplication() {
  if (!cleanedDataset) {
    cleanCsv();
  }
  if (!cleanedDataset) return;

  const beforeCount = cleanedDataset.rows.length;
  cleanedDataset = CsvCleaner.removeDuplicateRows(cleanedDataset);
  const removed = beforeCount - cleanedDataset.rows.length;

  if (csvInput) {
    csvInput.value = CsvCleaner.exportCsv(cleanedDataset);
  }

  cleanCsv();
  setMessage(`Deduplicated dataset: removed ${removed} duplicate row(s).`, "success");
}

function downloadCleanedCsv() {
  try {
    if (!cleanedDataset) {
      cleanCsv();
    }
    if (!cleanedDataset) return;

    const csv = CsvCleaner.exportCsv(cleanedDataset);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "cleaned-data.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setMessage("Cleaned CSV downloaded.", "success");
  } catch (error) {
    setMessage(error?.message || "Unable to download cleaned CSV.", "error");
  }
}

function downloadCleanedJson() {
  try {
    if (!cleanedDataset) {
      cleanCsv();
    }
    if (!cleanedDataset) return;

    const json = CsvCleaner.exportJson(cleanedDataset, { typed: true, indent: 2 });
    const blob = new Blob([json], {
      type: "application/json;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "cleaned-data.json";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setMessage("Cleaned JSON dataset downloaded.", "success");
  } catch (error) {
    setMessage(error?.message || "Unable to download JSON.", "error");
  }
}

async function copyCleanedJson() {
  try {
    if (!cleanedDataset) {
      cleanCsv();
    }
    if (!cleanedDataset) return;

    const json = CsvCleaner.exportJson(cleanedDataset, { typed: true, indent: 2 });

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(json);
      if (copyJsonBtn) {
        copyJsonBtn.textContent = "✓ Copied JSON!";
        setTimeout(() => {
          if (copyJsonBtn) copyJsonBtn.textContent = "Copy JSON";
        }, 1400);
      }
      setMessage("Cleaned JSON copied to clipboard.", "success");
    }
  } catch {
    setMessage("Unable to copy JSON to clipboard.", "error");
  }
}

// Event Listeners Wiring
if (fileInput) {
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];

    if (!file) return;

    const validationResult = validateCsvFile(file);

    /*
     * IMPORTANT:
     * validateCsvFile() returns an object for both
     * valid and invalid files, so we must check
     * .valid instead of checking the object itself.
     */
    if (!validationResult.valid) {
      fileInput.value = "";
      setMessage(validationResult.message, "error");
      return;
    }

    try {
      const text = await file.text();
      csvInput.value = text;
      setMessage(`Loaded ${file.name}.`, "success");
      cleanCsv();
    } catch (error) {
      fileInput.value = "";
      setMessage("Unable to read the selected CSV file.", "error");
    }
  });
}

if (cleanBtn) cleanBtn.addEventListener("click", cleanCsv);
if (downloadBtn) downloadBtn.addEventListener("click", downloadCleanedCsv);
if (downloadJsonBtn) downloadJsonBtn.addEventListener("click", downloadCleanedJson);
if (copyJsonBtn) copyJsonBtn.addEventListener("click", copyCleanedJson);
if (imputeBtn) imputeBtn.addEventListener("click", applyImputation);
if (normalizeBtn) normalizeBtn.addEventListener("click", applyNormalization);
if (dedupeBtn) dedupeBtn.addEventListener("click", applyDeduplication);

if (loadSampleBtn) {
  loadSampleBtn.addEventListener("click", () => {
    if (!csvInput) return;
    csvInput.value = sampleCsv;
    cleanCsv();
  });
}

if (csvInput) {
  csvInput.value = sampleCsv;
}

cleanCsv();
