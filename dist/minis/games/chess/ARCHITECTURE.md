# Project Architecture

## Overview

A fully playable chess game that runs entirely in the browser. It supports two-player local play and a single-player mode where the human plays as White against an AI opponent. The AI runs in a Web Worker so the UI never freezes while the computer is thinking.

Features include legal move generation (including castling, en passant, and pawn promotion), check/checkmate/stalemate detection, undo/redo, board flipping, move history, captured piece display, and PGN (Portable Game Notation) export.

---

## Purpose & Goals

- Provide a fully playable chess game that runs entirely in the browser
- Support both local two-player and single-player (human vs AI) modes
- Keep the rules engine free of DOM access so it can be reused and unit tested
- Run the AI on a Web Worker so the UI never freezes while the computer thinks

---

## System / Project Architecture Overview

The codebase separates chess rules from presentation and AI. `chessLogic.js` is a plain script (not a module) containing every rule of chess with no DOM access, loaded both by `index.html` and by `ai-worker.js` via `importScripts()`. `ai-worker.js` runs a minimax search with alpha-beta pruning inside a Web Worker. `script.js` owns all DOM references, user input, game flow, notation, and state snapshots. `style.css` handles all visual styling, including Unicode piece glyphs.

---

## Folder Structure

```
chess/
├── index.html      # Page shell, board grid, side panel, controls
├── chessLogic.js   # All chess rules — no DOM access
├── ai-worker.js    # AI engine running inside a Web Worker
├── script.js       # UI layer — rendering, event handling, game flow
└── style.css       # Visual styling and responsive layout
```

The three JavaScript files have distinct responsibilities and are never interchangeable:

- `chessLogic.js` — pure chess rules, no DOM
- `ai-worker.js` — imports `chessLogic.js` and runs the minimax search off the main thread
- `script.js` — reads from both, owns the DOM

---

## Data Flow / Execution Flow

```
User opens index.html
        ↓
chessLogic.js loads (defines global constants and functions)
        ↓
script.js loads → calls newGame()
        ↓
Board is set to the standard starting position (startPosition())
        ↓
render() draws all 64 squares and pieces
        ↓
User clicks a square
        ↓
handleSquareClick(row, col)
        ↓
If a piece is selected → getLegalMoves() highlights valid targets
        ↓
User clicks a valid target square
        ↓
makeMove(move) applies the move, updates captures, en passant, promotion
        ↓
Turn switches to the next player
        ↓
updateGameState() checks for check, checkmate, or stalemate
        ↓
If mode is "Player vs Computer" and it is Black's turn → triggerAI()
        ↓
AI Worker receives board state via postMessage
        ↓
Worker runs minimax and posts the best move back
        ↓
makeMove() is called with the AI's chosen move
        ↓
render() redraws the board
```

---

## Component Breakdown

### `index.html`

Defines the static page skeleton: the board grid (`#board`), player strips, game status card, control buttons (New Game, Undo, Redo, Copy PGN, Flip Board), game-mode and difficulty selectors, captured piece displays, and a scrollable move list.

### `chessLogic.js`

The rules engine. It is a plain script (not a module) so it can be loaded both by `index.html` via a `<script>` tag and by `aiWorker.js` via `importScripts()`.

Key functions:

| Function                                          | Purpose                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `startPosition()`                                 | Returns an 8×8 array representing the standard chess opening                          |
| `getLegalMoves(board, row, col, color, epTarget)` | Returns all legal moves for a piece, filtering out moves that leave the king in check |
| `getAllLegalMoves(board, color, epTarget)`        | Returns every legal move for a given colour                                           |
| `getPseudoMoves(board, row, col, epTarget)`       | Returns moves without the legality filter (used internally)                           |
| `applyMove(board, move)`                          | Mutates the board to apply a move (castling, en passant, promotion handled here)      |
| `isSquareAttacked(board, row, col, byColor)`      | Returns `true` if a square is under attack                                            |
| `findKing(board, color)`                          | Locates the king of a given colour                                                    |
| `cloneBoard(board)`                               | Deep copies the board (used before simulating moves)                                  |

