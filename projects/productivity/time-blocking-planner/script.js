
document.addEventListener("DOMContentLoaded", () => {
  // Constants
  const HOUR_HEIGHT = 60; // 60px per hour = 1px per minute
  const SNAP_MINUTES = 15; // 15-minute grid snapping
  const STORAGE_PREFIX = "cradle_tb_planner_";

  const CATEGORY_COLORS = {
    "deep-work": "#8b5cf6",
    work: "#3b82f6",
    meeting: "#f59e0b",
    study: "#06b6d4",
    exercise: "#10b981",
    break: "#ec4899",
    meal: "#f97316",
    personal: "#64748b",
  };

  const CATEGORY_NAMES = {
    "deep-work": "Deep Work",
    work: "General Work",
    meeting: "Meeting",
    study: "Study",
    exercise: "Exercise",
    break: "Break",
    meal: "Meal",
    personal: "Personal",
  };

  // DOM Elements
  const dateInput = document.getElementById("schedule-date");
  const timelineScale = document.getElementById("time-scale");
  const timelineTrack = document.getElementById("timeline-track");
  const currentTimeLine = document.getElementById("current-time-line");
  const currentTimeBadge = document.getElementById("current-time-badge");
  const statsBar = document.getElementById("stats-bar");
  const presetList = document.getElementById("preset-list");

  // Buttons & Controls
  const btnAddBlock = document.getElementById("btn-add-block");
  const btnSample = document.getElementById("btn-sample");
  const btnClear = document.getElementById("btn-clear");
  const btnExportMenu = document.getElementById("btn-export-menu");
  const exportDropdownContent = document.getElementById(
    "export-dropdown-content"
  );
  const btnExportIcs = document.getElementById("btn-export-ics");
  const btnExportJson = document.getElementById("btn-export-json");
  const btnExportText = document.getElementById("btn-export-text");
  const importJsonFile = document.getElementById("import-json-file");

  // Modal Elements
  const blockModal = document.getElementById("block-modal");
  const modalClose = document.getElementById("modal-close");
  const blockForm = document.getElementById("block-form");
  const modalTitleText = document.getElementById("modal-title-text");
  const blockIdInput = document.getElementById("block-id");
  const blockTitleInput = document.getElementById("block-title");
  const blockCategoryInput = document.getElementById("block-category");
  const blockColorInput = document.getElementById("block-color");
  const blockStartInput = document.getElementById("block-start");
  const blockEndInput = document.getElementById("block-end");
  const blockNotesInput = document.getElementById("block-notes");
  const btnDeleteBlock = document.getElementById("btn-delete-block");
  const btnCancelBlock = document.getElementById("btn-cancel-block");

  // State
  let currentDate = getTodayDateString();
  let blocks = []; // Array of { id, title, category, color, startMinutes, endMinutes, notes }

  dateInput.value = currentDate;

  // Helpers
  function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function minutesToTimeString(minutes) {
    const hrs = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }

  function timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hrs, mins] = timeStr.split(":").map(Number);
    return hrs * 60 + mins;
  }

  function formatDuration(minutes) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  }

  // Generate 24-Hour Scale
  function initTimelineScale() {
    timelineScale.innerHTML = "";
    for (let i = 0; i < 24; i++) {
      const hourDiv = document.createElement("div");
      hourDiv.className = "time-scale-hour";
      hourDiv.textContent = `${String(i).padStart(2, "0")}:00`;
      timelineScale.appendChild(hourDiv);
    }
  }

  // Load and Save to LocalStorage
  function loadBlocksForDate(dateStr) {
    const key = STORAGE_PREFIX + dateStr;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        blocks = JSON.parse(saved);
      } catch (e) {
        blocks = [];
      }
    } else {
      blocks = [];
    }
    renderBlocks();
    renderStats();
  }

  function saveBlocksForDate() {
    const key = STORAGE_PREFIX + currentDate;
    localStorage.setItem(key, JSON.stringify(blocks));
    renderStats();
  }

  // Render Blocks on Timeline
  function renderBlocks() {
    // Keep current time line, remove block elements
    const existingBlocks = timelineTrack.querySelectorAll(".time-block");
    existingBlocks.forEach(el => el.remove());

    blocks.sort((a, b) => a.startMinutes - b.startMinutes);

    blocks.forEach(block => {
      const duration = block.endMinutes - block.startMinutes;
      const topPx = block.startMinutes; // 1px = 1min
      const heightPx = Math.max(20, duration);

      const blockEl = document.createElement("div");
      blockEl.className = "time-block";
      blockEl.dataset.id = block.id;
      blockEl.style.top = `${topPx}px`;
      blockEl.style.height = `${heightPx}px`;
      blockEl.style.backgroundColor =
        block.color || CATEGORY_COLORS[block.category] || "#8b5cf6";

      blockEl.innerHTML = `
        <div class="resize-handle top"></div>
        <div class="block-header">
          <span class="block-title">${escapeHtml(block.title)}</span>
          <span class="block-time">${minutesToTimeString(block.startMinutes)} - ${minutesToTimeString(block.endMinutes)}</span>
        </div>
        ${block.notes ? `<div class="block-notes">📝 ${escapeHtml(block.notes)}</div>` : ""}
        <div class="resize-handle bottom"></div>
      `;

      // Event Listeners for Interaction
      attachBlockInteractions(blockEl, block);

      timelineTrack.appendChild(blockEl);
    });
  }

  function escapeHtml(str) {
    return CradleEscape.escapeHtml(str);
  }

  // Attach Drag & Resize Event Handlers
  function attachBlockInteractions(blockEl, block) {
    // Double click to edit
    blockEl.addEventListener("dblclick", e => {
      e.stopPropagation();
      openBlockModal(block);
    });

    const topResizeHandle = blockEl.querySelector(".resize-handle.top");
    const bottomResizeHandle = blockEl.querySelector(".resize-handle.bottom");

    // Drag move or resize
    blockEl.addEventListener("mousedown", e => {
      if (e.target === topResizeHandle) {
        initResize(e, block, "top");
      } else if (e.target === bottomResizeHandle) {
        initResize(e, block, "bottom");
      } else {
        initDragMove(e, block, blockEl);
      }
    });
  }

  // Drag to Move Block
  function initDragMove(e, block, blockEl) {
    e.stopPropagation();
    const startY = e.clientY;
    const initialTop = block.startMinutes;
    const duration = block.endMinutes - block.startMinutes;

    blockEl.classList.add("dragging");

    function onMouseMove(moveEvent) {
      const deltaY = moveEvent.clientY - startY;
      let newStart = initialTop + deltaY;

      // Snap to 15 mins
      newStart = Math.round(newStart / SNAP_MINUTES) * SNAP_MINUTES;

      // Bounds 0 to 1440 - duration
      newStart = Math.max(0, Math.min(1440 - duration, newStart));
      const newEnd = newStart + duration;

      blockEl.style.top = `${newStart}px`;
      const timeLabel = blockEl.querySelector(".block-time");
      if (timeLabel) {
        timeLabel.textContent = `${minutesToTimeString(newStart)} - ${minutesToTimeString(newEnd)}`;
      }
    }

    function onMouseUp(upEvent) {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      blockEl.classList.remove("dragging");

      const deltaY = upEvent.clientY - startY;
      let newStart = initialTop + deltaY;
      newStart = Math.round(newStart / SNAP_MINUTES) * SNAP_MINUTES;
      newStart = Math.max(0, Math.min(1440 - duration, newStart));

      block.startMinutes = newStart;
      block.endMinutes = newStart + duration;

      saveBlocksForDate();
      renderBlocks();
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  // Drag to Resize Block
  function initResize(e, block, handleType) {
    e.stopPropagation();
    const startY = e.clientY;
    const initialStart = block.startMinutes;
    const initialEnd = block.endMinutes;

    function onMouseMove(moveEvent) {
      const deltaY = moveEvent.clientY - startY;

      if (handleType === "bottom") {
        let newEnd = initialEnd + deltaY;
        newEnd = Math.round(newEnd / SNAP_MINUTES) * SNAP_MINUTES;
        newEnd = Math.max(initialStart + SNAP_MINUTES, Math.min(1440, newEnd));

        block.endMinutes = newEnd;
      } else if (handleType === "top") {
        let newStart = initialStart + deltaY;
        newStart = Math.round(newStart / SNAP_MINUTES) * SNAP_MINUTES;
        newStart = Math.max(0, Math.min(initialEnd - SNAP_MINUTES, newStart));

        block.startMinutes = newStart;
      }
      renderBlocks();
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      saveBlocksForDate();
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  // Timeline Click to Add Block
  timelineTrack.addEventListener("click", e => {
    if (e.target !== timelineTrack) return;
    const rect = timelineTrack.getBoundingClientRect();
    const clickY = e.clientY - rect.top;

    let startMins = Math.floor(clickY / SNAP_MINUTES) * SNAP_MINUTES;
    startMins = Math.max(0, Math.min(1380, startMins));

    openBlockModal({
      id: null,
      title: "",
      category: "work",
      color: CATEGORY_COLORS["work"],
      startMinutes: startMins,
      endMinutes: startMins + 60,
      notes: "",
    });
  });

  // Category Breakdown Stats Bar
  function renderStats() {
    statsBar.innerHTML = "";
    const categoryTotals = {};
    let totalPlannedMins = 0;

    blocks.forEach(block => {
      const duration = block.endMinutes - block.startMinutes;
      categoryTotals[block.category] =
        (categoryTotals[block.category] || 0) + duration;
      totalPlannedMins += duration;
    });

    const totalChip = document.createElement("div");
    totalChip.className = "stat-chip";
    totalChip.style.borderLeftColor = "var(--accent-primary)";
    totalChip.innerHTML = `Total Scheduled: <strong>${formatDuration(totalPlannedMins)}</strong>`;
    statsBar.appendChild(totalChip);

    Object.entries(categoryTotals).forEach(([cat, mins]) => {
      const chip = document.createElement("div");
      chip.className = "stat-chip";
      chip.style.borderLeftColor = CATEGORY_COLORS[cat] || "#64748b";
      chip.innerHTML = `${CATEGORY_NAMES[cat] || cat}: <strong>${formatDuration(mins)}</strong>`;
      statsBar.appendChild(chip);
    });
  }

  // Update Current Time Line Indicator
  function updateCurrentTimeIndicator() {
    const isToday = currentDate === getTodayDateString();
    if (!isToday) {
      currentTimeLine.hidden = true;
      return;
    }

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    currentTimeLine.hidden = false;
    currentTimeLine.style.top = `${currentMins}px`;
    currentTimeBadge.textContent = minutesToTimeString(currentMins);
  }

  setInterval(updateCurrentTimeIndicator, 30000); // Check every 30s

  // Date Selector Change
  dateInput.addEventListener("change", e => {
    currentDate = e.target.value;
    loadBlocksForDate(currentDate);
    updateCurrentTimeIndicator();
  });

  // Modal Functions
  function openBlockModal(block = null) {
    if (block && block.id) {
      modalTitleText.textContent = "Edit Time Block";
      blockIdInput.value = block.id;
      blockTitleInput.value = block.title;
      blockCategoryInput.value = block.category;
      blockColorInput.value = block.color || CATEGORY_COLORS[block.category];
      blockStartInput.value = minutesToTimeString(block.startMinutes);
      blockEndInput.value = minutesToTimeString(block.endMinutes);
      blockNotesInput.value = block.notes || "";
      btnDeleteBlock.hidden = false;
    } else {
      modalTitleText.textContent = "Add Time Block";
      blockIdInput.value = "";
      blockTitleInput.value = block ? block.title : "";
      blockCategoryInput.value = block ? block.category : "work";
      blockColorInput.value = block ? block.color : CATEGORY_COLORS["work"];
      blockStartInput.value = block
        ? minutesToTimeString(block.startMinutes)
        : "09:00";
      blockEndInput.value = block
        ? minutesToTimeString(block.endMinutes)
        : "10:00";
      blockNotesInput.value = "";
      btnDeleteBlock.hidden = true;
    }
    blockModal.hidden = false;
  }

  function closeBlockModal() {
    blockModal.hidden = true;
  }

  blockCategoryInput.addEventListener("change", e => {
    const cat = e.target.value;
    if (CATEGORY_COLORS[cat]) {
      blockColorInput.value = CATEGORY_COLORS[cat];
    }
  });

  blockForm.addEventListener("submit", e => {
    e.preventDefault();
    const id = blockIdInput.value || Date.now().toString();
    const startMins = timeStringToMinutes(blockStartInput.value);
    let endMins = timeStringToMinutes(blockEndInput.value);

    if (endMins <= startMins) {
      endMins = startMins + 30; // Min 30 mins fallback
    }

    const newBlock = {
      id,
      title: blockTitleInput.value.trim() || "Untitled Task",
      category: blockCategoryInput.value,
      color: blockColorInput.value,
      startMinutes: startMins,
      endMinutes: endMins,
      notes: blockNotesInput.value.trim(),
    };

    const existingIdx = blocks.findIndex(b => b.id === id);
    if (existingIdx >= 0) {
      blocks[existingIdx] = newBlock;
    } else {
      blocks.push(newBlock);
    }

    saveBlocksForDate();
    renderBlocks();
    closeBlockModal();
  });

  btnDeleteBlock.addEventListener("click", () => {
    const id = blockIdInput.value;
    if (id) {
      blocks = blocks.filter(b => b.id !== id);
      saveBlocksForDate();
      renderBlocks();
    }
    closeBlockModal();
  });

  btnAddBlock.addEventListener("click", () => {
    openBlockModal({
      startMinutes: 540, // 09:00
      endMinutes: 600, // 10:00
      category: "work",
      color: CATEGORY_COLORS["work"],
    });
  });

  modalClose.addEventListener("click", closeBlockModal);
  btnCancelBlock.addEventListener("click", closeBlockModal);

  // Clear All
  btnClear.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all blocks for this date?")) {
      blocks = [];
      saveBlocksForDate();
      renderBlocks();
    }
  });

  // Preset Sidebar Drag-and-Drop
  presetList.querySelectorAll(".preset-item").forEach(preset => {
    preset.addEventListener("click", () => {
      const cat = preset.dataset.category;
      openBlockModal({
        title: CATEGORY_NAMES[cat] || "New Activity",
        category: cat,
        color: preset.dataset.color,
        startMinutes: 540,
        endMinutes: 600,
      });
    });
  });

  // Load Sample Schedule
  btnSample.addEventListener("click", () => {
    blocks = [
      {
        id: "s1",
        title: "Morning Routine & Coffee",
        category: "break",
        color: CATEGORY_COLORS["break"],
        startMinutes: 420,
        endMinutes: 480,
        notes: "Meditation & Review Day Goals",
      },
      {
        id: "s2",
        title: "Deep Work: Core Feature Dev",
        category: "deep-work",
        color: CATEGORY_COLORS["deep-work"],
        startMinutes: 540,
        endMinutes: 660,
        notes: "Build architecture & code logic",
      },
      {
        id: "s3",
        title: "Team Sync & Standup",
        category: "meeting",
        color: CATEGORY_COLORS["meeting"],
        startMinutes: 660,
        endMinutes: 720,
        notes: "Discuss progress & blockers",
      },
      {
        id: "s4",
        title: "Lunch Break",
        category: "meal",
        color: CATEGORY_COLORS["meal"],
        startMinutes: 720,
        endMinutes: 780,
        notes: "Healthy meal & quick walk",
      },
      {
        id: "s5",
        title: "Code Review & PRs",
        category: "work",
        color: CATEGORY_COLORS["work"],
        startMinutes: 780,
        endMinutes: 870,
        notes: "Review community PRs",
      },
      {
        id: "s6",
        title: "Workout & Fitness",
        category: "exercise",
        color: CATEGORY_COLORS["exercise"],
        startMinutes: 1020,
        endMinutes: 1080,
        notes: "Gym / Run session",
      },
      {
        id: "s7",
        title: "Learning & Reading",
        category: "study",
        color: CATEGORY_COLORS["study"],
        startMinutes: 1140,
        endMinutes: 1200,
        notes: "Read tech article or book",
      },
    ];
    saveBlocksForDate();
    renderBlocks();
  });

  // Export Menu Toggle
  btnExportMenu.addEventListener("click", e => {
    e.stopPropagation();
    exportDropdownContent.hidden = !exportDropdownContent.hidden;
  });

  document.addEventListener("click", () => {
    exportDropdownContent.hidden = true;
  });

  // Export iCalendar (.ics)
  btnExportIcs.addEventListener("click", () => {
    if (!blocks.length) {
      showAlert("No time blocks to export!");
      return;
    }
    const icsContent = typeof PlannerEngine !== "undefined"
      ? PlannerEngine.generateICalendar(blocks, currentDate)
      : "";

    downloadFile(icsContent, `schedule_${currentDate}.ics`, "text/calendar");
  });

  // Export JSON
  btnExportJson.addEventListener("click", () => {
    const dataStr = JSON.stringify({ date: currentDate, blocks }, null, 2);
    downloadFile(dataStr, `schedule_${currentDate}.json`, "application/json");
  });

  // Export Text Summary (.md)
  btnExportText.addEventListener("click", () => {
    let mdStr = `# Daily Schedule Summary (${currentDate})\n\n`;
    mdStr += `## Time Blocks:\n`;

    blocks.forEach(b => {
      mdStr += `- **${minutesToTimeString(b.startMinutes)} - ${minutesToTimeString(b.endMinutes)}**: ${b.title} (${CATEGORY_NAMES[b.category] || b.category})\n`;
      if (b.notes) mdStr += `  *Notes:* ${b.notes}\n`;
    });

    downloadFile(mdStr, `schedule_${currentDate}.md`, "text/markdown");
  });

  // Import JSON File
  importJsonFile.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed.blocks)) {
          blocks = parsed.blocks;
          saveBlocksForDate();
          renderBlocks();
          showAlert("Schedule imported successfully!", true);
        } else if (Array.isArray(parsed)) {
          blocks = parsed;
          saveBlocksForDate();
          renderBlocks();
          showAlert("Schedule imported successfully!", true);
        }
      } catch (err) {
        showAlert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  });

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  let alertTimeout;
  function showAlert(message, isSuccess = false) {
    const container = document.getElementById("alertContainer");
    const messageEl = document.getElementById("alertMessage");
    if (container && messageEl) {
      messageEl.textContent = message;
      if (isSuccess) {
        container.classList.add("success");
        container.querySelector(".alert-icon").textContent = "✅";
      } else {
        container.classList.remove("success");
        container.querySelector(".alert-icon").textContent = "⚠️";
      }
      container.style.display = "flex";
      clearTimeout(alertTimeout);
      alertTimeout = setTimeout(() => {
        container.style.display = "none";
      }, 5000);
    }
  }

  // Initialize
  initTimelineScale();
  loadBlocksForDate(currentDate);
  updateCurrentTimeIndicator();
});
