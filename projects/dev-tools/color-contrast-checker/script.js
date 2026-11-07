const foregroundHex = document.getElementById("foregroundHex");
const backgroundHex = document.getElementById("backgroundHex");
const foregroundPicker = document.getElementById("foregroundPicker");
const backgroundPicker = document.getElementById("backgroundPicker");
const ratioValue = document.getElementById("ratioValue");
const wcagBadge = document.getElementById("wcagBadge");
const apcaValue = document.getElementById("apcaValue");
const apcaBadge = document.getElementById("apcaBadge");
const apcaPolarity = document.getElementById("apcaPolarity");

const statusGrid = document.getElementById("statusGrid");
const apcaGrid = document.getElementById("apcaGrid");
const suggestionList = document.getElementById("suggestionList");
const samplePreview = document.getElementById("samplePreview");
const validationMessage = document.getElementById("validationMessage");
const paletteList = document.getElementById("paletteList");
const copyCssBtn = document.getElementById("copyCssBtn");

const activeCvdLabel = document.getElementById("activeCvdLabel");
const cvdTabs = document.querySelectorAll(".cvd-tab");
const cvdInfoBar = document.getElementById("cvdInfoBar");
const cvdInfoText = document.getElementById("cvdInfoText");
const cvdCardsGrid = document.getElementById("cvdCardsGrid");

const previewSolidBtn = document.getElementById("previewSolidBtn");
const previewOutlineBtn = document.getElementById("previewOutlineBtn");
const previewPillBadge = document.getElementById("previewPillBadge");

let activeCvd = "normal";

const statusCards = [
  { key: "normalAA", label: "AA Normal Text", detail: "4.5:1 minimum" },
  { key: "normalAAA", label: "AAA Normal Text", detail: "7:1 enhanced" },
  { key: "largeAA", label: "AA Large Text", detail: "3:1 minimum" },
  { key: "largeAAA", label: "AAA Large Text", detail: "4.5:1 enhanced" },
  { key: "uiAA", label: "UI Components", detail: "3:1 minimum" },
];

