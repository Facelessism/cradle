# Project Architecture

## Overview

2048 is a single-player sliding tile puzzle. The player uses arrow keys (or WASD) to slide tiles on a 4×4 grid. When two tiles with the same number collide, they merge into one tile with their combined value. The goal is to reach a tile worth 2048.

The project is intentionally self-contained: no build tools, no frameworks, no external dependencies. It runs directly in a browser from two JavaScript files.

---

## Purpose & Goals

- Reach a tile worth 2048 by merging equal tiles
- Demonstrate a pure game-logic module (`logic.js`) that has no DOM dependency and can be unit tested in Node.js
- Showcase immutable state management and localStorage persistence without frameworks or a build step

---

## Folder Structure

```text
2048-game/
├── index.html          # Page shell, score display, game board container
├── logic.js            # Pure game rules (no DOM access)
├── storage.js          # State and high score saving/loading per grid size
├── gameUndoManager.js  # Move history stack manager with rollback support
├── gameThemeEngine.js  # Preset grid color themes (Classic, Dark Neon, Cyberpunk)
├── script.js           # UI layer — renders the board and handles input
└── style.css          # Layout and tile colour theming
```

**`logic.js`**, **`gameUndoManager.js`**, and **`script.js`** are deliberately separated into modular architecture. `logic.js` contains core rules, `gameUndoManager.js` handles move history stack, and `script.js` binds UI events and DOM updates.

---

## System / Project Architecture Overview

The project follows a strict separation of concerns. `logic.js` contains every game rule as pure functions exposed through a UMD wrapper, `storage.js` handles best-score persistence, `gameUndoManager.js` keeps an undo history stack, and `gameThemeEngine.js` supplies the grid colour themes. `script.js` is the only file that touches the DOM — it reads the public API from `window.__2048Logic`, handles keyboard input, and re-renders the board. There is no build step; the browser loads the files directly.

---

## Data Flow / Execution Flow

```text
User opens index.html
        ↓
Browser loads style.css → logic.js → script.js
        ↓
script.js calls createInitialState()
        ↓
Two random tiles (value 2 or 4) are placed on the board
        ↓
renderBoard() draws all tiles and the current score
        ↓
User presses an arrow key (or WASD)
        ↓
handleKeydown() maps the key to a direction string
        ↓
moveGameState(state, direction) returns a new state object
        ↓
If the move changed the board, a new random tile is added
        ↓
renderBoard() re-draws the board and updates the score
        ↓
Win / loss status is checked and displayed
```

---

## Component Breakdown

### `index.html`

Defines the static page structure: title, score cards (`#scoreValue`, `#bestScoreValue`), the board container (`#board`), a status message (`#status`), and a Restart button. The board cells are created dynamically by JavaScript.

### `logic.js`

Contains all game rules. It is wrapped in a UMD (Universal Module Definition) pattern so it works both in a browser (via `window.__2048Logic`) and in Node.js (via `module.exports`), which enables unit testing without a browser.

Key functions exported:

| Function                          | Purpose                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `createInitialState()`            | Returns a fresh 4×4 board with two starting tiles                                            |
| `moveGameState(state, direction)` | Returns a new immutable state after applying a move                                          |
| `addRandomTile(state)`            | Places a 2 (90% chance) or 4 (10% chance) on a random empty cell                             |
| `collapseLine(line)`              | Merges a single row or column in one direction; returns the merged line and the score gained |
| `hasWon(board)`                   | Returns `true` if any tile is ≥ 2048                                                         |
| `canMove(board)`                  | Returns `true` if at least one valid move exists                                             |

### `script.js`

The UI layer. Reads the public API from `window.__2048Logic`, handles keyboard events, and writes to the DOM.

Key responsibilities:

- **`renderBoard()`** — clears and redraws every tile div, applies tile colour classes (e.g. `tile--128`), and updates the score display.
- **`handleMove(direction)`** — calls `moveGameState`, persists the best score to `localStorage`, and triggers a re-render.
- **`handleKeydown(event)`** — maps arrow keys and WASD to direction strings.
- **`restartGame()`** — creates a fresh state and re-renders.

