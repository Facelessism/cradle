# Architecture Blueprint: Attendance Tracker

## Overview

The Attendance Tracker is a lightweight, client-side mini-application designed to help students or professionals log, calculate, and monitor their attendance percentages. It provides a visual indicator of whether they meet minimum attendance thresholds without requiring a database backend.

---

## Purpose & Goals

- Help students and professionals log and monitor attendance percentages across multiple subjects.
- Show at a glance whether each subject meets a configurable target percentage.
- Provide a real-time dashboard with overall attendance, total classes conducted, and subjects below target.
- Visualize present versus absent totals with a pie chart.
- Keep data available across browser restarts using `localStorage`, with no backend required.

---

## Folder Structure

```text
├── index.html        # Main dashboard layout and semantic structural DOM
├── data-handler.js   # Metrics calculations and CSV import/export handlers
├── script.js         # State tracking, DOM event listeners, and UI sync
├── style.css        # Scoped UI styles, themes, and dashboard layouts
└── ARCHITECTURE.md    # System design documentation (This file)
```

---

## System / Project Architecture Overview

The application uses a standard decoupled **Frontend-First Architecture** where state is entirely handled in the user's browser runtime.

```
[ UI Dashboard ] ──(User Input)──> [ State & Calculation Logic ]
│                                │
└────────(Auto-Save)─────────────> [ LocalStorage ]
```

1. **View Layer (DOM):** Renders the tracking dashboard, input forms for classes attended/total classes, and progress bars.
2. **Calculation Engine:** Processes the raw input to compute real-time attendance percentages and determines the exact number of consecutive classes needed to reach target goals.
3. **Persistence Layer:** Uses the Web Storage API (`localStorage`) to cache user data across sessions seamlessly.

---

## Component Breakdown

| File | Responsibility |
| --- | --- |
| `index.html` | Dashboard shell, stat cards, subjects table, recent history panel, chart canvas, and the Add New Subject modal. |
| `data-handler.js` | Pure logic: `calculateStats()`, `exportToCSV()`, and `parseCSV()`. Uses a CommonJS export so it can be unit tested in Node.js. |
| `script.js` | State loading, `render()`, subject add/update/remove, history logging, CSV import/export, chart updates, and modal wiring. |
| `style.css` | Scoped UI styles, themes, counter groups, stat cards, tables, and modal layout. |

---

## Data Flow / Execution Flow

```text
User opens index.html
        ↓
Browser loads style.css, tokens.css, Chart.js (CDN), Cradle UI scripts, data-handler.js, script.js
        ↓
script.js calls loadData() → reads the "att_v5" localStorage key
        ↓
render() recomputes stats, redraws the subjects table and recent history log
        ↓
updateChart() renders the Present / Absent pie chart via Chart.js
        ↓
User clicks + / − counters, edits total classes, or submits the Add Subject modal
        ↓
update() / addSubject() mutate state and append history log entries
        ↓
render() saves state back to localStorage and refreshes the UI
```

---

## Key Features

- Per-subject `+` / `−` counters for present and absent classes.
- Live attendance percentage per subject with green/red target indicators.
- Goal column showing how many more classes to attend (or "Impossible" when the target can no longer be reached).
- Dashboard stat cards: overall attendance, total classes conducted, and subjects below target.
- Recent history log with a Clear History action.
- Present versus Absent pie chart rendered with Chart.js.
- CSV export and import for data portability.
- Add New Subject modal with name, estimated total classes, and target percentage.
- Automatic saving to `localStorage` on every change.

---

## Technologies Used

| Technology | Purpose |
| --- | --- |
| HTML5 | Semantic dashboard structure, stat cards, tables, and modal form |
| CSS3 (Custom Properties) | Dashboard theming and layouts via `style.css` and Cradle `tokens.css` |
| Vanilla JavaScript (ES6+) | State management, DOM rendering, CSV handling, and event wiring |
| localStorage API | Persisting subjects and history under the `att_v5` key |
| Chart.js (CDN) | Rendering the Present / Absent pie chart |
| Cradle UI components | Shared `Button.js`, `Card.js`, `BackToHome.js`, and design tokens |

---

## File Responsibilities

### `script.js`

- `loadData()` — reads and safely parses the `att_v5` localStorage value, falling back to empty defaults on corrupt data.
- `render()` — redraws the stats dashboard, subjects table, and recent history, then persists state.
- `update(i, field, val)` — increments or decrements a subject's present/absent counters and logs the change.
- `updateTotal(i, val)` — adjusts the total class count, clamping it to at least the number of conducted classes.
- `addSubject(event)` — reads the modal form and pushes a new subject into state.
- `removeSub(i)` / `clearHistory()` — delete a subject or wipe the history log.
- `exportCSV()` / `importCSV(event)` — download or read subject data as CSV.
- `updateChart()` — creates or updates the Chart.js pie chart.
- `openModal()` / `closeModal()` — show and hide the Add Subject dialog.

### `data-handler.js`

- `calculateStats(subjects)` — returns overall percentage, total conducted, and below-target count.
- `exportToCSV(subjects)` — builds a CSV string with a header row and quoted names.
- `parseCSV(csvText)` — parses CSV text into subject objects, defaulting the target to 80 when missing.

---

## Design Decisions

- **Counter-based input** — `+` / `−` buttons replace free-form numeric entry, reducing invalid values.
- **Input validation** — counters cannot exceed total classes, and total classes are clamped to at least the conducted count.
- **XSS-safe rendering** — user-provided names are inserted with `textContent` instead of `innerHTML`.
- **Chart.js from CDN** — adds charting without a build step or bundled dependency.
- **Single render pass** — `render()` rebuilds the table, history, and chart from the current state so the UI never drifts from the data.

---

## Dependencies

| Dependency | Version | How loaded | Purpose |
| --- | --- | --- | --- |
| Chart.js | latest | CDN (`<script>` from cdn.jsdelivr.net) | Pie chart rendering |

The project also loads shared Cradle UI files (`tokens.css`, `Button.js`, `Card.js`, `BackToHome.js`) from the repository's `src/components/ui` directory.

---

## Future Improvements

- Add per-subject CSV export and selective history filtering.
- Support multiple attendance targets per course term.
- Add search and sorting for the subjects table.
- Add a yearly summary view.
- Add touch/pointer support for counters on mobile devices.

---

## Known Limitations

- Data is stored only in the current browser's `localStorage`; clearing browser data erases it.
- CSV import expects the fixed header format written by `exportToCSV`.
- The chart only shows overall present versus absent totals, with no per-subject breakdown.
- No cloud sync or multi-device support.

---

## Development Notes

- Open `index.html` through a local server (e.g. `python3 -m http.server 8000`), or serve from the repository root, so the shared Cradle UI assets load correctly.
- `data-handler.js` exposes a CommonJS export and can be unit tested with Node.js.
- No build step is required — edit the files and refresh the browser.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - Chart.js by the Chart.js project (https://www.chartjs.org), loaded from the jsDelivr CDN.

---

## References

- [MDN Web Docs — Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [Chart.js](https://www.chartjs.org/)
