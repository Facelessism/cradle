# Project Architecture

## Overview

Property Baron is a single-page, hotseat (pass-and-play) Monopoly game for 2–4 players. It uses the real Monopoly board — same 40 spaces, same names, same prices, same layout as the official US board — but with a simplified ruleset: no houses/hotels, no mortgaging, no trading, and short Chance/Community Chest decks (8 cards each instead of 16).

Everything lives in one HTML file. There's no build step, no server, and no external JS libraries — just open the file in a browser.

---

## Purpose & Goals

- Recreate the classic Monopoly board and core buying/renting loop in a single-page, pass-and-play game.
- Support 2–4 local players with a setup screen for player count and names.
- Keep the ruleset simple enough to fit in one file with no external libraries.
- Extract pure helpers (`cellGridArea`, `computeRent`) into `gameLogic.js` so they can be unit tested with Node.js.

---

## Folder Structure

```
monopoly/
├── index.html     # Board container, side panel, setup overlay, card modal
├── style.css      # CSS Grid board layout, dice pips, buttons, modals
├── script.js      # Board data, game rules, turn logic, and rendering
└── gameLogic.js   # Pure helpers (grid placement, rent math) for headless testing
```

---

## System / Project Architecture Overview

The game is a single-page app with two clear layers. The `BOARD` array in `script.js` is the data model: 40 space objects in board order. Game state lives in three module-level variables — `players[]`, `owners{}`, and `currentPlayerIdx`. `renderAll()` always redraws the DOM from that state, so the UI never holds truth. Pure helpers shared with tests live in `gameLogic.js`, which is not loaded by the page but is imported by the Node test suite. There is no build step and no external library.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Board, players/turn/log panel, setup overlay, Chance/Chest modal |
| `script.js` | Board data, cards, game state, dice/turn logic, rendering, event handling |
| `gameLogic.js` | `cellGridArea` and `computeRent` as pure, Node-testable functions |
| `style.css` | 11x11 CSS Grid board, CSS dice pips, buttons, modal overlay |

---

## Data Flow / Execution Flow

```
User opens index.html
        ↓
Setup screen is shown
        ↓
User picks number of players (2–4) and enters names
        ↓
User clicks "Start Game"
  ├─ Creates a players[] array (cash, position, token color, etc.)
  ├─ initBoard() → builds all 40 board cells and places them on the grid
  └─ renderAll() → draws tokens, ownership markers, and the players list
        ↓
Current player clicks "Roll Dice"
  ├─ Two dice are rolled, player token moves that many spaces
  ├─ If they pass GO, they collect $200
  └─ resolveSpace() figures out what happens on the landed space
        ↓
resolveSpace() branches by space type:
  ├─ Unowned property/railroad/utility → show "Buy" button
  ├─ Owned by someone else → charge rent automatically
  ├─ Owned by the player themself → nothing happens
  ├─ Tax space → charge the tax amount
  ├─ Chance / Community Chest → draw a random card, show it in a popup, apply its effect
  ├─ Go To Jail → send player to jail
  └─ Free Parking / just visiting Jail / GO → nothing happens
        ↓
Player clicks "End Turn" (or rolls again if they rolled doubles)
        ↓
Turn passes to the next non-bankrupt player
        ↓
If a player's cash goes below $0 → they go bankrupt, their properties return to the bank
        ↓
When only one player is left → that player wins, buttons are disabled
```

---

## Key Features

- Full 40-space board matching the official US layout and names (Mediterranean Avenue through Boardwalk).
- Hotseat play for 2–4 players, each with a color token, a letter, and $1500 starting cash.
- Dice rendered as CSS pips with doubles detection and a running sum display.
- Buy unowned properties, railroads, and utilities when landed on.
- Rent system: base rents for properties, escalating rents for railroads (25/50/100/200), and dice-based utility rent (4x or 10x the dice sum).
- Chance and Community Chest decks of 8 cards each, shown in a modal before their effect applies.
- Jail mechanics: roll doubles to escape, pay $50 bail after three failed turns, and three consecutive doubles send the player to jail.
- $200 collected for passing GO; Income Tax and Luxury Tax charged automatically.
- Bankruptcy hands the player's properties back to the bank; the last player standing wins.
- Live game log and status messages.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Board, panels, overlay, modal markup |
| CSS3 (Grid, Flexbox) | 11x11 board layout, dice pips, buttons |
| Vanilla JavaScript (ES6+) | Game state, rules, DOM rendering, events |
| Node.js test runner | Headless tests for `gameLogic.js` |

