# Project Architecture

## Overview

A modular digital implementation of Ludo, the classic board game for up to four players. The board is drawn on an HTML5 Canvas element and redrawn every frame using `requestAnimationFrame`. Tokens animate smoothly between squares, and a 3D CSS dice cube spins to show each roll result.

The core game logic and AI move heuristics are separated into dedicated ES modules (`ludoEngine.js` and `ludoBot.js`), enabling unit testability with Node.js test runner while maintaining full browser compatibility.

Each player can be set to Human or Bot. Bots roll and move automatically using a heuristic evaluator. Game state is automatically saved to `localStorage` so sessions can be resumed after closing the browser.

---

## Purpose & Goals

- Provide a complete, playable digital version of Ludo that runs entirely in the browser with no backend.
- Separate pure game rules into `ludoEngine.js` and AI heuristics into `ludoBot.js` so both can be unit tested headlessly with Node.js.
- Support mixed human and bot players so a single player can always start a game.
- Persist the game to `localStorage` so sessions can be resumed after closing the browser.

---

## Folder Structure

```
ludo-game/
├── index.html       # Page shell, canvas, side panels, modals
├── ludoEngine.js    # Core game rules, track coordinates, token factory, validation
├── ludoBot.js       # Heuristic move evaluator and AI decision engine
├── script.js        # Controller, Canvas rendering engine, event listeners, save/load
└── style.css        # Layout, 3D dice, modal styling, responsive design
```

---

## System / Project Architecture Overview

The project is split into three layers. `ludoEngine.js` and `ludoBot.js` are pure logic modules with UMD wrappers, so the same files work in the browser (loaded via `<script>` tags) and in Node.js for unit testing. `script.js` is the controller: it owns the Canvas render loop, the 3D dice animation, all event listeners, and the `localStorage` save/load system. `index.html` provides the page shell and modals, and `style.css` handles layout and the CSS 3D dice.

The render loop redraws the whole board on every frame, while token movement is driven by an `animProgress` value that is interpolated toward a target coordinate with ease-in-out smoothing. No framework or build step is used.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Page shell, 600x600 canvas, side panels, resume/setup modals, loads the three scripts |
| `ludoEngine.js` | Deterministic game rules: board geometry, move validation, captures, win detection |
| `ludoBot.js` | Heuristic scoring of candidate moves and selection of the best move for bot players |
| `script.js` | Canvas rendering engine, turn controller, event listeners, save/load |
| `style.css` | Layout, 3D dice cube, modals, player indicators, responsive design |

---

## Data Flow / Execution Flow

```
User opens index.html
        ↓
ludoEngine.js & ludoBot.js load → script.js loads
        ↓
Check localStorage for a saved game
  ├─ Found   → show "Resume" modal
  └─ Not found → show "Game Setup" modal
        ↓
User configures player types (Human / Bot) and clicks Start
        ↓
newGame() initialises token positions using LudoEngine.createTokens()
        ↓
requestAnimationFrame starts the render loop (drawBoard + drawTokens)
        ↓
Red's turn begins; if Red is a Bot, rollDice() is called automatically
        ↓
rollDice() → animates the CSS 3D dice → after 1 s sets diceValue
        ↓
checkAutoTurn():
  ├─ No valid moves → nextTurn() after 1 s
  └─ Human's turn  → player clicks a token on the canvas
  └─ Bot's turn    → executeAITurn() calls LudoBot.selectBestMove()
        ↓
executeMove(token) updates token, handles captures via LudoEngine, checks victory
        ↓
animateTokenTo(token) triggers smooth interpolated movement
        ↓
If diceValue was 6 (or token finished) → same player rolls again
Otherwise → nextTurn()
        ↓
saveGame() writes state to localStorage after every move
        ↓
First player to get all 4 tokens to the centre wins
```

---

## Key Features

- Up to four players, each independently set to Human or Bot from the setup modal.
- HTML5 Canvas board with a 15x15 cell layout, four colored homes, a 52-cell global track, 8 safe star squares, and colored victory paths into the center triangles.
- 3D CSS dice cube that rotates to show the rolled face.
- Smooth token movement with eased interpolation, hover highlighting for valid moves, and a shadow drop while animating.
- Roll a 6 to bring a token out of home; rolling a 6 grants another turn; three consecutive 6s send the last moved token back home.
- Captures: landing on an opponent token outside a safe zone sends it home and awards a bonus roll.
- Move history log, move counter, and current-turn indicator in the right-hand dashboard panel.
- Automatic save to `localStorage` after every move with a resume modal on the next visit.
- First player to move all four tokens into the center wins.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page shell, canvas element, modals |
| CSS3 | Layout, 3D dice cube, modals, responsive side panels |
| Vanilla JavaScript (ES6+) | Game logic, canvas rendering, event handling |
| Canvas API | Drawing the board, tokens, and center triangles each frame |
| CSS 3D transforms | Rotating the dice cube |
| localStorage API | Persisting and resuming game sessions |
| Google Fonts (Outfit) | UI typography |
| Node.js test runner | Headless unit tests for `ludoEngine.js` and `ludoBot.js` |

