# Project Architecture

## Overview

Sudoku Solver is a browser-based take on the classic 9×9 number-placement puzzle: the player fills a partially completed grid so that every row, every column, and every 3×3 box contains the digits 1–9 exactly once. The mini supports puzzle generation at three difficulty levels, manual entry with conflict detection, a one-tap solver that fills in the precomputed solution, and a hint system that reveals one correct cell at a time. It runs entirely client-side with no external dependencies and no build step — just HTML, CSS, and vanilla JavaScript loaded directly by the browser.

## Purpose & Goals

* Provide a complete, playable Sudoku experience (generate → play → hint → solve → reset) inside a single mini project that opens by double-clicking `index.html`.
* Demonstrate a clean separation between pure puzzle logic (generation, validation, backtracking solver) and DOM rendering, so the algorithm side could be lifted into a Node test harness without modification.
* Keep the codebase small enough for a first-time contributor to read in under an hour — the entire logic + UI layer is ~1,100 lines of vanilla JavaScript.
* Surface the solver's behavior visually so users can watch the backtracking algorithm fill the board cell-by-cell, rather than just dumping the solution.

## Folder Structure

```text
sudoku-solver/
├── index.html      # Page shell: top bar, 9×9 board, number pad, stats panel
├── script.js       # All game state, puzzle generation, validation, solver, rendering
├── style.css       # Layout, theme tokens, board grid, cell highlight states
└── ARCHITECTURE.md # Architectural documentation

```

## System / Project Architecture Overview

The mini follows a single-file vanilla architecture: `index.html` declares the static structure (board container, number pad, stats panel, controls), `style.css` owns all presentation (board grid, highlights, responsive breakpoints, theme tokens inherited from the shared `tokens.css`), and `script.js` owns all behaviour. There is no framework, no module loader, and no build step.

Internally, `script.js` keeps a clear but informal split between pure puzzle functions (`createSolvedBoard`, `fillBoard`, `findEmptyCell`, `isValidMove`, `shuffledNumbers`) and DOM/UI functions (`renderBoard`, `selectCell`, `updateCellHighlights`, `enterNumber`, `giveHint`, `solvePuzzle`). The pure functions take and return plain 2-D arrays and never touch `document`; the DOM functions read from / write to the module-level `puzzle`, `solution`, and `currentBoard` state variables.

```text
index.html
  │
  ├──> style.css         (presentation only)
  │
  └──> script.js
         │
         ├── Pure logic:  createSolvedBoard → fillBoard → isValidMove → findEmptyCell
         │                  (used by both "Generate" and "Solve")
         │
         └── DOM layer:    renderBoard, selectCell, enterNumber, giveHint
                           (reads/writes the module-level state vars)

```

## Component Breakdown

| File | Responsibility |
| --- | --- |
| `index.html` | Static page shell: top bar with status, 9×9 board container, number pad (1–9 + erase), controls (New Game, Solve, Hint, Reset), difficulty selector, stats panel (timer, filled count, hints used, difficulty) |
| `script.js` | All game state, puzzle generation, move validation, backtracking solver, hint system, timer, stats, and DOM rendering |
| `style.css` | Board grid layout, cell sizing, selected/peer/conflict/error highlight states, theme tokens, responsive breakpoints |
| `tokens.css` | Shared Cradle design tokens (loaded via `../../../src/components/ui/tokens.css`) — not project-owned |

## Data Flow / Execution Flow

```text
User opens index.html
        ↓
Browser loads style.css → tokens.css → script.js
        ↓
DOM elements are looked up and cached as module-level consts
        ↓
Default difficulty ("easy") is selected; startNewGame() is called
        ↓
generatePuzzle(difficulty)
   ├── createSolvedBoard() → backtracking fill of an empty 9×9 grid
   └── remove N cells (N depends on difficulty) to produce the puzzle
        ↓
currentBoard = deep copy of puzzle; renderBoard() draws cells
        ↓
Timer starts; user can click cells, type via number pad, or press Solve
        ↓
On "Solve": copy solution into currentBoard, re-render, stop timer
On "Hint": pick a random empty cell, fill it from `solution`, increment hintStat
On "Reset": restore currentBoard from `puzzle`, re-render, restart timer
        ↓
checkCompletion() runs after every entry; if board is full and valid,
show a completion message and stop the timer

```

## Key Features

