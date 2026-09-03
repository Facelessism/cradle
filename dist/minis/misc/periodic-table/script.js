document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const periodicTableGrid = document.getElementById("periodic-table");
  const lanthanidesGrid = document.getElementById("lanthanides-grid");
  const actinidesGrid = document.getElementById("actinides-grid");
  const categoryLegend = document.getElementById("category-legend");
  const searchInput = document.getElementById("search-input");
  const clearSearchBtn = document.getElementById("clear-search");
  const tempSlider = document.getElementById("temp-slider");
  const tempDisplay = document.getElementById("temp-display");
  const resetTempBtn = document.getElementById("reset-temp");
  const totalCountEl = document.getElementById("total-count");
  const modeButtons = document.querySelectorAll(".mode-btn");

  // Modal DOM Elements
  const modal = document.getElementById("element-modal");
  const modalClose = document.getElementById("modal-close");
  const modalHeader = document.getElementById("modal-header");
  const modalHeroCard = document.getElementById("modal-hero-card");
  const modalNumber = document.getElementById("modal-number");
  const modalSymbol = document.getElementById("modal-symbol");
  const modalName = document.getElementById("modal-name");
  const modalMass = document.getElementById("modal-mass");
  const modalCategory = document.getElementById("modal-category");
  const modalGroupPeriod = document.getElementById("modal-group-period");
  const modalBlock = document.getElementById("modal-block");
  const modalDiscovery = document.getElementById("modal-discovery");
  const modalState = document.getElementById("modal-state");
  const modalConfig = document.getElementById("modal-config");
  const modalElectronegativity = document.getElementById(
    "modal-electronegativity"
  );
  const modalMelting = document.getElementById("modal-melting");
  const modalBoiling = document.getElementById("modal-boiling");
  const modalDensity = document.getElementById("modal-density");
  const modalSummary = document.getElementById("modal-summary");
  const modalShellsText = document.getElementById("modal-shells-text");
  const bohrCanvas = document.getElementById("bohr-canvas");

  // State
  let activeCategory = "all";
  let searchFilter = "";
  let currentTempK = 298; // 25°C
  let currentMode = "standard";

  totalCountEl.textContent = ELEMENTS.length;

  // Render Category Filter Legend Pills
  function initCategoryLegend() {
    categoryLegend.innerHTML = "";

    const allPill = document.createElement("div");
    allPill.className = "cat-pill active";
    allPill.textContent = "All Categories";
    allPill.addEventListener("click", () => selectCategory("all"));
    categoryLegend.appendChild(allPill);

    Object.entries(CATEGORY_NAMES).forEach(([catKey, catLabel]) => {
      const pill = document.createElement("div");
      pill.className = "cat-pill";
      pill.dataset.category = catKey;
      pill.style.borderLeftColor = `var(--cat-${catKey})`;
      pill.textContent = catLabel;
      pill.addEventListener("click", () => selectCategory(catKey));
      categoryLegend.appendChild(pill);
    });
  }

  function selectCategory(catKey) {
    activeCategory = catKey;
    document.querySelectorAll(".cat-pill").forEach(p => {
      if (catKey === "all" && !p.dataset.category) {
        p.classList.add("active");
      } else if (p.dataset.category === catKey) {
        p.classList.add("active");
      } else {
        p.classList.remove("active");
      }
    });
    applyFilters();
  }

  // Calculate State of Matter at temperature T (Kelvin)
  function getElementState(elem, tempK) {
    if (typeof PeriodicEngine !== "undefined") {
      return PeriodicEngine.calculatePhaseState(
        elem.meltingPoint,
        elem.boilingPoint,
        tempK,
        elem.phaseAtSTP
      );
    }
    if (elem.phaseAtSTP === "Synthetic" && !elem.meltingPoint)
      return "Synthetic";
    const melt = elem.meltingPoint;
    const boil = elem.boilingPoint;
    if (!melt && !boil) return elem.phaseAtSTP || "Solid";
    if (melt && tempK < melt) return "Solid";
    if (melt && boil && tempK >= melt && tempK < boil) return "Liquid";
    if (boil && tempK >= boil) return "Gas";
    if (melt && !boil && tempK >= melt) return "Liquid";
    return "Solid";
  }

  // Render Grid Tiles
  function renderTable() {
    periodicTableGrid.innerHTML = "";
    lanthanidesGrid.innerHTML = "";
    actinidesGrid.innerHTML = "";

    ELEMENTS.forEach(elem => {
      const tile = document.createElement("div");
      tile.className = "element-tile";
      tile.dataset.number = elem.number;
      tile.dataset.category = elem.category;

      // Position in grid for Main Table (Lanthanides 57-71 & Actinides 89-103 placed in sub-grid)
      const isLanthanide = elem.number >= 57 && elem.number <= 71;
      const isActinide = elem.number >= 89 && elem.number <= 103;

      if (!isLanthanide && !isActinide) {
        tile.style.gridColumn = elem.group;
        tile.style.gridRow = elem.period;
      }

      // State indicator
      const state = getElementState(elem, currentTempK);
      const stateClass = state.toLowerCase();

      // Custom Heatmap Colors for Modes
      if (currentMode === "electronegativity" && elem.electronegativity) {
        // Electronegativity ranges approx 0.7 (Cs) to 3.98 (F)
        const ratio = (elem.electronegativity - 0.7) / (3.98 - 0.7);
        const hue = (1 - Math.max(0, Math.min(1, ratio))) * 240; // Blue (low) to Red (high)
        tile.style.backgroundColor = `hsla(${hue}, 80%, 25%, 0.85)`;
      } else if (currentMode === "mass") {
        // Mass ranges approx 1 to 294
        const massVal = parseFloat(elem.atomicMass) || elem.number * 2.5;
        const ratio = Math.min(1, massVal / 300);
        const hue = 200 + ratio * 140;
        tile.style.backgroundColor = `hsla(${hue}, 70%, 20%, 0.85)`;
      } else {
        tile.style.backgroundColor = "";
      }

      tile.innerHTML = `
        <div class="tile-top">
          <span class="atomic-num">${elem.number}</span>
          <span class="state-indicator ${stateClass}" title="State: ${state}"></span>
        </div>
        <div class="symbol">${elem.symbol}</div>
        <div class="tile-bottom">
          <div class="name">${elem.name}</div>
          <div class="mass">${currentMode === "electronegativity" ? (elem.electronegativity ?? "N/A") : elem.atomicMass}</div>
        </div>
      `;

      tile.addEventListener("click", () => openModal(elem));

      if (isLanthanide) {
        lanthanidesGrid.appendChild(tile);
      } else if (isActinide) {
        actinidesGrid.appendChild(tile);
      } else {
        periodicTableGrid.appendChild(tile);
      }
    });

    applyFilters();
  }

  // Filter application
  function applyFilters() {
    const tiles = document.querySelectorAll(".element-tile");
    const query = searchFilter.toLowerCase().trim();

    tiles.forEach(tile => {
      const elemNum = parseInt(tile.dataset.number, 10);
      const elem = ELEMENTS.find(e => e.number === elemNum);
      if (!elem) return;

      const matchesCategory =
        activeCategory === "all" || elem.category === activeCategory;
      const matchesSearch =
        !query ||
        elem.name.toLowerCase().includes(query) ||
        elem.symbol.toLowerCase().includes(query) ||
        elem.number.toString().includes(query) ||
        (CATEGORY_NAMES[elem.category] || "").toLowerCase().includes(query);

      if (matchesCategory && matchesSearch) {
        tile.classList.remove("dimmed");
        if (query || activeCategory !== "all") {
          tile.classList.add("highlighted");
        } else {
          tile.classList.remove("highlighted");
        }
      } else {
        tile.classList.add("dimmed");
        tile.classList.remove("highlighted");
      }
    });
  }

  // Search input listeners
  searchInput.addEventListener("input", e => {
    searchFilter = e.target.value;
    clearSearchBtn.hidden = !searchFilter;
    applyFilters();
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchFilter = "";
    clearSearchBtn.hidden = true;
    applyFilters();
  });

  // Display Mode Buttons
  modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      modeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentMode = btn.dataset.mode;
      renderTable();
    });
  });

  // Temperature Slider Listener
  tempSlider.addEventListener("input", e => {
    currentTempK = parseInt(e.target.value, 10);
    updateTempDisplay();
    updateTileStates();
  });

  resetTempBtn.addEventListener("click", () => {
    tempSlider.value = 298;
    currentTempK = 298;
    updateTempDisplay();
    updateTileStates();
  });

  function updateTempDisplay() {
    const celsius = Math.round(currentTempK - 273.15);
    const fahrenheit = Math.round((celsius * 9) / 5 + 32);
    tempDisplay.textContent = `${currentTempK} K (${celsius}°C / ${fahrenheit}°F)`;
  }

  function updateTileStates() {
    document.querySelectorAll(".element-tile").forEach(tile => {
      const elemNum = parseInt(tile.dataset.number, 10);
      const elem = ELEMENTS.find(e => e.number === elemNum);
      if (!elem) return;

      const state = getElementState(elem, currentTempK);
      const indicator = tile.querySelector(".state-indicator");
      if (indicator) {
        indicator.className = `state-indicator ${state.toLowerCase()}`;
        indicator.title = `State: ${state}`;
      }
    });
  }

  // Open Detailed Modal
  function openModal(elem) {
    const catName = CATEGORY_NAMES[elem.category] || elem.category;
    const state = getElementState(elem, currentTempK);

    modalNumber.textContent = elem.number;
    modalSymbol.textContent = elem.symbol;
    modalName.textContent = elem.name;
    modalMass.textContent = `Atomic Mass: ${elem.atomicMass}`;

    modalHeroCard.style.borderColor = `var(--cat-${elem.category})`;
    modalSymbol.style.color = `var(--cat-${elem.category})`;

    modalHeader.innerHTML = `
      <h2>${elem.name} (${elem.symbol})</h2>
      <span class="modal-category-badge" style="background: var(--cat-${elem.category}); color: #fff;">
        ${catName}
      </span>
    `;

    modalCategory.textContent = catName;
    modalGroupPeriod.textContent = `Group ${elem.group || "N/A"}, Period ${elem.period}`;
    modalBlock.textContent = `${elem.block.toUpperCase()}-block`;
    modalDiscovery.textContent = elem.discoveryYear || "Unknown";
    modalState.textContent = state;
    modalConfig.textContent = elem.electronConfig || "N/A";
    modalElectronegativity.textContent = elem.electronegativity
      ? `${elem.electronegativity} (Pauling)`
      : "N/A";
    modalMelting.textContent = elem.meltingPoint
      ? `${elem.meltingPoint} K (${Math.round(elem.meltingPoint - 273.15)}°C)`
      : "N/A";
    modalBoiling.textContent = elem.boilingPoint
      ? `${elem.boilingPoint} K (${Math.round(elem.boilingPoint - 273.15)}°C)`
      : "N/A";
    modalDensity.textContent = elem.density ? `${elem.density} g/cm³` : "N/A";
    modalSummary.textContent = elem.summary || "No detailed summary available.";

    modalShellsText.textContent = `Shells: [${elem.shells.join(", ")}]`;

    drawBohrModel(elem.shells, elem.symbol);

    modal.hidden = false;
  }

  function closeModal() {
    modal.hidden = true;
  }

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", e => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", e => {
    if ((e.key === "Escape" || e.key === "Esc") && !modal.hidden) closeModal();
  });

  // Draw Bohr Model on Canvas
  function drawBohrModel(shells, symbol) {
    const ctx = bohrCanvas.getContext("2d");
    const width = bohrCanvas.width;
    const height = bohrCanvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Draw Nucleus
    ctx.beginPath();
    ctx.arc(centerX, centerY, 18, 0, 2 * Math.PI);
    ctx.fillStyle = "#6366f1";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#a5b4fc";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(symbol, centerX, centerY);

    // Draw Shells
    const maxRadius = Math.min(width, height) / 2 - 12;
    const numShells = shells.length;

    shells.forEach((electronCount, index) => {
      const radius = 28 + ((maxRadius - 28) / numShells) * (index + 1);

      // Shell orbit line
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Electrons on Orbit
      for (let i = 0; i < electronCount; i++) {
        const angle = ((2 * Math.PI) / electronCount) * i - Math.PI / 2;
        const eX = centerX + radius * Math.cos(angle);
        const eY = centerY + radius * Math.sin(angle);

        ctx.beginPath();
        ctx.arc(eX, eY, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#38bdf8";
        ctx.fill();
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }

  // Initialize
  initCategoryLegend();
  updateTempDisplay();
  renderTable();
});
