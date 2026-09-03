const foregroundHex = document.getElementById("foregroundHex");
const backgroundHex = document.getElementById("backgroundHex");
const foregroundPicker = document.getElementById("foregroundPicker");
const backgroundPicker = document.getElementById("backgroundPicker");
const ratioValue = document.getElementById("ratioValue");
const statusGrid = document.getElementById("statusGrid");
const suggestionList = document.getElementById("suggestionList");
const samplePreview = document.getElementById("samplePreview");
const validationMessage = document.getElementById("validationMessage");
const paletteList = document.getElementById("paletteList");
const copyCssBtn = document.getElementById("copyCssBtn");

const statusCards = [
  { key: "normalAA", label: "AA Normal Text", detail: "4.5:1 minimum" },
  { key: "normalAAA", label: "AAA Normal Text", detail: "7:1 enhanced" },
  { key: "largeAA", label: "AA Large Text", detail: "3:1 minimum" },
  { key: "largeAAA", label: "AAA Large Text", detail: "4.5:1 enhanced" },
  { key: "uiAA", label: "UI Components", detail: "3:1 minimum" },
];

function syncInputPair(textInput, colorInput) {
  const normalized = ContrastEngine.normalizeHex(textInput.value);
  if (normalized) {
    textInput.value = normalized;
    colorInput.value = normalized;
  }
}

function renderStatusCards(status) {
  statusGrid.innerHTML = statusCards
    .map(card => {
      const passed = Boolean(status[card.key]);
      return `
        <article class="status-card ${passed ? "pass" : "fail"}">
          <span>${passed ? "Pass" : "Fail"}</span>
          <h3>${card.label}</h3>
          <p>${card.detail}</p>
        </article>
      `;
    })
    .join("");
}

function renderSuggestions(report) {
  if (report.suggestions.length === 0) {
    suggestionList.innerHTML = `
      <div class="empty-state">
        Current colors already pass AA normal text.
      </div>
    `;
    return;
  }

  suggestionList.innerHTML = report.suggestions
    .map(item => `
      <button class="suggestion" type="button" data-color="${item.color}">
        <span class="swatch" style="background:${item.color}"></span>
        <span>
          <strong>${item.color}</strong>
          <small>${item.direction} foreground, ${item.ratio}:1</small>
        </span>
      </button>
    `)
    .join("");

  suggestionList.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => {
      foregroundHex.value = button.dataset.color;
      syncInputPair(foregroundHex, foregroundPicker);
      updateReport();
    });
  });
}

function updateReport() {
  const report = ContrastEngine.getContrastReport(
    foregroundHex.value,
    backgroundHex.value
  );

  if (!report.valid) {
    validationMessage.textContent = report.error;
    validationMessage.classList.add("visible");
    copyCssBtn.disabled = true;
    ratioValue.textContent = "--";
    statusGrid.innerHTML = "";
    suggestionList.innerHTML = "";
    return;
  }

  validationMessage.textContent = "";
  validationMessage.classList.remove("visible");
  copyCssBtn.disabled = false;
  foregroundHex.value = report.foreground;
  backgroundHex.value = report.background;
  foregroundPicker.value = report.foreground;
  backgroundPicker.value = report.background;

  ratioValue.textContent = report.ratio.toFixed(2);
  samplePreview.style.color = report.foreground;
  samplePreview.style.background = report.background;

  renderStatusCards(report.status);
  renderSuggestions(report);
}

function applyPalette(palette) {
  foregroundHex.value = palette.foreground;
  backgroundHex.value = palette.background;
  syncInputPair(foregroundHex, foregroundPicker);
  syncInputPair(backgroundHex, backgroundPicker);
  updateReport();
}

function renderPalettes() {
  paletteList.innerHTML = ContrastEngine.SAMPLE_PALETTES
    .map((palette, index) => `
      <button class="palette-button" type="button" data-index="${index}">
        <span class="palette-preview" style="background:${palette.background}; color:${palette.foreground}">
          Aa
        </span>
        <span>
          <strong>${palette.name}</strong>
          <small>${palette.foreground} on ${palette.background}</small>
        </span>
      </button>
    `)
    .join("");

  paletteList.querySelectorAll(".palette-button").forEach(button => {
    button.addEventListener("click", () => {
      applyPalette(ContrastEngine.SAMPLE_PALETTES[Number(button.dataset.index)]);
    });
  });
}

async function copyCssVariables() {
  const report = ContrastEngine.getContrastReport(
    foregroundHex.value,
    backgroundHex.value
  );

  if (!report.valid) return;

  await navigator.clipboard.writeText(report.cssVariables);
  const previousText = copyCssBtn.textContent;
  copyCssBtn.textContent = "Copied";
  setTimeout(() => {
    copyCssBtn.textContent = previousText;
  }, 1200);
}

[foregroundHex, backgroundHex].forEach(input => {
  input.addEventListener("input", updateReport);
  input.addEventListener("blur", () => {
    const picker = input === foregroundHex ? foregroundPicker : backgroundPicker;
    syncInputPair(input, picker);
    updateReport();
  });
});

foregroundPicker.addEventListener("input", () => {
  foregroundHex.value = foregroundPicker.value;
  updateReport();
});

backgroundPicker.addEventListener("input", () => {
  backgroundHex.value = backgroundPicker.value;
  updateReport();
});

copyCssBtn.addEventListener("click", copyCssVariables);

renderPalettes();
updateReport();
