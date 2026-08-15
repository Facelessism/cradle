function loadData() {
  const defaults = { subjects: [], logs: [] };
  try {
    return JSON.parse(localStorage.getItem("att_v5")) || defaults;
  } catch {
    // Corrupt/non-JSON value in storage would otherwise throw here and break
    // the whole page on load; fall back to a clean default instead.
    return defaults;
  }
}

let data = loadData();

let alertTimeout;
function showAlert(message) {
  const banner = document.getElementById("alertBanner");
  const msgEl = document.getElementById("alertMessage");
  if (banner && msgEl) {
    msgEl.textContent = message;
    banner.style.display = "flex";
    clearTimeout(alertTimeout);
    alertTimeout = setTimeout(() => {
      banner.style.display = "none";
    }, 5000);
  }
}

function render() {
  const body = document.getElementById("attendance-body");
  const logBox = document.getElementById("history-log");
  body.innerHTML = "";
  logBox.innerHTML = "";

  const stats = calculateStats(data.subjects);
  const overallPctEl = document.getElementById("overallAttendance");
  const totalCondEl = document.getElementById("totalConducted");
  const belowTgtEl = document.getElementById("belowTargetCount");

  if (overallPctEl) overallPctEl.textContent = `${stats.overallPercentage}%`;
  if (totalCondEl) totalCondEl.textContent = stats.totalConducted;
  if (belowTgtEl) belowTgtEl.textContent = stats.belowTargetCount;

  data.subjects.forEach((s, i) => {
    const targetPct = s.target || 80;
    const targetDec = targetPct / 100;

    const conducted = s.p + s.a;
    const remaining = s.total - conducted;
    const currentPct =
      conducted === 0 ? 0 : ((s.p / conducted) * 100).toFixed(1);

    const neededTotal = Math.ceil(targetDec * s.total);
    const neededFromRemaining = Math.max(0, neededTotal - s.p);

    // Create main row container
    const tr = document.createElement("tr");

    // Column 1: Subject Name (XSS Safe via textContent)
    const tdName = document.createElement("td");
    const bName = document.createElement("b");
    bName.textContent = s.name;
    tdName.appendChild(bName);
    tr.appendChild(tdName);

    // Column 2: Total Classes Input
    const tdTotal = document.createElement("td");
    const inputTotal = document.createElement("input");
    inputTotal.type = "number";
    inputTotal.value = s.total;
    inputTotal.style.width = "50px";
    inputTotal.addEventListener("change", () =>
      updateTotal(i, inputTotal.value)
    );
    tdTotal.appendChild(inputTotal);
    tr.appendChild(tdTotal);

    // Column 3: Present Counter Group
    const tdPresent = document.createElement("td");
    const divPGroup = document.createElement("div");
    divPGroup.className = "counter-group";

    const btnPDec = document.createElement("button");
    btnPDec.className = "btn btn-dec";
    btnPDec.textContent = "-";
    btnPDec.addEventListener("click", () => update(i, "p", -1));

    const spanP = document.createElement("span");
    spanP.textContent = s.p;

    const btnPInc = document.createElement("button");
    btnPInc.className = "btn btn-inc";
    btnPInc.textContent = "+";
    btnPInc.addEventListener("click", () => update(i, "p", 1));

    divPGroup.appendChild(btnPDec);
    divPGroup.appendChild(spanP);
    divPGroup.appendChild(btnPInc);
    tdPresent.appendChild(divPGroup);
    tr.appendChild(tdPresent);

    // Column 4: Absent Counter Group
    const tdAbsent = document.createElement("td");
    const divAGroup = document.createElement("div");
    divAGroup.className = "counter-group";

    const btnADec = document.createElement("button");
    btnADec.className = "btn btn-dec";
    btnADec.textContent = "-";
    btnADec.addEventListener("click", () => update(i, "a", -1));

    const spanA = document.createElement("span");
    spanA.textContent = s.a;

    const btnAInc = document.createElement("button");
    btnAInc.className = "btn btn-inc";
    btnAInc.textContent = "+";
    btnAInc.addEventListener("click", () => update(i, "a", 1));

    divAGroup.appendChild(btnADec);
    divAGroup.appendChild(spanA);
    divAGroup.appendChild(btnAInc);
    tdAbsent.appendChild(divAGroup);
    tr.appendChild(tdAbsent);

    // Column 5: Current Percentage Label
    const tdPct = document.createElement("td");
    tdPct.style.color =
      parseFloat(currentPct) < targetPct ? "var(--danger)" : "var(--success)";
    tdPct.style.fontWeight = "bold";
    tdPct.textContent = `${currentPct}%`;
    tr.appendChild(tdPct);

    // Column 6: Goal Status (Using innerHTML for inner layout formatting safely since parameters are fixed numbers)
    const tdGoal = document.createElement("td");
    if (neededFromRemaining > remaining) {
      tdGoal.innerHTML = `<span style="color:var(--danger)"><b>Impossible</b><br>Max possible: ${(((s.p + remaining) / s.total) * 100).toFixed(1)}%</span>`;
    } else {
      tdGoal.innerHTML = `Attend <b>${neededFromRemaining}</b> more<br><small>out of ${remaining} left</small>`;
    }
    tr.appendChild(tdGoal);

    // Column 7: Remove Row Action Trigger Button
    const tdRemove = document.createElement("td");
    const btnRemove = document.createElement("button");
    btnRemove.className = "btn";
    btnRemove.style.color = "#94a3b8";
    btnRemove.style.background = "transparent";
    btnRemove.innerHTML = "&times;";
    btnRemove.addEventListener("click", () => removeSub(i));
    tdRemove.appendChild(btnRemove);
    tr.appendChild(tdRemove);

    body.appendChild(tr);
  });

  // Render Log Items cleanly without innerHTML compilation loops
  if (data.logs.length === 0) {
    // Show empty state when there are no history entries
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "history-empty";
    emptyMsg.textContent = "No attendance history yet.";
    logBox.appendChild(emptyMsg);
  } else {
    data.logs
      .slice(-15)
      .reverse()
      .forEach(log => {
        const logDiv = document.createElement("div");
        logDiv.className = "history-item";

        const spanSub = document.createElement("span");
        const bSub = document.createElement("b");
        bSub.textContent = log.sub; // Safe text injection
        spanSub.appendChild(bSub);

        const spanType = document.createElement("span");
        spanType.textContent = log.type;

        logDiv.appendChild(spanSub);
        logDiv.appendChild(spanType);
        logBox.appendChild(logDiv);
      });
  }

  localStorage.setItem("att_v5", JSON.stringify(data));

  updateChart();
}

