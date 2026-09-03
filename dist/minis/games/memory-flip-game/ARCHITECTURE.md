# Project Architecture

## Overview

Pairwise is a single-player memory card game. The player is presented with 64 face-down tiles arranged in an 8×8 grid. Each tile hides an emoji symbol. Tiles come in matched pairs (32 symbols × 2 = 64 tiles). The player flips two tiles at a time; if they match they stay face-up, otherwise they flip back after a short delay. The goal is to clear the entire board using as few flips as possible.

---

## Purpose & Goals

- Provide a responsive memory-matching game that runs entirely in the browser with no backend.
- Offer both a relaxed Standard mode (unlimited flips) and a harder Challenge mode with a 50-flip limit.
- Persist personal best scores to `localStorage` per mode and show them on the home screen.
- Demonstrate a pure-CSS 3D card flip effect with no animation library or build step.

---

## Folder Structure

```
memory-flip-game/
├── index.html   # Page shell: navbar, home screen, game screen, result screen
├── utils.js     # Score management utilities (localStorage)
├── script.js    # All game logic and screen management
└── style.css   # CSS flip animation, tile styling, layout
```

---

## System / Project Architecture Overview

The page is built from three `<section>` screens (home, game, result) that are shown one at a time via the `hidden` attribute. `script.js` holds all game logic and screen management, `utils.js` isolates the `localStorage` high-score helpers so they can be unit tested with Node.js, and `style.css` implements the 3D flip animation. There is no build step; the browser loads `index.html`, `utils.js`, and `script.js` directly.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Three screens, navbar stats, mode selector, and high-score displays |
| `script.js` | Deck building, card click handling, match checking, screen switching |
| `utils.js` | Pure `localStorage` helpers for reading and saving high scores |
| `style.css` | Card flip animation, shake feedback, board grid, navbar layout |

---

## Data Flow / Execution Flow

```
User opens index.html
        ↓
Home screen is displayed
        ↓
User clicks "Start Game"
        ↓
startGame()
  ├─ buildDeck() → shuffles 64 cards (32 symbol pairs)
  ├─ Creates a <div class="card"> for each card and appends to #board
  └─ showScreen("game") → switches visible section
        ↓
User clicks a face-down tile
        ↓
onCardClick(card) flips the card (adds .is-flipped class)
        ↓
When two cards are flipped → checkForMatch()
  ├─ Match: both cards get .is-matched, matchedPairs++
  └─ No match: cards shake, then flip back after 700 ms
        ↓
flipCount is incremented and the navbar counter updates
        ↓
When matchedPairs === 32 → endGame() after 500 ms
        ↓
Result screen shows total flip count
        ↓
User clicks "Play Again" → startGame() restarts
```

---

## Key Features

- 8×8 board with 64 tiles hiding 32 matched emoji pairs.
- CSS 3D flip animation using `perspective`, `preserve-3d`, and `backface-visibility`.
- Standard Mode (unlimited flips) and Challenge Mode (50-flip limit).
- Live flip counter and matched-pairs counter in the navbar during a game.
- Personal best high scores per mode, saved to `localStorage` and shown on the home screen.
- "New Personal Best" badge on the result screen when a record is beaten.
- Mismatched cards shake before flipping back after 700 ms.
- Restart and Play Again buttons reset the game without a page reload.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Semantic sections for home, game, and result screens |
| CSS3 (Grid, Flexbox, 3D transforms) | Board layout, navbar, card flip effect |
| Vanilla JavaScript (ES6+) | Game logic, DOM creation, event handling |
| localStorage API | High score persistence per mode |
| Google Fonts (Fraunces, Space Grotesk) | Display and body typography |

---

## File Responsibilities

### `index.html`

- `#homeScreen` — hero copy, game mode select, personal best displays, Start Game button.
- `#gameScreen` — `#board` container where cards are injected.
- `#resultScreen` — result label, title, copy, and Play Again button.
- `.navbar` — flip / flips-left / pairs stats plus a Restart button, visible only during a game.

### `script.js`