### `ai-worker.js`

Runs the computer opponent. It imports `chessLogic.js` for move generation and board manipulation, then implements:

- **`evaluateBoard(board, color)`** — scores a position using piece values and a piece-square table (PST) that rewards central control.
- **`minimax(board, depth, alpha, beta, isMaximizing, color)`** — a standard minimax search with alpha-beta pruning.
- **`onmessage` handler** — receives `{ board, color, depth, enPassantTarget }` from the main thread, finds the best move, and posts it back.

Difficulty levels map to search depths: Easy = 1, Medium = 3, Hard = 4.

### `script.js`

The UI controller. It owns all DOM references and application state variables.

Key responsibilities:

- **`render()`** — rebuilds the 64-square grid, applies CSS classes for selected, legal, capture, and check highlights.
- **`handleSquareClick(row, col)`** — handles piece selection and move execution.
- **`makeMove(move)`** / **`completeMove(move, movingPiece)`** — applies the move, tracks captures, updates en passant state, detects pawn promotion (shows modal for user choice), switches turns, and records move notation.
- **`showPromotionModal(move)`** / **`selectPromotion(pieceType)`** — manages the pawn promotion modal flow. Stores the pending move, displays piece options (queen, rook, bishop, knight), and resumes the move with the user's choice.
- **`buildNotation(move)`** — generates algebraic notation (SAN) for the move list.
- **`undoMove()` / `redoMove()`** — restore previous board states from the `history` and `redoStack` arrays.
- **`boardToFEN()`** — exports the full game state (board, active color, castling rights, en passant target, half-move clock, full-move number) to FEN notation.
- **`loadFEN(fenString)`** — imports a FEN string, restoring board position, active color, castling rights, en passant square, and move counters.
- **`triggerAI()`** — creates a new Web Worker, sends the current board state, and awaits the response.
- **`generatePGN()`** — assembles the full game record in PGN format for clipboard export.

### `style.css`

Provides the full visual design: board colours, piece glyphs (Unicode chess symbols), square highlight colours (selected, legal move, capture ring, check), side-panel layout, responsive breakpoints, and a pawn promotion modal.

---

## Key Features

- Two-player local play and single-player mode vs an AI opponent
- Legal move generation with castling, en passant, and pawn promotion
- Check, checkmate, and stalemate detection
- Undo/redo, board flipping, captured piece display, and move history
- PGN export and FEN import/export
- AI difficulty levels (Easy = depth 1, Medium = 3, Hard = 4) running off-thread in a Web Worker

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page shell, board grid, side panel, controls |
| CSS3 | Board colours, piece glyphs, highlights, responsive layout |
| Vanilla JavaScript | Rules engine, AI search, and UI controller |
| Web Workers | Off-main-thread AI computation |
| navigator.clipboard | Copy PGN feature |

---

## File Responsibilities

### `index.html`

- Defines the board grid, player strips, status card, control buttons, mode/difficulty selectors, captured piece displays, and move list

### `chessLogic.js`

- Pure chess rules — move generation, legality filtering, check/checkmate detection, FEN helpers

### `ai-worker.js`

- `evaluateBoard(board, color)` — position scoring with piece values and piece-square tables
- `minimax(board, depth, alpha, beta, isMaximizing, color)` — alpha-beta pruned search
- `onmessage` handler — receives board state and posts the best move back

### `script.js`

- UI rendering, click handling, move application, promotion modal, undo/redo, notation, FEN/PGN, and AI triggering

### `style.css`

- All visual styling including square highlights and the promotion modal

---

## Design Decisions

Game state is held in module-level variables inside `script.js`:

