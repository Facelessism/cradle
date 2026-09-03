# Project Architecture — Pomodoro Infinity Timer

## Overview

The Pomodoro Infinity Timer is a productivity tool that combines a traditional Pomodoro timer with a meditative infinity loop visual. It allows users to manage focus and break sessions while providing ambient soundscapes and tracking long-term focus statistics.

The project is built using vanilla HTML, CSS, and JavaScript, featuring a custom SVG-based animation and a procedural audio system.

---

## Purpose & Goals

- Provide an elegant and distraction-free environment for the Pomodoro technique
- Visualize time progress through a filling infinity loop SVG path
- Track productivity metrics including daily sessions, streaks, and total focus time
- Deliver immersive ambient sounds (Rain, Forest, Café, etc.) via the Web Audio API
- Persist user settings and daily statistics using browser local storage

---

## Folder Structure

```text
pomodoro-infinity-timer/
├── index.html          # Main timer UI, settings panel, and session log
├── script.js           # Timer logic, SVG animation, audio synthesis, and state management
├── style.css           # Dark theme, infinity glow effects, and responsive layout
├── thumbnail.svg       # Project preview artwork
└── ARCHITECTURE.md     # This file
```

---

## System / Project Architecture Overview

The application is state-driven, centering on a global `state` object that tracks the current mode (Focus, Short Break, Long Break), remaining time, and session progress. The `script.js` file acts as the central controller, managing a `setInterval` loop for the countdown. This loop simultaneously updates the numeric timer display and the `stroke-dashoffset` of the infinity SVG path to create a fluid filling effect. Sound management is handled by a procedural audio system that generates ambient noise patterns and musical notifications.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Defines the timer display, mode tabs, settings inputs, and the infinity loop SVG |
| `script.js` | Manages the timer state, controls the SVG animation, generates ambient audio, and handles persistence |
| `style.css` | Implements the "glow" aesthetics, dark mode theme, and the layout for the stats and log panels |

---

## Data Flow / Execution Flow

```
User interaction (Start / Pause / Reset / Mode Change)
↓
update state (mode, running, timeLeft)
↓
tick() interval (every 1 second)
    ↳ Decrement timeLeft
    ↳ updateDisplay() → update numeric timer + page title
    ↳ updateInfinity() → calculate progress % and update SVG stroke-dashoffset
    ↳ Update infinityDot position using path.getPointAtLength()
↓
Session completion
    ↳ Log session to state.log
    ↳ Update stats (streak, todayMinutes)
    ↳ Trigger notification chime
    ↳ Automatically transition to next mode (Focus → Break → Focus)
↓
saveState() → Persist current config and stats to localStorage
```

---

## Key Features

- **Infinity Loop Visual**: A custom cubic bezier SVG path that fills linearly as the timer counts down, with a glowing dot following the path.
- **Flexible Session Logic**: Supports configurable focus and break durations, and a "sessions before long break" threshold.
- **Procedural Ambient Audio**: Uses the Web Audio API to generate noise-based soundscapes (e.g., rain, fire) without requiring external audio files.
- **Productivity Analytics**: Tracks today's total focus time and current/best streaks, persisting these across page reloads.
- **Interactive Session Log**: Provides a timestamped history of the day's focus and break sessions.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | UI structure and SVG graphics |
| CSS3 | Visual aesthetics, animations, and responsive design |
| JavaScript (ES6+) | Timer logic, state management, and audio synthesis |
| Web Audio API | Real-time ambient sound generation and notifications |
| localStorage | Client-side persistence of settings and daily stats |

---

## File Responsibilities

### `index.html`

- Defines the infinity loop SVG path and the glowing marker dot.
- Provides the settings form for customizing timer durations and sounds.

### `script.js`

- `tick()`: The core loop that drives the timer and the visual progress.
- `updateInfinity()`: Maps the time progress percentage to the SVG path length.
- `startAmbient()`: Generates a looping noise buffer with a low-pass filter for atmospheric sounds.
- `completeSession()`: Handles the transition logic between focus and break modes.

### `style.css`

- Uses CSS transitions and filters to create the "infinity glow" effect.
- Implements a clean, tabular-numeric layout for the timer display to prevent layout shift.

---

## Design Decisions

- **SVG `stroke-dashoffset`**: Used for the filling animation because it provides a mathematically precise way to represent progress along a complex path.
- **Procedural Audio**: Chosen over audio files to keep the project lightweight and eliminate the need for asset management.
- **State Persistence**: Implemented a `savedAt` timestamp in `localStorage` to ensure that daily stats are automatically reset when a new day begins.
- **Decoupled Config and State**: Separated user preferences (`config`) from current session data (`state`) for cleaner updates and persistence.

---

## Dependencies

None (uses native browser APIs).

---

## Future Improvements

- Support for "Deep Work" mode (disabling all notifications).
- Integration with a calendar or task list for scheduled Pomodoro sessions.
- Addition of a "Focus Map" visualizing time distribution across different tasks.

---

## Development Notes

- The infinity loop path is a custom SVG path that requires specific `stroke-dasharray` values to function correctly.
- Audio context is resumed on the first interaction to comply with browser security policies.

---

## Known Limitations

- The infinity animation is linear; it does not account for "easing" as the timer reaches zero.
- Ambient sounds are simplified noise patterns and do not replace high-fidelity field recordings.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None.

---

## References

- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [SVG Path API (getPointAtLength)](https://developer.mozilla.org/en-US/docs/Web/API/SVGPathElement/getTotalLength)
- [Pomodoro Technique Guide](https://pomodoro.com/)