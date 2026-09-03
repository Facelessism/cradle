# Project Architecture — Pomodoro Timer

---

## Overview

The Pomodoro Timer is a focused work timer designed to help users manage their productivity using the Pomodoro Technique. It features configurable work and break durations, an animated SVG progress ring, and comprehensive session tracking with daily logs.

The project is self-contained, using vanilla HTML, CSS, and JavaScript, with the Web Audio API for notifications.

---

## Purpose & Goals

- Help users maintain deep focus through structured work/break cycles
- Provide a visual representation of time remaining via an animated ring
- Track productivity metrics including total focus minutes, sessions completed, and streaks
- Persist settings and session history locally to avoid data loss on refresh
- Offer keyboard shortcuts for a streamlined, distraction-free experience

---

## Folder Structure

```text
pomodoro-timer/
├── index.html         # Page shell, UI structure, and settings panel
├── script.js          # Timer engine, sound synthesis, state management, and UI events
├── style.css          # Layout, mode-dependent theming, and responsive design
└── ARCHITECTURE.md    # This file
```

---

## System / Project Architecture Overview

The application uses a simple state-machine architecture. The core state (current mode, time remaining, and session counts) is managed in `script.js`. A central `setInterval` loop handles the countdown, triggering an update to the numeric display and the SVG `stroke-dashoffset` of the progress ring. Mode transitions (e.g., Focus → Short Break) are handled by a logic layer that checks the number of completed sessions against a user-defined threshold for long breaks.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Defines the timer UI, settings inputs, and the SVG ring structure |
| `script.js` | Implements the timer loop, handles localStorage persistence, and manages audio beeps |
| `style.css` | Handles the visual identity, including mode-specific accent colors and responsive breakpoints |

---

## Data Flow / Execution Flow

```
User interaction (Start / Pause / Reset / Mode Change)
↓
update state (currentMode, timeRemaining, isRunning)
↓
setInterval tick (every 1 second)
    ↳ Decrement timeRemaining
    ↳ updateDisplay() → Update numeric timer and Page Title
    ↳ updateRing() → Calculate progress and update SVG stroke-dashoffset
↓
Timer reaches zero
    ↳ playBeep() via Web Audio API
    ↳ update stats (sessionsCompleted, totalFocusMinutes, currentStreak)
    ↳ addLogEntry() → Add timestamped session to todayLog
    ↳ Transition to next mode (e.g., Short Break or Long Break)
↓
saveState() → Sync settings and stats to localStorage
```

---

## Key Features

- **Mode-Driven UI**: The entire interface changes its accent color based on the mode (Red for Focus, Green for Short Break, Indigo for Long Break).
- **Animated Progress Ring**: An SVG ring that depletes as time passes, providing a clear visual cue of remaining time.
- **Persistence Layer**: All settings and daily session logs are saved to `localStorage`, resetting only at midnight.
- **Web Audio Beeps**: Programmatically generated tones for session completion, eliminating the need for external audio files.
- **Productivity Dashboard**: A dedicated section tracking total focus minutes and current streaks.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Semantic page structure and SVG graphics |
| CSS3 (Grid/Flexbox) | Layout and mode-specific theming |
| Vanilla JavaScript | Timer logic, state management, and DOM manipulation |
| Web Audio API | Programmatic sound notifications |
| localStorage | Client-side persistence of user data |

---

## File Responsibilities

### `index.html`

- Houses the timer digits, mode buttons, and settings form.
- Defines the SVG ring with a specific circumference for precise animation.

### `script.js`

- `startTimer()` / `pauseTimer()`: Controls the `setInterval` loop.
- `updateRing()`: Maps the ratio of `timeRemaining / totalTime` to the ring's offset.
- `onTimerComplete()`: Manages the logic for transitioning between Pomodoro phases.
- `saveState()` / `loadState()`: Handles serialization of data to `localStorage`.

### `style.css`

- Implements the responsive layout and the `.mode-pomodoro`, `.mode-shortBreak`, and `.mode-longBreak` classes.
- Ensures the timer digits remain centered and clear across different screen sizes.

---

## Design Decisions

- **Accent Colors for Modes**: Chosen to provide immediate subconscious feedback to the user about their current state (Focus vs. Break).
- **localStorage-Based Logging**: Used to provide a "daily log" feel without requiring a backend database.
- **Web Audio API**: Used instead of `<audio>` tags to ensure the notification sounds are generated instantly and without network latency.
- **Symmetric Ring Logic**: Used `2 * PI * R` for the circumference to ensure the SVG stroke matches the visual circle perfectly.

---

## Dependencies

None (uses native browser APIs).

---

## Future Improvements

- Integration with browser Notification API for background alerts.
- Support for multiple Pomodoro profiles (e.g., "Intense" vs "Relaxed").
- Ability to export daily logs as a CSV or JSON file.

---

## Development Notes

- The ring animation relies on the `stroke-dasharray` and `stroke-dashoffset` properties of the SVG circle.
- To avoid layout shift, a monospace font (Fira Code) is used for the timer digits.

---

## Known Limitations

- Timer precision can drift slightly over long periods due to `setInterval` behavior in background tabs.
- No multi-device synchronization.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None.

---

## References

- [MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [SVG Stroke-Dasharray Guide](https://developer.mozilla.org/en-US/docs/Web/API/CSS/stroke-dasharray)
- [Pomodoro Technique](https://pomodoro.com/)