---

## File Responsibilities

### `index.html`

- `#board` — the 11x11 grid that cells are injected into at game start.
- Side panel — Players list, dice area with `#die1`/`#die2`, status message, and Roll Dice / Buy Property / End Turn buttons.
- `#log` — scrollable game log.
- `#setupOverlay` — player count picker (2–4) and name inputs.
- `#modalOverlay` — Chance/Community Chest card popup.

### `script.js`

- `BOARD` — the 40-space data array (type, name, price, rent where relevant).
- `CHANCE_CARDS` / `CHEST_CARDS` — 8 cards each; every card has `text` and an `fn` that mutates the active player.
- `initBoard()` / `cellGridArea()` — creates one `.cell` per space and places it on the grid.
- `renderTokens()` / `renderOwnership()` / `renderPlayers()` / `renderAll()` — redraw the UI from state.
- `doRoll()` — rolls two dice, resolves jail rules, moves the player, and collects $200 for passing GO.
- `resolveSpace()` — branches by space type: buy offer, rent, tax, card draw, jail, or nothing.
- `computeRent()` — returns the correct rent for properties, railroads, and utilities.
- `buyCurrentProperty()` — deducts the price and records ownership in `owners{}`.
- `endTurn()` — gives a doubles re-roll or advances to the next non-bankrupt player.
- `handleBankruptcy()` / `checkGameOver()` — removes bankrupt players and detects the winner.
- `showCardModal()` — renders a card and applies its effect on OK.

### `gameLogic.js`

- `cellGridArea(i)` — maps a space index 0–39 to a grid column/row (shared with `script.js`).
- `computeRent(space, owner, diceSum, owners, board)` — pure rent math used by the unit tests.

### `style.css`

- `.board` — 11x11 CSS Grid holding the 40 cells plus the center logo.
- `.die` / `.pip` — dice faces built from a 3x3 grid of pips toggled via the `data-v` attribute.
- `.owner-strip` / `.owner-dot` — ownership markers on owned spaces.
- `.setup-overlay` / `.modal-overlay` — full-screen overlays.

---

## Design Decisions

- **Data-driven board** — every space is data in the `BOARD` array; rendering and rules branch on `type`, so adding a board variant is just data.
- **Single source of truth** — `players[]` and `owners{}` are the only state; all render functions read from them, and the UI is never mutated directly.
- **Grid placement math** — `cellGridArea()` converts a space index to grid coordinates, so no hard-coded cell positions are needed.
- **Simplified ruleset** — houses/hotels, mortgaging, trading, and auctions are omitted to keep the codebase small while preserving the familiar board and loop.
- **Pure helpers extracted** — `cellGridArea` and `computeRent` live in `gameLogic.js` (with `module.exports`) so the Node test suite can run them without a browser.
- **CSS-only dice** — die faces are pure CSS pips toggled with a data attribute, avoiding any image assets.

---

## Dependencies

None. The project uses only native browser APIs — no external libraries, fonts, or build tools.

---

## Future Improvements

- **Houses & hotels** — let players build once they own a full color group, with rent scaling per the real rent tables.
- **Mortgaging** — let a cash-short player mortgage properties to the bank instead of going bankrupt immediately.
- **Trading** — let players propose and accept property/cash trades with each other.
- **Full 16-card decks** — fill out the remaining Chance and Community Chest cards from the official rules.
- **Auctions** — when a player declines to buy, auction the property to all players instead of leaving it unowned.

---

## Known Limitations

- No houses or hotels — rent is always the base rate.
- No mortgaging properties.
- No trading between players.
- Chance and Community Chest decks have 8 cards each instead of the official 16.
- No bank auction when a player declines to buy a property.
- Local hotseat only — no computer opponents and no network play.
- No save/load — the session resets on page reload.

---

## Development Notes

- No build step is required. Open `index.html` in a browser.
- `gameLogic.js` is not loaded by the page; it exists for headless testing. Run:
  `node --test tests/monopoly.test.js`
- The board order in `BOARD` matches the official US board (Mediterranean Avenue → Boardwalk).
- To tweak rents, edit `computeRent()`; to tweak card effects, edit the `fn` callbacks in `CHANCE_CARDS` / `CHEST_CARDS`.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None. No images, fonts, or audio are used — the board names and prices follow the standard Monopoly game layout.

---

## References

- [Monopoly (game) — Wikipedia](https://en.wikipedia.org/wiki/Monopoly_(game))
- [MDN Web Docs — CSS Grid Layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout)