let attendanceChart = null;

function updateChart() {
  const ctx = document.getElementById("attendanceChart");
  if (!ctx) return;

  let totalPresent = 0;
  let totalAbsent = 0;

  data.subjects.forEach(s => {
    totalPresent += s.p;
    totalAbsent += s.a;
  });

  if (totalPresent === 0 && totalAbsent === 0) {
    if (attendanceChart) {
      attendanceChart.destroy();
      attendanceChart = null;
    }
    return;
  }

  if (attendanceChart) {
    attendanceChart.data.datasets[0].data = [totalPresent, totalAbsent];
    attendanceChart.update();
  } else {
    attendanceChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Present", "Absent"],
        datasets: [
          {
            data: [totalPresent, totalAbsent],
            backgroundColor: ["#16a34a", "#dc2626"],
            hoverOffset: 4,
          },
        ],
      },
    });
  }
}

function exportCSV() {
  if (!data.subjects || data.subjects.length === 0) {
    showAlert("No data to export.");
    return;
  }
  const csv = exportToCSV(data.subjects);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", "attendance_data.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function triggerImport() {
  const fileInput = document.getElementById("csvFileInput");
  if (fileInput) fileInput.click();
}

function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    const imported = parseCSV(text);
    if (imported && imported.length > 0) {
      if (
        confirm(
          `Are you sure you want to import ${imported.length} subjects? This will overwrite your current list.`
        )
      ) {
        data.subjects = imported;
        data.logs.push({
          sub: "All Subjects",
          type: "Imported CSV",
          date: new Date().toLocaleTimeString(),
        });
        render();
      }
    } else {
      showAlert("No valid subject data found in CSV.");
    }
  };
  reader.readAsText(file);
}

function openModal() {
  document.getElementById("addModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("addModal").style.display = "none";
  document.getElementById("newSubjectForm").reset();
}

window.addEventListener("click", event => {
  let modal = document.getElementById("addModal");
  if (event.target === modal) {
    closeModal();
  }
});

function addSubject(event) {
  event.preventDefault();

  const name = document.getElementById("subName").value;
  const total = document.getElementById("subTotal").value;
  const target = document.getElementById("subTarget").value;

  if (name && total && target) {
    data.subjects.push({
      name: name,
      p: 0,
      a: 0,
      total: parseInt(total),
      target: parseFloat(target),
    });
    render();
    closeModal();
  }
}

function updateTotal(i, val) {
  const subject = data.subjects[i];
  const conducted = subject.p + subject.a;

  subject.total = Math.max(parseInt(val) || 1, conducted);

  render();
}

function update(i, field, val) {
  const subject = data.subjects[i];

  if (val === -1 && subject[field] === 0) return;

  const conducted = subject.p + subject.a;

  if (val === 1 && conducted >= subject.total) {
    showAlert("Total classes limit reached.");
    return;
  }

  subject[field] += val;

  data.logs.push({
    sub: subject.name,
    type: (field === "p" ? "P" : "A") + (val > 0 ? "+" : "-"),
    date: new Date().toLocaleTimeString(),
  });

  render();
}

function removeSub(i) {
  if (confirm("Delete?")) {
    data.subjects.splice(i, 1);
    render();
  }
}

// Clears all stored attendance history and refreshes the history list
function clearHistory() {
  if (!confirm("Are you sure you want to clear all history?")) return;

  data.logs = [];
  render();
}

document
  .querySelector(".btn-export-action")
  .addEventListener("click", exportCSV);
document
  .querySelector(".btn-import-action")
  .addEventListener("click", triggerImport);
document
  .getElementById("csvFileInput")
  .addEventListener("change", importCSV);
document
  .getElementById("btn-new-subject")
  .addEventListener("click", openModal);
document
  .querySelector(".btn-clear-history-action")
  .addEventListener("click", clearHistory);
document.querySelector(".close-btn").addEventListener("click", closeModal);
document
  .getElementById("newSubjectForm")
  .addEventListener("submit", addSubject);

render();
