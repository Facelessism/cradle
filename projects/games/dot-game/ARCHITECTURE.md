# Project Architecture

## Overview

Dot Game is a turn-based strategy game played on a configurable grid. Players take turns clicking cells to add dots. When a cell accumulates more dots than its capacity (determined by how many edges it has), it explodes — distributing one dot to each neighbour and claiming those cells. Chain reactions can cascade across the board. The last player with pieces on the board wins.

The game supports 2–4 players, local Player vs Player and Player vs AI modes, three AI difficulty levels, a hint system, and a post-game analytics panel with match history stored in `localStorage`.

---

## Purpose & Goals

- Provide a turn-based strategy game on a configurable grid for 2–4 players
- Support both local multiplayer and single-player play against an AI
- Implement chain-reaction logic that stays responsive during long explosion cascades
- Record match history and analytics so players can review past games

---

## System / Project Architecture Overview

The entire game lives in two files. `dotGameEngine.js` holds the pure board and chain-reaction rules, and `script.js` orchestrates the UI — rendering the grid, binding clicks, running the asynchronous chain reaction wave by wave, driving the AI, and persisting match history. `style.css` provides all visual styling. The board is a CSS Grid whose column count is set dynamically by JavaScript.

---

## Folder Structure

```
dot-game/
├── index.html   # UI shell: controls, board container, player stats, analytics
├── script.js    # All game logic, AI, rendering, and analytics
└── style.css    # Layout, cell colours, chart styles
```

---

## Data Flow / Execution Flow

```
User opens index.html
        ↓
script.js loads → renderAnalytics() shows past match history from localStorage
        ↓
startGame() initialises game state
        ↓
render() draws the grid and player stat cards
        ↓
User clicks a cell
        ↓
addDot(row, col) validates the click and records the move
        ↓
Cell dot count is incremented and rendered immediately
        ↓
resolveBoardStep() runs the chain reaction asynchronously (wave by wave)
        ↓
After the chain resolves: checkGameOver() and nextTurn() are called
        ↓
If AI turn: handleAiTurn() picks a move after a short delay
        ↓
render() redraws the board and stats
        ↓
Game ends when only one player's colour remains on the board
        ↓
saveMatchHistory() persists the result to localStorage
        ↓
renderAnalytics() updates the match history panel
```

---

## Component Breakdown

### `index.html`

Defines all visible UI sections:

- **Controls card** — dropdowns for game mode, AI difficulty, player count, and grid size; New Game and Hint buttons.
- **Status bar** — shows whose turn it is (and "Extra Turn!" when applicable).
- **Board wrapper** — contains the dynamically generated `#board` grid.
- **Player stats** — coloured cards showing each player's current cell count.
- **Match analytics** — bar charts of past games loaded from localStorage.

### `script.js`

The entire game is implemented in one file. It covers:

**Board creation**

- `createBoard(size)` — builds a 2D array of `{ owner, dots }` objects.
- `getCapacity(row, col)` — returns the explosion threshold for a cell. Corner cells explode at 2, edge cells at 3, interior cells at 4.

**Gameplay**

- `addDot(row, col)` — the main move handler. Validates the click, increments dots, renders the intermediate state, then starts the chain reaction.
- `resolveBoardStep(queue, onDone)` — processes chain explosions wave by wave using `setTimeout(..., 0)` to yield control to the browser between each wave, keeping the UI responsive during long chains.
- `explode(row, col, owner)` — resets a cell to zero and propagates one dot to each neighbour, changing their ownership.
- `checkGameOver()` — scans active players after every chain; if only one colour remains, the game ends.
- `nextTurn()` — advances to the next player, skipping eliminated players.

**AI**

- `getBestMove(player)` — greedy heuristic: scores every valid cell. Prioritises cells that trigger an explosion (+1000), penalises vulnerable cells next to an opponent about to explode (−100/−500), and prefers safe moves (+100). Returns the highest-scoring cell (with random tie-breaking).
- `getRandomMove(player)` — used for Easy difficulty; picks any valid cell at random.
- `handleAiTurn()` — delays the AI move by 500 ms and runs Easy/Medium/Hard logic based on the selected difficulty.

**Hint system**

- `getBestMove()` is reused to find the recommended cell, which is highlighted with the `.hint` CSS class.

**Analytics**

- `saveMatchHistory()` — writes a match summary (winner, moves, explosions, captures per player, average move time) to `localStorage`. Keeps up to 10 recent games.
- `renderAnalytics()` — reads match history from `localStorage` and renders bar charts comparing captures and average move times.

### `style.css`

