document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const textInputA = document.getElementById("textInputA");
  const textInputB = document.getElementById("textInputB");
  const fileInputA = document.getElementById("fileInputA");
  const fileInputB = document.getElementById("fileInputB");
  const fileInfoA = document.getElementById("fileInfoA");
  const fileInfoB = document.getElementById("fileInfoB");

  const sideBySideBtn = document.getElementById("sideBySideBtn");
  const unifiedBtn = document.getElementById("unifiedBtn");
  const clearBtn = document.getElementById("clearBtn");
  const demoBtn = document.getElementById("demoBtn");
  const exportPatchBtn = document.getElementById("exportPatchBtn");

  const ignoreWhitespace = document.getElementById("ignoreWhitespace");
  const ignoreCase = document.getElementById("ignoreCase");

  const sideBySideView = document.getElementById("sideBySideView");
  const unifiedView = document.getElementById("unifiedView");
  const originalContent = document.getElementById("originalContent");
  const modifiedContent = document.getElementById("modifiedContent");
  const unifiedContent = document.getElementById("unifiedContent");
  const diffStatus = document.getElementById("diffStatus");

  const paneOriginal = originalContent.parentElement;
  const paneModified = modifiedContent.parentElement;

  // Sync scroll between side-by-side panes
  let isSyncingScroll = false;
  paneOriginal.addEventListener("scroll", () => {
    if (!isSyncingScroll) {
      isSyncingScroll = true;
      paneModified.scrollTop = paneOriginal.scrollTop;
      paneModified.scrollLeft = paneOriginal.scrollLeft;
      isSyncingScroll = false;
    }
  });

  paneModified.addEventListener("scroll", () => {
    if (!isSyncingScroll) {
      isSyncingScroll = true;
      paneOriginal.scrollTop = paneModified.scrollTop;
      paneOriginal.scrollLeft = paneModified.scrollLeft;
      isSyncingScroll = false;
    }
  });

  // View mode handlers
  sideBySideBtn.addEventListener("click", () => {
    sideBySideBtn.classList.add("active");
    unifiedBtn.classList.remove("active");
    sideBySideView.classList.remove("hidden");
    unifiedView.classList.add("hidden");
  });

  unifiedBtn.addEventListener("click", () => {
    unifiedBtn.classList.add("active");
    sideBySideBtn.classList.remove("active");
    unifiedView.classList.remove("hidden");
    sideBySideView.classList.add("hidden");
  });

  // Render Diff Output using DiffEngine
  function renderDiff() {
    const textA = textInputA.value;
    const textB = textInputB.value;

    if (!textA && !textB) {
      originalContent.innerHTML = "";
      modifiedContent.innerHTML = "";
      unifiedContent.innerHTML = "";
      diffStatus.textContent = "Paste or load files to see differences";
      return;
    }

    // Check character count limit for inline input
    const totalChars = textA.length + textB.length;
    if (totalChars > DiffEngine.SIZE_LIMITS.maxCharCount) {
      originalContent.innerHTML = "";
      modifiedContent.innerHTML = "";
      unifiedContent.innerHTML = "";
      diffStatus.textContent = `Input too large (${(totalChars / 1024 / 1024).toFixed(1)} MB). Limit: ${(DiffEngine.SIZE_LIMITS.maxCharCount / 1024 / 1024).toFixed(0)} MB.`;
      diffStatus.style.color = "#e74c3c";
      return;
    }

    const options = {
      ignoreWhitespace: ignoreWhitespace.checked,
      ignoreCase: ignoreCase.checked,
    };

    const alignment = DiffEngine.computeLineDiff(textA, textB, options);

    // Handle size limit error from the engine
    if (alignment.error) {
      originalContent.innerHTML = "";
      modifiedContent.innerHTML = "";
      unifiedContent.innerHTML = "";
      diffStatus.textContent = alignment.message;
      diffStatus.style.color = "#e74c3c";
      return;
    }

    diffStatus.style.color = "";
    const stats = DiffEngine.computeDiffStats(alignment);

    diffStatus.textContent = `Differences: +${stats.additions} additions, -${stats.deletions} deletions`;

    let htmlOrig = "";
    let htmlMod = "";
    let htmlUni = "";

    alignment.forEach((item) => {
      if (item.type === "equal") {
        const safeVal = escapeHtml(item.valA);
        htmlOrig += `<div class="diff-line line-equal"><span class="line-num">${item.lineA}</span><span class="line-text">${safeVal}</span></div>`;
        htmlMod += `<div class="diff-line line-equal"><span class="line-num">${item.lineB}</span><span class="line-text">${safeVal}</span></div>`;
        htmlUni += `<div class="diff-line line-equal"><span class="line-prefix"> </span><span class="line-text">${safeVal}</span></div>`;
      } else if (item.type === "delete") {
        const safeVal = escapeHtml(item.valA);
        htmlOrig += `<div class="diff-line line-delete"><span class="line-num">${item.lineA}</span><span class="line-text">${safeVal}</span></div>`;
        htmlMod += `<div class="diff-line line-empty"><span class="line-num"></span></div>`;
        htmlUni += `<div class="diff-line line-delete"><span class="line-prefix">-</span><span class="line-text">${safeVal}</span></div>`;
      } else if (item.type === "add") {
        const safeVal = escapeHtml(item.valB);
        htmlOrig += `<div class="diff-line line-empty"><span class="line-num"></span></div>`;
        htmlMod += `<div class="diff-line line-add"><span class="line-num">${item.lineB}</span><span class="line-text">${safeVal}</span></div>`;
        htmlUni += `<div class="diff-line line-add"><span class="line-prefix">+</span><span class="line-text">${safeVal}</span></div>`;
      }
    });

    originalContent.innerHTML = htmlOrig;
    modifiedContent.innerHTML = htmlMod;
    unifiedContent.innerHTML = htmlUni;
  }

  function escapeHtml(str) {
    return CradleEscape.escapeHtml(str);
  }

  // File Upload Handlers
  fileInputA.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > DiffEngine.SIZE_LIMITS.maxFileSize) {
        fileInfoA.textContent = `${file.name} — too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit: ${(DiffEngine.SIZE_LIMITS.maxFileSize / 1024 / 1024).toFixed(0)} MB.`;
        fileInfoA.style.color = "#e74c3c";
        return;
      }
      fileInfoA.textContent = `${file.name} (${file.size} bytes)`;
      fileInfoA.style.color = "";
      const reader = new FileReader();
      reader.onload = (evt) => {
        textInputA.value = evt.target.result;
        renderDiff();
      };
      reader.readAsText(file);
    }
  });

  fileInputB.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > DiffEngine.SIZE_LIMITS.maxFileSize) {
        fileInfoB.textContent = `${file.name} — too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit: ${(DiffEngine.SIZE_LIMITS.maxFileSize / 1024 / 1024).toFixed(0)} MB.`;
        fileInfoB.style.color = "#e74c3c";
        return;
      }
      fileInfoB.textContent = `${file.name} (${file.size} bytes)`;
      fileInfoB.style.color = "";
      const reader = new FileReader();
      reader.onload = (evt) => {
        textInputB.value = evt.target.result;
        renderDiff();
      };
      reader.readAsText(file);
    }
  });

  textInputA.addEventListener("input", renderDiff);
  textInputB.addEventListener("input", renderDiff);
  ignoreWhitespace.addEventListener("change", renderDiff);
  ignoreCase.addEventListener("change", renderDiff);

  // Buttons
  clearBtn.addEventListener("click", () => {
    textInputA.value = "";
    textInputB.value = "";
    fileInfoA.textContent = "No file loaded";
    fileInfoB.textContent = "No file loaded";
    fileInputA.value = "";
    fileInputB.value = "";
    renderDiff();
  });

  demoBtn.addEventListener("click", () => {
    textInputA.value = `function calculateTotal(items) {\n  let total = 0;\n  for (let item of items) {\n    total += item.price;\n  }\n  return total;\n}`;
    textInputB.value = `function calculateTotal(items, taxRate = 0.05) {\n  let total = 0;\n  for (const item of items) {\n    total += item.price * (1 + taxRate);\n  }\n  return total;\n}`;
    fileInfoA.textContent = "demo-original.js";
    fileInfoB.textContent = "demo-modified.js";
    renderDiff();
  });

  exportPatchBtn.addEventListener("click", () => {
    const textA = textInputA.value;
    const textB = textInputB.value;
    if (!textA && !textB) return;
    const alignment = DiffEngine.computeLineDiff(textA, textB, {
      ignoreWhitespace: ignoreWhitespace.checked,
      ignoreCase: ignoreCase.checked,
    });
    const patchText = DiffEngine.generateUnifiedPatch("fileA.txt", "fileB.txt", alignment);
    const blob = new Blob([patchText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diff.patch";
    a.click();
    URL.revokeObjectURL(url);
  });
});