* **Three difficulty levels (Easy / Medium / Hard):** Controls how many cells are removed from a fully-solved board.
* **Backtracking puzzle generator:** Always produces a solvable board by starting from a solved grid and removing cells.
* **Interactive number pad:** Supports digit input (1–9 + erase) and direct cell selection.
* **Real-time conflict detection:** Entering a number that duplicates an existing value in the same row, column, or 3×3 box highlights conflicting cells in red.
* **One-tap Solve:** Fills the entire board instantly from the precomputed solution.
* **Hint button:** Reveals one correct cell at a time without completing the puzzle for the user.
* **Live stats:** Tracks timer, filled-cell count, hints used, and current difficulty.
* **Reset button:** Restores the original puzzle without generating a new one.
* **Keyboard & touch friendly:** Large tap targets with a responsive layout that reflows on narrow viewports.

## Technologies Used

| Technology | Purpose |
| --- | --- |
| **HTML5** | Semantic page structure and accessible form controls |
| **CSS3** (Grid, Custom Properties, `:focus-visible`) | Board layout, highlight states, theme tokens, responsiveness |
| **Vanilla JavaScript** (ES6+) | All game state, generation, validation, solver, and DOM logic |
| **Cradle shared tokens.css** | Design tokens (colours, spacing, typography) inherited repo-wide |
| **`performance.now()` / `setInterval**` | Timer implementation |

## File Responsibilities

### `index.html`

* Top bar with brand block, status indicator, and timer display.
* `<div id="board">` — the 9×9 grid container that `renderBoard()` fills with 81 `<div class="cell">` elements at runtime.
* **Number pad:** 9 digit buttons (1–9) plus an erase button.
* **Controls:** `#newGame`, `#solveBtn`, `#hintBtn`, `#resetBtn`, and the `#difficulty` `<select>`.
* **Stats panel:** `#filledStat`, `#hintStat`, `#difficultyStat`, `#puzzleState`.

### `script.js`

* **Pure puzzle logic (no DOM access):**
* `createSolvedBoard()` — generates a fully-solved 9×9 grid via backtracking with shuffled candidate digits.
* `fillBoard(board)` — recursive backtracking helper that mutates the passed-in board in place and returns `true` on success.
* `findEmptyCell(board)` — returns the `[row, col]` of the next empty cell, or `null` if the board is complete.
* `isValidMove(board, row, col, num)` — returns `true` if `num` can legally be placed at `(row, col)` given Sudoku's row / column / box constraints.
* `shuffledNumbers()` — returns `[1..9]` shuffled via Fisher–Yates, used by the generator so each generated board differs.


* **Game state (module-level `let` variables):**
* `puzzle` — original puzzle as the player first sees it (2D array, `0` = empty).
* `solution` — fully-solved board (2D array, no zeros).
* `currentBoard` — live board the player is editing.
* `selectedCell` — `[row, col]` of the currently focused cell, or `null`.
* `hintsUsed`, `seconds`, `timerInterval`, `gameStarted` — bookkeeping for the stats panel and timer.


* **DOM / UI functions:**
* `startNewGame()` — picks difficulty, calls `generatePuzzle`, copies into `currentBoard`, resets stats, restarts timer, re-renders.
* `generatePuzzle(difficulty)` — calls `createSolvedBoard`, then removes `difficultySettings[difficulty].removed` cells.
* `renderBoard()` — rebuilds the 81-cell DOM inside `#board`, attaching click handlers and applying highlight classes.
* `selectCell(row, col)` — sets `selectedCell` and calls `updateCellHighlights`.
* `updateCellHighlights()` — adds `.selected`, `.peer`, `.same-value`, and `.error` classes to appropriate cells.
* `enterNumber(number)` — writes into `currentBoard`, validates, and calls `checkCompletion`.
* `markError(row, col)` — toggles the `.error` class on conflicting cells in the same row / column / box.
* `giveHint()` — picks a random empty cell in `currentBoard`, fills it from `solution`, increments `hintStat`.
* `solvePuzzle()` — copies `solution` into `currentBoard` and re-renders.
* `resetPuzzle()` — restores `currentBoard` from `puzzle` and re-renders.
* `checkCompletion()` — verifies board is full and matches `solution`; if so, shows a win message and stops timer.
* `updateStats()`, `updateStatus(message)`, `startTimer()`, `stopTimer()`, `updateTimer()` — bookkeeping for the stats panel.



### `style.css`