- `SYMBOLS` — the 32 emoji characters used as card faces.
- `buildDeck()` — duplicates and shuffles the symbols with Fisher-Yates, returning `{ id, symbol }` cards.
- `startGame()` — resets state, builds card DOM elements, and shows the game screen.
- `onCardClick(card)` — guards double-clicks and locked boards, flips a card, and triggers match checks.
- `checkForMatch()` — compares the two flipped cards; marks matches or schedules the 700 ms flip-back.
- `endGame(victory)` — writes the result, updates high scores, and shows the result screen.
- `showScreen(screen)` — toggles the `hidden` attribute across the three screens and navbar stats.
- `shuffle(array)` — in-place Fisher-Yates shuffle.
- State variables: `flippedCards`, `matchedPairs`, `flipCount`, `flipsLeft`, `currentMode`, `boardLocked`.

### `utils.js`

- `getHighScore(mode)` — reads the best score from `localStorage`, falling back to legacy `pairwise_...` keys.
- `saveHighScore(score, mode)` — stores a new best only when the score improves; returns `true` for a new record.

### `style.css`

- `.card__inner` — `transform-style: preserve-3d` with a `transition: transform 0.45s` flip.
- `.card__face--front` — `rotateY(180deg)` with `backface-visibility: hidden`.
- `.is-flipped` / `.is-matched` — rotates the card inner 180 degrees to reveal the front face.
- `.is-mismatch` — brief shake keyframe for failed pairs.
- `#board` — CSS Grid with `repeat(8, 1fr)`.

---

## Design Decisions

- **CSS-only 3D flip** — the card reveal is a pure CSS transform transition, keeping the JavaScript small and the animation smooth.
- **Module-level state** — counters and the flipped-cards stack are module-level variables in `script.js`; the UI is driven directly from them.
- **Separate `utils.js`** — high-score logic is isolated from the DOM so it can be unit tested with Node.js (UMD `module.exports`).
- **Emoji instead of images** — the 32 symbols are Unicode emoji embedded in source, so there are no image assets to load.
- **Fewer flips is better** — `saveHighScore` only writes when the new flip count is strictly lower than the stored best.

---

## Dependencies

| Library              | Source           | Purpose                 |
| -------------------- | ---------------- | ----------------------- |
| Fraunces (font)      | Google Fonts CDN | Display headings        |
| Space Grotesk (font) | Google Fonts CDN | Body text and UI labels |

No JavaScript libraries are used.

---

## Future Improvements

- **Difficulty levels** — offer smaller grids (e.g. 4×4, 6×6) for beginners alongside the full 8×8 board.
- **Timer** — show elapsed time alongside the flip count to give players a second metric to improve.
- **Themed card sets** — allow players to switch between emoji categories (animals, food, sports) without changing the game rules.
- **Sound effects** — add audio cues for matches and mismatches.
- **Accessibility** — add `aria-label` attributes to each card describing its state (face-down, flipped, matched) for screen reader support.

---

## Known Limitations

- The board is fixed at 8×8; there is no smaller-grid difficulty option.
- No timer is shown, so players cannot compare completion time.
- Emoji rendering depends on the operating system's font support.
- No sound effects for matches or mismatches.
- No touch-specific optimizations or keyboard controls.

---

## Development Notes

- No build step is required. Open `index.html` in a browser or serve the folder with a static server.
- `utils.js` exports via UMD, so high-score logic can be exercised in Node:
  `node -e "const u = require('./projects/games/memory-flip-game/utils.js'); console.log(u.getHighScore('standard'))"`
- Run the unit tests with:
  `node --test tests/memory-flip.test.js`
- High scores live under the `cradle_memory_flip_high_score` and `cradle_memory_flip_challenge_high_score` keys; legacy `pairwise_...` keys are read for backward compatibility.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - Fraunces font by Google Fonts (OFL license), loaded from the Google Fonts CDN.
  - Space Grotesk font by Google Fonts (OFL license), loaded from the Google Fonts CDN.

---

## References

- [MDN Web Docs — Using CSS 3D transforms](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transforms/Using_CSS_transforms)
- [MDN Web Docs — Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [Fisher–Yates shuffle — Wikipedia](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle)
