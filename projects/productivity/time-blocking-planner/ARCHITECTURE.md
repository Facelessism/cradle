## Overview

Daily Productivity Planner is a tool for planning your daily activities and managing your time. You can create a schedule by placing tasks on a 24-hour timeline and adjust them whenever needed.It helps you stay organized and makes it easy to save or share your schedule.

---

## Purpose & Goals

- Provide a fluid, interactive 24-hour timeline for drag-and-drop daily schedule planning.
- Support real-time block resizing with 15-minute grid snapping.
- Provide multi-format export capabilities for integration with external calendar systems (Google Calendar, Outlook, Apple Calendar).
- Persist daily schedules locally using the browser's `localStorage` API without requiring backend services.

---

## Folder Structure

```text
projects/productivity/time-blocking-planner/
├── index.html        # Entry point, layout grid, control bar, activity palette, modal structure
├── style.css         # Visual styles, 24-hour timeline height tokens, block positioning, handles
├── plannerEngine.js  # Collision detection, category stats breakdown, and iCal generator
├── plannerStorage.js # Local storage provider and JSON import/export sanitizer
├── script.js         # Core logic, mouse drag & resize handling, storage persistence
├── README.md         # Project overview and usage guidelines
└── ARCHITECTURE.md   # Project architecture documentation
```

---

## System / Project Architecture Overview

The application is structured into three main modules:

1. **View / Presentation (`index.html`, `style.css`)**: 24-hour timeline track with 60px/hour scaling (1px = 1min), activity palette sidebar, and modal dialog.
2. **Interactive Engine (`script.js`)**: Mouse event listeners calculating Y-axis offsets for moving and resizing time blocks, enforcing grid snap logic.
3. **Data & Storage Manager (`script.js`)**: Serializes time block data into `localStorage` keyed by date string (`YYYY-MM-DD`) and handles multi-format file exports.

```
User Interaction (Click Timeline / Drag Block / Resize Handle / Export)
                                ↓
                 Event Handlers in script.js
                                ↓
        State Update (StartMinutes, EndMinutes, Categories)
                                ↓
            LocalStorage Persistence & DOM Re-render
```

---

## Component Breakdown

| File         | Responsibility                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `index.html` | Header, date selector, action toolbar, activity palette, timeline track container, modal form            |
| `style.css`  | 24-hour timeline scale styling, drag handles, category color tokens, glassmorphism modal                 |
| `script.js`  | Time block positioning logic, drag move/resize listeners, schedule stats calculation, file export/import |

---

## Data Flow / Execution Flow

```
User opens index.html
        ↓
Browser loads style.css → script.js
        ↓
Initialization: Date initialized to today, 24-hour scale generated
        ↓
Data loaded from localStorage for selected date (or default empty)
        ↓
Timeline blocks rendered with absolute CSS positioning (top = startMinutes, height = duration)
        ↓
User interacts (drags block to reschedule OR resizes edge handle)
        ↓
Mouse position snapped to 15-minute steps → Block state updated → Saved to localStorage & UI refreshed
```

---

## Key Features

- **24-Hour Interactive Timeline Track**: 1px per minute scale with hourly grid lines and live red current-time indicator.
- **Drag-to-Move & Drag-to-Resize**: Direct manipulation of block positions and durations with 15-minute interval snapping.
- **Preset Activity Sidebar**: Quick-add presets for Deep Work, Meetings, Study, Exercise, Meals, and Breaks.
- **iCalendar (.ics) Export**: Generates RFC 5545 compliant `.ics` calendar files.
- **Category Analytics**: Dynamic time breakdown badges calculating total planned hours per category.

---

## Technologies Used

| Technology         | Purpose                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| HTML5              | Page structure, date inputs, file reader API, modal element            |
| CSS3               | Flexbox, CSS Grid, absolute positioning, custom property design tokens |
| Vanilla JavaScript | Mouse drag event calculation, state management, iCal text generator    |
| localStorage API   | Persisting daily schedules across browser sessions                     |

---

## File Responsibilities

### `index.html`

- Defines date selector, toolbar buttons, category palette, 24-hour timeline shell, and block editor modal.

### `script.js`

- `renderBlocks()`: Computes `top` and `height` CSS properties for each time block based on `startMinutes` and `endMinutes`.
- `initDragMove()` & `initResize()`: Handles `mousemove` and `mouseup` events for moving and resizing blocks.
- `saveBlocksForDate()` / `loadBlocksForDate()`: Synchronizes array state with `localStorage`.
- `btnExportIcs`: Constructs VCALENDAR formatted strings for file download.

---

## Design Decisions

- **Pixel-to-Minute Scale (1px = 1min)**: Using 60px height per hour simplifies drag/resize math (`top` in pixels equals `startMinutes` directly).
- **Date-based Storage Keys**: Storing schedules under key `cradle_tb_planner_YYYY-MM-DD` allows separate daily agendas without data pollution.
- **Pure Client-Side iCal Builder**: Generating `.ics` strings natively in JS avoids external backend or library dependencies.

---

## Dependencies

| Dependency | Version | How loaded | Purpose |
| --- | --- | --- | --- |
| Outfit | — | Google Fonts CDN (`<link>` tags) | UI typography |
| JetBrains Mono | — | Google Fonts CDN (`<link>` tags) | Monospace times and labels |

The project otherwise relies exclusively on native browser Web APIs and the shared Cradle `storage.js` and `escapeHtml.js` components.

---

## Future Improvements

- Add recurring block templates (e.g. daily morning routine).
- Add time overlap collision detection with auto-stacking columns.

---

## Known Limitations

- Overlapping time blocks render in the same track lane, which can cause visual stacking if two tasks share identical times.

---

## Development Notes

- Test date changing and schedule exports across browsers.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - Outfit font by The Outfit Project (https://fonts.google.com/specimen/Outfit), loaded from the Google Fonts CDN.
  - JetBrains Mono font by JetBrains (https://fonts.google.com/specimen/JetBrains+Mono), loaded from the Google Fonts CDN.

---

## References

- [MDN Web Docs — Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [RFC 5545 — Internet Calendaring and Scheduling Core Object Specification (iCalendar)](https://datatracker.ietf.org/doc/html/rfc5545)
- [MDN Web Docs — Drag and drop events](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