---

## File Responsibilities

### `index.html`

- Top bar with logo and turn status badge.
- Left panel: Roll Dice button, 3D dice cube, New Game button, and the four-player list with Human/Bot icons.
- Center: 600x600 `<canvas id="ludoCanvas">`.
- Right panel: Current Turn and Total Moves stat cards plus the move history list.
- Resume modal ("Session Detected") and setup modal with four Human/Bot `<select>` elements.

### `ludoEngine.js`

- `GLOBAL_TRACK` — 52 `[row, col]` coordinates defining the main loop.
- `VICTORY_PATHS` — the final 5-step lanes into the center for each color.
- `SAFE_ZONES` — the 8 safe star coordinates.
- `createTokens(color)` — token state factory (4 tokens per color).
- `calculateDistanceToHome(token)` — distance used to decide whether a token enters its victory path.
- `isValidMove(token, currentColor, diceValue)` — rule validation, including spawn-on-6 and overshoot checks.
- `getNextPositionState(token, diceValue)` — next position plus victory path / finished transitions.
- `checkCaptures(movedToken, state)` — sends opponent tokens on the same square (outside safe zones) home.
- `checkWinner(state, color)` — true when all tokens of a color have `finished`.
- `getTokenCoordinate(token)` — maps a token state to a pixel coordinate for the canvas.

### `ludoBot.js`

- `evaluateMove(token, diceValue, gameState)` — scores moves: base 10, +50 spawn, +150 finish, +60 victory path entry, +40 safe star, +120 capture, and up to +50 for advancing toward home.
- `selectBestMove(validTokens, diceValue, gameState, rng)` — picks the highest-scoring token, breaking ties randomly.

### `script.js`

- `drawBoard()` / `drawTokens()` / `renderLoop()` — the Canvas render engine, run via `requestAnimationFrame`.
- `animateTokenTo(token)` — sets a start/target coordinate and resets `animProgress` for eased movement.
- `rollDice()` — random 1-6 value, toggles the CSS dice class, and enforces the three-sixes penalty.
- `executeMove(token)` / `handleCaptures(token)` — applies a move, logs history, and awards bonus rolls.
- `nextTurn()` / `newGame()` — turn management and game setup.
- `saveGame()` / `loadGame()` — persist/restore state under the `cradle_ludo_save` key (with a legacy `ludoSave` fallback).

### `style.css`

- 3D dice cube using `transform-style: preserve-3d` and face rotation classes (`show-1` through `show-6`).
- Modal overlay styling and hidden/visible states.
- Player rows with active-turn highlighting and Human/Bot icons.
- Responsive three-panel layout.

---

## Design Decisions

- **Modular engine separation** — deterministic rules live in `ludoEngine.js` and heuristics in `ludoBot.js`, both with UMD exports so the same files run in a browser and under Node.js for unit testing.
- **Full redraw each frame** — the canvas is cleared and redrawn every `requestAnimationFrame`, which keeps the rendering code simple and makes animations independent of DOM updates.
- **Eased token interpolation** — tokens animate via an `animProgress` value with ease-in-out smoothing rather than CSS transitions, giving finer control inside the canvas.
- **CSS 3D dice** — the dice is a real 3D cube built from CSS transforms instead of a canvas-drawn face, for a crisp spinning effect.
- **Heuristic bot** — the AI scores candidate moves with weighted heuristics (capture, finish, safe star, advancement) instead of search, keeping it fast and easy to tune.
- **Auto-save on every move** — state is written to `localStorage` after each action so a session can always be resumed.

---

## Dependencies

| Dependency | Version | How loaded | Purpose |
|---|---|---|---|
| Outfit (font) | — | Google Fonts CDN (`<link>` tag) | UI typography |

No JavaScript libraries are used — only native browser APIs, plus the Node.js test runner for development.

---

## Future Improvements

- Add an online multiplayer mode so humans can play remotely instead of sharing one machine.
- Add touch and drag support for mobile devices.
- Let bots select difficulty levels by tuning the heuristic weights.
- Add sound effects for dice rolls, captures, and wins.
- Animate dice rolls with a real-time value shuffle instead of a fixed 1 s wait.

---

## Known Limitations

- The bot uses a static heuristic and can be predictable for strong players.
- Human input is mouse hover + click only; there is no touch interface.
- All humans share one browser tab — there is no network play.
- Save data is stored per-browser and can be cleared by the user.

---

## Development Notes

- No build step is required. Open `index.html` in a browser or serve the folder with a static server.
- The engine and bot modules use UMD wrappers, so unit tests run with the Node.js test runner:
  `node --test tests/ludo-game.test.js`
- Save data is written under the `cradle_ludo_save` key (a legacy `ludoSave` key is also read for backward compatibility).
- Adjust bot behavior by editing the scoring weights in `evaluateMove()` in `ludoBot.js`.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - Outfit font by Google Fonts (OFL license), loaded from the Google Fonts CDN.

---

## References

- [MDN Web Docs — Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [MDN Web Docs — requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
- [MDN Web Docs — Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [Ludo — Wikipedia](https://en.wikipedia.org/wiki/Ludo)