* `.board` — CSS Grid with `grid-template-columns: repeat(9, 1fr)`, square cells via `aspect-ratio: 1 / 1`.
* `.cell` — base cell styling, including `:hover`, `:focus-visible`, and `:active` states.
* `.cell.selected` — highlighted currently-focused cell.
* `.cell.peer` — same row / column / box as the selected cell.
* `.cell.same-value` — cells holding the same digit as the selected cell.
* `.cell.error` — cells in conflict (duplicate value in row / col / box).
* `.cell.given` — pre-filled cells from the puzzle; non-editable.
* Responsive breakpoints that collapse the side panel below the board on narrow viewports.

## Design Decisions

* **Generate-then-remove instead of build-up:** The puzzle generator starts from a fully-solved board and removes cells, rather than building a partial puzzle up from scratch. This guarantees solvability (the solution is known a priori) and keeps the generator trivial — uniqueness is not strictly enforced, which is an accepted trade-off for a mini project.
* **Precomputed solution at generation time:** `solution` is computed once when the puzzle is generated and kept in memory. Solve and Hint both read from it rather than re-running the solver, so they are instant and cannot disagree with the original board.
* **Single-file script:** Despite the natural split between pure logic and DOM code, everything lives in `script.js` to match the rest of the `projects/games/` mini-projects in the repo. Lifting pure functions into a separate `sudokuEngine.js` with a UMD wrapper would be the natural next step if unit tests are added.
* **Highlight states over inline styles:** All visual feedback (`selected`, `peer`, `same-value`, `error`) is expressed as CSS classes rather than direct style mutations, keeping rendering declarative and theme tokens authoritative.
* **`setInterval` timer instead of `requestAnimationFrame`:** The timer only needs second-level precision; using `setInterval` keeps implementation obvious and avoids animation loop overhead.

## Dependencies

| Dependency | Version | How loaded | Purpose |
| --- | --- | --- | --- |
| **Cradle shared tokens.css** | — | `<link>` from `../../../src/components/ui/` | Design tokens (colours, spacing, typography) |
| **Browser APIs** (`document`, `setInterval`) | — | Native | DOM manipulation, timer |

*No external libraries, CDNs, fonts, or runtime packages are required.*

## Future Improvements

* Lift pure puzzle logic into a `sudokuEngine.js` UMD module so it can be unit-tested in Node.js without a DOM.
* Enforce unique-solution generation (currently guarantees solvability, not uniqueness).
* Add a "pencil-mark" mode where players can annotate candidate digits per cell without committing them.
* Add an undo / redo stack — `currentBoard` mutations are isolated enough that an immutable rewrite would be minimal.
* Persist best time per difficulty to `localStorage`.
* Add keyboard navigation across the board (arrow keys + 1–9 entry) in addition to mouse / touch flows.
* Animate the Solve button so the backtracking algorithm fills the board cell-by-cell with a small delay, making the algorithm visible.

## Known Limitations

* **Puzzle uniqueness is not enforced:** On rare occasions, a generated puzzle may have more than one valid solution.
* **No persistence:** Closing the tab loses current game progress.
* **Limited touch gestures:** No mobile-specific touch gestures beyond tapping cells.
* **Instant solver:** The solver does not animate; it fills the board instantly.
* **Basic difficulty scaling:** Difficulty is determined solely by cell count, not by logical techniques required to solve the puzzle.

## Development Notes

* Open `index.html` directly in a browser, or run the repo's dev server (`npm run dev`). No build step is required.
* Shared `tokens.css` is loaded via a relative path; if moving the project folder, update the `<link href>` in `index.html`.
* All game logic lives in `script.js`; there is no separate engine module yet.
* The board is re-rendered from scratch on every state change (`renderBoard()` clears and rebuilds `#board`). This is fast enough for a 9×9 grid and keeps rendering simple.
* `gameStarted` is set to `true` on the first user entry so the timer starts when the player actually begins playing, not on page load.

## License & Attribution

* **Project License:** MIT, consistent with the rest of the Cradle repository.
* **Third-Party Assets:** None. All visuals are CSS; no images, fonts, or audio files are bundled.
* **References:**
* [Sudoku — Wikipedia](https://en.wikipedia.org/wiki/Sudoku) — puzzle rules
* [Backtracking algorithm — Wikipedia](https://en.wikipedia.org/wiki/Backtracking) — solver technique used by `fillBoard`
* [Fisher–Yates shuffle — Wikipedia](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle) — used by `shuffledNumbers()`
* MDN Web Docs — CSS Grid Layout