### `style.css`

Handles all visual presentation. Tile colours are assigned through CSS classes named after tile values (`.tile--2`, `.tile--4`, … `.tile--2048`). Layout uses CSS Grid for the 4×4 board.

---

## Key Features

- 4×4 sliding tile grid with merge-on-collision logic
- Score counter and persistent best score via localStorage
- Keyboard (arrow keys) and WASD controls
- Win detection at 2048 and loss detection when no moves remain
- Undo support via a move history stack and switchable colour themes

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page structure and semantic markup |
| CSS3 (CSS Grid) | Board layout and tile colour theming |
| Vanilla JavaScript (ES6+) | Game logic, storage, and DOM manipulation |
| localStorage API | Persisting the best score across sessions |

---

## File Responsibilities

### `index.html`

- Defines the page shell, score cards, board container, and Restart button

### `logic.js`

- Pure game rules — board creation, moves, merges, win/loss detection

### `script.js`

- UI layer — rendering the board, handling keyboard events, applying moves

### `storage.js`

- Saves and loads game state and best score per grid size

### `gameUndoManager.js`

- Manages the move history stack and rollback

### `gameThemeEngine.js`

- Provides preset colour themes (Classic, Dark Neon, Cyberpunk)

### `style.css`

- All visual presentation, tile colours, and responsive layout

---

## Design Decisions

All game state lives in a single plain JavaScript object (`state`) held in `script.js`:

```js
{
  board: number[][],   // 4×4 matrix of tile values (0 = empty)
  score: number,       // Current game score
  bestScore: number,   // All-time best score (persisted in localStorage)
  won: boolean,        // True when a 2048 tile exists
  over: boolean,       // True when no moves remain
  moved: boolean       // True if the last move changed the board
}
```

State is **never mutated in place**. `moveGameState` always returns a brand-new state object, which makes the logic easy to test and reason about.

The best score is the only value persisted across sessions, stored in `localStorage` under the key `cradle-2048-best-score`.

---

## Event Flow

```text
keydown event (arrow key / WASD)
        ↓
handleKeydown(event)  →  maps key to direction string
        ↓
handleMove(direction)
        ↓
moveGameState(state, direction)  [logic.js — pure function]
        ↓
New state returned (with moved, won, over flags)
        ↓
persistBestScore()  →  writes to localStorage if score improved
        ↓
renderBoard()  →  updates all tile divs and score elements
```

---

## License & Attribution

- **Project License:** MIT (repository LICENSE)
- No image, audio, font, or icon assets are used. All visual styling is achieved with CSS gradients, colours, and typography using the system font stack (`Inter, system-ui, …`).

---

## Dependencies

None. The project is pure HTML, CSS, and JavaScript with no external libraries.

---

## Future Improvements

- **Swipe support** — add touch event listeners so the game works on mobile devices.
- **Tile slide animations** — animate tiles moving across the grid before they settle.
- **Undo** — since state is immutable, keeping a history stack would be straightforward.
- **Keyboard shortcut hints** — surface the WASD alternative visually for new players.

---

## Known Limitations

- No touch/swipe support — keyboard only
- No animation — tiles jump instantly instead of sliding
- Undo is implemented via `gameUndoManager.js`, but there is no "undo" button in the current UI

---

## Development Notes

- Open `index.html` through a local server (e.g. `python3 -m http.server 8000`), not by double-clicking the file, since some browsers restrict localStorage under the `file://` protocol.
- `logic.js` uses a UMD wrapper so it can be tested with Node.js:
  `node -e "const l = require('./logic.js'); console.log(l.createInitialState())"`
- No build step is required. Edit the files and refresh the browser.

---

## References

- [2048 by Gabriele Cirulli](https://github.com/gabrielecirulli/2048) — original game that inspired this implementation