| Variable             | Type             | Purpose                                                      |
| -------------------- | ---------------- | ------------------------------------------------------------ |
| `board`              | `Object[][]`     | 8×8 matrix; each cell is `{ type, color, moved }` or `null`  |
| `turn`               | `string`         | `"white"` or `"black"`                                       |
| `selected`           | `Object \| null` | `{ row, col }` of the currently selected piece               |
| `legalTargets`       | `Object[]`       | Move objects for the selected piece                          |
| `history`            | `Object[]`       | Stack of previous states (for undo)                          |
| `redoStack`          | `Object[]`       | Stack of undone states (for redo)                            |
| `capturedByWhite`    | `Object[]`       | Pieces captured by White                                     |
| `capturedByBlack`    | `Object[]`       | Pieces captured by Black                                     |
| `enPassantTarget`    | `Object \| null` | Square eligible for en passant capture                       |
| `halfMoveClock`      | `number`         | Half-moves since last capture/pawn advance (for FEN/50-move) |
| `fullMoveNumber`     | `number`         | Full-move counter, increments after Black's move (for FEN)   |
| `flipped`            | `boolean`        | Whether the board is displayed from Black's perspective      |
| `gameOver`           | `boolean`        | Set to `true` on checkmate or stalemate                      |
| `isComputerThinking` | `boolean`        | Blocks user input while the AI Worker is running             |
| `pendingPromotion`   | `Object \| null` | Pending move awaiting user's promotion piece selection       |

State is snapshotted (deep-cloned) on every move and pushed to `history`, which enables undo without any special diff logic.

---

## Event Flow

```
User clicks a square
        ↓
handleSquareClick(row, col)
        ↓
[No piece selected] → select the piece, compute legalTargets, render()
[Piece selected + valid target clicked] → makeMove(move)
        ↓
makeMove()
  ├─ applyMove(board, move)        [chessLogic.js]
  ├─ update captures, en passant
  ├─ auto-promote pawn if needed
  ├─ push snapshot to history[]
  └─ call updateGameState()
        ↓
updateGameState()
  ├─ getAllLegalMoves()             [chessLogic.js]
  ├─ check / checkmate / stalemate detection
  └─ if AI mode + Black's turn → triggerAI()
        ↓
triggerAI()
  ├─ create Web Worker (ai-worker.js)
  ├─ postMessage({ board, color, depth, enPassantTarget })
  └─ worker.onmessage → makeMove(bestMove)
        ↓
render() redraws the board
```

---

## License & Attribution

- **Project License:** MIT (repository LICENSE)
- No image or audio files are used. Chess pieces are rendered with Unicode HTML entities (e.g. `&#9812;` for ♔). All visual styling is pure CSS.
- The `Outfit` font (referenced in the CSS) is the system sans-serif fallback; it is not loaded from an external source in this project.

---

## Dependencies

None. The project uses only native browser APIs:

- **Web Workers** (`new Worker('ai-worker.js')`) for off-thread AI computation.
- **`navigator.clipboard`** for the Copy PGN feature.

---

## Future Improvements

- **Board coordinates** — algebraic rank/file labels (a–h, 1–8) are styled in the CSS but not yet injected into the DOM.
- **Move highlighting** — highlight the last move made (from/to squares) to make it easier to follow after the AI plays.
- **Opening book** — adding a small set of known opening moves would make the AI's early game stronger and more varied.
- **Time controls** — per-player countdown clocks would allow timed games.
- **Draw detection** — threefold repetition and the fifty-move rule are not currently detected.

---

## Known Limitations

- No draw detection — threefold repetition and the fifty-move rule are not implemented
- Board coordinates (a–h, 1–8) are styled in CSS but not injected into the DOM
- The AI plays from a single opening; there is no opening book
- No time controls — games are untimed

---

## Development Notes

- Open `index.html` through a local server (e.g. `python3 -m http.server 8000`) rather than double-clicking the file, because the AI uses a Web Worker which is blocked under the `file://` protocol.
- The rules engine (`chessLogic.js`) is a plain script loaded both by a `<script>` tag and by `importScripts()` inside the worker — keep it free of module syntax.
- Unit tests live in `tests/chess-logic.test.js`; run them with `node --test tests/chess-logic.test.js`.

---

## References

- [MDN Web Docs — Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Portable Game Notation (PGN) — Wikipedia](https://en.wikipedia.org/wiki/Portable_Game_Notation)
