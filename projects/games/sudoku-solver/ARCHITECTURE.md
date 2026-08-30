# Project Architecture

## Overview

Sudoku Solver is a browser-based Sudoku game that generates a solvable puzzle
at a chosen difficulty, lets the player fill it in with number-pad or keyboard
input, and can auto-solve or hint the player toward the next correct move. It
runs entirely client-side with no backend or external puzzle service.

## Purpose & Goals

- Generate a valid, uniquely-solvable Sudoku board for each difficulty level
- Give players real-time feedback (errors, completion, timer, stats)
- Provide a backtracking solver that can either reveal a single hint or solve
  the full board on demand

## Folder Structure

```text
sudoku-solver/
├── index.html      # Game shell: board grid, number pad, stats, controls
├── script.js        # Puzzle generation, solving, rendering, and game state
├── style.css        # Board layout, cell states, and responsive design
└── thumbnail.svg     # Auto-generated project thumbnail
```

## System / Project Architecture Overview

The project follows a simple separation of concerns: `index.html` defines the
board and control structure, `style.css` handles all presentation, and
`script.js` owns puzzle generation, validation, solving, and every DOM update.
There is no build step and no external puzzle library — a fully solved board
is generated first, then cells are removed according to the chosen difficulty
to produce the starting puzzle, with the original solved board kept in memory
for hints and auto-solving.

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Page shell: 9×9 board, number pad, difficulty select, timer/stats, and controls (New Game, Hint, Solve, Reset) |
| `script.js` | Puzzle generation and backtracking solver, move validation, cell selection/highlighting, timer, and all rendering |
| `style.css` | Grid layout, 3×3 box borders, cell states (selected, error, given), and responsive sizing |

## Data Flow / Execution Flow

```text
User opens index.html
        ↓
startNewGame() runs on load / New Game click
        ↓
generatePuzzle(difficulty) builds a solved board (createSolvedBoard + fillBoard)
        ↓
Cells are removed to create the puzzle; puzzleState stores board + solution
        ↓
renderBoard() draws the grid
        ↓
User selects a cell and enters a number (number pad, keyboard, or on-screen buttons)
        ↓
enterNumber() validates the move via isValidMove(), updates puzzleState
        ↓
markError() / updateCellHighlights() reflect the result
        ↓
checkCompletion() detects a finished, correct board and stops the timer
```

## Key Features

- Difficulty-based puzzle generation (cells removed per selected difficulty)
- Backtracking solver used both for generation and for the Solve button
- Single-cell Hint that reveals the correct value for the selected/next cell
- Real-time error highlighting for conflicting entries
- Selected-cell row/column/box highlighting
- Running timer and live stats (filled cells, hints used, difficulty)
- Reset (clear player entries) and New Game (regenerate) controls
- Keyboard and on-screen number pad input

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page structure and semantic markup |
| CSS3 (Grid) | 9×9 board layout and responsive design |
| Vanilla JavaScript (ES6+) | Puzzle generation, backtracking solver, and DOM updates |
| Cradle `Button.js` / `Card.js` / `BackToHome.js` | Shared UI components for controls and navigation |

## File Responsibilities

### `index.html`

- Board grid container and number pad
- Difficulty selector and header stats (filled cells, hints, difficulty)
- Control buttons: New Game, Solve, Hint, Reset
- Loads shared Cradle UI components and `script.js`

### `script.js`

- `startNewGame()` — resets state and generates a fresh puzzle
- `generatePuzzle(difficulty)` — builds a solved board then removes cells per difficulty
- `createSolvedBoard()` / `fillBoard(board)` — backtracking board generator
- `findEmptyCell(board)` / `isValidMove(...)` — core Sudoku validity rules used by both the generator and the solver
- `shuffledNumbers()` — randomizes candidate order so generated boards vary
- `renderBoard()` — draws the current `puzzleState` to the DOM
- `selectCell(row, col)` / `updateCellHighlights()` — selection and row/column/box highlighting
- `enterNumber(number)` — applies a player move and validates it
- `markError(row, col)` — flags a conflicting cell
- `giveHint()` — reveals one correct value from the stored solution
- `solvePuzzle()` — fills in the remaining board from the stored solution
- `resetPuzzle()` — clears player entries back to the original puzzle
- `checkCompletion()` — detects a solved board
- `updateStats()` / `updateStatus(message)` — stats and status text updates
- `startTimer()` / `stopTimer()` / `updateTimer()` — game timer

### `style.css`

- Grid layout for the 9×9 board with bold 3×3 box borders
- Cell state styling: selected, given (pre-filled), player-entered, error
- Responsive sizing for the board and number pad on mobile

## Design Decisions

- **Solve-then-remove generation** — the puzzle is generated by first
  producing a fully solved board and then removing cells, rather than
  generating the puzzle directly. This guarantees every generated puzzle has
  at least one valid solution, which is kept in memory for hints/solving.
- **Backtracking solver reused for generation and solving** — the same
  `isValidMove`/backtracking approach powers both `fillBoard()` (generation)
  and `solvePuzzle()`/`giveHint()` (solving), avoiding duplicated logic.
- **No framework** — kept vanilla to minimize the learning curve for
  contributors and avoid a build step.

## Dependencies

| Dependency | Version | How loaded | Purpose |
|---|---|---|---|
| Cradle `Button.js` | — | Local script tag | Styled control buttons |
| Cradle `Card.js` | — | Local script tag | Card layout for the board/stats panel |
| Cradle `BackToHome.js` | — | Local script tag | Shared back-to-home navigation |

## Future Improvements

- Add a difficulty-aware unique-solution check (verify only one solution exists)
- Persist in-progress puzzles to localStorage so a game survives a page reload
- Add pencil-mark/notes mode for candidate numbers
- Add an undo/redo stack for player moves

## Known Limitations

- No mobile/touch drag support beyond tapping cells and number pad buttons
- Generated puzzles are not guaranteed to have a unique solution
- No persistence — refreshing the page starts a new game

## Development Notes

- No build step is required. Edit the files and refresh the browser.
- Open `index.html` directly, or run `npm run dev` from the repo root.

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None — no third-party assets used.

## References

- [Sudoku — Wikipedia](https://en.wikipedia.org/wiki/Sudoku)
- [Backtracking algorithm — Wikipedia](https://en.wikipedia.org/wiki/Backtracking)