const apcaCards = [
  {
    key: "fluentText",
    label: "Fluent Body Text",
    detail: "|Lc| ≥ 90 (300-400wt, 14-16px)",
  },
  {
    key: "bodyText",
    label: "Standard Body Copy",
    detail: "|Lc| ≥ 75 (400wt 16px, 700wt 14px)",
  },
  {
    key: "largeText",
    label: "Large Content Text",
    detail: "|Lc| ≥ 60 (400wt 24px, 700wt 18px)",
  },
  {
    key: "headlineText",
    label: "Display Headlines",
    detail: "|Lc| ≥ 45 (400wt 36px, 700wt 24px)",
  },
  {
    key: "uiComponents",
    label: "UI Icons & Borders",
    detail: "|Lc| ≥ 30 (controls, non-text)",
  },
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

function renderApcaCards(apcaStatus) {
  if (!apcaGrid) return;
  apcaGrid.innerHTML = apcaCards
    .map(card => {
      const passed = Boolean(apcaStatus[card.key]);
      return `
        <article class="status-card apca-card ${passed ? "pass" : "fail"}">
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
    .map(
      item => `
      <button class="suggestion" type="button" data-color="${item.color}">
        <span class="swatch" style="background:${item.color}"></span>
        <span>
          <strong>${item.color}</strong>
          <small>${item.direction} foreground, ${item.ratio}:1</small>
        </span>
      </button>
    `
    )
    .join("");

  suggestionList.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => {
      foregroundHex.value = button.dataset.color;
      syncInputPair(foregroundHex, foregroundPicker);
      updateReport();
    });
  });
}

function setCvdFilter(cvdId) {
  activeCvd = cvdId;
  cvdTabs.forEach(tab => {
    const isActive = tab.dataset.cvd === cvdId;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  const type =
    ContrastEngine.CVD_TYPES[cvdId] || ContrastEngine.CVD_TYPES.normal;
  if (activeCvdLabel) {
    activeCvdLabel.textContent = type.label;
  }

  if (samplePreview) {
    samplePreview.style.filter = type.svgFilter;
  }

  // Update card active styles
  if (cvdCardsGrid) {
    cvdCardsGrid.querySelectorAll(".cvd-card").forEach(card => {
      card.classList.toggle("active-cvd-card", card.dataset.cvd === cvdId);
    });
  }

  updateCvdInfoBar();
}

function updateCvdInfoBar() {
  if (!cvdInfoBar || !cvdInfoText) return;

  if (activeCvd === "normal") {
    cvdInfoBar.hidden = true;
    return;
  }

  const report = ContrastEngine.getContrastReport(
    foregroundHex.value,
    backgroundHex.value
  );
  if (!report.valid || !report.cvd || !report.cvd[activeCvd]) {
    cvdInfoBar.hidden = true;
    return;
  }

  const sim = report.cvd[activeCvd];
  cvdInfoBar.hidden = false;
  cvdInfoText.innerHTML = `<strong>Simulating ${sim.label}:</strong> Simulated Colors: <code>${sim.simulatedForeground}</code> on <code>${sim.simulatedBackground}</code> • WCAG: <strong>${sim.ratio.toFixed(2)}:1</strong> • APCA: <strong>Lc ${sim.apca.toFixed(1)}</strong>`;
}

function renderCvdMatrix(report) {
  if (!cvdCardsGrid || !report.cvd) return;

  const cvdKeys = [
    "protanopia",
    "deuteranopia",
    "tritanopia",
    "achromatopsia",
  ];
  cvdCardsGrid.innerHTML = cvdKeys
    .map(key => {
      const sim = report.cvd[key];
      const isCurrent = activeCvd === key;
      const passesAA = sim.wcagStatus.normalAA;
      return `
        <article class="cvd-card ${isCurrent ? "active-cvd-card" : ""}" data-cvd="${key}">
          <div class="cvd-card-header">
            <div>
              <h4>${sim.label}</h4>
              <small>${sim.description}</small>
            </div>
            <span class="cvd-badge ${passesAA ? "pass" : "fail"}">
              ${passesAA ? "AA Pass" : "AA Fail"}
            </span>
          </div>
          <div class="cvd-card-preview" style="background:${sim.simulatedBackground}; color:${sim.simulatedForeground}">
            <span class="cvd-preview-sample">Aa Preview</span>
            <span class="cvd-preview-btn" style="background:${sim.simulatedForeground}; color:${sim.simulatedBackground}">Button</span>
          </div>
          <div class="cvd-card-metrics">
            <div>
              <span class="metric-label">WCAG 2.1:</span>
              <strong>${sim.ratio.toFixed(2)}:1</strong>
            </div>
            <div>
              <span class="metric-label">APCA:</span>
              <strong>Lc ${sim.apca.toFixed(1)}</strong>
            </div>
          </div>
          <div class="cvd-card-colors">
            <code>${sim.simulatedForeground}</code> on <code>${sim.simulatedBackground}</code>
          </div>
        </article>
      `;
    })
    .join("");

  cvdCardsGrid.querySelectorAll(".cvd-card").forEach(card => {
    card.addEventListener("click", () => {
      setCvdFilter(card.dataset.cvd);
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
    if (wcagBadge) wcagBadge.textContent = "--";
    if (apcaValue) apcaValue.textContent = "--";
    if (apcaBadge) apcaBadge.textContent = "--";
    statusGrid.innerHTML = "";
    if (apcaGrid) apcaGrid.innerHTML = "";
    suggestionList.innerHTML = "";
    if (cvdCardsGrid) cvdCardsGrid.innerHTML = "";
    return;
  }

  validationMessage.textContent = "";
  validationMessage.classList.remove("visible");
  copyCssBtn.disabled = false;
  foregroundHex.value = report.foreground;
  backgroundHex.value = report.background;
  foregroundPicker.value = report.foreground;
  backgroundPicker.value = report.background;

  // WCAG 2.1 ratio meter
  ratioValue.textContent = `${report.ratio.toFixed(2)}:1`;
  if (wcagBadge) {
    const isAAA = report.status.normalAAA;
    const isAA = report.status.normalAA;
    wcagBadge.textContent = isAAA ? "AAA Pass" : isAA ? "AA Pass" : "Fail";
    wcagBadge.className = `meter-badge ${isAA ? "pass" : "fail"}`;
  }

  // WCAG 3.0 APCA meter
  if (apcaValue) {
    apcaValue.textContent = `Lc ${report.apca.toFixed(1)}`;
  }
  if (apcaBadge) {
    apcaBadge.textContent = report.apcaStatus.rating;
    apcaBadge.className = `meter-badge ${
      report.apcaStatus.bodyText
        ? "pass"
        : report.apcaStatus.uiComponents
          ? "warn"
          : "fail"
    }`;
  }
  if (apcaPolarity) {
    apcaPolarity.textContent = report.apcaStatus.polarity;
  }

  // Update sample live preview typography and background
  samplePreview.style.color = report.foreground;
  samplePreview.style.background = report.background;

  // Update live button components
  if (previewSolidBtn) {
    previewSolidBtn.style.backgroundColor = report.foreground;
    previewSolidBtn.style.color = report.background;
  }
  if (previewOutlineBtn) {
    previewOutlineBtn.style.borderColor = report.foreground;
    previewOutlineBtn.style.color = report.foreground;
    previewOutlineBtn.style.backgroundColor = "transparent";
  }
  if (previewPillBadge) {
    previewPillBadge.style.borderColor = report.foreground;
    previewPillBadge.style.color = report.foreground;
  }

  // Apply active CVD filter
  const type =
    ContrastEngine.CVD_TYPES[activeCvd] || ContrastEngine.CVD_TYPES.normal;
  samplePreview.style.filter = type.svgFilter;

  renderStatusCards(report.status);
  renderApcaCards(report.apcaStatus);
  renderSuggestions(report);
  renderCvdMatrix(report);
  updateCvdInfoBar();
}

function applyPalette(palette) {
  foregroundHex.value = palette.foreground;
  backgroundHex.value = palette.background;
  syncInputPair(foregroundHex, foregroundPicker);
  syncInputPair(backgroundHex, backgroundPicker);
  updateReport();
}

function renderPalettes() {
  paletteList.innerHTML = ContrastEngine.SAMPLE_PALETTES.map(
    (palette, index) => `
      <button class="palette-button" type="button" data-index="${index}">
        <span class="palette-preview" style="background:${palette.background}; color:${palette.foreground}">
          Aa
        </span>
        <span>
          <strong>${palette.name}</strong>
          <small>${palette.foreground} on ${palette.background}</small>
        </span>
      </button>
    `
  ).join("");

  paletteList.querySelectorAll(".palette-button").forEach(button => {
    button.addEventListener("click", () => {
      applyPalette(
        ContrastEngine.SAMPLE_PALETTES[Number(button.dataset.index)]
      );
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
    const picker =
      input === foregroundHex ? foregroundPicker : backgroundPicker;
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

// Wire CVD tabs
cvdTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    setCvdFilter(tab.dataset.cvd);
  });
});

copyCssBtn.addEventListener("click", copyCssVariables);

renderPalettes();
updateReport();
