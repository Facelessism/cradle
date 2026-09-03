function calculateStats(subjects) {
  if (!subjects || subjects.length === 0) {
    return {
      totalConducted: 0,
      totalPresent: 0,
      overallPercentage: 0,
      belowTargetCount: 0,
    };
  }

  let totalConducted = 0;
  let totalPresent = 0;
  let belowTargetCount = 0;

  subjects.forEach(s => {
    const conducted = s.p + s.a;
    totalConducted += conducted;
    totalPresent += s.p;

    const currentPct = conducted === 0 ? 0 : (s.p / conducted) * 100;
    const targetPct = s.target || 80;
    if (currentPct < targetPct) {
      belowTargetCount++;
    }
  });

  const overallPercentage =
    totalConducted === 0
      ? 0
      : parseFloat(((totalPresent / totalConducted) * 100).toFixed(1));

  return {
    totalConducted,
    totalPresent,
    overallPercentage,
    belowTargetCount,
  };
}

function exportToCSV(subjects) {
  if (!subjects || subjects.length === 0) return "";
  const headers = ["Subject", "Total Classes", "Present", "Absent", "Target"];
  const rows = subjects.map(s => [
    `"${s.name.replace(/"/g, '""')}"`,
    s.total,
    s.p,
    s.a,
    s.target || 80,
  ]);
  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length <= 1) return [];

  const subjects = [];
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parse supporting quoted names with commas
    const matches = line.match(/(".*?"|[^,\s]+)(?=\s*,|\s*$)/g);
    if (!matches || matches.length < 4) continue;

    const name = matches[0].replace(/^"|"$/g, "").replace(/""/g, '"');
    const total = parseInt(matches[1], 10);
    const p = parseInt(matches[2], 10);
    const a = parseInt(matches[3], 10);
    const target = matches[4] ? parseInt(matches[4], 10) : 80;

    if (!isNaN(total) && !isNaN(p) && !isNaN(a)) {
      subjects.push({ name, total, p, a, target });
    }
  }
  return subjects;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculateStats, exportToCSV, parseCSV };
}
