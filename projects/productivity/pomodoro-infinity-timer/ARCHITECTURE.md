# Project Architecture

## Overview

Pomodoro Infinity Timer is a beautiful, customizable Pomodoro timer featuring an infinity loop SVG visual that fills as time progresses. It includes session tracking, ambient sounds via Web Audio API, and persistent stats.

Self-contained with no dependencies — vanilla HTML, CSS, and JavaScript.

---

## Purpose & Goals

- Provide an elegant, distraction-free Pomodoro timer
- Visualize time progress through an infinity loop animation
- Track daily focus sessions, streaks, and total time
- Offer ambient sounds for focus environments
- Persist settings and daily stats in localStorage

---

## Folder Structure

```text
pomodoro-infinity-timer/
├── index.html          # Timer shell, settings, session log
├── script.js           # Timer logic, infinity animation, sounds, stats
├── style.css           # Dark theme, infinity glow, responsive
├── ARCHITECTURE.md     # This file
└── thumbnail.svg       # Preview thumbnail
```

---

## Key Features

| Feature | Description |
|---|---|
| **Infinity Loop Visual** | SVG path that fills as time progresses, with glowing dot |
| **3 Modes** | Focus (25m), Short Break (5m), Long Break (15m) |
| **Customizable Times** | All durations and sessions configurable |
| **Session Tracking** | Dots showing progress toward long break |
| **Stats** | Streak, today's total time, sessions completed, best streak |
| **Ambient Sounds** | Rain, Forest, Café, Fireplace, Waves (Web Audio API) |
| **Sound Notifications** | Musical chimes for session complete/break done |
| **Auto-start** | Optionally auto-start next session |
| **Today's Log** | Timestamped record of all sessions |
| **Keyboard Shortcuts** | Space (start/pause), R (reset), S (skip) |
| **Persistence** | Settings and today's stats saved in localStorage |

---

## Technical Decisions

- **Infinity SVG path**: Custom cubic bezier path with `stroke-dashoffset` animation
- **Web Audio API**: All sounds generated programmatically (no audio files needed)
- **Noise generation**: Different filter shapes for rain/forest/café/fire/waves
- **localStorage**: Saves config + today's state (resets on new day)
- **Tabular nums**: Font feature for clean timer countdown
