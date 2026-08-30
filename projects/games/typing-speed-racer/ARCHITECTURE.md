# Project Architecture

## Overview

Typing Speed Racer is a single-player typing speed test with a racing twist. Players type words to move their car along a race track while competing against an AI opponent. The game tracks WPM, accuracy, streaks, and provides visual feedback through an animated race track.

The project is self-contained with no external dependencies — just HTML, CSS, and vanilla JavaScript.

---

## Purpose & Goals

- Test typing speed in an engaging, gamified format
- Provide visual feedback through a race track with animated cars
- Track WPM, accuracy, streaks, and best scores
- Offer three difficulty levels (easy, medium, hard) with different word banks
- Work offline with localStorage persistence for best scores

---

## Folder Structure

```text
typing-speed-racer/
├── index.html          # Page shell, race track, stats, results overlay
├── script.js           # Game logic, word bank, timer, input handling
├── style.css           # Layout, race track, animations, responsive design
├── ARCHITECTURE.md     # This file
└── thumbnail.svg       # Preview thumbnail
```

---

## System / Project Architecture Overview

The game follows a state-driven loop. The `state` object in `script.js` tracks the race progress, timer, and player performance. Input is captured in real-time, and every word submitted triggers a state update and a corresponding visual update to the race track (moving the player's car) and the stats bar. An interval-based tick manages the countdown timer and the movement of the AI opponent.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | UI shell, race track lanes, stats display, and the results overlay |
| `script.js` | Word generation, WPM calculation, timer management, and car movement logic |
| `style.css` | Visuals for the race track, animations for cars and streaks, and responsive layout |

---

## Data Flow / Execution Flow

```
User selects difficulty and clicks 'Start Race'
↓
Game state initialized → Words generated → Timer starts
↓
User types word → Space pressed
↓
Word validated against current target
↓
If correct: state.correctWords++ → Player car moves forward → Streak increments
↓
If wrong: state.wrongWords++ → Streak resets to 0
↓
setInterval(tick) runs every second → Timer decreases → AI car moves
↓
Timer reaches 0 → endGame() triggered
↓
Final WPM calculated → Rank assigned → Results overlay displayed
```

---

## Key Features

| Feature | Description |
|---|---|
| **Race Track** | Visual lanes with player and AI cars that move based on typing progress |
| **3 Difficulty Levels** | Easy (3-letter words), Medium (5-letter words), Hard (8+ letter words) |
| **Time Modes** | 30s, 60s, or 120s race durations |
| **Streak System** | Consecutive correct words build streaks with visual feedback |
| **Boost Mechanic** | Every 5-streak correct words gives the player a speed boost |
| **AI Opponent** | Moves at difficulty-based speed, creating competitive pressure |
| **Live Stats** | WPM, accuracy, streak, correct/wrong counts, and time remaining |
| **Results Screen** | Final stats with rank classification (Sunday Driver → Formula 1 Legend) |
| **Best Score** | Persisted in localStorage across sessions |

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Semantic structure and UI components |
| CSS3 | Animations, race track layout, and responsive design |
| JavaScript (ES6+) | Game loop, WPM math, and DOM manipulation |
| localStorage API | Persisting best scores |

---

## File Responsibilities

### `index.html`

- Provides the layout for the racing lanes and the input field.
- Hosts the stats bar and the results modal.

### `script.js`

- `startGame()`: Initializes the game state and timer.
- `tick()`: Manages the second-by-second updates for the timer and AI.
- `calculateWpm()`: Computes words per minute based on elapsed time and correct words.
- `endGame()`: Finalizes the race, updates best score, and shows results.

### `style.css`

- Implements the `.car-icon` animations and the race track visual.
- Defines the `.streak-flash` and `.boost-glow` visual effects.
- Ensures the layout adapts to different screen sizes.

---

## Design Decisions

- **No frameworks**: Pure vanilla JS for fast loading and zero dependencies.
- **Word batching**: Generates 60 words initially, adds 30 more when running low to avoid huge initial arrays.
- **Live feedback**: Input border turns green/red for correct/misspelled partial matches to guide the user.
- **Car animation**: CSS transitions for smooth car movement (0.3s ease-out).
- **localStorage**: Best WPM persisted under `cradle:typing-racer-best-wpm`.

---

## Dependencies

None (uses native browser APIs).

---

## Future Improvements

- Add a multiplayer mode using WebSockets.
- Integrate a more diverse dictionary API for word generation.
- Add sound effects for correct words and race finish.

---

## Known Limitations

- The AI opponent speed is linear and doesn't adapt to the player's skill.
- WPM calculation is simplified (correct words / elapsed time).

---

## Development Notes

- Words are shuffled using a Fisher-Yates inspired shuffle.
- AI speed varies by difficulty: Easy (0.3), Medium (0.6), Hard (0.9).

---

## License & Attribution
- **Project License:** MIT
- **Third-Party Assets:** None.

---

## References

- [MDN Web Docs — localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [Fisher-Yates Shuffle Algorithm](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle)