Visual styling for the grid, player colour classes (`red`, `blue`, `green`, `yellow`), hint highlight, and analytics bar charts. The board is a CSS Grid whose column count is set dynamically by JavaScript.

---

## Key Features

- 2–4 player games on a configurable grid
- Player vs Player and Player vs AI modes
- Three AI difficulty levels plus a hint system
- Chain-reaction explosions that can cascade across the board
- Match analytics with history persisted in localStorage

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Controls, board container, player stats, analytics panels |
| CSS3 (CSS Grid) | Board layout, player colours, hint highlight, charts |
| Vanilla JavaScript | Game rules, AI, rendering, and analytics |
| localStorage API | Persisting match history |

---

## File Responsibilities

### `index.html`

- Controls card (game mode, AI difficulty, player count, grid size, New Game, Hint), status bar, board wrapper, player stat cards, and match analytics panel

### `dotGameEngine.js`

- Pure board rules — cell ownership, capacity, and chain-reaction explosions

### `script.js`

- `createBoard(size)`, `getCapacity(row, col)`, `addDot(row, col)` — game setup and moves
- `resolveBoardStep(queue, onDone)` / `explode(row, col, owner)` — asynchronous chain reaction
- `getBestMove(player)` / `getRandomMove(player)` / `handleAiTurn()` — AI logic
- `checkGameOver()`, `nextTurn()`, `saveMatchHistory()`, `renderAnalytics()` — flow and persistence

### `style.css`

- Grid, player colour classes, hint highlight, and analytics bar chart styling

---

## Design Decisions

All game state is stored in a single `state` object:

```js
{
  isActive: boolean,         // Whether a game is in progress
  winner: string | null,     // Winning player colour, or 'draw'
  currentPlayer: number,     // Index into the players array
  players: string[],         // e.g. ["red", "blue", "green", "yellow"]
  board: Cell[][],           // 2D array of { owner, dots }
  lastMoveTime: number,      // Timestamp of the last move (for analytics)
  gameMode: string,          // 'pvp' or 'pvai'
  isAiTurnProcessing: boolean, // Prevents input during AI delay
  analytics: {
    moves: number,
    moveTimes: { [player]: number[] },
    totalExplosions: number,
    captures: { [player]: number },
    gridSize: string
  }
}
```

Match history is persisted to `localStorage` under the key `'dotGameHistory'` as a JSON array.

---

## Event Flow

```
User clicks a cell button
        ↓
addDot(row, col)
  ├─ validate: game active, correct player, cell ownership
  ├─ record analytics (move count, timing)
  ├─ increment cell.dots, set cell.owner
  ├─ render() [intermediate — no AI trigger]
  └─ resolveBoardStep([{row, col}], callback)
          ↓
  For each exploding cell:
    explode(row, col, owner)    → redistribute dots to neighbours
    render() [intermediate]
    setTimeout → next wave
          ↓
  Chain fully resolved → callback fires
    ├─ checkGameOver()
    └─ nextTurn() or grant extra turn
          ↓
  render() [final — may trigger AI]
        ↓
  If AI's turn: setTimeout → handleAiTurn() → addDot(r, c)
```

---

## License & Attribution

- **Project License:** MIT (repository LICENSE)
- No image, audio, or external font assets are used. All colours are defined in CSS using named classes and hex values.

---

## Dependencies

None. The project is pure HTML, CSS, and JavaScript with no external libraries or frameworks.

---

## Future Improvements

- **Animated explosions** — add a visual burst effect when a cell explodes to make chain reactions easier to follow.
- **Network multiplayer** — the turn-based model maps well to a WebSocket-based multiplayer implementation.
- **Undo** — the `state.board` is plain data and could be snapshotted each turn to support an undo stack.
- **Deeper AI** — the current AI is a one-step greedy heuristic. A minimax or Monte Carlo Tree Search could improve play quality significantly.
- **Mobile touch support** — grid cells are `<button>` elements, so touch already works, but the layout could be further optimised for small screens.

---

## Known Limitations

- The AI is a one-step greedy heuristic and is beatable with simple strategies
- No undo — moves cannot be taken back once made
- Match history is capped at the 10 most recent games
- No online multiplayer

---

## Development Notes

- Open `index.html` through a local server (e.g. `python3 -m http.server 8000`) rather than double-clicking the file, so localStorage persistence works reliably.
- Unit tests live in `tests/dot-game.test.js`; run them with `node --test tests/dot-game.test.js`.
- No build step is required. Edit the files and refresh the browser.

---

## References

- [Chain reaction game — Wikipedia](https://en.wikipedia.org/wiki/Chain_reaction_(game))
