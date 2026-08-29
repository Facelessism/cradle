const csvInput = document.getElementById("csvInput");
const fileInput = document.getElementById("fileInput");
const cleanBtn = document.getElementById("cleanBtn");
const loadSampleBtn = document.getElementById("loadSampleBtn");
const downloadBtn = document.getElementById("downloadBtn");
const message = document.getElementById("message");
const tableWrap = document.getElementById("tableWrap");
const previewMeta = document.getElementById("previewMeta");

const statNodes = {
  beforeRows: document.getElementById("beforeRows"),
  afterRows: document.getElementById("afterRows"),
  duplicatesRemoved: document.getElementById("duplicatesRemoved"),
  emptyRowsRemoved: document.getElementById("emptyRowsRemoved"),
  missingValues: document.getElementById("missingValues"),
};

const sampleCsv = `Name, Email, Role, City
  Asha Rao , asha@example.com , Developer , Pune
Vikram Shah, vikram@example.com, Designer, Mumbai
,,,
Asha Rao , asha@example.com , Developer , Pune
Mira Sen,, Analyst, Bengaluru
"Patel, Dev",dev.patel@example.com,Engineer,Ahmedabad`;

let cleanedDataset = null;

function setMessage(text, type = "info") {
  message.textContent = text;
  message.dataset.type = type;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function updateStats(summary) {
  statNodes.beforeRows.textContent = summary.beforeRows;
  statNodes.afterRows.textContent = summary.afterRows;
  statNodes.duplicatesRemoved.textContent = summary.duplicateRowsRemoved;
  statNodes.emptyRowsRemoved.textContent = summary.emptyRowsRemoved;
  statNodes.missingValues.textContent = summary.missingValueCount;
}

function renderTable(dataset, missingValues) {
  if (!dataset.headers.length) {
    tableWrap.innerHTML = `<div class="empty-state">No headers found.</div>`;
    previewMeta.textContent = "No preview available.";
    return;
  }

  const missingKeys = new Set(
    missingValues.map(item => `${item.rowIndex}:${item.columnIndex}`)
  );

  const rowsHtml = dataset.rows
    .slice(0, 50)
    .map((row, rowIndex) => `
      <tr>
        ${dataset.headers.map((_, columnIndex) => {
          const key = `${rowIndex}:${columnIndex}`;
          const missingClass = missingKeys.has(key) ? " class=\"missing\"" : "";
          return `<td${missingClass}>${escapeHtml(row[columnIndex] || "")}</td>`;
        }).join("")}
      </tr>
    `)
    .join("");

  tableWrap.innerHTML = `
    <table>
      <thead>
        <tr>${dataset.headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>${rowsHtml || `<tr><td colspan="${dataset.headers.length}">No data rows found.</td></tr>`}</tbody>
    </table>
  `;

  previewMeta.textContent = `Showing ${Math.min(dataset.rows.length, 50)} of ${dataset.rows.length} cleaned rows.`;
}

function cleanCsv() {
  try {
    const input = csvInput.value.trim();
    if (!input) {
      cleanedDataset = null;
      tableWrap.innerHTML = `<div class="empty-state">Paste or upload CSV data first.</div>`;
      previewMeta.textContent = "No preview available.";
      setMessage("Paste or upload CSV data first.", "error");
      return;
    }

    const result = CsvCleaner.analyzeCsv(input);
    cleanedDataset = result.dataset;
    updateStats(result.summary);
    renderTable(result.dataset, result.summary.missingValues);
    if (result.summary.warnings && result.summary.warnings.length > 0) {
      const remainingCount = result.summary.warnings.length - 1;
      const extraText = remainingCount > 0 ? ` (and ${remainingCount} more)` : "";
      setMessage(`CSV cleaned with warnings: ${result.summary.warnings[0]}${extraText}`, "success");
    } else {
      setMessage("CSV cleaned successfully.", "success");
    }
  } catch (error) {
    cleanedDataset = null;
    setMessage(error.message || "Unable to clean CSV.", "error");
  }
}

function downloadCleanedCsv() {
  if (!cleanedDataset) {
    cleanCsv();
  }

  if (!cleanedDataset) return;

  const blob = new Blob([CsvCleaner.exportCsv(cleanedDataset)], {
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
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  csvInput.value = await file.text();
  setMessage(`Loaded ${file.name}.`, "success");
  cleanCsv();
});

cleanBtn.addEventListener("click", cleanCsv);
downloadBtn.addEventListener("click", downloadCleanedCsv);
loadSampleBtn.addEventListener("click", () => {
  csvInput.value = sampleCsv;
  cleanCsv();
});

csvInput.value = sampleCsv;
cleanCsv();
