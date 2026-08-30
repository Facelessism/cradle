# Project Architecture — Pomodoro Timer

---

## Overview

Pomodoro Timer is a focused work timer that helps users manage work sessions and breaks
using the Pomodoro Technique. It features configurable durations, an animated SVG progress
ring, sound notifications, session tracking with daily logs, and full localStorage
persistence. Runs entirely in the browser with zero external dependencies.

---

## Purpose & Goals

- Help users maintain focus through timed work/break cycles
- Track daily session count, total focus minutes, and current streak
- Persist settings and session logs across browser refreshes via localStorage
- Provide keyboard shortcuts for hands-free timer control
- Remain lightweight and framework-free for fast loading

---

## Folder Structure

```text
pomodoro-timer/
├── index.html         # Page shell, UI structure, loads scripts
├── script.js          # Timer engine, sound, state management, UI events
├── style.css          # Layout, theming per mode, responsive design
└── ARCHITECTURE.md    # This file
```

---

## Component Breakdown

| File            | Responsibility                                              |
| --------------- | ----------------------------------------------------------- |
| `index.html`    | Page shell, semantic structure, loads fonts and scripts      |
| `script.js`     | Timer engine, Web Audio beep, localStorage, settings, UI   |
| `style.css`     | Layout, mode-dependent accent colors, responsive breakpoints|

---

## Key Features

- Three modes: Focus (25 min), Short Break (5 min), Long Break (15 min)
- Configurable durations for all modes via settings panel
- Animated SVG ring shows time progress with mode-specific accent color
- Web Audio API beep sounds on session completion
- Auto-start next session toggle
- Long break triggers after configurable number of focus sessions
- Session counter, total focus minutes, and streak tracker
- Today's session log with time stamps and session type
- Keyboard shortcuts: Space (start/pause), R (reset), S (skip), 1/2/3 (mode)
- Full localStorage persistence of settings, sessions, and daily log

---

## Technologies Used

| Technology             | Purpose                                |
| ---------------------- | -------------------------------------- |
| HTML5                  | Page structure and semantic markup     |
| CSS3 (Grid, Flexbox)   | Layout and responsive design           |
| Vanilla JavaScript     | Timer engine, audio, state, UI        |
| Web Audio API          | Beep sound notifications              |
| localStorage           | Settings and session persistence      |
| Google Fonts (Outfit)  | UI typography                          |
| Google Fonts (Fira Code)| Timer digits and monospace text       |

---

## Design Decisions

- **Mode-specific accent colors** — the UI changes its primary accent color per mode
  (red for focus, green for short break, indigo for long break) so users instantly
  know which mode is active without reading the label.
- **Daily log resets at midnight** — the log is keyed by ISO date, so a new day
  automatically starts fresh while preserving the previous day's count for that
  session only.
- **Web Audio API over HTML audio elements** — generating a tone programmatically
  avoids needing an external audio file, keeping the project self-contained.

---

## Known Limitations

- No notification API (browser tab must be visible to see/hear completion)
- No pause-and-resume across page reloads
- No multi-device sync

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None — all code is original.
