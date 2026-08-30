"use strict";

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

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ACCEPTED_FILE_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
]);

let cleanedDataset = null;

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
  const isAcceptedMime =
    !file.type || ACCEPTED_FILE_TYPES.has(file.type);

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
    statNodes.beforeRows.textContent = summary.beforeRows;
  }

  if (statNodes.afterRows) {
    statNodes.afterRows.textContent = summary.afterRows;
  }

  if (statNodes.duplicatesRemoved) {
    statNodes.duplicatesRemoved.textContent =
      summary.duplicateRowsRemoved;
  }

  if (statNodes.emptyRowsRemoved) {
    statNodes.emptyRowsRemoved.textContent =
      summary.emptyRowsRemoved;
  }

  if (statNodes.missingValues) {
    statNodes.missingValues.textContent =
      summary.missingValueCount;
  }
}

function renderTable(dataset, missingValues = []) {
  if (!tableWrap || !previewMeta) return;

  if (!dataset || !dataset.headers || !dataset.headers.length) {
    tableWrap.innerHTML =
      `<div class="empty-state">No headers found.</div>`;

    previewMeta.textContent = "No preview available.";
    return;
  }

  const missingKeys = new Set(
    missingValues.map(
      item => `${item.rowIndex}:${item.columnIndex}`
    )
  );

  const visibleRows = dataset.rows.slice(0, 50);

  const rowsHtml = visibleRows
    .map(
      (row, rowIndex) => `
        <tr>
          ${dataset.headers
            .map((_, columnIndex) => {
              const key = `${rowIndex}:${columnIndex}`;
              const missingClass = missingKeys.has(key)
                ? ' class="missing"'
                : "";

              return `<td${missingClass}>${escapeHtml(
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

  tableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          ${dataset.headers
            .map(
              header => `<th>${escapeHtml(header)}</th>`
            )
            .join("")}
        </tr>
      </thead>

      <tbody>
        ${rowsHtml || emptyRowsMessage}
      </tbody>
    </table>
  `;

  const displayedRows = Math.min(
    dataset.rows.length,
    50
  );

  previewMeta.textContent =
    `Showing ${displayedRows} of ${dataset.rows.length} cleaned rows.`;
}

function cleanCsv() {
  try {
    if (!csvInput) {
      throw new Error("CSV input field was not found.");
    }

    const input = csvInput.value.trim();

    if (!input) {
      cleanedDataset = null;

      if (tableWrap) {
        tableWrap.innerHTML =
          `<div class="empty-state">Paste or upload CSV data first.</div>`;
      }

      if (previewMeta) {
        previewMeta.textContent = "No preview available.";
      }

      setMessage(
        "Paste or upload CSV data first.",
        "error"
      );

      return;
    }

    if (
      typeof CsvCleaner === "undefined" ||
      typeof CsvCleaner.analyzeCsv !== "function"
    ) {
      throw new Error(
        "CSV cleaner engine is unavailable."
      );
    }

    const result = CsvCleaner.analyzeCsv(input);

    cleanedDataset = result.dataset;

    updateStats(result.summary);

    renderTable(
      result.dataset,
      result.summary.missingValues
    );

    if (
      result.summary.warnings &&
      result.summary.warnings.length > 0
    ) {
      const remainingCount =
        result.summary.warnings.length - 1;

      const extraText =
        remainingCount > 0
          ? ` (and ${remainingCount} more)`
          : "";

      setMessage(
        `CSV cleaned with warnings: ${result.summary.warnings[0]}${extraText}`,
        "success"
      );
    } else {
      setMessage(
        "CSV cleaned successfully.",
        "success"
      );
    }
  } catch (error) {
    cleanedDataset = null;

    setMessage(
      error?.message || "Unable to clean CSV.",
      "error"
    );
  }
}

function downloadCleanedCsv() {
  try {
    if (!cleanedDataset) {
      cleanCsv();
    }

    if (!cleanedDataset) return;

    if (
      typeof CsvCleaner === "undefined" ||
      typeof CsvCleaner.exportCsv !== "function"
    ) {
      throw new Error(
        "CSV export engine is unavailable."
      );
    }

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

    setMessage(
      "Cleaned CSV downloaded.",
      "success"
    );
  } catch (error) {
    setMessage(
      error?.message || "Unable to download cleaned CSV.",
      "error"
    );
  }
}

if (fileInput) {
  fileInput.addEventListener("change", async () => {
    const file =
      fileInput.files && fileInput.files[0];

    if (!file) return;

    const validationResult =
      validateCsvFile(file);

    /*
     * IMPORTANT:
     * validateCsvFile() returns an object for both
     * valid and invalid files, so we must check
     * .valid instead of checking the object itself.
     */
    if (!validationResult.valid) {
      fileInput.value = "";

      setMessage(
        validationResult.message,
        "error"
      );

      return;
    }

    try {
      const text = await file.text();

      csvInput.value = text;

      setMessage(
        `Loaded ${file.name}.`,
        "success"
      );

      cleanCsv();
    } catch (error) {
      fileInput.value = "";

      setMessage(
        "Unable to read the selected CSV file.",
        "error"
      );
    }
  });
}

if (cleanBtn) {
  cleanBtn.addEventListener("click", cleanCsv);
}

if (downloadBtn) {
  downloadBtn.addEventListener(
    "click",
    downloadCleanedCsv
  );
}

if (loadSampleBtn) {
  loadSampleBtn.addEventListener(
    "click",
    () => {
      if (!csvInput) return;

      csvInput.value = sampleCsv;
      cleanCsv();
    }
  );
}

if (csvInput) {
  csvInput.value = sampleCsv;
}

cleanCsv();